// Points d'accès d'un usage TIC : liste, ajout (POST), suppression, erreur traduite, hôte partagé, lecture seule.
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PointsAccesUsage from '@/components/PointsAccesUsage'

vi.mock('@/lib/i18n/context', async () => {
  const { fr } = await import('@/lib/i18n/fr')
  return { useTranslation: () => ({ t: fr, locale: 'fr' }) }
})
const points = [{ id: 'pa1', adresse: 'https://acme.my.salesforce.com', hote: 'acme.my.salesforce.com', type: 'TENANT_SAAS', environnement: 'PRODUCTION', authentification: 'SSO', commentaire: null }]
const fetchMock = vi.fn()
beforeEach(() => { fetchMock.mockReset(); fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) }); vi.stubGlobal('fetch', fetchMock) })

describe('PointsAccesUsage', () => {
  it('liste les points avec type, environnement, authentification et hôte partagé', () => {
    render(<PointsAccesUsage usageId="u1" usageNom="CRM" points={points} canManage={false} hotesPartages={{ 'acme.my.salesforce.com': 2 }} onChange={() => {}} />)
    expect(screen.getByText('Points d’accès (1)')).toBeInTheDocument()
    expect(screen.getByText('https://acme.my.salesforce.com')).toBeInTheDocument()
    expect(screen.getByText('Tenant SaaS')).toBeInTheDocument()
    expect(screen.getByText('Hôte partagé avec 2 autre(s) usage(s)')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ajouter le point d’accès' })).toBeNull()
  })
  it('ajoute un point (POST) puis rafraîchit', async () => {
    const onChange = vi.fn()
    render(<PointsAccesUsage usageId="u1" usageNom="CRM" points={[]} canManage onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Adresse (URL ou hôte)'), { target: { value: 'sftp.partenaire.fr' } })
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'SFTP' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter le point d’accès' }))
    await waitFor(() => expect(onChange).toHaveBeenCalled())
    expect(fetchMock).toHaveBeenCalledWith('/api/tier-registry/usages/u1/points-acces', expect.objectContaining({ method: 'POST' }))
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ adresse: 'sftp.partenaire.fr', type: 'SFTP' })
  })
  it('erreur serveur traduite (identifiants dans l’URL)', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: 'identifiants_interdits' }) })
    render(<PointsAccesUsage usageId="u1" usageNom="CRM" points={[]} canManage onChange={() => {}} />)
    fireEvent.change(screen.getByLabelText('Adresse (URL ou hôte)'), { target: { value: 'https://a:b@x.fr' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter le point d’accès' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Retirez l’identifiant et le mot de passe')
  })
  it('supprime un point', async () => {
    const onChange = vi.fn()
    render(<PointsAccesUsage usageId="u1" usageNom="CRM" points={points} canManage onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer le point d’accès https://acme.my.salesforce.com' }))
    await waitFor(() => expect(onChange).toHaveBeenCalled())
    expect(fetchMock).toHaveBeenCalledWith('/api/tier-registry/usages/u1/points-acces/pa1', expect.objectContaining({ method: 'DELETE' }))
  })
})
