import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canViewAnalyse } from '@/lib/permissions'
import { rateLimit, rateLimitHeaders, LIMIT_EXPORT } from '@/lib/rate-limit'
import { sanitizeForSpreadsheet } from '@/lib/spreadsheet-safe'
import ExcelJS from 'exceljs'
import { createRequire } from 'node:module'
// Import side-effect uniquement : force Next à TRACER @react-pdf/renderer dans le
// build standalone (le rendu réel passe par le CJS esbuild chargé au runtime).
import '@react-pdf/renderer'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { id } = await params
  const userId   = (session.user as any).id
  const userRole = (session.user as any).role ?? 'ANALYSTE'

  // Rate limiting : 20 exports / heure par utilisateur
  const rl = rateLimit(`export:${userId}`, LIMIT_EXPORT.limit, LIMIT_EXPORT.windowMs)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Limite d\'export atteinte. Réessayez dans une heure.' },
      { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetAt) }
    )
  }
  const { searchParams } = new URL(req.url)
  const format = searchParams.get('format') || 'json'

  // A01: utiliser canViewAnalyse — inclut propriétaire ET accès partagés
  const analyse = await prisma.analyse.findUnique({
    where: { id },
    include: {
      accesUtilisateurs: true,
      cadrage: true,
      sourcesRisque: true,
      partiesPrenantes: true,
      scenariosStrategiques: true,
      scenariosOperationnels: true,
      risques: true,
      mesures: true,
    },
  })

  if (!analyse) return NextResponse.json({ error: 'Analyse introuvable' }, { status: 404 })

  if (!canViewAnalyse(
    { id: userId, role: userRole },
    { userId: analyse.userId, accesUtilisateurs: analyse.accesUtilisateurs }
  )) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  if (format === 'json') {
    // Exclure les champs d'accès granulaires de l'export
    const { accesUtilisateurs: _, ...exportData } = analyse
    return NextResponse.json({ analyse: exportData })
  }

  if (format === 'pdf') {
    // Génération PDF côté serveur via @react-pdf/renderer
    try {
      // Charge le template PDF pré-compilé par esbuild au RUNTIME (require dynamique
      // hors du bundle Next) — SWC casse le rendu react-pdf (« React error #31 »).
      const req = createRequire(process.cwd() + '/package.json')
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { renderAnalysePDF } = req(process.cwd() + '/.pdf-runtime/pdf-template.cjs')
      const { accesUtilisateurs: _ac, ...pdfData } = analyse
      // Échelles configurées par l'organisation (annexe dynamique du PDF)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const config = await (prisma as any).configuration.findUnique({ where: { id: 'global' } }).catch(() => null)
      const buffer = await renderAnalysePDF(pdfData, config)
      const safeName = analyse.nom.replace(/[^a-zA-Z0-9\-_]/g, '-').slice(0, 64)
      return new NextResponse(buffer as unknown as ArrayBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="ebios-rm-${safeName}.pdf"`,
          'Cache-Control': 'no-store',
        },
      })
    } catch (err) {
      console.error('[export pdf] génération échouée', err)
      return NextResponse.json({ error: 'Échec de la génération du PDF' }, { status: 500 })
    }
  }

  if (format === 'csv') {
    const lines: string[] = []
    // Neutralise l'injection de formules (=,+,-,@) AVANT l'échappement CSV des guillemets
    const esc = (s: any) => `"${sanitizeForSpreadsheet(s).replace(/"/g, '""')}"`

    lines.push('=== ANALYSE ACRA — EBIOS RM ===')
    lines.push(`Nom,${esc(analyse.nom)}`)
    lines.push(`Organisation,${esc(analyse.organisation)}`)
    lines.push(`Secteur,${esc(analyse.secteur)}`)
    lines.push(`Date,${new Date(analyse.createdAt).toLocaleDateString('fr-FR')}`)
    lines.push('')

    lines.push('=== SOURCES DE RISQUE ===')
    lines.push('Nom,Catégorie,Pertinence,Retenu,Objectifs visés')
    for (const sr of analyse.sourcesRisque) {
      const ovs = (sr.objectifsVises as any[] || []).map((o: any) => o.nom).join(' | ')
      lines.push(`${esc(sr.nom)},${esc(sr.categorie)},${sr.pertinence},${sr.retenu ? 'Oui' : 'Non'},${esc(ovs)}`)
    }
    lines.push('')

    lines.push('=== SCÉNARIOS STRATÉGIQUES ===')
    lines.push('Nom,Vraisemblance,Gravité,Niveau de risque,Retenu')
    for (const ss of analyse.scenariosStrategiques) {
      lines.push(`${esc(ss.nom)},${ss.vraisemblance},${ss.gravite},${ss.niveauRisque},${ss.retenu ? 'Oui' : 'Non'}`)
    }
    lines.push('')

    lines.push('=== SCÉNARIOS OPÉRATIONNELS ===')
    lines.push('Nom,Vraisemblance,Gravité')
    for (const so of analyse.scenariosOperationnels) {
      lines.push(`${esc(so.nom)},${so.vraisemblance},${so.gravite}`)
    }
    lines.push('')

    lines.push('=== RISQUES ET TRAITEMENT ===')
    lines.push('Nom,Gravité,Vraisemblance,Niveau,Stratégie,Niveau résiduel')
    for (const r of analyse.risques) {
      lines.push(`${esc(r.nom)},${r.gravite},${r.vraisemblance},${r.niveauRisque},${esc(r.strategie)},${r.niveauResiduel ?? ''}`)
    }
    lines.push('')

    lines.push('=== MESURES DE SÉCURITÉ ===')
    lines.push('Nom,Type,Priorité,Statut,Responsable,Entité,Échéance')
    for (const m of analyse.mesures) {
      lines.push(`${esc(m.nom)},${esc(m.type)},${m.priorite},${esc(m.statut)},${esc(m.responsable)},${esc((m as any).entite)},${m.echeance ? new Date(m.echeance).toLocaleDateString('fr-FR') : ''}`)
    }

    const csv = lines.join('\n')
    // Sanitize filename — pas d'injection dans Content-Disposition
    const safeName = analyse.nom.replace(/[^a-zA-Z0-9\-_]/g, '-').slice(0, 64)
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="acra-${safeName}.csv"`,
      },
    })
  }

  if (format === 'xlsx') {
    // Alias court pour neutraliser l'injection de formules sur les champs texte libres
    const S = sanitizeForSpreadsheet
    const wb = new ExcelJS.Workbook()
    wb.creator  = 'ACRA — Augmented Cyber Risk Analysis'
    wb.created  = new Date()
    wb.modified = new Date()

    // Style partagé pour les lignes d'en-tête
    const headerFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4338CA' } }
    const headerFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
    function styleHeaderRow(ws: ExcelJS.Worksheet) {
      ws.getRow(1).eachCell((cell: ExcelJS.Cell) => {
        cell.fill = headerFill
        cell.font = headerFont
        cell.alignment = { vertical: 'middle', wrapText: false }
      })
      ws.getRow(1).height = 20
    }

    // ── Feuille 1 : Résumé ─────────────────────────────────────────────
    const wsResume = wb.addWorksheet('Résumé')
    wsResume.columns = [
      { key: 'champ', width: 32 },
      { key: 'valeur', width: 52 },
    ]
    const cadrage = analyse.cadrage as { perimetre?: string } | null
    wsResume.addRows([
      ['ACRA — Analyse de risques EBIOS RM', ''],
      ['', ''],
      ['Nom de l\'analyse', S(analyse.nom)],
      ['Organisation', S(analyse.organisation ?? '')],
      ['Secteur', S(analyse.secteur ?? '')],
      ['Périmètre', S(cadrage?.perimetre ?? '')],
      ['Statut', analyse.statut],
      ['Date de création', new Date(analyse.createdAt).toLocaleDateString('fr-FR')],
      ['Dernière mise à jour', new Date(analyse.updatedAt).toLocaleDateString('fr-FR')],
      ['', ''],
      ['Statistiques', ''],
      ['Sources de risque retenues', analyse.sourcesRisque.filter((s: { retenu: boolean }) => s.retenu).length],
      ['Scénarios stratégiques retenus', analyse.scenariosStrategiques.filter((s: { retenu: boolean }) => s.retenu).length],
      ['Scénarios opérationnels', analyse.scenariosOperationnels.length],
      ['Risques identifiés', analyse.risques.length],
      ['Mesures de sécurité', analyse.mesures.length],
    ])
    // Titre en gras sur la première ligne
    wsResume.getCell('A1').font = { bold: true, size: 13 }

    // ── Feuille 2 : Sources de risque ──────────────────────────────────
    const wsSR = wb.addWorksheet('Sources de risque')
    wsSR.columns = [
      { header: 'Nom',           key: 'nom',    width: 42 },
      { header: 'Catégorie',     key: 'cat',    width: 22 },
      { header: 'Pertinence',    key: 'pert',   width: 13 },
      { header: 'Retenu',        key: 'ret',    width: 11 },
      { header: 'Objectifs visés', key: 'ovs',  width: 62 },
    ]
    analyse.sourcesRisque.forEach((sr: {
      nom: string; categorie: string | null; pertinence: number; retenu: boolean; objectifsVises: unknown
    }) => wsSR.addRow({
      nom:  S(sr.nom),
      cat:  S(sr.categorie ?? ''),
      pert: sr.pertinence,
      ret:  sr.retenu ? 'Oui' : 'Non',
      ovs:  S((sr.objectifsVises as { nom: string }[] || []).map(o => o.nom).join(', ')),
    }))
    styleHeaderRow(wsSR)

    // ── Feuille 3 : Scénarios stratégiques ────────────────────────────
    const wsSS = wb.addWorksheet('Scénarios stratégiques')
    wsSS.columns = [
      { header: 'Nom',            key: 'nom',   width: 42 },
      { header: 'Vraisemblance',  key: 'vrai',  width: 15 },
      { header: 'Gravité',        key: 'grav',  width: 11 },
      { header: 'Niveau risque',  key: 'niv',   width: 14 },
      { header: 'Retenu',         key: 'ret',   width: 11 },
      { header: 'Description',    key: 'desc',  width: 62 },
    ]
    analyse.scenariosStrategiques.forEach((ss: {
      nom: string; vraisemblance: number; gravite: number; niveauRisque: number;
      retenu: boolean; description: string | null
    }) => wsSS.addRow({
      nom: S(ss.nom), vrai: ss.vraisemblance, grav: ss.gravite,
      niv: ss.niveauRisque, ret: ss.retenu ? 'Oui' : 'Non', desc: S(ss.description ?? ''),
    }))
    styleHeaderRow(wsSS)

    // ── Feuille 4 : Scénarios opérationnels ──────────────────────────
    const wsSO = wb.addWorksheet('Scénarios opérationnels')
    wsSO.columns = [
      { header: 'Nom',           key: 'nom',  width: 42 },
      { header: 'Vraisemblance', key: 'vrai', width: 15 },
      { header: 'Gravité',       key: 'grav', width: 11 },
      { header: 'Description',   key: 'desc', width: 62 },
    ]
    analyse.scenariosOperationnels.forEach((so: {
      nom: string; vraisemblance: number; gravite: number; description: string | null
    }) => wsSO.addRow({
      nom: S(so.nom), vrai: so.vraisemblance, grav: so.gravite, desc: S(so.description ?? ''),
    }))
    styleHeaderRow(wsSO)

    // ── Feuille 5 : Risques ───────────────────────────────────────────
    const wsR = wb.addWorksheet('Risques')
    wsR.columns = [
      { header: 'Nom',            key: 'nom',    width: 42 },
      { header: 'Gravité',        key: 'grav',   width: 11 },
      { header: 'Vraisemblance',  key: 'vrai',   width: 15 },
      { header: 'Niveau risque',  key: 'niv',    width: 14 },
      { header: 'Stratégie',      key: 'strat',  width: 15 },
      { header: 'Niveau résiduel',key: 'resid',  width: 16 },
      { header: 'Description',    key: 'desc',   width: 62 },
    ]
    analyse.risques.forEach((r: {
      nom: string; gravite: number; vraisemblance: number; niveauRisque: number;
      strategie: string | null; niveauResiduel: number | null; description: string | null
    }) => wsR.addRow({
      nom: S(r.nom), grav: r.gravite, vrai: r.vraisemblance, niv: r.niveauRisque,
      strat: S(r.strategie ?? ''), resid: r.niveauResiduel ?? '', desc: S(r.description ?? ''),
    }))
    styleHeaderRow(wsR)

    // ── Feuille 6 : Mesures de sécurité ──────────────────────────────
    const wsM = wb.addWorksheet('Mesures de sécurité')
    wsM.columns = [
      { header: 'Nom',         key: 'nom',   width: 42 },
      { header: 'Type',        key: 'type',  width: 18 },
      { header: 'Priorité',    key: 'prio',  width: 11 },
      { header: 'Statut',      key: 'stat',  width: 14 },
      { header: 'Responsable', key: 'resp',  width: 22 },
      { header: 'Entité',      key: 'ent',   width: 18 },
      { header: 'Échéance',    key: 'ech',   width: 14 },
      { header: 'Description', key: 'desc',  width: 62 },
    ]
    analyse.mesures.forEach((m: {
      nom: string; type: string | null; priorite: number; statut: string;
      responsable: string | null; entite?: string | null; echeance: Date | null; description: string | null
    }) => wsM.addRow({
      nom: S(m.nom), type: S(m.type ?? ''), prio: `P${m.priorite}`, stat: S(m.statut),
      resp: S(m.responsable ?? ''),
      ent: S(m.entite ?? ''),
      ech: m.echeance ? new Date(m.echeance).toLocaleDateString('fr-FR') : '',
      desc: S(m.description ?? ''),
    }))
    styleHeaderRow(wsM)

    // ── Feuille 7 : Parties prenantes ─────────────────────────────────
    if (analyse.partiesPrenantes.length > 0) {
      const wsPP = wb.addWorksheet('Parties prenantes')
      wsPP.columns = [
        { header: 'Nom',          key: 'nom',  width: 42 },
        { header: 'Type',         key: 'type', width: 18 },
        { header: 'Exposition',   key: 'exp',  width: 13 },
        { header: 'Fiabilité',    key: 'fid',  width: 13 },
        { header: 'Vulnérabilité',key: 'vuln', width: 15 },
      ]
      analyse.partiesPrenantes.forEach((pp: {
        nom: string; type: string; exposition: number; fiabilite: number; vulnerabilite: number
      }) => wsPP.addRow({ nom: S(pp.nom), type: S(pp.type), exp: pp.exposition, fid: pp.fiabilite, vuln: pp.vulnerabilite }))
      styleHeaderRow(wsPP)
    }

    const buf = await wb.xlsx.writeBuffer()
    const safeName = analyse.nom.replace(/[^a-zA-Z0-9\-_]/g, '-').slice(0, 64)
    return new NextResponse(buf as ArrayBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="acra-${safeName}.xlsx"`,
      },
    })
  }

  return NextResponse.json({ error: 'Format non supporté' }, { status: 400 })
}
