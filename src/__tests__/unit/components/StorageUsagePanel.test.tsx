// Supervision du stockage : statuts, blocs, projection, nettoyage du cache (aperçu puis exécution), seuils.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import StorageUsagePanel from '@/components/StorageUsagePanel'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})
const fetchMock = vi.fn()
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock) })
const ok = (body: unknown, status = 200) => ({ ok: status < 300, status, json: async () => body })
const GB = 1024 ** 3
const report = (over: Record<string, unknown> = {}) => ({
  measuredAt: '2026-10-05T10:00:00Z', thresholds: { warnPercent: 80, criticalPercent: 90 },
  db: { totalBytes: 2 * GB, status: 'WARN', tables: [{ name: 'AuditLog', totalBytes: GB, live: 600, dead: 400, deadRatio: 0.4, vacuum: true }, { name: 'Risque', totalBytes: GB / 2, live: 900, dead: 10, deadRatio: 0.01, vacuum: false }] },
  documents: { count: 12, totalBytes: GB, backend: 'local', status: 'CRITICAL', volume: { freeBytes: 2 * GB, totalBytes: 100 * GB, percent: 98 }, byOrg: [{ organizationId: 'o1', name: 'Mutuelle Alpha', count: 12, bytes: GB }] },
  backups: { points: 5, totalBytes: 10 * GB, freeBytes: 30 * GB, status: 'OK', oldestAt: '2026-09-01T02:00:00Z', newestAt: '2026-10-05T02:00:00Z', byReason: { scheduled: 4, 'pre-update': 1 } },
  host: { at: 'x', images: { sizeBytes: 12e9, reclaimableBytes: 4e9 }, buildCache: { sizeBytes: 3e9, reclaimableBytes: 3e9 }, volumes: { sizeBytes: 8e9, reclaimableBytes: 0 }, containers: { sizeBytes: 1e6, reclaimableBytes: 0 }, reclaimableBytes: 7e9, status: 'WARN' },
  cleanable: { count: 42, bytes: 9000, rows: [{ id: 'B1', count: 40, bytes: 8000 }, { id: 'B4', count: 2, bytes: 400 }] },
  cleanup: { autoCleanup: true, categories: ['B1', 'B4'], lastCleanupAt: '2026-10-05T03:00:00Z', lastCleanupCounts: { B1: 3 } },
  trend: { series: [], fullDate: new Date(Date.now() + 12 * 86400_000).toISOString() },
  ...over,
})
const load = (r = report()) => fetchMock.mockResolvedValueOnce(ok({ scope: 'instance', report: r }))

describe('StorageUsagePanel', () => {
  it('affiche les cinq blocs avec leur statut, la table à VACUUM et la projection', async () => {
    load(); render(<StorageUsagePanel />)
    await screen.findByText('Base de données')
    expect(screen.getByTestId('block-db').textContent).toContain('Attention')
    expect(screen.getByTestId('block-documents').textContent).toContain('Critique')
    expect(screen.getByTestId('block-backups').textContent).toContain('OK')
    expect(screen.getByTestId('block-host').textContent).toContain('Récupérable')
    expect(screen.getByText('VACUUM utile')).toBeTruthy()
    expect(screen.getByText('Mutuelle Alpha')).toBeTruthy()
    expect(screen.getByTestId('trend').textContent).toMatch(/12 jour/)
    expect(screen.getByTestId('block-cleanable').textContent).toContain('42')
  })
  it('bandeau d’alerte au statut le plus grave', async () => {
    load(); render(<StorageUsagePanel />)
    expect((await screen.findByRole('alert')).textContent).toContain('seuil critique')
  })
  it('sans projection (moins de 7 mesures) : message dédié ; hôte absent : bloc explicatif', async () => {
    load(report({ trend: { series: [], fullDate: null }, host: null })); render(<StorageUsagePanel />)
    await screen.findByText('Base de données')
    expect(screen.getByTestId('trend').textContent).toContain('7 mesures')
    expect(screen.getByTestId('block-host').textContent).toContain('indisponible')
  })
  it('nettoyage : aperçu des catégories (B8 décochée), puis exécution et résultat', async () => {
    load(); render(<StorageUsagePanel />)
    await screen.findByText('Base de données')
    fetchMock.mockResolvedValueOnce(ok({ preview: [{ id: 'B1', count: 40, bytes: 8000 }, { id: 'B8', count: 5, bytes: 20000 }], settings: report().cleanup }))
    fireEvent.click(screen.getByRole('button', { name: 'Nettoyer le cache (sans impact)' }))
    await screen.findByText('Jetons de réinitialisation de mot de passe')
    expect((screen.getByLabelText(/Accusés d’import/) as HTMLInputElement).checked).toBe(false)
    expect((screen.getByLabelText(/Jetons de réinitialisation/) as HTMLInputElement).checked).toBe(true)
    fetchMock.mockResolvedValueOnce(ok({ counts: { B1: 40 } })).mockResolvedValueOnce(ok({ scope: 'instance', report: report() }))
    fireEvent.click(screen.getByRole('button', { name: 'Nettoyer' }))
    await screen.findByText('40 ligne(s) supprimée(s).')
    const post = fetchMock.mock.calls.find(c => c[1]?.method === 'POST')!
    expect(JSON.parse(post[1].body)).toEqual({ categories: ['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7'] })
  })
  it('nettoyage déjà en cours (409) : message traduit', async () => {
    load(); render(<StorageUsagePanel />)
    await screen.findByText('Base de données')
    fetchMock.mockResolvedValueOnce(ok({ preview: [{ id: 'B1', count: 1, bytes: 1 }], settings: report().cleanup })).mockResolvedValueOnce(ok({ error: 'already_running' }, 409))
    fireEvent.click(screen.getByRole('button', { name: 'Nettoyer le cache (sans impact)' }))
    await screen.findByText('Jetons de réinitialisation de mot de passe')
    fireEvent.click(screen.getByRole('button', { name: 'Nettoyer' }))
    await screen.findByText('Un nettoyage est déjà en cours.')
  })
  it('seuils : invalides refusés côté client ; valides envoyés en PUT', async () => {
    load(); render(<StorageUsagePanel />)
    await screen.findByText('Base de données')
    fireEvent.change(screen.getByLabelText('Attention (%)'), { target: { value: '95' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(screen.getByText(/Seuils invalides/)).toBeTruthy()
    expect(fetchMock.mock.calls.some(c => c[1]?.method === 'PUT')).toBe(false)
    fireEvent.change(screen.getByLabelText('Attention (%)'), { target: { value: '70' } })
    fetchMock.mockResolvedValueOnce(ok({ thresholds: { warnPercent: 70, criticalPercent: 90 } })).mockResolvedValueOnce(ok({ scope: 'instance', report: report() }))
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => expect(screen.getByText('Seuils enregistrés.')).toBeTruthy())
    expect(JSON.parse(fetchMock.mock.calls.find(c => c[1]?.method === 'PUT')![1].body)).toEqual({ warnPercent: 70, criticalPercent: 90 })
  })
  it('vue ADMIN d’organisation : documents seulement', async () => {
    fetchMock.mockResolvedValueOnce(ok({ scope: 'organization', documents: { count: 3, totalBytes: GB } }))
    render(<StorageUsagePanel />)
    await screen.findByText('3 document(s)')
    expect(screen.queryByText('Base de données')).toBeNull()
  })
})
