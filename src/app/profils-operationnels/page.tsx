import { redirect } from 'next/navigation'

// Ancienne adresse du module (v1.0.3) : les profils opérationnels sont devenus la
// vue « Maturité » des référentiels de conformité.
export default function OperationalProfilesRedirect() {
  redirect('/maturite')
}
