'use client'

import { useEffect } from 'react'
import ErrorScreen from '@/components/ErrorScreen'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error) }, [error])
  return <ErrorScreen kind="error" onRetry={reset} digest={error.digest} />
}
