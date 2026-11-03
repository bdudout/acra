// ─── Contrôle « tous les documents référencés par la base existent dans le stockage » ───────────────────
// Tâche planifiée « coherence-documents » (POST /api/cron/coherence-documents) : quotidienne (scripts/scheduler.sh), lancée aussi
// par chaque sauvegarde en profil ha (scripts/acra-snapshot.sh), relançable depuis Administration → Tâches planifiées.
// Un écart rend la tâche en ÉCHEC (journal d'exécution + TACHE_PLANIFIEE_ECHEC au journal d'audit → SIEM). Aucune clé ni nom
// de fichier n'est renvoyé : seulement des comptes, l'empreinte de l'inventaire et, au plus, 20 identifiants de lignes concernées.
import { prisma } from '@/lib/prisma'
import { getDocumentStorage } from '@/lib/document-storage'
import { clesReferencees, empreinteCles, verifierPresence } from '@/lib/documents-coherence'

export interface BilanCoherence {
  stockage: string; references: number; empreinte: string; presents: number; manquants: number; erreurs: number
  echantillon: { type: 'document' | 'campagne' | 'mission'; id: string }[]
}

export async function controlerCoherenceDocuments(): Promise<BilanCoherence> {
  const [documents, campagnes, missions] = await Promise.all([
    prisma.document.findMany({ select: { id: true, storageKey: true } }),
    prisma.campagneControle.findMany({ select: { id: true, rapports: true } }),
    prisma.auditMission.findMany({ select: { id: true, rapports: true } }),
  ])
  const cles = clesReferencees({ documents, rapports: [...campagnes.map(c => c.rapports), ...missions.map(m => m.rapports)] })
  const storage = await getDocumentStorage()
  if (!storage.head) throw new Error('stockage_sans_controle')
  const head = storage.head.bind(storage)
  const r = await verifierPresence(cles, k => head(k))
  // Lignes qui référencent une clé manquante (identifiants seulement), pour l'enquête.
  const manquantes = new Set(r.manquants)
  const echantillon: BilanCoherence['echantillon'] = []
  const ajoute = (type: BilanCoherence['echantillon'][number]['type'], id: string) => { if (echantillon.length < 20 && !echantillon.some(e => e.type === type && e.id === id)) echantillon.push({ type, id }) }
  for (const d of documents) if (manquantes.has(d.storageKey)) ajoute('document', d.id)
  const dans = (rapports: unknown) => Array.isArray(rapports) && rapports.some(x => x && typeof x === 'object' && manquantes.has(String((x as { storageKey?: unknown }).storageKey)))
  for (const c of campagnes) if (dans(c.rapports)) ajoute('campagne', c.id)
  for (const m of missions) if (dans(m.rapports)) ajoute('mission', m.id)
  const { nombre, sha256 } = empreinteCles(cles)
  return { stockage: (process.env.DOCUMENT_STORAGE ?? 'local').toLowerCase() === 's3' ? 's3' : 'local', references: nombre, empreinte: sha256, presents: r.presents, manquants: r.manquants.length, erreurs: r.erreurs, echantillon }
}
