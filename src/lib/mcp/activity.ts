// ─── Activité MCP d'une organisation (PUR) ────────────────────────────────────
// Agrège, pour la page « Activité MCP » : les clés d'API portant le scope `mcp` (état, dernier usage), les appels
// d'outils journalisés (`MCP_TOOL_INVOKED`, détail { keyId, tool, ok }) sur une fenêtre glissante et les propositions
// déposées par chaque clé. Testé : mcp-activity.test.ts.
import { maskApiKey } from '@/lib/api-key'

export interface AppelMcp { keyId: string; tool: string; ok: boolean; createdAt: Date }
export interface CleSource {
  id: string; name: string; prefix: string; scopes: unknown; createdAt: Date
  lastUsedAt: Date | null; expiresAt: Date | null; revokedAt: Date | null
}
export type EtatCle = 'ACTIVE' | 'REVOQUEE' | 'EXPIREE'
type StatutProposition = 'EN_ATTENTE' | 'ACCEPTEE' | 'REJETEE'

export interface CleActivite {
  id: string; nom: string; masque: string; etat: EtatCle
  createdAt: Date; lastUsedAt: Date | null; expiresAt: Date | null; revokedAt: Date | null
  appels: number; erreurs: number; outils: { outil: string; n: number }[]
  propositions: Record<StatutProposition, number>
}

/** Détail d'une ligne du journal → appel, ou null si illisible. */
export function parseAppelMcp(details: string | null, createdAt: Date): AppelMcp | null {
  if (!details) return null
  try {
    const d = JSON.parse(details) as { keyId?: unknown; tool?: unknown; ok?: unknown }
    if (typeof d.keyId !== 'string' || typeof d.tool !== 'string') return null
    return { keyId: d.keyId, tool: d.tool, ok: d.ok !== false, createdAt }
  } catch { return null }
}

const jourIso = (d: Date) => d.toISOString().slice(0, 10)

export function syntheseActiviteMcp(input: {
  cles: CleSource[]; appels: AppelMcp[]; propositions: { apiKeyId: string | null; statut: string }[]; maintenant: Date; jours: number
}) {
  const debut = new Date(input.maintenant.getTime() - input.jours * 86_400_000)
  const appels = input.appels.filter(a => a.createdAt >= debut && a.createdAt <= input.maintenant)
  const cles: CleActivite[] = input.cles
    .filter(c => Array.isArray(c.scopes) && c.scopes.includes('mcp'))
    .map(c => {
      const siens = appels.filter(a => a.keyId === c.id)
      const parOutil = new Map<string, number>()
      for (const a of siens) parOutil.set(a.tool, (parOutil.get(a.tool) ?? 0) + 1)
      const propositions = { EN_ATTENTE: 0, ACCEPTEE: 0, REJETEE: 0 }
      for (const p of input.propositions) if (p.apiKeyId === c.id && p.statut in propositions) propositions[p.statut as StatutProposition]++
      const etat: EtatCle = c.revokedAt ? 'REVOQUEE' : c.expiresAt && c.expiresAt <= input.maintenant ? 'EXPIREE' : 'ACTIVE'
      return {
        id: c.id, nom: c.name, masque: maskApiKey(c.prefix), etat,
        createdAt: c.createdAt, lastUsedAt: c.lastUsedAt, expiresAt: c.expiresAt, revokedAt: c.revokedAt,
        appels: siens.length, erreurs: siens.filter(a => !a.ok).length,
        outils: [...parOutil.entries()].map(([outil, n]) => ({ outil, n })).sort((a, b) => b.n - a.n || a.outil.localeCompare(b.outil)).slice(0, 5),
        propositions,
      }
    })
  const parJour = Array.from({ length: input.jours }, (_, i) => {
    const jour = jourIso(new Date(input.maintenant.getTime() - (input.jours - 1 - i) * 86_400_000))
    return { jour, n: appels.filter(a => jourIso(a.createdAt) === jour).length }
  })
  const somme = (k: StatutProposition) => cles.reduce((s, c) => s + c.propositions[k], 0)
  return {
    totaux: {
      clesActives: cles.filter(c => c.etat === 'ACTIVE').length, clesInactives: cles.filter(c => c.etat !== 'ACTIVE').length,
      appels: cles.reduce((s, c) => s + c.appels, 0), erreurs: cles.reduce((s, c) => s + c.erreurs, 0),
      enAttente: somme('EN_ATTENTE'), acceptees: somme('ACCEPTEE'), rejetees: somme('REJETEE'),
    },
    cles,
    parJour,
  }
}
