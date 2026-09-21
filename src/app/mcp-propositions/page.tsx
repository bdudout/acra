'use client'

// Page « File de validation des propositions MCP ». Accessible aux utilisateurs
// authentifiés ; l'autorisation fine (édition de l'analyse cible) est vérifiée
// côté serveur à chaque acceptation/rejet.

import Navbar from '@/components/Navbar'
import McpProposalsQueue from '@/components/McpProposalsQueue'
import { useTranslation } from '@/lib/i18n/context'

export default function McpPropositionsPage() {
  const { t } = useTranslation()
  const m = t.mcpProposals
  return (
    <>
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-1">{m.pageTitle}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{m.pageSubtitle}</p>
        <McpProposalsQueue />
      </main>
    </>
  )
}
