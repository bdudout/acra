import { describe, expect, it } from 'vitest'
import { MAX_SOUS_SECTEURS, normalizeSousSecteurs, resolveSousSecteursUpdate, selectableSousSecteurIds, sousSecteursOf } from '@/lib/sous-secteurs'
import { sectorExemplesFor } from '@/lib/exemples-sectoriels'
import { suggestRisqueExemples } from '@/lib/risque-exemples'
import { patternExemplesFor } from '@/lib/exemples-patterns'

const SANTE = 'Santé / Médico-social'
const BANQUE = 'Banque / Finance'
const txt = (sec: string, cat: string, ss: string | string[] | null) => JSON.stringify(sectorExemplesFor(sec, cat as never, 'fr', ss))

describe('plusieurs sous-secteurs par analyse — cohérence avec le secteur', () => {
  it('propose les sous-secteurs de la famille du secteur, jamais ceux d’un autre secteur ni d’interconnexion (devenue pattern)', () => {
    const ids = selectableSousSecteurIds(SANTE)
    expect(ids).toContain('sante-amc'); expect(ids.some(i => i.startsWith('technique-'))).toBe(false)
    expect(ids).not.toContain('banque-detail')
    // Un secteur sans taxonomie n'a aucun sous-secteur ; sans secteur, aucun.
    expect(selectableSousSecteurIds('Autre')).toEqual([])
    expect(selectableSousSecteurIds('')).toEqual([])
  })
  it('normalise la sélection : incohérents retirés, doublons retirés, ordre conservé (le premier est le principal), plafond', () => {
    expect(normalizeSousSecteurs(SANTE, ['sante-amc', 'banque-detail', 'sante-amc', 'technique-interco-prestataire', 'sante-amo'])).toEqual(['sante-amc', 'sante-amo'])
    expect(normalizeSousSecteurs(SANTE, 'nimporte')).toEqual([])
    expect(normalizeSousSecteurs(SANTE, ['sante-amc', 'sante-amo', 'sante-portail', 'sante-esante', 'sante-cabinet']).length).toBe(MAX_SOUS_SECTEURS)
    expect(normalizeSousSecteurs(SANTE, [42, null, 'sante-amo'])).toEqual(['sante-amo'])
  })
  it('lit les sous-secteurs d’une analyse existante (liste, sinon l’ancien champ unique)', () => {
    expect(sousSecteursOf({ sousSecteurs: ['sante-amc', 'sante-amo'], sousSecteur: 'sante-amc' })).toEqual(['sante-amc', 'sante-amo'])
    expect(sousSecteursOf({ sousSecteurs: [], sousSecteur: 'sante-amo' })).toEqual(['sante-amo'])
    expect(sousSecteursOf({ sousSecteur: null })).toEqual([])
    expect(sousSecteursOf(null)).toEqual([])
  })
  it('mise à jour (création / modification) : liste prioritaire, champ unique en repli, sous-secteur principal = premier ; changement de secteur purge ce qui devient incohérent', () => {
    expect(resolveSousSecteursUpdate({ secteur: SANTE, input: { sousSecteurs: ['sante-amc', 'sante-amo'] } })).toEqual({ sousSecteurs: ['sante-amc', 'sante-amo'], sousSecteur: 'sante-amc' })
    expect(resolveSousSecteursUpdate({ secteur: SANTE, input: { sousSecteur: 'sante-amo' } })).toEqual({ sousSecteurs: ['sante-amo'], sousSecteur: 'sante-amo' })
    expect(resolveSousSecteursUpdate({ secteur: BANQUE, input: {}, existing: { sousSecteurs: ['sante-amc', 'sante-amo'] } })).toEqual({ sousSecteurs: [], sousSecteur: null })
    expect(resolveSousSecteursUpdate({ secteur: SANTE, input: { sousSecteurs: [] } })).toEqual({ sousSecteurs: [], sousSecteur: null })
  })
})

describe('exemples : union des sous-secteurs choisis, uniquement ce qui est cohérent', () => {
  it('une mutuelle qui coche des patterns d’interconnexion voit le contenu mutuelle ET celui des patterns, sans doublon', () => {
    const noms = (m: Record<string, unknown>[]) => m.map(x => String(x.nom))
    const base = sectorExemplesFor(SANTE, 'mesures', 'fr', ['sante-amc'])
    const comb = sectorExemplesFor(SANTE, 'mesures', 'fr', ['sante-amc'], ['EXTERNALISATION_DONNEES', 'INTERCO_TIERS'])
    const m = JSON.stringify(comb)
    expect(m).toMatch(/coordonnées bancaires/i); expect(m).toMatch(/complétude/i)
    for (const b of noms(base)) expect(noms(comb)).toContain(b)
    expect(new Set(noms(comb)).size).toBe(noms(comb).length)
    // Plafond par pattern (pas de surcharge), jamais vide.
    expect(patternExemplesFor(['EXTERNALISATION_DONNEES'], 'mesures', 'fr').length).toBeGreaterThan(0)
    expect(patternExemplesFor(['EXTERNALISATION_DONNEES'], 'mesures', 'fr').length).toBeLessThanOrEqual(4)
  })
  it('les éléments propres à chacun des sous-secteurs choisis passent avant le socle commun', () => {
    const noms = sectorExemplesFor('Protection sociale / Sécurité sociale', 'mesures', 'fr', ['protsoc-caisse-locale', 'protsoc-services-usagers']).map(x => String(x.nom))
    const iSocle = noms.findIndex(n => /Délai de sécurité et confirmation/.test(n))
    const iUsagers = noms.findIndex(n => /Authentification renforcée pour les opérations sensibles du compte usager/.test(n))
    expect(iUsagers).toBeGreaterThan(-1); expect(iUsagers).toBeLessThan(iSocle)
  })
  it('un sous-secteur d’un autre secteur est ignoré, même passé directement', () => {
    expect(txt(SANTE, 'valeursMetier', ['sante-amc', 'banque-detail'])).toBe(txt(SANTE, 'valeursMetier', ['sante-amc']))
  })
  it('le contenu commun santé ne s’affiche pas là où il est incohérent (vétérinaire, complémentaire santé)', () => {
    const veto = txt(SANTE, 'mesures', 'sante-veterinaire') + txt(SANTE, 'valeursMetier', 'sante-veterinaire') + txt(SANTE, 'actionsElementaires', 'sante-veterinaire')
    expect(veto).not.toMatch(/identité nationale de santé|Pro Santé Connect|Dossier Patient Informatisé|biomédical/i)
    const amc = txt(SANTE, 'mesures', 'sante-amc') + txt(SANTE, 'actionsElementaires', 'sante-amc')
    expect(amc).not.toMatch(/équipements de santé avec leurs éditeurs|équipement biomédical|carte CPS/i)
    // mais reste proposé à un hôpital
    expect(txt(SANTE, 'mesures', 'sante-hopital')).toMatch(/identité nationale de santé/i)
  })
  it('les suggestions de risques (saisie directe) suivent la même union', () => {
    const s = suggestRisqueExemples({ secteur: SANTE, sousSecteur: ['sante-amc'], patterns: ['EXTERNALISATION_DONNEES', 'INTERCO_TIERS'], limit: 60 })
    expect(s.some(r => /IBAN/i.test(r.intitule))).toBe(true)
    expect(s.some(r => /partenaire compromis|prestataire est indisponible|fichiers falsifiés/i.test(r.intitule))).toBe(true)
  })
})
