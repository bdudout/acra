'use client'
// ─── Projet 360, phase Identification : import de risques types ───────────────
// Rappelle le contexte qui oriente les propositions (secteur, sous-secteurs, architecture) et permet de le modifier
// (AnalyseMetaEditor) ; le bouton ouvre le catalogue complet, groupé par origine (calculé côté serveur :
// lib/risque-exemples catalogueRisquesTypes) : cases à cocher, « tout cocher » par groupe, risques déjà présents grisés. L'import crée les
// risques retenus (POST /api/analyses/[id]/risques-types) puis recharge le registre (onImported).

import { useEffect, useState } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import { useEbiosData } from '@/lib/i18n/use-ebios-data'
import { patternLabel } from '@/lib/patterns-archi'
import { GROUPES_RISQUES_TYPES, type RisqueType } from '@/lib/risques-types'
import AnalyseMetaEditor from '@/components/AnalyseMetaEditor'

export interface ContexteProjet {
  nom: string; organisation: string | null; secteur: string | null; sousSecteur: string | null
  sousSecteurs: string[]; patternsArchi: string[]
}

export default function ImportRisquesTypes({ analyseId, contexte, onImported }: {
  analyseId: string; contexte: ContexteProjet; onImported?: () => void
}) {
  const { t, locale } = useTranslation()
  const l = t.projet360.risquesTypes
  const domaines = t.projet360.domaines as Record<string, string>
  const { SOUS_SECTEURS } = useEbiosData()
  const [ouvert, setOuvert] = useState(false)
  const [risques, setRisques] = useState<RisqueType[] | null>(null)
  const [choix, setChoix] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null)
  // Le catalogue dépend du contexte : il est rechargé après une modification (rafraîchissement de la page).
  const cleContexte = JSON.stringify([contexte.secteur, contexte.sousSecteurs, contexte.patternsArchi])

  useEffect(() => {
    if (!ouvert) return
    let actif = true
    setRisques(null)
    fetch(`/api/analyses/${analyseId}/risques-types`, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null)).catch(() => null)
      .then(d => { if (actif) { setRisques(Array.isArray(d?.risques) ? d.risques : []); setChoix(new Set()) } })
    return () => { actif = false }
  }, [ouvert, analyseId, cleContexte])

  const libSousSecteur = new Map((SOUS_SECTEURS as { id: string; label: string }[]).map(s => [s.id, s.label]))
  const basculer = (intitule: string) => setChoix(c => { const n = new Set(c); if (n.has(intitule)) n.delete(intitule); else n.add(intitule); return n })
  const groupeChoisi = (items: RisqueType[]) => items.every(r => choix.has(r.intitule))

  async function importer() {
    setBusy(true); setMessage(null)
    const intitules = (risques ?? []).filter(r => choix.has(r.intitule)).map(r => r.intitule)
    const res = await fetch(`/api/analyses/${analyseId}/risques-types`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ intitules }) }).catch(() => null)
    setBusy(false)
    if (!res?.ok) { setMessage({ ok: false, texte: l.erreur }); return }
    const d = await res.json().catch(() => ({}))
    setMessage({ ok: true, texte: l.importes.replace('{n}', String(d.created ?? 0)) })
    const importes = new Set(intitules)
    setRisques(rs => (rs ?? []).map(r => (importes.has(r.intitule) ? { ...r, present: true } : r)))
    setChoix(new Set())
    onImported?.()
  }

  const valeur = (v: string) => <span className="font-medium text-gray-800 dark:text-gray-100">{v}</span>
  return (
    <section className="card p-5 mb-5" aria-label={l.bouton}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
          <p className="font-semibold uppercase tracking-wide text-gray-400">{l.contexte}</p>
          <p>{l.secteur} : {valeur(contexte.secteur ?? l.nonRenseigne)}</p>
          <p>{l.sousSecteurs} : {valeur(contexte.sousSecteurs.length ? contexte.sousSecteurs.map(id => libSousSecteur.get(id) ?? id).join(', ') : l.nonRenseigne)}</p>
          <p>{l.architecture} : {valeur(contexte.patternsArchi.length ? contexte.patternsArchi.map(c => patternLabel(c, locale)).join(', ') : l.nonRenseigne)}
            <AnalyseMetaEditor analyseId={analyseId} nom={contexte.nom} organisation={contexte.organisation} secteur={contexte.secteur}
              sousSecteur={contexte.sousSecteur} sousSecteurs={contexte.sousSecteurs} patternsArchi={contexte.patternsArchi} canEdit />
          </p>
          <p className="text-[11px] text-gray-400">{l.modifierHint}</p>
        </div>
        <button type="button" aria-expanded={ouvert} onClick={() => setOuvert(o => !o)} className="btn-primary text-sm">{l.bouton}</button>
      </div>

      {ouvert && (
        <div className="mt-4 border-t border-gray-100 pt-4 dark:border-gray-800">
          <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">{l.intro}</p>
          {risques === null ? <p className="text-sm text-gray-400">{l.chargement}</p>
            : risques.length === 0 ? <p className="text-sm italic text-gray-400">{l.aucun}</p> : (
            <div className="space-y-4">
              {GROUPES_RISQUES_TYPES.map(g => {
                const items = risques.filter(r => r.groupe === g)
                if (!items.length) return null
                const libres = items.filter(r => !r.present)
                const tous = libres.length > 0 && groupeChoisi(libres)
                const titre = (l.groupes as Record<string, string>)[g] ?? g
                return (
                  <div key={g} role="group" aria-label={titre}>
                    <div className="mb-1.5 flex items-center gap-3">
                      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{titre} <span className="font-normal text-gray-400">({items.length})</span></h3>
                      {libres.length > 0 && (
                        <button type="button" className="text-xs text-ebios-700 hover:underline"
                          onClick={() => setChoix(c => { const n = new Set(c); for (const r of libres) { if (tous) n.delete(r.intitule); else n.add(r.intitule) } return n })}>
                          {tous ? l.toutDecocher : l.toutCocher}
                        </button>
                      )}
                    </div>
                    <ul className="grid gap-1 sm:grid-cols-2">
                      {items.map(r => (
                        <li key={r.intitule}>
                          <label className={`flex items-start gap-2 text-sm ${r.present ? 'text-gray-400' : 'text-gray-700 dark:text-gray-200'}`} title={r.description}>
                            <input type="checkbox" className="mt-0.5" disabled={r.present || busy} checked={r.present || choix.has(r.intitule)} onChange={() => basculer(r.intitule)} />
                            <span>
                              {r.intitule}
                              <span className="ml-1.5 text-[11px] tabular-nums text-gray-400">G{r.gravite}·V{r.vraisemblance}</span>
                              {r.domaine && <span className="ml-1.5 text-[11px] text-ebios-600">{domaines[r.domaine] ?? r.domaine}</span>}
                              {r.present && <span className="ml-1.5 text-[11px] italic">{l.present}</span>}
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
              <div className="flex items-center gap-3">
                <button type="button" disabled={busy || choix.size === 0} onClick={importer} className="btn-primary text-sm disabled:opacity-50">
                  {l.importer.replace('{n}', String(choix.size))}
                </button>
              </div>
            </div>
          )}
          {message && <p role={message.ok ? 'status' : 'alert'} className={`mt-2 text-xs ${message.ok ? 'text-green-700' : 'text-red-600'}`}>{message.texte}</p>}
        </div>
      )}
    </section>
  )
}
