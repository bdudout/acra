'use client'

import { SessionProvider } from 'next-auth/react'
import { I18nProvider } from '@/lib/i18n/context'
import { ThemeProvider } from '@/lib/theme'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <I18nProvider>
        <ThemeProvider>{children}</ThemeProvider>
      </I18nProvider>
    </SessionProvider>
  )
}
