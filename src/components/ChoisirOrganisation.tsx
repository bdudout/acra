// ─── Page d'information : choisir une organisation (super-administrateur) ─────
// Rendu côté serveur par les pages qui portent sur une organisation précise, quand le super-administrateur est en vue
// « toutes les organisations » (cf. lib/choisir-organisation).
import { Building2 } from 'lucide-react'
import Navbar from '@/components/Navbar'
import { getServerT } from '@/lib/i18n'

export default async function ChoisirOrganisation() {
  const t = await getServerT()
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <main id="main-content" className="max-w-3xl mx-auto px-4 py-12">
        <div role="status" className="card p-6 flex items-start gap-3">
          <Building2 size={22} className="text-ebios-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t.orgContexte.choisirTitre}</h1>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{t.orgContexte.choisirMessage}</p>
          </div>
        </div>
      </main>
    </div>
  )
}
