'use client'

import Link from 'next/link'
import { useTranslation } from '@/lib/i18n/context'

export default function Footer() {
  const { t } = useTranslation()
  return (
    <footer className="border-t border-gray-200 bg-white mt-auto">
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between flex-wrap gap-3 text-xs text-gray-500">
        <span>© {new Date().getFullYear()} ACRA — Augmented Cyber Risk Analysis</span>
        <div className="flex gap-4">
          <Link href="/legal/privacy" className="hover:text-gray-600 transition-colors">
            {t.legal.mentions.footerPrivacy}
          </Link>
          <Link href="/legal/mentions" className="hover:text-gray-600 transition-colors">
            {t.legal.privacy.footerMentions}
          </Link>
        </div>
      </div>
    </footer>
  )
}
