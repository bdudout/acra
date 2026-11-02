// Import des points d'accès et de la qualification des usages TIC (CSV / XLSX) : colonnes reconnues (FR/EN), valeurs
// interprétées sans hasard, rattachement à un usage EXISTANT (jamais de création), doublons ignorés, erreurs par ligne.
import { describe, expect, it } from 'vitest'
import { mapUsageImportColumns, planUsageImport, type UsageCible } from '@/lib/tier-usage-import'

describe('mapUsageImportColumns', () => {
  it('reconnaît les en-têtes usuels (FR / EN)', () => {
    expect(mapUsageImportColumns(['Prestataire', 'Service', 'Cas d’usage', 'URL', 'Type', 'Env', 'Auth', 'PCI', 'Avec SI', 'Exposition', 'Interconnexion'])).toEqual({
      tiers: 'Prestataire', offre: 'Service', usage: 'Cas d’usage', adresse: 'URL', type: 'Type', environnement: 'Env', authentification: 'Auth',
      pci: 'PCI', si: 'Avec SI', exposition: 'Exposition', interconnexion: 'Interconnexion',
    })
    expect(mapUsageImportColumns(['Vendor', 'Offer', 'Use case', 'Host'])).toMatchObject({ tiers: 'Vendor', offre: 'Offer', usage: 'Use case', adresse: 'Host' })
  })
})

const usages: UsageCible[] = [
  { id: 'u1', tiers: 'Acme SAS', aliases: ['ACME'], offre: 'CRM', usage: 'Relation client', adresses: ['https://acme.crm.example'] },
  { id: 'u2', tiers: 'PSP Exemple', aliases: [], offre: 'Passerelle', usage: 'Paiement carte', adresses: [] },
  { id: 'u3', tiers: 'PSP Exemple', aliases: [], offre: 'Passerelle', usage: 'Paiement mobile', adresses: [] },
]
const ligne = (o: Record<string, string>, line = 2) => ({ line, tiers: '', offre: '', usage: '', adresse: '', type: '', environnement: '', authentification: '', pci: '', si: '', exposition: '', interconnexion: '', ...o })

describe('planUsageImport', () => {
  it('rattache par tiers (nom ou alias, forme juridique ignorée) + offre + usage ; qualification et point d’accès', () => {
    const p = planUsageImport([ligne({ tiers: 'acme', offre: 'crm', usage: 'relation client', adresse: 'https://acme.crm.example/api', type: 'API', environnement: 'prod', pci: 'non', si: 'oui', exposition: 'Internet', interconnexion: 'LS' })], usages)
    expect(p.lines[0]).toMatchObject({ statut: 'OK', usageId: 'u1' })
    expect(p.lignesValides[0]).toEqual({ usageId: 'u1', qualification: { perimetrePci: false, avecSi: true, exposeInternet: true, interconnexion: 'LIGNE_SPECIALISEE' },
      point: { adresse: 'https://acme.crm.example/api', hote: 'acme.crm.example', type: 'API', environnement: 'PRODUCTION', authentification: null, commentaire: null } })
  })
  it('offre à usage unique : le cas d’usage peut être omis ; sinon ambigu', () => {
    expect(planUsageImport([ligne({ tiers: 'Acme', offre: 'CRM', adresse: 'crm2.example' })], usages).lines[0]).toMatchObject({ statut: 'OK', usageId: 'u1' })
    expect(planUsageImport([ligne({ tiers: 'PSP Exemple', offre: 'Passerelle', adresse: 'pay.example' })], usages).lines[0]).toEqual({ line: 2, statut: 'ERREUR', erreur: 'usage_ambigu' })
  })
  it('usage introuvable : erreur, jamais de création', () => {
    expect(planUsageImport([ligne({ tiers: 'Inconnu', offre: 'X', adresse: 'x.example' })], usages).lines[0]).toEqual({ line: 2, statut: 'ERREUR', erreur: 'usage_introuvable' })
  })
  it('adresse déjà connue ou répétée dans le fichier : ignorée (qualification tout de même appliquée)', () => {
    const p = planUsageImport([
      ligne({ tiers: 'Acme', offre: 'CRM', adresse: 'https://acme.crm.example', pci: 'oui' }, 2),
      ligne({ tiers: 'PSP Exemple', offre: 'Passerelle', usage: 'Paiement carte', adresse: 'pay.example', type: 'WEB' }, 3),
      ligne({ tiers: 'PSP Exemple', offre: 'Passerelle', usage: 'Paiement carte', adresse: 'PAY.example', type: 'WEB' }, 4),
    ], usages)
    expect(p.lines.map(l => l.statut)).toEqual(['OK', 'OK', 'IGNOREE'])
    expect(p.lignesValides[0]).toEqual({ usageId: 'u1', qualification: { perimetrePci: true }, point: null })
    expect(p.counts).toEqual({ ok: 2, ignorees: 1, erreurs: 0, points: 1, qualifications: 1 })
  })
  it('valeurs non reconnues : erreur explicite par ligne, jamais d’interprétation hasardeuse', () => {
    expect(planUsageImport([ligne({ tiers: 'Acme', offre: 'CRM', pci: 'peut-être' })], usages).lines[0]).toEqual({ line: 2, statut: 'ERREUR', erreur: 'pci_invalide' })
    expect(planUsageImport([ligne({ tiers: 'Acme', offre: 'CRM', adresse: 'https://u:p@x.example' })], usages).lines[0]).toEqual({ line: 2, statut: 'ERREUR', erreur: 'identifiants_interdits' })
    expect(planUsageImport([ligne({ tiers: 'Acme', offre: 'CRM', si: 'non', interconnexion: 'Internet' })], usages).lines[0]).toEqual({ line: 2, statut: 'ERREUR', erreur: 'interconnexion_sans_si' })
  })
  it('type absent : WEB par défaut pour une URL http(s), AUTRE sinon', () => {
    const p = planUsageImport([ligne({ tiers: 'Acme', offre: 'CRM', adresse: 'https://portail.example' }), ligne({ tiers: 'Acme', offre: 'CRM', adresse: 'files.example' }, 3)], usages)
    expect(p.lignesValides.map(l => l.point?.type)).toEqual(['WEB', 'AUTRE'])
  })
})
