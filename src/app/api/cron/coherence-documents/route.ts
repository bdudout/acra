import { NextResponse } from 'next/server'
import { cronRoute } from '@/lib/cron-route.server'
import { controlerCoherenceDocuments } from '@/lib/documents-coherence.server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/cron/coherence-documents — vérifie que chaque document référencé par la base existe dans le stockage (HEAD S3 en
 * profil ha, fichier local sinon). Quotidien (scripts/scheduler.sh) et lancé par chaque sauvegarde en profil ha. 200 si tout est
 * présent ; 409 `documents_manquants` (ou 502 `stockage_injoignable`) sinon : exécution en échec, alerte au journal d'audit,
 * relançable depuis l'administration. Réponse sans clé ni nom de fichier. `Authorization: Bearer <CRON_SECRET>`.
 */
export const POST = cronRoute('coherence-documents', async () => {
  const b = await controlerCoherenceDocuments()
  if (b.manquants > 0) return NextResponse.json({ ok: false, error: 'documents_manquants', ...b }, { status: 409 })
  if (b.erreurs > 0) return NextResponse.json({ ok: false, error: 'stockage_injoignable', ...b }, { status: 502 })
  return NextResponse.json({ ok: true, ...b })
})
