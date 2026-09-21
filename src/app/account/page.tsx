import { redirect } from 'next/navigation'

/** L'espace compte est réuni dans le profil pour éviter une page dupliquée. */
export default function AccountPage() {
  redirect('/profile')
}
