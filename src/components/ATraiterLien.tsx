'use client'

// ─── Lien « À traiter » du menu, avec compteur ────────────────────────────────
// Nombre d'éléments qui attendent la personne (moteur des relances en aperçu) ; pastille rouge s'il y a du retard.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ListTodo } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'

export default function ATraiterLien() {
  const { t } = useTranslation()
  const [compte, setCompte] = useState<{ total: number; enRetard: number } | null>(null)
  useEffect(() => {
    fetch('/api/a-traiter?compte=1').then(r => (r.ok ? r.json() : null)).then(j => { if (j && typeof j.total === 'number') setCompte(j) }).catch(() => {})
  }, [])
  const a = t.aTraiter
  const label = compte ? a.lienCompte.replace('{n}', String(compte.total)).replace('{r}', String(compte.enRetard)) : a.titre
  return (
    <Link href="/a-traiter" aria-label={label} title={label} className="relative inline-flex items-center rounded-lg p-2 text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800">
      <ListTodo size={18} aria-hidden="true" />
      {compte && compte.total > 0 && (
        <span aria-hidden="true" className={`absolute -right-0.5 -top-0.5 min-w-[1.1rem] rounded-full px-1 text-center text-[10px] font-semibold leading-[1.1rem] text-white ${compte.enRetard > 0 ? 'bg-red-600' : 'bg-ebios-600'}`}>
          {compte.total > 99 ? '99+' : compte.total}
        </span>
      )}
    </Link>
  )
}
