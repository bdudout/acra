'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { HardDrive } from 'lucide-react'
import Navbar from '@/components/Navbar'
import AdminNav from '@/components/AdminNav'
import StorageUsagePanel from '@/components/StorageUsagePanel'
import BackupManagementPanel from '@/components/BackupManagementPanel'
import { useTranslation } from '@/lib/i18n/context'
import { isAdminRole, type UserRole } from '@/lib/permissions'

export default function AdminStoragePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { t } = useTranslation()
  const role = (session?.user as { role?: UserRole } | undefined)?.role
  const authorized = isAdminRole(role ?? 'ANALYSTE')
  const isSuperAdmin = role === 'SUPER_ADMIN'

  useEffect(() => {
    if (status === 'authenticated' && !authorized) router.replace('/dashboard')
  }, [status, authorized, router])

  if (status !== 'authenticated' || !authorized) {
    return <div className="min-h-screen bg-gray-50 dark:bg-gray-900"><Navbar /></div>
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <main id="main-content" className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <AdminNav active="storage" />
        <header>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            <HardDrive size={22} className="inline align-[-0.15em] mr-2" aria-hidden="true" /> {t.admin.navStorage}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t.admin.storage.intro}</p>
        </header>
        <section className="card p-6">
          <StorageUsagePanel />
        </section>
        {isSuperAdmin && (
          <section className="card p-6">
            <BackupManagementPanel />
          </section>
        )}
      </main>
    </div>
  )
}
