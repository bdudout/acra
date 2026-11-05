'use client'

// ─── Stratégie : identifiants internes (lot S1b) ─────────────────────────────
// Référence principale + liste éditable de couples système / valeur (10 au maximum), pour le lien avec les outils
// comptables et budgétaires. La normalisation et les contrôles font foi côté API (`identifiants_invalides`).
import { useId, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import { IDENTIFIANTS_EXTERNES_MAX, IDENTIFIANT_SYSTEME_MAX, IDENTIFIANT_VALEUR_MAX, REFERENCE_INTERNE_MAX, type IdentifiantExterne } from '@/lib/strategie'

export interface IdentifiantsSaisie { referenceInterne: string; identifiantsExternes: IdentifiantExterne[] }

/** Saisie → corps d'API : référence vide → null ; couples entièrement vides ignorés ; liste vide → null. */
export function identifiantsPourApi(v: IdentifiantsSaisie) {
  const liste = v.identifiantsExternes.map(e => ({ systeme: e.systeme.trim(), valeur: e.valeur.trim() })).filter(e => e.systeme || e.valeur)
  return { referenceInterne: v.referenceInterne.trim() || null, identifiantsExternes: liste.length ? liste : null }
}

export default function IdentifiantsEditor({ value, onChange }: { value: IdentifiantsSaisie; onChange: (v: IdentifiantsSaisie) => void }) {
  const { t } = useTranslation()
  const u = t.strategie.ui
  const id = useId()
  const champ = 'mt-1 block w-full rounded-sm border border-gray-300 bg-white px-2 py-1.5 text-sm dark:bg-gray-800 dark:border-gray-600'
  const liste = value.identifiantsExternes
  const maj = (i: number, p: Partial<IdentifiantExterne>) => onChange({ ...value, identifiantsExternes: liste.map((e, k) => (k === i ? { ...e, ...p } : e)) })

  return (
    <fieldset className="space-y-2">
      <legend className="text-xs font-semibold text-gray-700 dark:text-gray-200">{u.identifiantsInternes}</legend>
      <label className="block text-xs text-gray-600 dark:text-gray-300">{u.referenceInterne}
        <input className={champ} maxLength={REFERENCE_INTERNE_MAX} value={value.referenceInterne}
          onChange={e => onChange({ ...value, referenceInterne: e.target.value })} />
      </label>
      <div>
        <p className="text-xs text-gray-600 dark:text-gray-300">{u.identifiantsExternes}</p>
        <p id={`${id}-aide`} className="text-xs text-gray-400">{u.identifiantsAide}</p>
        <ul className="space-y-1.5 mt-1">
          {liste.map((e, i) => (
            <li key={i} className="flex items-end gap-2">
              <label className="flex-1 text-xs text-gray-600 dark:text-gray-300">
                <span aria-hidden="true">{u.systeme}</span>
                <input className={champ} aria-label={`${u.systeme} ${i + 1}`} maxLength={IDENTIFIANT_SYSTEME_MAX} value={e.systeme} onChange={ev => maj(i, { systeme: ev.target.value })} />
              </label>
              <label className="flex-1 text-xs text-gray-600 dark:text-gray-300">
                <span aria-hidden="true">{u.valeur}</span>
                <input className={champ} aria-label={`${u.valeur} ${i + 1}`} maxLength={IDENTIFIANT_VALEUR_MAX} value={e.valeur} onChange={ev => maj(i, { valeur: ev.target.value })} />
              </label>
              <button type="button" className="btn-secondary text-xs p-1.5" aria-label={u.retirerIdentifiant.replace('{n}', String(i + 1))}
                onClick={() => onChange({ ...value, identifiantsExternes: liste.filter((_, k) => k !== i) })}><X size={14} aria-hidden="true" /></button>
            </li>
          ))}
        </ul>
        <button type="button" className="btn-secondary text-xs mt-1.5 inline-flex items-center gap-1" aria-describedby={`${id}-aide`}
          disabled={liste.length >= IDENTIFIANTS_EXTERNES_MAX}
          onClick={() => onChange({ ...value, identifiantsExternes: [...liste, { systeme: '', valeur: '' }] })}>
          <Plus size={13} aria-hidden="true" />{u.ajouterIdentifiant}
        </button>
      </div>
    </fieldset>
  )
}

/** Nombre d'identifiants renseignés (référence + couples). */
export function nombreIdentifiants(v: { referenceInterne?: string | null; identifiantsExternes?: IdentifiantExterne[] | null }): number {
  return (v.referenceInterne ? 1 : 0) + (v.identifiantsExternes?.length ?? 0)
}

/**
 * Version compacte et repliable (axes, objectifs) : bouton « Identifiants internes (n) » (aria-expanded). Lecture seule sans `onSave` ;
 * sinon édition et enregistrement (modifiable même cadre figé, sans justification : tracé par l'API).
 */
export function IdentifiantsCompacts({ referenceInterne, identifiantsExternes, onSave }: {
  referenceInterne: string | null; identifiantsExternes: IdentifiantExterne[] | null
  onSave?: (v: ReturnType<typeof identifiantsPourApi>) => Promise<boolean>
}) {
  const { t } = useTranslation()
  const u = t.strategie.ui
  const init = (): IdentifiantsSaisie => ({ referenceInterne: referenceInterne ?? '', identifiantsExternes: (identifiantsExternes ?? []).map(e => ({ ...e })) })
  const [saisie, setSaisie] = useState<IdentifiantsSaisie>(init)
  const [ouvert, setOuvert] = useState(false)
  const n = nombreIdentifiants({ referenceInterne, identifiantsExternes })
  if (!onSave && n === 0) return null
  return (
    <div className="text-xs">
      <button type="button" aria-expanded={ouvert} className="text-gray-500 dark:text-gray-400 hover:underline"
        onClick={() => { if (!ouvert) setSaisie(init()); setOuvert(!ouvert) }}>{u.identifiantsInternesN.replace('{n}', String(n))}</button>
      {ouvert && <div className="mt-2 space-y-2">
        {onSave ? (<>
          <IdentifiantsEditor value={saisie} onChange={setSaisie} />
          <button type="button" className="btn-primary text-xs" onClick={() => { void onSave(identifiantsPourApi(saisie)) }}>{u.enregistrer}</button>
        </>) : (
          <p className="text-gray-600 dark:text-gray-300">{[referenceInterne, ...(identifiantsExternes ?? []).map(e => `${e.systeme} ${e.valeur}`)].filter(Boolean).join(', ')}</p>
        )}
      </div>}
    </div>
  )
}
