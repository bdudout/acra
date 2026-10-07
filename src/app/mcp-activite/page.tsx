'use client'

// Page « Activité MCP » : suivi des assistants connectés, création et révocation des clés MCP. Réservée à
// l'administrateur de l'organisation (vérifié côté serveur par /api/mcp-activity et /api/config/api-keys).

import Navbar from '@/components/Navbar'
import McpActivity from '@/components/McpActivity'
import { useTranslation } from '@/lib/i18n/context'

export default function McpActivitePage() {
  const { t } = useTranslation()
  const a = t.mcpActivite
  return (
    <>
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-1">{a.titre}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{a.sousTitre}</p>
        <McpActivity />
      </main>
    </>
  )
}
