import { AlertTriangle, CheckCircle2, Clock3, FileWarning } from 'lucide-react'
import type { DerogationDashboard as Dashboard } from '@/lib/derogation-dashboard'

export default function DerogationsDashboard({ dashboard, labels }: { dashboard: Dashboard; labels: { title: string; active: string; expiringSoon: string; expired: string; pending: string } }) {
  const items = [
    { value: dashboard.active, label: labels.active, Icon: CheckCircle2, style: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
    { value: dashboard.expiringSoon, label: labels.expiringSoon, Icon: Clock3, style: 'text-amber-700 bg-amber-50 border-amber-200' },
    { value: dashboard.expired, label: labels.expired, Icon: AlertTriangle, style: 'text-red-700 bg-red-50 border-red-200' },
    { value: dashboard.pending, label: labels.pending, Icon: FileWarning, style: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
  ]
  return <section aria-label={labels.title} className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
    <h2 className="mb-3 text-base font-semibold text-slate-900 dark:text-white">{labels.title}</h2>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{items.map(({ value, label, Icon, style }) => <div key={label} className={`rounded-xl border p-3 ${style}`}><Icon size={18} aria-hidden="true" /><div className="mt-2 text-2xl font-bold">{value}</div><div className="text-sm font-medium">{label}</div></div>)}</div>
  </section>
}
