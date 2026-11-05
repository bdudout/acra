'use client'

// Page « Validations en attente » (double validation, quatre yeux) : demandes que l'utilisateur peut trancher, et les
// siennes (annulables). L'autorisation fine est vérifiée côté serveur à chaque décision (lib/double-validation.server).

import Navbar from '@/components/Navbar'
import DemandesValidation from '@/components/DemandesValidation'
import { useTranslation } from '@/lib/i18n/context'

export default function ValidationsPage() {
  const { t } = useTranslation()
  const v = t.doubleValidation
  return (
    <>
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-1">{v.pageTitre}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{v.pageAide}</p>
        <DemandesValidation />
      </main>
    </>
  )
}
