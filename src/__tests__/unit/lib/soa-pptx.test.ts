import { describe, it, expect } from 'vitest'
import { renderSoaPptx, type SoaPptxLabels } from '@/lib/soa-pptx'
import { buildSoaExport } from '@/lib/soa-export'
import type { ConformiteEntry } from '@/lib/conformite'

const labels: SoaPptxLabels = {
  title: 'Déclaration d\'applicabilité (SoA)', org: 'Organisation', framework: 'Référentiel',
  rate: 'Taux de conformité', evaluated: 'Contrôles évalués',
  colRef: 'Réf.', colControl: 'Contrôle', colCategory: 'Catégorie', colStatus: 'Statut', colComment: 'Commentaire',
  notEvaluated: 'Non évalué',
  statuts: { conforme: 'Conforme', partiel: 'Partiel', non_conforme: 'Non conforme', na: 'N/A', deroge: 'Dérogé' },
}

const controles = [
  { ref: 'A.5.1', nom: 'Politiques de sécurité', categorie: 'Organisationnel' },
  { ref: 'A.5.2', nom: 'Rôles et responsabilités', categorie: 'Organisationnel' },
  { ref: 'A.8.1', nom: 'Terminaux', categorie: 'Technologique' },
]
const entries: ConformiteEntry[] = [
  { ref: 'A.5.1', statut: 'conforme', commentaire: 'Politique validée' },
  { ref: 'A.5.2', statut: 'partiel', commentaire: '' },
]

describe('renderSoaPptx', () => {
  it('produit un buffer .pptx non vide (signature ZIP)', async () => {
    const data = buildSoaExport(controles, entries)
    const buf = await renderSoaPptx(data, { tauxConformite: 50, evalues: 2, total: 3 }, 'ACME', 'ISO 27001', '2026-09-14', labels)
    expect(Buffer.isBuffer(buf)).toBe(true)
    expect(buf.length).toBeGreaterThan(1000)
    // Un .pptx est un ZIP → commence par "PK".
    expect(buf.subarray(0, 2).toString('latin1')).toBe('PK')
  })

  it('reste robuste avec un référentiel sans aucune évaluation', async () => {
    const data = buildSoaExport(controles, [])
    const buf = await renderSoaPptx(data, { tauxConformite: 0, evalues: 0, total: 3 }, 'ACME', 'DORA', '2026-09-14', labels)
    expect(buf.subarray(0, 2).toString('latin1')).toBe('PK')
  })
})
