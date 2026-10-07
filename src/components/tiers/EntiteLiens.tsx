'use client'
// ─── Entité de tiers : liens avec les services tiers et les contrats ──────────
// Petit graphe (lib/services-tiers grapheEntite) : services tiers à gauche, entité au centre, contrats TIC à droite ;
// sous le graphe, rattacher / détacher un service tiers et associer / détacher un contrat (ADMIN ou 2ᵉ ligne).

import { useTranslation } from '@/lib/i18n/context'
import { grapheEntite, type ServiceTiers } from '@/lib/services-tiers'

const COULEUR = { ENTITE: '#4f46e5', SERVICE: '#0891b2', CONTRAT: '#d97706' } as const
const coupe = (s: string, n = 24) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

export default function EntiteLiens({ tier, services, contrats, contratsLibres, canManage, busy, onRattacher, onContrat }: {
  tier: { id: string; nom: string }
  services: readonly ServiceTiers[]
  contrats: readonly { id: string; reference: string }[]
  contratsLibres: readonly { id: string; reference: string; prestataireNom: string }[]
  canManage: boolean; busy: boolean
  onRattacher: (partieIds: string[], tierId: string | null) => void
  onContrat: (arrangementId: string, tierId: string | null) => void
}) {
  const { t } = useTranslation()
  const c = t.tierIdentity
  const lies = services.filter(s => s.tierIds.includes(tier.id))
  const libres = services.filter(s => s.aRattacher.length > 0)
  const g = grapheEntite(tier, lies, contrats)
  const parId = new Map(g.noeuds.map(n => [n.id, n]))
  const titre = `${c.grapheTitre} — ${tier.nom}`

  return (
    <div className="mb-3 space-y-3 rounded-sm border border-gray-200 p-3 dark:border-gray-700">
      <figure>
        <svg role="img" aria-label={titre} viewBox={`0 0 ${g.largeur} ${g.hauteur}`} className="w-full max-w-2xl" style={{ maxHeight: 320 }}>
          {g.liens.map(l => { const a = parId.get(l.de)!, b = parId.get(l.vers)!; return <line key={`${l.de}-${l.vers}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="currentColor" className="text-gray-300 dark:text-gray-600" strokeWidth={1.5} /> })}
          {g.noeuds.map(n => (
            <g key={n.id}>
              <title>{n.label}</title>
              {n.type === 'ENTITE'
                ? <rect x={n.x - 80} y={n.y - 16} width={160} height={32} rx={8} fill={COULEUR.ENTITE} />
                : <rect x={n.x - 95} y={n.y - 13} width={190} height={26} rx={13} fill="white" stroke={COULEUR[n.type]} strokeWidth={1.5} className="dark:fill-gray-900" />}
              <text x={n.x} y={n.y + 4} textAnchor="middle" fontSize={n.type === 'ENTITE' ? 13 : 11} fontWeight={n.type === 'ENTITE' ? 600 : 400}
                fill={n.type === 'ENTITE' ? 'white' : COULEUR[n.type]}>{coupe(n.label)}</text>
            </g>
          ))}
        </svg>
        <figcaption className="mt-1 flex gap-4 text-[11px] text-gray-500">
          <span><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: COULEUR.SERVICE }} />{c.legendeServices}</span>
          <span><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: COULEUR.CONTRAT }} />{c.legendeContrats}</span>
        </figcaption>
      </figure>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-200">{c.servicesRattaches}</h4>
          {lies.length === 0 ? <p className="text-xs italic text-gray-500">{c.aucunService}</p> : (
            <ul className="mt-1 space-y-1">
              {lies.map(s => (
                <li key={s.key} className="flex items-center justify-between gap-2 text-sm">
                  <span>{s.nom} <span className="text-xs text-gray-500">({c.occurrences.replace('{n}', String(s.parEntite[tier.id]?.length ?? 0)).replace('{a}', String(s.analyses.length))})</span></span>
                  {canManage && <button type="button" className="text-xs text-red-700 hover:underline" disabled={busy} aria-label={`${c.detacher} — ${s.nom}`} onClick={() => onRattacher(s.parEntite[tier.id] ?? [], null)}>{c.detacher}</button>}
                </li>
              ))}
            </ul>
          )}
          {canManage && libres.length > 0 && (
            <select aria-label={c.rattacherService} className="input mt-2 block w-full text-sm" value="" disabled={busy}
              onChange={e => { const s = libres.find(x => x.key === e.target.value); if (s) onRattacher(s.aRattacher, tier.id) }}>
              <option value="">{c.rattacherService}…</option>
              {libres.map(s => <option key={s.key} value={s.key}>{s.nom}</option>)}
            </select>
          )}
        </div>
        <div>
          <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-200">{c.contratsAssocies}</h4>
          {contrats.length === 0 ? <p className="text-xs italic text-gray-500">{c.aucunContrat}</p> : (
            <ul className="mt-1 space-y-1">
              {contrats.map(ct => (
                <li key={ct.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-medium">{ct.reference}</span>
                  {canManage && <button type="button" className="text-xs text-red-700 hover:underline" disabled={busy} aria-label={`${c.detacher} — ${ct.reference}`} onClick={() => onContrat(ct.id, null)}>{c.detacher}</button>}
                </li>
              ))}
            </ul>
          )}
          {canManage && contratsLibres.length > 0 && (
            <select aria-label={c.associerContrat} className="input mt-2 block w-full text-sm" value="" disabled={busy}
              onChange={e => { if (e.target.value) onContrat(e.target.value, tier.id) }}>
              <option value="">{c.associerContrat}…</option>
              {contratsLibres.map(ct => <option key={ct.id} value={ct.id}>{ct.reference} — {ct.prestataireNom}</option>)}
            </select>
          )}
        </div>
      </div>
    </div>
  )
}
