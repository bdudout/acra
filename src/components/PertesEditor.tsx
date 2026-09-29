'use client'

// ─── Éditeur de pertes multi-composantes ─────────────────────────────────────
// Lignes de perte (type, montant, devise, statut) et de récupération, avec brut / net
// convertis en devise de référence (lib/pertes). Les types viennent du catalogue de
// l'organisation ; une devise sans taux est signalée, jamais convertie à tort.

import { useTranslation } from '@/lib/i18n/context'
import { totauxPertes, type LignePerte, type LigneRecuperation, STATUTS_LIGNE, TYPES_RECUPERATION } from '@/lib/pertes'

interface TypeItem { code: string; labelKey?: string; label?: string; actif: boolean }
export interface PertesConfig { deviseReference: string; taux: Record<string, number>; typesPerte: TypeItem[] }
export interface PertesValue { pertes: LignePerte[]; recups: LigneRecuperation[] }

const inp = 'px-2 py-1 rounded border border-gray-300 dark:bg-gray-900 dark:border-gray-600 text-sm'

export default function PertesEditor({ pertes, recups, config, onChange, readOnly = false }: {
  pertes: LignePerte[]; recups: LigneRecuperation[]; config: PertesConfig; onChange: (v: PertesValue) => void; readOnly?: boolean
}) {
  const { t, locale } = useTranslation()
  const n = t.incidents
  const tr = (key: string) => key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], t) as string ?? key
  const typeLabel = (x: TypeItem) => x.label ?? (x.labelKey ? tr(x.labelKey) : x.code)
  const types = config.typesPerte.filter(x => x.actif)
  const recupLabels = n.typesRecuperation as Record<string, string>
  const statutLabels = n.statutsLigne as Record<string, string>
  const ref = config.deviseReference
  // Les libellés livrés portent « (€) » : la devise affichée est celle de l'organisation.
  const sansDevise = (l: string) => l.replace(/\s*\((€|EUR)\)\s*$/, '')
  const tot = totauxPertes(pertes, recups, { deviseReference: ref, taux: config.taux })
  const money = (v: number | null) => v == null ? '—' : new Intl.NumberFormat(locale, { style: 'currency', currency: ref, maximumFractionDigits: 2 }).format(v)

  const setP = (i: number, patch: Partial<LignePerte>) => onChange({ pertes: pertes.map((l, k) => k === i ? { ...l, ...patch } : l), recups })
  const setR = (i: number, patch: Partial<LigneRecuperation>) => onChange({ pertes, recups: recups.map((l, k) => k === i ? { ...l, ...patch } : l) })

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">{n.pertesTitle}</p>
        <ul className="mt-1 space-y-1.5">
          {pertes.map((l, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2">
              <select aria-label={`${n.ligneType} — perte ${i + 1}`} value={l.type} disabled={readOnly} onChange={e => setP(i, { type: e.target.value })} className={inp}>
                {types.map(x => <option key={x.code} value={x.code}>{typeLabel(x)}</option>)}
                {!types.some(x => x.code === l.type) && <option value={l.type}>{l.type}</option>}
              </select>
              <input type="number" min="0" step="0.01" aria-label={`${n.ligneMontant} — perte ${i + 1}`} value={l.montant} disabled={readOnly}
                onChange={e => setP(i, { montant: Number(e.target.value) })} className={`${inp} w-28`} />
              <input aria-label={`${n.ligneDevise} — perte ${i + 1}`} value={l.devise} maxLength={3} disabled={readOnly}
                onChange={e => setP(i, { devise: e.target.value.toUpperCase() })} className={`${inp} w-16`} />
              <select aria-label={`${n.ligneStatut} — perte ${i + 1}`} value={l.statut} disabled={readOnly} onChange={e => setP(i, { statut: e.target.value as LignePerte['statut'] })} className={inp}>
                {STATUTS_LIGNE.map(s => <option key={s} value={s}>{statutLabels[s]}</option>)}
              </select>
              {!readOnly && <button type="button" aria-label={`${n.retirer} — perte ${i + 1}`} onClick={() => onChange({ pertes: pertes.filter((_, k) => k !== i), recups })} className="text-xs text-red-500 hover:underline">{n.retirer}</button>}
            </li>
          ))}
        </ul>
        {!readOnly && <button type="button" onClick={() => onChange({ pertes: [...pertes, { type: types[0]?.code ?? 'AUTRE', montant: 0, devise: ref, statut: 'ESTIME' }], recups })} className="mt-1.5 text-xs text-ebios-700 hover:underline">{n.addPerte}</button>}
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">{n.recupTitle}</p>
        <ul className="mt-1 space-y-1.5">
          {recups.map((l, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2">
              <select aria-label={`${n.ligneType} — récupération ${i + 1}`} value={l.type} disabled={readOnly} onChange={e => setR(i, { type: e.target.value })} className={inp}>
                {TYPES_RECUPERATION.map(x => <option key={x} value={x}>{recupLabels[x]}</option>)}
              </select>
              <input type="number" min="0" step="0.01" aria-label={`${n.ligneMontant} — récupération ${i + 1}`} value={l.montant} disabled={readOnly}
                onChange={e => setR(i, { montant: Number(e.target.value) })} className={`${inp} w-28`} />
              <input aria-label={`${n.ligneDevise} — récupération ${i + 1}`} value={l.devise} maxLength={3} disabled={readOnly}
                onChange={e => setR(i, { devise: e.target.value.toUpperCase() })} className={`${inp} w-16`} />
              {!readOnly && <button type="button" aria-label={`${n.retirer} — récupération ${i + 1}`} onClick={() => onChange({ pertes, recups: recups.filter((_, k) => k !== i) })} className="text-xs text-red-500 hover:underline">{n.retirer}</button>}
            </li>
          ))}
        </ul>
        {!readOnly && <button type="button" onClick={() => onChange({ pertes, recups: [...recups, { type: 'ASSURANCE', montant: 0, devise: ref }] })} className="mt-1.5 text-xs text-ebios-700 hover:underline">{n.addRecup}</button>}
      </div>

      {(pertes.length > 0 || recups.length > 0) && (
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-600 dark:text-gray-300">
          <div><dt className="inline">{sansDevise(n.montantBrut)} : </dt><dd className="inline font-medium tabular-nums">{money(tot.brut)}</dd></div>
          <div><dt className="inline">{sansDevise(n.recuperations)} : </dt><dd className="inline font-medium tabular-nums">{money(tot.recuperations)}</dd></div>
          <div><dt className="inline">{sansDevise(n.perteNetteTotale)} : </dt><dd data-testid="pertes-net" className="inline font-semibold tabular-nums">{money(tot.net)}</dd></div>
        </dl>
      )}
      {tot.devisesSansTaux.length > 0 && <p role="status" className="text-xs text-amber-700 dark:text-amber-300">{n.devisesSansTaux.replace('{devises}', tot.devisesSansTaux.join(', '))}</p>}
    </div>
  )
}
