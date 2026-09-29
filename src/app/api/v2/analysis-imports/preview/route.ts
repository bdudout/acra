import { NextRequest, NextResponse } from 'next/server'
import { authenticateApiRequest } from '@/lib/api-auth.server'
import { parseAnalysisImportRequest, summarizeAnalysisImport } from '@/lib/analysis-import'
import { hasAtelierContent, summarizeAtelierContent } from '@/lib/analysis-import-ateliers'

/** Valide et prévisualise un lot API v2 sans créer de donnée métier. */
export async function POST(req: NextRequest) {
  const auth = await authenticateApiRequest(req, 'write')
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  try {
    const parsed = parseAnalysisImportRequest(await req.json())
    // Format v3 : volumes et références orphelines des ateliers 1 à 4 (aucune écriture).
    return NextResponse.json({ valid: true, ...summarizeAnalysisImport(parsed), ...(hasAtelierContent(parsed) ? { ateliers: summarizeAtelierContent(parsed) } : {}) })
  }
  catch (error) { return NextResponse.json({ valid: false, error: 'Import invalide', details: error instanceof Error ? error.message : undefined }, { status: 400 }) }
}
