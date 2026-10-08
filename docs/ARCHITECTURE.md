# Carte du code ACRA — pour agents & IA

> But de ce document : permettre à **plusieurs agents/IA de travailler en parallèle**
> sur le code sans tout relire. Il répond à « **où vit quoi ?** » et « **quels patterns
> respecter ?** ». Il complète, sans les remplacer :
> - [`CONTRIBUTING.md`](../CONTRIBUTING.md) — *comment* contribuer (TDD, PR, i18n) ;
> - [`docs/ara-grc-spec.md`](ara-grc-spec.md) — *pourquoi* / quels modules GRC (M0→M5) ;
> - [`CLAUDE.md`](../../CLAUDE.md) (racine) + [`CLAUDE.md`](../CLAUDE.md) (app) — règles impératives.
>
> ⚠️ Ce fichier décrit une intention d'organisation ; en cas de doute, **le code fait foi**.
> Si vous constatez un écart, corrigez le code *ou* ce document.

---

## 1. Stack & démarrage

- **Next.js 16 (App Router)** — ⚠️ lire `node_modules/next/dist/docs/` avant d'écrire du
  code Next (voir `AGENTS.md`), les conventions diffèrent des versions connues.
- **React 18** (composants serveur par défaut ; `'use client'` explicite sinon).
- **Prisma** + **PostgreSQL** (49 modèles, `prisma/schema.prisma`).
  Prisma 7 : l'URL de connexion n'est plus dans le schéma. La CLI (migrations) la lit dans
  `prisma.config.ts` (qui charge `.env` s'il existe) ; le client passe par l'adaptateur
  `@prisma/adapter-pg` (`src/lib/prisma.ts`, seeds, `scripts/*.mjs`). Ne jamais écrire
  `new PrismaClient()` sans `adapter`. Dans l'image Docker, la CLI est installée à part
  (`/app/prisma-cli`, lien `node_modules/prisma`) pour le service migrator.
- **NextAuth** (Credentials + SSO OIDC ; SAML en chantier de maintenance).
- **Tailwind 4** pour le style (thème et variante `dark` déclarés dans `src/app/globals.css`, plus de `tailwind.config.js`) ; **lucide-react** pour les icônes.
- **Vitest** + Testing Library pour les tests.

```bash
docker-compose up -d   # PostgreSQL (démarrer Docker Desktop d'abord)
npm run dev            # app sur :3000
npm test               # tests (obligatoire avant de considérer une feature finie)
```

---

## 2. Arborescence

```
src/
  app/          Pages (App Router) + routes API (~45 pages, ~150 routes API)
    api/        Endpoints REST : auth de session OU clé d'API (voir §5)
    <domaine>/  Une page = un composant client « …Manager / …Client / …View »
  components/   ~80 composants React (chacun a un en-tête décrivant son rôle)
  lib/          ~185 modules de logique métier — cœur du projet (voir §4)
    i18n/       Traductions fr/en/de/es/it + contexte React
  __tests__/    Tests Vitest (unit/lib, unit/components, unit/api)
prisma/         schema.prisma + migrations
docs/           Specs & documentation (ce fichier, ara-grc-spec, dérogations…)
```

**Convention `lib/`** : un module `xxx.ts` = **cœur pur** (testable sans DB) ;
`xxx.server.ts` = **couche serveur** (accès Prisma, `getServerSession`). Garder la
logique décidable dans le `.ts` pur et testée ; le `.server.ts` orchestre l'I/O.

---

## 3. Modèle de domaine (le vocabulaire)

ACRA est un **monolithe modulaire** : un socle EBIOS RM cyber + des modules GRC
activables (cf. `ara-grc-spec.md`). Les concepts à connaître :

- **Analyse** EBIOS RM = 5 **ateliers** (`ATELIERS_META`, `atelier-icons`). Une analyse
  peut être un **socle** de sécurité réutilisable.
- **Modules GRC** (préfixes `Mx` dans les commentaires `lib/`) :
  - **M1** Cartographie des risques / registre (`cartographie`, `risk-*`, `catalogue-risks`) ;
  - **M2** Incidents & pertes (`incident`, `dora*`) + roll-up (`grc-rollup`) ;
  - **M3** Contrôle permanent N1/N2 (`controle`, `campagne*`) ;
  - **M4** Audit interne (`audit`, `audit-programmes-catalogue`) ;
  - **M5** = le module cyber ACRA historique (les ateliers).
- **Conformité** : un **référentiel** (`referentiel*`) porte des **exigences** ; chaque
  contrôle a un **statut** et, sur un écart, un **traitement**.
- **Plan d'action unifié** (`plan-action`, `action-items`) : couche transverse qui
  agrège **toutes** les actions à mener par **origine** (risque, conformité, contrôle,
  audit, régulateur, incident, orpheline). Voir §6.
- **Traitement d'un écart** : 3 types — **plan d'action**, **dérogation** (workflow RSSI
  formel, `derogation`), **acceptation** de risque.
- **Écosystème / tiers** (`tiers`, `ecosystem-*`) et **Registre TIC** DORA (`registre-tic`,
  `tiers-tic-link`).
- **Régulatoire** : DORA (`dora*`), RGPD/RoPA (`ropa*`, `rgpd-sensitive`), NIS2
  (`nis2-mapping`), SoA (`soa-*`), suivi régulateur (`suivi-regulateur`).
- **Multi-organisation** : arbre d'orgs, config résolue à un seul point (voir §7 et
  `docs/MULTI-ORGANISATION.md`).

---

## 4. Index `lib/` par domaine (où chercher la logique)

> Chaque fichier porte un en-tête décrivant son rôle ; ci-dessous le regroupement.

| Domaine | Modules clés |
|---|---|
| **EBIOS / ateliers** | `ebios-data`, `ebios-gravite`, `atelier-icons`, `exemples-*` (dont `exemples-sectoriels-ext` : contenu sectoriel des ateliers 1 à 5 traduit ×5 **dans la donnée**, éléments filtrés par sous-profession — à préférer aux dictionnaires indexés par position pour tout nouveau contenu), `biens-supports`, `vraisemblance-methode` ; UI `workshops/SectorMeasuresPanel` (atelier 5) |
| **Risques (M1)** | `cartographie`, `risk-item`, `risk-action`, `risk-scale`, `risk-filters`, `risk-current`, `risk-publication`, `catalogue-risks` (risques repris de l'ancien socle, catégories bâloises), `appetit`, `taxonomie` |
| **Incidents (M2)** | `incident`, `incident-dedup`, `kri`, `grc-rollup`, `grc-consolide.server` |
| **Contrôle (M3)** | `controle`, `controles-catalogue`, `campagne`, `campagne-controle`, `archivage` ; questionnaires de contrôle `questionnaire` (questions, réponses, revue, non-conformités par exigence — pur) / `questionnaire.server` (contexte 2ᵉ ligne sur rôle effectif, répondants, chargement avec 404 hors périmètre), `rapport-mission-controle` (rapport Word d'une mission — pur), `relances` (relances questionnaires / préconisations / plans d'action et décisions en attente : vérifications, approbations, dérogations — pur) / `relances.server` (passage unique : un e-mail de synthèse par personne, toutes sources et organisations confondues), `alertes-dora` (alertes urgentes des échéances de déclaration — pur) / `.server` (cron horaire), `tableau-bord-mensuel` (indicateurs et points d'attention du mois — pur) / `.server` (envoi mensuel aux RSSI et gestionnaires des risques, `EnvoiPeriodique`) ; routes `questionnaires/**`, `preconisations/**`, `controles/campagnes/[id]/rapport-controle`, `relances/config`, cron `relances` ; UI `components/questionnaires/*`, page `/controles/questionnaires` |
| **Audit (M4)** | `audit`, `audit-programmes-catalogue`, `audit-redact`, `rapport-controle-interne*` |
| **Programme d'audit et de contrôle** | `planification` (configuration, saisies multi-prismes, cycle de validation figé / dynamique, double regard — pur) ; `planification.server` (contexte, lecture globale, 404 hors organisation ou module) ; modèles `PlanProgramme` → `PlanAnnee` (statut, contenu figé, historique) / `PlanLigne` (cibles : organisations, tiers, risques, processus, référentiel et exigences ; échantillon) ; `planification-vue` (sollicitations multiples — filiales, entités du référentiel (directes, via les risques liés, ramenées au successeur après réorganisation : `entitesSollicitees`, `carteSuccesseurs`), tiers — et angles morts ; pur), `planification-xlsx` (exports) ; routes `plans`, `plans/[id]`, `plans/[id]/lignes/**` (dont `realisations`), `plans/[id]/annees/[annee]`, `plans/[id]/export`, `plans/vue` (+ `export`), `plans/options` ; UI `components/plans/*` (`PlansManager`, `PlanView`, `PlanFrise`, `LigneForm`, `RealisationsPanel`, `VueGlobale`), pages `/plans`, `/plans/[id]`, `PlanificationSettings` (configuration). Spec : `docs/specs/programme-audit-controle.md` |
| **Référentiel des entités** | `entites` (types FILIALE / DIRECTION / SITE / SERVICE / AUTRE, validation, hiérarchie sans boucle, rapprochement d'un texte libre par nom / alias / code, champs verrouillés quand l'annuaire fait foi, rétention 5 ans — pur) ; `entites.server` (contexte : lecture par tout membre, écriture ADMIN ; contrôles de liens) ; modèle `Entite` + lien optionnel `entiteId` sur `RiskItem`, `Incident`, `Conformite`, `PlanAction`, `ConformiteTraitement`, `Mesure` (le texte libre `entite` est conservé) ; source de vérité = `entitesSyncConfig.sourceVerite` ; `entites-import` (aperçu d'import : nouvelles, renommées par identifiant externe, inchangées, doublons probables, rejetées, disparues — pur) ; `entites-rapprochement` (valeurs distinctes des champs texte `entite`, proposition exacte / proche / aucune, plan de liens, alias et créations — pur) ; `entites-reorganisation` (renommage, fusion, scission, clôture : créations, transferts de références et de sous-entités, clôtures ; `entiteALaDate` — pur) ; modèle `EntiteEvenement` (historique, objets déplacés, 5 ans) ; `entites-filtre` (entité d'un objet : lien, sinon texte identique ; périmètre avec sous-entités ; options hiérarchiques — pur), `use-referentiel-entites` (chargement client), `entiteIdPourTexte` (lien automatique à l'écriture des incidents et plans d'action) ; UI `FiltreEntite` (listes d'incidents et de plans d'action, barre `RiskFiltersBar` du pilotage et de la cartographie : `RiskFilters.entiteId` / `sousEntites`, `applyFilters(…, { entites })`) ; `entites-synthese` (répartition par entité avec cumul des sous-entités, `syntheseParEntite` → `consolide.parEntite` de `/api/grc/rollup` — pur) ; `entity-sync.server` (lecture du connecteur REST / LDAP, partagée avec la synchronisation historique) ; routes `referentiel-entites`, `referentiel-entites/[id]`, `referentiel-entites/import`, `referentiel-entites/rapprochement`, `referentiel-entites/reorganisations` ; UI `ReferentielEntites`, `ImportEntitesPanel`, `RapprochementEntitesPanel`, `ReorganisationEntitePanel`, `HistoriqueEntites` (page `/configuration/entites`). Spec : `docs/specs/entites-consolidation-besoin.md` (lots E1–E5) |
| **Conformité** | `conformite*`, `referentiel*`, `couverture-referentiel`, `derogation*`, `conformite-traitement`, `socle-etat` |
| **Mise à jour et points de restauration** | scripts : `update.sh` (lanceur : PRECHECK→FETCH→HANDOFF), `update-lib.sh` (journal, statut, retour arrière), `update-steps.sh` (MIGRATE→FINALIZE, exécuté depuis la version cible), `update-agent.sh` (demandes de l'interface + reprise), `acra-snapshot.sh` (create/verify/restore/prune), `check-migrations.ts` ; fichiers d'échange `.acra-update/` (`status.json`, `run/current.json`, `snapshots.json`, `events.log`) ; libs pures `snapshot`, `update-run`, `update-request`, `migration-policy`, `migration-check`, `migration-drift`, `instance-events` ; routes `/api/admin/version/{update,rollback}`, `/api/health?deep=1` ; panneau `UpdateRestorePanel`. Spec : `docs/specs/sauvegarde-rollback-spec.md` |
| **Stockage, supervision et nettoyage** | libs pures `storage-usage` (seuils 80/90, projection de saturation, `parseHostStats`), `cache-cleanup` (règles B1–B8 : jetons, sessions, défis MFA, invitations, livraisons de webhooks, accusés d'import ; liste figée des modèles jamais purgés) ; `.server` : `storage-usage.server` (mesures en lecture seule, cache 5 min, `StorageSnapshot` quotidien), `cache-cleanup.server` (suppression par lots, bail `Configuration.cleanupLockUntil`), `cache-cleanup.instance.server` (réglages d'instance) ; `snapshot.selectBackupsToPrune` + `update-request.buildBackupPruneRequest` (liste exacte d'identifiants, `acra-snapshot.sh prune --ids`) ; scripts `update-agent.sh` (publie `host-stats.json`, traite `backup-prune`), `backup.sh` (`BACKUP_KEEP`) ; routes `/api/admin/storage`, `/api/admin/storage/cleanup`, `/api/admin/backup/prune`, cron `/api/cron/cleanup` (03:00) ; UI `StorageUsagePanel` (page `/admin`), `BackupPrunePanel` ; `make docker-usage` / `docker-clean`. Spec : `docs/specs/stockage-supervision-nettoyage.md` |
| **Plan d'action unifié** | `plan-action`, `plan-action.server`, `action-items`, `action-items.server`, `promotable-actions.server`, `mesure-categorie` |
| **Maturité (profils cibles CMMI)** | `maturity` (échelle CMMI 0–5, fusion horodatée, écarts, synthèse par domaine, CSV — pur), `maturity.server` (contexte 404 si module inactif, chargement d'un profil) — **couche de `Conformite`** (colonnes `maturites`, `maturiteCible`), jamais réécrite par l'édition de conformité ; échelle personnalisable `OrganizationConfig.echelleMaturite` |
| **Incidents & pertes (L1)** | `notification-regimes` (catalogue NIS2 / RGPD art. 33 / interne + régimes personnalisés, horloges, notifications soumises — pur) ; `pertes` (lignes typées, devises, seuils — pur) ; `incidents-config` (config org : régimes, devise/taux, seuils, catalogues ; `OrganizationConfig.incidentsConfig`) ; `incident-vue` (vue calculée + colonnes LDC) ; `incident-access.server` (garde commune) ; routes `incidents/config`, `incidents/[id]/notifications` ; UI `NotificationsPanel`, `PertesEditor`, `IncidentsConfigEditor` |
| **Rapports GRC (L2)** | `rapport-model` (catalogue, périodes, cycle quatre-yeux — pur) ; `rapport-incidents` (R-INC-1, R-PER-2), `rapport-direction` (R-GRC-3), `rapport-render` (clés i18n, feuilles d'export) — purs ; `rapports.server` (chargement + génération) ; `rapport-acces` (droits) ; modèle `RapportEdition` (contenu figé) ; routes `rapports`, `rapports/[id]`, `rapports/[id]/export` ; UI `RapportsManager`, `RapportView` ; pages `/rapports`, `/rapports/[id]` |
| **Contrôle permanent (L3)** | `controle-l3` (typologie, conception × efficacité, échantillon suggéré, plan annuel, flux continu, récurrence/escalade, champs à persister, vue — pur) ; `rapport-controles` (R-CTL-1/2/3, pur) ; champs `Controle.typeControle/modeControle/cle/methodeEchantillon/conception`, `ControleExecution.source` ; routes `controles/plan`, `v1/controls/[id]/results` ; UI `ControleL3Fields`, `ConceptionPanel`, `ControleL3Badges`, `PlanControleView`, page `/controles/plan` |
| **Audit interne (L4)** | `audit-l4` (notation, jalons, indépendance, suivi des recommandations `appliquerSuivi`, synthèse, univers et `planPluriannuel` — pur) ; `audit-acces` ; `rapport-audit` (R-AUD-1/2/3, pur) ; champs `AuditMission.notation/jalons/independance/universIds`, `AuditConstat.critere/cause/consequence/echeanceInitiale/reports/realiseePar/verifiePar…`, modèle `AuditUnivers` ; routes `audit/constats/[id]/suivi`, `audit/missions/[id]/independance`, `audit/univers`, `audit/plan` ; UI `RecommandationSuivi`, `MissionSuiviPanel`, `AuditPlanView`, page `/audit/plan` |
| **Personnalisation (L5)** | `vocabulaire` (termes → chemins i18n, `applyVocabulaire`), `champs-perso` (définitions, valeurs, visibilité par rôle, fusion), `gabarits` (8 gabarits sectoriels, `planGabarit`) — purs ; `OrganizationConfig.vocabulaire/champsPersonnalises`, colonnes `champs` (Incident, Controle, AuditMission) ; routes `personnalisation`, `personnalisation/gabarit` ; UI `PersonnalisationManager`, `ChampsPersonnalisesFields`, `usePersonnalisationChamps` ; `I18nProvider` applique le vocabulaire ; page `/configuration/personnalisation` |
| **Projet 360** | `projet360` (domaines, questionnaire 360, règles de risques proposés, synthèse par domaine, double approbation RSSI + RM, import cyber — pur) ; méthode `PROJET_360` dans `methodes` ; suivi cockpit (`synthetiserProjets360`), lien analyse cyber ⇄ projet (`resolveProjetSource`, `Analyse.projetSourceId`), garde du cockpit GRC (`isGrcActive`) ; routes `analyses/[id]/qualification-360`, `analyses/[id]/import-cyber`, `projets` (liste), bloc `projets` de `grc/rollup` ; UI `ProjetsManager`, `ProjetSourcePicker`, `ProjetsSuivi` |
| **Gouvernance du risque** | `ras-rad` / `ras-rad.server` (vue `/appetence`), `processus-carto` (page `/cartographie/processus`, `OrganizationConfig.processusCartographie`) |
| **Déclarations d'incidents** | `incident-types-catalogue` (28 incidents types), `incident-declaration` (champs ITS DORA 2025/302 + JSON, pur), `notification-regimes` (régimes, horloges), `alertes-notifications` (relances tous régimes), `alertes-dora` ; routes `incidents/[id]/declaration|notifications` ; UI `DeclarationModal`, `IncidentTypePicker` |
| **Catalogue sectoriel** | `sector-suggestions` (processus, risques, socle de contrôles, KRI, missions d'audit ; provenance `catalogueKey`), `sector-packs` (contrôles/KRI/audit par secteur ; packs écrits avec `catalogue-pack-builder`, enregistrés dans `sector-packs-ext` — ex. `sector-packs-sante-technique` : secteur TECHNIQUE et compléments santé/mutuelle, catalogue 1.12), `catalogue-resilience` (plans de test DORA modèles), `catalogue-review` (grille de revue métier, `npm run catalogue:review`), `catalogue-risks` (risques repris de l'ancien socle, catégories bâloises), `catalogue-links` (contrôles/missions → risques couverts), `controle-templates` et `audit-templates` (catalogues unifiés de contrôles et de modèles de mission : entrée par référentiel, processus ou risque), `sector-context.server` (secteurs effectifs, hérités du groupe), `sector-suggestions-changelog` (historique par version, « nouveautés »), `sector-suggestion-plan`, `sector-selection` ; route `catalogue-suggestions` (module actif + rôle habilité par type) ; UI `SectorSuggestionsPanel` |
| **Tiers canoniques** | `tier-identity`, `tier-offers`, `tier-merge`, `tier-contract-coverage`, `tier-registry.server` ; routes `tier-registry/*` ; UI `TierIdentityPanel`, `TierDetailPanel` |
| **Régulatoire** | `tests-resilience` / `tests-resilience.server` (DORA art. 24-26, rapport de réexamen art. 6 § 5), `dora`, `dora-reporting`, `dora-its-export`, `nis2-mapping`, `ropa`, `ropa-catalogue`, `rgpd-sensitive`, `suivi-regulateur`, `registre-tic`, `tic-contract-import` (import guidé de contrats, pur), `tic-questionnaire`, `soa-*`, `politique-defaut` |
| **Écosystème / tiers** | `tiers`, `tiers.server`, `ecosystem-*`, `tiers-tic-link`, `tier-contract-coverage`, `operateur-ae` ; schéma canonique additif `Tier` → offres `TierService` → contrats `ArrangementTic` / usages `TierServiceUsage` ; routes `api/tiers/contracts/[id]/beneficiaries`, `api/tiers/services/[id]/usages` ; UI et rapprochement restent à réaliser. |
| **Sécurité / accès** | `auth`, `auth-cookies`, `permissions` (RBAC), `mfa*`, `sso*`, `saml*`, `scim*`, `login-lockout`, `password-policy`, `password-reset`, `rate-limit`, `secret-crypto`, `recovery`, `api-auth.server`, `api-key`, `cron-auth`, `csp` |
| **Multi-org / config** | `org-*`, `module-policy`, `configuration-*`, `nav-modules-cache`, `navigation`, `branding*` |
| **Interop** | `api-import`, `import-sanitize`, `webhook*`, `siem*`, `suggestions` |
| **Serveur MCP** | `lib/mcp/` : `protocol` (JSON-RPC, pur), `auth.server` (clé `mcp`, interrupteurs instance `mcpEnabled` / org `mcpActive`), `instructions` (consignes `initialize`), outils `tools*.server` (`read_*`, `recommend_*`, `propose_*`), `proposals` / `projet360-proposal` / `pssi-proposal` (assainissement pur), `anchors.server` (ancre dans l'org de la clé), `pssi-import.server`, `activity` (synthèse pure) ; routes `api/mcp` (public, clé), `api/mcp-proposals/**` (validation humaine, RBAC de l'ancre), `api/mcp-activity` ; UI `McpProposalsQueue` (`/mcp-propositions`), `McpActivity` (`/mcp-activite`) ; test `mcp-isolation-matrix` (chaque outil classé). Guide client : `docs/mcp-clients.md`, cadrage : `docs/mcp-cadrage.md` |
| **Exports** | `export-pdf`, `pdf-*`, `*-pdf-template.tsx`, `analyse-docx`, `analyse-pptx`, `markdown-docx`, `*-pptx`, `carto-export`, `ras-export`, `comite-pack`, `soa-export` |
| **Cockpits** | `grc-cockpit`, `comite-pack`, `ras-export`, `donut`, `sr-ov-radar`, `most-frequent` |
| **UI transverse** | `table-sort`, `table-filter` (tri/filtre « façon tableur »), `format`, `form-defaults`, `contrast-color`, `theme*`, `i18n/`, `useAutoSave`, `useAddedFeedback` |

La navbar est construite par `navigation.buildNav` (rôle + modules effectifs), puis rendue par `Navbar` sur desktop et mobile avec les mêmes groupes : KRI dans Pilotage avec RAS/RAD ; registre des risques et registre TIC sous Registres, sans fusion de leurs données. Pour publier des risques d'analyse dans le registre, `api/risk-items/publish` verrouille la paire organisation/analyse dans une transaction PostgreSQL avant de lire et créer les `RiskItem`. `risk-publication.indexPublishedRisks` détecte une provenance déjà dupliquée ; la route renvoie 409 sans écriture dans ce cas. Une contrainte d'unicité en base reste à poser après diagnostic des doublons historiques.

---

## 5. Routes API — patterns d'authentification

Deux familles, **ne pas les mélanger** :

1. **Session utilisateur** (UI) : `getServerSession(authOptions)` puis résolution du
   périmètre org via `lib/org-context.server` (`getAnalyseScope`, scope org). RBAC via
   `lib/permissions`. La plupart des routes sous `/api/**`.
2. **Clé d'API** (machine, API publique v1, `/api/v1/**`) : `lib/api-auth.server`
   (Bearer), scopes `read | write | provision`. Import en masse via `lib/api-import`.
3. **Clé d'API au scope `mcp`** (assistants IA, `/api/mcp`) : `lib/mcp/auth.server` ; les outils ne
   lisent que l'organisation de la clé et n'écrivent jamais : ils déposent des `McpProposal`
   acceptées par un humain (`/api/mcp-proposals/[id]`, mêmes gardes que l'UI, dont le plafond démo).

**Gardes communes (audit 2026-09-30/10-01, ne pas recopier de garde locale)** :
- réglage ou vue d'**instance** → `requireInstanceAdmin()` (`lib/route-guard.server`) ;
- ressource d'une **organisation donnée** → rôle **effectif** dans CETTE org :
  `getEffectiveRoleForOrg` (jamais le rôle global `session.user.role`) ;
- **administration** (comptes, corbeille, journal) → `getAdminScope` / `getAdminOrgIds` :
  seulement les organisations où le rôle effectif est administrateur ;
- **création d'analyse** (y compris import) → `checkAnalyseCreation`
  (`lib/analyse-create-guard.server`) ;
- **gestion d'un compte** (mot de passe, suspension, suppression) → `decideUserManagement`
  / `decideUserDeletion` (`lib/user-deletion`).
Un test cliquet (`route-guard-ratchet.test.ts`) refuse les gardes locales et les
comparaisons de rôle `SUPER_ADMIN` ad hoc dans les routes.

Autres gardes : endpoints **cron** → `lib/cron-auth` ; instances **démo** →
`isDemoInstance()` (`lib/demo-server`). Journaliser les actions sensibles via
`auditLog` (`lib/logger`). Une route qui embarque de la logique décidable doit
l'**extraire en fonction pure testée** (cf. CLAUDE.md).

---

## 6. Plan d'action unifié (à comprendre avant d'y toucher)

- Store **`PlanAction`** + **liens polymorphes** `PlanActionLien` (types : `ANALYSE`,
  `CONFORMITE`, `CONTROLE`, `AUDIT`, `RISQUE`, `RISQUE_ANALYSE`, `INCIDENT`).
  `RISQUE_ANALYSE` ancre un risque des méthodes à saisie directe (ISO/IEC 27005,
  ISO 31000, NIST SP 800-30) et conserve l'identifiant d'analyse dans `ref`.
  `CONFORMITE` : `targetId` = code du référentiel, `ref` = point de contrôle ; c'est
  aussi le lien des actions issues d'un **écart de maturité** (même objet que la
  conformité) — helpers `createConformitePlanAction` / `findOpenConformiteAction`
  (anti-doublon commun) dans `plan-action.server`.
- `lib/action-items` **agrège** 7 origines en une liste unifiée (vue `/actions` =
  `PlansActionsView`). Filtrage à facettes + tri/filtre colonne (`table-sort`/`table-filter`).
- **Promotion** : une mesure d'analyse ou un incident (pas encore un `PlanAction`) peut
  être **promu** en `PlanAction` rattaché (`promotable-actions.server`, `TraitementPopover`).
- ⚠️ **Décision assumée** : les traitements de conformité de type `PLAN_ACTION` ne sont
  **pas** migrés de force dans `PlanAction` (friction `CLOTURE` + double-source).
  `PlanAction` est la **couche unifiante**, pas un stockage imposé. Voir la mémoire
  projet `plan-action-unifie` et l'en-tête de `TraitementPopover.tsx`.

---

## 7. Patterns transverses à respecter

- **Config à 3 niveaux** (défaut → toggle org → politique d'instance) résolue en **un
  seul point** (`getOrgConfig`) : lire `orgConfig.<feature>Active`, ne **jamais**
  disperser les vérifications. Détail dans `CLAUDE.md` (racine).
- **i18n obligatoire** : toute string UI passe par `t.xxx` ; ajouter les clés dans les
  **5** fichiers `lib/i18n/` (fr, en, de, es, it). Contenu réglementaire/normatif :
  terminologie **officielle** EUR-Lex/ISO, jamais de traduction maison, citer la version.
- **RBAC** : `lib/permissions`. Échelles/matrice → ADMIN ; approbation → RISK_MANAGER &
  RSSI ; dérogation → workflow dédié (`lib/derogation`).
- **Cumul de rôles (petite structure)** : `OrganizationConfig.petiteStructure`. Ne jamais
  comparer `role === 'RSSI'` en dur : passer par `exerceRole(role, cible, opts)`
  (`lib/permissions`) avec `opts = await optionsStructure(orgId)` (`org-config.server`).
  Les contrôles `canCreateAnalyse`, `canSubmitAnalyse`, `canApproveAnalyse`,
  `canAutoValidateAnalyse`, `canAvisRssiDerogation`, `canDoubleRegardDerogation`,
  `applyApprobation` (projet 360) et les destinataires des relances prennent ces options.
  RSSI ⇄ RISK_MANAGER ⇄ ANALYSTE cumulés ; ADMIN → RSSI et RISK_MANAGER ; jamais la
  direction métier. Le rôle passé est toujours le **rôle effectif dans l'org de la
  ressource** (`getEffectiveRoleForOrg`), et chaque cumul est journalisé.
- **Colonnes de DB sans accent** (Prisma) : `valeursMetier`, pas `valeursMétier`.
- **TDD** : test d'abord (`src/__tests__/unit/**`), mock `next/navigation`, `next/link`,
  `@/lib/i18n/context` pour les composants. Corriger toute erreur TS rencontrée.
- **Tables « façon tableur »** : réutiliser `ColumnMenu` + `lib/table-sort` +
  `lib/table-filter` (ne pas réinventer le tri/filtre par colonne).
- **Auto-save** : `useAutoSave` dans les composants d'atelier.

---

## 8. Où ajouter une feature (raccourci)

| Je veux… | Je touche… |
|---|---|
| un champ d'atelier | modèle Prisma + migration, page atelier, i18n ×5, test |
| une route API | `src/app/api/**/route.ts` (auth §5), extraire la logique en `lib/*.ts` pur + test |
| un module métier | `lib/<domaine>.ts` (pur, testé) + `lib/<domaine>.server.ts` (I/O) + composant `…Manager` |
| une table triable/filtrable | `ColumnMenu` + `table-sort`/`table-filter` |
| une activation de module | modèle config à 3 niveaux (§7), jamais de garde dispersée |
| une langue | cf. `CONTRIBUTING.md` → « New i18n language » |

Voir aussi `CONTRIBUTING.md` (« Adding a feature ») pour la checklist détaillée.
