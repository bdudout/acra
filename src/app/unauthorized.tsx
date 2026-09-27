'use client'

import ErrorScreen from '@/components/ErrorScreen'

export default function Unauthorized() { return <ErrorScreen kind="unauthorized" onRetry={() => window.location.assign('/login')} /> }
