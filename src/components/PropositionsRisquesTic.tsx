'use client'
// Encart « Risques proposés » (registre TIC, résilience — lot L4) : propositions calculées, rattachées à leur origine
// (contrat TIC, prestataire, fonction critique ou importante). Valider crée le risque au registre ; écarter mémorise la
// décision. Rien n'est affiché sans droit, module inactif ou proposition. i18n ×5 (t.propositionsTic).
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useTranslation } from '@/lib/i18n/context'
import type { PropositionRisqueTic } from '@/lib/propositions-risques-tic'

type Proposition = PropositionRisqueTic & { intitule: string; description: string }
const URL_API = '/api/risk-items/propositions-tic'

export default function PropositionsRisquesTic({ onValidee }: { onValidee?: () => void }) {
  const { t } = useTranslation()
  const l = t.propositionsTic
  const [props, setProps] = useState<Proposition[] | null>(null)
  const [enCours, setEnCours] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; texte: string } | null>(null)
  const encart = useRef<HTMLElement | null>(null)
  const defile = useRef(false)

  // Lien profond « /registre#propositions-tic » : l'encart arrive après coup, on le ramène à l'écran une seule fois.
  useEffect(() => {
    if (defile.current || !props || !encart.current) return
    if (typeof window !== 'undefined' && window.location.hash === '#propositions-tic') {
      defile.current = true
      encart.current.scrollIntoView?.({ block: 'start' })
    }
  }, [props])

  useEffect(() => {
    let annule = false
    fetch(URL_API).then(r => (r.ok ? r.json() : null)).catch(() => null)
      .then((j: { propositions?: unknown } | null) => { if (!annule) setProps(Array.isArray(j?.propositions) ? (j.propositions as Proposition[]) : []) })
    return () => { annule = true }
  }, [])

  async function traiter(p: Proposition, action: 'VALIDER' | 'ECARTER') {
    setEnCours(p.cle); setMsg(null)
    const r = await fetch(URL_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cle: p.cle, action }) }).catch(() => null)
    setEnCours(null)
    if (!r?.ok) { setMsg({ ok: false, texte: l.erreur }); return }
    setProps(x => (x ?? []).filter(y => y.cle !== p.cle))
    setMsg({ ok: true, texte: action === 'VALIDER' ? l.valide : l.ecarte })
    if (action === 'VALIDER') onValidee?.()
  }

  if (!props || (props.length === 0 && !msg)) return null
  return (
    <section ref={encart} id="propositions-tic" aria-label={l.titre} className="card mb-5 p-4 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{l.titre}</h2>
        <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-900 dark:bg-indigo-900/40 dark:text-indigo-100">{l.compteur.replace('{n}', String(props.length))}</span>
      </div>
      <p className="text-gray-600 dark:text-gray-300">{l.aide}</p>
      {msg && <p role={msg.ok ? 'status' : 'alert'} className={`mt-2 ${msg.ok ? 'text-green-800 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>{msg.texte}</p>}
      {props.length === 0 && <p className="mt-2 text-gray-600 dark:text-gray-300">{l.aucune}</p>}
      <ul className="mt-3 space-y-2">
        {props.map(p => (
          <li key={p.cle} className="rounded-sm border border-gray-200 p-3 dark:border-gray-700">
            <p className="font-medium text-gray-900 dark:text-gray-100">{p.intitule}</p>
            <p className="text-gray-700 dark:text-gray-200">{p.description}</p>
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
              {(t.registre.familleTic.codes as Record<string, string>)[p.famille] ?? p.famille}
              {' · '}{l.cotation.replace('{g}', String(p.gravite)).replace('{v}', String(p.vraisemblance))}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-300">
              {l.origine.split(/(\{type\}|\{libelle\})/).map((s, i) => s === '{type}' ? <span key={i}>{(l.origines as Record<string, string>)[p.origine.type] ?? p.origine.type}</span>
                : s === '{libelle}' ? <Link key={i} href={p.origine.lien} className="underline">{p.origine.libelle}</Link> : <span key={i}>{s}</span>)}
            </p>
            <div className="mt-2 flex gap-2">
              <button type="button" className="btn-primary text-xs" disabled={enCours === p.cle} aria-label={`${l.valider} — ${p.intitule}`} onClick={() => void traiter(p, 'VALIDER')}>{l.valider}</button>
              <button type="button" className="btn-secondary text-xs" disabled={enCours === p.cle} aria-label={`${l.ecarter} — ${p.intitule}`} onClick={() => void traiter(p, 'ECARTER')}>{l.ecarter}</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
