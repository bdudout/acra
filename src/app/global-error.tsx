'use client'

import { useEffect } from 'react'
import ErrorScreen from '@/components/ErrorScreen'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error) }, [error])
  return <html lang="fr"><body><ErrorScreen kind="error" onRetry={reset} /></body></html>
}
