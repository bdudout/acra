# Déploiement haute disponibilité (profil « ha »)

**Statut : lot H1 de [`specs/scalabilite-haute-disponibilite.md`](specs/scalabilite-haute-disponibilite.md), livré le 16/10/2026.**
L'installation par défaut reste **mono-instance** (un hôte, `docker-compose.yml` + `docker-compose.production.yml`,
documents sur disque local, compteurs en mémoire). Tout ce qui suit est **activable** et ne change rien tant
qu'on ne l'active pas.

Principe directeur (décision du 16/10/2026) : **intégrité avant disponibilité**. Une transaction confirmée ne
doit jamais être perdue ; en cas de doute, le système refuse d'écrire plutôt que de diverger. Concrètement,
dans ce guide, chaque fois qu'un choix oppose « continuer à servir » et « ne rien perdre / ne rien affaiblir »,
c'est la seconde option qui est retenue par défaut, et l'autre est disponible de façon **explicite**.

> Légende : **[vérifié]** = exécuté dans ce dépôt (tests, `docker compose config`) ;
> **[à vérifier]** = paramètre cité de mémoire de la documentation de l'outil, à contrôler sur la version déployée ;
> **[non testé]** = jamais exécuté dans un environnement réel.

---

## 1. Architecture cible

```
                Internet
                    │ 443
             ┌──────▼──────┐
             │    Caddy    │  TLS, répartition de charge, contrôle de santé /api/health
             └──┬───┬───┬──┘
          ┌─────┘   │   └─────┐
      ┌───▼──┐  ┌───▼──┐  ┌───▼──┐
      │ app  │  │ app  │  │ app  │   ACRA_REPLICAS (défaut 3), même image, même NEXTAUTH_SECRET
      └─┬─┬──┘  └─┬─┬──┘  └─┬─┬──┘
        │ │       │ │       │ │
        │ └───────┼─┴───────┼─┴──────► Redis  (limites de débit + verrouillage de compte)
        │         │         │
        ├─────────┴─────────┴────────► S3 compatible (documents ; versionné, chiffré)
        │
        └────────────────────────────► PostgreSQL HA : option A (managée) ou B (Patroni 3 nœuds)
                                         └── archivage continu des WAL → stockage objet (PITR)
   scheduler (1 seul) ──► http://app:3000/api/cron/* ──► bail « CronVerrou » en base
```

| Composant | Mono-instance (défaut) | Profil « ha » |
|---|---|---|
| Application | 1 conteneur `ebios_app` | N réplicas sans `container_name` |
| Limites de débit, verrouillage de compte | mémoire de l'instance | Redis (`REDIS_URL`) |
| Documents | volume local `documents_data` | S3 compatible (`DOCUMENT_STORAGE=s3`) |
| Base | conteneur `db` local | externe : managée ou Patroni (`DATABASE_URL`) |
| Sauvegarde | `pg_dump` quotidien (service `backup`) | PITR : hébergeur ou pgBackRest |
| Tâches planifiées | service `scheduler` | inchangé (un seul planificateur) + bail en base |

---

## 2. Application multi-instance

### 2.1 Ce que l'application garantit [vérifié par tests unitaires]

- **Sessions** : JWT signés avec `NEXTAUTH_SECRET`, sans état serveur. Toutes les instances doivent recevoir
  la **même** valeur (le profil « ha » la rend obligatoire).
- **Limites de débit et verrouillage de compte partagés** quand `REDIS_URL` est défini
  (`src/lib/shared-store.server.ts`, appelé par `src/instrumentation.ts`) :
  - `rateLimit()` (connexion par e-mail, échecs par IP, écritures API, exports, imports, MCP…) et
    le **verrouillage de compte** (`login-lockout.ts`, politique « N échecs → verrouillage X min ») utilisent
    le même Redis. Sans cela, un attaquant répartissant ses essais sur N instances disposerait de N fois le seuil.
  - Client Redis **intégré, sans dépendance** (`src/lib/redis-resp.ts`, protocole RESP2 : `AUTH`, `SELECT`,
    `PING`, `INCR`, `PEXPIRE`, `PTTL`, `GET`, `DEL`). Raison : l'image est construite en sortie
    « standalone » de Next.js et aucune dépendance n'est ajoutée pour une fonction optionnelle.
    URL : `redis://[utilisateur:motdepasse@]hôte[:port][/base]` ou `rediss://…` (TLS ; une autorité de
    certification privée se déclare par `NODE_EXTRA_CA_CERTS`).
  - **Redis injoignable au démarrage → l'instance refuse de démarrer** (message explicite, code de sortie 1).
    Retomber en silence sur des compteurs locaux affaiblirait la protection anti-force brute sans que personne
    ne le voie. `REDIS_OPTIONNEL=1` autorise ce repli **explicitement** (avertissement dans les journaux).
  - **Redis indisponible en cours de fonctionnement** : les appels qui consultent un compteur échouent
    (connexion refusée, écritures limitées en erreur 500) au lieu de passer sans limite. C'est un comportement
    « fermé » assumé ; il fait de Redis un composant critique (voir § 5).
  - Le verrouillage de compte dans Redis : compteur d'échecs `lo:f:<email>` (expire après 24 h sans nouvel
    échec) et verrou `lo:l:<email>` dont l'expiration est la durée de verrouillage. Les limites de débit :
    `rl:<clé>`, fenêtre fixe.
- **Documents** : `DOCUMENT_STORAGE=s3` (§ 4). Une variable manquante arrête l'instance au démarrage : jamais
  de repli sur le disque local (chaque instance aurait ses propres fichiers).
- **Tâches planifiées** : toutes les routes `/api/cron/*` passent par `cronRoute()`
  (`src/lib/cron-route.server.ts`) qui prend un **bail atomique en base** (`CronVerrou`, `INSERT … ON CONFLICT
  … WHERE échu`). Deux exécutions simultanées d'une même tâche sont donc impossibles, quel que soit le
  nombre d'instances ou de planificateurs. Le bail **ne dédoublonne pas deux exécutions successives** :
  c'est le rôle de l'idempotence des tâches (déjà exigée) et de la règle « un seul planificateur actif »
  (le service `scheduler` **ou** le workflow GitHub, pas les deux). Dans le profil « ha », le planificateur
  appelle `http://app:3000` : le DNS de Docker choisit un réplica, ce qui suffit.

### 2.2 Points d'attention Next.js (documentation `node_modules/next/dist/docs/01-app/02-guides/self-hosting.md`)

- **Même image pour tous les réplicas** : la clé de chiffrement des Server Functions est générée à la
  construction et embarquée dans le build. Le profil « ha » construit une seule image ; si plusieurs builds
  devaient coexister (déploiement progressif entre deux versions), fixer `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`
  au moment du build et un `deploymentId` (question ouverte, § 9).
- Caches en mémoire propres à chaque instance (sans effet sur l'intégrité) : rapport de stockage (5 min),
  garde « un VACUUM à la fois » (`storage-usage.server.ts`) — par instance, pas global.

### 2.3 Fichiers

- `docker-compose.ha.yml` — surcouche de `docker-compose.production.yml` ;
- `Caddyfile.ha` — frontal : `reverse_proxy` avec upstreams `dynamic a` (un enregistrement A par réplica),
  `lb_policy round_robin`, contrôle actif `health_uri /api/health` (200 attendu ; `/api/health` répond 503 si
  la base est injoignable ou le schéma en retard), contrôle passif `fail_duration 30s`, nouvel essai sur un
  autre réplica en cas d'échec de connexion (`lb_try_duration 5s`). Une requête déjà transmise n'est rejouée
  que pour `GET` (comportement par défaut de Caddy) : pas de double écriture.
  **[à vérifier]** : la prise en charge du contrôle *actif* avec des upstreams dynamiques dépend de la version de
  Caddy ; le contrôle passif et le nouvel essai s'appliquent dans tous les cas. Recette : arrêter un réplica
  (`docker stop <conteneur>`) et vérifier qu'aucune requête n'échoue au-delà de quelques secondes.

---

## 3. Base de données

Deux options supportées (décision § 5.2 de la spec). Dans les deux cas l'application ne voit qu'une URL
`DATABASE_URL` pointant **toujours vers le primaire**.

### 3.1 Option A — base managée

Exigences à obtenir **contractuellement** de l'hébergeur (et à vérifier dans sa documentation) :

| Exigence | Pourquoi |
|---|---|
| Réplication **synchrone** vers au moins un autre nœud (idéalement autre zone) — RPO = 0 sur perte d'un nœud | intégrité avant disponibilité |
| Bascule automatique avec point d'entrée stable (DNS ou IP flottante) et délai annoncé (RTO) | disponibilité |
| Restauration **à un instant donné** (PITR) sur une fenêtre ≥ 7 jours, testable par l'exploitant | erreur humaine, corruption logique |
| Sauvegardes chiffrées, hébergées dans l'UE (souveraineté), hors de la zone primaire | sinistre |
| PostgreSQL ≥ 16, extensions standard, TLS imposé | compatibilité ACRA |

Une offre « réplique asynchrone + bascule » **ne satisfait pas** RPO = 0 : une bascule peut perdre les
dernières transactions confirmées. Si c'est la seule disponible, l'écart doit être accepté par écrit.

### 3.2 Option B — PostgreSQL auto-hébergé : Patroni + etcd, 3 nœuds

Trois nœuds minimum (trois hôtes distincts, idéalement trois zones) : etcd a besoin d'un **quorum** (2 sur 3)
pour qu'un seul primaire soit élu ; avec deux nœuds, une coupure réseau ne permet pas de trancher sans risque
de double primaire.

Chaque nœud : PostgreSQL 16 + Patroni + membre etcd. Devant : HAProxy (ou keepalived + HAProxy) qui interroge
l'API REST de Patroni pour n'envoyer les écritures qu'au primaire.

**Configuration Patroni (extrait, section DCS — appliquée à tout le cluster)** :

```yaml
bootstrap:
  dcs:
    ttl: 30
    loop_wait: 10
    retry_timeout: 10
    maximum_lag_on_failover: 1048576
    synchronous_mode: true          # Patroni gère synchronous_standby_names
    synchronous_mode_strict: true   # aucun réplica synchrone disponible → le primaire BLOQUE les écritures
    synchronous_node_count: 1
    postgresql:
      use_pg_rewind: true
      parameters:
        synchronous_commit: "on"
        wal_level: replica
        archive_mode: "on"
        archive_timeout: 60
        archive_command: pgbackrest --stanza=acra archive-push %p
        max_wal_senders: 10
        max_replication_slots: 10
        hot_standby: "on"
```

Paramètres Patroni cités ci-dessus : `ttl`, `loop_wait`, `retry_timeout`, `maximum_lag_on_failover`,
`synchronous_mode`, `synchronous_mode_strict`, `synchronous_node_count`, `postgresql.use_pg_rewind`,
`postgresql.parameters` — noms **[à vérifier]** sur la version de Patroni déployée (ils figurent dans la
documentation « Dynamic Configuration Settings » de Patroni 3.x). Le `restore_command` (récupération des WAL
par un réplica ou une restauration) se déclare dans la section `postgresql` locale du nœud
(`recovery_conf.restore_command: pgbackrest --stanza=acra archive-get %f "%p"`) **[à vérifier]**.

**Le compromis `synchronous_mode_strict`** :

- `synchronous_mode: true` seul : une transaction n'est confirmée qu'après écriture sur le réplica synchrone.
  Patroni ne promeut lors d'une bascule qu'un nœud qui était synchrone ⇒ **pas de perte** de transaction
  confirmée. Mais si le réplica synchrone disparaît, Patroni **repasse en asynchrone** pour continuer à servir :
  pendant cette fenêtre, une perte du primaire perdrait des transactions.
- `synchronous_mode_strict: true` : dans ce cas, le primaire **cesse d'accepter les validations** (elles restent
  en attente) tant qu'aucun réplica synchrone n'est revenu. **L'application devient indisponible en écriture**
  (les lectures continuent), mais aucune transaction n'est confirmée sur un seul serveur.
- **Recommandation ACRA : `strict: true`** (intégrité avant disponibilité). Avec 3 nœuds, il faut perdre
  **deux** nœuds pour bloquer les écritures. Désactiver `strict` est une décision d'exploitation explicite et
  temporaire (`patronictl edit-config`), à tracer.

**HAProxy (extrait)** — routage vers le primaire d'après l'API REST de Patroni (port 8008 par défaut) :

```
listen postgres_primaire
    bind *:5000
    option httpchk OPTIONS /primary
    http-check expect status 200
    default-server inter 3s fall 3 rise 2 on-marked-down shutdown-sessions
    server pg1 10.0.0.1:5432 maxconn 200 check port 8008
    server pg2 10.0.0.2:5432 maxconn 200 check port 8008
    server pg3 10.0.0.3:5432 maxconn 200 check port 8008
```

`/primary` répond 200 uniquement sur le primaire (ancien nom `/master`, selon la version **[à vérifier]**).
`on-marked-down shutdown-sessions` coupe les connexions vers l'ancien primaire dès la bascule : le pool de
l'application se reconnecte au nouveau. HAProxy lui-même ne doit pas être un point unique de défaillance :
une instance par hôte applicatif, ou deux derrière une IP flottante (keepalived).

**pgbouncer (facultatif)** : utile si le nombre de connexions devient un problème (N réplicas × `DB_POOL_MAX`).
En mode `transaction`, l'application est compatible (verrous consultatifs uniquement transactionnels,
`pg_advisory_xact_lock`) mais **pas Prisma Migrate**, qui prend un verrou consultatif de session : le service
`migrator` doit utiliser `MIGRATION_DATABASE_URL` vers le port d'écriture HAProxy direct.

Dimensionnement des connexions : `ACRA_REPLICAS × DB_POOL_MAX` (défaut 3 × 10) + migrator + supervision
< `max_connections` du primaire.

### 3.3 Archivage continu et restauration à un instant donné — pgBackRest

Dépôt de sauvegarde sur un **stockage objet S3 compatible distinct** du bucket des documents (et idéalement
d'un autre fournisseur ou d'une autre région). Fichier `/etc/pgbackrest/pgbackrest.conf` (extrait) :

```ini
[global]
repo1-type=s3
repo1-s3-endpoint=s3.<region>.<fournisseur>
repo1-s3-bucket=acra-pgbackrest
repo1-s3-region=<region>
repo1-s3-key=<clé>
repo1-s3-key-secret=<secret>
repo1-s3-uri-style=path
repo1-path=/acra
repo1-retention-full=2
repo1-cipher-type=aes-256-cbc
repo1-cipher-pass=<phrase longue, conservée hors du serveur>
archive-async=y
compress-type=zst
start-fast=y

[acra]
pg1-path=/var/lib/postgresql/16/main
```

Commandes (noms d'options **[à vérifier]** sur la version installée, `pgbackrest help <commande>`) :

```sh
pgbackrest --stanza=acra stanza-create      # une fois
pgbackrest --stanza=acra check              # vérifie que l'archivage des WAL fonctionne
pgbackrest --stanza=acra --type=full backup # complète hebdomadaire ; --type=diff quotidienne
pgbackrest --stanza=acra info               # inventaire des sauvegardes et de l'archive WAL

# Restauration à un instant donné (cluster arrêté, sur un nœud vierge) :
pgbackrest --stanza=acra --delta --type=time \
  --target="2026-10-16 10:42:00+02" --target-action=promote restore
```

- **RPO** : 0 sur perte d'un nœud (réplication synchrone) ; en cas de perte totale du cluster, borné par
  `archive_timeout` (60 s ci-dessus) plus le délai de poussée asynchrone.
- La **phrase de chiffrement** perdue = sauvegardes inutilisables : la conserver dans le coffre de secrets.
- Avec Patroni, l'archivage fonctionne depuis le primaire courant ; après une bascule, `pgbackrest check`
  doit réussir sur le nouveau primaire.
- La sauvegarde logique `pg_dump` du profil mono-instance est désactivée dans le profil « ha » (service `backup`
  dans le profil Compose `base-locale`). Un `pg_dump` hebdomadaire supplémentaire reste une bonne pratique
  (export lisible, indépendant de la version de PostgreSQL).

---

## 4. Documents : stockage objet S3 compatible

Adaptateur `src/lib/document-storage-s3.ts`, **sans SDK** : signature AWS Signature Version 4 implémentée
avec `node:crypto`, transport `fetch`. Opérations : `PUT`, `GET`, `DELETE` (idempotent, 404 accepté), `HEAD`.

| Variable | Rôle |
|---|---|
| `DOCUMENT_STORAGE=s3` | active l'adaptateur |
| `S3_ENDPOINT` | `https://hôte[:port]`, sans chemin (ex. `https://s3.gra.io.cloud.ovh.net`) |
| `S3_REGION`, `S3_BUCKET` | région de signature, bucket |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | identifiants (utilisateur dédié, droits limités au bucket) |
| `S3_FORCE_PATH_STYLE` | défaut `true` (`https://hôte/bucket/clé`, accepté par les stockages compatibles) ; `false` = hôte virtuel |
| `S3_SSE` | `AES256` (ou `1`) : envoie `x-amz-server-side-encryption: AES256` (chiffrement côté serveur). Le KMS n'est pas pris en charge |
| `S3_PREFIX` | préfixe global facultatif (bucket mutualisé) |
| `S3_SESSION_TOKEN`, `S3_TIMEOUT_MS` | identifiants temporaires ; délai par requête (défaut 30 s) |

- **Clés** : `[S3_PREFIX/]<organizationId>/<documentId>/<fichier>` — déjà préfixées par organisation
  (`storageKeyFor`), ce qui permet une politique de cycle de vie ou un export par organisation. Clé vide,
  absolue ou contenant `..` refusée.
- **Intégrité** : chaque `PUT` porte `Content-MD5` (le serveur rejette un corps altéré en transit) et
  l'empreinte SHA-256 signée du corps. Aucun corps d'erreur S3 n'est relayé au client (codes `s3_<op>_echec:<statut>`).
- **Aucune URL publique** : l'accès aux documents passe toujours par une route authentifiée qui lit l'objet.

**Configuration du bucket (côté fournisseur)** :

1. **Versioning activé** : une suppression ou un écrasement crée un marqueur / une nouvelle version ; l'ancienne
   reste récupérable. Associer une règle de cycle de vie qui **expire les versions non courantes** (ex. 30 jours)
   — sans elle, les documents supprimés dans ACRA (y compris pour un effacement RGPD) restent indéfiniment.
2. **Chiffrement par défaut** du bucket activé (en plus, ou à la place, de `S3_SSE` : certains stockages
   compatibles refusent l'en-tête SSE s'ils ne gèrent pas de clé serveur — dans ce cas laisser `S3_SSE` vide).
3. **Bucket privé**, accès public bloqué, identifiants dédiés à ACRA.
4. **Verrouillage d'objet (Object Lock) — facultatif** : garantit qu'une version ne peut être supprimée avant
   l'échéance (protection contre un rançongiciel ou une suppression malveillante). Généralement à activer
   **à la création** du bucket. Attention : en mode « compliance », un effacement RGPD devient impossible
   avant l'échéance ; préférer le mode « governance » ou une rétention courte, et le documenter dans le
   registre des traitements.
5. Fournisseur **souverain** (hébergement et droit applicables UE ; qualification SecNumCloud si exigée).

**Migration des documents existants** (passage de mono-instance à « ha ») : copier le contenu du volume
`documents_data` vers le bucket **en conservant les chemins** (ils sont les clés), avant le premier démarrage
en `s3` — par exemple avec `rclone copy` ou `aws s3 sync` depuis le volume. Outil non fourni par ACRA **[non testé]**.

---

## 5. Redis

- Le profil « ha » fournit un conteneur `redis:7.4-alpine` protégé par mot de passe (`REDIS_PASSWORD`,
  **hexadécimal** recommandé — `openssl rand -hex 32` — car il est inséré dans l'URL), persistance AOF,
  `maxmemory-policy noeviction` (mémoire pleine → écritures refusées plutôt qu'évincer des compteurs, ce qui
  affaiblirait la protection).
- **Limite** : ce conteneur est sur **un** hôte. Comme les limites échouent « fermé », sa perte rend la connexion
  impossible jusqu'à son retour. Pour une disponibilité complète : Redis **managé** avec bascule derrière un
  point d'entrée unique (le client ACRA ne parle pas le protocole Sentinel ni Cluster), ou accepter
  explicitement `REDIS_OPTIONNEL=1` (qui ne couvre que le démarrage).
- Les données Redis sont **jetables** (compteurs à durée de vie courte) : pas de sauvegarde nécessaire.

---

## 6. Procédure de déploiement

Prérequis : base HA opérationnelle (§ 3), bucket S3 configuré (§ 4), DNS du domaine vers l'hôte Caddy.

1. Compléter `.env` (en plus des secrets habituels) :
   `DATABASE_URL` (port d'écriture HAProxy ou point d'entrée managé), éventuellement `MIGRATION_DATABASE_URL`,
   `NEXTAUTH_SECRET`, `NEXTAUTH_URL=https://<domaine>`, `REDIS_PASSWORD`, `S3_*`, `DOMAIN`, `ACME_EMAIL`,
   `CRON_SECRET`, `ACRA_REPLICAS` (défaut 3). Une variable obligatoire absente fait échouer
   `docker compose config` avec un message explicite.
2. Vérifier la configuration :
   ```sh
   docker compose -f docker-compose.yml -f docker-compose.production.yml -f docker-compose.ha.yml config -q
   ```
3. Démarrer :
   ```sh
   docker compose -f docker-compose.yml -f docker-compose.production.yml -f docker-compose.ha.yml up -d --build
   ```
   Ordre obtenu : `redis` sain → `migrator` (migrations, une seule fois) → réplicas `app` (chacun vérifie Redis
   et la configuration S3 au démarrage, sinon s'arrête) → `caddy` et `scheduler`.
4. Recette minimale : `/api/health` via le domaine ; connexion ; téléverser puis télécharger un document
   (vérifier l'objet dans le bucket) ; 3 échecs de connexion répartis sur plusieurs réplicas verrouillent bien
   le compte (si la politique est active) ; `docker stop` d'un réplica sans erreur visible ; journal du
   `scheduler` sans double exécution.

**Mise à jour** : le bouton « Mettre à jour » et `scripts/update.sh` sont conçus pour l'installation
mono-instance (`container_name` fixes, sauvegarde `pg_dump` locale) et **ne sont pas pris en charge** en
profil « ha ». Procédure : sauvegarde complète pgBackRest (ou point de restauration de l'hébergeur), puis
`docker compose … up -d --build` (migrations puis remplacement des réplicas). Les migrations doivent rester
compatibles « expand/contract » pour que l'ancienne et la nouvelle version coexistent pendant le remplacement
(lot H1.4 de la spec, non livré ici).

---

## 7. Procédures de bascule

| Événement | Comportement attendu | Action |
|---|---|---|
| Arrêt d'un réplica `app` | Caddy l'écarte (échec de connexion / contrôle de santé) ; Docker le redémarre (`restart: unless-stopped`) | aucune |
| Perte du primaire (Patroni) | après `ttl` (30 s), un réplica **synchrone** est promu ; HAProxy bascule ; requêtes en vol en erreur, reprises par l'utilisateur ou le renvoi automatique côté navigateur | `patronictl list`, vérifier `pgbackrest check` sur le nouveau primaire, réintégrer l'ancien nœud (pg_rewind) |
| Bascule planifiée (maintenance) | sans perte | `patronictl switchover` |
| Perte de deux nœuds sur trois | `synchronous_mode_strict` : écritures bloquées, lectures servies | rétablir un nœud ; ou, décision tracée, désactiver temporairement `strict` (`patronictl edit-config`) |
| Perte de Redis | connexions refusées et écritures API soumises à limite de débit en erreur (comportement « fermé ») ; la consultation fonctionne | redémarrer Redis ; aucune donnée à restaurer |
| Perte du stockage S3 | téléversements et téléchargements en erreur (410 / 500), le reste fonctionne | dépend du fournisseur ; versions restaurables |
| Corruption logique / erreur humaine | — | restauration à un instant donné (§ 3.3) sur un cluster neuf, puis bascule de `DATABASE_URL` |

---

## 8. Ce qui a été testé et ce qui ne l'a pas été

**Testé (16/10/2026)** :
- Tests unitaires : client Redis RESP2 contre un faux serveur TCP réel (authentification, base, pipeline,
  erreurs, reconnexion, délais) ; stores Redis des limites de débit et du verrouillage de compte (deux
  « instances » partageant un faux Redis voient le même verrou ; expiration ; verrou orphelin réparé) ;
  sélection du store au démarrage (absent → mémoire ; injoignable → refus ; `REDIS_OPTIONNEL=1` → repli) ;
  adaptateur S3 : signature SigV4 contre trois vecteurs de la documentation AWS (« GET Object » et
  « PUT Object » de la page *Signature Calculations for the Authorization Header: single chunk*, clé de
  signature dérivée de l'exemple IAM) — valeurs attendues reprises de la documentation AWS **de mémoire**, la
  page n'étant pas accessible depuis l'environnement de développement ; la concordance exacte des empreintes
  SHA-256 et des signatures HMAC rend une erreur de recopie très improbable, mais une relecture contre la page
  officielle reste conseillée ; requêtes PUT/GET/DELETE/HEAD avec `fetch` simulé.
- `docker compose … -f docker-compose.ha.yml config` : syntaxe et fusion valides ; variable obligatoire
  manquante → échec explicite.

**Non testé** :
- démarrage réel du profil « ha » (pas de démon Docker dans l'environnement de développement), donc ni
  Caddy (`Caddyfile.ha` non validé par `caddy validate`), ni la découverte DNS des réplicas, ni le contrôle de
  santé actif avec upstreams dynamiques ;
- adaptateur S3 contre un vrai stockage (OVH, Scaleway, MinIO, Garage) — en particulier l'acceptation de
  `Content-MD5` et de l'en-tête SSE par chaque fournisseur ;
- client Redis contre un vrai serveur Redis (seulement un faux serveur respectant RESP2) et en TLS ;
- Patroni, etcd, HAProxy, pgbouncer, pgBackRest : configurations d'exemple **non exécutées** ; paramètres
  marqués **[à vérifier]** ;
- bascules provoquées, mesures de RTO/RPO, charge multi-instance.

---

## 9. Questions ouvertes

1. **Clé des Server Functions et `deploymentId`** pour un déploiement progressif entre deux versions
   (`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, `deploymentId` dans `next.config.js`) — non configurés.
2. **Redis hautement disponible** : Redis managé (point d'entrée unique avec bascule) ou ajout de la prise en
   charge de Sentinel dans le client intégré ?
3. **Choix d'hébergement** (option A ou B) et du fournisseur S3 souverain — décision d'architecture.
4. **Mise à jour sans interruption** (lot H1.4 : migrations expand/contract, remplacement progressif) — à faire.
