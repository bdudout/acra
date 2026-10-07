# Spec de réalisation — point de restauration avant mise à jour et retour arrière

Date : 2026-10-03 · Statut : **développée (lots 0 à 7, sans validation sur Docker réel — voir `docs/HANDOFF.md` entrée 59)** (décisions D1–D5 de l'étude prises par défaut,
modifiables) · Destinataire : agent de développement (Sonnet 5.5) · Étude et ADR :
[`sauvegarde-rollback-etude.md`](sauvegarde-rollback-etude.md).

Lire avant de commencer : skill `acra-engineering` (§ 1 collaboration, § 4 TDD, § 5 définition de
« terminé », § 6 revue de sécurité), `docs/runbook-exploitation.md`, `scripts/update.sh`,
`scripts/update-agent.sh`, `scripts/deploy-release.sh`, `src/lib/update-request*.ts`,
`src/app/api/admin/version/update/route.ts`, `src/components/VersionCard.tsx`,
`src/__tests__/unit/lib/deploy-release.test.ts` (modèle de test d'un script shell avec `docker`
simulé dans le `PATH`).

---

## 0. Règles communes à tous les lots

- **TDD** : test d'abord. Les scripts shell sont testés par Vitest avec des exécutables simulés
  (`bin/docker`, `bin/git`, `bin/pg_dump`, `bin/df`…) placés en tête du `PATH`, qui consignent leurs
  appels dans un fichier (`AUDIT_LOG`) et renvoient des sorties scriptées — exactement comme
  `deploy-release.test.ts`. La logique décidable (validation d'identifiant, classement d'une
  migration, transitions de la machine à états, lecture d'un manifeste) est écrite en **TypeScript
  pur** sous `src/lib/` et testée en unitaire ; les scripts shell n'appellent du Node que là où
  c'est indiqué.
- **Shell** : `bash` ≥ 4 (déjà requis), `set -Eeuo pipefail`, `umask 077`, guillemets partout,
  `shellcheck` sans avertissement (ajouter `npx shellcheck` n'est pas requis : vérifier avec
  `shellcheck` si présent, sinon relecture). Compatible GNU **et** BSD (`sha256sum` ou
  `shasum -a 256` ; `stat` : détecter la variante ; `date -u +%Y%m%dT%H%M%SZ`).
- **Jamais** de secret dans un journal, un manifeste, un statut ou un nom de fichier.
- **i18n ×5** pour toute chaîne affichée par l'application (fr, en, de, es, it) ; les scripts
  écrivent en français (comme aujourd'hui) et publient des **codes** stables dans les statuts JSON ;
  c'est l'application qui traduit les codes.
- Chaque lot = un ou plusieurs commits `feat(update): …` / `fix(update): …` ; `docs/HANDOFF.md`
  mis à jour en fin de tour.
- Vérifications minimales par lot : `npx tsc --noEmit -p tsconfig.json`, `npm test`,
  `npm run i18n:check` si des clés sont ajoutées, `npm run build` si une route change, plus les
  scénarios réels décrits dans le lot.

---

## Lot 0 — Correctifs urgents dans le `update.sh` actuel (à livrer en premier, seul)

Objectif : que les clients qui installent **maintenant** soient protégés lors de leur **prochaine**
mise à jour, même si les lots suivants ne sont pas encore livrés (constat C14).

### 0.1 Documents persistants (C1)

`docker-compose.yml`, service `app` :

```yaml
    volumes:
      - ./.acra-update:/app/.acra-update
      - documents_data:/app/.data/documents
```

et `documents_data: { driver: local }` dans `volumes:`. Vérifier que `docker-compose.release.yml`
garde le même nom (`documents_data`) : il le déclare déjà, Compose fusionne.

**Sauvetage obligatoire** (sinon la correction elle-même perd les fichiers existants, puisqu'elle
recrée le conteneur) — dans `update.sh`, **avant** tout `up -d` :

```bash
# Instance antérieure sans volume de documents : copier les fichiers hors du conteneur.
rescue_documents() {
  local cid; cid="$("${COMPOSE[@]}" ps -q app 2>/dev/null || true)"
  [ -n "$cid" ] || return 0
  # Un montage existe déjà à cet endroit → rien à sauver.
  if docker inspect -f '{{range .Mounts}}{{.Destination}}{{"\n"}}{{end}}' "$cid" | grep -qx /app/.data/documents; then return 0; fi
  mkdir -p "$SNAP_DIR"
  docker cp "$cid:/app/.data/documents" "$SNAP_DIR/documents-rescue" 2>/dev/null || return 0
  echo "Documents sauvés hors du conteneur : $SNAP_DIR/documents-rescue"
  RESCUED=1
}
```

Après `up -d` (le nouveau conteneur a le volume), si `RESCUED=1` :

```bash
"${COMPOSE[@]}" cp "$SNAP_DIR/documents-rescue/." app:/app/.data/documents/
"${COMPOSE[@]}" exec -T -u 0 app chown -R 1001:1001 /app/.data/documents
```

Test (Vitest, docker simulé) : `docker inspect` sans montage → `docker cp` appelé avant `up`, puis
`compose cp` après ; avec montage → aucun `docker cp`.

### 0.2 Application arrêtée, sauvegarde vérifiée et protégée (C2, C3, C10)

Dans `update.sh`, remplacer le bloc de sauvegarde par :

1. `umask 077` en tête du script ; dossier `backups/` en `0700`.
2. Avant la sauvegarde : `"${COMPOSE[@]}" stop app scheduler backup` (ignorer les services absents :
   `--ignore-missing` n'existe pas → filtrer avec `"${COMPOSE[@]}" config --services`).
3. Sauvegarde **format custom** : `pg_dump -Fc -U "$POSTGRES_USER" "$POSTGRES_DB"` (dans le
   conteneur `db`) vers `backups/pre-update-<horodatage>-<from>.dump`.
4. Vérification : `"${COMPOSE[@]}" exec -T db pg_restore --list < "$BACKUP" > /dev/null` ; échec ⇒
   `fail` **et redémarrage de l'ancienne application** (`up -d --no-build app scheduler backup`)
   — on ne laisse jamais l'instance arrêtée parce que la sauvegarde a échoué.
5. Taille non nulle **et** liste non vide (`pg_restore --list | grep -c 'TABLE DATA' ≥ 1`).
6. Sauvegarde des documents : `"${COMPOSE[@]}" run --rm --no-deps --entrypoint tar app -C /app/.data -czf - documents > backups/…-documents.tar.gz` puis `gzip -t` (si le volume existe ; sinon le sauvetage 0.1 en tient lieu).
7. Le message d'échec final donne la **commande de restauration exacte** (fonction `print_restore_help`) :
   ```
   docker compose stop app scheduler
   docker compose exec -T db sh -c 'dropdb -U "$POSTGRES_USER" --if-exists "$POSTGRES_DB" && createdb -U "$POSTGRES_USER" "$POSTGRES_DB"'
   docker compose exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --exit-on-error' < <dump>
   git checkout <FROM_SHA> && docker compose up -d --build
   ```

### 0.3 Pas de réconciliation automatique pendant une mise à jour (C8)

`scripts/migrate-recover.sh` : si `ACRA_MIGRATE_AUTO_RESOLVE=0`, ne jamais appeler
`migrate resolve` (sauter directement à `migrate deploy`). `docker-compose.yml` service `migrator` :
`environment: ACRA_MIGRATE_AUTO_RESOLVE: ${ACRA_MIGRATE_AUTO_RESOLVE:-1}` (défaut inchangé au
démarrage normal). `update.sh` exporte `ACRA_MIGRATE_AUTO_RESOLVE=0` pour son `up`.

### 0.4 Version et révision servies (C13, mode A)

`docker-compose.yml`, `app.build.args` : `ACRA_VERSION: ${ACRA_VERSION:-development}`,
`ACRA_REVISION: ${ACRA_REVISION:-unknown}`. `update.sh` exporte `ACRA_VERSION=v$TO` et
`ACRA_REVISION=$TARGET_SHA` avant `up -d --build`, puis le contrôle de santé vérifie que
`/api/health` renvoie **cette** révision (sinon c'est l'ancien conteneur qui répond).

### Critères d'acceptation du lot 0

- [ ] Sur une instance de test lancée avec l'**ancien** `docker-compose.yml`, un document téléversé
      est toujours présent après `scripts/update.sh beta` (scénario réel, Docker).
- [ ] Une sauvegarde tronquée (simulée : `pg_dump` qui sort en erreur après écriture partielle)
      arrête la mise à jour, l'ancienne application redémarre, aucun `git merge` n'a eu lieu.
- [ ] Fichiers de `backups/` en `0600`, dossier en `0700`.
- [ ] Notes de release de la version qui livre ce lot : rubrique « Mettre à jour » expliquant le
      sauvetage des documents.

---

## Lot 1 — `scripts/acra-snapshot.sh` (points de restauration)

### 1.1 Interface

```
scripts/acra-snapshot.sh create  --reason pre-update|manual [--from-version V] [--to-version V] [--verify full|quick] [--no-clone] [--json]
scripts/acra-snapshot.sh verify  <id> [--full]
scripts/acra-snapshot.sh list    [--json]
scripts/acra-snapshot.sh restore <id> [--yes] [--keep-current]      # base + documents ; ne touche pas au code
scripts/acra-snapshot.sh prune   [--keep N] [--dry-run]
scripts/acra-snapshot.sh index                                        # régénère .acra-update/snapshots.json
```

Codes de sortie : `0` succès · `2` usage · `10` prérequis (Docker, service db, droits) ·
`11` espace disque insuffisant · `20` dump en échec · `21` vérification en échec ·
`22` clone en échec (non bloquant pour `create` : journalisé, code 0) · `30` restauration en échec ·
`31` identifiant inconnu · `32` empreinte de clé différente (voir 1.5) · `40` verrou détenu.

Variables : `ACRA_BACKUP_DIR` (défaut `./backups`), `ACRA_COMPOSE_FILES`, `ACRA_SNAPSHOT_VERIFY`
(`full` défaut si base ≤ `ACRA_SNAPSHOT_FULL_MAX_MB`=2048, sinon `quick`),
`ACRA_SNAPSHOT_KEEP` (3), `ACRA_FAILED_DB_RETENTION_DAYS` (14),
`ACRA_BACKUP_AGE_RECIPIENT` (optionnel, clé publique `age1…`), `ACRA_DB_MODE` (`compose` défaut |
`url` pour base externe, lot 6).

Verrou : `mkdir "$ACRA_BACKUP_DIR/.lock"` (atomique, portable) + `trap` de libération ; le même
verrou est pris par `update.sh` (pas de point de restauration concurrent d'une mise à jour).

### 1.2 Identifiant et arborescence

Identifiant : `<YYYYMMDDTHHMMSSZ>-<reason>-<fromVersion>` ; validé par
`^[0-9]{8}T[0-9]{6}Z-(pre-update|manual)-[0-9A-Za-z.+-]{1,40}$` (même expression dans le script et
dans `src/lib/snapshot.ts` — test de parité qui lit le script et compare la chaîne).

```
backups/                                   (0700)
  20261003T101500Z-pre-update-1.0.4/       (0700)
    manifest.json                          (0600)
    database.dump        | database.dump.age     (0600)  pg_dump -Fc
    documents.tar.gz     | documents.tar.gz.age  (0600)  absent si stockage S3 ou dossier vide (consigné)
    SHA256SUMS                             (0600)  empreintes des fichiers ci-dessus
    create.log                             (0600)
  .lock/
```

Clone de base (ADR-001 B) : base `<POSTGRES_DB>__snap_<YYYYMMDDTHHMMSSZ>` dans le même serveur
(nom ≤ 63 caractères : tronquer `POSTGRES_DB` à 40).

### 1.3 Manifeste (`manifest.json`, schéma v1)

```json
{
  "schema": 1,
  "id": "20261003T101500Z-pre-update-1.0.4",
  "reason": "pre-update",
  "createdAt": "2026-10-03T10:15:00Z",
  "acra": { "version": "1.0.4", "revision": "<sha git 40>", "image": "ghcr.io/…@sha256:… | null", "channel": "stable|beta|null", "toVersion": "1.0.5|null" },
  "database": {
    "mode": "compose|url",
    "serverVersion": "16.4",
    "name": "acra_rm",
    "sizeBytes": 123456789,
    "dumpFile": "database.dump", "dumpBytes": 23456789, "encrypted": false,
    "clone": "acra_rm__snap_20261003T101500Z | null",
    "migrations": { "count": 176, "last": "20261003110000_appetence_snapshot", "hash": "<sha256 des noms+checksums de _prisma_migrations, triés>", "failed": [] },
    "rowCounts": { "User": 12, "Organization": 3, "Analyse": 41, "Risque": 512, "PlanAction": 88, "AuditLog": 20311, "Document": 64, "_prisma_migrations": 176 }
  },
  "documents": { "storage": "local|s3", "included": true, "files": 64, "bytes": 98765432, "archive": "documents.tar.gz" },
  "secretsKeyFingerprint": "<12 premiers caractères hex de sha256(SECRETS_ENCRYPTION_KEY) | null>",
  "verification": { "level": "full|quick", "at": "…", "ok": true, "restoredRowCounts": { "…": 0 } },
  "host": { "composeFiles": "-f docker-compose.yml -f docker-compose.production.yml" }
}
```

- `rowCounts` : liste **fixe** de tables (constante partagée `SNAPSHOT_COUNTED_TABLES` dans
  `src/lib/snapshot.ts`, recopiée dans le script ; test de parité). Requête :
  `SELECT count(*) FROM "<Table>"` via `psql -tAc`, table absente ⇒ `null` (pas d'échec : une table
  peut ne pas exister dans une ancienne version).
- `secretsKeyFingerprint` : lu depuis `.env` sur l'hôte (`SECRETS_ENCRYPTION_KEY=`), haché par
  `sha256sum`, tronqué à 12 caractères. Jamais la clé.
- Le manifeste est écrit **en dernier** (après vérification) : un dossier sans manifeste est un
  point de restauration **incomplet**, ignoré par `list` et supprimé par `prune`.

### 1.4 Algorithme de `create`

1. Prérequis : `docker compose … ps` répond ; service `db` sain ; `ACRA_BACKUP_DIR` inscriptible.
2. Mesures : taille de la base (`SELECT pg_database_size(current_database())`), taille des
   documents (`du -sb` dans le conteneur, ou 0), espace libre de `ACRA_BACKUP_DIR` (`df -Pk`) et du
   volume PostgreSQL (`df -Pk /var/lib/postgresql/data` dans `db`).
3. **Espace** : refuser (code 11) si libre(`ACRA_BACKUP_DIR`) < 1,2 × (taille base × 0,6 + documents)
   + 200 Mo. Clone : seulement si libre(volume PG) ≥ 1,3 × taille base + 500 Mo, sinon
   `clone: null` et message « clone sauté : espace insuffisant ».
4. Le script **n'arrête pas** lui-même l'application (c'est le rôle de `update.sh`, étape
   QUIESCE) mais **refuse** de créer un point `pre-update` si `pg_stat_activity` montre des
   connexions applicatives sur la base (`datname = $POSTGRES_DB AND pid <> pg_backend_pid()`) ;
   pour `--reason manual`, il avertit seulement (dump cohérent quand même : `pg_dump` est
   transactionnel).
5. Dump : `docker compose exec -T db sh -c 'pg_dump -Fc -Z 6 -U "$POSTGRES_USER" "$POSTGRES_DB"' > database.dump` ; code de retour du `pg_dump` vérifié (`set -o pipefail`).
6. Clone (si retenu) : sur la base `postgres` :
   `CREATE DATABASE "<clone>" TEMPLATE "<db>" STRATEGY FILE_COPY;` — échec ⇒ journaliser, `clone: null`, continuer.
7. Documents : stockage `local` ⇒ `tar -czf` depuis le volume (commande du lot 0) puis `gzip -t` ;
   `s3` ⇒ `included: false`.
8. Chiffrement (si `ACRA_BACKUP_AGE_RECIPIENT`) : `age -r "$R" -o database.dump.age database.dump`
   puis suppression du clair ; `age` absent ⇒ code 10 (on ne dégrade pas silencieusement une
   exigence de chiffrement demandée).
9. `SHA256SUMS`.
10. Vérification (1.6).
11. Manifeste, puis `index` (1.8). Sortie : l'identifiant sur stdout (ou le manifeste si `--json`).

### 1.5 Algorithme de `restore <id>`

Utilisé par le retour arrière (lots 2–3) et par l'exploitant.

1. `id` valide et présent, manifeste lisible, `SHA256SUMS` vérifié (sinon 21).
2. Empreinte de clé : si `secretsKeyFingerprint` ≠ empreinte actuelle ⇒ code 32 sauf `--yes`
   (message : « la clé de chiffrement des secrets a changé depuis ce point ; les secrets stockés
   (SMTP, SSO, SIEM, jetons) seront illisibles »).
3. Confirmation interactive (sauf `--yes`) affichant version, date, nombre d'écritures du journal
   d'audit **postérieures** au point (`SELECT count(*) FROM "AuditLog" WHERE "createdAt" > <createdAt>`).
4. Arrêt : `stop app scheduler backup cron` (services existants seulement).
5. Couper les connexions résiduelles : `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '<db>' AND pid <> pg_backend_pid();`
6. Conserver la base courante : `ALTER DATABASE "<db>" RENAME TO "<db>__failed_<horodatage>"`.
   Toujours : la base courante est renommée, jamais supprimée ici (F7) ; `--keep-current` la
   marque en plus comme exclue de la purge automatique (fichier `keep` dans le dossier du point).
7. Remise en place :
   - clone présent et existant ⇒ `ALTER DATABASE "<clone>" RENAME TO "<db>"` ; le clone est
     consommé et n'est pas recréé (le point garde son dump ; `clone` passe à `null` dans le
     manifeste, réécrit atomiquement) ;
   - sinon ⇒ `createdb "<db>"` puis `pg_restore -d "<db>" --no-owner --exit-on-error < database.dump`
     (déchiffré à la volée par `age -d` si chiffré, clé privée via `ACRA_BACKUP_AGE_IDENTITY`).
8. Contrôle : comptes de lignes == `rowCounts` du manifeste (tables non nulles) ; écart ⇒ code 30
   **et** remise de la base renommée à l'étape 6 (`RENAME` inverse) pour ne pas laisser
   l'instance sans base.
9. Documents (`included: true`) : vider le volume puis extraire l'archive
   (`run --rm --no-deps --entrypoint sh app -c 'rm -rf /app/.data/documents/* && tar -xzf - -C /app/.data'` alimenté par l'archive), propriétaire 1001.
10. Ne redémarre **pas** l'application (c'est l'appelant qui choisit le code à démarrer).
11. Journal : `restore.log` dans le dossier du point ; ligne `RESTORED <id> <horodatage>` ajoutée à
    `.acra-update/events.log` (lu par l'application, lot 4).

### 1.6 Vérification

- `quick` : `sha256sum -c SHA256SUMS` ; `pg_restore --list` lisible et contenant au moins une
  entrée `TABLE DATA` ; `gzip -t` de l'archive des documents.
- `full` : `quick` + restauration d'essai dans `<db>__verify_<horodatage>` (`createdb`,
  `pg_restore --exit-on-error`), comparaison des comptes de lignes avec les comptes mesurés au
  moment du dump, puis `dropdb` (toujours, même en échec : `trap`). Résultat dans
  `verification.restoredRowCounts`.
- Échec de vérification ⇒ dossier renommé `<id>.invalid` (jamais utilisé, purgé par `prune`), code 21.

### 1.7 `prune`

Garde : les `ACRA_SNAPSHOT_KEEP` derniers points `pre-update` valides ; **toujours** le point
référencé par `.acra-update/run/current.json` (mise à jour non confirmée) ; tous les `manual`
(purge manuelle seulement, avec `--include-manual`). Supprime : dossiers `.invalid`, dossiers
sans manifeste de plus de 24 h, clones (`__snap_`) dont le point n'existe plus, bases `__failed_`
plus vieilles que `ACRA_FAILED_DB_RETENTION_DAYS`, bases `__verify_` orphelines. `--dry-run` liste
sans rien faire. Appelé à la fin de chaque mise à jour **réussie**.

### 1.8 Index publié pour l'application

`.acra-update/snapshots.json` (0644, ≤ 64 Ko, écrit atomiquement par fichier temporaire + `mv`) :

```json
{ "schema": 1, "generatedAt": "…", "snapshots": [
  { "id": "…", "reason": "pre-update", "createdAt": "…", "version": "1.0.4", "toVersion": "1.0.5",
    "verified": "full", "clone": true, "documents": true, "encrypted": false, "sizeBytes": 23456789 } ] }
```

Aucun chemin, aucun nom de base, aucune empreinte : seulement ce que l'interface affiche.

### Tests du lot 1

`src/__tests__/unit/lib/acra-snapshot-script.test.ts` (docker/psql simulés) :
- `create` refuse un `pre-update` si des connexions applicatives sont ouvertes ;
- `create` saute le clone quand l'espace du volume PostgreSQL est insuffisant, réussit quand même ;
- `create` refuse (11) si l'espace de `ACRA_BACKUP_DIR` est insuffisant, sans fichier résiduel ;
- vérification `quick` en échec (somme altérée) ⇒ dossier `.invalid`, code 21 ;
- le manifeste est écrit en dernier (simuler un échec après le dump : pas de `manifest.json`) ;
- `restore` renomme toujours la base courante en `__failed_` et la remet en place si les comptes
  divergent ;
- `restore` refuse (32) quand l'empreinte de clé diffère, accepte avec `--yes` ;
- `prune` garde le point de `current.json` et les `manual` ;
- identifiant invalide (`../x`, `;rm`) ⇒ code 31 sans aucun appel `docker`.

`src/__tests__/unit/lib/snapshot.test.ts` (pur) : `isSnapshotId`, `parseSnapshotIndex`
(assainissement, champs inconnus ignorés, 64 Ko), `SNAPSHOT_COUNTED_TABLES` en parité avec le script.

Scénario réel (Docker local, à consigner dans HANDOFF) : `create --verify full` sur la base de dev,
`list`, `restore` puis comptes identiques, `prune --dry-run`.

---

## Lot 2 — `update.sh` v2 : machine à états, passage de main, retour arrière automatique

### 2.1 Machine à états

États, dans l'ordre : `PRECHECK → QUIESCE → SNAPSHOT → FETCH → HANDOFF → MIGRATE → START → HEALTH →
SMOKE → FINALIZE → DONE`. Branches d'échec : `ROLLBACK → ROLLED_BACK` ou `ROLLBACK_FAILED`.

Journal d'exécution : `.acra-update/run/current.json` (0600 ; une seule exécution à la fois) :

```json
{ "schema": 1, "runId": "<uuid ou horodatage>", "kind": "update|rollback", "channel": "stable",
  "from": { "version": "1.0.4", "sha": "…" }, "to": { "version": "1.0.5", "sha": "…" },
  "snapshotId": "…", "state": "MIGRATE", "startedAt": "…", "updatedAt": "…",
  "steps": [ { "state": "PRECHECK", "ok": true, "at": "…", "code": null } ] }
```

Transitions et actions en cas d'échec (table normative ; le code d'erreur est publié dans le statut) :

| État | Action | Échec ⇒ | Code |
|---|---|---|---|
| PRECHECK | arbre propre ; `fetch` ; cible ≠ actuel ; avance rapide possible (`merge-base --is-ancestor`) ; espace (via `acra-snapshot.sh` en mode calcul) ; migrations en attente listées ; destructives signalées (lot 5) | fin sans rien toucher, application intacte | `precheck_*` |
| QUIESCE | `stop app scheduler backup cron` | redémarrer ce qui a été arrêté, fin | `quiesce_failed` |
| SNAPSHOT | `acra-snapshot.sh create --reason pre-update --from-version … --to-version …` (**script installé**, pas celui de la cible) | redémarrer l'ancienne application, fin, **aucun code modifié** | `snapshot_failed` / `snapshot_space` |
| FETCH | `git merge --ff-only` (ou `pull` de l'image en mode B) | `git reset --hard $FROM_SHA` (sûr : arbre vérifié propre en PRECHECK, et l'on revient au commit d'avant) ; redémarrer l'ancienne app | `fetch_failed` |
| HANDOFF | copier `scripts/update-steps.sh` de la cible dans un fichier temporaire, vérifier qu'il existe et déclare `ACRA_UPDATE_STEPS_API=1`, `exec` avec le journal | **ROLLBACK** (code seul : base intacte) | `handoff_failed` |
| MIGRATE | `ACRA_MIGRATE_AUTO_RESOLVE=0 … up -d --build --no-deps migrator` puis attendre sa fin et lire son code | **ROLLBACK** (code + base) | `migrate_failed` |
| START | `up -d --build app` (+ `scheduler`, `backup`, `cron` existants) | **ROLLBACK** | `start_failed` |
| HEALTH | `/api/health?deep=1` jusqu'à 5 min : `status=ok`, `db=connected`, `revision=$TO_SHA`, `migrations.pending=0`, `migrations.failed=0` (lot 4) | **ROLLBACK** | `health_failed` |
| SMOKE | `GET /` 200 ou 307 ; `GET /login` 200 ; `GET /api/health` 200 depuis le conteneur | **ROLLBACK** | `smoke_failed` |
| FINALIZE | `current.json` → `last.json`, `acra-snapshot.sh prune`, index | journaliser seulement (mise à jour réussie) | — |

Le **retour arrière automatique** (état ROLLBACK) :

1. `stop app scheduler backup cron` ;
2. code : `git reset --hard $FROM_SHA` sur la branche suivie (mode B : image `previous`) ;
3. base + documents : `acra-snapshot.sh restore <snapshotId> --yes` **si** l'état atteint est
   MIGRATE ou au-delà (sinon la base n'a pas été touchée : on n'en restaure pas) ;
4. `ACRA_VERSION/ACRA_REVISION` de l'ancienne version, `up -d --build` ;
5. santé : `revision=$FROM_SHA` ;
6. statut `ROLLED_BACK` (message : « Mise à jour vers X annulée ; version Y restaurée ; base
   défectueuse conservée sous le nom … pendant N jours ») ; en cas d'échec : `ROLLBACK_FAILED`,
   application **arrêtée**, et le statut contient la procédure manuelle exacte (lot 7) — on ne
   relance pas une version incohérente avec sa base.

### 2.2 Reprise après interruption

Au démarrage, `update.sh` (et `update-agent.sh` à chaque passage) lit `run/current.json` :

- état ∈ {PRECHECK, QUIESCE} ⇒ redémarrer l'application si arrêtée, supprimer le journal, statut
  `FAILED` code `interrupted_before_snapshot` ;
- état ∈ {SNAPSHOT} ⇒ idem + supprimer le dossier de point sans manifeste ;
- état ∈ {FETCH … SMOKE} ⇒ **ROLLBACK** automatique (on ne sait pas si la migration a été
  partiellement appliquée) ;
- état ∈ {ROLLBACK} ⇒ rejouer le ROLLBACK (idempotent : `restore` vérifie si la base courante
  correspond déjà au point — comptes identiques et `_prisma_migrations` identique au manifeste ⇒
  sauter la restauration) ;
- état ∈ {FINALIZE, DONE} ⇒ finaliser.

Le verrou (`mkdir`) contient un fichier `pid` ; un verrou dont le pid n'existe plus est repris.

### 2.3 Passage de main (ADR-004)

- `scripts/update.sh` (lanceur) : PRECHECK, QUIESCE, SNAPSHOT, FETCH, HANDOFF ; **ce fichier doit
  rester rétrocompatible** : options actuelles conservées (`stable|beta`, `--yes`, `--no-docker`,
  `--status-file`), même format de statut (champs ajoutés seulement).
- `scripts/update-steps.sh` (nouveau, exécuté **depuis la version cible**) : MIGRATE → DONE et
  ROLLBACK. Reçoit le chemin de `run/current.json` ; n'a besoin que de ce journal pour tout savoir.
  Déclare `ACRA_UPDATE_STEPS_API=1` (contrat versionné ; le lanceur refuse une valeur inconnue et
  fait alors lui-même un retour arrière « code seul »).
- Première mise à jour depuis une version **sans** `update-steps.sh` (≤ 1.0.4) : c'est l'ancien
  `update.sh` qui s'exécute → le lot 0 doit donc être livré dans une version publiée **avant**
  la livraison du lot 2 ; le lanceur v2 sait aussi tourner seul (repli : si la cible n'a pas
  `update-steps.sh`, exécuter ses propres étapes).
- Le lanceur se copie dans un fichier temporaire et se ré-exécute depuis celui-ci au démarrage
  (`ACRA_UPDATE_REEXEC=1`), pour ne jamais lire un script que `git merge` remplace.

### 2.4 Statut publié (rétrocompatible)

`status.json` garde `state` (`PENDING|RUNNING|SUCCESS|FAILED`) et ajoute :

```json
{ "state": "RUNNING", "step": "MIGRATE", "code": null, "snapshotId": "…", "from": "1.0.4", "to": "1.0.5",
  "rolledBack": false, "steps": [ { "step": "SNAPSHOT", "ok": true, "at": "…" } ] }
```

Un retour arrière réussi publie `state: "FAILED"`, `rolledBack: true`, `code: "<cause>"`.

### Tests du lot 2

`src/__tests__/unit/lib/update-script.test.ts` (git/docker simulés, dépôt git temporaire réel pour
`git` si plus simple) :
- échec du point de restauration ⇒ aucun `git merge`, ancienne app redémarrée, statut
  `snapshot_failed` ;
- échec de migration ⇒ `reset --hard FROM_SHA`, `acra-snapshot.sh restore <id> --yes`, `up`, santé
  sur `FROM_SHA`, statut `rolledBack: true` ;
- échec de santé (révision inattendue) ⇒ même retour arrière ;
- échec du HANDOFF (fichier absent dans la cible) ⇒ retour arrière **sans** restauration de base ;
- reprise : `current.json` en `MIGRATE` au lancement ⇒ ROLLBACK ; en `QUIESCE` ⇒ redémarrage seul ;
- `ACRA_MIGRATE_AUTO_RESOLVE=0` présent dans l'environnement de l'appel `migrator`.

`src/lib/update-run.ts` (pur) : `nextOnFailure(state)` (table ci-dessus), `needsDbRestore(state)`,
`resumeAction(state)`, `parseRunJournal` — testés exhaustivement (`update-run.test.ts`).

Scénario réel obligatoire (Docker local) : mise à jour d'un commit A vers un commit B contenant
une migration volontairement fautive (`SELECT 1/0;`) ⇒ retour arrière automatique, données
identiques (comptes), version A servie. Consigner la sortie dans HANDOFF.

---

## Lot 3 — Retour arrière manuel et agent v2

### 3.1 Demande de l'interface

`src/lib/update-request.ts` : le type devient une union :

```ts
export type UpdateRequest =
  | { id: string; action: 'update'; channel: UpdateChannel; requestedBy: string; requestedAt: string }
  | { id: string; action: 'rollback'; snapshotId: string; confirmVersion: string; requestedBy: string; requestedAt: string }
```

`buildRollbackRequest` lève si `snapshotId` ne passe pas `isSnapshotId` ou si `confirmVersion` ne
correspond pas à la `version` du point dans l'index. Rétrocompatibilité : une demande sans
`action` = `update`.

### 3.2 Agent

`update-agent.sh` lit `action` ; pour `rollback`, extrait `snapshotId` par `sed`, le valide avec la
**même** expression, vérifie sa présence dans **son** index (`acra-snapshot.sh list --json`), puis
appelle `scripts/update.sh rollback <id> --yes --status-file …` (nouveau sous-mode du lanceur :
QUIESCE → ROLLBACK avec ce point → santé de la version du point). Le code à restaurer est
`acra.revision` du manifeste (`git checkout` de ce commit **sur la branche suivie** : `git reset
--hard <rev>` seulement si `<rev>` est un ancêtre de la branche ; sinon refus `rollback_not_ancestor`).

### 3.3 Route

`POST /api/admin/version/rollback` (SUPER_ADMIN via `requireInstanceAdmin`), corps
`{ snapshotId, confirmVersion }` (zod), 409 si agent absent ou mise à jour en cours, 400 si
identifiant inconnu de l'index, 202 sinon. Journal d'audit : nouvelle action
`INSTANCE_ROLLBACK_REQUESTED` (compléter l'union `AuditAction` dans `src/lib/logger.ts`),
détails `{ snapshotId, fromVersion, toVersion }`. `GET /api/admin/version/update` renvoie en plus
`snapshots` (index assaini) et `run` (étape courante).

### Tests du lot 3

- `update-request.test.ts` : demandes `rollback` valides/invalides, rétrocompatibilité.
- `src/__tests__/unit/api/version-rollback.test.ts` : 401/403/409/400/202, audit appelé, aucune
  écriture si l'identifiant n'est pas dans l'index.
- `update-agent` (script, simulé) : identifiant hors index ⇒ statut `FAILED` `invalid_request`,
  `update.sh` jamais appelé ; contenu de `request.json` avec injection (`"; rm -rf /`) neutralisé.

---

## Lot 4 — Interface, santé approfondie et journal d'audit

### 4.1 Santé approfondie

`GET /api/health?deep=1` (même route) ajoute
`migrations: { expected: number, applied: number, pending: string[], failed: string[] }`.
- `expected` : noms des dossiers de `prisma/migrations` présents **dans l'image** (lecture du
  dossier au démarrage, mise en cache) ;
- `applied` / `failed` : `SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations"` ;
- logique pure `migrationDrift(expected, rows)` dans `src/lib/migration-drift.ts` (testée) ;
- `status: 'degraded'` + 503 si `pending.length || failed.length`.
- Pas de liste de migrations dans la réponse **non** `deep` ; la réponse `deep` ne divulgue que des
  noms de migration (publics dans le dépôt) — acceptable, mais la limiter aux requêtes depuis
  `127.0.0.1`/réseau Docker n'est pas exigé.

### 4.2 Administration → Version (`VersionCard` ou nouveau `UpdateRestorePanel`)

- Avancement d'une mise à jour : liste des étapes (codes traduits), étape courante, durée.
- Résultat : succès ; échec **avec** retour arrière (« La mise à jour vers 1.0.5 a échoué à l'étape
  Migration. ACRA 1.0.4 a été restauré automatiquement, aucune donnée perdue. ») ; échec du retour
  arrière (message d'alerte + lien vers le runbook § 6).
- **Points de restauration** : tableau (date, version, vérification complète/rapide, clone,
  documents, taille). Bouton « Revenir à ce point » → dialogue : version, date, avertissement de
  perte des saisies postérieures, saisie obligatoire du numéro de version, bouton désactivé tant
  que la saisie ne correspond pas.
- Avant « Mettre à jour » : rappel « Un point de restauration vérifié sera créé ; ACRA sera
  indisponible pendant la mise à jour » (+ migrations destructives signalées si l'agent publie le
  résultat du PRECHECK, lot 5).

Clés i18n (×5) sous `admin.version.restore.*` et `admin.version.updateSteps.*` / `updateCodes.*`
(un libellé par code d'état et d'erreur des tables 2.1).

### 4.3 Journal d'audit après restauration

Au démarrage, l'application lit `.acra-update/events.log` (borné à 64 Ko, lignes
`RESTORED <id> <iso>` / `UPDATED <from> <to> <iso>` / `ROLLED_BACK <from> <to> <code> <iso>`), et
pour chaque événement non encore journalisé écrit une entrée d'audit `INSTANCE_RESTORED` /
`INSTANCE_UPDATED` / `INSTANCE_UPDATE_ROLLED_BACK` (anti-doublon : `EnvoiPeriodique`-like, ou table
dédiée `InstanceEvent` avec clé unique = ligne ; **attention** : après une restauration, la table
revient à l'état du point, donc l'événement de restauration sera bien absent et sera écrit — c'est
voulu). Parseur pur `parseInstanceEvents` (testé). Migration Prisma si table dédiée (champs sans
accent).

### Tests du lot 4

- `migration-drift.test.ts`, `instance-events.test.ts` (purs).
- `VersionCard.test.tsx` / `UpdateRestorePanel.test.tsx` : affichage des étapes, échec avec retour
  arrière, dialogue de confirmation (bouton désactivé tant que la version n'est pas saisie),
  appel de la route.
- Navigateur (dev :3005, agent simulé en écrivant `status.json`/`snapshots.json` à la main) :
  captures des trois états et du dialogue.

---

## Lot 5 — Politique de migrations et tests de mise à niveau en CI

### 5.1 `scripts/check-migrations.mjs` (Node, sans dépendance)

- Classe chaque `prisma/migrations/*/migration.sql` : `additive` | `destructive` | `data`
  (`UPDATE`/`INSERT`/`DELETE` hors DDL). Logique pure dans `src/lib/migration-policy.ts`
  (`classifyMigration(sql)`), réutilisée par le script (import via `tsx` ou copie compilée —
  préférer `npx tsx scripts/check-migrations.ts` comme `acra-tool.ts`).
- Échoue si une migration **nouvelle** (absente de `origin/main`) est destructive sans en-tête
  `-- acra:destructive <raison>` ; échoue si une migration existante a changé (empreinte).
- Sortie JSON (`--json`) utilisée par le PRECHECK de `update.sh` : migrations en attente
  (cible − appliquées) et leur classe → publiées dans `status.json` (`precheck.destructive[]`).
- Ajouter l'étape à la CI (`.github/workflows/security.yml` ou nouveau `migrations.yml`).

### 5.2 Workflow CI `update-rollback.yml` (Docker réel, sur PR touchant `prisma/`, `scripts/`, `docker-compose*.yml`)

1. Démarrer la version **stable précédente** (`git worktree` du tag `stable`), créer un compte et
   des données (seed de démo + un document téléversé).
2. `acra-snapshot.sh create --verify full` ; `restore` ; comptes identiques.
3. `update.sh` vers le commit de la PR (dépôt local comme remote) ⇒ succès, santé `deep` OK,
   document présent.
4. Rejouer depuis l'étape 1 avec une migration fautive injectée ⇒ `rolledBack: true`, comptes
   identiques, version stable servie.
5. Tuer `update.sh` pendant MIGRATE (`kill -9` après détection de l'état) ⇒ relancer l'agent ⇒
   ROLLBACK terminé.
Durée cible < 15 min. Artefacts : journaux, `status.json`, manifestes.

### Tests du lot 5

`migration-policy.test.ts` : un cas par classe, commentaires et chaînes ignorés (`-- DROP TABLE`
dans un commentaire n'est pas destructif), en-tête reconnu, `ADD COLUMN … NOT NULL` sans `DEFAULT`
= destructif (échoue sur table non vide).

---

## Lot 6 — Mode sans Docker et base externe

- `ACRA_DB_MODE=url` : `acra-snapshot.sh` utilise `DATABASE_URL` (lu depuis `.env`, jamais
  affiché) et exécute `pg_dump`/`pg_restore`/`psql` dans un conteneur éphémère
  `postgres:<majeure du serveur>-alpine` (`docker run --rm -i --network host` ou le réseau compose)
  si Docker est présent, sinon les binaires de l'hôte **si** leur version majeure ≥ celle du
  serveur (sinon code 10 avec message explicite). Clone : tenté, sauté sans droit `CREATEDB`.
- `update.sh --no-docker` : QUIESCE = demander l'arrêt du service (variable
  `ACRA_STOP_CMD`/`ACRA_START_CMD`, ex. `systemctl stop acra`) ; sans ces variables ⇒ refus de
  mettre à jour (`precheck_no_stop_cmd`) au lieu de migrer une base en service. MIGRATE =
  `npx prisma migrate deploy` ; START = `npm ci && npm run build && $ACRA_START_CMD`.
- Base managée : documenter le crochet `ACRA_SNAPSHOT_HOOK` (commande appelée avec l'identifiant,
  pour déclencher un instantané chez le fournisseur) — appelé en plus du dump, échec non bloquant
  mais journalisé.

Tests : script simulé (`pg_dump` de version majeure inférieure ⇒ code 10 ; absence de
`ACRA_STOP_CMD` ⇒ refus).

---

## Lot 7 — Documentation et exploitation

- `docs/runbook-exploitation.md` : remplacer § 4 « Restauration » par l'usage de
  `acra-snapshot.sh` ; nouveau § 6 « Mise à jour échouée / retour arrière » : lire
  `status.json`, `run/current.json`, `last.json` ; procédure manuelle complète si
  `ROLLBACK_FAILED` (identique à 1.5 mais commande par commande) ; inspection d'une base
  `__failed_` (`psql -d <db>__failed_…`) ; suppression manuelle.
- `README.md` (× 5 langues) § Mise à jour : point de restauration vérifié, retour arrière
  automatique, bouton « Revenir à ce point », variables (`ACRA_BACKUP_DIR`, chiffrement,
  rétention), espace disque nécessaire (≈ 2 × base + documents).
- `docs/ARCHITECTURE.md` : composant « mise à jour et points de restauration » (scripts, fichiers
  d'échange, libs pures).
- `docs/releases/vX.Y.Z.md` de la version qui livre le lot 0 puis du lot 2 : rubrique « Mettre à
  jour » (sauvetage des documents, espace disque).
- Recommandations runbook § 5 mises à jour : copie hors site des points de restauration
  (`ACRA_SNAPSHOT_OFFSITE_CMD`, même contrat que `BACKUP_OFFSITE_CMD`), test de restauration
  trimestriel (`acra-snapshot.sh verify <id> --full`).

---

## Ordre, estimation et dépendances

| Lot | Dépend de | Taille | Livrable |
|---|---|---|---|
| 0 | — | S | version publiée dès que possible (protection des clients actuels) |
| 1 | 0 | M | `acra-snapshot.sh` + `src/lib/snapshot.ts` |
| 2 | 1 | L | `update.sh` v2 + `update-steps.sh` + `src/lib/update-run.ts` |
| 3 | 2 | M | retour arrière manuel (agent, route, lib) |
| 4 | 2, 3 | M | santé `deep`, interface, journal d'audit |
| 5 | 2 | M | politique de migrations, CI mise à niveau / retour arrière |
| 6 | 1, 2 | S | sans Docker, base externe |
| 7 | tous | S | documentation |

Mode B (`deploy-release.sh`) : après le lot 2, remplacer sa sauvegarde par
`acra-snapshot.sh create --reason pre-update` et son `rollback` « migrations différentes ⇒ arrêt »
par `acra-snapshot.sh restore <id> --yes` + image `previous` (test existant
`deploy-release.test.ts` à faire évoluer : le cas « migrations différentes » doit désormais
restaurer au lieu d'arrêter).

## Définition de « terminé » pour l'ensemble

- [ ] Les 5 scénarios de 5.2 passent en CI sur Docker réel.
- [ ] Sur une instance installée avec la dernière version publiée **avant** ce chantier, la
      première mise à jour vers la version qui contient le lot 0 conserve base et documents
      (scénario manuel consigné, puisque c'est l'ancien script qui s'exécute).
- [ ] Une mise à jour avec migration fautive revient seule à la version précédente, sans perte,
      en moins de 2 min (clone) / 15 min (dump, base 1 Go).
- [ ] Un SUPER_ADMIN voit les points de restauration et peut revenir à l'un d'eux depuis
      l'interface ; l'action est dans le journal d'audit après redémarrage.
- [ ] Aucun fichier de sauvegarde lisible par un autre compte de l'hôte (`0600`/`0700`).
- [ ] Runbook, README ×5, ARCHITECTURE, notes de release à jour.
