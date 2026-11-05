# Prompt pour les agents locaux — recette de la branche `claude/dazzling-edison-qzmwlg` (03/11/2026)

À coller tel quel dans un agent local (Claude Code ou Codex) lancé dans le clone du dépôt ACRA, sur une machine qui a
Docker, un navigateur et l'accès réseau. Le travail cloud a livré et testé (tests unitaires, tests sur PostgreSQL réel,
build) ; il reste ce qui exige une vraie infrastructure ou un navigateur.

---

Tu travailles sur ACRA (GRC / EBIOS RM, Next.js 16 « non standard », Prisma 7, PostgreSQL, Docker Compose + Caddy).

**Avant tout** : lis `AGENTS.md`, `.claude/skills/acra-engineering/SKILL.md` et `docs/HANDOFF.md` (entrées 105 à 114)
et respecte-les. Récupère la branche : `git fetch origin claude/dazzling-edison-qzmwlg && git checkout claude/dazzling-edison-qzmwlg`
(ne crée pas d'autre branche ; aucune commande git destructive ; commits petits, en français, chemins explicites ; ne
pousse que sur cette branche ; pas de PR sans accord de l'utilisateur). Rapporte uniquement ce que tu as réellement
exécuté, avec la sortie ; ce que tu n'as pas pu faire, dis-le.

## Mission : recette réelle de ce que le cloud n'a pas pu exécuter

Pour chaque point : exécute, consigne le résultat (OK / KO + sortie), corrige les défauts trouvés (TDD : test rouge,
correction, test vert ; i18n ×5 pour tout texte visible), puis mets à jour `docs/HANDOFF.md` (nouvelle entrée en tête) et
`docs/deploiement-haute-disponibilite.md` § 8 « testé / non testé ».

### 1. Base et application (mono-instance)
1. `npm ci`, `npx prisma migrate deploy` sur une base neuve puis sur une copie d'une base existante (si disponible) :
   les migrations du 02/11 au 03/11 (`20261102…` à `20261103200000`) passent, dont `audit_log_chaine` (remplissage de
   `seq` et déclencheur d'immuabilité sur une table AuditLog volumineuse : mesure la durée).
2. `npm test`, `npm run test:db`, `NODE_OPTIONS=--max-old-space-size=4096 npm run build` (le build ne doit plus
   s'arrêter sur l'alerte de sécurité Next.js : version 16.4.4).
3. `./scripts/setup.sh` sur une installation vierge puis sur une installation existante : `AUDIT_CHAIN_KEY` et
   `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` générées une seule fois, jamais régénérées (relance, `--force`), `.env` en 600,
   aucun secret affiché.

### 2. Parcours navigateur (application démarrée, comptes de recette : `.claude/skills/acra-scenarios/scripts/preparer-env.sh`)
1. **Double validation** : activer « Double validation » (Configuration › Fonctionnalités) ; avec un compte, accepter
   des risques résiduels hors appétit (analyse soumise, appétit défini), passer un risque du registre à « Accepté » hors
   appétit, supprimer un contrat TIC critique → bandeau « demande transmise » ; pastille « N validation(s) en attente »
   et page `/validations` avec un second compte habilité ; le demandeur ne peut pas approuver ; rejet sans motif refusé ;
   approbation → action exécutée.
2. **Tiers / services TIC** : qualifier un usage (PCI, avec / sans SI, Internet / intranet, LS / Internet ; « sans SI »
   désactive l'interconnexion) ; points d'accès (une URL avec `user:motdepasse@` est refusée) ; hôte partagé signalé ;
   import CSV des usages (modèle téléchargeable, aperçu puis application) ; filtre « Périmètre PCI uniquement » ; export
   Excel (nouvelles colonnes) ; section « Services TIC » du pilotage GRC.
3. **Résilience (page Réglementaire)** : processus critique avec RTO, RPO, **tolérance d'impact** (alerte si RTO >
   tolérance) ; vue « Fonctions critiques ou importantes » : écarts, concentration, scénarios sévères (ajout / suppression),
   dernier test (test de résilience avec processus testé et durée de reprise) ; contrat TIC avec **stratégie de sortie** ;
   vérifier que modifier un contrat n'efface plus le questionnaire de qualification.
4. **Journal d'audit** (super-admin) : « Vérifier l'intégrité » (après exécution de la tâche `audit-scellement`) ;
   rétention (12 à 240 mois, refus hors bornes) ; liste et export CSV du journal (colonnes `seq`, `hash`).
5. Listes paginées : contrôles, registre des risques, incidents, analyses, dérogations, plans d'action, préconisations,
   documents, missions — tri, filtres, recherche, lien partageable (état dans l'URL), retour arrière du navigateur.
6. Thème sombre et largeur mobile (375 px) sur les nouveaux écrans ; navigation au clavier.

### 3. Profil multi-instance « ha » (Docker requis)
1. `./scripts/setup.sh --profil ha` avec un S3 compatible local (MinIO : bucket versionné et chiffré) et Redis ;
   `docker compose -f docker-compose.production.yml -f docker-compose.ha.yml up -d` : 3 réplicas sains derrière Caddy
   (`/api/health`), affinité par cookie `acra_lb`.
2. Limites de débit et verrouillage de compte partagés : des échecs de connexion au-delà du seuil configuré, répartis sur les réplicas → compte
   verrouillé ; arrêt de Redis → connexions refusées avec le message « momentanément indisponible », reprise automatique.
3. Documents : envoi puis relecture via S3 ; tâche `coherence-documents` : écart signalé si un objet est supprimé du bucket.
4. **Mise à jour progressive** : `scripts/update-ha.sh stable --pitr-confirmed` (ou `--backup-cmd`) — aucune requête en
   erreur pendant le remplacement des réplicas (boucle `curl` en parallèle) ; échec provoqué (image qui ne répond pas)
   → retour arrière automatique.
5. **Sauvegarde et restauration** : `scripts/acra-snapshot.sh create` en profil ha puis
   `scripts/acra-restore-ha.sh database` vers une base neuve (comptes identiques) ; restauration des documents
   (`acra-restore-ha.sh documents`, option `version_at` de rclone à vérifier) ; garde-fous (production refusée, cible
   non vide refusée).
6. Optionnel si disponible : Redis Sentinel (3 nœuds) avec bascule du primaire ; Patroni + pgBackRest (guide § 3.2-3.3).

### 4. Charge (comparer à `docs/specs/scalabilite-haute-disponibilite.md` § 5 ter)
Avec le jeu « grand groupe » (script SQL décrit en § 2 de la spec, base de recette uniquement), mesurer les mêmes routes
en mono-instance puis avec 3 réplicas : le débit doit croître avec le nombre de réplicas. Consigner les chiffres dans la spec.

## Points ouverts à NE PAS trancher seul (les remonter à l'utilisateur)
- Lot V1-bis : pagination entièrement en SQL (registre des risques, contrôles, plans d'action unifiés) et recherche à la
  saisie pour les menus — objectif 300 ms sous 20 requêtes simultanées non atteint.
- `SECRETS_ENCRYPTION_KEY` non transmise en mono-instance (migration des secrets chiffrés nécessaire).
- Mot de passe de la base visible dans `ps` pendant `pg_dump` / `psql` (URL passée en argument).
- Couche « applications » (DORA art. 8) et import CMDB : non lancés (décision produit).

Rapport final en français : tableau point par point (OK / KO / non exécuté + raison), défauts corrigés (commits),
défauts restants, mesures.
