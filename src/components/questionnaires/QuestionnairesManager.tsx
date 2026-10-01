'use client'

// ─── Questionnaires de contrôle : onglets métier (répondre, préconisations) et 2ᵉ ligne ─
import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ClipboardList } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import QuestionnaireRepondre from './QuestionnaireRepondre'
import QuestionnaireModeles from './QuestionnaireModeles'
import QuestionnaireEnvois from './QuestionnaireEnvois'
import PreconisationsPanel from './PreconisationsPanel'

type Onglet = 'aRepondre' | 'preconisations' | 'modeles' | 'envois'

export default function QuestionnairesManager({ canDefine, conformiteActive }: { canDefine: boolean; conformiteActive: boolean }) {
  const { t } = useTranslation()
  const q = t.questionnaires
  const sp = useSearchParams()
  const [onglet, setOnglet] = useState<Onglet>(sp.get('preconisation') ? 'preconisations' : canDefine ? 'envois' : 'aRepondre')
  const onglets: Onglet[] = canDefine ? ['envois', 'preconisations', 'modeles', 'aRepondre'] : ['aRepondre', 'preconisations']
  return <div>
    <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100"><ClipboardList size={22} className="inline align-[-0.15em] mr-2" aria-hidden="true" />{q.title}</h1>
    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-5">{q.subtitle}</p>
    <div role="tablist" aria-label={q.title} className="mb-5 flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-700">
      {onglets.map(o => (
        <button key={o} type="button" role="tab" aria-selected={onglet === o} onClick={() => setOnglet(o)}
          className={`-mb-px border-b-2 px-3 py-2 text-sm ${onglet === o ? 'border-ebios-600 font-semibold text-ebios-700 dark:text-ebios-300' : 'border-transparent text-gray-600 dark:text-gray-300'}`}>{q.tabs[o]}</button>
      ))}
    </div>
    {onglet === 'aRepondre' && <QuestionnaireRepondre />}
    {onglet === 'preconisations' && <PreconisationsPanel conformiteActive={conformiteActive} focusId={sp.get('preconisation')} />}
    {onglet === 'modeles' && canDefine && <QuestionnaireModeles conformiteActive={conformiteActive} />}
    {onglet === 'envois' && canDefine && <QuestionnaireEnvois />}
  </div>
}
