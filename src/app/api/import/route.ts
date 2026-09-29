import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { diagnoseJsonText } from '@/lib/import-json-diagnostic'
import { ImportError, importErrorStatus, type ImportErrorCode } from '@/lib/import-errors'
import {
  capArr,
  cleanCadrage, cleanSourceRisque, cleanPartiePrenante, cleanScenarioStrat,
  cleanScenarioOp, cleanRisque, cleanMesure,
} from '@/lib/import-sanitize'

// Allowlists + clamps + caps par modèle : voir src/lib/import-sanitize.ts (#117).

// ─── JSON import ──────────────────────────────────────────────────────────────

async function importJSON(raw: string, userId: string) {
  const diag = diagnoseJsonText(raw)
  if (!diag.ok) throw new ImportError(diag.code, { line: diag.line, column: diag.column, snippet: diag.snippet, hint: diag.hint })
  const payload = diag.value as any
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new ImportError('json_not_object')

  // Support both `{ analyse: {...} }` (export format) and a bare analyse object
  const src = payload.analyse ?? payload
  if (!src || typeof src !== 'object' || !src.nom) throw new ImportError('json_missing_name')

  // Deduplicate name
  const baseName = `${src.nom} (importé)`
  const existing = await prisma.analyse.count({ where: { userId, nom: { startsWith: baseName } } })
  const nom = existing > 0 ? `${baseName} ${existing + 1}` : baseName

  const analyse = await prisma.analyse.create({
    data: {
      userId,
      nom,
      organisation:   src.organisation  || '',
      secteur:        src.secteur        || '',
      // Sécurité (#117) : ne JAMAIS faire confiance au `statut` du fichier importé.
      // Une analyse importée repart toujours EN_COURS — sinon un importeur pourrait
      // forger SOUMIS (injection dans la file d'approbation sans soumission auditée)
      // ou TERMINE/ARCHIVE (analyse « validée » sans revue) → contournement du
      // workflow RBAC (A01). Le chemin CSV force déjà EN_COURS (cohérence).
      statut:         'EN_COURS',
      atelierCourant: src.atelierCourant || 1,
      cadrage: src.cadrage ? {
        create: cleanCadrage(src.cadrage),
      } : undefined,
      // capArr borne chaque collection à IMPORT_MAX_ITEMS (anti-DoS #117) avant .map.
      sourcesRisque: capArr(src.sourcesRisque).length ? {
        create: capArr(src.sourcesRisque).map(cleanSourceRisque),
      } : undefined,
      partiesPrenantes: capArr(src.partiesPrenantes).length ? {
        create: capArr(src.partiesPrenantes).map(cleanPartiePrenante),
      } : undefined,
      scenariosStrategiques: capArr(src.scenariosStrategiques).length ? {
        create: capArr(src.scenariosStrategiques).map(cleanScenarioStrat),
      } : undefined,
      scenariosOperationnels: capArr(src.scenariosOperationnels).length ? {
        create: capArr(src.scenariosOperationnels).map(cleanScenarioOp),
      } : undefined,
      risques: capArr(src.risques).length ? {
        create: capArr(src.risques).map(cleanRisque),
      } : undefined,
      mesures: capArr(src.mesures).length ? {
        create: capArr(src.mesures).map(cleanMesure),
      } : undefined,
    },
  })

  return { id: analyse.id, nom: analyse.nom }
}

// ─── CSV import ───────────────────────────────────────────────────────────────
// Format: sections délimitées par "=== TITRE ===" comme dans l'export

async function importCSV(raw: string, userId: string) {
  const lines = raw.split(/\r?\n/)
  let section = ''
  let nom = 'Analyse importée (CSV)'
  let organisation = ''
  let secteur = ''
  const sourcesRisque: any[] = []
  const scenariosStrategiques: any[] = []
  const scenariosOperationnels: any[] = []
  const risques: any[] = []
  const mesures: any[] = []

  let sectionsVues = 0
  const unquote = (s: string) => s.replace(/^"|"$/g, '').replace(/""/g, '"').trim()

  function splitCSVLine(line: string): string[] {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (c === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
        else inQuotes = !inQuotes
      } else if (c === ',' && !inQuotes) {
        result.push(current); current = ''
      } else {
        current += c
      }
    }
    result.push(current)
    return result.map(unquote)
  }

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue

    // Section headers
    const sectionMatch = line.match(/^=== (.+) ===$/)
    if (sectionMatch) {
      section = sectionMatch[1]
      sectionsVues++
      continue
    }

    // Skip column headers
    if (line.startsWith('Nom,') || line.startsWith('=')) continue

    const cols = splitCSVLine(line)

    if (!section) {
      // Metadata lines: "Nom,CHU Métropole"
      const [key, val] = line.split(',').map(s => unquote(s))
      if (key === 'Nom') nom = val || nom
      else if (key === 'Organisation') organisation = val || ''
      else if (key === 'Secteur') secteur = val || ''
      continue
    }

    if (section === 'SOURCES DE RISQUE' && cols[0]) {
      sourcesRisque.push({
        nom: cols[0], categorie: cols[1] || 'CYBERCRIMINEL',
        pertinence: parseInt(cols[2]) || 3,
        retenu: cols[3] === 'Oui',
        objectifsVises: [],
        motivation: 3, ressources: 3, activite: 3,
        description: '',
      })
    } else if (section === 'SCÉNARIOS STRATÉGIQUES' && cols[0]) {
      scenariosStrategiques.push({
        nom: cols[0], vraisemblance: parseInt(cols[1]) || 2,
        gravite: parseInt(cols[2]) || 2,
        niveauRisque: parseInt(cols[3]) || 4,
        retenu: cols[4] === 'Oui',
        objectifVise: '', sourceRisqueRef: '', evenementRedouteRef: '',
        mesuresEcosysteme: [],
      })
    } else if (section === 'SCÉNARIOS OPÉRATIONNELS' && cols[0]) {
      scenariosOperationnels.push({
        nom: cols[0], vraisemblance: parseInt(cols[1]) || 2,
        gravite: parseInt(cols[2]) || 2,
        cheminsAttaque: [], actionsMenace: [],
      })
    } else if (section === 'RISQUES ET TRAITEMENT' && cols[0]) {
      risques.push({
        nom: cols[0], gravite: parseInt(cols[1]) || 2,
        vraisemblance: parseInt(cols[2]) || 2,
        niveauRisque: parseInt(cols[3]) || 4,
        strategie: cols[4] || 'REDUIRE',
        niveauResiduel: cols[5] ? parseInt(cols[5]) : null,
        scenarioRef: '',
      })
    } else if (section === 'MESURES DE SÉCURITÉ' && cols[0]) {
      mesures.push({
        nom: cols[0], type: cols[1] || 'ORGANISATIONNELLE',
        priorite: parseInt(cols[2]) || 2,
        statut: cols[3] || 'A_FAIRE',
        responsable: cols[4] || '',
        echeance: null,
        description: '', cout: '', efficacite: 3,
      })
    }
  }

  // Un CSV sans aucune section « === TITRE === » n'est pas un export ACRA : on ne crée pas une analyse vide.
  if (sectionsVues === 0) throw new ImportError('csv_not_acra')

  // Deduplicate name
  const baseName = `${nom} (importé)`
  const existing = await prisma.analyse.count({ where: { userId, nom: { startsWith: baseName } } })
  const finalNom = existing > 0 ? `${baseName} ${existing + 1}` : baseName

  const analyse = await prisma.analyse.create({
    data: {
      userId, nom: finalNom, organisation, secteur,
      statut: 'EN_COURS', atelierCourant: 1,
      // capArr borne chaque collection à IMPORT_MAX_ITEMS (anti-DoS #117).
      sourcesRisque:         capArr(sourcesRisque).length         ? { create: capArr(sourcesRisque) }         : undefined,
      scenariosStrategiques: capArr(scenariosStrategiques).length ? { create: capArr(scenariosStrategiques) } : undefined,
      scenariosOperationnels: capArr(scenariosOperationnels).length ? { create: capArr(scenariosOperationnels) } : undefined,
      risques:               capArr(risques).length               ? { create: capArr(risques) }               : undefined,
      mesures:               capArr(mesures).length               ? { create: capArr(mesures) }               : undefined,
    },
  })

  return { id: analyse.id, nom: analyse.nom }
}

// ─── Route handler ────────────────────────────────────────────────────────────

// POST /api/import — importe une analyse complète (JSON) pour l'utilisateur connecté ; payload assaini via import-sanitize, limité à 10 imports/h.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const userId = (session.user as any).id

  // Rate limiting : 10 imports / heure par utilisateur
  const { rateLimit: rl_fn, rateLimitHeaders: rlHeaders, LIMIT_IMPORT } = await import('@/lib/rate-limit')
  const rl = await rl_fn(`import:${userId}`, LIMIT_IMPORT.limit, LIMIT_IMPORT.windowMs)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'import_rate_limited' satisfies ImportErrorCode }, { status: 429, headers: rlHeaders(rl.remaining, rl.resetAt) })
  }

  let body: { data: string; format: 'json' | 'csv' }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'import_request_invalid' satisfies ImportErrorCode }, { status: 400 })
  }

  if (typeof body.data !== 'string' || !body.format) return NextResponse.json({ error: 'import_request_invalid' satisfies ImportErrorCode }, { status: 400 })
  if (!body.data.trim()) return NextResponse.json({ error: 'import_file_empty' satisfies ImportErrorCode }, { status: 400 })
  if (!['json', 'csv'].includes(body.format)) return NextResponse.json({ error: 'import_format_unsupported' satisfies ImportErrorCode }, { status: 400 })
  // Limiter la taille du payload importé (2 MB max)
  if (body.data.length > 2 * 1024 * 1024) return NextResponse.json({ error: 'import_file_too_large' satisfies ImportErrorCode }, { status: 413 })

  try {
    const result = body.format === 'json'
      ? await importJSON(body.data, userId)
      : await importCSV(body.data, userId)

    return NextResponse.json(result, { status: 201 })
  } catch (err: any) {
    // Codes stables + détails structurés (traduits par l'interface) ; jamais le message brut d'une erreur interne.
    if (err instanceof ImportError) return NextResponse.json({ error: err.code, details: err.details }, { status: importErrorStatus(err.code) })
    return NextResponse.json({ error: 'import_failed' satisfies ImportErrorCode }, { status: 422 })
  }
}
