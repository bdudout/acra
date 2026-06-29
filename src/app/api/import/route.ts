import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

// Allowlists par modèle — évite le mass assignment si le schéma évolue

function cleanCadrage(obj: any): any {
  if (!obj) return obj
  return {
    perimetre:    obj.perimetre    != null ? String(obj.perimetre).slice(0, 5000)  : undefined,
    tailleAnalyse: ['STANDARD', 'TPE', 'PME', 'ETI_GE'].includes(obj.tailleAnalyse) ? obj.tailleAnalyse : undefined,
    contexte:     obj.contexte     != null ? String(obj.contexte).slice(0, 5000)   : undefined,
    objectifs:    obj.objectifs    != null ? String(obj.objectifs).slice(0, 5000)  : undefined,
    evenementsRedoutes: Array.isArray(obj.evenementsRedoutes) ? obj.evenementsRedoutes : undefined,
    valeursMetier:      Array.isArray(obj.valeursMetier)      ? obj.valeursMetier      : undefined,
    biensSupports:      Array.isArray(obj.biensSupports)      ? obj.biensSupports      : undefined,
    missions:           Array.isArray(obj.missions)           ? obj.missions           : undefined,
    referentiel:  obj.referentiel != null ? String(obj.referentiel).slice(0, 100) : undefined,
  }
}

function cleanSourceRisque(obj: any): any {
  return {
    nom:            String(obj.nom        ?? '').slice(0, 255),
    categorie:      obj.categorie     != null ? String(obj.categorie).slice(0, 100) : undefined,
    pertinence:     Number(obj.pertinence)  || 3,
    retenu:         Boolean(obj.retenu),
    motivation:     Number(obj.motivation)  || 3,
    ressources:     Number(obj.ressources)  || 3,
    activite:       Number(obj.activite)    || 3,
    description:    obj.description   != null ? String(obj.description).slice(0, 2000) : undefined,
    objectifsVises: Array.isArray(obj.objectifsVises) ? obj.objectifsVises : [],
  }
}

function cleanPartiePrenante(obj: any): any {
  // Méthode Club EBIOS : 4 sous-critères 1-4 → exposition = dép×pén · fiabilité = mat×conf.
  const clamp14 = (v: any, def: number) => {
    const n = Number(v)
    return Number.isFinite(n) ? Math.max(1, Math.min(4, n)) : def
  }
  const dependance  = clamp14(obj.dependance, 2)
  const penetration = clamp14(obj.penetration, 2)
  const maturite    = clamp14(obj.maturite, 3)
  const confiance   = clamp14(obj.confiance, 3)
  return {
    nom:             String(obj.nom         ?? '').slice(0, 255),
    type:            String(obj.type        ?? 'FOURNISSEUR').slice(0, 50),
    dependance, penetration, maturite, confiance,
    exposition:      dependance * penetration,
    fiabilite:       maturite * confiance,
    description:     obj.description != null ? String(obj.description).slice(0, 2000) : undefined,
  }
}

function cleanScenarioStrat(obj: any): any {
  return {
    nom:                  String(obj.nom             ?? '').slice(0, 255),
    vraisemblance:        Number(obj.vraisemblance)   || 2,
    gravite:              Number(obj.gravite)          || 2,
    niveauRisque:         Number(obj.niveauRisque)     || 4,
    retenu:               Boolean(obj.retenu),
    description:          obj.description       != null ? String(obj.description).slice(0, 2000) : undefined,
    objectifVise:         obj.objectifVise       != null ? String(obj.objectifVise).slice(0, 500) : undefined,
    sourceRisqueRef:      obj.sourceRisqueRef    != null ? String(obj.sourceRisqueRef).slice(0, 255) : undefined,
    evenementRedouteRef:  obj.evenementRedouteRef != null ? String(obj.evenementRedouteRef).slice(0, 255) : undefined,
    mesuresEcosysteme:    Array.isArray(obj.mesuresEcosysteme) ? obj.mesuresEcosysteme : [],
  }
}

function cleanScenarioOp(obj: any): any {
  return {
    nom:            String(obj.nom         ?? '').slice(0, 255),
    vraisemblance:  Number(obj.vraisemblance) || 2,
    gravite:        Number(obj.gravite)       || 2,
    description:    obj.description != null ? String(obj.description).slice(0, 2000) : undefined,
    cheminsAttaque: Array.isArray(obj.cheminsAttaque) ? obj.cheminsAttaque : [],
    actionsMenace:  Array.isArray(obj.actionsMenace)  ? obj.actionsMenace  : [],
  }
}

function cleanRisque(obj: any): any {
  return {
    nom:            String(obj.nom         ?? '').slice(0, 255),
    gravite:        Number(obj.gravite)       || 2,
    vraisemblance:  Number(obj.vraisemblance) || 2,
    niveauRisque:   Number(obj.niveauRisque)  || 4,
    strategie:      obj.strategie    != null ? String(obj.strategie).slice(0, 50)   : undefined,
    niveauResiduel: obj.niveauResiduel != null ? Number(obj.niveauResiduel) : undefined,
    description:    obj.description  != null ? String(obj.description).slice(0, 2000) : undefined,
    scenarioRef:    obj.scenarioRef  != null ? String(obj.scenarioRef).slice(0, 255) : undefined,
  }
}

function cleanMesure(obj: any): any {
  return {
    nom:         String(obj.nom       ?? '').slice(0, 255),
    description: obj.description != null ? String(obj.description).slice(0, 2000) : undefined,
    type:        obj.type        != null ? String(obj.type).slice(0, 50)          : undefined,
    priorite:    Number(obj.priorite) || 2,
    statut:      String(obj.statut ?? 'A_FAIRE').slice(0, 50),
    responsable: obj.responsable != null ? String(obj.responsable).slice(0, 200)  : undefined,
    entite:      obj.entite      != null ? String(obj.entite).trim().slice(0, 100): undefined,
    echeance:    obj.echeance    != null ? new Date(obj.echeance) : undefined,
    cout:        obj.cout        != null ? String(obj.cout).slice(0, 100)         : undefined,
    efficacite:  obj.efficacite  != null ? Number(obj.efficacite) : undefined,
    referentiel: obj.referentiel != null ? String(obj.referentiel).slice(0, 100)  : undefined,
    codeRef:     obj.codeRef     != null ? String(obj.codeRef).slice(0, 50)       : undefined,
  }
}

// ─── JSON import ──────────────────────────────────────────────────────────────

async function importJSON(raw: string, userId: string) {
  let payload: any
  try {
    payload = JSON.parse(raw)
  } catch {
    throw new Error('Fichier JSON invalide.')
  }

  // Support both `{ analyse: {...} }` (export format) and a bare analyse object
  const src = payload.analyse ?? payload
  if (!src.nom) throw new Error('Champ "nom" manquant dans le fichier.')

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
      statut:         src.statut === 'APPROUVE' ? 'TERMINE' : (src.statut || 'EN_COURS'),
      atelierCourant: src.atelierCourant || 1,
      cadrage: src.cadrage ? {
        create: cleanCadrage(src.cadrage),
      } : undefined,
      sourcesRisque: src.sourcesRisque?.length ? {
        create: src.sourcesRisque.map((s: any) => cleanSourceRisque(s)),
      } : undefined,
      partiesPrenantes: src.partiesPrenantes?.length ? {
        create: src.partiesPrenantes.map((p: any) => cleanPartiePrenante(p)),
      } : undefined,
      scenariosStrategiques: src.scenariosStrategiques?.length ? {
        create: src.scenariosStrategiques.map((s: any) => cleanScenarioStrat(s)),
      } : undefined,
      scenariosOperationnels: src.scenariosOperationnels?.length ? {
        create: src.scenariosOperationnels.map((s: any) => cleanScenarioOp(s)),
      } : undefined,
      risques: src.risques?.length ? {
        create: src.risques.map((r: any) => cleanRisque(r)),
      } : undefined,
      mesures: src.mesures?.length ? {
        create: src.mesures.map((m: any) => cleanMesure(m)),
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

  // Deduplicate name
  const baseName = `${nom} (importé)`
  const existing = await prisma.analyse.count({ where: { userId, nom: { startsWith: baseName } } })
  const finalNom = existing > 0 ? `${baseName} ${existing + 1}` : baseName

  const analyse = await prisma.analyse.create({
    data: {
      userId, nom: finalNom, organisation, secteur,
      statut: 'EN_COURS', atelierCourant: 1,
      sourcesRisque:         sourcesRisque.length         ? { create: sourcesRisque }         : undefined,
      scenariosStrategiques: scenariosStrategiques.length ? { create: scenariosStrategiques } : undefined,
      scenariosOperationnels: scenariosOperationnels.length ? { create: scenariosOperationnels } : undefined,
      risques:               risques.length               ? { create: risques }               : undefined,
      mesures:               mesures.length               ? { create: mesures }               : undefined,
    },
  })

  return { id: analyse.id, nom: analyse.nom }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const userId = (session.user as any).id

  // Rate limiting : 10 imports / heure par utilisateur
  const { rateLimit: rl_fn, rateLimitHeaders: rlHeaders, LIMIT_IMPORT } = await import('@/lib/rate-limit')
  const rl = rl_fn(`import:${userId}`, LIMIT_IMPORT.limit, LIMIT_IMPORT.windowMs)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Limite d\'import atteinte. Réessayez dans une heure.' },
      { status: 429, headers: rlHeaders(rl.remaining, rl.resetAt) }
    )
  }

  let body: { data: string; format: 'json' | 'csv' }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 })
  }

  if (!body.data || !body.format) {
    return NextResponse.json({ error: 'Champs "data" et "format" requis' }, { status: 400 })
  }
  if (!['json', 'csv'].includes(body.format)) {
    return NextResponse.json({ error: 'Format non supporté (json ou csv uniquement)' }, { status: 400 })
  }
  // Limiter la taille du payload importé (2 MB max)
  if (body.data.length > 2 * 1024 * 1024) {
    return NextResponse.json({ error: 'Fichier trop volumineux (max 2 Mo)' }, { status: 413 })
  }

  try {
    const result = body.format === 'json'
      ? await importJSON(body.data, userId)
      : await importCSV(body.data, userId)

    return NextResponse.json(result, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erreur lors de l\'import' }, { status: 422 })
  }
}
