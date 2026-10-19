// Lot H1.4 (docs/specs/scalabilite-haute-disponibilite.md) — scripts/update-ha.sh : mise à jour progressive du profil « ha ».
// Dépôt git réel (banc update-fixture) + `docker` simulé AVEC ÉTAT : conteneurs du service app (id, image, en marche,
// révision servie) et étiquettes d'images. Aucun vrai conteneur.
import { describe, it, expect, afterEach, vi } from 'vitest'
import { writeFileSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { makeInstance, type Instance } from '../../helpers/update-fixture'

vi.setConfig({ testTimeout: 120_000 })

const FAKE_DOCKER_HA = `#!/bin/bash
echo "$*" >> "$AUDIT_LOG"
a="$*"; F="$FAKE_DIR"; C="$F/containers"; T="$F/imgtags"
touch "$C" "$T"
f() { [ -e "$F/$1" ]; }
img_of_tag() { awk -v t="$1" '$1==t {print $2}' "$T" | head -1; }
rev_of_img() { awk -v i="$1" '$2==i {print $3}' "$T" | head -1; }
field() { awk -v c="$1" -v n="$2" '$1==c {print $n}' "$C"; }
case "$a" in
  "compose version --short") if f compose_old; then echo 2.20.0; else echo 2.29.1; fi ;;
  compose*" ps -a -q app") awk '{print $1}' "$C" ;;
  compose*" config -q") f config_fail && exit 1 ;;
  compose*" build app migrator") f build_fail && exit 1
    awk -v t="$ACRA_VERSION" '$1!=t' "$T" > "$T.n"; mv "$T.n" "$T"; echo "$ACRA_VERSION img-$ACRA_REVISION $ACRA_REVISION" >> "$T" ;;
  compose*" run --rm --no-deps migrator") echo "ENV MIGRATOR RESOLVE=\${ACRA_MIGRATE_AUTO_RESOLVE-unset}" >> "$AUDIT_LOG"; f migrate_fail && exit 1 ;;
  compose*" up -d --no-deps --no-build --no-recreate --scale app="*" app")
    echo "ENV ACRA_VERSION=$ACRA_VERSION" >> "$AUDIT_LOG"
    f scale_fail && exit 1
    k="\${a##*--scale app=}"; k="\${k%% *}"; img="$(img_of_tag "$ACRA_VERSION")"; [ -n "$img" ] || exit 1
    while [ "$(wc -l < "$C" | tr -d ' ')" -lt "$k" ]; do
      n=$(( $(cat "$F/next" 2>/dev/null || echo 10) + 1 )); echo "$n" > "$F/next"
      rev="$(rev_of_img "$img")"
      if [ "$img" != img-old ]; then m=$(( $(cat "$F/newcount" 2>/dev/null || echo 0) + 1 )); echo "$m" > "$F/newcount"
        if f bad_new_all || [ "$(cat "$F/bad_new_nth" 2>/dev/null)" = "$m" ]; then rev=bad; fi; fi
      echo "c$n $img true $rev" >> "$C"
    done ;;
  compose*" up -d --no-deps --no-build --force-recreate scheduler") ;;
  "inspect --format {{.Image}} "*) field "\${@: -1}" 2 ;;
  "inspect --format {{.State.Running}} "*) field "\${@: -1}" 3 ;;
  "image inspect --format {{.Id}} acra-app:"*) t="\${@: -1}"; i="$(img_of_tag "\${t#acra-app:}")"; [ -n "$i" ] || exit 1; echo "$i" ;;
  "image tag "*) t="\${@: -1}"; echo "\${t#acra-app:} $3 $(rev_of_img "$3")" >> "$T" ;;
  "image ls acra-app --format {{.Tag}}") awk '{print $1}' "$T" ;;
  "image rm "*) t="\${@: -1}"; awk -v t="\${t#acra-app:}" '$1!=t' "$T" > "$T.n"; mv "$T.n" "$T" ;;
  "exec "*" wget "*) c="$2"; rev="$(field "$c" 4)"
    if [ "$rev" = bad ]; then printf '{"status":"degraded","revision":"x"}'; else printf '{"status":"ok","revision":"%s","migrations":{"expected":1,"applied":1,"pending":[],"failed":[]}}' "$rev"; fi ;;
  "exec "*" touch /tmp/acra-drain") ;;
  "stop -t "*) ;;
  "rm -f "*) c="\${@: -1}"; awk -v c="$c" '$1!=c' "$C" > "$C.n"; mv "$C.n" "$C" ;;
esac
exit 0
`

let inst: Instance
afterEach(() => inst?.cleanup())
const ENV = { ACRA_HA_DRAIN_SECONDS: '0', ACRA_HA_STOP_TIMEOUT: '1' }
function setup(opts: { targetFiles?: Record<string, string> } = {}) {
  inst = makeInstance({ scripts: ['update-ha.sh'], targetFiles: opts.targetFiles })
  writeFileSync(path.join(inst.bin, 'docker'), FAKE_DOCKER_HA, { mode: 0o755 })
  inst.fakeFile('containers', `c1 img-old true ${inst.shaA}\nc2 img-old true ${inst.shaA}\nc3 img-old true ${inst.shaA}\n`)
  inst.fakeFile('imgtags', `dev img-old ${inst.shaA}\n`)
}
const run = (args: string[], env: Record<string, string> = {}) => inst.run('scripts/update-ha.sh', ['stable', '--yes', ...args], { ...ENV, ...env })
const containers = () => readFileSync(path.join(inst.fake, 'containers'), 'utf8').split('\n').filter(Boolean).map(l => l.split(' '))
const journal = () => JSON.parse(inst.read('.acra-update/ha/last.json'))
const idx = (c: string[], pred: (x: string) => boolean, from = 0) => c.findIndex((x, i) => i >= from && pred(x))

describe('update-ha.sh — mise à jour progressive réussie', () => {
  it('sauvegarde → build → migrations UNE fois → réplicas remplacés un par un (nouveau sain AVANT retrait d’un ancien)', () => {
    setup()
    const marker = path.join(inst.root, 'backup-done')
    const r = run(['--backup-cmd', `touch ${marker}`])
    expect(r.status, r.stderr + r.stdout).toBe(0)
    const c = inst.calls()
    const build = idx(c, x => x.endsWith('build app migrator'))
    const migrate = idx(c, x => x.endsWith('run --rm --no-deps migrator'))
    expect(build).toBeGreaterThanOrEqual(0)
    expect(migrate).toBeGreaterThan(build)
    expect(c.filter(x => x.endsWith('run --rm --no-deps migrator'))).toHaveLength(1)
    expect(c).toContain('ENV MIGRATOR RESOLVE=0')
    // Trois cycles : démarrer un nouveau (scale 4), santé du nouveau, drainer puis supprimer un ancien.
    const scales = c.filter(x => x.includes('--scale app='))
    expect(scales).toHaveLength(3)
    expect(scales.every(x => x.includes('--no-recreate') && x.includes('--no-build') && x.includes('--no-deps') && x.endsWith('--scale app=4 app'))).toBe(true)
    let from = migrate
    for (const old of ['c1', 'c2', 'c3']) {
      const up = idx(c, x => x.includes('--scale app='), from)
      const health = idx(c, x => /^exec c1\d wget/.test(x), up)
      const drain = idx(c, x => x === `exec ${old} touch /tmp/acra-drain`, up)
      const stop = idx(c, x => x.startsWith('stop -t 1 ' + old))
      const rm = idx(c, x => x === `rm -f ${old}`)
      expect(up, old).toBeGreaterThan(from)
      expect(health, old).toBeGreaterThan(up)
      expect(drain, old).toBeGreaterThan(health)
      expect(stop, old).toBeGreaterThan(drain)
      expect(rm, old).toBeGreaterThan(stop)
      from = rm
    }
    // Aucun arrêt global, aucune recréation des réplicas en service.
    expect(c.some(x => / (down|restart)\b/.test(x) || (x.includes(' up ') && x.includes(' app') && !x.includes('--no-recreate')))).toBe(false)
    expect(containers().map(x => x[1])).toEqual([`img-${inst.shaB}`, `img-${inst.shaB}`, `img-${inst.shaB}`])
    expect(inst.gitIn('rev-parse', 'HEAD')).toBe(inst.shaB)
    expect(journal()).toMatchObject({ state: 'DONE', code: null, from: { version: '1.0.4' }, to: { version: '1.0.5', sha: inst.shaB }, restorePoint: { kind: 'backup-cmd' } })
    expect(inst.read('.acra-update/ha/version.env')).toBe(`ACRA_VERSION=v1.0.5\nACRA_REVISION=${inst.shaB}\n`)
    expect(inst.read('.acra-update/events.log')).toMatch(/^HA_UPDATED 1\.0\.4 1\.0\.5 /m)
    expect(c.some(x => x.endsWith('--force-recreate scheduler'))).toBe(true)
    expect(readFileSync(marker, 'utf8')).toBe('')
    expect(c.some(x => x === 'image tag img-old acra-app:ha-rollback')).toBe(true)
  })
  it('--pitr-confirmed : l’instant précédant la migration est journalisé comme cible de restauration', () => {
    setup()
    const r = run(['--pitr-confirmed'])
    expect(r.status, r.stderr).toBe(0)
    const j = journal()
    expect(j.restorePoint.kind).toBe('pitr')
    expect(j.restorePoint.at).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/)
    expect(inst.read('.acra-update/events.log')).toMatch(/^HA_MIGRATED 1\.0\.4 1\.0\.5 pitr /m)
  })
  it('--replicas : passe de 2 à 3 réplicas pendant la mise à jour', () => {
    setup()
    inst.fakeFile('containers', `c1 img-old true ${inst.shaA}\nc2 img-old true ${inst.shaA}\n`)
    const r = run(['--pitr-confirmed', '--replicas', '3'])
    expect(r.status, r.stderr).toBe(0)
    expect(containers()).toHaveLength(3)
    expect(containers().every(x => x[1] === `img-${inst.shaB}`)).toBe(true)
  })
  it('--replicas : réduit de 5 à 1 réplica (retraits sans ajout une fois la cible atteinte)', () => {
    setup()
    inst.fakeFile('containers', [1, 2, 3, 4, 5].map(i => `c${i} img-old true ${inst.shaA}`).join('\n') + '\n')
    const r = run(['--pitr-confirmed', '--replicas', '1'])
    expect(r.status, r.stderr).toBe(0)
    expect(containers()).toHaveLength(1)
    expect(containers()[0][1]).toBe(`img-${inst.shaB}`)
  })
})

describe('update-ha.sh — refus avant toute modification', () => {
  it('sans point de restauration : refus no_restore_point', () => {
    setup()
    const r = run([])
    expect(r.status).not.toBe(0)
    expect(r.stderr).toMatch(/--backup-cmd|--pitr-confirmed/)
    expect(journal()).toMatchObject({ state: 'FAILED', code: 'no_restore_point' })
    expect(inst.calls().some(x => /build|migrator|--scale/.test(x))).toBe(false)
    expect(inst.gitIn('rev-parse', 'HEAD')).toBe(inst.shaA)
  })
  it('sauvegarde en échec : rien n’est modifié', () => {
    setup()
    const r = run(['--backup-cmd', 'false'])
    expect(r.status).not.toBe(0)
    expect(journal()).toMatchObject({ state: 'FAILED', code: 'backup_failed' })
    expect(inst.calls().some(x => /build|migrator|--scale/.test(x))).toBe(false)
    expect(inst.gitIn('rev-parse', 'HEAD')).toBe(inst.shaA)
  })
  it('fichiers compose sans le profil ha : renvoi vers update.sh', () => {
    setup()
    const r = run(['--pitr-confirmed'], { ACRA_COMPOSE_FILES: '-f docker-compose.yml -f docker-compose.production.yml' })
    expect(r.status).not.toBe(0)
    expect(journal().code).toBe('precheck_not_ha')
  })
  it('Docker Compose trop ancien (!reset / !override) : refus', () => {
    setup(); inst.fakeFile('compose_old')
    expect(run(['--pitr-confirmed']).status).not.toBe(0)
    expect(journal().code).toBe('precheck_compose')
  })
  it('réplicas sur des images différentes : refus precheck_mixed', () => {
    setup()
    inst.fakeFile('containers', `c1 img-old true ${inst.shaA}\nc2 img-autre true ${inst.shaA}\n`)
    expect(run(['--pitr-confirmed']).status).not.toBe(0)
    expect(journal().code).toBe('precheck_mixed')
    expect(inst.gitIn('rev-parse', 'HEAD')).toBe(inst.shaA)
  })
  it('migration « contract » entre les deux versions : refus sans --allow-contract, accepté avec', () => {
    setup({ targetFiles: { 'prisma/migrations/20300101000000_retrait/migration.sql': '-- acra:destructive colonne remplacée\n-- contract: "x" n\'est plus lu depuis la 1.0.3\nALTER TABLE "A" DROP COLUMN "x";\n' } })
    const r = run(['--pitr-confirmed'])
    expect(r.status).not.toBe(0)
    expect(r.stderr).toContain('20300101000000_retrait')
    expect(journal().code).toBe('contract_in_range')
    expect(inst.calls().some(x => /build|migrator/.test(x))).toBe(false)
    const ok = run(['--pitr-confirmed', '--allow-contract'])
    expect(ok.status, ok.stderr).toBe(0)
    expect(journal().state).toBe('DONE')
  })
  it('construction en échec : code d’origine rétabli, réplicas intacts, aucune migration', () => {
    setup(); inst.fakeFile('build_fail')
    expect(run(['--pitr-confirmed']).status).not.toBe(0)
    expect(journal().code).toBe('build_failed')
    expect(inst.gitIn('rev-parse', 'HEAD')).toBe(inst.shaA)
    expect(inst.calls().some(x => x.includes('migrator') && x.includes('run'))).toBe(false)
    expect(containers().map(x => x[0])).toEqual(['c1', 'c2', 'c3'])
  })
})

describe('update-ha.sh — échecs après le début', () => {
  it('migration en échec : ancienne version toujours en service (réplicas intacts), code rétabli, base NON restaurée', () => {
    setup(); inst.fakeFile('migrate_fail')
    const r = run(['--pitr-confirmed'])
    expect(r.status).not.toBe(0)
    expect(journal()).toMatchObject({ state: 'FAILED', code: 'migrate_failed' })
    expect(r.stderr).toMatch(/PAS restaurée/)
    expect(inst.gitIn('rev-parse', 'HEAD')).toBe(inst.shaA)
    expect(containers().map(x => x[0])).toEqual(['c1', 'c2', 'c3'])
    expect(inst.calls().some(x => x.includes('--scale') || x.startsWith('stop') || x.startsWith('rm '))).toBe(false)
  })
  it('premier réplica nouveau non sain : supprimé, anciens jamais retirés, retour arrière sans interruption', () => {
    setup(); inst.fakeFile('bad_new_all')
    const r = run(['--pitr-confirmed'])
    expect(r.status).not.toBe(0)
    expect(journal()).toMatchObject({ state: 'ROLLED_BACK', code: 'health_failed' })
    expect(containers().map(x => x[0])).toEqual(['c1', 'c2', 'c3'])
    expect(inst.calls().some(x => /touch \/tmp\/acra-drain/.test(x) && /exec c[123] /.test(x))).toBe(false)
    expect(inst.gitIn('rev-parse', 'HEAD')).toBe(inst.shaA)
    expect(inst.read('.acra-update/events.log')).toMatch(/^HA_ROLLED_BACK 1\.0\.5 1\.0\.4 health_failed /m)
  })
  it('deuxième réplica nouveau non sain : le réplica déjà remplacé revient à l’ancienne image, un par un', () => {
    setup(); inst.fakeFile('bad_new_nth', '2')
    const r = run(['--pitr-confirmed'])
    expect(r.status, r.stdout).not.toBe(0)
    expect(journal()).toMatchObject({ state: 'ROLLED_BACK', code: 'health_failed' })
    const final = containers()
    expect(final).toHaveLength(3)
    expect(final.every(x => x[1] === 'img-old')).toBe(true)
    const c = inst.calls()
    // Le retour arrière démarre l'image conservée (étiquette ha-rollback) AVANT de retirer le réplica de la version cible.
    const back = idx(c, x => x === 'ENV ACRA_VERSION=ha-rollback')
    expect(back).toBeGreaterThan(0)
    const newOk = c.find(x => /^rm -f c1\d$/.test(x) && idx(c, y => y === x) > back)
    expect(newOk).toBeTruthy()
    expect(inst.gitIn('rev-parse', 'HEAD')).toBe(inst.shaA)
  })
})
