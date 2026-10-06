// @vitest-environment node
/** Export PowerPoint d'un projet 360 : vision, avancement sur les risques, avancement des plans, plans par priorité. */
import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { renderProjetPptx, type ProjetPptxData } from '@/lib/projet-pptx'
import { fr } from '@/lib/i18n/fr'
import { labelsProjetPptx } from '@/lib/projet-pptx'

const data: ProjetPptxData = {
  nom: 'Migration de la paie', statut: 'En cours', secteur: 'Santé', patterns: ['Hébergement en nuage (IaaS / PaaS)'],
  perimetre: 'Paie et RH', objectifs: 'Bascule sans perte', miseEnService: '01/03/2027', analyses: ['Cyber — paie'], dateGeneration: '06/10/2026',
  risques: {
    total: 10, aTraiter: 4, acceptables: 6, sansPlan: 1, reductionPct: 35, horsAppetit: 2,
    paliers: [{ label: 'Faible', couleur: '#22c55e', brut: 2, actuel: 3, residuel: 6 }, { label: 'Critique', couleur: '#ef4444', brut: 4, actuel: 2, residuel: 0 }],
    principaux: [{ nom: 'Fuite de données de paie', niveau: 12, palier: 'Critique', couleur: '#ef4444', domaine: 'Cyber' }],
    parDomaine: [{ label: 'Cyber', total: 4 }, { label: 'Projet', total: 6 }],
  },
  plans: {
    indicateurs: { total: 8, faits: 2, enCours: 2, aFaire: 4, avancement: 25, enRetard: 1, echeanceProche: 3, sansPorteur: 5, sansEcheance: 4, apresMes: 1, joursRestants: 146 },
    liste: Array.from({ length: 30 }, (_, i) => ({ titre: i === 0 ? 'Faire qualifier le traitement par le DPO' : `Plan ${i}`, risque: 'RGPD', priorite: 'Majeur', echeance: '15/11/2026', statut: 'À faire', porteur: i === 0 ? 'DPO' : '—', enRetard: i === 1, apresMes: false })),
  },
}

async function textes(buf: Buffer) {
  const zip = await JSZip.loadAsync(buf)
  const slides = Object.keys(zip.files).filter(f => /^ppt\/slides\/slide\d+\.xml$/.test(f)).sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]))
  return Promise.all(slides.map(f => zip.files[f].async('string')))
}

describe('renderProjetPptx', () => {
  it('diapositives : titre, vision, risques, plans (indicateurs), plans par priorité — dans chaque langue', async () => {
    const buf = await renderProjetPptx(data, labelsProjetPptx(fr))
    expect(buf[0]).toBe(0x50); expect(buf[1]).toBe(0x4b)
    const s = await textes(buf)
    expect(s.length).toBeGreaterThanOrEqual(5)
    expect(s[0]).toContain('Migration de la paie')
    expect(s[1]).toContain('Bascule sans perte')
    expect(s.join()).toContain('Fuite de données de paie')
    expect(s.join()).toContain('25 %')
    expect(s.join()).toContain('Faire qualifier le traitement par le DPO')
    // 30 plans : la liste est paginée, rien n'est perdu.
    expect(s.join()).toContain('Plan 29')
  }, 30000)
  it('projet sans risque ni plan : support généré sans erreur', async () => {
    const vide = { ...data, risques: { ...data.risques, total: 0, aTraiter: 0, acceptables: 0, paliers: [], principaux: [], parDomaine: [], reductionPct: null }, plans: { indicateurs: { ...data.plans.indicateurs, total: 0, avancement: null, joursRestants: null }, liste: [] } }
    const s = await textes(await renderProjetPptx(vide, labelsProjetPptx(fr)))
    expect(s.length).toBeGreaterThanOrEqual(5)
  }, 30000)
})

describe('donneesProjetPptx', () => {
  it('traduit statuts, priorités, catégories ; formate les dates dans la langue ; signale retard et après mise en service', async () => {
    const { donneesProjetPptx } = await import('@/lib/projet-pptx')
    const ind = { plans: { total: 2, faits: 0, enCours: 1, aFaire: 1, avancement: 0, enRetard: 1, echeanceProche: 0, sansPorteur: 1, sansEcheance: 0 }, risquesATraiterSansPlan: 0, reductionPct: 10, residuelsHorsAppetit: 0, miseEnService: { joursRestants: 30, plansApres: 1 } }
    const d = donneesProjetPptx({
      vue: { nom: 'P', statut: 'EN_COURS', secteur: 'Santé', patterns: ['CLOUD_IAAS_PAAS'], perimetre: null, objectifs: 'O', analyses: [{ id: 'a', nom: 'Cyber' }], miseEnService: '2026-11-05',
        synthese: { total: 1, aTraiter: 1, acceptables: 0, paliers: [], principaux: [{ id: 'r', nom: 'R', niveau: 12, domaine: 'CYBER', palier: { label: 'Critique', couleur: '#ef4444' } }] }, indicateurs: ind },
      plans: [
        { titre: 'Plan A', statut: 'EN_COURS', priorite: 'CRITIQUE', echeance: '2026-09-01T00:00:00.000Z', porteur: 'DSI', risques: [{ id: 'r', nom: 'R', niveau: 12 }], enRetard: true },
        { titre: 'Plan B', statut: 'A_FAIRE', priorite: 'MAJEUR', echeance: '2026-12-01T00:00:00.000Z', porteur: null, risques: [], enRetard: false },
      ],
      parDomaine: [{ domaine: 'CYBER', total: 1 }, { domaine: null, total: 2 }],
      t: fr, locale: 'fr', now: new Date('2026-10-06T12:00:00Z'),
    })
    expect(d).toMatchObject({ statut: 'En cours', miseEnService: '05/11/2026', analyses: ['Cyber'], dateGeneration: '06/10/2026', patterns: ['Hébergement en nuage (IaaS / PaaS)'] })
    expect(d.risques.parDomaine).toEqual([{ label: 'Cyber', total: 1 }, { label: '—', total: 2 }])
    expect(d.risques.principaux[0]).toMatchObject({ domaine: 'Cyber', palier: 'Critique' })
    expect(d.plans.liste[0]).toMatchObject({ titre: 'Plan A', risque: 'R', priorite: 'Critique', echeance: '01/09/2026', statut: 'En cours', porteur: 'DSI', enRetard: true, apresMes: false })
    expect(d.plans.liste[1]).toMatchObject({ porteur: '—', risque: '—', apresMes: true })
    expect(d.plans.indicateurs).toMatchObject({ apresMes: 1, joursRestants: 30 })
  })
})
