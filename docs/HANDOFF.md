# Journal de passation — Claude Code ⇄ Codex

À lire en **début de tour**, à mettre à jour en **fin de tour** (cf. skill
`acra-engineering` §1). Le plus récent en haut. Rester factuel : ce qui a été
vérifié l'est avec la commande et son résultat.

---

## 2026-09-29 (12) — Claude Code : reprise de Codex, cockpit GRC corrigé, projets ⇄ analyse cyber, READMEs

**Branche** : `feat/historical-excel-import` (PR #191). Commits `88312d0` (correctifs CI),
`d45b7f7` (travail de Codex repris : DORA → actions, PDF RAS/RAD, bilan par domaine, tiers du
projet 360, cadrage CAF) + le commit de ce tour.

- **Reste à faire évalué** : backlog Codex soldé (DORA→actions, PDF RAS/RAD, rapport par domaine,
  CAF cadré : les cibles Basic/Enhanced sont un modèle ACRA, pas une prescription NCSC).
  Restent : recette navigateur connectée de tous les parcours, tables IGP CAF chiffrées (à ne
  pas inventer), publication d'une release bêta.
- **Bug cockpit GRC** : `/pilotage` et `/api/grc/rollup` exigeaient le module *registre* alors
  que la barre affiche « Pilotage » dès qu'un module GRC est actif → retour silencieux vers
  `/dashboard`. Garde unique `isGrcActive` (lib/projet360) : registre, contrôle, audit, KRI,
  réglementaire ou profils opérationnels (incidents et projets seuls ne comptent pas).
- **Suivi des projets dans le cockpit GRC** : bloc `consolide.projets` du rollup
  (`synthetiserProjets360` : en cours / terminés / en retard / validés RSSI + RM, risques
  élevés, projets à surveiller en tête) rendu par `ProjetsSuivi`, seulement si le module Projets 360
  est actif ; mêmes analyses et même garde d'accès que l'onglet Projets.
- **Analyse cyber depuis un projet 360** : `Analyse.projetSourceId` (migration
  `20260929170000`, détaché à la suppression du projet) ; bouton « Lancer une analyse cyber »
  dans l'onglet Projets (→ `/analyses/new?projet=<id>`), sélecteur « Partir d'un projet 360 »
  sur la page de création (préremplit nom/description sans écraser la saisie) ; `GET /api/projets`
  (liste vide si module inactif) ; `POST /api/analyses` ignore le lien si le module est inactif,
  404 si le projet est inaccessible / d'une autre organisation (`resolveProjetSource`).
- **READMEs ×5** : accroche et présentation = gestion des risques cyber **et métier** + GRC
  (EBIOS RM n'est qu'une méthode) ; mise à jour intégrée à l'application mise en avant.
- **Vérifié** : `tsc` 0 · `npm test` **2295/2295** · `i18n:check` · `npm run build` OK ·
  migration appliquée en local (pas de dérive).
- **Piège** : un `sed -i` macOS avec `\n` a échoué en silence dans une commande chaînée en `&&` et
  a sauté la création de `/api/projets` (les tests mockaient `fetch`, seul le build l'a révélé).
  Vérifier l'existence des fichiers créés.
- Non vérifié : navigateur connecté (cockpit avec un seul module GRC, parcours projet → analyse).

---

## 2026-09-29 (11) — Codex : DORA → actions et export PDF RAS/RAD

**Branche** : `feat/historical-excel-import` (PR #191, non fusionnée à ce stade).

- **Constats de tests de résilience DORA → plans d'action** : route
  `POST /api/tests-resilience/[id]/actions` ; seul un constat ouvert est promu,
  priorité dérivée de sa sévérité (4=CRITIQUE, 3=MAJEUR, 1–2=MODERE), lien
  polymorphe `TEST_RESILIENCE` avec ref `constat:<index>` ; une action ouverte
  identique est renvoyée, jamais dupliquée. Bouton et retour contextualisé dans
  `TestsResilienceManager`, i18n ×5.
- **Export PDF RAS/RAD** : route `/api/appetence/export`, même agrégat serveur
  que la vue `/appetence`, audit `EXPORT`, template
  `ras-rad-pdf-template.tsx` compilé par `compile-pdf-template.mjs`. Le PDF
  contient le voyant global, le RAS (seuil et dépassements) et le RAD (appétit,
  maturité, KRI) ; bouton de téléchargement dans la vue.
- **Projet 360** : les exports directs PDF et Excel comportent maintenant un bilan
  par chacun des six domaines (cyber, SI, projet, métier, fraude,
  externalisation), y compris les risques non classés. C'est le même objet
  `Analyse` et le même registre de risques, sans copie de données.
- **Tiers Projet 360** : la phase Qualification comprend `ProjectTiers` ; les
  noms déjà contractualisés sont proposés depuis `/api/tiers/names`, puis les
  tiers sont persistés par la route dédiée
  `PUT /api/analyses/:id/tiers`, sans modifier les scénarios de l'atelier 3.
- **CAF** : recherche effectuée sur les publications NCSC officielles v4.0.
  Point de cadrage important : le CAF fournit 41 outcomes et tables IGP ; il ne
  mandate pas de profil Basic/Enhanced sectoriellement universel. Les cibles
  Basic/Enhanced doivent donc être proposées comme modèle ACRA documenté et
  révisable, jamais comme prescription NCSC/régulateur. Sources : collection et
  PDF v4.0 NCSC (pages 3–6, IGP tables). L'écran Maturité CAF offre le lien
  direct vers les tables IGP officielles et explique que le profil cible dépend
  de l'autorité de supervision/cadre sectoriel.
- **Vérifié** : `npx vitest run src/__tests__/unit/api/tests-resilience.route.test.ts`
  (7 verts) ; `npx tsc --noEmit` vert ; compilation de tous les templates PDF ;
  rendu direct du template RAS/RAD : en-tête `%PDF` valide (3 604 octets) ;
  suite complète `npm test -- --run --reporter=dot` : **276 fichiers, 2 276
  tests verts** ; `tsc` et `i18n:check` verts.
- **Build** : `npm run build` **vert** après purge du seul cache régénérable
  `.next/cache` (1,7 Go) ; le build avait d'abord atteint `ENOSPC`, puis le
  sandbox réseau empêchait Next de charger Inter. Le build a ensuite terminé,
  y compris ses routes standalone et le nettoyage du `.env` de production.
- **Recette HTTP locale** : serveur déjà actif sur `localhost:3005` ;
  `GET /api/health` = 200. Sans session, `/api/appetence/export`,
  `POST /api/tests-resilience/test/actions` et
  `PUT /api/analyses/test/tiers` sont interceptées par le middleware (307 vers
  l'authentification), sans écriture de données.
- **Recette Playwright** : lancée contre `localhost:3005` avec une URL PostgreSQL
  locale temporaire (Docker expose 5432 ; `.env` réserve `db` au réseau Docker).
  Les cinq premiers scénarios ont passé : quatre parcours/format d'import,
  authentification valide et refus de mot de passe. Le cycle cyber était encore
  en cours quand la session d'exécution a été interrompue ; relancer avec
  `DATABASE_URL` pointant sur `localhost:5432` et `E2E_BASE_URL=http://localhost:3005`.
- **Cycle cyber E2E** : repris contre `127.0.0.1:3005` avec le serveur démarré
  sur l'URL PostgreSQL locale temporaire ; **vert** (41,3 s). Le scénario valide
  les cinq ateliers, soumission, approbation RSSI, acceptation métier, gel et
  export PDF, puis le teardown retire les données `e2e_*`.
- **À poursuivre** : recette navigateur connectée de tous les parcours. Le
  composant Atelier 3 propose déjà les tiers connus par défaut via
  `/api/tiers/names`; si le parcours Projet 360 doit éditer ses tiers depuis ses
  phases, créer un écran dédié plutôt que détourner l'atelier EBIOS 3.

---

## 2026-09-29 (10) — Claude Code : onglet Projets, module Projets 360, pré-remplissage, dérogations en place

**Branche** : `feat/historical-excel-import` (PR #191). Commits `590129b` (dérogations),
`5c1b465` (projets).

- Module `projets360Active` (OrganizationConfig, défaut **true**, migration
  `20260929160000`, toggle Configuration → Fonctionnalités, politique d'instance) ;
  onglet `/projets` ; `PROJET_360` retiré du sélecteur générique et de l'activation
  d'instance (`MODULE_METHODS`), accepté à la création si le module est actif.
- Nav : groupe « Gestion des risques » ×5, lien Projets.
- Population (`lib/projet360.server`) : réponses « oui » seulement sur preuve, avec
  source (`p360._sources`, effacée à la confirmation) ; risques proposés sans doublon ;
  risques du registre proposés par domaine en appréciation.
- Dérogations : actions mises à jour en place (ligne ouverte, confirmation), bandeau
  « Votre demande » avec boutons visibles.
- Vérifié : `tsc` 0 · `npm test` **2272/2272** · `i18n:check` · `npm run build` OK.
- Non vérifié : navigateur connecté.

---

## 2026-09-29 (9) — Claude Code : analyse projet 360, RAS/RAD, tests de résilience DORA, processus de cartographie

**Branche** : `feat/historical-excel-import` (PR #191 ouverte, non fusionnée). Commits
`40d35d9` (projet 360), `88fbb27` (RAS/RAD), `1dbcaca` (tests de résilience DORA),
`dcbb33f` (processus de cartographie) + docs.

- **Analyse projet 360** (méthode `PROJET_360`, ISO 31000) : questionnaire 360 (18
  questions, 6 domaines) → risques proposés via le moteur de qualification ;
  `Risque.domaine` ; import tracé de risques d'une analyse cyber (même org, méthodes
  cyber, idempotent) ; double approbation RSSI **et** RM (`Analyse.approbations`) ;
  tableau de bord par domaine. Migration `20260929130000_projet_360`. La méthode doit
  être **activée par le SUPER_ADMIN** (/admin/instance) comme les autres.
- **RAS / RAD** : `/appetence` (menu Pilotage) — voyants appétit / maturité / KRI.
- **Tests de résilience DORA** : `/reglementaire/tests-resilience`, table
  `TestResilience` (migration `20260929140000`), rapport Word de réexamen (art. 6 § 5).
  Libellés réglementaires repris d'EUR-Lex ×5 (art. 6 § 5, 24, 25 § 1, 26).
- **Processus de cartographie** : `/cartographie/processus`, `OrganizationConfig.
  processusCartographie` (migration `20260929150000`).
- **Vérifié** : `tsc` 0 · `npm test` **2258/2258** · `i18n:check` vert · `npm run build`
  OK · migrations appliquées en local.
- **Non vérifié** : parcours navigateur connecté (session du panneau expirée) —
  recette à faire : créer une analyse projet 360 (après activation instance), répondre
  au questionnaire, importer des risques cyber, approuver RSSI puis RM ; /appetence ;
  saisir un test DORA et télécharger le rapport ; éditer le processus de cartographie.
- **Reste au backlog** : attendus des profils CAF (tables officielles NCSC à sourcer),
  export PDF RAS/RAD, constats DORA → plans d'action, rapport projet 360 par domaine.

---

## 2026-09-29 (8) — Claude Code : v1.0.3 publiée, Maturité (CMMI), dérogations, READMEs, notes de release

**Branche** : `feat/historical-excel-import` (à jour de `main` après #190). Commits
`bbc553d` (1.0.4-beta.1), `7a9222d` (maturité), `2ef2748` (dérogations), `f8a2a09`
(release), `3e93996` (READMEs), `cf29da0` (docs).

- **v1.0.3 publiée** (release GitHub, branche `stable` créée sur `7c15dff`) ; issues
  #185, #186, #188 : réponses publiées (ton amical, tutoiement) puis fermées.
- **Maturité** (remplace les « profils opérationnels US/UK ») : couche de `Conformite`
  (`maturites`, `maturiteCible`), échelle CMMI 0–5 modifiable par l'ADMIN
  (`OrganizationConfig.echelleMaturite`, section Échelles de /configuration),
  NCSC CAF v4.0 ajouté aux référentiels livrés, page `/maturite` (lecture RAS/RAD),
  actions via lien `CONFORMITE` (anti-doublon commun). Migration
  `20260929120000_maturite_conformite` (supprime `OperationalProfile`, convertit ses liens).
- **Dérogations** : modification par le demandeur avant avis RSSI, retrait
  (statut `RETIREE`), avis « favorable avec réserves » (`avisRssiReserves`).
- **Release** : `release.yml` exige `docs/releases/vX.Y.Z.md` pour une stable, ajoute
  commits + artefacts, joint la fiche de recette ; notes v1.0.0→v1.0.3 réécrites.
  Skill : procédure « Publier une release ».
- **READMEs ×5** : GRC multi-méthode, sections Méthodes et Maturité, 15 référentiels.
- **Backlog** (`docs/CHANTIERS-EN-COURS.md`) : vue RAS/RAD, programme de tests de
  résilience DORA → rapport de réexamen, page processus de cartographie éditable.
- **Vérifié** : `tsc` 0 · `npm test` **2199/2199** · `i18n:check` vert · `npm run build`
  OK · migration appliquée en local · essai à sec de l'étape « notes » de release.yml.
- **Non vérifié** : parcours navigateur de /maturite et des dérogations (la session du
  panneau navigateur a expiré ; pas de compte de test utilisable) — à recetter
  connecté (ADMIN : échelle CMMI ; RSSI : avis avec réserves ; demandeur : modifier/retirer).
- **Prochain pas** : PR vers `main` (bêta 1.0.4) puis recette ; pour la prochaine
  stable, rédiger `docs/releases/v1.0.4.md` avant le workflow.

---

## 2026-09-28 (7) — Claude Code : P4 terminé, #185 corrigé (v1.0.3), profils US/UK lot 1

**Branche** : `feat/historical-excel-import`. Commits `fd4c9ab` (P4), `93b6148` (#185 +
version 1.0.3), `640f69c` (profils US/UK). Poussée pour la PR de la v1.0.3.

- **P4** : boutons d'export par méthode (`ExportButtons` i18n, `formats`), libellé
  d'appétit WinAnsi (« ≤ » s'affichait « d » dans le PDF).
- **#185 mises à jour** : `compareVersions` SemVer complet (préversions), canal
  stable/bêta (`describeVersion`), `scripts/update.sh [stable|beta]` (sauvegarde DB,
  avance rapide seule, santé, retour arrière) et agent hôte `scripts/update-agent.sh`
  (bouton « Mettre à jour » : l'app dépose une demande, n'exécute rien). Branche
  `stable` avancée par `.github/workflows/stable-branch.yml` à la publication d'une
  release ; `release.yml` refuse un tag ≠ version de `package.json`.
- **Profils US/UK (reprise Codex)** : catalogues officiels (22 catégories CSF 2.0,
  14 principes CAF v4.0), table `OperationalProfile` + migration
  `20260929110000` (reprend puis supprime les lignes `OP_PROFILE:` de `Conformite`),
  historique par point, promotion sans doublon (lien `OPERATIONAL_PROFILE`), 404 si
  module inactif, export CSV. Spec : § 9 « Challenge ».
- **Vérifié** : `tsc` 0 · `npm test` **2190/2190** · `npm run i18n:check` vert ·
  `npm run build` OK · navigateur :3005 (org « Organisation principale », module
  activé localement) : saisie GV.OC + Tier 3 enregistrée, action créée puis 2ᵉ clic
  → « action ouverte existe déjà », action visible dans /plans-actions, export CSV OK.
- **Non vérifié** : parcours REST/LDAP réels de Codex (tour 6) — pas d'annuaire de
  recette ici ; lots 2–3 US/UK (résilience UK, quantification) non commencés.
- **Prochain pas** : après merge, publier la release v1.0.3 (workflow « Prepare
  versioned release » puis publication) → `stable` créée ; puis passer `main` en
  `1.0.4-beta.1`.

---

## 2026-09-28 (6) — Codex : connecteurs d’entités REST/LDAP, persistants et explicites

**Branche** : `feat/historical-excel-import`. Commit `dbf4ec4` (non poussé).

- Ajout de `entitesSyncConfig` (JSON) dans `OrganizationConfig` et migration
  `20260928280000_entites_sync_config` **appliquée localement**. Les jetons REST et
  mots de passe LDAP sont AES-256-GCM (`secret-crypto`) ; la projection GET les
  masque. Une sauvegarde sans nouveau secret — y compris le marqueur `[CONFIGURED]`
  de l’UI — conserve le secret chiffré au lieu de l’écraser.
- Admin : `/configuration/entites` contient `EntitySyncManager` : choix REST ou
  LDAPS, sauvegarde, test/aperçu, cases à cocher et import explicite. L’admin
  choisit explicitement la destination : responsables de mesures ou arborescence
  d’entités. La création d’une entité est transactionnelle (jamais de chemin `/`
  intermédiaire persistant), avec audit.
- API : `sync-config` est limitée, RBAC ADMIN effectif, journalisée et distingue
  401/403 ; `sync` lit REST ou LDAP, borne l’annuaire à 500 entrées, retourne un
  aperçu puis applique une sélection explicitement envoyée. Les endpoints privés,
  localhost, `.local`, HTTP/LDAP non chiffré sont refusés.
- Revue adversariale complémentaire : refus des destinations IPv6 loopback,
  link-local et ULA, et borne dure à 1 Mio sur les réponses REST (en-tête
  `Content-Length` ou flux chunked). `fetchLdapEntities` revalide lui-même son
  URL, y compris si appelé hors route.
- Audit NIST SP 800-30 : `Maintain` était à tort une phase éditable et la cible
  des liens de traitement. Elle est désormais une revue ; `Conduct` est la seule
  phase d’appréciation éditable et la cible de lien profond, conformément au
  déroulé Prepare / Conduct / Communicate / Maintain.
- Tests : `src/__tests__/unit/lib/entity-sync.test.ts` couvre URL, normalisation,
  REST sans redirection et conservation/non-exposition des secrets — **4 verts**.
  `EntitySyncManager.test.tsx` vérifie qu’aucun import ne part avant sélection
  explicite, puis que seuls les noms sélectionnés sont envoyés — **1 vert**.
  Total ciblé actuel : **18 verts** (méthodes, connecteurs et UI). `npm audit
  --omit=dev --json` : **0 vulnérabilité** production.
  `methodes.test.ts` (NIST distinct d’ISO 31000) + entity-sync : **16 verts**.
  `tsc --noEmit` : 0 sortie / succès ; `npm run i18n:check` vert. Une suite
  complète a été relancée mais sa sortie finale n’a pas été récupérée avant la
  passation : la rejouer avant commit.
- Recette infra : PostgreSQL `ebios_db` healthy ; migration deploy + Prisma
  generate réussis. Dev redémarré : PID 38667, `http://localhost:3005`, HTTP de
  `/configuration/entites` redirige correctement vers la connexion hors session.

**À terminer avant push** : suite `npm test` complète et `npm run build` après arrêt temporaire du dev (build écrase
`.next`). Vérifier dans le navigateur, connecté comme ADMIN, les deux parcours :
REST avec une API de test publique contrôlée et LDAPS avec un annuaire de recette.
Ne pas valider une connexion réelle sur une infrastructure de production.

---

## 2026-09-28 (5) — Claude Code : P3 livré, P4 presque terminé (limite d'usage atteinte)

**Branche** : `feat/historical-excel-import`. **Non poussé.**
- **P3 livré** (`06a7b75`) : `Risque.proprietaire` + migration `20260928270000`, saisie sous l'intitulé,
  suggestions (noms des membres + entités), filtre, colonne en Évaluation.
- **P4 — commité en cours** : `lib/rapport-methode-directe.ts` (modèle pur + libellés ×5),
  gabarit PDF `rapport-methode-directe-pdf-template.tsx` (déclaré dans `scripts/compile-pdf-template.mjs`),
  `rapport-methode-directe-xlsx.ts`, `rapport-methode-directe.server.ts`, branche de
  `/api/export/[id]` (pdf/xlsx pour ISO 27005/31000/NIST) + **journalisation de tous les exports d'analyse**.
  Testé : modèle, rendu PDF réel, Excel (anti-injection), route.
- **Reste pour P4** : (1) boutons « Exporter PDF / Excel » dans l'en-tête du parcours direct
  (`src/app/analyses/[id]/atelier/[num]/page.tsx`, vers `/api/export/<id>?format=pdf|xlsx&lang=<locale>`,
  libellés i18n ×5 — `ExportButtons.tsx` a des libellés FR en dur, à corriger au passage) ;
  (2) `npm run build` (gabarit PDF compilé) puis vérifier un vrai téléchargement sur :3005 ;
  (3) mettre à jour l'audit (P3/P4 livrés).

---

## 2026-09-28 (4) — Claude Code : P1 + P2 de l'audit des méthodes

**Branche** : `feat/historical-excel-import`. **Non poussé.** Commit `3cec6f9` (+ docs).

- **P1** : les méthodes directes utilisent l'échelle de l'organisation
  (`getEffectiveScaleConfig` : 4 ou 5 niveaux selon sa config — décision utilisateur :
  pas de 5 niveaux imposé pour NIST), paliers et matrice qualitative ; bornes serveur
  = `nbNiveaux`.
- **P2** : évaluation sur le niveau actuel ; critère = appétit (catégorie > global),
  repli moitié haute des paliers ; module pur `lib/risque-priorisation.ts`
  (l'ancienne API à paliers figés et son test ont été supprimés, plus d'utilisateur).
- **Vérifié** : 2105 tests verts, `tsc` 0, `i18n:check` OK, `npm run build` OK.
  Recette : appétit réel (seuil global 9) appliqué en phase Évaluation ; passage à
  5 niveaux via /configuration → listes 1..5, G5×V5 = 25 persisté ; **configuration
  d'échelle restaurée ensuite depuis une sauvegarde** (identique hors `updatedAt`),
  risque de recette supprimé.
- **Dev** : relancé après le build (`next dev -p 3005`, toutes interfaces, DB localhost).
- **Suites** : P3 (propriétaire), P4 (rapport par méthode), P5–P8 ; règles de
  qualification et import encore bornés à 1–4.

---

## 2026-09-28 (3) — Claude Code : qualification pour toutes les orgs, tableau responsive, audit des méthodes

**Branche** : `feat/historical-excel-import`. **Non poussé.**

**Commits** : `695b711` migration — qualification activée pour toutes les
organisations existantes (décision utilisateur ; 4/5 en local) · `af0bfc6` tableau
des risques directs responsive (conteneur `max-w-6xl`, une colonne par niveau
Brut/Actuel/Résiduel, cartes sous `md`, abréviations G/V traduites, `aria-label`) ·
commit d'audit (`docs/methodes-directes-comparatif-iso.md`, réécrit, NIST inclus).

**Vérifié** : 2091 tests verts, `tsc` 0, `i18n:check` OK ; navigateur ISO 31000 :
1280 px → 1070 px utiles, plus de défilement horizontal ; 375 px → cartes, pas de
débordement de page.

**À décider par l'utilisateur** : lots P1 à P8 de l'audit (§7 du document).
Principaux : P1 échelles/critères de l'org non appliqués aux méthodes directes
(figées 1–4) ; P2 évaluation sur le brut au lieu de l'actuel, appétit ignoré ;
P3 pas de propriétaire du risque ; P4 aucun rapport/export pour ces méthodes.

---

## 2026-09-28 (suite) — Claude Code : qualification finalisée + correctifs d'audit

**Branche** : `feat/historical-excel-import` (inchangée). **Non poussé** (aucune demande).

**Décisions utilisateur appliquées** : imposé = non décochable ; EBIOS RM → proposé en atelier 5.

**Commits de ce tour**
- `607bc3a` skill commune + ce journal · `9577039` reprise telle quelle du chantier Codex
- `72e986b` qualification : imposé, EBIOS atelier 5, anti-doublon par règle
  (`Risque.qualificationRuleId` unique par analyse), gel, audit, bilan, catalogue
  par défaut traduit ×5 (RGPD art. 4.12), éditeur de règles complet
- `1a36efa` import : liens `RISQUE_ANALYSE` avec `ref` (+ migration de rattrapage),
  cellules Excel à formule/texte enrichi, garde zip + rate limit (DoS), erreurs, CSV
- `91930fc` gel respecté à la validation MCP + export d'organisation journalisé
- `929c11a` /configuration perdait (et aurait effacé) les règles de risques

**Vérifié**
- `npm test` 245 fichiers / **2091 tests verts** · `tsc` 0 erreur · `i18n:check` OK ·
  `npm run build` OK (avant le dernier commit, qui ne touche qu'une page client).
- Recette navigateur (dev :3005) : éditeur de règles (6 règles, imposé enregistré) ;
  ISO 27005 → fenêtre de proposition, imposé verrouillé, bilan « 1 créé, 1 non
  retenu », anti-doublon (seul l'optionnel reproposé) ; EBIOS → création directe
  refusée, bloc atelier 5 non masquable tant qu'un imposé reste, ajout persisté
  par l'auto-save avec la règle d'origine, résiste au rechargement ; route de
  prévisualisation Excel réelle : formule `G×V` lue 3/6/9, texte enrichi lu,
  non-xlsx → 422 ; fichier de 9 Mo de l'audit refusé en 0,5 ms (au lieu de 15 s).
- Migrations appliquées en local : `20260928230000` (Codex), `20260928240000`,
  `20260928250000` (4 liens rattrapés).

**Données locales modifiées pendant la recette** : config globale — règle
`cyber-internet-exposure` imposée ; qualification saisie sur « Test ARS ISO27k5 »
et « Résilience des services numériques critiques » (+1 et +2 risques issus de règles).

**Serveur de dev** : celui lancé à 10:29 tenait :3005 avec un client Prisma périmé ;
redémarré à l'identique (`next dev -p 3005`, toutes interfaces) avec
`DATABASE_URL` en localhost.

### Suites proposées
1. Lien profond `RISQUE_ANALYSE` d'une analyse **EBIOS RM** (import) : ouvre
   l'atelier 1 au lieu de l'atelier 5 (`lienHref` ignore la méthode).
2. `qualificationActive` = false sur les organisations existantes : la migration
   n'a changé que le défaut ; décider s'il faut l'activer pour elles (indiscernable
   d'un choix explicite).
3. Sauvegarde A5 « tout supprimer / recréer » avec `...rest` du client (pré-existant) :
   affectation de masse de colonnes `Risque` — passer à une allowlist comme pour les mesures.
4. Validation MCP : la mise à jour du statut de la proposition est hors transaction
   (double application possible si elle échoue) — pré-existant.

---

## 2026-09-28 — Claude Code (audit, sans modification du code applicatif)

**Branche courante** : `feat/historical-excel-import` (déjà fusionnée dans
`origin/main` via #189 — on continue dessus, pas de nouvelle branche).

**Trouvé en début de tour** : chantier Codex **non commité** « risques proposés
par la qualification » (`docs/specs/qualification-risques-defaut.md`) :
qualification active par défaut (migration `20260928230000_…`), moteur
`suggestedQualificationRisks`, route `POST /api/analyses/[id]/qualification-risks`,
composants `QualificationRiskProposal` / `QualificationQuestions`.
État vérifié : `tsc` 0 erreur · `npm test` **239 fichiers / 2051 tests verts**.
Non commité, non poussé. **Laissé intact.**

**Fait ce tour** : audit de #189 + du chantier en cours ; création de la skill
commune `.claude/skills/acra-engineering/` (Codex y accède par lien symbolique) ;
ce journal.

### À corriger (par priorité)
1. **Import — liens `RISQUE_ANALYSE` sans `ref`** (`lib/analysis-import.ts` l.108,116,154,162) :
   plans importés comptés 0 dans le registre de l'analyse, lien profond cassé dans
   `/plans-actions`. Ajouter `ref: analyseId` ; factoriser l'écriture dupliquée
   entre `executeAnalysisImport` et `applyAnalysisImportContent`.
2. **Import Excel — cellules à formule / texte enrichi** importées en
   `"[object Object]"` (helper `cell()` dupliqué dans `analysis-imports/route.ts`
   et `preview/route.ts`) → lire `cell.text`, extraire le helper en lib + test.
3. **Import Excel — DoS** : un xlsx de 9 Mo bloque l'event loop ~15 s ; pas de
   rate limit ni de taille décompressée max sur `preview` et `import`.
4. **Gel contourné** : route qualification-risks et validation MCP
   (`risk`/`measure`/`analysis_import`) n'appliquent pas `analyseGelee`.
5. **Qualification (chantier en cours)** — écarts à la spec : non atomique (pas de
   transaction), idempotence par titre et non par règle, pas de bilan
   créés/exclus, pas d'`auditLog`, règles par défaut **en français codé en dur**,
   libellés d'UI provisoires (gravité et vraisemblance → `short.criticite`),
   mode « **imposé** » demandé par l'utilisateur absent de la spec, sémantique
   EBIOS RM à trancher (un `Risque` direct dans une analyse EBIOS n'est pas éditable).
6. Mineurs : export d'organisation sans `auditLog` ; CSV du reçu d'import sans
   neutralisation de formule ; `details: message` brut renvoyé au client ;
   transaction d'import au timeout Prisma par défaut (5 s) pour 500 × 4 lignes
   séquentielles.

### Prochain pas proposé
Terminer le chantier qualification (point 5) puis corriger 1 → 4, chacun en
commit séparé, TDD. Décision utilisateur attendue : sens de « imposé » et
comportement en EBIOS RM.
