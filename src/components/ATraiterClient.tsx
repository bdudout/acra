'use client'

// ─── Page « À traiter » ──────────────────────────────────────────────────────
// Ce qui attend la personne connectée, toutes organisations confondues : mêmes règles et mêmes destinataires que l'e-mail
// quotidien de relances, sans attendre le mail. Regroupé par urgence ; chaque élément mène à l'objet concerné — dans son
// organisation : un élément d'une autre organisation que l'active y bascule d'abord (POST /api/org/active).
import { useEffect, useState, type MouseEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/lib/i18n/context'

interface Element { categorie: string; intitule: string; type: 'EN_RETARD' | 'EN_ATTENTE' | 'ECHEANCE_PROCHE' | 'PERIODIQUE'; echeance: string | null; organisationId: string; organisation: string; lien: string; libelleCategorie: string; etat: string }
const ORDRE = ['EN_RETARD', 'EN_ATTENTE', 'ECHEANCE_PROCHE', 'PERIODIQUE'] as const
const TON: Record<string, string> = { EN_RETARD: 'border-red-300 dark:border-red-700', EN_ATTENTE: 'border-amber-300 dark:border-amber-700', ECHEANCE_PROCHE: 'border-amber-200 dark:border-amber-800', PERIODIQUE: 'border-gray-200 dark:border-gray-700' }

export default function ATraiterClient() {
  const { t } = useTranslation()
  const a = t.aTraiter
  const router = useRouter()
  const [items, setItems] = useState<Element[] | null>(null)
  const [activeOrgId, setActiveOrgId] = useState<string | null | undefined>(undefined)
  const [erreur, setErreur] = useState(false)
  useEffect(() => {
    fetch('/api/a-traiter').then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: { items?: Element[]; activeOrgId?: string | null }) => { setItems(j.items ?? []); setActiveOrgId(j.activeOrgId) }).catch(() => setErreur(true))
  }, [])
  async function ouvrir(e: MouseEvent<HTMLAnchorElement>, i: Element) {
    if (activeOrgId === undefined || !i.organisationId || i.organisationId === activeOrgId) return
    e.preventDefault()
    await fetch('/api/org/active', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orgId: i.organisationId }) }).catch(() => null)
    router.push(i.lien); router.refresh()
  }
  if (erreur) return <p role="alert" className="text-sm text-red-600">{a.erreur}</p>
  if (!items) return <p className="text-sm text-gray-500">{a.chargement}</p>
  if (!items.length) return <p className="text-sm text-gray-600 dark:text-gray-300">{a.vide}</p>
  const plusieursOrgs = new Set(items.map(i => i.organisationId)).size > 1
  return (
    <div className="space-y-5">
      {ORDRE.map(type => {
        const groupe = items.filter(i => i.type === type)
        if (!groupe.length) return null
        const titre = `${a.groupes[type]} (${groupe.length})`
        return (
          <section key={type} aria-label={titre} className={`rounded-lg border-l-4 ${TON[type]} bg-white p-3 dark:bg-gray-900`}>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{titre}</h2>
            <ul className="mt-2 divide-y divide-gray-100 dark:divide-gray-800">
              {groupe.map((i, k) => (
                <li key={`${i.categorie}-${k}`} className="flex flex-wrap items-baseline gap-x-2 py-1.5 text-sm">
                  <span className="text-xs text-gray-500 dark:text-gray-400">{i.libelleCategorie}</span>
                  <Link href={i.lien} onClick={e => void ouvrir(e, i)} className="font-medium text-ebios-700 hover:underline dark:text-ebios-300">{i.intitule}</Link>
                  <span className="text-xs text-gray-600 dark:text-gray-300">— {i.etat}</span>
                  {plusieursOrgs && i.organisation && <span className="text-xs text-gray-400">· {i.organisation}</span>}
                </li>
              ))}
            </ul>
          </section>
        )
      })}
      <p className="text-[11px] text-gray-400">{a.note}</p>
    </div>
  )
}
