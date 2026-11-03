'use client'
// Cartographie des dépendances des fonctions critiques ou importantes (DORA) : délais, dépendances TIC, écarts,
// concentration. Lecture seule ; chaque écart renvoie à l'écran où le corriger. i18n ×5 (t.dependances).
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslation } from '@/lib/i18n/context'
import type { analyserDependances } from '@/lib/dependances-critiques'

type Donnees = ReturnType<typeof analyserDependances> & { peutModifier?: boolean; scenariosDetail?: Record<string, { description: string | null; mesures: string | null; dateEvaluation: string | null }> }
const TON: Record<string, string> = { ELEVEE: 'bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-100', MOYENNE: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100', INFO: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200' }

export default function DependancesCritiques() {
  const { t } = useTranslation()
  const l = t.dependances
  const [d, setD] = useState<Donnees | null>(null)
  const [erreur, setErreur] = useState(false)
  const [tick, setTick] = useState(0)
  const [saisie, setSaisie] = useState<Record<string, { intitule: string; heures: string; mesures: string }>>({})
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => {
    let annule = false
    fetch('/api/resilience/dependances').then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(j => { if (!annule) setD(j) }).catch(() => { if (!annule) setErreur(true) })
    return () => { annule = true }
  }, [tick])

  async function ajouterScenario(processusId: string) {
    const f = saisie[processusId]
    const h = Number(f?.heures)
    setMsg(null)
    const r = await fetch('/api/resilience/scenarios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ processusId, intitule: f?.intitule ?? '', dureeInterruptionMinutes: f?.heures?.trim() && Number.isFinite(h) && h >= 0 ? Math.round(h * 60) : '', mesures: f?.mesures ?? '' }) }).catch(() => null)
    if (r?.ok) { setSaisie(x => ({ ...x, [processusId]: { intitule: '', heures: '', mesures: '' } })); setTick(n => n + 1) }
    else setMsg(l.scenarioErreur)
  }
  async function supprimerScenario(id: string) {
    const r = await fetch(`/api/resilience/scenarios/${id}`, { method: 'DELETE' }).catch(() => null)
    if (r?.ok) setTick(n => n + 1); else setMsg(l.scenarioErreur)
  }
  const duree = (m: number | null) => (m == null ? '—' : m >= 1440 && m % 1440 === 0 ? `${m / 1440} ${l.jours}` : m >= 60 ? `${Math.round((m / 60) * 10) / 10} h` : `${m} min`)

  if (erreur) return null
  if (!d) return <p className="text-sm text-gray-500">…</p>
  return (
    <section aria-label={l.titre} className="card mt-6 p-5 text-sm">
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{l.titre}</h2>
      <p className="text-gray-600 dark:text-gray-300">{l.aide}</p>
      <p data-testid="synthese-dependances" className="mt-2 text-gray-800 dark:text-gray-100">
        {l.synthese.replace('{n}', String(d.synthese.fonctions)).replace('{e}', String(d.synthese.avecEcarts)).replace('{h}', String(d.synthese.ecartsEleves))}
      </p>
      {msg && <p role="alert" className="mt-2 text-red-700 dark:text-red-300">{msg}</p>}
      {d.fonctions.length > 0 && <p className="mt-1"><Link href="/registre#propositions-tic" className="underline">{t.propositionsTic.voirProposes}</Link></p>}
      {d.fonctions.length === 0 && <p className="mt-2 text-gray-600 dark:text-gray-300">{l.aucune} <Link href="/processus" className="underline">{l.versProcessus}</Link></p>}

      {(d.concentration.tiers.length > 0 || d.concentration.hotes.length > 0) && (
        <div className="mt-3 rounded-sm border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
          <p className="font-medium text-amber-900 dark:text-amber-100">{l.concentration}</p>
          <ul className="mt-1 list-disc pl-5 text-amber-900 dark:text-amber-100">
            {d.concentration.tiers.map(c => <li key={c.tiersId}>{l.concentrationTiers.replace('{tiers}', c.tiersNom).replace('{fonctions}', c.fonctions.join(', '))}</li>)}
            {d.concentration.hotes.map(c => <li key={c.hote}>{l.concentrationHote.replace('{hote}', c.hote).replace('{fonctions}', c.fonctions.join(', '))}</li>)}
          </ul>
        </div>
      )}

      <ul className="mt-4 space-y-3">
        {d.fonctions.map(f => (
          <li key={f.id} className="rounded-sm border border-gray-200 p-3 dark:border-gray-700">
            <p className="font-medium text-gray-900 dark:text-gray-100">{f.nom} <span className="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-normal dark:bg-gray-800">{(l.niveaux as Record<string, string>)[f.criticiteDora] ?? f.criticiteDora}</span></p>
            <p className="text-xs text-gray-600 dark:text-gray-300">
              {l.delais.replace('{rto}', duree(f.rtoMinutes)).replace('{rpo}', duree(f.rpoMinutes)).replace('{tol}', duree(f.toleranceImpactMinutes))}
              {' · '}{l.compteurs.replace('{c}', String(f.nbControles)).replace('{r}', String(f.nbRisques)).replace('{i}', String(f.nbIncidents12m))}
            </p>
            {f.usages.length > 0 && (
              <ul aria-label={`${l.dependancesTic} — ${f.nom}`} className="mt-1 space-y-0.5 text-xs text-gray-700 dark:text-gray-200">
                {f.usages.map(u => (
                  <li key={u.id}>
                    <span className="font-medium">{u.tiersNom}</span> — {u.offre} ({u.useCase})
                    {u.perimetrePci === true && <span className="ml-1 rounded-full bg-purple-100 px-1.5 text-purple-900 dark:bg-purple-900/40 dark:text-purple-100">PCI</span>}
                    {u.hotes.length > 0 && <span className="ml-1 text-gray-500">{u.hotes.join(', ')}</span>}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">{f.dernierTest ? l.dernierTest.replace('{date}', f.dernierTest.date).replace('{duree}', duree(f.dernierTest.dureeRepriseMinutes)) : l.aucunTest}</p>
            <div className="mt-1 text-xs">
              <p className="font-medium text-gray-700 dark:text-gray-200">{l.scenarios}</p>
              {f.scenarios.length === 0 && <p className="text-gray-500">{l.aucunScenario}</p>}
              <ul aria-label={`${l.scenarios} — ${f.nom}`} className="space-y-0.5">
                {f.scenarios.map(sc => {
                  const hors = f.toleranceImpactMinutes != null && sc.dureeInterruptionMinutes > f.toleranceImpactMinutes
                  const det = d.scenariosDetail?.[sc.id]
                  return (
                    <li key={sc.id} className="text-gray-700 dark:text-gray-200">
                      {sc.intitule} — {l.interruption.replace('{duree}', duree(sc.dureeInterruptionMinutes))}
                      <span className={`ml-1 rounded-full px-1.5 ${hors ? TON.ELEVEE : 'bg-green-100 text-green-900 dark:bg-green-900/40 dark:text-green-100'}`}>{hors ? l.horsTolerance : l.dansTolerance}</span>
                      {det?.mesures && <span className="block text-gray-500">{l.mesures} : {det.mesures}</span>}
                      {d.peutModifier && <button type="button" className="ml-2 underline" aria-label={l.supprimerScenario.replace('{nom}', sc.intitule)} onClick={() => void supprimerScenario(sc.id)}>✕</button>}
                    </li>
                  )
                })}
              </ul>
              {d.peutModifier && (
                <form className="mt-1 grid gap-1 sm:grid-cols-[2fr_1fr_2fr_auto] sm:items-end" onSubmit={e => { e.preventDefault(); void ajouterScenario(f.id) }}>
                  <label>{l.scenarioIntitule}<input aria-label={`${l.scenarioIntitule} — ${f.nom}`} className="input mt-0.5 block w-full text-xs" maxLength={300} value={saisie[f.id]?.intitule ?? ''} onChange={e => setSaisie(x => ({ ...x, [f.id]: { ...(x[f.id] ?? { intitule: '', heures: '', mesures: '' }), intitule: e.target.value } }))} /></label>
                  <label>{l.scenarioDuree}<input type="number" min={0} step={0.5} aria-label={`${l.scenarioDuree} — ${f.nom}`} className="input mt-0.5 block w-full text-xs" value={saisie[f.id]?.heures ?? ''} onChange={e => setSaisie(x => ({ ...x, [f.id]: { ...(x[f.id] ?? { intitule: '', heures: '', mesures: '' }), heures: e.target.value } }))} /></label>
                  <label>{l.mesures}<input aria-label={`${l.mesures} — ${f.nom}`} className="input mt-0.5 block w-full text-xs" maxLength={4000} value={saisie[f.id]?.mesures ?? ''} onChange={e => setSaisie(x => ({ ...x, [f.id]: { ...(x[f.id] ?? { intitule: '', heures: '', mesures: '' }), mesures: e.target.value } }))} /></label>
                  <button type="submit" className="btn-secondary text-xs" disabled={!(saisie[f.id]?.intitule ?? '').trim() || !(saisie[f.id]?.heures ?? '').trim()}>{l.ajouterScenario}</button>
                </form>
              )}
            </div>
            {f.ecarts.length > 0 && (
              <ul aria-label={`${l.ecarts} — ${f.nom}`} className="mt-2 flex flex-wrap gap-1">
                {f.ecarts.map((e, i) => {
                  const u = e.usageId ? f.usages.find(x => x.id === e.usageId) : null
                  return <li key={i} className={`rounded-full px-2 py-0.5 text-xs ${TON[e.gravite]}`}>{(l.codes as Record<string, string>)[e.code] ?? e.code}{u ? ` — ${u.tiersNom}` : ''}</li>
                })}
              </ul>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-gray-500"><Link href="/processus" className="underline">{l.versProcessus}</Link> · <Link href="/tiers/entites" className="underline">{l.versTiers}</Link></p>
    </section>
  )
}
