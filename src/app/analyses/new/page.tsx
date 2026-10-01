'use client'

import { CheckCircle2, ChevronDown, ChevronRight, Factory, Landmark, Lightbulb } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { useTranslation } from '@/lib/i18n/context'
import { useEbiosData } from '@/lib/i18n/use-ebios-data'
import { sousSecteurIdsFor } from '@/lib/sous-secteurs'
import { parseTagsInput } from '@/lib/analyse-tags'
import { MENTIONS_PROTECTION } from '@/lib/mention-protection'
import AutocompleteInput from '@/components/AutocompleteInput'
import ProjetSourcePicker, { type ProjetOption } from '@/components/ProjetSourcePicker'
import { prefillFromProjet } from '@/lib/projet360'
import QualificationQuestions from '@/components/QualificationQuestions'
import { QualificationRisksDialog, type QualificationProposal } from '@/components/QualificationRisksFlow'
import { EMPTY_QUALIFICATION_CONFIG, type QualificationAnswers, type QualificationConfig } from '@/lib/qualification'
import { qualificationRiskChannel } from '@/lib/qualification-risks'

// Clé i18n du nom de chaque méthode (t.methodes.*).
const METHODE_I18N: Record<string, string> = {
  EBIOS_RM: 'ebiosRm', ISO_27005: 'iso27005', NIST_800_30: 'nist80030', ISO_31000: 'iso31000', PROJET_360: 'projet360',
}

export default function NewAnalysePage() {
  const router = useRouter()
  const { t } = useTranslation()
  const { SECTEURS_ACTIVITE, SOUS_SECTEURS } = useEbiosData()
  const [form, setForm] = useState({ nom: '', description: '', organisation: '', secteur: '', sousSecteur: '', mentionProtection: 'NON_PROTEGEE', tags: '' })
  // Sous-secteurs proposés pour le secteur choisi (taxonomie, issue #25).
  const sousSecteurOptions = SOUS_SECTEURS.filter(s => sousSecteurIdsFor(form.secteur).includes(s.id))
  const [socleId, setSocleId] = useState('')
  // Projet 360 dont part l'analyse (module Projets 360 actif) : ?projet=<id> ou sélection.
  const [projets, setProjets] = useState<ProjetOption[]>([])
  const [projetId, setProjetId] = useState('')
  function choisirProjet(p: ProjetOption | null) {
    setProjetId(p?.id ?? '')
    if (p) setForm(f => ({ ...f, ...prefillFromProjet(p, { nom: f.nom, description: f.description }) }))
  }
  const [socles, setSocles] = useState<{ id: string; nom: string; organisation?: string }[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  // Méthode d'analyse (config avancée) : proposée seulement si l'instance en active
  // plus d'une. Défaut EBIOS RM. cf. lib/methodes.ts.
  const [methode, setMethode] = useState('EBIOS_RM')
  const [methodes, setMethodes] = useState<string[]>(['EBIOS_RM'])
  const [advOpen, setAdvOpen] = useState(false)
  // Visible dès l'ouverture du formulaire : la qualification reste facultative,
  // mais ne doit jamais passer inaperçue au moment du choix de méthode.
  const [qualificationOpen, setQualificationOpen] = useState(true)
  const [qualification, setQualification] = useState<QualificationAnswers>({})
  const [qualificationConfig, setQualificationConfig] = useState<QualificationConfig>(EMPTY_QUALIFICATION_CONFIG)
  const [createdAnalyseId, setCreatedAnalyseId] = useState<string | null>(null)
  const [pendingProposals, setPendingProposals] = useState<QualificationProposal[]>([])

  useEffect(() => {
    fetch('/api/projets')
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        const list: ProjetOption[] = Array.isArray(d?.projets) ? d.projets : []
        setProjets(list)
        const wanted = new URLSearchParams(window.location.search).get('projet')
        const p = list.find(x => x.id === wanted)
        if (p) choisirProjet(p)
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    fetch('/api/methodes')
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!d?.available?.length) return
        setMethodes(d.available)
        // ?methode=… : présélectionne la méthode si elle est disponible (le projet 360 a son propre formulaire : /projets?nouveau=1).
        const wanted = new URLSearchParams(window.location.search).get('methode')
        setMethode(wanted && d.available.includes(wanted) ? wanted : (d.default ?? 'EBIOS_RM'))
      })
      .catch(() => {})
  }, [])

  // Même questionnaire que dans l'analyse : la configuration effective de
  // l'organisation active rend visibles les questions ajoutées par son admin.
  useEffect(() => {
    fetch('/api/admin/organization-config', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (data?.qualificationQuestionnaire) setQualificationConfig(data.qualificationQuestionnaire)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/analyses/socles')
      .then(r => r.json())
      .then(d => setSocles(d.socles ?? []))
      .catch(() => {})
  }, [])

  // Défaut intelligent : pré-remplit « organisation » avec le nom de l'org active
  // (on analyse presque toujours sa propre organisation). N'écrase jamais une
  // saisie déjà commencée ; null pour l'org racine générique.
  useEffect(() => {
    fetch('/api/analyses/default-org', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (d?.name) setForm(f => (f.organisation ? f : { ...f, organisation: d.name }))
      })
      .catch(() => {})
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nom.trim()) { setError(t.newAnalysis.nameRequired); return }
    if (!form.organisation.trim()) { setError(t.newAnalysis.orgRequired); return }
    if (!form.secteur) { setError(t.newAnalysis.sectorRequired); return }
    setLoading(true)
    setError('')

    const res = await fetch('/api/analyses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, tags: parseTagsInput(form.tags), methode, qualification, ...(socleId ? { socleId } : {}), ...(projetId ? { projetSourceId: projetId } : {}) }),
    })

    const data = await res.json()
    if (!res.ok) { setError(data.error || t.error); setLoading(false); return }

    // Risques proposés/imposés par la qualification : traduits et filtrés côté
    // serveur. Méthodes à saisie directe → proposition immédiate ; EBIOS RM → atelier 5.
    if (Object.keys(qualification).length > 0 && qualificationRiskChannel(methode) === 'DIRECT') {
      const d = await fetch(`/api/analyses/${data.analyse.id}/qualification-risks`, { cache: 'no-store' })
        .then(r => (r.ok ? r.json() : null)).catch(() => null)
      const pending = ((d?.proposals ?? []) as QualificationProposal[]).filter(p => !p.alreadyCreated)
      if (pending.length > 0) { setPendingProposals(pending); setCreatedAnalyseId(data.analyse.id); return }
    }
    router.push(`/analyses/${data.analyse.id}/atelier/1`)
  }

  const finishCreation = () => { if (createdAnalyseId) router.push(`/analyses/${createdAnalyseId}/atelier/1`) }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">{t.newAnalysis.title}</h1>
          <p className="text-gray-500 mt-1">{t.newAnalysis.subtitle}</p>
        </div>

        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-8">
          <h3 className="font-semibold text-indigo-900 mb-1"><Lightbulb size={18} className="inline align-[-0.15em] mr-2" aria-hidden="true" /> {t.newAnalysis.howTitle}</h3>
          <p className="text-sm text-indigo-800">{(t.newAnalysis.howDescByMethode as Record<string, string>)?.[methode] ?? t.newAnalysis.howDesc}</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="card p-6 space-y-5">
          <ProjetSourcePicker projets={projets} value={projetId} onChange={choisirProjet} />
          <div>
            <label className="label" htmlFor="analyse-nom">{t.newAnalysis.name} <span className="text-red-500">*</span></label>
            <input id="analyse-nom" type="text" required value={form.nom}
              onChange={e => setForm({ ...form, nom: e.target.value })}
              className="input" placeholder={t.newAnalysis.namePh} />
            <p className="text-xs text-gray-500 mt-1">{t.newAnalysis.nameHint}</p>
          </div>

          <div>
            <label className="label">{t.newAnalysis.org} <span className="text-red-500">*</span></label>
            <AutocompleteInput field="organisation" value={form.organisation}
              onChange={v => setForm({ ...form, organisation: v })}
              className="input" placeholder={t.newAnalysis.orgPh} />
          </div>

          <div>
            <label className="label">{t.newAnalysis.sector} <span className="text-red-500">*</span></label>
            <select value={form.secteur} required
              onChange={e => setForm({ ...form, secteur: e.target.value, sousSecteur: '' })}
              className="input">
              <option value="">{t.newAnalysis.sectorPh}</option>
              {SECTEURS_ACTIVITE.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <p className="text-xs text-gray-500 mt-1">{t.newAnalysis.sectorHint}</p>
            {/* Sous-secteur (optionnel) — affiché seulement si le secteur en propose */}
            {sousSecteurOptions.length > 0 && (
              <div className="mt-3">
                <label className="label">{t.newAnalysis.subSector} <span className="text-gray-400 font-normal">({t.optional})</span></label>
                <select value={form.sousSecteur}
                  onChange={e => setForm({ ...form, sousSecteur: e.target.value })}
                  className="input">
                  <option value="">{t.newAnalysis.subSectorPh}</option>
                  {sousSecteurOptions.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
                <p className="text-xs text-gray-500 mt-1">{t.newAnalysis.subSectorHint}</p>
              </div>
            )}
            {/* Note de périmètre OT/IT pour les secteurs industriels */}
            {/(énergie|energie|industrie|industry|transport|eau|utilities|scada|manufactur|agro|agricol)/i.test(form.secteur) && (
              <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
                <Factory size={15} className="inline align-[-0.15em] mr-1.5" aria-hidden="true" /> {t.newAnalysis.otNote}
              </div>
            )}
          </div>

          <div>
            <label className="label">{t.newAnalysis.tagsLabel}</label>
            <input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })}
              placeholder={t.newAnalysis.tagsPlaceholder} className="input" />
            <p className="text-xs text-gray-500 mt-1">{t.newAnalysis.tagsHint}</p>
          </div>

          <div>
            <label className="label">{t.mentionProtection.label}</label>
            <select value={form.mentionProtection}
              onChange={e => setForm({ ...form, mentionProtection: e.target.value })}
              className="input">
              {MENTIONS_PROTECTION.map(m => (
                <option key={m} value={m}>{t.mentionProtection.levels[m]}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">{t.mentionProtection.help}</p>
          </div>

          <div>
            <label className="label">{t.newAnalysis.description}</label>
            <textarea value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              className="input resize-none" rows={3}
              placeholder={t.newAnalysis.descPh} />
          </div>

          {/* Découvrabilité du socle (issue #107) — quand aucun socle n'existe encore,
              expliquer qu'on peut en créer un pour un groupe multi-établissements. */}
          {socles.length === 0 && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">
              <p className="text-sm font-medium text-indigo-900"><Landmark size={15} className="inline align-[-0.15em] mr-1.5" aria-hidden="true" /> {t.newAnalysis.socleDiscoverTitle}</p>
              <p className="text-xs text-indigo-800 mt-0.5">{t.newAnalysis.socleDiscoverText}</p>
            </div>
          )}

          {/* Héritage depuis un socle */}
          {socles.length > 0 && (
            <div>
              <label className="label"><Landmark size={15} className="inline align-[-0.15em] mr-1.5" aria-hidden="true" /> Hériter d'une analyse socle <span className="text-gray-400 font-normal">(optionnel)</span></label>
              <select
                value={socleId}
                onChange={e => setSocleId(e.target.value)}
                className="input"
              >
                <option value="">— Aucun socle —</option>
                {socles.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.nom}{s.organisation ? ` — ${s.organisation}` : ''}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Les valeurs métier, biens supports et sources de risque du socle seront copiés comme point de départ.
              </p>
              {socleId && (
                <div className="mt-2 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 text-xs text-indigo-800">
                  <CheckCircle2 size={15} className="inline align-[-0.15em] mr-1 text-green-600" aria-hidden="true" /> Les éléments du socle sélectionné seront copiés dans cette analyse. Vous pourrez les modifier librement.
                </div>
              )}
            </div>
          )}

          {/* Options peu fréquentes regroupées à la fin du formulaire. */}
          <div className="border-t border-gray-100 pt-4">
            {methodes.length > 1 ? <>
              <button type="button" onClick={() => setAdvOpen(o => !o)} className="text-sm text-gray-600 hover:text-gray-800 font-medium dark:text-slate-200">
                {advOpen ? '▾' : '▸'} {t.newAnalysis.advanced}
              </button>
              {advOpen && <div className="mt-3"><label className="label">{t.newAnalysis.methodLabel}</label><select value={methode} onChange={e => setMethode(e.target.value)} className="input">{methodes.map(mk => <option key={mk} value={mk}>{(t.methodes as Record<string, string>)[METHODE_I18N[mk] ?? ''] ?? mk}</option>)}</select><p className="text-xs text-gray-500 mt-1">{t.newAnalysis.methodHint}</p></div>}
            </> : <><p className="label mb-1">{t.newAnalysis.methodLabel}</p><p className="text-sm text-gray-600">{(t.methodes as Record<string, string>)[METHODE_I18N[methode] ?? ''] ?? methode}</p><p className="text-xs text-gray-500 mt-1">{t.newAnalysis.methodHint}</p></>}
          </div>

          <div className="rounded-xl border border-ebios-200 bg-ebios-50/60 dark:border-ebios-800 dark:bg-slate-900">
            <button type="button" onClick={() => setQualificationOpen(open => !open)} className="flex w-full items-center justify-between gap-3 p-4 text-left">
              <span><span className="block text-sm font-semibold text-ebios-900 dark:text-ebios-100">{t.qualification.promptOptionalTitle} <span className="font-normal">({t.optional})</span></span><span className="mt-1 block text-xs text-ebios-800 dark:text-slate-300">{t.qualification.promptOptionalText}</span></span>
              {qualificationOpen ? <ChevronDown size={18} aria-hidden="true" /> : <ChevronRight size={18} aria-hidden="true" />}
            </button>
            {qualificationOpen && <div className="border-t border-ebios-200 p-4 dark:border-ebios-800"><QualificationQuestions answers={qualification} onChange={setQualification} config={qualificationConfig} labels={{ questions: t.qualification.questions as Record<string, string>, criticiteOptions: t.qualification.criticiteOptions as Record<string, string>, statutOptions: t.qualification.statutOptions as Record<string, string>, yes: t.qualification.yes, no: t.qualification.no }} /></div>}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => router.back()} className="btn-secondary flex-1">
              {t.newAnalysis.cancelBtn}
            </button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? t.newAnalysis.submitting : t.newAnalysis.submit}
            </button>
          </div>
        </form>
      </div>
      {createdAnalyseId && <QualificationRisksDialog analyseId={createdAnalyseId} risks={pendingProposals} onClose={finishCreation} onDone={finishCreation} />}
    </div>
  )
}
