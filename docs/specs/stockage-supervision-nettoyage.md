# Stockage — supervision, nettoyage sans impact et purge des sauvegardes

Spécification proposée le 5 octobre 2026. À implémenter en TDD (CLAUDE.md), i18n dans les 5 langues,
logique dans des fonctions pures testées. Elle **s'appuie sur l'existant** et ne le remplace pas :
`lib/backup-policy.ts` (politique grand-père / père / fils, `estimateStorage`, `diskAdvice`),
`scripts/acra-snapshot.sh` (`prune --keep N --dry-run --include-manual`), `scripts/acra-schedule.sh`
(publie `.acra-update/backup-stats.json`), `.acra-update/snapshots.json`, `BackupSchedulePanel`,
route `api/admin/backup/policy` (demande déposée à l'agent hôte).

---

## 0. Constat

Sur le poste de développement (5/10/2026) : disque à 99 % (≈ 2 Go libres), image disque Docker
Desktop à **43 Go** alloués. Le démon Docker était arrêté, la ventilation n'a donc pas pu être
mesurée : la première action du lot D est un `docker system df -v`. Causes repérées dans le dépôt :

| # | Cause | Où | Effet |
|---|---|---|---|
| C1 | **Deux mécanismes de sauvegarde** en parallèle : le service compose `backup` et les points de restauration de l'agent hôte | `docker-compose.yml` (service `backup`), `scripts/backup-scheduler.sh`, `scripts/acra-schedule.sh` | Données sauvegardées deux fois |
| C2 | Le service `backup` fait un dump **à chaque démarrage** du conteneur, en plus du quotidien | `scripts/backup-scheduler.sh` (« sauvegarde immédiate au démarrage ») | En développement, chaque `docker compose up` ajoute un dump |
| C3 | Rotation de ce service **par âge** (7 jours), pas par nombre | `scripts/backup.sh` (`find -mtime +7 -delete`) | Tous les dumps de la semaine sont gardés, quel que soit leur nombre |
| C4 | Aucune limite sur les **journaux** des conteneurs | aucune section `logging:` dans `docker-compose*.yml` | Fichiers `json-file` qui grossissent sans fin |
| C5 | `app` et `migrator` construisent **chacun** une image depuis le même Dockerfile ; `make build` force `--no-cache` | `docker-compose.yml`, `Makefile` | Couches dupliquées, cache de build inutilisé puis abandonné |
| C6 | Les mises à jour purgent les points de restauration mais **jamais les anciennes images** | `scripts/update-lib.sh` (FINALIZE) | Une image orpheline de plus par version |
| C7 | Cache BuildKit (montage `/root/.npm`, couches `node_modules`) jamais borné | `Dockerfile` | Croissance continue côté hôte |
| C8 | En base, des données **expirées ou consommées** ne sont jamais purgées | jetons, sessions, MFA, invitations, livraisons de webhooks, cache d'idempotence | Tables qui grossissent sans valeur |
| C9 | Fichiers de documents **orphelins** possibles (fichier écrit, ligne `Document` jamais créée ou supprimée sans le fichier) | `lib/document-storage.ts` | Volume `documents_data` qui grossit |

---

## 1. Principes communs

1. **L'application ne touche jamais l'hôte.** Elle n'exécute aucune commande système et ne
   supprime aucun fichier hors de son propre stockage de documents. Tout ce qui concerne les
   sauvegardes ou Docker passe par une **demande à l'agent hôte** déposée dans
   `.acra-update/inbox`, sur le modèle exact de `api/admin/backup/policy` : `requireInstanceAdmin`,
   `readUpdateAgent`, `requestPending`, `writeUpdateRequest`, réponse 202, `auditLog`.
2. **Toute action destructive suit le même parcours** : aperçu (dry-run) → confirmation explicite
   → exécution → journal d'audit → statistiques republiées.
3. **Jamais concernés** : `AuditLog` (obligation de traçabilité), données métier (analyses, risques,
   contrôles, incidents…), historiques de pilotage (`ConformiteSnapshot`, `AppetenceSnapshot`),
   `RapportEdition`, `McpProposal`, `InstanceEvent`, volumes Docker.
4. **Droits** : SUPER_ADMIN pour tout ce qui est instance. Un ADMIN d'organisation voit seulement la
   part de son organisation (documents, nombre de lignes) en lecture.
5. **Configuration** : ces réglages sont de **niveau instance uniquement** (singleton `Configuration`),
   car ils portent sur des ressources partagées. Le modèle à 3 niveaux ne s'applique pas : il n'y a
   pas de bascule par organisation, ce qui est volontaire.

---

## 2. Lot A — Supervision du stockage dans le panneau d'admin

### 2.1 Interface

Nouvelle carte « Stockage » dans `/admin/instance`, ou page dédiée `/admin/stockage` reliée depuis
`AdminNav`. Elle contient cinq blocs, chacun avec un statut OK / ATTENTION / CRITIQUE (type
`DiskStatus` existant) et la date de la mesure.

| Bloc | Indicateurs | Source |
|---|---|---|
| Base de données | taille totale ; 10 plus grosses tables (taille, lignes vivantes, **lignes mortes**) ; signal « VACUUM utile » si lignes mortes > 20 % | `pg_database_size`, `pg_total_relation_size`, `pg_stat_user_tables` (requêtes en lecture seule) |
| Documents | nombre, taille totale, répartition par organisation (top 10) ; espace libre du volume | `SUM(Document.taille)` ; `fs.statfs` sur la racine du stockage local (rien en mode S3) |
| Sauvegardes | points par type (planifié / avant mise à jour / manuel), taille totale, plus ancien et plus récent ; espace libre ; statut `diskAdvice` existant | `.acra-update/snapshots.json` et `backup-stats.json` existants |
| Hôte Docker | images (total / récupérable), cache de build, journaux, volumes | **nouveau** `.acra-update/host-stats.json`, publié par l'agent (`docker system df --format json`) ; bloc masqué si l'agent est absent |
| Nettoyable sans impact | nombre de lignes et octets estimés par catégorie du lot B | aperçu du lot B |

Ajouts :
- **Tendance sur 90 jours** et projection « plein dans ≈ N jours » (régression linéaire sur l'espace
  libre). Elle n'est affichée que si au moins 7 mesures existent.
- **Alertes** : seuils réglables (`storageWarnPercent`, défaut 80 ; `storageCriticalPercent`, défaut 90).
  Une bannière dans l'espace admin, plus une ligne dans l'e-mail de synthèse quotidien des relances
  (planificateur existant, 06:00).

### 2.2 Données et API

- Nouveau modèle `StorageSnapshot` (sans accent ni caractère spécial dans les colonnes) : `id`,
  `mesureLe`, `dbBytes`, `documentsBytes`, `backupsBytes`, `freeBytes`, `hostReclaimableBytes`
  (nullable). Une ligne par jour, écrite par le cron de 02:00 existant. Rétention 400 jours, purgée
  par le lot B.
- `GET /api/admin/storage` (SUPER_ADMIN ; ADMIN filtré sur son organisation) : mesure courante, plus
  un cache serveur de 5 minutes, car les requêtes de taille sont coûteuses sur une grosse base.
- `src/lib/storage-usage.ts` (**pur**) : `formatBytes`, `classifyUsage(used, total, thresholds)`,
  `deadTupleRatio`, `projectFullDate(series, now)`, `topTables(rows, n)`, `parseHostStats(raw)`
  (assainissement, taille ≤ 64 Ko, champs inconnus ignorés, comme `parseSnapshotIndex`).
- `src/lib/storage-usage.server.ts` : requêtes PostgreSQL en lecture seule, `statfs`, lecture des
  fichiers `.acra-update`.
- Composant `StorageUsagePanel` (état + fetch : test Testing Library obligatoire).

---

## 3. Lot B — Nettoyage du cache sans impact

### 3.1 Définition

Est « sans impact » une donnée **expirée, consommée ou régénérable**, dont la suppression ne change
ni le comportement visible, ni une donnée métier, ni la traçabilité. Chaque règle a un délai de
grâce au-delà de l'expiration, pour couvrir les horloges décalées et les enquêtes immédiates.

| # | Catégorie | Règle de suppression | Grâce | Défaut auto |
|---|---|---|---|---|
| B1 | `PasswordResetToken` | `usedAt` non nul ou `expiresAt` dépassé | 24 h | oui |
| B2 | `VerificationToken` | `expires` dépassé | 24 h | oui |
| B3 | `MfaChallenge` | `consumedAt` non nul ou `expiresAt` dépassé | 1 h | oui |
| B4 | `Session` | `expires` dépassé | 24 h | oui |
| B5 | `TrustedDevice` | `expiresAt` dépassé | 7 j | oui |
| B6 | `OrgInvitation` | `acceptedAt` nul et `expiresAt` dépassé | 30 j | oui |
| B7 | `WebhookDelivery` | `statut = LIVRE` (30 j) ou `ECHEC` définitif (90 j) ; **jamais** `EN_ATTENTE` | voir règle | oui |
| B8 | `AnalysisImport` (cache d'idempotence) | `createdAt` au-delà de la fenêtre de rejeu documentée de l'API | 30 j | oui |
| B9 | Fichiers de documents orphelins | clé présente dans le stockage sans ligne `Document` correspondante | 24 h | **non** (aperçu seulement, la première fois) |
| B10 | `StorageSnapshot` | au-delà de 400 jours | — | oui |

B9 demande d'ajouter `list(prefix?)` à l'interface `DocumentStorage`, en local et en S3. Le délai de
grâce de 24 h protège un téléversement en cours.

### 3.2 Mécanisme

- `src/lib/cache-cleanup.ts` (**pur**) : `planCleanup(now, config)` renvoie, pour chaque catégorie,
  le filtre Prisma et la date limite. Aucune requête n'est exécutée dans cette fonction.
- `src/lib/cache-cleanup.server.ts` :
  - `previewCleanup()` : `count` par catégorie et octets estimés ;
  - `runCleanup()` : suppression **par lots** de 1 000 identifiants (`findMany` → `deleteMany`
    `id in`), pour ne jamais verrouiller une grosse table ;
  - verrou d'exécution unique (ligne `InstanceEvent` ou verrou consultatif PostgreSQL) ;
  - opération idempotente.
- `GET /api/admin/storage/cleanup` (aperçu) et `POST /api/admin/storage/cleanup` (exécution),
  réservées au SUPER_ADMIN. Corps optionnel `{ categories: [...] }`. Réponse : comptes supprimés par
  catégorie. Audit `INSTANCE_CACHE_CLEANED` avec les comptes uniquement, jamais de contenu.
- Automatique : `GET /api/cron/cleanup` (protégé par `CRON_SECRET`), appelé par le planificateur
  existant (`scripts/scheduler.sh`) à 03:00. Réglages `Configuration.autoCleanup` (défaut `true`) et
  `Configuration.cleanupCategories` (défaut : toutes sauf B9).
- Récupération d'espace PostgreSQL : l'autovacuum réutilise l'espace libéré, ce qui suffit. Proposer
  en option `VACUUM (ANALYZE)` sur les tables purgées. **Pas** de `VACUUM FULL`, qui pose un verrou
  exclusif : il est seulement documenté, pour une fenêtre de maintenance.

### 3.3 Interface

Dans la carte « Stockage » :
1. Bouton « Nettoyer le cache (sans impact) ».
2. Modale avec l'aperçu par catégorie (lignes, octets) et des cases cochées par défaut, sauf B9.
3. Bouton « Nettoyer », puis résultat.

On affiche aussi la date du dernier nettoyage automatique et l'état de la bascule.

---

## 4. Lot C — Supprimer les sauvegardes en gardant les N plus récentes

### 4.1 Interface

Dans le panneau Sauvegardes (`BackupSchedulePanel` / `/admin/recovery`), un bouton « Libérer de
l'espace » ouvre une modale :
- un **nombre à conserver par type**, de 1 à 60, prérempli avec les valeurs de la politique :
  planifiées, avant mise à jour, manuelles ;
- « Inclure les sauvegardes manuelles », **décochée** par défaut (sémantique `--include-manual`
  existante) ;
- un **aperçu** : liste des points supprimés et conservés (date, type, version, taille), espace
  libéré, espace libre après opération ;
- des **garde-fous**, non désactivables :
  - jamais le point référencé par `.acra-update/run/current.json` (mise à jour non confirmée) ;
  - toujours au moins **un point vérifié complet** conservé ;
  - N ≥ 1 pour chaque type ;
  - refus pendant une mise à jour en cours ;
- une **confirmation** : saisir le nombre de points à supprimer, plus une ré-authentification MFA si
  la politique MFA est active pour le compte.

### 4.2 Mécanisme

- `selectBackupsToPrune(index, { keepScheduled, keepPreUpdate, keepManual, includeManual, protectedIds })`
  (**pur**, dans `lib/snapshot.ts`) : miroir des règles de `acra-snapshot.sh prune`. Un **test de
  parité** avec le script vérifie que les deux appliquent les mêmes règles, sur le modèle de
  `SNAPSHOT_COUNTED_TABLES`.
- `buildBackupPruneRequest(...)` dans `lib/update-request.ts` : nouvelle demande `backup-prune`
  contenant la **liste exacte des identifiants validés dans l'aperçu**. L'agent ne supprime que ces
  identifiants, et seulement s'ils sont encore éligibles au moment de l'exécution. On évite ainsi
  qu'un nouveau point créé entre l'aperçu et l'exécution soit supprimé.
- Extension de `scripts/acra-snapshot.sh prune` : options `--ids id1,id2,…`, `--keep-scheduled`,
  `--keep-pre-update`, `--keep-manual`. Les codes de sortie existants sont conservés. Ensuite :
  `index` et `acra-schedule.sh stats` republient `snapshots.json` et `backup-stats.json`.
- `POST /api/admin/backup/prune` (SUPER_ADMIN, 202). Audit `INSTANCE_BACKUP_PRUNED` avec les
  identifiants et les octets.

### 4.3 Service compose historique `backup` (C1–C3)

- Rétention **par nombre** : `BACKUP_KEEP` (défaut 7) remplace `BACKUP_RETENTION` en jours. Garder
  la compatibilité : si seule l'ancienne variable est définie, appliquer l'ancienne règle.
- **Pas de dump au démarrage** si un dump de moins de 20 heures existe déjà.
- Quand l'agent hôte est installé, placer ce service derrière un **profil compose**
  (`profiles: ["legacy-backup"]`) pour ne pas doubler les sauvegardes. Il reste le mode par défaut
  sans agent, et le README l'explique.
- Ses dumps (volume `backup_data`) sont aujourd'hui invisibles de l'application. L'agent les ajoute
  à `backup-stats.json` (nombre et taille) pour le lot A, et ils sont purgeables par le même parcours
  que le lot C (type `legacy`).

---

## 5. Lot D — Hygiène Docker (développement et production)

Ce lot ne touche pas au code applicatif ; c'est le gain immédiat.

1. **Journaux bornés** : ancre `x-logging` appliquée à tous les services de tous les
   `docker-compose*.yml`.
   ```yaml
   x-logging: &logging
     driver: json-file
     options: { max-size: "10m", max-file: "3" }
   ```
2. **Une seule image applicative** : `image: acra-app:${ACRA_VERSION:-dev}` sur `app` et
   `migrator`, avec la construction déclarée une seule fois.
3. **Makefile** :
   - `build` **sans** `--no-cache` (le cache BuildKit sert à quelque chose) ; nouvelle cible
     `rebuild` pour le cas explicite ;
   - `docker-usage` : `docker system df -v` ;
   - `docker-clean` : `docker image prune -f`, `docker builder prune -f --keep-storage 5GB` et
     suppression des conteneurs arrêtés du projet. **Jamais `-v` ni de suppression de volumes.**
     Confirmation interactive comme `db-reset`.
4. **Mises à jour** (`scripts/update-lib.sh`, étape FINALIZE, après succès) : supprimer les images
   ACRA antérieures à la version précédente (garder N-1 pour un retour arrière rapide), puis
   `docker image prune -f` et `docker builder prune -f --keep-storage 5GB`. Non bloquant, journalisé
   comme la purge des points de restauration.
5. **Agent hôte** : publier `.acra-update/host-stats.json` (`docker system df --format json`,
   assaini, sans noms d'image ni chemins) pour le lot A.
6. **`.dockerignore`** : ajouter `rapports/`, `audit-annotations/`, `e2e/`, `e2e-public/`,
   `fixtures/`, `docs/` (gain ≈ 20 Mo de contexte et une construction plus rapide).
7. **README / setup** : section « Espace disque » avec les commandes `make docker-usage` et
   `make docker-clean`, ce qu'elles suppriment et ce qu'elles ne suppriment jamais.

---

## 6. i18n

Espace `t.admin.storage.*` dans les 5 fichiers (fr, en, de, es, it) : titres des blocs, statuts,
libellés B1–B10, textes des modales (aperçu, garde-fous, confirmation), messages d'erreur
(`agent_unavailable`, `request_pending`, `update_in_progress`, `keep_min_1`,
`last_verified_point`), et la ligne d'alerte de l'e-mail quotidien. Les tableaux de libellés traduits
sont définis **dans** les composants, après `useTranslation`.

---

## 7. Tests à écrire en premier

| Fichier | Contenu |
|---|---|
| `unit/lib/storage-usage.test.ts` | formats, seuils (bornes 80/90), ratio de lignes mortes, projection (série plate, croissante, trop courte), `parseHostStats` (champs inconnus, > 64 Ko, valeurs négatives) |
| `unit/lib/cache-cleanup.test.ts` | chaque règle B1–B10 aux bornes de la grâce ; B7 ne cible jamais `EN_ATTENTE` ; aucune règle sur les modèles exclus (liste figée) ; catégories désactivées ignorées |
| `unit/lib/snapshot.test.ts` (ajouts) | `selectBackupsToPrune` : `current.json` protégé ; dernier point vérifié complet conservé ; N par type ; manuels exclus par défaut ; parité avec le script |
| `unit/lib/acra-snapshot-script.test.ts` (ajouts) | `prune --ids` ne supprime que les identifiants donnés encore éligibles ; identifiant invalide ⇒ code 31 sans appel docker |
| `unit/lib/update-request.test.ts` (ajouts) | `buildBackupPruneRequest` : validation, liste d'identifiants assainie |
| `unit/api/storage.route.test.ts`, `cleanup.route.test.ts`, `backup-prune.route.test.ts` | 401/403 (ADMIN ≠ SUPER_ADMIN), 409 agent absent ou demande en cours, 202, audit écrit |
| `unit/components/StorageUsagePanel.test.tsx` | rendu des statuts, aperçu, confirmation (fetch et `useRouter` simulés) |
| `unit/lib/backup-scheduler-script.test.ts` | `BACKUP_KEEP` par nombre ; pas de dump au démarrage si dump < 20 h ; compatibilité `BACKUP_RETENTION` |

Scénario réel à consigner dans HANDOFF : sur Docker local, mesurer `docker system df` avant et après
le lot D, et faire un `prune` de sauvegardes avec aperçu, puis vérifier `snapshots.json`.

---

## 8. Ordre de réalisation et critères d'acceptation

1. **Lot D**, le gain immédiat : journaux bornés, image unique, `make docker-clean`, purge d'images
   après mise à jour. *Critère* : après deux `make build` successifs, aucune image orpheline ACRA ;
   journaux plafonnés à 30 Mo par service.
2. **Lot A** : supervision. *Critère* : la carte affiche les 5 blocs avec statut. L'alerte ATTENTION
   se déclenche à 80 % sur un volume simulé.
3. **Lot B** : nettoyage. *Critère* : l'aperçu est égal au nombre réellement supprimé. Aucune ligne
   d'un modèle exclu n'est touchée, ce que vérifie un test sur base de test (`vitest.db.config.mts`).
   Le nettoyage automatique tourne une fois par jour, sans doublon.
4. **Lot C** : purge des sauvegardes. *Critère* : impossible de descendre sous un point vérifié ou de
   supprimer le point d'une mise à jour en cours. La liste supprimée est exactement celle de l'aperçu.
   Service `backup` historique à rétention par nombre et sans dump au redémarrage.

## 9. Hors périmètre

- Rétention réglementaire de `AuditLog` (sujet de conformité distinct, à spécifier à part).
- `VACUUM FULL` automatique.
- Suppression automatique des sauvegardes manuelles.
- Nettoyage de volumes Docker.
