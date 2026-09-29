import { describe, expect, it } from 'vitest'
import { rapprocherCompta, type IncidentCompta } from '@/lib/rapprochement-compta'

const cfg = { deviseReference: 'EUR', taux: { USD: 0.5 } }
const inc = (id: string, intitule: string, pertes: { montant: number; devise?: string; statut: string }[]): IncidentCompta => ({
  id, intitule, pertes: pertes.map(p => ({ type: 'PERTE_DIRECTE', montant: p.montant, devise: p.devise ?? 'EUR', statut: p.statut })),
})

describe('rapprochement comptable LDC ↔ grand livre', () => {
  const incidents = [inc('i1', 'Ransomware', [{ montant: 1000, statut: 'COMPTABILISE' }, { montant: 500, statut: 'ESTIME' }]), inc('i2', 'Panne', [{ montant: 200, statut: 'COMPTABILISE' }]), inc('i3', 'Fuite', [{ montant: 300, statut: 'COMPTABILISE' }])]
  it('compare le comptabilisé de la LDC au montant du grand livre (référence = id ou intitulé)', () => {
    const r = rapprocherCompta('reference;montant;devise\ni1;1000;EUR\nPanne;500;USD\nInconnu;10;EUR', incidents, cfg)
    const par = Object.fromEntries(r.lignes.map(l => [l.reference, l]))
    expect(par.i1).toMatchObject({ statut: 'OK', ldc: 1000, compta: 1000, ecart: 0 })
    expect(par.Panne).toMatchObject({ statut: 'ECART', ldc: 200, compta: 250, ecart: 50 })
    expect(par.Inconnu).toMatchObject({ statut: 'ABSENT_LDC', compta: 10 })
    expect(r.lignes.find(l => l.incidentId === 'i3')).toMatchObject({ statut: 'ABSENT_COMPTA', ldc: 300, compta: 0 })
    expect(r.synthese).toMatchObject({ ok: 1, ecarts: 1, absentsLdc: 1, absentsCompta: 1, ecartTotal: 50 + 10 - 300 })
  })
  it('cumule plusieurs écritures pour une même référence et applique la tolérance', () => {
    const r = rapprocherCompta('reference,montant\ni2,100\ni2,100.004', incidents, cfg, 0.01)
    expect(r.lignes.find(l => l.incidentId === 'i2')).toMatchObject({ statut: 'OK', compta: 200 })
  })
  it('signale les erreurs de fichier et les lignes invalides sans planter', () => {
    expect(rapprocherCompta('', incidents, cfg).erreurGlobale).toBe('fichier_vide')
    expect(rapprocherCompta('a;b\n1;2', incidents, cfg).erreurGlobale).toBe('colonnes_absentes')
    const r = rapprocherCompta('reference;montant\ni1;abc\n;5\ni2;200', incidents, cfg)
    expect(r.erreurs.map(e => e.ligne)).toEqual([2, 3])
    expect(r.lignes.find(l => l.incidentId === 'i2')?.statut).toBe('OK')
  })
  it('devise sans taux : ligne en erreur, jamais convertie à un taux inventé', () => {
    const r = rapprocherCompta('reference;montant;devise\ni2;200;JPY', incidents, cfg)
    expect(r.erreurs).toEqual([{ ligne: 2, error: 'devise_sans_taux' }])
  })
})
