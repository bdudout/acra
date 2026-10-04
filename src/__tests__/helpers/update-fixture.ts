// Banc d'essai des scripts de mise à jour (update.sh, acra-snapshot.sh, update-agent.sh) : un dépôt git temporaire réel
// (origine nue + clone de travail), un `docker` simulé en tête du PATH et un journal d'appels (AUDIT_LOG).
// Le `docker` simulé est piloté par des fichiers du dossier FAKE_DIR (voir FAKE_DOCKER) — aucun vrai conteneur.
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, copyFileSync, rmSync, chmodSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync, execFileSync } from 'node:child_process'

const REPO = process.cwd()
const GIT_ENV = { GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' }
const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, env: { ...process.env, ...GIT_ENV }, encoding: 'utf8' }).trim()

/** `docker` simulé : consigne ses appels et répond selon les fichiers de FAKE_DIR. */
export const FAKE_DOCKER = `#!/bin/bash
echo "$*" >> "$AUDIT_LOG"
a="$*"
f() { [ -e "$FAKE_DIR/$1" ]; }
case "$a" in
  *"config --services"*) if f services; then cat "$FAKE_DIR/services"; else printf 'db\\napp\\nscheduler\\nbackup\\nmigrator\\n'; fi ;;
  *"ps --status running --services"*) if f running; then cat "$FAKE_DIR/running"; else printf 'db\\napp\\n'; fi ;;
  *"ps -q app"*) f no_app_container || echo cid123 ;;
  inspect*) f mounts && cat "$FAKE_DIR/mounts" ;;
  cp\\ *) dest="\${@: -1}"; mkdir -p "$dest"; echo rescued > "$dest/doc1.txt" ;;
  *"compose"*" cp "*) f rescue_copy_fail && exit 1 ;;
  *"printenv POSTGRES_DB"*) echo acra_rm ;;
  *"df -Pk"*) printf 'Filesystem 1024-blocks Used Available Capacity Mounted\nx 1 1 %s 1%% /\n' "$(cat "$FAKE_DIR/pg_free" 2>/dev/null || echo 99999999)" ;;
  *"psql -U"*|*"psql -d"*)
    sql="\${@: -1}"
    case "$sql" in
      *pg_terminate_backend*) ;;
      *pg_database_size*) cat "$FAKE_DIR/dbsize" 2>/dev/null || echo 1000000 ;;
      *pg_stat_activity*) cat "$FAKE_DIR/activity" 2>/dev/null || echo 0 ;;
      *server_version_num*) echo 160004 ;;
      *"SHOW server_version"*) echo 16.4 ;;
      *"migration_name||checksum"*) printf 'm1abc\nm2def\n' ;;
      *"migration_name FROM"*) echo 20261003110000_x ;;
      *"FROM \"AuditLog\" WHERE"*) cat "$FAKE_DIR/later" 2>/dev/null || echo 2 ;;
      *"count(*) FROM"*) t="$(printf '%s' "$sql" | sed 's/.*FROM "\\(.*\\)".*/\\1/')"
        if [ -e "$FAKE_DIR/renamed" ] && [ -e "$FAKE_DIR/rows2_$t" ]; then cat "$FAKE_DIR/rows2_$t"; elif [ -e "$FAKE_DIR/rows_$t" ]; then cat "$FAKE_DIR/rows_$t"; else echo 5; fi ;;
      *"CREATE DATABASE"*__snap_*) [ -e "$FAKE_DIR/clone_fail" ] && exit 1 ;;
      *"FROM pg_database WHERE datname LIKE"*) cat "$FAKE_DIR/dblist" 2>/dev/null ;;
      *"FROM pg_database WHERE datname"*) cat "$FAKE_DIR/clone_exists" 2>/dev/null || echo 1 ;;
      *"RENAME TO"*__failed_*) : > "$FAKE_DIR/renamed" ;;
    esac ;;
  *"pg_restore -U"*|*"pg_restore -d"*) cat > /dev/null; f restore_fail && exit 1 ;;
  *"du -sk"*) cat "$FAKE_DIR/docs_kb" 2>/dev/null || echo 100 ;;
  *"find /app/.data"*) cat "$FAKE_DIR/docs_files" 2>/dev/null || echo 3 ;;
  *"pg_dump"*) if f dump_fail; then printf 'PARTIAL'; exit 1; fi; if f dump; then cat "$FAKE_DIR/dump"; else printf 'PGDMP-FAKE'; fi ;;
  *"pg_restore --list"*) cat > /dev/null; if f list_fail; then exit 1; fi; if f restore_list_many; then exec awk 'BEGIN { print "; Archive"; print "123; 0 0 TABLE DATA public User x"; for (n = 1; n <= 100000; n++) print "999; 0 0 COMMENT public filler-" n }'; elif f restore_list; then cat "$FAKE_DIR/restore_list"; else printf '; Archive\\n123; 0 0 TABLE DATA public User x\\n'; fi ;;
  *"run --rm"*"tar"*) f tar_fail && exit 1; printf 'docs' | gzip ;;
  *wget*) case "$a" in *" -S "*) f smoke_fail || echo "  HTTP/1.1 200 OK" >&2 ;; *) if f health_json; then cat "$FAKE_DIR/health_json"; else rev="$(cat "$FAKE_DIR/health_stuck" 2>/dev/null || cat "$FAKE_DIR/served_rev" 2>/dev/null || cat "$FAKE_DIR/health_rev" 2>/dev/null || echo unknown)"; printf '{"status":"ok","db":"connected","version":"x","revision":"%s"}' "$rev"; fi ;; esac ;;
  *"run --rm --no-deps migrator"*) echo "ENV MIGRATOR RESOLVE=\${ACRA_MIGRATE_AUTO_RESOLVE-unset}" >> "$AUDIT_LOG"; f migrate_fail && exit 1 ;;
  *"up -d"*) echo "ENV ACRA_VERSION=$ACRA_VERSION ACRA_REVISION=$ACRA_REVISION RESOLVE=\${ACRA_MIGRATE_AUTO_RESOLVE-unset}" >> "$AUDIT_LOG"; f up_fail && exit 1; if [ -n "$ACRA_REVISION" ] && ! f no_serve; then printf '%s' "$ACRA_REVISION" > "$FAKE_DIR/served_rev"; fi ;;
esac
exit 0
`

export interface Instance {
  root: string; work: string; bin: string; fake: string; audit: string
  shaA: string; shaB: string
  run(script: string, args: string[], env?: Record<string, string>): { status: number | null; stdout: string; stderr: string }
  calls(): string[]
  fakeFile(name: string, content?: string): void
  read(rel: string): string
  exists(rel: string): boolean
  gitIn(...args: string[]): string
  cleanup(): void
}

/** Origine nue + clone sur la version A (1.0.4) ; la version B (1.0.5) est publiée sur origin/stable. `scripts` : scripts réels à copier. */
export function makeInstance(opts: { scripts?: string[]; extraFiles?: Record<string, string>; targetFiles?: Record<string, string> } = {}): Instance {
  const root = mkdtempSync(path.join(tmpdir(), 'acra-upd-'))
  const origin = path.join(root, 'origin.git'); const work = path.join(root, 'work'); const bin = path.join(root, 'bin'); const fake = path.join(root, 'fake')
  mkdirSync(bin); mkdirSync(fake)
  git(root, 'init', '-q', '--bare', '-b', 'stable', origin)
  const commit = (dir: string, version: string, extra: Record<string, string> = {}) => {
    writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'acra', version }, null, 2))
    mkdirSync(path.join(dir, 'scripts'), { recursive: true })
    for (const s of opts.scripts ?? ['update.sh', 'update-lib.sh', 'update-steps.sh', 'acra-snapshot.sh']) { if (existsSync(path.join(REPO, 'scripts', s))) copyFileSync(path.join(REPO, 'scripts', s), path.join(dir, 'scripts', s)); chmodSync(path.join(dir, 'scripts', s), 0o755) }
    for (const [rel, c] of Object.entries({ ...opts.extraFiles, ...extra })) { mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); writeFileSync(path.join(dir, rel), c) }
    git(dir, 'add', '-A'); git(dir, 'commit', '-q', '-m', `v${version}`)
  }
  git(root, 'clone', '-q', origin, work); git(work, 'checkout', '-q', '-b', 'stable')
  commit(work, '1.0.4'); git(work, 'push', '-q', 'origin', 'stable')
  const shaA = git(work, 'rev-parse', 'HEAD')
  const other = path.join(root, 'other'); git(root, 'clone', '-q', origin, other); git(other, 'checkout', '-q', 'stable')
  commit(other, '1.0.5', { 'CHANGED.txt': 'b', ...opts.targetFiles }); git(other, 'push', '-q', 'origin', 'stable')
  const shaB = git(other, 'rev-parse', 'HEAD')
  writeFileSync(path.join(bin, 'docker'), FAKE_DOCKER, { mode: 0o755 })
  writeFileSync(path.join(bin, 'df'), '#!/bin/sh\nprintf "Filesystem 1024-blocks Used Available Capacity Mounted\\nx 1 1 %s 1%% /\\n" "$(cat "$FAKE_DIR/df_host" 2>/dev/null || echo 99999999)"\n', { mode: 0o755 })
  writeFileSync(path.join(fake, 'served_rev'), shaA)
  const audit = path.join(root, 'calls'); writeFileSync(audit, '')
  const env = (extra: Record<string, string> = {}) => ({ ...process.env, ...GIT_ENV, PATH: `${bin}:${process.env.PATH}`, AUDIT_LOG: audit, FAKE_DIR: fake, ACRA_HEALTH_RETRIES: '2', ACRA_HEALTH_INTERVAL: '0', ...extra })
  return {
    root, work, bin, fake, audit, shaA, shaB,
    run: (script, args, extra) => { const r = spawnSync('bash', [path.isAbsolute(script) ? script : path.join(work, script), ...args], { cwd: work, env: env(extra), encoding: 'utf8', timeout: 60_000 }); return { status: r.status, stdout: r.stdout, stderr: r.stderr } },
    calls: () => readFileSync(audit, 'utf8').split('\n').filter(Boolean),
    fakeFile: (name, content = '1') => writeFileSync(path.join(fake, name), content),
    read: rel => readFileSync(path.join(work, rel), 'utf8'),
    exists: rel => existsSync(path.join(work, rel)),
    gitIn: (...args) => git(work, ...args),
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  }
}
export const listDir = (d: string) => (existsSync(d) ? readdirSync(d) : [])
