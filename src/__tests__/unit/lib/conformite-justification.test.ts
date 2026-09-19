import { it, expect } from 'vitest'
import { missingExclusionJustifications } from '@/lib/conformite'
it('signale les exclusions sans justification sans effacer les données historiques', () => {
 expect(missingExclusionJustifications([{ ref: '5.1', statut: 'na' }, { ref: '5.2', statut: 'na', commentaire: '  ' }, { ref: '5.3', statut: 'na', commentaire: 'Hors périmètre métier' }, { ref: '5.4', statut: 'conforme' }])).toEqual(['5.1', '5.2'])
 expect(missingExclusionJustifications(null)).toEqual([])
})
