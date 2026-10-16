# Scalabilité, résilience et haute disponibilité — cadrage du chantier

**Ouvert le 16 octobre 2026.** Question posée : *ACRA peut-il servir une grande entreprise (milliers
d'utilisateurs, dizaines de filiales, milliers d'analyses, de risques et de contrôles) de façon
résiliente et hautement disponible ?*

Ce document s'appuie sur un inventaire du code (lecture complète, preuves `fichier:ligne`) et sur des
**mesures réelles** faites sur un serveur de production local avec un jeu de données « grand groupe ».
Il distingue ce qui est **corrigé**, ce qui est **mesuré**, et ce qui reste **à décider**.

## 1. Réponse courte

| Question | Réponse au 16/10/2026 |
|---|---|
| Volumétrie d'un grand groupe | **Non en l'état pour les très grosses entités.** Les listes ne sont pas paginées : pour une entité de 10 000 contrôles, la liste des contrôles pèse 22,8 Mo et met 30 s sous 20 requêtes simultanées. Les entités de taille courante (quelques centaines d'éléments) répondent en 15 à 30 ms. |
| Haute disponibilité | **Non en l'état.** Un seul hôte, une seule instance applicative, une base sans réplique. L'application est prête pour plusieurs instances côté sessions (JWT) mais pas côté limites de débit, verrouillage de compte et stockage des documents. |
| Résilience / reprise | **Partielle.** Sauvegardes vérifiées, chiffrées, avec retour arrière automatique à la mise à jour ; mais perte de données maximale de 24 h (pas d'archivage continu) et reprise manuelle en cas de perte de l'hôte. |

## 2. Mesures (serveur de production local, 4 cœurs, PostgreSQL 16)

Jeu « grand groupe » : 1 groupe et 49 filiales, 5 001 utilisateurs, 5 000 analyses (dont 50 de
200 risques et 300 mesures), 20 000 risques au registre, 10 000 contrôles × 12 exécutions
(120 000), 5 000 incidents, 20 000 plans d'action. Utilisateur : RSSI groupe (portée sous-arbre).
Script de génération : SQL `generate_series`, base de recette uniquement.

**Entité de taille courante** (organisation active = groupe ou filiale de quelques centaines d'éléments) :
toutes les listes répondent en **13 à 31 ms** (médiane) ; la vue consolidée `/api/grc/rollup` en 0,9 s.

**Entité très volumineuse** (tout le volume concentré dans une filiale), appels séquentiels :

| Route | Médiane | Taille de réponse |
|---|---|---|
| `/api/analyses` (5 000 analyses) | 0,14 s | 2,0 Mo |
| `/api/risk-items` (20 000 risques) | 0,51 s | **15,8 Mo** |
| `/api/controles` (10 000 contrôles) | 1,63 s | **22,8 Mo** |
| plans d'action de l'organisation (20 000) | 0,29 s | 6,1 Mo |
| `/api/grc/rollup` (vue consolidée) | 0,96 s | 1,8 Ko |

**Sous charge simultanée** (même entité) :

| Route | Simultanées | p50 | p95 | Débit | Erreurs |
|---|---|---|---|---|---|
| `/api/analyses` | 20 | 2,2 s | 2,6 s | 8,6 req/s | 0 |
| `/api/analyses` | 50 | 5,3 s | 5,9 s | 9,4 req/s | 0 |
| `/api/controles` | 20 | 28,7 s | 32,0 s | 0,7 req/s | 0 |
| `/api/grc/rollup` | 10 | 8,9 s | 9,8 s | 1,1 req/s | 0 |

**Lecture.** Le serveur ne tombe pas (aucune erreur), mais le coût est dans le **volume renvoyé et
sérialisé** (une seule boucle d'événements Node), pas dans la base : `controles` charge toutes les
exécutions de chaque contrôle, champs volumineux compris (preuves, résultats de checklist). La
pagination et l'allègement des listes sont donc la première priorité de volumétrie.

## 3. Déjà corrigé dans ce chantier (16/10/2026, vérifié)

| Constat | Correction | Vérification |
|---|---|---|
| Limite de connexion par IP comptant les **réussites** : au-delà de 50 connexions en 15 min depuis une même IP de sortie (NAT d'entreprise), tous les salariés étaient refusés | Seuls les échecs comptent (`lib/login-ip-guard`, `rateLimitPeek` mémoire et Redis) ; seuil `LOGIN_IP_MAX_FAILURES` | Serveur réel : 60 salariés depuis une IP → 60/60 ; 50 échecs → IP bloquée ; le compte légitime passe toujours depuis le NAT |
| Pool PostgreSQL non réglable (Prisma 7 ignore `connection_limit`) ; attente d'une connexion **infinie** | `lib/db-pool` : `DB_POOL_MAX`, `DB_POOL_TIMEOUT_MS` (15 s par défaut), `DB_POOL_IDLE_MS`, `DB_STATEMENT_TIMEOUT_MS` | Tests unitaires ; `.env.example` |
| Documents de 10 à 25 Mo **tronqués** par le proxy (« form_invalide ») | `proxyClientMaxBodySize` 26 Mo ; `request_body max_size` dans Caddy | Serveur réel : 5, 12 et 24 Mo envoyés et relus, SHA-256 identiques |
| Tâches planifiées exécutables **deux fois en parallèle** (relances, webhooks, instantanés, rapports en double) | Bail en base `CronVerrou` (acquisition atomique, jeton, expiration), toutes les routes `/api/cron` via `cronRoute` | Test sur base réelle (simultanéité, erreur, expiration, jeton) |
| Rôle évalué sur la mauvaise organisation (CWE-863), écrasement silencieux entre éditeurs d'un atelier | `roleSurRessource`, verrou optimiste par atelier | Tests sur base réelle |

## 4. Feuille de route proposée

Principe : **l'installation par défaut reste mono-instance et simple** ; tout ce qui sert la haute
disponibilité est **activable** (variable d'environnement, profil Compose) et documenté.

### Lot V1 — Volumétrie (priorité 1, sans choix d'infrastructure)
1. **Pagination par curseur** `(updatedAt|createdAt, id)` des listes : contrôles, registre des risques,
   analyses, plans d'action, incidents, préconisations, documents, missions d'audit, dérogations.
   Côté interface : chargement progressif ou pages, recherche et filtres côté serveur.
2. **Listes allégées** : ne renvoyer que les colonnes affichées ; pour les contrôles, la dernière
   exécution et l'efficacité calculée en base, pas les 12 exécutions avec leurs preuves.
3. **Vue consolidée** (`grc/rollup`, `grc-consolide`, `action-items`) : agrégats SQL (`groupBy`,
   comptes par statut et par période) au lieu de charger les lignes.
4. Helper qui impose un `take` par défaut ; cliquet sur les nouveaux `findMany` sans borne.
**Fini quand** : avec le jeu « grand groupe », p95 < 300 ms pour les listes à 20 requêtes simultanées,
réponse < 500 Ko, vue consolidée p95 < 2 s.

### Lot V2 — Exploitation sous charge
1. Exports PDF/XLSX lourds : mesurer (10 PDF de grosses analyses pendant une charge mixte) ; si la
   latence des lectures double, file de tâches en base (`SKIP LOCKED`) traitée par le même processus.
2. Relances et webhooks : envois par lots, transport SMTP réutilisé, marquage par destinataire avant
   envoi ; suppression de la troncature silencieuse à 10 000 éléments.
3. Planificateur : rattrapage d'une tâche manquée (dernier succès en base), `--max-time` sur les appels.
4. Journal d'audit : rétention paramétrable et archivage (T14).

### Lot H1 — Haute disponibilité (activable, choix d'infrastructure à faire)
1. **Multi-instance applicative** : store partagé des limites de débit et du verrouillage de compte si
   `REDIS_URL` est défini (abstraction déjà en place) ; stockage des documents en S3 compatible si
   `DOCUMENT_STORAGE=s3` (adaptateur à écrire) ; profil Compose « ha » sans `container_name`,
   plusieurs réplicas derrière Caddy avec contrôle de santé.
2. **Base hautement disponible** : base managée (réplique + bascule) ou PostgreSQL primaire/réplique
   (Patroni) — **décision d'hébergement**.
3. **Perte de données ≤ 15 min** : archivage continu des journaux de transactions (WAL : pgBackRest ou
   wal-g) vers un stockage objet, restauration à un instant donné.
4. **Déploiement sans interruption** : migrations « expand/contract », démarrage de la nouvelle
   version à côté de l'ancienne, bascule par contrôle de santé.

### Lot O1 — Observabilité
Journal d'accès (Caddy), identifiant de corrélation par requête, métriques (`/api/metrics`,
activable), alerte en cas d'échec de sauvegarde, séparation vivacité / disponibilité du contrôle de santé.

## 5. Décisions (arbitrées le 16/10/2026)

1. **Intégrité avant disponibilité.** Aucune donnée validée ne doit être perdue ; une écriture qui échoue est
   **signalée** et **reprise ou récupérable**. Conséquences :
   - base : réplication **synchrone** (une transaction n'est confirmée qu'une fois écrite sur deux serveurs, RPO = 0) ;
     en cas de doute, la base refuse d'écrire plutôt que de diverger ; archivage continu (restauration à un instant donné) ;
   - application : les saisies non enregistrées sont conservées dans le navigateur et renvoyées automatiquement, avec un
     état « non enregistré » visible ; les traitements de fond en échec (envois, exports, imports) sont journalisés, visibles
     par l'administrateur et relançables ; les tâches et envois sont idempotents (reprise sans doublon).
2. **Hébergement : les deux options sont supportées**, au choix de l'architecture de déploiement :
   base **managée** (réplication synchrone et archivage fournis par l'hébergeur) **ou** PostgreSQL **auto-hébergé**
   répliqué (Patroni + etcd, réplication synchrone, pgBackRest). Contrainte technique : l'auto-hébergé exige au moins
   **3 nœuds** (quorum) pour une bascule automatique sans risque de double primaire.
3. **Stockage des documents : selon l'architecture.** Mono-instance → disque local (défaut actuel) ; multi-instance →
   stockage objet **S3 compatible** (souverain), versionné, chiffré, activé par `DOCUMENT_STORAGE=s3`.
4. **Grandes listes : tableau paginé côté serveur** (voir § 5 bis).

### 5 bis. Grandes listes — choix retenu et raisons

**Tableau paginé côté serveur** (pages de 50 lignes, 25/50/100 au choix), **tri, filtres et recherche exécutés par la
base**, état de la vue dans l'URL (lien partageable, retour arrière du navigateur), **total affiché**, compteurs et
synthèses calculés en SQL, **export complet** en tâche de fond (fichier téléchargeable, pas limité à la page).

Pourquoi pas le chargement progressif (défilement infini) : sur un registre GRC on trie, on filtre, on retrouve une
ligne précise, on la cite à un comité ou à un auditeur, on revient à la même position ; le défilement infini rend ces
usages difficiles (pas de position stable, pas de lien, mauvaise accessibilité au clavier et au lecteur d'écran, mémoire
du navigateur qui croît). La pagination reste la référence des outils de registre et d'audit.

Technique : pagination par **décalage** (`skip/take`) avec tri indexé dans l'interface — suffisante jusqu'à quelques
centaines de milliers de lignes par organisation ; pagination par **curseur** pour l'API publique et les exports
(stable même si des lignes sont ajoutées pendant le parcours).

## 6. Mesures restant à faire

Charge mixte longue (200 utilisateurs, 30 min), exports simultanés, tâches planifiées à volume
(5 000 destinataires, 5 000 livraisons), sauvegarde et restauration au volume du jeu (RTO mesuré),
interruption réelle d'un déploiement, pannes provoquées (arrêt de l'application, de la base, disque
plein), journal d'audit à 10 millions de lignes.
