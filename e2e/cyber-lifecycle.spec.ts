import { test, expect } from '@playwright/test'
import { login } from './helpers'
import { E2E } from './fixtures'

test('cycle cyber : sauvegarder 5 ateliers, approuver, accepter, geler et exporter', async ({ page }) => {
  await login(page, E2E.users.porteur.email)
  const created = await page.request.post('/api/analyses', { data: { nom: 'E2E cycle cyber', organisation: 'E2E', secteur: 'AUTRE' } })
  expect(created.status()).toBe(201)
  const { analyse } = await created.json()
  const url = `/api/analyses/${analyse.id}`
  const save = async (num: number, data: unknown) => {
    const response = await page.request.put(`${url}/workshop/${num}`, { data })
    expect(response.status(), await response.text()).toBe(200)
  }
  await save(1, { perimetre: 'Facturation fictive', valeursMetier: [{ id: 'vm', nom: 'Facturation' }], socleSecurite: [{ ref: '5.1', statut: 'partiel', commentaire: 'Politique à compléter' }] })
  await save(2, { sourcesRisque: [{ nom: 'Cybercriminel', categorie: 'CYBERCRIMINEL', objectifVise: 'Extorsion', retenu: true }] })
  await save(3, { partiesPrenantes: [{ nom: 'Prestataire fictif', type: 'PRESTATAIRE' }], scenariosStrategiques: [{ nom: 'Accès prestataire compromis', gravite: 4, vraisemblance: 3 }] })
  const a3 = (await (await page.request.get(url)).json()).analyse
  await save(4, { scenariosOperationnels: [{ nom: 'Compromission VPN', scenarioStrategiqueId: a3.scenariosStrategiques[0].id, gravite: 4, vraisemblance: 3 }] })
  const a4 = (await (await page.request.get(url)).json()).analyse
  await save(5, { risques: [{ nom: 'Interruption facturation', scenarioOpId: a4.scenariosOperationnels[0].id, gravite: 4, vraisemblance: 3, niveauRisque: 12, graviteResiduelle: 4, vraisemblanceResiduelle: 1, niveauResiduel: 4, strategie: 'REDUIRE' }], mesures: [{ nom: 'MFA prestataire', type: 'TECHNIQUE', statut: 'A_FAIRE', responsable: 'RSSI' }] })
  const persisted = (await (await page.request.get(url)).json()).analyse
  expect(persisted.cadrage.perimetre).toBe('Facturation fictive')
  expect(persisted.risques).toHaveLength(1)
  expect(persisted.mesures).toHaveLength(1)
  for (let n = 1; n <= 5; n++) {
    await page.goto(`/analyses/${analyse.id}/atelier/${n}`)
    await expect(page).toHaveURL(new RegExp(`/atelier/${n}$`))
    await expect(page.locator('body')).not.toContainText('Application error')
  }
  expect((await page.request.post(`${url}/approbation`, { data: { action: 'SOUMETTRE' } })).status()).toBe(200)
  expect((await page.request.post(`${url}/approbation`, { data: { action: 'APPROUVER' } })).status()).toBe(403)
  await login(page, E2E.users.rssi.email)
  expect((await page.request.post(`${url}/approbation`, { data: { action: 'APPROUVER' } })).status()).toBe(200)
  await login(page, E2E.users.metier.email)
  expect((await page.request.post(`${url}/accept-residual-risks`, { data: { action: 'ACCEPTER', commentaire: 'Décision fictive de recette' } })).status()).toBe(200)
  const pdf = await page.request.get(`/api/export/${analyse.id}?format=pdf`)
  expect(pdf.status()).toBe(200)
  expect((await pdf.body()).subarray(0, 4).toString()).toBe('%PDF')
  await login(page, E2E.users.porteur.email)
  expect((await page.request.patch(url, { data: { nom: 'Modification interdite' } })).status()).toBe(403)
  expect((await page.request.put(`${url}/workshop/1`, { data: { perimetre: 'Modification interdite' } })).status()).toBe(403)
  for (const suffix of ['conformite', 'conformite/soa', 'conformite/suivis', 'conformite/traitements', 'plans-actions', 'action-items/promotable']) {
    expect((await page.request.get(`/api/organizations/foreign/${suffix}?referentiel=ISO27001`)).status()).toBe(403)
    expect((await page.request.get(`/api/organizations/global/${suffix}?referentiel=ISO27001`)).status()).toBe(403)
  }
})
