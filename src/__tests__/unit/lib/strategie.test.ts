// Stratégie cyber / IT / résilience (lot S1a) : saisies, transitions, figeage optionnel du cadre, justification
// après validation, écart cadre validé ↔ courant, plan de copie « nouvelle version ».
import { describe, expect, it } from 'vitest'
import {
  STRATEGIE_TYPES, STRATEGIE_STATUTS, EVOLUTION_TYPES,
  strategieCreateSchema, axeSchema, objectifSchema, rattachementSchema,
  transitionAutorisee, decisionModifCadre, decisionRattachement, decisionModifStrategie,
  instantaneCadre, ecartCadre, rattachementsDepuisValidation, planNouvelleVersion, lireJustification,
  normaliserIdentifiants, decisionModifIdentifiants, extraireIdentifiants, changementIdentifiants,
} from '@/lib/strategie'
import { ACTION_SOURCES } from '@/lib/action-items'

const axe = (id: string, o: Record<string, unknown> = {}) => ({ id, ordre: 0, titre: `Axe ${id}`, description: null, referenceRef: null, objectifs: [] as ReturnType<typeof obj>[], ...o })
const obj = (id: string, o: Record<string, unknown> = {}) => ({ id, titre: `Obj ${id}`, indicateur: null, cible: null, echeance: null, kriId: null, ...o })

describe('référentiels de valeurs', () => {
  it('types, statuts et types d’évolution', () => {
    expect(STRATEGIE_TYPES).toEqual(['CYBER', 'IT', 'RESILIENCE', 'INTEGREE'])
    expect(STRATEGIE_STATUTS).toEqual(['BROUILLON', 'VALIDEE', 'ARCHIVEE'])
    expect(EVOLUTION_TYPES).toContain('AJOUT_RATTACHEMENT')
    expect(EVOLUTION_TYPES).toContain('SUPPR_OBJECTIF')
  })
})

describe('validation des saisies', () => {
  it('stratégie : titre obligatoire, type connu, période cohérente', () => {
    expect(strategieCreateSchema.safeParse({ titre: 'Stratégie 2027', type: 'CYBER' }).success).toBe(true)
    expect(strategieCreateSchema.safeParse({ titre: '  ', type: 'CYBER' }).success).toBe(false)
    expect(strategieCreateSchema.safeParse({ titre: 'x', type: 'AUTRE' }).success).toBe(false)
    expect(strategieCreateSchema.safeParse({ titre: 'x', type: 'IT', periodeDebut: '2027-12-31', periodeFin: '2027-01-01' }).success).toBe(false)
    const ok = strategieCreateSchema.parse({ titre: ' S ', type: 'IT', periodeDebut: '2027-01-01', periodeFin: '2029-12-31' })
    expect(ok.titre).toBe('S')
    expect(ok.periodeDebut).toBeInstanceOf(Date)
  })
  it('axe et objectif : titre obligatoire et borné', () => {
    expect(axeSchema.safeParse({ titre: 'Protéger' }).success).toBe(true)
    expect(axeSchema.safeParse({ titre: 'x'.repeat(300) }).success).toBe(false)
    expect(objectifSchema.safeParse({ titre: 'MFA 100 %', echeance: '2027-06-30' }).success).toBe(true)
    expect(objectifSchema.safeParse({}).success).toBe(false)
  })
  it('rattachement : sourceType = ACTION_SOURCES du store d’actions', () => {
    for (const s of ACTION_SOURCES) expect(rattachementSchema.safeParse({ axeId: 'a', sourceType: s, sourceId: 'x' }).success).toBe(true)
    expect(rattachementSchema.safeParse({ axeId: 'a', sourceType: 'RISQUE', sourceId: 'x' }).success).toBe(false)
    expect(rattachementSchema.parse({ axeId: 'a', sourceType: 'AUDIT', sourceId: 'x' }).provenance).toBe('MANUEL')
  })
  it('justification : texte non vide, borné', () => {
    expect(lireJustification('  parce que  ')).toBe('parce que')
    expect(lireJustification('   ')).toBeNull()
    expect(lireJustification(42)).toBeNull()
    expect(lireJustification('x'.repeat(5000))).toHaveLength(2000)
  })
})

describe('transitions de statut', () => {
  it('BROUILLON → VALIDEE → ARCHIVEE uniquement', () => {
    expect(transitionAutorisee('BROUILLON', 'VALIDEE')).toBe(true)
    expect(transitionAutorisee('VALIDEE', 'ARCHIVEE')).toBe(true)
    expect(transitionAutorisee('VALIDEE', 'BROUILLON')).toBe(false)
    expect(transitionAutorisee('ARCHIVEE', 'VALIDEE')).toBe(false)
    expect(transitionAutorisee('BROUILLON', 'ARCHIVEE')).toBe(false)
  })
})

describe('modification du cadre (axes, objectifs)', () => {
  it('BROUILLON : libre, sans justification ni historique', () => {
    expect(decisionModifCadre('BROUILLON', true, null)).toEqual({ ok: true, historiser: false })
  })
  it('VALIDEE et cadre figé : 409 cadre_fige, même avec justification', () => {
    expect(decisionModifCadre('VALIDEE', true, 'raison')).toEqual({ ok: false, status: 409, error: 'cadre_fige' })
  })
  it('VALIDEE et cadre non figé : justification obligatoire, historisé', () => {
    expect(decisionModifCadre('VALIDEE', false, null)).toEqual({ ok: false, status: 400, error: 'justification_requise' })
    expect(decisionModifCadre('VALIDEE', false, 'nouvel axe NIS2')).toEqual({ ok: true, historiser: true })
  })
  it('ARCHIVEE : 409', () => {
    expect(decisionModifCadre('ARCHIVEE', false, 'x')).toEqual({ ok: false, status: 409, error: 'strategie_archivee' })
  })
  it('champs de la stratégie : modifiables en BROUILLON seulement', () => {
    expect(decisionModifStrategie('BROUILLON')).toEqual({ ok: true })
    expect(decisionModifStrategie('VALIDEE')).toEqual({ ok: false, status: 409, error: 'strategie_validee' })
    expect(decisionModifStrategie('ARCHIVEE')).toEqual({ ok: false, status: 409, error: 'strategie_archivee' })
  })
})

describe('rattachements', () => {
  it('BROUILLON libre ; VALIDEE avec justification et historique ; ARCHIVEE refusé', () => {
    expect(decisionRattachement('BROUILLON', null)).toEqual({ ok: true, historiser: false })
    expect(decisionRattachement('VALIDEE', null)).toEqual({ ok: false, status: 400, error: 'justification_requise' })
    expect(decisionRattachement('VALIDEE', 'constat audit 2027-03')).toEqual({ ok: true, historiser: true })
    expect(decisionRattachement('ARCHIVEE', 'x')).toEqual({ ok: false, status: 409, error: 'strategie_archivee' })
  })
  it('rattachements ajoutés depuis la validation', () => {
    const v = new Date('2027-01-10')
    const r = [{ id: 'r1', createdAt: new Date('2027-01-01') }, { id: 'r2', createdAt: new Date('2027-02-01') }]
    expect(rattachementsDepuisValidation(r, v).map(x => x.id)).toEqual(['r2'])
    expect(rattachementsDepuisValidation(r, null)).toEqual([])
  })
})

describe('instantané et écart du cadre', () => {
  const courant = [axe('a1', { ordre: 1, objectifs: [obj('o1'), obj('o2', { cible: '95 %' })] }), axe('a3')]
  const snap = instantaneCadre([axe('a1', { ordre: 1, objectifs: [obj('o1'), obj('o2', { cible: '90 %' }), obj('o9')] }), axe('a2')])

  it('instantané normalisé (dates ISO, champs connus seulement)', () => {
    const s = instantaneCadre([axe('a', { objectifs: [obj('o', { echeance: new Date('2027-06-30T00:00:00Z') })], extra: 1 })])
    expect(s.axes[0]).not.toHaveProperty('extra')
    expect(s.axes[0].objectifs[0].echeance).toBe('2027-06-30T00:00:00.000Z')
  })
  it('axes et objectifs ajoutés, modifiés, supprimés', () => {
    const e = ecartCadre(snap, courant)
    expect(e.axes.ajoutes.map(a => a.id)).toEqual(['a3'])
    expect(e.axes.supprimes.map(a => a.id)).toEqual(['a2'])
    expect(e.axes.modifies).toEqual([])
    expect(e.objectifs.modifies.map(o => o.id)).toEqual(['o2'])
    expect(e.objectifs.supprimes.map(o => o.id)).toEqual(['o9'])
    expect(e.objectifs.ajoutes).toEqual([])
    expect(e.identique).toBe(false)
  })
  it('sans instantané (jamais validée) : écart vide', () => {
    expect(ecartCadre(null, courant).identique).toBe(true)
  })
  it('cadre inchangé : identique', () => {
    expect(ecartCadre(instantaneCadre(courant), courant).identique).toBe(true)
  })
})

describe('nouvelle version', () => {
  const s = {
    id: 's1', organizationId: 'o1', titre: 'S', description: null, type: 'CYBER', periodeDebut: null, periodeFin: null,
    statut: 'VALIDEE', version: 2,
    axes: [{ ...axe('a1'), objectifs: [obj('o1')], rattachements: [{ sourceType: 'AUDIT', sourceId: 'c1', provenance: 'MANUEL', ajoutePar: 'u0' }] }],
  }
  it('copie axes, objectifs, rattachements ; version + 1 ; BROUILLON ; lien vers la précédente', () => {
    const p = planNouvelleVersion(s, 'u1')
    expect(p).not.toBeNull()
    expect(p!.strategie).toMatchObject({ organizationId: 'o1', titre: 'S', version: 3, statut: 'BROUILLON', versionPrecedenteId: 's1', createdById: 'u1' })
    expect(p!.axes[0]).toMatchObject({ titre: 'Axe a1', objectifs: [{ titre: 'Obj o1' }], rattachements: [{ sourceType: 'AUDIT', sourceId: 'c1', provenance: 'MANUEL' }] })
    expect(p!.axes[0]).not.toHaveProperty('id')
  })
  it('uniquement depuis une stratégie VALIDEE', () => {
    expect(planNouvelleVersion({ ...s, statut: 'BROUILLON' }, 'u1')).toBeNull()
    expect(planNouvelleVersion({ ...s, statut: 'ARCHIVEE' }, 'u1')).toBeNull()
  })
})

describe('identifiants internes (lien comptable / budgétaire)', () => {
  it('normalise : trim, tableau { systeme, valeur }, null efface, absent ignoré', () => {
    expect(normaliserIdentifiants({ referenceInterne: '  CC-4102 ', identifiantsExternes: [{ systeme: ' SAP ', valeur: ' 4102 ' }] }))
      .toEqual({ ok: true, value: { referenceInterne: 'CC-4102', identifiantsExternes: [{ systeme: 'SAP', valeur: '4102' }] } })
    expect(normaliserIdentifiants({ referenceInterne: '', identifiantsExternes: null })).toEqual({ ok: true, value: { referenceInterne: null, identifiantsExternes: null } })
    expect(normaliserIdentifiants({ identifiantsExternes: [] })).toEqual({ ok: true, value: { identifiantsExternes: null } })
    expect(normaliserIdentifiants({ titre: 'x' })).toEqual({ ok: true, value: {} })
  })
  it('rejette : type faux, trop long, plus de 10, champ vide, doublon de systeme', () => {
    const ko = { ok: false, error: 'identifiants_invalides' }
    expect(normaliserIdentifiants({ referenceInterne: 42 })).toEqual(ko)
    expect(normaliserIdentifiants({ referenceInterne: 'x'.repeat(101) })).toEqual(ko)
    expect(normaliserIdentifiants({ identifiantsExternes: 'SAP' })).toEqual(ko)
    expect(normaliserIdentifiants({ identifiantsExternes: [{ systeme: 'x'.repeat(51), valeur: 'v' }] })).toEqual(ko)
    expect(normaliserIdentifiants({ identifiantsExternes: [{ systeme: 's', valeur: 'v'.repeat(101) }] })).toEqual(ko)
    expect(normaliserIdentifiants({ identifiantsExternes: Array.from({ length: 11 }, (_, i) => ({ systeme: `s${i}`, valeur: 'v' })) })).toEqual(ko)
    expect(normaliserIdentifiants({ identifiantsExternes: [{ systeme: ' ', valeur: 'v' }] })).toEqual(ko)
    expect(normaliserIdentifiants({ identifiantsExternes: [{ systeme: 'SAP', valeur: '' }] })).toEqual(ko)
    expect(normaliserIdentifiants({ identifiantsExternes: [{ systeme: 'SAP', valeur: '1' }, { systeme: 'sap', valeur: '2' }] })).toEqual(ko)
    expect(normaliserIdentifiants({ identifiantsExternes: [null] })).toEqual(ko)
  })
  it('modifiables même si le cadre est figé (historisés après validation), pas sur ARCHIVEE', () => {
    expect(decisionModifIdentifiants('BROUILLON')).toEqual({ ok: true, historiser: false })
    expect(decisionModifIdentifiants('VALIDEE')).toEqual({ ok: true, historiser: true })
    expect(decisionModifIdentifiants('ARCHIVEE')).toEqual({ ok: false, status: 409, error: 'strategie_archivee' })
    expect(EVOLUTION_TYPES).toContain('IDENTIFIANTS')
  })
  it('copiés dans l’instantané et la nouvelle version ; hors écart du cadre', () => {
    const ids = { referenceInterne: 'CC-1', identifiantsExternes: [{ systeme: 'SAP', valeur: '1' }] }
    const snap = instantaneCadre([axe('a', { ...ids, objectifs: [obj('o', ids)] })], ids)
    expect(snap.strategie).toEqual(ids)
    expect(snap.axes[0]).toMatchObject(ids)
    expect(snap.axes[0].objectifs[0]).toMatchObject(ids)
    expect(ecartCadre(snap, [axe('a', { referenceInterne: 'CC-2', objectifs: [obj('o')] })]).identique).toBe(true)
    const p = planNouvelleVersion({
      id: 's', organizationId: 'o1', titre: 'S', description: null, type: 'IT', periodeDebut: null, periodeFin: null, statut: 'VALIDEE', version: 1, ...ids,
      axes: [{ ...axe('a', ids), objectifs: [obj('o', ids)], rattachements: [] }],
    }, 'u')!
    expect(p.strategie).toMatchObject(ids)
    expect(p.axes[0]).toMatchObject(ids)
    expect(p.axes[0].objectifs[0]).toMatchObject(ids)
  })
})

describe('séparation des identifiants d’une saisie', () => {
  it('extrait identifiants et justification ; le reste est le cadre', () => {
    expect(extraireIdentifiants({ titre: 'T', referenceInterne: ' X ', justification: 'j' }))
      .toEqual({ ok: true, ids: { referenceInterne: 'X' }, reste: { titre: 'T' } })
    expect(extraireIdentifiants({ referenceInterne: 1 })).toEqual({ ok: false, error: 'identifiants_invalides' })
  })
  it('changement : avant / après des seuls champs fournis, null si identique', () => {
    const row = { referenceInterne: 'A', identifiantsExternes: null }
    expect(changementIdentifiants(row, { referenceInterne: 'B' })).toEqual({ avant: { referenceInterne: 'A' }, apres: { referenceInterne: 'B' } })
    expect(changementIdentifiants(row, { referenceInterne: 'A' })).toBeNull()
    expect(changementIdentifiants(row, {})).toBeNull()
  })
})

// ─── Lot S1a-fix : suppression d'axe après validation, libellés i18n, journal d'archivage ──
import { decisionSuppressionAxe, STRATEGIE_ERREURS } from '@/lib/strategie'
import { categoryForAction } from '@/lib/siem'
import { fr } from '@/lib/i18n/fr'
import { en } from '@/lib/i18n/en'
import { de } from '@/lib/i18n/de'
import { es } from '@/lib/i18n/es'
import { it as itLang } from '@/lib/i18n/it'

describe('suppression d’un axe', () => {
  it('BROUILLON : libre, même non vide', () => {
    expect(decisionSuppressionAxe('BROUILLON', false, null, true)).toEqual({ ok: true, historiser: false })
  })
  it('VALIDEE non figée : axe non vide refusé (409 axe_non_vide), axe vide justifié et historisé', () => {
    expect(decisionSuppressionAxe('VALIDEE', false, 'x', true)).toEqual({ ok: false, status: 409, error: 'axe_non_vide' })
    expect(decisionSuppressionAxe('VALIDEE', false, 'x', false)).toEqual({ ok: true, historiser: true })
    expect(decisionSuppressionAxe('VALIDEE', false, null, false)).toMatchObject({ ok: false, error: 'justification_requise' })
  })
  it('VALIDEE figée / ARCHIVEE : règles du cadre', () => {
    expect(decisionSuppressionAxe('VALIDEE', true, 'x', false)).toMatchObject({ ok: false, error: 'cadre_fige' })
    expect(decisionSuppressionAxe('ARCHIVEE', false, 'x', false)).toMatchObject({ ok: false, error: 'strategie_archivee' })
  })
})

describe('libellés i18n du bloc stratégie (5 langues)', () => {
  const langues = { fr, en, de, es, it: itLang }
  it('chaque type d’évolution et chaque code d’erreur a un libellé', () => {
    for (const code of ['version_en_cours', 'axe_non_vide', 'kri_introuvable', 'identifiants_invalides']) expect(STRATEGIE_ERREURS).toContain(code)
    for (const [l, t] of Object.entries(langues)) {
      const s = t.strategie as unknown as { evolutions: Record<string, string>; erreurs: Record<string, string> }
      for (const e of EVOLUTION_TYPES) expect(s.evolutions[e], `${l}.evolutions.${e}`).toBeTruthy()
      for (const e of STRATEGIE_ERREURS) expect(s.erreurs[e], `${l}.erreurs.${e}`).toBeTruthy()
    }
  })
})

describe('journal : archivage', () => {
  it('STRATEGIE_ARCHIVED relève de la gouvernance', () => {
    expect(categoryForAction('STRATEGIE_ARCHIVED')).toBe('GOUVERNANCE')
  })
})
