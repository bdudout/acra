# Proposition — sauvegarde externe des points de restauration

Date : 2026-10-03 · Statut : **lots S1 (fs, command) et S2 (s3 via rclone) et panneau d'état développés** ; restic (S4) et PITR non faits · Prolonge
[`sauvegarde-rollback-spec.md`](sauvegarde-rollback-spec.md) (points de restauration locaux).

## 1. Pourquoi

Un point de restauration stocké sur le même disque que la base protège d'une mise à jour ratée, **pas** d'une perte
de l'hôte, d'un rançongiciel ou d'une erreur d'exploitation. Règle **3-2-1-1-0** : 3 copies, 2 supports, 1 hors site,
1 immuable ou hors ligne, 0 erreur après vérification.

Existant : `BACKUP_OFFSITE_CMD` (dump quotidien du service `backup`) et `ACRA_SNAPSHOT_OFFSITE_CMD` (dossier d'un
point) — une commande libre, sans vérification ni supervision : on ne sait pas si l'envoi a réussi, ni quand.

## 2. Options disponibles

| # | Cible | Atouts | Limites | Pour qui |
|---|---|---|---|---|
| A | **Dossier local ou monté** (disque USB, NFS, SMB, volume dédié) via `rsync` | Aucun compte tiers, simple, rapide à restaurer | Même site (pas « hors site » si le montage est local) ; pas d'immutabilité | Petite structure, 1ʳᵉ copie |
| B | **rclone** (S3, OVH Object Storage/Swift, Backblaze B2, Azure, GCS, SFTP, WebDAV, Google Drive…) | Une seule intégration pour ~70 fournisseurs ; remote `crypt` natif ; déjà cité dans le runbook | Pas de déduplication ; rétention à gérer côté ACRA | **Choix par défaut recommandé** |
| C | **restic** ou **BorgBackup** (dépôt chiffré dédupliqué) | Chiffrement natif, déduplication, rétention (`forget --prune`), `restic check` | Un outil de plus à installer ; restauration via l'outil | Bases volumineuses, nombreux points |
| D | **Stockage objet S3 avec Object Lock** (mode conformité) | **Immutabilité** : un attaquant ayant les clés ne peut pas effacer | Fournisseur compatible requis (AWS, OVH, Scaleway, MinIO…) | Exigence anti-rançongiciel |
| E | **SFTP / rsync sur SSH** vers un serveur distant | Maîtrise totale, pas de cloud | À administrer (clés, quotas) | Hébergeur ou 2ᵉ site propre |
| F | **Logiciel de sauvegarde d'entreprise** (Veeam, Commvault, Bacula/Bareos, Tivoli…) | S'insère dans la politique existante | Pas d'agent propriétaire dans ACRA : on **expose** un dossier stable + crochets avant/après | Grands comptes |
| G | **PostgreSQL natif** : `pgBackRest`, Barman, WAL-G (archivage WAL, **PITR**) | Restauration à la seconde près (RPO ≈ 0) | Plus lourd à exploiter ; hors Docker standard | Exigence de RPO très faible |
| H | **Snapshots de volume/VM** (LVM, ZFS, Proxmox, VMware, snapshots cloud) | Instantané complet de l'hôte | Cohérence à garantir (quiesce) ; non portable | Infra virtualisée |
| I | **Base managée** (PITR du fournisseur) | Délègue base + PITR | Les documents restent à sauvegarder | Déjà en cloud |

## 3. Proposition de conception

Un script **`scripts/acra-offsite.sh`** appelé à la fin de chaque `acra-snapshot.sh create` (et par le service
`backup`), avec des **pilotes** sélectionnés par `ACRA_OFFSITE_DRIVER` :

| Pilote | Variables | Notes |
|---|---|---|
| `fs` (A, E local) | `ACRA_OFFSITE_TARGET=/mnt/sauvegardes/acra` | `rsync` atomique (fichier temporaire puis renommage) |
| `rclone` (B, D, E) | `ACRA_OFFSITE_TARGET=remote:bucket/acra` | `rclone copy` puis `rclone check` |
| `restic` (C) | `ACRA_OFFSITE_TARGET=<dépôt>`, `RESTIC_PASSWORD_FILE` | `backup` puis `check` ; rétention `forget` |
| `command` (F, H, I) | `ACRA_OFFSITE_CMD` | contrat actuel conservé + variables `ACRA_SNAPSHOT_ID`, `ACRA_SNAPSHOT_DIR` |

Garde-fous communs (non négociables) :

1. **Chiffrement avant envoi** : refus d'envoyer hors du serveur un point non chiffré (`age`) sauf `ACRA_OFFSITE_ALLOW_PLAINTEXT=1` explicite (pilote `fs` local exempté).
2. **Vérification après envoi** (taille + empreinte SHA-256 relue côté cible) ; un envoi non vérifié = échec.
3. **Un échec n'interrompt jamais la mise à jour**, mais il est **publié** : `.acra-update/offsite.json` (dernier succès, dernier échec, code, âge).
4. **Supervision dans l'interface** (Administration → Version → « Sauvegarde externe ») : pilote, dernier envoi, âge, état (OK / en retard / en échec), alerte si plus vieux que `ACRA_OFFSITE_MAX_AGE_HOURS` (défaut 48 h). Lecture seule : l'application ne lance aucune commande (comme pour la mise à jour).
5. **Rétention** étagée côté cible (quotidiens 7 · hebdomadaires 4 · mensuels 6), distincte de la purge locale.
6. **Test de restauration trimestriel** : `acra-snapshot.sh verify --full` sur un point **rapatrié** depuis la cible (commande `acra-offsite.sh fetch <id>`).
7. **Ce qui ne se retrouve nulle part ailleurs** : sauvegarder **séparément** la clé `age` (identité) et `SECRETS_ENCRYPTION_KEY` — sans elles, une copie hors site est illisible. Le manifeste n'en contient que l'empreinte.

## 4. Recommandation de choix

- **Par défaut** : pilote `rclone` + chiffrement `age`, vers un stockage objet (OVH, Scaleway, B2) — universel, peu de maintenance.
- **Petite structure sans cloud** : pilote `fs` vers un disque monté (NFS/USB) **plus** une copie rclone.
- **Exigence anti-rançongiciel** : cible S3 avec **Object Lock** (D) ; sinon copie hors ligne (disque tournant).
- **Volumétrie ou nombre de points importants** : `restic`.
- **Grand compte** : `command` + crochets, et laisser Veeam/Commvault/Bacula prendre le dossier de points (stable, chiffré).
- **RPO inférieur à la journée** : ajouter PITR (G) — à traiter comme un chantier séparé.

## 5. Lots proposés

| Lot | Contenu | Taille |
|---|---|---|
| S1 | `acra-offsite.sh` : pilotes `fs` et `command`, garde-fous 1-3, `offsite.json` ; tests avec binaires simulés | M |
| S2 | Pilote `rclone` (envoi + `rclone check`) et `fetch` ; documentation Object Lock | M |
| S3 | Panneau « Sauvegarde externe » (lecture seule, i18n ×5), alerte de péremption | S |
| S4 | Pilote `restic` (+ rétention) | S |
| S5 | Runbook (restauration depuis la cible, sauvegarde des clés), test trimestriel | S |
| — | PITR (pgBackRest/WAL-G) : chantier distinct | L |

## 6. Décisions à prendre

1. Pilotes du premier lot : `fs` + `command` + `rclone` (proposé) ? `restic` plus tard ?
2. Chiffrement `age` **obligatoire** hors du serveur (proposé) ou simple recommandation ?
3. Le panneau d'état dans l'interface est-il suffisant, ou faut-il aussi une alerte par e-mail ?
4. PITR : hors périmètre pour l'instant (proposé) ?
