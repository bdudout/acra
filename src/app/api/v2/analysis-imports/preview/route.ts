import { NextRequest, NextResponse } from 'next/server'
import { authenticateApiRequest } from '@/lib/api-auth.server'
import { parseAnalysisImportRequest, summarizeAnalysisImport } from '@/lib/analysis-import'
import { getEffectiveScaleConfig } from '@/lib/configuration-server'
import { estMultipart, traiterFichierV2 } from '@/lib/import-v2-fichier.server'
import { hasAtelierContent, summarizeAtelierContent } from '@/lib/analysis-import-ateliers'

/**
 * Valide et prévisualise un lot API v2 sans créer de donnée métier : paquet canonique (JSON), ou fichier + profil en
 * multipart/form-data avec les états des lignes de B-IMP-53 (B-IMP-72, lib/import-v2-fichier.server).
 */
export async function POST(req: NextRequest) {
  const auth = await authenticateApiRequest(req, 'write')
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  if (estMultipart(req)) return traiterFichierV2(req, auth, 'APERCU')
  try {
    const parsed = parseAnalysisImportRequest(await req.json())
    // Format v3 : volumes et références orphelines des ateliers 1 à 4 (aucune écriture).
    return NextResponse.json({ valid: true, ...summarizeAnalysisImport(parsed, await getEffectiveScaleConfig(auth.organizationId)), ...(hasAtelierContent(parsed) ? { ateliers: summarizeAtelierContent(parsed, parsed.risks.flatMap(r => (r.externalId ? [r.externalId] : []))) } : {}) })
  }
  catch (error) { return NextResponse.json({ valid: false, error: 'Import invalide', details: error instanceof Error ? error.message : undefined }, { status: 400 }) }
}
