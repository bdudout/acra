// ─── Échanges fichiers avec l'agent de mise à jour hôte (#185) ──────────────
// `.acra-update/` (monté dans le conteneur) : agent.json + status.json écrits par
// l'agent hôte ; `inbox/` est le SEUL endroit où l'application écrit (une demande).
// L'absence de `inbox/` signifie que l'agent n'est pas installé.

import fs from 'node:fs/promises'
import path from 'node:path'
import { agentAlive, parseUpdateStatus, type UpdateRequest, type UpdateStatus } from '@/lib/update-request'
import { parseSnapshotIndex, type SnapshotEntry, type SnapshotIndex } from '@/lib/snapshot'
import { parseRunJournal, type RunJournal } from '@/lib/update-run'

/** Dossier d'échange (surchageable pour les tests / déploiements particuliers). */
export function updateDir(): string {
  return process.env.ACRA_UPDATE_DIR || path.join(process.cwd(), '.acra-update')
}

async function readJson(file: string): Promise<unknown> {
  try {
    const st = await fs.stat(file)
    if (!st.isFile() || st.size > 64 * 1024) return null
    return JSON.parse(await fs.readFile(file, 'utf8'))
  } catch { return null }
}

/** Index des points de restauration publié par scripts/acra-snapshot.sh (assaini). */
export async function readSnapshotIndex(): Promise<SnapshotIndex> {
  return parseSnapshotIndex(await readJson(path.join(updateDir(), 'snapshots.json')))
}

export interface RunSummary { kind: RunJournal['kind']; state: RunJournal['state']; from: string; to: string; snapshotId: string | null; startedAt: string; updatedAt: string; steps: RunJournal['steps'] }

/** Disponibilité de l'agent (pulsation récente + boîte de dépôt présente), dernier statut, points de restauration et exécution en cours. */
export async function readUpdateAgent(now = new Date()): Promise<{ agentAvailable: boolean; status: UpdateStatus | null; snapshots: SnapshotEntry[]; run: RunSummary | null }> {
  const dir = updateDir()
  const [heartbeat, status, inbox, index, journal] = await Promise.all([
    readJson(path.join(dir, 'agent.json')),
    readJson(path.join(dir, 'status.json')),
    fs.stat(path.join(dir, 'inbox')).then(s => s.isDirectory()).catch(() => false),
    readSnapshotIndex(),
    readJson(path.join(dir, 'run', 'current.json')),
  ])
  const j = parseRunJournal(journal)
  const run: RunSummary | null = j ? { kind: j.kind, state: j.state, from: j.from.version, to: j.to.version, snapshotId: j.snapshotId, startedAt: j.startedAt, updatedAt: j.updatedAt, steps: j.steps } : null
  return { agentAvailable: inbox && agentAlive(heartbeat, now), status: parseUpdateStatus(status), snapshots: index.snapshots, run }
}

/** Dépose la demande (écriture atomique : fichier temporaire puis renommage). */
export async function writeUpdateRequest(req: UpdateRequest): Promise<void> {
  const inbox = path.join(updateDir(), 'inbox')
  const tmp = path.join(inbox, `.request-${req.id}.tmp`)
  await fs.writeFile(tmp, JSON.stringify(req), { mode: 0o644, flag: 'wx' })
  await fs.rename(tmp, path.join(inbox, 'request.json'))
}
