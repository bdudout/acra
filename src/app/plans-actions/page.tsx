import { redirect } from 'next/navigation'

// Consolidé : la vue unifiée des plans d'action est désormais servie à /actions
// (entrée unique de navigation). On conserve /plans-actions en redirection pour
// les liens/marque-pages existants.
export default function PlansActionsRedirect() {
  redirect('/actions')
}
