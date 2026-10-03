# Étude — sauvegarde vérifiée avant mise à jour et retour arrière (rollback)

Date : 2026-10-03 · Auteur : Claude (Opus 5.5) · Statut : **proposée, à valider par l'utilisateur**
Spec de réalisation associée : [`sauvegarde-rollback-spec.md`](sauvegarde-rollback-spec.md) (lots à développer).

Question posée : *un client qui installe ACRA aujourd'hui doit, lors de toute mise à jour future,
avoir sa base sauvegardée **avant** la mise à jour, et pouvoir la récupérer / revenir en arrière si
la mise à jour casse.*

Méthode : cadre « system design » (exigences → conception générale → détail → fiabilité →
compromis) et décisions consignées sous forme d'ADR. Tout constat ci-dessous a été vérifié dans le
code à la date de l'étude (fichier et ligne cités).

---

## 1. Ce qui existe aujourd'hui

ACRA s'installe et se met à jour de **trois façons** :

| Mode | Mise à jour | Sauvegarde avant migration | Retour arrière |
|---|---|---|---|
| **A. Git + Docker Compose** (cas général d'un client) | `scripts/update.sh stable\|beta`, ou bouton « Mettre à jour » → `.acra-update/inbox` → `scripts/update-agent.sh` (cron hôte) → `update.sh` | `pg_dump` en SQL brut gzip dans `backups/` **si** un service `db` tourne | **Aucun** : affiche `git checkout $FROM_SHA && docker compose up -d --build` et, s'il y a eu migration, « restaurer $BACKUP » |
| **B. Image de release qualifiée** (VPS public) | `scripts/deploy-release.sh stage\|finalize\|rollback` via le workflow `deploy-release.yml` | `pg_dump` + archive des documents, `gzip -t`, app arrêtée | Automatique **seulement si le hash des migrations est identique** ; sinon « restauration manuelle qualifiée requise », application arrêtée |
| **C. Sans Docker** (`npm`) | `update.sh --no-docker` puis `npm ci && npx prisma migrate deploy && npm run build` | **Aucune** | Aucun |

S'ajoutent une sauvegarde **quotidienne** (service `backup`, `scripts/backup.sh`, rotation 7 jours,
copie hors site optionnelle) et la réconciliation P3009 (`scripts/migrate-recover.sh`).

## 2. Constats

Classés par gravité (P0 = perte de données possible lors d'une mise à jour normale).

| # | Gravité | Constat | Où |
|---|---|---|---|
| C1 | **P0** | Les **pièces jointes** (bibliothèque documentaire, preuves) sont écrites dans `/app/.data/documents` **à l'intérieur du conteneur** : `docker-compose.yml` ne monte aucun volume à cet endroit (seule la surcouche `docker-compose.release.yml` monte `documents_data`). `update.sh` fait `docker compose up -d --build` → le conteneur est recréé → **les documents sont perdus à chaque mise à jour** (et à tout `docker compose down`/recréation). La surcouche production ne corrige pas. | `docker-compose.yml` service `app` (volumes : `./.acra-update` seulement) ; `src/lib/document-storage.ts:76` |
| C2 | P1 | `update.sh` sauvegarde **pendant que l'application tourne** puis reconstruit : les écritures faites entre la sauvegarde et l'arrêt sont perdues en cas de restauration ; l'ancienne application continue de servir pendant que le `migrator` modifie le schéma. | `scripts/update.sh` (sauvegarde puis `up -d --build`) |
| C3 | P1 | La sauvegarde n'est **jamais vérifiée** : pas de `gzip -t`, pas de test de restauration. Une sauvegarde tronquée (disque plein, flux interrompu) passe le contrôle `[ -s "$BACKUP" ]`. | `scripts/update.sh` |
| C4 | P1 | Le dump est en SQL brut **sans `--clean`/`--create`** : le rejouer sur une base déjà migrée échoue ou fusionne (objets existants). Aucune procédure de restauration « base vierge » n'est fournie. | `scripts/update.sh`, runbook § 4 |
| C5 | P1 | Aucun **manifeste** : on ne sait pas quelle version de code, quel commit, quelles migrations, quelle clé de chiffrement correspondent à un dump. Restaurer un dump avec le mauvais code = application cassée. | — |
| C6 | P1 | **Aucun retour arrière exécuté** : seulement des commandes affichées. Le bouton de l'interface ne propose ni restauration ni liste des points de restauration ; le statut se limite à `FAILED`. | `update.sh`, `update-agent.sh`, `src/lib/update-request.ts` |
| C7 | P1 | Les migrations Prisma sont **à sens unique** (pas de migration descendante) et ACRA a déjà livré 8 migrations destructives (`DROP TABLE "RiskAction"`, `DROP COLUMN`, `RENAME COLUMN`). Dès qu'une migration a été appliquée, revenir à l'ancien code **sans restaurer la base** est impossible. | `prisma/migrations/*` |
| C8 | P1 | Le `migrator` du mode A exécute `migrate-recover.sh`, qui **marque automatiquement des migrations comme appliquées** si le diff ne montre aucun `CREATE/ADD`. Une migration de **données** (`UPDATE`) en échec à mi-chemin serait marquée appliquée sans avoir migré les données. Pendant une mise à jour pilotée (avec point de restauration), un échec doit déclencher le retour arrière, pas une réconciliation. Le mode B l'interdit déjà (« aucun marquage automatique »). | `scripts/migrate-recover.sh`, `docker-compose.yml` service `migrator` |
| C9 | P1 | **Mode C (sans Docker)** et **base externe/managée** (aucun service `db`) : aucune sauvegarde avant migration (`update.sh` ne sauvegarde que si `db` tourne). | `scripts/update.sh` |
| C10 | P2 | Le dump contient des **données de risque sensibles** mais est écrit dans `backups/` avec l'umask par défaut (lisible par d'autres comptes de l'hôte), sans chiffrement ni rétention. `deploy-release.sh` fait `umask 077`, pas `update.sh`. | `scripts/update.sh` |
| C11 | P2 | Les secrets stockés en base sont chiffrés par `SECRETS_ENCRYPTION_KEY` : un dump restauré avec une autre clé rend SMTP/SSO/SIEM/jetons inutilisables. Rien ne le détecte. | `.env.example:101` |
| C12 | P2 | Pas de contrôle préalable : espace disque, version cible, migrations à appliquer, migrations destructives, notes « Mettre à jour » de la release. | — |
| C13 | P2 | Le contrôle de santé ne vérifie que « l'application répond et la base répond » ; il ne vérifie ni la version servie (mode A), ni que **toutes** les migrations attendues sont appliquées. | `src/app/api/health/route.ts` |
| C14 | **P0 structurel** | **Problème d'amorçage** : lors de la prochaine mise à jour d'un client, c'est **le `update.sh` déjà installé chez lui** qui fait la sauvegarde. Tout ce qui n'est pas livré dans la version qu'il installe aujourd'hui ne protégera pas sa prochaine mise à jour. Il faut (1) livrer vite un premier socle fiable et (2) que le programme de mise à jour installé **passe la main** à celui de la version cible pour les étapes suivantes. | `scripts/update.sh` |

Ce qui est **déjà bien** et doit être conservé : avance rapide seulement (`--ff-only`), refus si
modifications locales, verrou unique, l'application ne lance aucune commande (dépôt de demande,
agent hôte), mode B : arrêt de l'application avant la sauvegarde, `gzip -t`, sauvegarde des
documents, finalisation après recette, `MIGRATIONS_HASH` calculé par `release.yml`.

## 3. Exigences

### 3.1 Fonctionnelles

- **F1** Toute mise à jour (modes A, B, C ; bouton ou ligne de commande) crée un **point de
  restauration** *avant* toute modification du code, de l'image ou du schéma. Pas de point de
  restauration vérifié ⇒ pas de mise à jour.
- **F2** Le point de restauration contient : base complète, documents (stockage local), manifeste
  (versions, commit/image, migrations appliquées, empreinte de la clé de chiffrement, comptes de
  lignes, sommes de contrôle).
- **F3** Il est **vérifié** : intégrité des fichiers et, par défaut, **restauration d'essai** dans
  une base temporaire avec comparaison des comptes de lignes.
- **F4** En cas d'échec à n'importe quelle étape avant la confirmation, **retour arrière
  automatique** : ancien code/image + base + documents, puis contrôle de santé de l'ancienne version.
- **F5** Après une mise à jour réussie, **retour arrière manuel** possible pendant une fenêtre
  (par défaut : tant que le point existe), depuis la ligne de commande ou l'interface
  (SUPER_ADMIN, double confirmation, perte des saisies postérieures affichée).
- **F6** Lister, vérifier, purger et (pour un exploitant) restaurer un point de restauration
  hors procédure de mise à jour (`acra-snapshot list|verify|restore|prune`).
- **F7** La base défectueuse remplacée par un retour arrière est **conservée** (analyse post-mortem)
  pendant N jours, jamais supprimée silencieusement.
- **F8** Traçabilité : chaque mise à jour, point de restauration et retour arrière est journalisé
  côté hôte et, au redémarrage, dans le journal d'audit de l'application.

### 3.2 Non fonctionnelles

| Exigence | Cible |
|---|---|
| Perte de données lors d'un retour arrière automatique (RPO) | **0** : l'application est arrêtée avant le point de restauration |
| Durée d'un retour arrière (RTO), base ≤ 1 Go | ≤ 2 min par clone de base, ≤ 15 min par restauration du dump |
| Interruption de service d'une mise à jour réussie | ≤ durée sauvegarde + build/pull + migration + démarrage (affichée à l'avance) |
| Reprise après plantage de l'hôte pendant la mise à jour | Machine à états journalisée : reprise ou retour arrière au prochain passage de l'agent, jamais un état mixte silencieux |
| Sécurité | Fichiers en `0600` dans un dossier `0700` ; chiffrement optionnel ; aucun secret dans le manifeste (empreinte tronquée seulement) ; l'application ne lit jamais les dumps |
| Portabilité | bash + outils PostgreSQL du conteneur `db` (ou d'un conteneur `postgres:16-alpine` éphémère) ; aucune dépendance hôte autre que Docker, git, gzip, sha256sum/shasum |
| Testabilité | Scénarios bout en bout automatisés en CI (mise à jour réussie, échec de migration, échec de santé, plantage simulé, retour arrière manuel) |

### 3.3 Hypothèses et contraintes

- Volumétrie d'une instance client : base de quelques Mo à quelques Go, documents de quelques Go
  au plus. Une interruption de quelques minutes pendant une mise à jour est acceptable (outil GRC,
  pas un service temps réel) ; elle est annoncée.
- PostgreSQL 16 en conteneur dans les modes A/B ; base managée possible (DATABASE_URL externe).
- Le schéma évolue par migrations Prisma horodatées, jamais modifiées une fois commitées.
- Le stockage S3 des documents (`DOCUMENT_STORAGE=s3`) n'est pas inclus dans le point de
  restauration : il relève du versionnement d'objets du fournisseur (consigné dans le manifeste).

## 4. Conception générale

```
                         ┌──────────────── hôte ──────────────────────────────────────────┐
 Interface (SUPER_ADMIN) │                                                                 │
  « Mettre à jour »      │  .acra-update/inbox/request.json   (canal | rollback+snapshotId) │
  « Restaurer ce point » ─┼─▶            │                                                   │
                         │             ▼                                                   │
                         │  update-agent.sh (cron, chaque minute, verrou)                   │
                         │             │ valide la demande contre une liste fermée          │
                         │             ▼                                                   │
                         │  update.sh  ── machine à états (journal .acra-update/run/*.json) │
                         │   PRECHECK → QUIESCE → SNAPSHOT → VERIFY → FETCH → MIGRATE →     │
                         │   START → HEALTH → SMOKE → DONE      (échec ⇒ ROLLBACK)          │
                         │             │                                                   │
                         │             ▼                                                   │
                         │  acra-snapshot.sh  create | verify | list | restore | prune      │
                         │     ├─ pg_dump -Fc (format custom)  ─▶ backups/<id>/database.dump │
                         │     ├─ clone CREATE DATABASE … TEMPLATE (si place)  ─▶ acra_rm__snap_<id>
                         │     ├─ tar des documents             ─▶ backups/<id>/documents.tar.gz
                         │     └─ manifest.json + SHA256SUMS                               │
                         │                                                                 │
                         │  Publie : status.json (étapes), snapshots.json (index assaini)   │
                         └─────────────────────────────────────────────────────────────────┘
                                         │ lecture seule (64 Ko max, champs connus)
                                         ▼
                         Application : Administration → Version (avancement, points de
                         restauration, bouton de retour arrière), /api/health?deep
```

Principes :

1. **Arrêter avant de photographier** : `app`, `scheduler`, `cron`, `backup` sont arrêtés avant
   le point de restauration (RPO = 0) ; `db` reste démarrée.
2. **Deux copies de nature différente** : un dump logique portable (toujours) + un clone de base
   dans le même serveur PostgreSQL (si l'espace le permet) pour un retour arrière en quelques
   secondes.
3. **Retour arrière = restauration**, jamais de migration descendante (ADR-002).
4. **Machine à états journalisée** et reprise idempotente.
5. **Passage de main** : le programme de mise à jour installé se met lui-même à jour (version
   cible) avant d'exécuter les étapes à risque (ADR-004).
6. **L'application reste passive** : elle dépose des demandes à liste fermée et lit des fichiers
   assainis ; elle n'exécute rien et ne lit jamais un dump.

## 5. Décisions (ADR)

### ADR-001 — Nature du point de restauration

**Statut** : proposé · **Décideur** : utilisateur (propriétaire produit)

**Contexte** : il faut une copie de la base prise juste avant la migration, vérifiable,
restaurable vite, et utilisable même si l'hôte est perdu.

| Option | Complexité | Coût disque | Restauration | Hors site | Prérequis |
|---|---|---|---|---|---|
| **A. `pg_dump -Fc` (dump logique, format custom)** | Faible | ≈ 0,2–0,5 × base (compressé) | Minutes (`pg_restore`), sélective, parallélisable sur fichier | Oui | Aucun |
| **B. Clone `CREATE DATABASE … TEMPLATE`** | Faible | 1 × base, dans le volume PostgreSQL | **Secondes** (`ALTER DATABASE … RENAME`) | Non | Aucune connexion sur la base source (app arrêtée) ; droit `CREATEDB` ; place disque |
| C. Instantané de volume (LVM/ZFS/btrfs, snapshot fournisseur) | Moyenne à forte, dépend de l'hôte | Faible (copie sur écriture) | Secondes à minutes | Selon fournisseur | Système de fichiers adapté, droits root — **non maîtrisable chez un client** |
| D. PITR (archivage WAL + base backup) | Forte | Continu | Minutes, à la seconde près | Oui | Configuration PostgreSQL, stockage d'archives, supervision |
| E. `pg_dump` SQL brut (existant) | Faible | ≈ A | Rejeu SQL complet, non sélectif ; échoue sur base non vide sans `--clean` | Oui | Aucun |

**Décision** : **A toujours + B quand c'est possible**. A est la référence (portable, vérifiable
par restauration d'essai, copiable hors site) ; B est l'accélérateur du retour arrière automatique
(le cas fréquent : la mise à jour vient d'échouer, on remet la base d'avant en quelques secondes).
B est sauté (journalisé) si l'espace libre du volume PostgreSQL est insuffisant ou si le rôle n'a
pas le droit de créer une base (base managée). C et D restent des recommandations d'exploitation
(runbook), pas un prérequis.

**Conséquences** : plus facile — retour arrière quasi instantané et sans dépendre d'un fichier ;
plus difficile — gérer la purge des clones (ils occupent le volume de la base) ; à revoir si une
instance dépasse ~20 Go (passer à `pg_dump -Fd -j` et à un instantané de volume).

### ADR-002 — Retour arrière : restauration plutôt que migrations descendantes

**Contexte** : Prisma ne génère pas de migration descendante ; ACRA a déjà livré des migrations
destructives (suppression de table/colonne) dont l'inverse ne peut pas recréer les données.

| Option | Fiabilité | Effort | Perte de données |
|---|---|---|---|
| **A. Restaurer le point de restauration + ancien code/image** | Élevée (état exact d'avant) | Faible | Saisies postérieures au point (nulles en automatique, affichées en manuel) |
| B. Écrire une migration descendante par migration | Faible (non testable exhaustivement, impossible pour les suppressions) | Fort, permanent | Données supprimées non récupérables |
| C. Migrations « expand/contract » seules, sans restauration | Moyenne | Moyen | Aucune si la discipline est parfaite — elle ne l'est jamais |

**Décision** : **A**, complété par la discipline de C pour **réduire** les cas de retour arrière
(politique de migrations, ADR-005). B est écarté.

### ADR-003 — Qui exécute : agent hôte, pas l'application

**Décision** : on garde l'architecture de l'issue #185 : l'application dépose une demande dans
`.acra-update/inbox`, l'agent hôte (cron) l'exécute. On l'étend à une **seconde action**
`rollback` dont le seul paramètre est un identifiant de point de restauration validé contre
l'index que l'agent tient lui-même. L'application n'obtient ni accès au socket Docker, ni accès aux
dumps. Écartées : exécuter `pg_dump` depuis le conteneur applicatif (donnerait à l'application les
moyens d'écraser sa propre base) ; un conteneur « ops » avec le socket Docker (élévation de
privilèges sur l'hôte).

### ADR-004 — Passage de main au programme de mise à jour de la version cible

**Contexte** : constat C14. Le `update.sh` déjà installé chez le client est figé à la version qu'il
a installée.

**Décision** : `update.sh` devient un **lanceur stable** dont le contrat est minimal et ne changera
plus : (1) contrôles préalables, (2) arrêt + point de restauration vérifié **avec la version
installée de `acra-snapshot.sh`**, (3) récupération du code cible, (4) **exécution du
`scripts/update-steps.sh` de la version cible** (copié dans un fichier temporaire, après vérification
que le commit cible est bien la pointe de `origin/stable|main`), qui fait migration, démarrage,
santé, recette et retour arrière. Ainsi, une amélioration des étapes après la sauvegarde profite
dès la mise à jour suivante. Le point de restauration est toujours fait par le code **déjà
installé et déjà éprouvé** chez le client : un défaut de la version cible ne peut pas empêcher la
sauvegarde.

Compromis : la version cible exécute du code de l'hôte — c'est déjà le cas (on s'apprête à
construire et lancer ce code). Option de durcissement : vérifier la signature du tag (`git
verify-tag`) quand une clé est configurée.

### ADR-005 — Politique de migrations (réduire les retours arrière)

**Décision** : toute migration est classée par un contrôle CI (`scripts/check-migrations.mjs`) :

- **additive** (CREATE TABLE/INDEX, ADD COLUMN nullable ou avec défaut) : libre ;
- **destructive** (DROP TABLE/COLUMN/TYPE, RENAME, ALTER TYPE, SET NOT NULL sans défaut,
  `DELETE`, `TRUNCATE`) : refusée sauf commentaire `-- acra:destructive <raison>` en tête du
  fichier, et **signalée** dans les notes de release (rubrique « Mettre à jour ») et dans le
  contrôle préalable affiché à l'administrateur ;
- **modification d'une migration déjà livrée** : refusée (empreinte comparée à `origin/main`) ;
- la suppression d'une colonne n'intervient qu'**une version après** que le code a cessé de la lire
  (expand → migrate → contract).

Et un **test de mise à niveau en CI** : restaurer une base de la dernière version stable (jeu de
données de démonstration) → migrer vers la version candidate → santé ; puis provoquer un échec et
vérifier le retour arrière.

## 6. Analyse des compromis principaux

- **Arrêt de service vs perte de données** : on choisit d'arrêter l'application pendant le point
  de restauration et la migration (quelques minutes, annoncées) pour garantir RPO = 0. Une mise à
  jour « à chaud » exigerait des migrations strictement compatibles avec les deux versions et une
  réplication : disproportionné pour un outil GRC auto-hébergé.
- **Restauration d'essai systématique** : elle double environ la durée du point de restauration.
  On la garde par défaut (un dump jamais restauré n'est pas une sauvegarde) ; désactivable
  (`ACRA_SNAPSHOT_VERIFY=quick`) au-delà d'un seuil de taille, avec avertissement.
- **Clone de base** : retour arrière en secondes contre un doublement temporaire de l'espace de la
  base ; sauté automatiquement si l'espace manque, le dump suffit alors.
- **Retour arrière manuel tardif** : plus le temps passe, plus il fait perdre de saisies. On
  l'autorise mais l'interface affiche le nombre d'écritures journalisées depuis le point
  (journal d'audit) et exige une confirmation saisie.

## 7. Ce qu'il faudra revoir quand les instances grossiront

- Au-delà de ~20 Go : dump répertoire parallèle (`-Fd -j`), instantanés de volume, PITR.
- Base managée : déléguer le point de restauration au fournisseur (snapshot API) via un « crochet »
  `ACRA_SNAPSHOT_HOOK` (commande externe) au lieu du clone.
- Haute disponibilité / zéro interruption : migrations compatibles N/N+1 obligatoires, déploiement
  bleu-vert — hors périmètre actuel.

## 8. Recommandation et ordre de livraison

1. **Lot 0 (urgent, à livrer dans la prochaine version publiée)** : volume persistant des documents
   avec sauvetage des fichiers existants (C1), sauvegarde vérifiée et application arrêtée dans
   l'`update.sh` actuel (C2, C3, C10), migrate-recover désactivé pendant une mise à jour (C8). C'est
   ce que les clients qui installent maintenant auront lors de leur prochaine mise à jour.
2. Lots 1–7 : `acra-snapshot.sh`, machine à états et passage de main, retour arrière automatique
   puis manuel, interface, santé approfondie, politique de migrations et tests CI, mode sans
   Docker / base externe, documentation.

Détail, critères d'acceptation et tests : [`sauvegarde-rollback-spec.md`](sauvegarde-rollback-spec.md).

## 9. Décisions attendues de l'utilisateur

| # | Question | Proposition par défaut |
|---|---|---|
| D1 | Restauration d'essai à chaque mise à jour ? | Oui, sauf base > 2 Go (vérification rapide + avertissement) |
| D2 | Rétention des points de restauration de mise à jour | 3 derniers + celui de la version précédente tant que la suivante n'est pas confirmée ; base défectueuse conservée 14 jours |
| D3 | Retour arrière manuel depuis l'interface | Oui, SUPER_ADMIN, confirmation saisie du nom de la version, perte de saisies affichée |
| D4 | Chiffrement des points de restauration | Optionnel (`age`, clé publique en variable) ; permissions strictes toujours |
| D5 | Confirmation après mise à jour (mode A) | Automatique après santé + recette de fumée ; pas d'attente humaine (contrairement au mode B public) |
