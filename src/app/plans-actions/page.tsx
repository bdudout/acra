import { redirect } from 'next/navigation'

// Consolidé : la vue unifiée des plans d'action est désormais servie à /actions
// (entrée unique de navigation). On conserve /plans-actions en redirection pour
// les liens/marque-pages existants, paramètres compris (ex. ?statut=EN_RETARD du
// pilotage GRC, lu par la liste paginée de /actions).
export default async function PlansActionsRedirect({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(await searchParams)) {
    for (const x of Array.isArray(v) ? v : v === undefined ? [] : [v]) sp.append(k, x)
  }
  const qs = sp.toString()
  redirect(qs ? `/actions?${qs}` : '/actions')
}
