'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { useTranslation } from '@/lib/i18n/context'
import { useEbiosData } from '@/lib/i18n/use-ebios-data'
import { sousSecteurIdsFor } from '@/lib/sous-secteurs'

export default function NewAnalysePage() {
  const router = useRouter()
  const { t } = useTranslation()
  const { SECTEURS_ACTIVITE, SOUS_SECTEURS } = useEbiosData()
  const [form, setForm] = useState({ nom: '', description: '', organisation: '', secteur: '', sousSecteur: '' })
  // Sous-secteurs proposés pour le secteur choisi (taxonomie, issue #25).
  const sousSecteurOptions = SOUS_SECTEURS.filter(s => sousSecteurIdsFor(form.secteur).includes(s.id))
  const [socleId, setSocleId] = useState('')
  const [socles, setSocles] = useState<{ id: string; nom: string; organisation?: string }[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/analyses/socles')
      .then(r => r.json())
      .then(d => setSocles(d.socles ?? []))
      .catch(() => {})
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nom.trim()) { setError(t.newAnalysis.nameRequired); return }
    setLoading(true)
    setError('')

    const res = await fetch('/api/analyses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, ...(socleId ? { socleId } : {}) }),
    })

    const data = await res.json()
    if (!res.ok) { setError(data.error || t.error); setLoading(false); return }

    router.push(`/analyses/${data.analyse.id}/atelier/1`)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">{t.newAnalysis.title}</h1>
          <p className="text-gray-500 mt-1">{t.newAnalysis.subtitle}</p>
        </div>

        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-8">
          <h3 className="font-semibold text-indigo-900 mb-1">💡 {t.newAnalysis.howTitle}</h3>
          <p className="text-sm text-indigo-800">{t.newAnalysis.howDesc}</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="card p-6 space-y-5">
          <div>
            <label className="label">{t.newAnalysis.name} <span className="text-red-500">*</span></label>
            <input type="text" required value={form.nom}
              onChange={e => setForm({ ...form, nom: e.target.value })}
              className="input" placeholder={t.newAnalysis.namePh} />
            <p className="text-xs text-gray-500 mt-1">{t.newAnalysis.nameHint}</p>
          </div>

          <div>
            <label className="label">{t.newAnalysis.org}</label>
            <input type="text" value={form.organisation}
              onChange={e => setForm({ ...form, organisation: e.target.value })}
              className="input" placeholder={t.newAnalysis.orgPh} />
          </div>

          <div>
            <label className="label">{t.newAnalysis.sector}</label>
            <select value={form.secteur}
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
                🏭 {t.newAnalysis.otNote}
              </div>
            )}
          </div>

          <div>
            <label className="label">{t.newAnalysis.description}</label>
            <textarea value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              className="input resize-none" rows={3}
              placeholder={t.newAnalysis.descPh} />
          </div>

          {/* Héritage depuis un socle */}
          {socles.length > 0 && (
            <div>
              <label className="label">🏛️ Hériter d'une analyse socle <span className="text-gray-400 font-normal">(optionnel)</span></label>
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
                  ✅ Les éléments du socle sélectionné seront copiés dans cette analyse. Vous pourrez les modifier librement.
                </div>
              )}
            </div>
          )}

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
    </div>
  )
}
