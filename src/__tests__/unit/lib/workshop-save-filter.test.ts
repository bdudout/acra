import { describe, it, expect } from 'vitest'
import {
  cleanSourceRisque,
  cleanPartiePrenante,
  cleanScenarioStrategique,
  cleanScenarioOperationnel,
} from '@/lib/workshop-sanitize'

// ─────────────────────────────────────────────────────────────────────────────
// Tests de l'allowlist de sauvegarde des ateliers (F006 / CWE-915).
//
// Ces fonctions sont importées de la VRAIE source (src/lib/workshop-sanitize.ts)
// utilisée par src/app/api/analyses/[id]/workshop/[num]/route.ts — pas un miroir.
// On garantit : (1) les champs UI / hors-schéma sont écartés (anti mass-assignment),
// (2) les champs du schéma Prisma sont conservés, typés et bornés, (3) analyseId injecté.
// ─────────────────────────────────────────────────────────────────────────────

// ── cleanScenarioStrategique ──────────────────────────────────────────────────

describe('cleanScenarioStrategique', () => {
  const raw = {
    id: 'abc123',
    nom: 'Ransomware via prestataire',
    sourceRisqueId: 'sr1',
    objectifVise: 'Chiffrement du SI',
    coupleLabel: 'Cybercriminel → Chiffrement',   // champ UI — doit être exclu
    srNom: 'Cybercriminel organisé',               // champ UI — doit être exclu
    ovNom: 'Chiffrement du SI',                    // champ UI — doit être exclu
    description: 'Description du scénario',
    evenementRedouteRef: 'er1',
    vraisemblance: 3,
    gravite: 4,
    niveauRisque: 12,
    retenu: true,
  }

  it('écarte les champs UI (coupleLabel, srNom, ovNom) et l\'id client', () => {
    const result = cleanScenarioStrategique(raw, 'analyse1')
    expect(result).not.toHaveProperty('coupleLabel')
    expect(result).not.toHaveProperty('srNom')
    expect(result).not.toHaveProperty('ovNom')
    expect(result).not.toHaveProperty('id')
  })

  it('injecte analyseId', () => {
    expect(cleanScenarioStrategique(raw, 'analyse1').analyseId).toBe('analyse1')
  })

  it('conserve tous les champs schéma Prisma', () => {
    const result = cleanScenarioStrategique(raw, 'analyse1')
    expect(result).toMatchObject({
      nom: 'Ransomware via prestataire',
      sourceRisqueId: 'sr1',
      objectifVise: 'Chiffrement du SI',
      description: 'Description du scénario',
      evenementRedouteRef: 'er1',
      vraisemblance: 3,
      gravite: 4,
      niveauRisque: 12,
      retenu: true,
    })
  })

  it('rejette une assignation de masse vers un champ hors-schéma', () => {
    const malicious = { ...raw, createdAt: '1999-01-01', userId: 'attacker', isSocle: true }
    const result = cleanScenarioStrategique(malicious, 'analyse1') as Record<string, unknown>
    expect(result).not.toHaveProperty('createdAt')
    expect(result).not.toHaveProperty('userId')
    expect(result).not.toHaveProperty('isSocle')
  })
})

// ── cleanScenarioOperationnel ─────────────────────────────────────────────────

describe('cleanScenarioOperationnel', () => {
  const raw = {
    id: 'op123',
    nom: 'Exfiltration via VPN compromis',
    scenarioStrategiqueId: 'ss1',
    scenarioStrategiqueNom: 'Ransomware via prestataire',  // champ UI — doit être exclu
    description: 'Description opérationnelle',
    actionsElementaires: [{ id: 'a1', nom: 'Phishing' }],
    vraisemblance: 2,
    gravite: 4,
  }

  it('écarte le champ UI scenarioStrategiqueNom et l\'id client', () => {
    const result = cleanScenarioOperationnel(raw, 'analyse1')
    expect(result).not.toHaveProperty('scenarioStrategiqueNom')
    expect(result).not.toHaveProperty('id')
  })

  it('injecte analyseId et conserve les champs schéma + JSON', () => {
    const result = cleanScenarioOperationnel(raw, 'analyse1')
    expect(result.analyseId).toBe('analyse1')
    expect(result).toMatchObject({
      nom: 'Exfiltration via VPN compromis',
      scenarioStrategiqueId: 'ss1',
      description: 'Description opérationnelle',
      vraisemblance: 2,
      gravite: 4,
    })
    expect(result.actionsElementaires).toEqual([{ id: 'a1', nom: 'Phishing' }])
  })
})

// ── cleanPartiePrenante ───────────────────────────────────────────────────────

describe('cleanPartiePrenante', () => {
  const raw = {
    id: 'pp123',
    nom: 'Prestataire IT',
    type: 'PRESTATAIRE',
    dependance: 3,
    penetration: 4,
    maturite: 2,
    confiance: 2,
  }

  it('écarte l\'id client, injecte analyseId, dérive exposition/fiabilité', () => {
    const result = cleanPartiePrenante(raw, 'analyse1')
    expect(result).not.toHaveProperty('id')
    expect(result).not.toHaveProperty('vulnerabilite')
    expect(result.analyseId).toBe('analyse1')
    expect(result).toMatchObject({
      nom: 'Prestataire IT', type: 'PRESTATAIRE',
      dependance: 3, penetration: 4, maturite: 2, confiance: 2,
      exposition: 12, fiabilite: 4, // dép×pén · mat×conf
    })
  })

  it('borne les sous-critères à [1,100] (échelles configurables, cotation flottante) et calcule les dérivés', () => {
    const result = cleanPartiePrenante({ nom: 'X', type: 'CLIENT', dependance: 150, penetration: 2.5, maturite: 0, confiance: 3, critique: true }, 'a1')
    expect(result.dependance).toBe(100)    // clampé haut
    expect(result.penetration).toBe(2.5)   // flottant conservé
    expect(result.maturite).toBe(1)        // clampé bas
    expect(result.exposition).toBe(250)    // 100 × 2,5
    expect(result.fiabilite).toBe(3)       // 1 × 3
    expect(result.critique).toBe(true)     // marquage manuel propagé
  })

  it('applique les défauts 2/2/3/3 (+ critique=false) en l\'absence de sous-critères', () => {
    const result = cleanPartiePrenante({ nom: 'Y', type: 'AUTRE' }, 'a1')
    expect(result).toMatchObject({ dependance: 2, penetration: 2, maturite: 3, confiance: 3, exposition: 4, fiabilite: 9, critique: false })
  })
})

// ── cleanSourceRisque ─────────────────────────────────────────────────────────

describe('cleanSourceRisque', () => {
  const raw = {
    id: 'sr123',
    nom: 'Cybercriminel organisé',
    categorie: 'CYBERCRIMINEL',
    pertinence: 4,
    retenu: true,
    objectifsVises: [{ id: 'ov1', nom: 'Rançon' }],
    motivation: 'Gain financier',
  }

  it('écarte l\'id client et injecte analyseId', () => {
    const result = cleanSourceRisque(raw, 'analyse1')
    expect(result).not.toHaveProperty('id')
    expect(result.analyseId).toBe('analyse1')
  })

  it('conserve les champs schéma et le JSON objectifsVises', () => {
    const result = cleanSourceRisque(raw, 'analyse1')
    expect(result).toMatchObject({
      nom: 'Cybercriminel organisé',
      categorie: 'CYBERCRIMINEL',
      pertinence: 4,
      retenu: true,
      motivation: 'Gain financier',
    })
    expect(result.objectifsVises).toEqual([{ id: 'ov1', nom: 'Rançon' }])
  })

  it('borne les chaînes trop longues (anti-DoS / bloat)', () => {
    const result = cleanSourceRisque({ nom: 'x'.repeat(500), categorie: 'CYBERCRIMINEL' }, 'a1')
    expect((result.nom as string).length).toBe(255)
  })

  it('rejette une assignation de masse vers un champ hors-schéma', () => {
    const malicious = { ...raw, analyse: { hacked: true }, updatedAt: 'now' }
    const result = cleanSourceRisque(malicious, 'analyse1') as Record<string, unknown>
    expect(result).not.toHaveProperty('analyse')
    expect(result).not.toHaveProperty('updatedAt')
  })
})

// ── Traitement d'une liste (map) ──────────────────────────────────────────────

describe('filtrage d\'une liste de scénarios stratégiques', () => {
  it('filtre tous les éléments d\'un tableau', () => {
    const rawList = [
      { id: '1', nom: 'Scénario A', coupleLabel: 'SR → OV', vraisemblance: 2, gravite: 3, niveauRisque: 6, retenu: true },
      { id: '2', nom: 'Scénario B', coupleLabel: 'SR2 → OV2', vraisemblance: 3, gravite: 4, niveauRisque: 12, retenu: true },
    ]
    const filtered = rawList.map(s => cleanScenarioStrategique(s, 'analyse1'))
    filtered.forEach(s => {
      expect(s).not.toHaveProperty('id')
      expect(s).not.toHaveProperty('coupleLabel')
      expect(s.analyseId).toBe('analyse1')
      expect(s).toHaveProperty('nom')
    })
  })
})
