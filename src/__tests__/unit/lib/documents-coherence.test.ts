// Cohérence base ↔ stockage des documents (profil ha, documents en S3) : inventaire des clés référencées, empreinte identique
// à celle du manifeste de sauvegarde (scripts/acra-snapshot.sh), contrôle « tout document référencé existe ».
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { clesReferencees, empreinteCles, verifierPresence, SOURCES_CLES, parseRapportSauvegarde, reponseRapportSauvegarde } from '@/lib/documents-coherence'

describe('clesReferencees / empreinteCles', () => {
  it('réunit Document.storageKey et rapports[].storageKey, sans doublon ni valeur vide ; JSON malformé ignoré', () => {
    const cles = clesReferencees({
      documents: [{ storageKey: 'o1/d2/b.pdf' }, { storageKey: 'o1/d1/a.pdf' }, { storageKey: '' }],
      rapports: [[{ storageKey: 'o1/r1/x.pdf' }, { storageKey: 'o1/d1/a.pdf' }], 'pas un tableau', [null, { nom: 'sans clé' }, { storageKey: 42 }]],
    })
    expect(cles).toEqual(['o1/d1/a.pdf', 'o1/d2/b.pdf', 'o1/r1/x.pdf'])
  })

  it('tri en ordre d’octets (COLLATE "C" côté script) et empreinte = SHA-256 de « une clé par ligne », comme le manifeste', () => {
    const cles = clesReferencees({ documents: [{ storageKey: 'o/é.pdf' }, { storageKey: 'o/Z.pdf' }, { storageKey: 'o/a.pdf' }], rapports: [] })
    expect(cles).toEqual(['o/Z.pdf', 'o/a.pdf', 'o/é.pdf'])
    expect(empreinteCles(cles)).toEqual({ nombre: 3, sha256: createHash('sha256').update('o/Z.pdf\no/a.pdf\no/é.pdf\n').digest('hex') })
    expect(empreinteCles([]).sha256).toBe(createHash('sha256').update('').digest('hex'))
  })

  it('parité avec la requête du script de sauvegarde : mêmes tables sources', () => {
    const requete = (f: string) => { const src = readFileSync(f, 'utf8'); const i = src.indexOf('"SELECT k FROM'); expect(i, f).toBeGreaterThan(0); return src.slice(i, src.indexOf('COLLATE', i)) }
    const sql = requete('scripts/acra-snapshot.sh')
    for (const s of SOURCES_CLES) expect(sql, s).toContain(`\\"${s}\\"`)
    expect(requete('scripts/acra-restore-ha.sh')).toBe(sql)
  })
})

describe('verifierPresence', () => {
  it('compte présents, manquants et erreurs ; concurrence bornée', async () => {
    let enCours = 0, max = 0
    const head = async (k: string) => {
      enCours++; max = Math.max(max, enCours)
      await new Promise(r => setTimeout(r, 2))
      enCours--
      if (k.includes('absent')) return null
      if (k.includes('panne')) throw new Error('s3_head_echec:503')
      return { size: 1 }
    }
    const cles = [...Array.from({ length: 20 }, (_, i) => `o/d${i}/ok`), 'o/x/absent', 'o/y/panne']
    const r = await verifierPresence(cles, head, 4)
    expect(r).toMatchObject({ verifies: 22, presents: 20, erreurs: 1 })
    expect(r.manquants).toEqual(['o/x/absent'])
    expect(max).toBeLessThanOrEqual(4)
  })
})

describe('compte rendu de sauvegarde (POST /api/cron/sauvegarde-base)', () => {
  it('valide le rapport de l’agent et rejette tout le reste', () => {
    expect(parseRapportSauvegarde({ rapport: { statut: 'OK', code: 0, raison: 'scheduled', pointId: '20261004T020000Z-scheduled-1.0.4', tiers: 'daily,weekly', controleDocuments: 'ok' } }))
      .toEqual({ statut: 'OK', code: 0, raison: 'scheduled', pointId: '20261004T020000Z-scheduled-1.0.4', tiers: 'daily,weekly', controleDocuments: 'ok' })
    expect(parseRapportSauvegarde({ rapport: { statut: 'ECHEC', code: 20, raison: 'manual', pointId: '', tiers: '', controleDocuments: '' } }))
      .toEqual({ statut: 'ECHEC', code: 20, raison: 'manual' })
    expect(parseRapportSauvegarde(null)).toBeNull()
    expect(parseRapportSauvegarde({})).toBeNull()
    expect(parseRapportSauvegarde({ rapport: { statut: 'OK', code: 0, raison: 'hack' } })).toBeNull()
    expect(parseRapportSauvegarde({ rapport: { statut: 'OK', code: 999, raison: 'manual' } })).toBeNull()
    expect(parseRapportSauvegarde({ rapport: { statut: 'OK', code: 0, raison: 'manual', pointId: '../x' } })).toEqual({ statut: 'OK', code: 0, raison: 'manual' })
  })

  it('OK ⇒ 200 ; ECHEC ⇒ erreur au code stable (journal d’exécution en échec, alerte d’audit)', () => {
    expect(reponseRapportSauvegarde({ statut: 'OK', code: 0, raison: 'scheduled' })).toEqual({ status: 200, body: { ok: true, statut: 'OK', code: 0, raison: 'scheduled' } })
    expect(reponseRapportSauvegarde({ statut: 'ECHEC', code: 41, raison: 'scheduled' }).status).toBe(200)
    const e = reponseRapportSauvegarde({ statut: 'ECHEC', code: 20, raison: 'scheduled' })
    expect(e.status).toBe(502); expect(e.body).toMatchObject({ ok: false, error: 'sauvegarde_echec_20' })
  })
})
