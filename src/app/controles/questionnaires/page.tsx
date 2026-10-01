import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import Navbar from '@/components/Navbar'
import { peutDefinir2eLigne, type UserRole } from '@/lib/permissions'
import { getAnalyseScope } from '@/lib/org-context.server'
import { getOrgConfig } from '@/lib/org-config.server'
import QuestionnairesManager from '@/components/questionnaires/QuestionnairesManager'

export const dynamic = 'force-dynamic'

// Questionnaires de contrôle : le métier répond (tout rôle sauf lecteur), la 2ᵉ ligne définit, envoie,
// revoit et pose des préconisations. Droits sur le rôle EFFECTIF de l'organisation active.
export default async function QuestionnairesPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/auth/signin')
  const userId = (session.user as { id: string }).id
  const scope = await getAnalyseScope(userId, ((session.user as { role?: string }).role ?? 'ANALYSTE') as UserRole)
  const cfg = await getOrgConfig(scope.activeOrgId)
  if (!cfg.controlePermanentActive || !scope.role) redirect('/dashboard')
  const canDefine = peutDefinir2eLigne(scope.role, { secondeLigneActive: cfg.secondeLigneActive })
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <QuestionnairesManager canDefine={canDefine} conformiteActive={cfg.conformiteActive} />
      </main>
    </div>
  )
}
