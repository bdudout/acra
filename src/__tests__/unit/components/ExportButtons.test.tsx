import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ExportButtons from '@/components/ExportButtons'

vi.mock('@/lib/i18n/context', async () => {
  const { en } = await import('@/lib/i18n/en')
  return { useTranslation: () => ({ t: en, locale: 'en' }) }
})

describe('ExportButtons', () => {
  it('EBIOS RM par défaut : PDF + CSV, libellés traduits, langue de l’interface', () => {
    render(<ExportButtons analyseId="an1" />)
    expect(screen.getByRole('link', { name: /Export PDF/ }).getAttribute('href')).toBe('/api/export/an1?format=pdf&lang=en')
    expect(screen.getByRole('link', { name: /Export CSV/ })).toBeTruthy()
  })
  it('méthodes directes : PDF + Excel (rapport de la méthode)', () => {
    render(<ExportButtons analyseId="an2" formats={['pdf', 'xlsx']} />)
    expect(screen.getByRole('link', { name: /Export Excel/ }).getAttribute('href')).toBe('/api/export/an2?format=xlsx&lang=en')
    expect(screen.queryByRole('link', { name: /CSV/ })).toBeNull()
  })
})
