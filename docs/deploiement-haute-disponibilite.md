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
| Limites de débit, verrouillage de compte | mémoire de l'instance | Redis (`REDIS_URL` managé, ou `REDIS_SENTINELS` — § 5) |
| Documents | volume local `documents_data` | S3 compatible (`DOCUMENT_STORAGE=s3`) |
| Base | conteneur `db` local | externe : managée ou Patroni (`DATABASE_URL`) |
| Sauvegarde | `pg_dump` quotidien (service `backup`) | PITR : hébergeur ou pgBackRest |
| Tâches planifiées | service `scheduler` | inchangé (un seul planificateur) + bail en base |

---

## 2. Application multi-instance

### 2.1 Ce que l'application garantit [vérifié par tests unitaires]

- **Sessions** : JWT signés avec `NEXTAUTH_SECRET`, sans état serveur. Toutes les instances doivent recevoir
  la **même** valeur (le profil « ha » la rend obligatoire).
- **Limites de débit et verrouillage de compte partagés** quand `REDIS_URL` ou `REDIS_SENTINELS` est défini
  (`src/lib/shared-store.server.ts`, appelé par `src/instrumentation.ts`) :
  - `rateLimit()` (connexion par e-mail, échecs par IP, écritures API, exports, imports, MCP…) et
    le **verrouillage de compte** (`login-lockout.ts`, politique « N échecs → verrouillage X min ») utilisent
    le même Redis. Sans cela, un attaquant répartissant ses essais sur N instances disposerait de N fois le seuil.
  - Client Redis **intégré, sans dépendance** (`src/lib/redis-resp.ts`, protocole RESP2 : `AUTH`, `SELECT`,
    `PING`, `INCR`, `PEXPIRE`, `PTTL`, `GET`, `DEL`, et en mode Sentinel `SENTINEL get-master-addr-by-name`,
    `ROLE`). Raison : l'image est construite en sortie
    « standalone » de Next.js et aucune dépendance n'est ajoutée pour une fonction optionnelle.
    URL : `redis://[utilisateur:motdepasse@]hôte[:port][/base]` ou `rediss://…` (TLS ; une autorité de
    certification privée se déclare par `NODE_EXTRA_CA_CERTS`) ; ou sentinelles (§ 5.3).
  - **Redis injoignable au démarrage → l'instance refuse de démarrer** (message explicite, code de sortie 1).
    Retomber en silence sur des compteurs locaux affaiblirait la protection anti-force brute sans que personne
    ne le voie. `REDIS_OPTIONNEL=1` autorise ce repli **explicitement** (avertissement dans les journaux).
  - **Redis indisponible en cours de fonctionnement** : les appels qui consultent un compteur échouent
    (connexion refusée avec un message dédié, écritures limitées en erreur 500) au lieu de passer sans limite,
    **dans un délai borné** (`REDIS_TIMEOUT_MS`, défaut 2 s) ; le client se reconnecte seul après une bascule.
    C'est un comportement « fermé » assumé ; il fait de Redis un composant critique (voir § 5).
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

- **Clé des Server Functions** : générée à chaque construction par défaut et embarquée dans le build. Le profil
  « ha » la fixe (`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, argument de construction **obligatoire**, base64 d'une clé
  AES de 16/24/32 octets) : identique pour tous les réplicas **et stable d'une version à l'autre**, condition pour
  que deux versions coexistent pendant une mise à jour progressive (§ 6.1). **[vérifié]** : nom et format lus dans
  `self-hosting.md` (« Server Functions encryption key ») et `data-security.md` de la version embarquée (Next 16.4).
  ACRA n'utilise aujourd'hui aucune Server Function (`"use server"` absent du code) : la clé est une précaution.
- **Identifiant de déploiement** (`deploymentId`, protection contre le décalage de versions) : posé par la variable
  `NEXT_DEPLOYMENT_ID` au `next build` (aucune modification de `next.config.js`, qui reste prioritaire s'il en
  définit un) = révision git (`ACRA_REVISION`). Effets documentés : `?dpl=<id>` sur les ressources statiques, en-tête
  `x-deployment-id` sur les navigations client, et **rechargement complet** de la page quand le navigateur et le
  réplica n'ont pas le même identifiant. Next.js ne route pas selon `?dpl=` : c'est l'affinité par cookie de Caddy
  qui garde un navigateur sur une seule version (§ 2.3).
- Caches en mémoire propres à chaque instance (sans effet sur l'intégrité) : rapport de stockage (5 min),
  garde « un VACUUM à la fois » (`storage-usage.server.ts`) — par instance, pas global.

### 2.3 Fichiers

- `docker-compose.ha.yml` — surcouche de `docker-compose.production.yml` ;
- `Caddyfile.ha` — frontal : `reverse_proxy` avec upstreams `dynamic a` (un enregistrement A par réplica),
  `lb_policy cookie acra_lb` (affinité : un navigateur reste sur le même réplica, donc sur une seule version
  pendant une mise à jour progressive ; cookie technique sans donnée personnelle ; premier choix et repli : politique
  par défaut de Caddy **[à vérifier]**), contrôle actif `health_uri /api/health` toutes les 5 s (200 attendu ;
  `/api/health` répond 503 si la base est injoignable, le schéma en retard ou le réplica en **drainage**, § 6.1),
  contrôle passif `fail_duration 30s`, nouvel essai sur un
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
| `S3_SSE` | **désactivé par défaut** (vide) ; `AES256` (ou `1`) : envoie `x-amz-server-side-encryption: AES256` (chiffrement côté serveur). Le KMS n'est pas pris en charge. **Recommandé** si le fournisseur l'accepte — voir ci-dessous |
| `S3_PREFIX` | préfixe global facultatif (bucket mutualisé) |
| `S3_SESSION_TOKEN`, `S3_TIMEOUT_MS` | identifiants temporaires ; délai par requête (défaut 30 s) |

- **Clés** : `[S3_PREFIX/]<organizationId>/<documentId>/<fichier>` — déjà préfixées par organisation
  (`storageKeyFor`), ce qui permet une politique de cycle de vie ou un export par organisation. Clé vide,
  absolue ou contenant `..` refusée.
- **Intégrité** : chaque `PUT` porte `Content-MD5` (le serveur rejette un corps altéré en transit) et
  l'empreinte SHA-256 signée du corps. Aucun corps d'erreur S3 n'est relayé au client (codes `s3_<op>_echec:<statut>`).
- **Aucune URL publique** : l'accès aux documents passe toujours par une route authentifiée qui lit l'objet.

**Recommandation : chiffrement au repos + versioning (les deux).** Les documents d'analyse de risque sont
sensibles ; ACRA ne chiffre pas lui-même les octets envoyés au stockage. `S3_SSE` reste **désactivé par défaut**
(un fournisseur qui ne gère pas de clé serveur refuserait chaque téléversement), mais le chiffrement côté
serveur est **recommandé**, par l'un de ces deux moyens :

- **de préférence, chiffrement par défaut du bucket** (configuré chez le fournisseur) : il s'applique à tout
  objet, y compris ceux copiés hors d'ACRA (migration `rclone`/`aws s3 sync`), sans dépendre de la
  configuration de l'application ;
- **sinon, `S3_SSE=AES256`** si le fournisseur accepte l'en-tête `x-amz-server-side-encryption: AES256`
  (le vérifier par un téléversement d'essai : un refus se traduit par `s3_put_echec:<statut>`). Les deux
  peuvent être cumulés.

**Configuration du bucket (côté fournisseur)** :

1. **Versioning activé** (recommandé) : une suppression ou un écrasement crée un marqueur / une nouvelle
   version ; l'ancienne reste récupérable. Associer une règle de cycle de vie qui **expire les versions non
   courantes** (ex. 30 jours) — sans elle, les documents supprimés dans ACRA (y compris pour un effacement RGPD)
   restent indéfiniment.
2. **Chiffrement par défaut** du bucket activé (recommandé, cf. ci-dessus ; en plus, ou à la place, de
   `S3_SSE` : certains stockages compatibles refusent l'en-tête SSE s'ils ne gèrent pas de clé serveur — dans
   ce cas laisser `S3_SSE` vide).
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

Redis porte les limites de débit et le verrouillage de compte. Comme ils échouent « fermé » (intégrité avant
disponibilité), **un Redis unique est un point de défaillance de la connexion** : sans Redis, personne ne se
connecte. Le profil « ha » fournit un conteneur `redis:7.4-alpine` sur **un** hôte (protégé par mot de passe
`REDIS_PASSWORD`, **hexadécimal** recommandé — `openssl rand -hex 32` — car il est inséré dans l'URL ; AOF ;
`noeviction`) : suffisant pour un essai, **pas** pour une production hautement disponible. Deux options, au
choix de l'hébergement :

| | Option 1 — Redis **managé** (recommandé si l'hébergeur le propose) | Option 2 — **Redis Sentinel** auto-hébergé |
|---|---|---|
| Point d'entrée | un seul nom DNS, bascule gérée par l'hébergeur | 3 sentinelles qui désignent le primaire |
| Configuration ACRA | `REDIS_URL=rediss://…` | `REDIS_SENTINELS=hote1:26379,hote2:26379,hote3:26379`, `REDIS_SENTINEL_MASTER=acra` |
| Code ACRA | rien de spécifique : reconnexion automatique | découverte du primaire intégrée au client |
| Exploitation | à la charge de l'hébergeur | 3 hôtes, supervision, mises à jour |

### 5.1 Comportement du client pendant une bascule [vérifié]

Client intégré `src/lib/redis-resp.ts` (sans dépendance) :

- **Délais courts et configurables** : `REDIS_TIMEOUT_MS` (défaut **2 000 ms**, de 100 à 60 000) borne
  chaque étape : établissement de la connexion, chaque commande de la poignée de main (`AUTH`, `SELECT`,
  `ROLE`, requête à la sentinelle) et chaque commande. Une requête de connexion n'attend donc jamais
  indéfiniment ; en pratique un Redis arrêté répond « connexion refusée » immédiatement, et seul un hôte muet
  (paquets perdus) consomme le délai — en mode Sentinel, une fois par sentinelle muette essayée.
- **Erreur stable** : toute panne de transport rejette l'appel avec `redis_indisponible` (détail sans secret
  dans `code` : `ECONNREFUSED`, `redis_timeout`, `redis_lecture_seule`, `redis_pas_primaire`,
  `redis_primaire_inconnu`, `WRONGPASS`…). La page de connexion affiche « Connexion momentanément
  indisponible… » au lieu de « mot de passe incorrect » ; les autres routes limitées répondent en erreur 500.
- **Reconnexion** : connexion coupée, délai dépassé ou réponse `-READONLY` (ancien primaire rétrogradé en
  réplique) → la connexion est **fermée** et les commandes en vol sont rejetées ; la commande suivante ouvre une
  **nouvelle** connexion (nouvelle résolution DNS — Node.js ne met pas le DNS en cache —, ou nouvelle
  découverte par les sentinelles). Aucune commande n'est rejouée automatiquement ; aucun redémarrage d'ACRA
  n'est nécessaire. Sonde TCP `keepalive` pour détecter un pair disparu sans fermeture.
- **Démarrage** : Redis injoignable → refus de démarrer (sauf `REDIS_OPTIONNEL=1`) ; configuration incohérente
  (`REDIS_URL` **et** `REDIS_SENTINELS`, `REDIS_SENTINELS` sans `REDIS_SENTINEL_MASTER`, délai invalide, mot de
  passe contradictoire entre `REDIS_URL` et `REDIS_PASSWORD`) → refus de démarrer **toujours**, même avec
  `REDIS_OPTIONNEL=1`.

### 5.2 Option 1 — Redis managé

- `REDIS_URL=rediss://[utilisateur:motdepasse@]point-d-entree:port[/base]` (TLS ; une autorité de
  certification privée se déclare par `NODE_EXTRA_CA_CERTS`). Mot de passe dans l'URL **ou** dans
  `REDIS_PASSWORD` (et `REDIS_USERNAME` pour un utilisateur ACL).
- Choisir une offre **avec réplica et bascule automatique** (un seul nœud managé reste un point de défaillance),
  hébergée dans l'UE, avec persistance activée si l'offre la propose.
- Pendant la bascule de l'hébergeur (généralement quelques secondes) : connexions refusées avec le message
  dédié, reprise automatique dès que le point d'entrée désigne le nouveau primaire.
- Le mode Redis **Cluster** (clés réparties sur plusieurs primaires) n'est **pas** pris en charge : choisir une
  offre « primaire + réplicas » (non cluster).

### 5.3 Option 2 — Redis Sentinel auto-hébergé (3 nœuds)

- **Topologie** : 3 hôtes distincts (idéalement 3 zones), chacun avec un `redis-server` (1 primaire, 2 réplicas)
  et un `redis-sentinel`. **Quorum 2** : 2 sentinelles sur 3 doivent constater la panne pour lancer la bascule,
  et une majorité (2) doit autoriser l'élection — la perte d'un hôte est tolérée, pas celle de deux. Ne jamais
  placer 2 sentinelles sur le même hôte (sa perte ferait perdre la majorité).
- **Variables ACRA** :

  | Variable | Rôle |
  |---|---|
  | `REDIS_SENTINELS` | `hote1:26379,hote2:26379,hote3:26379` (port 26379 par défaut, IPv6 entre crochets) ; essayées **dans l'ordre**, celle qui répond passe en tête |
  | `REDIS_SENTINEL_MASTER` | nom du primaire surveillé (`sentinel monitor <nom> …`), ex. `acra` |
  | `REDIS_SENTINEL_PASSWORD` | mot de passe des sentinelles (`requirepass` des sentinelles), facultatif |
  | `REDIS_PASSWORD`, `REDIS_USERNAME` | authentification sur le primaire (`REDIS_USERNAME` : utilisateur ACL, facultatif) |
  | `REDIS_TLS=1` | TLS vers les sentinelles **et** le primaire (le certificat doit couvrir l'adresse annoncée par Sentinel, souvent une IP) **[non testé]** |

- **Fonctionnement** : à chaque (re)connexion, ACRA demande `SENTINEL get-master-addr-by-name <nom>` à la
  première sentinelle joignable, se connecte à l'adresse obtenue, s'authentifie puis vérifie `ROLE` = `master`
  (une sentinelle en retard qui désigne une réplique est écartée, la suivante est interrogée).
- **Configuration conseillée** (extrait, à adapter ; `sentinel.conf` est réécrit par Sentinel, il doit être
  inscriptible) :

  ```conf
  # redis.conf (3 nœuds ; sur les réplicas : replicaof <ip-primaire> 6379)
  requirepass <mot-de-passe>
  masterauth <mot-de-passe>
  appendonly yes
  appendfsync everysec
  maxmemory 256mb
  maxmemory-policy noeviction
  protected-mode yes
  bind <ip-privée>
  # Limite la perte d'incréments lors d'une bascule (réplication asynchrone), au prix d'écritures refusées
  # si aucun réplica n'est à jour — cohérent avec le choix « fermé » :
  min-replicas-to-write 1
  min-replicas-max-lag 10

  # sentinel.conf (3 nœuds)
  port 26379
  sentinel monitor acra <ip-primaire> 6379 2
  sentinel auth-pass acra <mot-de-passe>
  sentinel down-after-milliseconds acra 5000
  sentinel failover-timeout acra 60000
  sentinel parallel-syncs acra 1
  requirepass <mot-de-passe-sentinelles>
  sentinel sentinel-pass <mot-de-passe-sentinelles>
  # Derrière Docker/NAT : annoncer l'adresse joignable par ACRA (sinon Sentinel annonce l'IP interne)
  # sentinel announce-ip <ip> / replica-announce-ip <ip>  [à vérifier selon le réseau]
  ```

- Durée d'indisponibilité attendue ≈ `down-after-milliseconds` + élection + promotion (quelques secondes) ;
  mesurée à **2,25 s** avec `down-after-milliseconds 1000` dans l'essai local (§ 8).

### 5.4 Paramètres conseillés (les deux options)

- `maxmemory-policy noeviction` : mémoire pleine → écritures refusées plutôt qu'éviction de compteurs (qui
  affaiblirait la protection anti-force brute).
- `appendonly yes` : un redémarrage ne remet pas tous les verrous à zéro.
- **Mot de passe fort ou ACL** dédiée à ACRA, limitée à ses clés et commandes, par exemple :
  `user acra on ><mot-de-passe> ~rl:* ~lo:* +ping +select +role +incr +pexpire +pttl +get +del +quit`
  (`+role` nécessaire en mode Sentinel), puis `REDIS_USERNAME=acra`.
- **TLS** dès que Redis n'est pas sur un réseau privé dédié (`rediss://` ou `REDIS_TLS=1`).
- Réseau : Redis et Sentinel jamais exposés publiquement (pare-feu limité aux hôtes ACRA et Redis).
- Les données Redis sont **à durée de vie courte** (compteurs, verrous) : pas de sauvegarde nécessaire. Une
  bascule peut perdre les tout derniers incréments non encore répliqués (quelques tentatives supplémentaires
  accordées à un attaquant) ; `min-replicas-to-write` réduit ce risque.

---

## 6. Procédure de déploiement

Prérequis : base HA opérationnelle (§ 3), bucket S3 configuré (§ 4), DNS du domaine vers l'hôte Caddy.

1. Compléter `.env` (en plus des secrets habituels) :
   `DATABASE_URL` (port d'écriture HAProxy ou point d'entrée managé), éventuellement `MIGRATION_DATABASE_URL`,
   `NEXTAUTH_SECRET`, `NEXTAUTH_URL=https://<domaine>`, `REDIS_PASSWORD`, `S3_*`, `DOMAIN`, `ACME_EMAIL`,
   `CRON_SECRET`, `ACRA_REPLICAS` (défaut 3), `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` (`openssl rand -base64 32`,
   à générer **une fois** et à ne plus changer, § 2.2). Une variable obligatoire absente fait échouer
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

### 6.1 Mise à jour sans interruption (lot H1.4)

**Ne jamais mettre à jour par `docker compose … up -d --build`** : Compose recréerait tous les réplicas en même
temps (coupure) et appliquerait les migrations sans point de restauration. `scripts/update.sh` et le bouton
« Mettre à jour » de l'interface, conçus pour le mono-instance (arrêt de l'application, `pg_dump` local), **refusent**
le profil « ha » (code `ha_profile`) et renvoient vers :

```sh
# dans le dossier d'ACRA, avec l'utilisateur qui pilote Docker
scripts/update-ha.sh stable --backup-cmd "pgbackrest --stanza=acra backup --type=full"   # sauvegarde lancée par le script
scripts/update-ha.sh stable --pitr-confirmed      # ou : restauration à un instant donné active et vérifiée (§ 3.3)
```

Variables : `ACRA_COMPOSE_FILES` (défaut : les trois fichiers du profil « ha »), `ACRA_HA_BACKUP_CMD` (équivalent de
`--backup-cmd`), `ACRA_HA_DRAIN_SECONDS` (12), `ACRA_HA_STOP_TIMEOUT` (30), `ACRA_HEALTH_RETRIES` (60) ×
`ACRA_HEALTH_INTERVAL` (5 s). Options : `beta` au lieu de `stable`, `--replicas N`, `--allow-contract` (ci-dessous),
`--yes` (sans confirmation).

**Déroulé** (journal `.acra-update/ha/last.json`, événements `.acra-update/events.log`) :

| Étape | Ce qui se passe | En cas d'échec |
|---|---|---|
| PRECHECK | profil « ha », Compose ≥ 2.24.4, arbre git propre, avance rapide possible, **point de restauration exigé**, aucune migration « contract » dans l'intervalle (sauf `--allow-contract`), tous les réplicas démarrés, **sur une même image** et sains ; l'image en service est étiquetée `acra-app:ha-rollback` | rien n'est modifié |
| BACKUP | `--backup-cmd` exécutée (sauvegarde de la base **externe**) ; l'instant qui précède la migration est journalisé comme **cible de restauration** | rien n'est modifié |
| FETCH, BUILD | code de la cible (avance rapide), `docker compose config -q` (variable obligatoire manquante ⇒ arrêt), construction de l'image `acra-app:v<cible>` avec la clé fixe et `NEXT_DEPLOYMENT_ID` = révision | code d'origine rétabli ; réplicas intacts |
| MIGRATE | `migrator` **une seule fois** (connexion directe au primaire, `MIGRATION_DATABASE_URL`), sans `migrate resolve` automatique, **pendant que l'ancienne version sert** | code rétabli, réplicas intacts (ils servent toujours l'ancienne version) ; **la base n'est pas restaurée automatiquement** (des écritures continuent) : diagnostic runbook § 2, restauration à l'instant journalisé seulement sur décision |
| ROLL | pour chaque réplica : `up -d --no-deps --no-build --no-recreate --scale app=<n+1> app` démarre **un** réplica de la nouvelle image à côté des anciens ; attente de **son** `/api/health?deep=1` (statut `ok`, révision cible, aucune migration en attente/en échec) ; puis un ancien est **drainé** (`/tmp/acra-drain` ⇒ `/api/health` 503 ⇒ Caddy cesse de lui envoyer des requêtes), attente `ACRA_HA_DRAIN_SECONDS`, arrêt `SIGTERM` (requêtes en cours terminées, `stop_grace_period: 30s`) et suppression | le réplica fautif est supprimé ; les réplicas déjà remplacés reviennent **un par un** à l'image `ha-rollback` (même mécanisme) ; code rétabli ; état `ROLLED_BACK`. Les migrations de la cible **restent** (compatibles « expand ») |
| FINALIZE | planificateur recréé ; avertissement si `Caddyfile.ha` a changé (rechargement manuel, coupure de quelques secondes) ; `.acra-update/ha/version.env` (à charger avant toute commande Compose : `set -a; . .acra-update/ha/version.env; set +a`) ; anciennes étiquettes `acra-app` retirées (cible et précédente conservées) | non bloquant |

Un signal (Ctrl-C, session SSH coupée) reçu après la construction n'interrompt pas le script : il va jusqu'au
succès ou au retour arrière. Une seule mise à jour à la fois (verrou partagé avec `scripts/update.sh`).

**Pourquoi cette méthode** : `docker compose up --scale` avec `--no-recreate` est la seule façon, avec Compose seul,
d'ajouter un conteneur d'une nouvelle image **sans recréer** les conteneurs existants (même principe que l'outil
`docker-rollout`). `docker compose up` sans `--no-recreate` recrée tous les conteneurs dont la configuration a changé ;
`--scale` à la baisse retire des conteneurs choisis par Compose, d'où le retrait explicite (`docker rm`) des anciens.
Prérequis déjà remplis par le profil : pas de `container_name` ni de port publié sur `app`.

#### Règle « expand/contract » des migrations

Pendant ROLL, la version N tourne sur une base **déjà migrée pour N+1**. Donc :

1. **Expand (N+1)** : ajouter seulement — table, colonne **nullable ou avec `DEFAULT` en base** (pas un défaut
   seulement côté Prisma : N insère sans connaître la colonne), index, copie de données. N continue de fonctionner.
2. **Contract (N+2 ou plus tard)** : supprimer, renommer, changer le type, `SET NOT NULL`, `ADD COLUMN … NOT NULL` sans
   `DEFAULT`, renommer une valeur d'enum… **uniquement** ce qu'aucune version encore en service ne lit ni n'écrit. Un
   renommage = ajouter la nouvelle colonne + copier (N+1, le code lit la nouvelle) puis supprimer l'ancienne (N+2).
3. **Valeur d'enum ajoutée** : le client Prisma de N échoue en lisant une valeur qu'il ne connaît pas. La version qui
   ajoute la valeur ne doit pas encore l'écrire, ou l'écran concerné de N peut échouer pendant la fenêtre de
   remplacement (quelques minutes) — règle non vérifiable automatiquement, à relire en revue.

**Garde-fou automatique** [vérifié par tests] : toute migration horodatée à partir du `20261016000000`
(`EXPAND_CONTRACT_DEPUIS`, `src/lib/migration-policy.ts`) classée destructive (`DROP TABLE/COLUMN/TYPE/SCHEMA`,
`TRUNCATE`, `RENAME`, `RENAME VALUE`, `ALTER COLUMN … TYPE`, `SET NOT NULL`, `ADD COLUMN … NOT NULL` sans `DEFAULT`)
doit porter, en plus de l'en-tête historique `-- acra:destructive <raison>`, la marque
`-- contract: <justification ≥ 10 caractères>` (ex. `-- contract: "x" n'est plus lu ni écrit depuis la 1.2.0`).
Contrôlé en CI (`scripts/check-migrations.ts --ci`, workflow « Migrations Prisma ») et par le cliquet
`src/__tests__/unit/lib/migration-expand-contract.test.ts` sur toutes les migrations du dépôt. Au déploiement,
`update-ha.sh` refuse une montée dont l'intervalle contient une migration marquée (`contract:` ou
`acra:destructive`) sans `--allow-contract` : cas typique, un saut de N à N+2 où N lit encore la colonne supprimée
par N+2 → passer d'abord par N+1, ou planifier une courte maintenance.

#### Deux versions en même temps : ce qui les rend compatibles

- **Clé des Server Functions** fixe et partagée (§ 2.2) — argument de construction, obligatoire dans le profil ;
- **`deploymentId`** = révision (§ 2.2) + **affinité par cookie** dans Caddy : un navigateur reste sur une version ;
  quand son réplica est retiré, il passe sur la nouvelle et Next.js recharge la page entière (l'état non enregistré
  d'un formulaire peut être perdu ; les saisies conservées dans le navigateur sont renvoyées, cf. spec § 5) ;
- **en-têtes de cache** : Next.js sert `/_next/static/*` en `public, max-age=31536000, immutable` (noms à empreinte
  de contenu, + `?dpl=`), les API en `no-store` (`next.config.js`) ; Caddy ne met rien en cache et ne réécrit pas
  `Cache-Control` (test `ha-deploiement-config.test.ts`). Une ressource d'une version absente de l'autre ne peut donc
  pas rester en cache sous une mauvaise forme ;
- **santé** : un réplica de N ne devient pas « dégradé » après les migrations de N+1 (une migration inconnue de
  l'image n'est pas une migration en attente : `migration-drift.ts`, `unknownInImage`).

#### Bouton de l'interface

En profil « ha » (`ACRA_DEPLOY_PROFILE=ha`, posé par la surcouche), la carte « Version » n'affiche **pas** le bouton
« Mettre à jour » mais la procédure ci-dessus ; l'API `POST /api/admin/version/update` répond 409 `ha_profile`.
Choix délibéré : l'agent hôte s'exécute sans surveillance, alors que la mise à jour d'une base externe exige un point de
restauration que seul l'exploitant peut garantir (sauvegarde chez l'hébergeur, PITR vérifié) ; une montée qui inclut une
migration « contract » demande aussi une décision humaine. Le bouton reste celui du mono-instance.

#### Limites [non testé en conditions réelles]

- Script vérifié par tests unitaires contre un `docker` **simulé** (état des conteneurs et des images) ; aucune
  exécution contre un vrai démon Docker ni un vrai Caddy dans l'environnement de développement. À la recette :
  confirmer que `up --no-recreate --scale` ne recrée pas les anciens réplicas avec la version de Compose installée,
  et mesurer les erreurs côté client pendant une mise à jour (charge continue + `curl` en boucle via le domaine).
- **Caddy** : prise en charge du contrôle actif et de `lb_policy cookie` avec des upstreams `dynamic a`, délai de prise
  en compte du drainage (5 s d'intervalle, 12 s d'attente) **[à vérifier]**. Sans contrôle actif, le retrait repose sur
  le contrôle passif et le nouvel essai (`lb_try_duration`) : une requête **non-GET** en cours de connexion vers un
  réplica arrêté peut échouer (affichée en erreur, à relancer) — jamais rejouée en double.
- Le rafraîchissement DNS de Caddy (`refresh 10s`) retarde l'utilisation d'un nouveau réplica ; sans effet sur la
  disponibilité (les anciens servent pendant ce temps).
- Le script de mise à jour est celui de la version **installée** (pas de passage de main à la version cible comme
  `update.sh`) : une évolution du déroulé ne s'applique qu'à la mise à jour suivante.
- `Caddyfile.ha` modifié par une version : rechargement manuel (coupure de quelques secondes).
- Pas de retour arrière automatique de la **base** : par construction (expand), l'ancienne version fonctionne sur la
  base migrée ; une restauration à un instant donné perdrait les écritures faites depuis et reste une décision
  d'exploitation (runbook § 6).

---

## 7. Procédures de bascule

| Événement | Comportement attendu | Action |
|---|---|---|
| Arrêt d'un réplica `app` | Caddy l'écarte (échec de connexion / contrôle de santé) ; Docker le redémarre (`restart: unless-stopped`) | aucune |
| Perte du primaire (Patroni) | après `ttl` (30 s), un réplica **synchrone** est promu ; HAProxy bascule ; requêtes en vol en erreur, reprises par l'utilisateur ou le renvoi automatique côté navigateur | `patronictl list`, vérifier `pgbackrest check` sur le nouveau primaire, réintégrer l'ancien nœud (pg_rewind) |
| Bascule planifiée (maintenance) | sans perte | `patronictl switchover` |
| Perte de deux nœuds sur trois | `synchronous_mode_strict` : écritures bloquées, lectures servies | rétablir un nœud ; ou, décision tracée, désactiver temporairement `strict` (`patronictl edit-config`) |
| Perte du primaire Redis (managé ou Sentinel) | pendant la bascule (quelques secondes) : connexions refusées avec message dédié, écritures API limitées en erreur ; reprise **automatique** (reconnexion, redécouverte du primaire) | aucune côté ACRA ; vérifier `SENTINEL get-master-addr-by-name acra` et réintégrer l'ancien nœud (Sentinel le reconfigure en réplique à son retour) |
| Perte de Redis (instance unique, ou 2 hôtes Sentinel sur 3) | connexions refusées et écritures API soumises à limite de débit en erreur (comportement « fermé », chaque appel échoue en moins de `REDIS_TIMEOUT_MS`) ; la consultation fonctionne | rétablir Redis ; aucune donnée à restaurer |
| Perte du stockage S3 | téléversements et téléchargements en erreur (410 / 500), le reste fonctionne | dépend du fournisseur ; versions restaurables |
| Corruption logique / erreur humaine | — | restauration à un instant donné (§ 3.3) sur un cluster neuf, puis bascule de `DATABASE_URL` |

---

## 8. Ce qui a été testé et ce qui ne l'a pas été

**Testé (16/10/2026)** :
- Tests unitaires : client Redis RESP2 contre un faux serveur TCP réel (authentification, base, pipeline,
  erreurs, reconnexion, délais) ; stores Redis des limites de débit et du verrouillage de compte (deux
  « instances » partageant un faux Redis voient le même verrou ; expiration ; verrou orphelin réparé) ;
  sélection du store au démarrage (absent → mémoire ; injoignable → refus ; `REDIS_OPTIONNEL=1` → repli ;
  `REDIS_URL` et `REDIS_SENTINELS` exclusifs ; `REDIS_TIMEOUT_MS`) ; reconnexion après bascule (`-READONLY`,
  connexion coupée, serveur relancé sur le même point d'entrée) ; Sentinel contre de fausses sentinelles TCP
  (découverte, sentinelle injoignable ignorée, sentinelle obsolète désignant une réplique écartée par `ROLE`,
  nom inconnu, redécouverte après bascule, délais bornés) ;
  adaptateur S3 : signature SigV4 contre trois vecteurs de la documentation AWS (« GET Object » et
  « PUT Object » de la page *Signature Calculations for the Authorization Header: single chunk*, clé de
  signature dérivée de l'exemple IAM) — valeurs attendues reprises de la documentation AWS **de mémoire**, la
  page n'étant pas accessible depuis l'environnement de développement ; la concordance exacte des empreintes
  SHA-256 et des signatures HMAC rend une erreur de recopie très improbable, mais une relecture contre la page
  officielle reste conseillée ; requêtes PUT/GET/DELETE/HEAD avec `fetch` simulé.
- **Redis réel 7.0.15 (16/10/2026, local, hors Docker)** : 1 primaire + 1 réplique + 3 sentinelles (quorum 2,
  `down-after-milliseconds 1000`), client en mode Sentinel avec une 1re sentinelle injoignable dans la liste ;
  `SIGKILL` du primaire pendant une boucle d'`INCR` toutes les 200 ms → 11 appels en échec
  (`redis_indisponible` : `ECONNRESET`, `ECONNREFUSED`), aucun appel au-delà du délai, **première écriture
  réussie 2,25 s après la panne** sur le nouveau primaire, compteur continu (aucun incrément perdu dans cet
  essai). Ancien primaire relancé → reconfiguré en réplique → client à point d'entrée fixe : `INCR` rejeté
  `redis_lecture_seule`, puis accepté sur une nouvelle connexion après `SENTINEL FAILOVER`. ACL dédiée
  (§ 5.4) : commandes et clés `rl:*` / `lo:*` acceptées, autre clé refusée (`NOPERM`), mauvais mot de passe →
  `WRONGPASS`.
- `docker compose … -f docker-compose.ha.yml config` : syntaxe et fusion valides ; variable obligatoire
  manquante → échec explicite.
- **Mise à jour progressive (lot H1.4)** — tests unitaires : `scripts/update-ha.sh` contre un dépôt git réel et
  un `docker` simulé avec état (ordre sauvegarde → construction → migrations une seule fois → pour chaque réplica :
  démarrage, santé du nouveau, drainage puis arrêt d'un ancien ; refus sans point de restauration, sauvegarde en échec,
  Compose trop ancien, réplicas sur des images différentes, migration « contract » sans `--allow-contract` ;
  migration en échec → réplicas intacts ; nouveau réplica non sain → retour arrière réplica par réplica) ;
  `update.sh` refuse le profil « ha » ; drainage de `/api/health` ; bouton remplacé par la procédure ; cliquet
  expand/contract sur les migrations du dépôt ; `docker compose config` avec la clé et l'identifiant de déploiement
  fusionnés dans les arguments de construction d'`app` et de `migrator` (clé absente → échec explicite).

**Non testé** :
- démarrage réel du profil « ha » (pas de démon Docker dans l'environnement de développement), donc ni
  Caddy (`Caddyfile.ha` non validé par `caddy validate`), ni la découverte DNS des réplicas, ni le contrôle de
  santé actif avec upstreams dynamiques ;
- adaptateur S3 contre un vrai stockage (OVH, Scaleway, MinIO, Garage) — en particulier l'acceptation de
  `Content-MD5` et de l'en-tête SSE par chaque fournisseur ;
- client Redis en **TLS** (`rediss://`, `REDIS_TLS=1`) contre un vrai serveur ; contre une offre Redis
  **managée** réelle (bascule de l'hébergeur) ; Sentinel dans Docker/derrière NAT (`announce-ip`) ;
  `min-replicas-to-write` ; Redis 7.4 (essai fait en 7.0.15) ;
- Patroni, etcd, HAProxy, pgbouncer, pgBackRest : configurations d'exemple **non exécutées** ; paramètres
  marqués **[à vérifier]** ;
- bascules provoquées, mesures de RTO/RPO, charge multi-instance ;
- mise à jour progressive réelle (`scripts/update-ha.sh` contre un vrai démon Docker et un vrai Caddy) : absence
  d'erreur côté client, comportement de `up --no-recreate --scale`, `lb_policy cookie` avec upstreams dynamiques,
  rechargement sur changement de `deploymentId` (§ 6.1, « Limites »).

---

## 9. Questions ouvertes

1. **Clé des Server Functions et `deploymentId`** — *tranché (lot H1.4)* : `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`
   obligatoire dans le profil, `NEXT_DEPLOYMENT_ID` = révision, affinité par cookie dans Caddy (§ 2.2, § 6.1).
2. **Redis hautement disponible** — *tranché* : Redis managé (option 1) ou Redis Sentinel 3 nœuds (option 2),
   tous deux pris en charge (§ 5) ; reste à choisir selon l'hébergement retenu (question 3).
3. **Choix d'hébergement** (option A ou B) et du fournisseur S3 souverain — décision d'architecture.
4. **Mise à jour sans interruption** — *livré (lot H1.4)* : `scripts/update-ha.sh`, règle expand/contract
   et garde-fou (§ 6.1) ; reste la recette sur une infrastructure réelle (§ 8, « Non testé »).
