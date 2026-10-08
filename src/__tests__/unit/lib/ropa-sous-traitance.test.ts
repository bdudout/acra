// Registre des activités de traitement du sous-traitant (RGPD art. 30 §2) : une ligne par responsable du traitement
// client ; complétude des mentions du §2.
import { describe, it, expect } from 'vitest'
import { sanitizeSousTraitance, champsManquantsArt30_2 } from '@/lib/ropa-sous-traitance'

describe('sanitizeSousTraitance', () => {
  it('borne et nettoie ; listes depuis tableaux', () => {
    const s = sanitizeSousTraitance({ clientNom: '  Hôpital X  ', clientContact: 'dpo@hopital.fr', clientDpo: '', categoriesTraitements: ['Hébergement', '', 'Sauvegarde'], transfertHorsUE: 'true', paysTransfert: 'Inde', mesuresSecurite: ['Chiffrement'], organizationId: 'autre' })
    expect(s).toEqual({ clientNom: 'Hôpital X', clientContact: 'dpo@hopital.fr', clientDpo: '', categoriesTraitements: ['Hébergement', 'Sauvegarde'], transfertHorsUE: true, paysTransfert: 'Inde', garantiesTransfert: '', mesuresSecurite: ['Chiffrement'] })
  })
})

describe('champsManquantsArt30_2', () => {
  const complet = sanitizeSousTraitance({ clientNom: 'Hôpital X', clientContact: 'dpo@hopital.fr', categoriesTraitements: ['Hébergement'], mesuresSecurite: ['Chiffrement'] })
  it('complet : rien ne manque', () => {
    expect(champsManquantsArt30_2(complet)).toEqual([])
  })
  it('responsable client (nom, coordonnées), catégories de traitements, mesures de sécurité ; garanties si transfert hors UE', () => {
    expect(champsManquantsArt30_2(sanitizeSousTraitance({ transfertHorsUE: true }))).toEqual(['clientNom', 'clientContact', 'categoriesTraitements', 'mesuresSecurite', 'garantiesTransfert'])
  })
})
