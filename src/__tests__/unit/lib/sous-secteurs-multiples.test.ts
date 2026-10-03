import { describe, expect, it } from 'vitest'
import { MAX_SOUS_SECTEURS, normalizeSousSecteurs, resolveSousSecteursUpdate, selectableSousSecteurIds, sousSecteursOf } from '@/lib/sous-secteurs'
import { sectorExemplesFor } from '@/lib/exemples-sectoriels'
import { suggestRisqueExemples } from '@/lib/risque-exemples'

const SANTE = 'Santé / Médico-social'
const BANQUE = 'Banque / Finance'
const TECH = 'Technique / Interconnexion de SI'
const txt = (sec: string, cat: string, ss: string | string[] | null) => JSON.stringify(sectorExemplesFor(sec, cat as never, 'fr', ss))

describe('plusieurs sous-secteurs par analyse — cohérence avec le secteur', () => {
  it('propose les sous-secteurs de la famille du secteur, plus les interconnexions (transverses), jamais ceux d’un autre secteur', () => {
    const ids = selectableSousSecteurIds(SANTE)
    expect(ids).toContain('sante-amc'); expect(ids).toContain('technique-interco-prestataire')
    expect(ids).not.toContain('banque-detail')
    // Le secteur Technique ne se voit pas proposer deux fois ses sous-secteurs ; un secteur sans taxonomie n'a que les interconnexions.
    expect(selectableSousSecteurIds(TECH).filter(i => i === 'technique-api-exposee')).toHaveLength(1)
    expect(selectableSousSecteurIds('Autre')).toEqual(selectableSousSecteurIds(TECH))
    expect(selectableSousSecteurIds('')).toEqual([])
  })
  it('normalise la sélection : incohérents retirés, doublons retirés, ordre conservé (le premier est le principal), plafond', () => {
    expect(normalizeSousSecteurs(SANTE, ['sante-amc', 'banque-detail', 'sante-amc', 'technique-interco-prestataire'])).toEqual(['sante-amc', 'technique-interco-prestataire'])
    expect(normalizeSousSecteurs(SANTE, 'nimporte')).toEqual([])
    expect(normalizeSousSecteurs(SANTE, ['sante-amc', 'sante-amo', 'sante-portail', 'sante-esante', 'sante-cabinet']).length).toBe(MAX_SOUS_SECTEURS)
    expect(normalizeSousSecteurs(SANTE, [42, null, 'sante-amo'])).toEqual(['sante-amo'])
  })
  it('lit les sous-secteurs d’une analyse existante (liste, sinon l’ancien champ unique)', () => {
    expect(sousSecteursOf({ sousSecteurs: ['sante-amc', 'technique-api-exposee'], sousSecteur: 'sante-amc' })).toEqual(['sante-amc', 'technique-api-exposee'])
    expect(sousSecteursOf({ sousSecteurs: [], sousSecteur: 'sante-amo' })).toEqual(['sante-amo'])
    expect(sousSecteursOf({ sousSecteur: null })).toEqual([])
    expect(sousSecteursOf(null)).toEqual([])
  })
  it('mise à jour (création / modification) : liste prioritaire, champ unique en repli, sous-secteur principal = premier ; changement de secteur purge ce qui devient incohérent', () => {
    expect(resolveSousSecteursUpdate({ secteur: SANTE, input: { sousSecteurs: ['sante-amc', 'technique-interco-metier'] } })).toEqual({ sousSecteurs: ['sante-amc', 'technique-interco-metier'], sousSecteur: 'sante-amc' })
    expect(resolveSousSecteursUpdate({ secteur: SANTE, input: { sousSecteur: 'sante-amo' } })).toEqual({ sousSecteurs: ['sante-amo'], sousSecteur: 'sante-amo' })
    expect(resolveSousSecteursUpdate({ secteur: BANQUE, input: {}, existing: { sousSecteurs: ['sante-amc', 'technique-api-exposee'] } })).toEqual({ sousSecteurs: ['technique-api-exposee'], sousSecteur: 'technique-api-exposee' })
    expect(resolveSousSecteursUpdate({ secteur: SANTE, input: { sousSecteurs: [] } })).toEqual({ sousSecteurs: [], sousSecteur: null })
  })
})

describe('exemples : union des sous-secteurs choisis, uniquement ce qui est cohérent', () => {
  it('une mutuelle qui analyse une interconnexion voit le contenu mutuelle ET celui de l’interconnexion', () => {
    const m = txt(SANTE, 'mesures', ['sante-amc', 'technique-interco-prestataire'])
    expect(m).toMatch(/coordonnées bancaires/i); expect(m).toMatch(/complétude/i)
    // sans doublon
    const noms = sectorExemplesFor(SANTE, 'mesures', 'fr', ['sante-amc', 'technique-interco-prestataire']).map(x => String(x.nom))
    expect(new Set(noms).size).toBe(noms.length)
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
    const s = suggestRisqueExemples({ secteur: SANTE, sousSecteur: ['sante-amc', 'technique-interco-prestataire'], limit: 60 })
    expect(s.some(r => /IBAN/i.test(r.intitule))).toBe(true)
    expect(s.some(r => /partenaire compromis|prestataire est indisponible|fichiers falsifiés/i.test(r.intitule))).toBe(true)
  })
})
