# Journal de passation — Claude Code ⇄ Codex

À lire en **début de tour**, à mettre à jour en **fin de tour** (cf. skill
`acra-engineering` §1). Le plus récent en haut. Rester factuel : ce qui a été
vérifié l'est avec la commande et son résultat.

---

## 2026-10-01 (51) — Claude Code : tableau de bord mensuel des RSSI et gestionnaires des risques

- Demande : « les RSSI et RM doivent recevoir un dashboard mensuel avec le plus important par mail » ; réfléchir aux autres relances (proposition faite dans la réponse, non implémentée).
- `lib/tableau-bord-mensuel.ts` (pur, testé) : `construireTableauBord` (indicateurs des modules actifs + points d'attention, réutilise postureBucket, estHorsAppetit, evaluerEfficacite, synthetiserConstats, evaluerKri, classifierIncident, perteNette, buildDerogationDigest), `moisEcoule`. `lib/tableau-bord-mensuel.server.ts` : organisations ayant un destinataire possible seulement (pré-filtre — sans lui, 21 457 orgs de test → > 30 s), destinataires RSSI/RISK_MANAGER (+ parents SUBTREE), ADMIN à défaut ; un e-mail par personne. Anti-doublon : modèle `EnvoiPeriodique` (unique tache+periode, réservé AVANT l'envoi), migration `20261001190000_envoi_periodique`.
- `emailLayout` : `sections` (une par organisation) et compteurs par lignes de 4. `tableauBordEmail` ×5. `derogationDigestEmail` supprimé (intégré au tableau de bord) ; route `derogations-digest` = alias. Planificateurs : `tableau-bord-mensuel` le 1er à 08:00. Interrupteur `relancesConfig.tableauBordMensuel` (défaut actif) dans l'onglet Relances.
- Vérifications : `tsc` OK ; `npm test` 417 / 3342 OK ; `npm run test:db` 12 / 56 OK (destinataires, section par organisation, mois écoulé seulement, organisation désactivée, repli admin, envoi unique + alias) ; `i18n:check` OK ; lint 0 erreur, 0 avertissement sur les fichiers touchés ; build OK ; appel réel : 55 organisations, 80 e-mails préparés en 2,5 s (sans SMTP), alias ensuite → `dejaEnvoye` ; rendu HTML vérifié en capture.

## 2026-10-01 (50) — Claude Code : relances synthétiques (un seul e-mail par personne)

- Demande : les relances doivent être regroupées dans un seul e-mail.
- `lib/relances.server.ts` `executerRelances()` : un passage collecte toutes les sources (questionnaires, préconisations, plans d'action, recommandations d'audit via `calculerRappels`/`auditConfig`, contrôles à exécuter via `prochaineEcheance`/`etatEcheance`, dérogations à expiration via `needsExpiryAlert` + journal `DEROGATION_EXPIRING`, décisions en attente) et envoie **un e-mail par personne, toutes organisations confondues**, trié par urgence. Marqueurs inchangés (`rappelLe`, `alerteeLe`).
- Routes `cron/relances`, `audit-rappels`, `controles-echeances`, `derogations-expiry` = même passage (idempotent ; les anciennes répondent `fusionneDans: 'relances'`). Planificateurs (`scheduler.sh`, workflow) : une seule tâche `relances` à 06:00 ; README et docker-compose à jour.
- `relancesEmail` : paramètres `{ items (avec organisation), url }`, nouvelles catégories (CONSTAT_AUDIT, CONSTAT_A_VERIFIER, CONTROLE_A_EXECUTER, DEROGATION_EXPIRATION) ×5. Gabarits individuels supprimés (`auditRappelEmail`, `controleEcheanceEmail`, `derogationExpiryEmail`) et leurs tests remplacés.
- Vérifications : `tsc` OK ; `npm test` 416 / 3339 OK ; `npm run test:db` 11 / 53 OK (nouveau : 4 sources sur 2 organisations ⇒ 1 e-mail, tri par urgence, alias sans second envoi) ; `i18n:check` OK ; lint 0 erreur, 0 avertissement sur les fichiers touchés ; build OK ; recette : préconisation à vérifier + analyse à approuver pour le même contrôleur ⇒ 1 e-mail ; les 3 alias ensuite ⇒ 0.
- Reste à part : `derogations-digest` (synthèse mensuelle, pas une relance) et les e-mails transactionnels.

## 2026-10-01 (49) — Claude Code : relances des vérifications et validations en attente

- Demande : relancer contrôleurs/auditeurs en attente de vérification pour clôturer une préconisation, et le RSSI pour la validation d'une analyse, d'un projet 360 ou d'une dérogation.
- `lib/relances.ts` : `attenteJours` (défaut 7), `relanceAttenteDue` (un `rappelLe` antérieur au début de l'attente est ignoré → une re-soumission repart du début), `approbateursAnalyse`, `valideursDerogation`, `attenteDerogationDepuis` (purs, testés). Cron `relances` étendu (préconisations RESOLU, analyses SOUMIS, dérogations DEMANDEE / DOUBLE_REGARD / VALIDATION_METIER) ; décideurs = membres de l'org + des parents à portée SUBTREE. `relancesEmail` : 6 catégories et l'état « en attente depuis » ×5. Champ « décision en attente » dans l'onglet Relances.
- Un plan d'action n'a pas d'étape de vérification propre : la vérification porte sur la préconisation (ou le constat d'audit, déjà relancé par `audit-rappels`).
- Vérifications : `tsc` OK ; `npm test` 416 fichiers / 3345 tests OK ; `npm run test:db` 11 / 52 OK (préconisation à vérifier, analyse et projet 360, accès restreint, 3 étapes de dérogation dont RSSI groupe, module inactif, anti-doublon) ; `i18n:check` OK ; lint 0 erreur (805 avertissements, inchangé) ; build OK ; recette : analyse soumise depuis 8 j et préconisation réalisée relancées une fois, second passage 0 ; réglage enregistré depuis l'onglet.
- Piège : le `beforeEach` d'un fichier de test vide les mocks après un `beforeAll` imbriqué — capturer les appels dans le `beforeAll`.

## 2026-10-01 (48) — Claude Code : anomalie de contrôle depuis un questionnaire, relances automatiques

- Décisions de l'utilisateur : une NON_CONFORME sur un point de contrôle enregistre une exécution « anomalie » (préconisation non obligatoire) ; relances avant l'échéance pour les questionnaires **et** les plans d'action, puis régulièrement, tous les mois par défaut.
- Revue conclue (REVUE) → `ControleExecution` ANOMALIE `source=QUESTIONNAIRE` par question NON_CONFORME ciblant un contrôle actif (même transaction ; `alerteeLe` remis à null ; rien lors d'un renvoi A_COMPLETER, pour éviter les doublons). Pas de plan d'action automatique.
- Relances : `lib/relances.ts` (pur), `POST /api/cron/relances` (un e-mail récapitulatif par personne et par org, `relancesEmail` ×5, lien `appUrl`), `GET/PUT /api/relances/config` (PUT ADMIN, rôle effectif), onglet « Relances » ; `relancesConfig` résolu par `getOrgConfig` ; `rappelLe` sur `QuestionnaireReponse`, `Preconisation`, `PlanAction` ; migration `20261001170000_relances` ; tâche ajoutée à `scripts/scheduler.sh` (06:00) et `.github/workflows/scheduled-tasks.yml` (06:45), README.
- Vérifications : `tsc` OK ; `npm test` 416 fichiers / 3339 tests OK ; `npm run test:db` 11 fichiers / 48 tests OK (nouveau `relances.db.test.ts` : regroupement, résolution du responsable, anti-doublon, désactivation ; parcours questionnaire → exécution anomalie) ; `i18n:check` OK ; lint 0 erreur (aucun nouvel avertissement) ; build OK ; navigateur (build de prod) : onglet Relances en lecture seule pour le contrôleur, enregistré par l'admin ; revue NON_CONFORME → message « 1 exécution(s) en anomalie », contrôle « Défaillant » ; cron : préconisation + plan lié antidatés de 35 j → 1 e-mail regroupé, second passage → 0.
- Pièges : sans SMTP, `sendEmail` renvoie `ok:false` (compté `emailsSkipped`) mais `rappelLe` est tout de même posé, comme pour `audit-rappels`.
- Prochains pas possibles : relance des préconisations « réalisées, à vérifier » vers les contrôleurs ; relance distincte pour les plans issus de l'audit (aujourd'hui couverts par la règle générale des plans d'action).

## 2026-10-01 (47) — Claude Code : questionnaires de contrôle, préconisations, rapport de mission

- `f0e1f99` : conformité — appliquer en un clic un constat du contrôle/de l'audit (statut non conforme + trace datée dans le commentaire ; jamais automatique).
- `912e695` : API questionnaires (modèles libres ou « exigences à justifier », envois figés, réponses avec preuves, soumission, revue 2ᵉ ligne), préconisations (cycle de vie des constats d'audit, plan d'action du métier, acceptation de risque suivie en conformité), couverture `nbAnomaliesControle`. Migration `20261001160000_questionnaires_preconisations`.
- Ce tour (commits suivants) : UI `/controles/questionnaires` (onglets À répondre / Préconisations / Modèles / Envois et revue) + entrée de menu ; rapport de contrôle Word d'une mission (📄 dans la liste des campagnes) ; **correctif** : `/conformite` et `/conformite/socle` filtraient sur le rôle **d'instance** (un RISK_MANAGER d'org mais ANALYSTE d'instance était renvoyé au tableau de bord) → rôle effectif, comme l'API.
- Spec à jour : `docs/specs/questionnaires-controle.md` § 7 (livré, écarts : pas d'exécution de contrôle créée depuis une NON_CONFORME sur un point de contrôle, pas de relances).
- Vérifications : `tsc` OK ; `npm test` 414 fichiers / 3326 tests OK ; `npm run test:db` 10 fichiers / 43 tests OK (dont parcours questionnaires + rapport sur vraie base) ; `i18n:check` OK ; lint sans avertissement sur les fichiers nouveaux ; `npm run build` OK ; navigateur (build de prod, comptes contrôleur RISK_MANAGER / métier ANALYSTE) : envoi lié à une mission → réponse avec preuves → revue 8.2 non conforme → préconisation → plan d'action du métier → conformité ISO 27001 affiche l'anomalie de contrôle → rapport .docx téléchargé et relu.
- Pièges : `react-hooks/set-state-in-effect` signale `useEffect(() => { void charger() })` même si le setState suit un `await` → séparer `lire()` (sans effet) et `lire().then(setX)`.
- Prochain pas possibles : NON_CONFORME sur point de contrôle → exécution ANOMALIE (décision produit) ; relances d'échéance ; traduction des socles de contrôles/programmes d'audit ; revue métier experte.

## 2026-10-01 (46) — Claude Code : badge « à compléter », conformité déclaré vs constaté, conception des questionnaires

- `6625e59` : badge « à compléter » des processus (`processus-completude.ts` : propriétaire, criticité ; RTO/RPO si critique/important ou criticité ≥ 3), compteur en tête de cartographie.
- `034aad4` : page de conformité — chaque exigence affiche l'efficacité des contrôles qui la couvrent et les constats d'audit ouverts (`/api/referentiels/couverture`), divergence « déclarée conforme : à revoir » (`confronterDeclaration`, `conformite-constats.ts`) ; statut déclaré jamais modifié automatiquement. Vérifié navigateur (build de prod).
- Conception : `docs/specs/questionnaires-controle.md` (questionnaires métier, revue des preuves, préconisations, missions et rapport de contrôle) — **questions de décision en attente** (§ 6) avant de coder les lots 1-4.

## 2026-10-01 (45) — Claude Code : convergence des catalogues (secteurs, registre, RoPA, contrôles, audit)

- **Décisions utilisateur** : converger quand c'est utile ; entrée référentiel / processus / risque au choix (contrôle et audit) ; RoPA traduit et ligne par ligne ; registre = meilleur des deux ; secteurs alignés sur l'analyse cyber, priorité gestion du risque opérationnel.
- Commits : `c46838f` secteurs (1.7 : énergie, transports, télécoms ; libellés alignés ; gabarit → secteur), `d8089d5` registre (1.8 : 10 risques repris + AML, catégorie bâloise, `seed-defaut` retiré), `73f5258` RoPA (×5, import ligne par ligne, migration `20261001150000`), `b7e1cb5` contrôles (catalogue unifié, `/api/controles/catalogue`, `controles/import` retiré), `66ba43c` audit (`/api/audit/modeles`, `AuditModelePicker`). Détail : spec socles § 8.12.
- **Pièges** : clé des socles par référentiel = rang dans le socle (`ref.<socle>.<n>`) ⇒ n'ajouter un contrôle qu'en fin de socle ; `listSectorSuggestions` accepte un secteur, une liste ou null ; un contrôle/une mission ne se relie à un processus/risque que s'il existe déjà (même `catalogueKey`).
- **Correctif** : pages `/controles` et `/audit` : droits d'écriture calculés sur le rôle EFFECTIF dans l'organisation (comme les API) — un ADMIN d'organisation au rôle global « analyste » ne voyait ni « Nouveau contrôle » ni le catalogue.
- **Vérifié** : `tsc` ; `npm test` 411 fichiers / 3 308 tests ; `test:db` 9 fichiers / 35 tests (dont `controle-catalogue`, `ropa-catalogue`) ; `lint` 0 erreur ; `i18n:check` ; build ; navigateur (build de prod, organisation ÉNERGIE, admin d'org au rôle global analyste) : contrôle importé par l'entrée « risque » relié au risque et au processus existants, puis désactivé dans l'entrée « processus » ; modèle de mission « par processus » préremplit les points ; RoPA en anglais avec la durée signalée « French law, to be checked ».
- **Reste** : traduction des socles par référentiel (contrôles, programmes d'audit) sur sources officielles ; badge « à compléter » des processus ; relecture métier (grille 256 éléments).

## 2026-10-01 (44) — Claude Code : multisecteur, page Processus, bilan de cohérence des propositions par défaut

- **Décisions utilisateur** : entreprise multisecteur (grand groupe) ; pas de sous-processus sectoriels pour l'instant.
- **Multisecteur** : `listSectorSuggestions` accepte plusieurs secteurs (union des packs) ; route `catalogue-suggestions` : par défaut tous les secteurs effectifs (`sector: 'ALL'`), filiale sans secteur → secteurs de l'ancêtre le plus proche (`effectiveSectors`, `parseSectorChoice` dans `sector-selection.ts` ; réponse `effectiveSectors`, `inheritedSectors`). Panneau : option « Tous mes secteurs (…) », message d'héritage.
- **Page Processus** : le panneau ne montre que les processus (`kinds={['PROCESS']}`).
- **Bilan de cohérence** consigné dans la spec socles § 8.11 : doublons de catalogues contrôles/audit (anciens socles par référentiel FR vs catalogue ×5), ancien socle du registre orphelin (`seed-defaut`), RoPA hors moteur, trois taxonomies de secteurs, catalogues FR seulement, absence de badge « à compléter » sur les processus. **Non traités, à arbitrer.**
- **Vérifié** : `tsc` ; `npm test` 410 fichiers / 3 299 tests ; `test:db` 29 ; `lint` 0 erreur ; `i18n:check` ; build ; navigateur (build de prod) : groupe FINANCE+ASSURANCE → « Tous mes secteurs », 18 + 18 suggestions sectorielles, 0 santé ; filiale sans secteur → message d'héritage et mêmes packs ; page Processus : 32 processus, 0 autre nature.
- **Piège** : arrêter `next start` laisse un `next-server` orphelin qui sert l'ANCIEN build ; le tuer par PID (`ps -eo pid,comm`), jamais par `pgrep -f`/`pkill -f` avec un motif présent dans la commande du shell (le shell se tue lui-même).

## 2026-10-01 (43) — Claude Code : catalogue 1.6 — packs sectoriels, plans de test de résilience, revue métier (branche `claude/tender-euler-bqjoe9` repartie de `origin/main`)

- **Packs sectoriels (1.5)** : `src/lib/sector-packs.ts` — 8 secteurs × (2 contrôles-types, 2 KRI candidats, 1 mission d'audit à 4 points), rattachés aux processus du secteur, ×5 langues ; branchés dans `listSectorSuggestions` (seulement avec le secteur choisi).
- **Plans de test de résilience modèles (1.6)** : `src/lib/catalogue-resilience.ts` — 7 transversaux + 4 finance/assurance, types art. 25 § 1 DORA, jamais de TLPT. Nouvelle nature `RESILIENCE_TEST` : route `catalogue-suggestions` (module réglementaire actif, `peutEvaluerDora`), création d'un `TestResilience` PLANIFIÉ de l'année, sans date/testeur/résultat/constat, `fonctionCritique` et `independant` à `false` (jamais présumés). Migration `20261001140000_test_resilience_catalogue` (`catalogueKey`/`catalogueVersion` + index unique). Incidents : aucun modèle (typologies déjà éditables, un incident n'est jamais suggéré).
- **Revue métier** : grille générée `docs/specs/catalogue-revue-grille.csv` (`npm run catalogue:review`, test de synchronisation `catalogue-review.test.ts`) + `docs/specs/catalogue-revue-metier.md` (critères, 6 corrections appliquées, points ouverts, tableau de validation par secteur). **Aucun secteur n'est validé par un expert métier.**
- **Piège** : toute modification du catalogue exige `npm run catalogue:review` (sinon test rouge) et, pour une nouvelle version, une entrée dans `CATALOGUE_CHANGELOG`. Les tests de version sont désormais génériques (`after(v)`).
- **Vérifié** : `tsc` ; `npm test` 410 fichiers / 3 295 tests ; `npm run test:db` 7 fichiers / 29 tests (dont `catalogue-resilience.db.test.ts` : import idempotent et concurrent) ; `lint` 0 erreur ; `i18n:check` ; `npm run build` ; navigateur (build de prod :3005, organisation FINANCE) : panneau « Suggestions par secteur » avec packs finance et plans de test (pas d'assurance), import de 4 éléments, test affiché « Planifié » dans `/reglementaire/tests-resilience`.
- **Prochain pas** : relecture par des experts métier (grille) ; second niveau de processus sectoriels ; énumération `POST /api/admin/users` ; T3 phase 2.

## 2026-10-01 (42) — Claude Code : T23 invitations (branche `claude/tender-euler-bqjoe9` repartie de `origin/main`)

- **Décision utilisateur** : le rattachement dépend du déploiement. SaaS / communautaire → consentement (invitation) ; sur site → l'entreprise rattache ses employés (direct).
- **Réglage d'instance** (`Configuration.membershipMode` AUTO|DIRECT|INVITATION, `membershipNotify`), section « Rattachement des comptes » dans `/admin/instance` (SUPER_ADMIN, `GET/PUT /api/admin/membership-config`). AUTO = INVITATION si démo ou inscription publique ouverte, sinon DIRECT (`lib/membership-mode.ts`, pur, testé).
- **INVITATION** : `POST …/entites/[entiteId]/membres` répond 202 `{invited:true}` que le compte existe ou non ; modèle `OrgInvitation` (jeton 256 bits haché SHA-256, usage unique par écriture conditionnelle, 7 jours, remplace l'invitation en attente) ; débit 30/h par auteur, 3/h par destinataire ; page publique `/invitations/[token]` : accepter (session au même e-mail), changer de compte, ou créer le compte (e-mail vérifié par le lien, politique de mot de passe). Logique dans `lib/org-invitation.server.ts`. Audit `ORG_MEMBER_INVITED` (SIEM COMPTES) puis `ORG_MEMBER_ADDED` via invitation.
- **DIRECT** : comportement inchangé + e-mail d'information (désactivable).
- Migration `20261001130000_org_invitations` (horodatage postérieur à `20261001120000_tier_…` de main ; base vierge : `migrate deploy` puis `migrate diff` vide). i18n ×5 (`invitations`, `membershipConfig`, `entites.invitationSent`, e-mails).
- **Backlog** : T17 clos (risque accepté), T5/T6 optionnels et différés (activation par variable, import dynamique).
- **Vérifié** : `tsc` ; `npm test` 408 fichiers / 3 286 tests (après fusion de `origin/main`) ; `npm run test:db` 6 fichiers / 27 tests (dont `org-invitation.db.test.ts`) ; `i18n:check` OK ; `npm run build` OK ; navigateur (build de prod :3005) : section d'instance, invitation 202, page d'invitation, création de compte → connexion avec bandeau, appartenance créée.
- **Prochain pas** : énumération résiduelle de `POST /api/admin/users` (409) en mode SaaS ; T3 phase 2 ; T9 ; T10 ; T8.
## 2026-10-01 (41) — Claude : fin du lot 2 et lot 3 (catalogue étendu)

- **Lot 2 tranche 6** : criticité d'usage (+ écart avec le contrat), périmètre/dates de couverture par offre, rapprochement en masse sur LEI, **import de contrats TIC** (`lib/tic-contract-import.ts`, `POST /api/reglementaire/registre-tic/import`, `TicContractImportPanel`), **fusion par l'admin du groupe** (`isGroupAdminMerge`, accès des filiales conservés). Migrations `20260930200000` (usage.criticite) et `20261001120000` (couverture).
- **Lot 3** : catalogue **1.4** — contrôles-types (1.2), KRI candidats **sans seuil** (1.3 ; `Kri.seuilAlerte/seuilCritique` nullable → `evaluerKri` renvoie INCONNU), missions d'audit-types (1.4), **nouveautés depuis la version importée** (`sector-suggestions-changelog.ts`). Migrations `20261001090000`, `…100000`, `…110000`. Route `catalogue-suggestions` : un module n'est proposé que s'il est actif et le rôle habilité (403 sinon).
- **Piège** : toute hausse de `CATALOGUE_PACK_VERSION` exige une entrée dans `CATALOGUE_CHANGELOG` (test). `Kri.seuil*` peut être `null` : tout nouveau consommateur doit passer par `evaluerKri`.
- **Piège e2e** : `DATABASE_URL` (host `localhost`) doit être exporté dans CHAQUE commande shell ; specs locales hors git : `local-tiers-criticite`, `local-tic-import`, `local-socles-controles|kri|nouveautes`, `local-tiers-fusion` (mise à jour : l'admin racine peut fusionner un tiers partagé).
- Vérifié : `tsc` 0 · `npm test` 3164 · `i18n:check` · `npm run build` OK · recettes Playwright sur PostgreSQL 6/6 (voir spec § 8.7–8.9).
- **Reste** : revue métier du contenu ; packs sectoriels spécifiques (contrôles/KRI/audit par secteur) ; incidents/résilience ; PR des commits depuis #192 (non ouverte, CI non passée).

## 2026-09-30 (40) — Claude : lot 2 tranche 5 — fusion d'identités de tiers

- `lib/tier-merge.ts` (règles pures : même groupe, LEI, exposition à d'autres organisations ; fusion des alias), `GET/POST /api/tier-registry/merge` (aperçu / fusion transactionnelle verrouillée et recontrôlée), bouton « Fusionner » dans `TierIdentityPanel` (aperçu des relations déplacées, blocage expliqué, confirmation).
- Règle de sécurité : fusion refusée si des données d'une autre organisation seraient touchées (renvoyée à l'admin du groupe).
- Recette réelle `e2e/local-tiers-fusion.spec.ts` (hors git) 1/1 ; autres specs locales inchangées.
- Vérifié : `tsc` 0, `npm test` 3117, `i18n:check`, build (voir ci-dessous). Spec § 8.7.
- **Reste du lot 2** : criticité d'usage ; import de contrats avec identité (fichier) ; rapprochement en masse des arrangements existants ; fusion transverse côté groupe.

## 2026-09-30 (39) — Claude : lot 2 tranche 4 — parties prenantes → identités de tiers (atelier 3)

- **Bug corrigé au passage** : l'autosave de l'atelier 3 détachait les liens `PartiePrenante.tierId` (delete-all + createMany sans `tierId`) ; `cleanPartiePrenante` le conserve, `sanitizeTierLinks` (`lib/tier-registry.server.ts`) ne garde que les tiers autorisés pour l'organisation de l'analyse (`tierLinksDropped` sinon).
- `PartyTierLink` (sélecteur + suggestion de rapprochement par nom/alias, lecture seule si analyse gelée) branché dans `Atelier3` ; `GET /api/tier-registry` alimente la liste.
- Recette réelle `e2e/local-atelier3-tier.spec.ts` (hors git) 2/2 ; piège : l'atelier 3 n'est accessible que si `atelierCourant ≥ 3`.
- Vérifié : `tsc` 0, `npm test` 3102, `i18n:check`, build à refaire avant push (fait ci-dessous). Spec § 8.6.
- Reste (lot 2) : fusion de tiers avec aperçu ; criticité d'usage ; import de contrats avec identité ; rapprochement en masse des arrangements existants.

## 2026-09-30 (38) — Claude : lot 2 tranche 3 — bénéficiaires depuis l'UI du groupe, sélecteur de tiers dans le registre TIC

- `GET /api/tier-registry/[id]` : pour l'ADMIN de l'organisation RACINE, état des filiales bénéficiaires et filiales proposables par contrat (rien pour une filiale / un non-admin) ; `TierDetailPanel` : « Filiales bénéficiaires de … » (Proposer).
- Registre TIC : `tierId` facultatif en POST/PATCH (`resolveTierIdInput` : absent = inchangé, nul = détache, valeur = tiers autorisé sinon 400), `tiersOptions` en GET, sélecteur + préremplissage non destructif dans `RegistreTicManager`, badge « identité rattachée ».
- Recette réelle : `local-tiers-groupe` 3/3 (proposition depuis l'UI), `local-tiers` 4/4 (dont registre TIC), `local-socles` 5/5. Piège local : le limiteur de connexion bloque les campagnes e2e répétées → redémarrer `next dev`.
- Vérifié : `tsc` 0, `npm test` 3095, `i18n:check`, build. Spec § 8.5.
- Reste : parties prenantes → tiers (atelier 3) ; fusion avec aperçu ; criticité d'usage ; import de contrats avec identité ; rapprochement en masse des arrangements existants.

## 2026-09-30 (37) — Claude : lot 2 tranche 2 — offres, couverture, usages, propositions de bénéficiaires

- Décision utilisateur : création/rapprochement d'identités de tiers = ADMIN **et** 2ᵉ ligne (`peutGererRegistreTic`).
- Livré : `lib/tier-offers.ts` (validation d'offre, plan de couverture, couverture d'usage), `lib/tier-registry.server.ts` (contexte + garde), routes `GET /api/tier-registry/[id]`, `POST …/[id]/services`, `PATCH …/services/[serviceId]`, `PUT …/contracts/[arrangementId]/services`, `DELETE …/usages/[usageId]` ; `GET /api/tier-registry` renvoie aussi les propositions de contrats groupe ; composants `TierDetailPanel` et propositions dans `TierIdentityPanel` (Confirmer / Refuser).
- Recette réelle (`e2e/local-tiers-groupe.spec.ts`, hors git) : groupe + 2 filiales — contrat groupe, offres, couverture, usage du groupe, proposition → 404 avant confirmation → accès après, usages propres à la filiale, hors contrat « à confirmer », 3ᵉ organisation refusée. `local-tiers` 3/3, `local-socles` 5/5.
- Vérifié : `tsc` 0, `npm test` 3083, `i18n:check`, recette PostgreSQL + navigateur. Spec § 8.4.
- Reste : proposer les bénéficiaires depuis l'UI du groupe ; parties prenantes → tiers (atelier) ; sélecteur de tiers dans le registre TIC ; fusion avec aperçu ; criticité d'usage.

## 2026-09-30 (36) — Claude : catalogue v1.1, rôle effectif sur /configuration, tiers canoniques (tranche 1)

- **Catalogue v1.1** : +18 sous-processus et +6 événements transversaux, +2 événements par secteur (×5 langues) ; liste hiérarchique dans le panneau de suggestions ; ordre de création robuste à plusieurs niveaux.
- **/configuration** : `isAdmin` d'après le rôle effectif dans l'organisation active (`GET /api/org/active` expose `activeRole`, `lib/effective-admin.ts`).
- **Tiers canoniques, tranche 1** : `lib/tier-identity.ts` (LEI, candidats fort/faible, couverture), `GET/POST /api/tier-registry`, `POST /api/tier-registry/link`, `TierIdentityPanel` sur `/tiers` (couverture cyber/TIC, création sans doublon, file de rapprochement des arrangements TIC). Recette réelle via `e2e/local-tiers.spec.ts` (hors git) : 3/3 ; `e2e/local-socles.spec.ts` : 5/5.
- Vérifié : `tsc` 0, `npm test` 3053, `i18n:check`, recette PostgreSQL + navigateur. Spec § 8.3 à jour.
- **Reste (lot 2)** : offres/contrats groupe/bénéficiaires/usages (écrans), rattachement des parties prenantes depuis l'atelier, sélecteur de tiers dans le registre TIC, fusion avec aperçu, file des propositions de bénéficiaires.

## 2026-09-30 (35) — Claude : recette réelle du lot 1 (secteurs, suggestions, import de processus) + bug « Nouveau projet 360 »

- **Bug corrigé** : le menu « Nouveau projet 360 » ouvre désormais `/projets?nouveau=1` (formulaire de projet déjà ouvert) au lieu d'une analyse cyber.
- **Recette sur PostgreSQL** (Docker relancé, migrations dont `20260930190000_sector_suggestions` appliquées) via `e2e/local-socles.spec.ts` (exclu de git) : 5/5 verts — secteurs, suggestions processus + risque (provenance, pas de cotation, avertissement « sans lien »), import de fichier (hiérarchie, cycle, parent inconnu, nom manquant, réimport idempotent), menu projet 360.
- Spec mise à jour (§ 8 : avancement, décisions, écarts). Écart noté : /configuration décide `isAdmin` d'après le rôle de session et non le rôle effectif dans l'organisation.
- Vérifié : `tsc` 0, `npm test` 3018, `i18n:check`, build OK.
- Prochains pas : harmoniser l'`isAdmin` de /configuration ; enrichir le contenu du catalogue (descriptions, sous-processus, revue métier) ; lot 2 (écrans Tiers).

## 2026-09-30 (34) — Claude : socles sectoriels, lot 1 poursuivi (EN PAUSE — non poussé)

- Repris et commités les travaux non commités de Codex : correctifs d'audit d'accès (`8156e44`) et suggestions de socle sectoriel (`d18467b`).
- Ajouté (commit local suivant, **non poussé**) : configuration des secteurs de l'organisation (`SectorSettings`, `GET /api/catalogue-suggestions/sectors`, section « Fonctionnalités » de /configuration) ; **import guidé de processus CSV/XLSX** (`lib/processus-import.ts`, `POST /api/processus/import` aperçu + import, `ProcessusImportPanel` dans /processus) : parents par référence ou par nom, cycles, doublons, réimport idempotent par référence (`catalogueKey = import:<réf>`), doublon possible à confirmer, jamais de fusion.
- Vérifié : `tsc` 0, `npm test` 3016 verts, `i18n:check` vert, `npm run build` OK.
- **Non vérifié** : tout ce qui touche la base — Docker n'a pas pu être démarré (la migration `20260930190000_sector_suggestions` n'a jamais été appliquée en local) ; aucune recette navigateur des trois écrans (secteurs, suggestions, import de processus).
- Bug signalé par l'utilisateur, **non traité** : « Nouveau projet 360 » (menu) mène à une analyse cyber ; piste : `/analyses/new?methode=PROJET_360` — la méthode est retombée sur le défaut car PROJET_360 est exclue des méthodes proposées (`MODULE_METHODS`).
- Prochains pas : corriger le bug 360 ; recette DB/navigateur ; mettre à jour le statut de la spec `socles-sectoriels-tiers-canonique-backlog.md` ; enrichir le contenu du catalogue ; lot 2 (UI Tiers/offres/usages).

## 2026-09-30 (33) — tiers canonique, contrats groupe et usages : première tranche TDD

- Cadrage enrichi dans `docs/specs/socles-sectoriels-tiers-canonique-backlog.md` : prestataire unique, plusieurs offres (y compris du même type), couverture contrat↔offre, plusieurs usages locaux/processus ; décision utilisateur « ADMIN groupe propose, ADMIN filiale confirme ». Aucun accès automatique aux descendants.
- Schéma Prisma et migration additive `20260930180000_tiers_services_contracts` : nouveaux Tier, TierOrganization, TierService, TierContractService, TierContractBeneficiary, TierServiceUsage ; `tierId` nullable sur ArrangementTic/PartiePrenante. Pas de backfill par nom.
- Règles pures `tier-contract-coverage.ts` et routes API de proposition/confirmation/refus + création d'usage (avec statut de couverture explicite). Journal d'audit/SIEM complété.
- TDD : tests rouges observés avant code ; ciblés verts, `npx tsc --noEmit` vert, `npx prisma validate` vert, `npm run i18n:check` vert ; suite complète finale : **367 fichiers / 2 967 tests verts** ; `npm run build` vert (routes incluses), `git diff --check` vert. Garde-fou supplémentaire : contrat et Tier doivent appartenir au même groupe.
- Reste : créer/rattacher Tier et offres dans l'UI/API, lister les propositions et usages, contrôle concurrent d'une révocation, précision des dates/périmètres/criticités d'usage, migration et recette DB/browser. Docker absent : aucune écriture DB réelle. Autres fichiers sales préexistants laissés intacts.


## 2026-09-30 (32) — cadrage des socles sectoriels et des tiers uniques

- Nouvelle expression de besoins `docs/specs/socles-sectoriels-tiers-canonique-backlog.md` : propositions de risques/processus par socle transversal puis packs sectoriels, imports guidés, même principe étendu aux autres modules ; inventaire ciblé des fonctionnalités manquantes/en développement avec distinction code absent vs recette absente ; cible Tier canonique liant parties prenantes d'analyses et arrangements TIC sans recopier les objets.
- Décisions utilisateur : suggestions validées avant toute création, pas de préremplissage automatique ; socle transversal avant packs sectoriels. Questions encore ouvertes dans la spec : gouvernance du rapprochement de tiers, périmètre filiale/groupe et ordre précis des secteurs.
- Existant vérifié : registre de risques prérempli en bloc par un catalogue FR, processus CRUD sans import/catalogue, catalogues de contrôles/audit/RoPA déjà présents, jonction tiers↔TIC par nom en lecture seulement. Aucune modification applicative ou de base dans ce tour. `git fetch origin` impossible (DNS). Baseline `tsc` vert, `npm test` 363 fichiers / 2 942 tests verts ; vérifications documentaires et `git diff --check` en fin de tour.

## 2026-09-30 (31) — navbar GRC et publication du registre (TDD)

- Navigation : KRI rapproché de l’appétence RAS/RAD dans Pilotage ; registre TIC déplacé dans « Registres » auprès du registre des risques, sans fusion des objets ni extension des droits ; les deux liens restent visibles si seul leur module est actif. « Risques des analyses » distingue la page des risques de celle du registre. Groupes titrés aussi sur mobile. Libellés dans les 5 langues.
- Publication Analyse → RiskItem : transaction PostgreSQL avec verrou par organisation/analyse avant lecture/création, empêchant deux appels simultanés à cette route de créer la même provenance. Une provenance déjà dupliquée renvoie 409 sans écriture ; message explicatif dans la cartographie (5 langues). La mise à jour idempotente préserve le statut du registre.
- TDD : nouveaux tests navigation, mobile, détection des doublons, ordre verrou → lecture → création, refus des doublons et republication. Tests ciblés 31/31 ; `npx tsc --noEmit -p tsconfig.json` vert ; `npm test` 363 fichiers / 2 942 tests verts ; `npm run i18n:check` vert ; `npm run build` vert (avec accès réseau pour Inter). `git diff --check` vert.
- Limites : pas de contrainte UNIQUE en base tant que les doublons historiques n’ont pas été diagnostiqués ; le verrou protège cette route, pas une écriture parallèle provenant d’un autre chemin. Docker Desktop absent (`open -a Docker` échoue, socket Docker introuvable) ; recette PostgreSQL et navigateur authentifié non effectuées. La base n’a été ni lue ni modifiée. Le disque avait atteint 100 % pendant le premier build/test ; seuls les caches générés `.next/cache` et `.next/dev` ont été supprimés, libérant environ 5,8 Go.

## 2026-10-01 (33) — Claude Code : T3 phase 1 et faille T25 (même branche, PR #194)

- **T3 phase 1** : `lib/route-guard.server.ts` (`requireSession`, `requireInstanceAdmin`, `sessionUser` typé) ; 17 routes `/api/admin/*` migrées ; test cliquet `src/__tests__/unit/lib/route-guard-ratchet.test.ts` (refuse une garde locale ou une comparaison `role === 'SUPER_ADMIN'` dans une route, hors `admin/users` et `org/active`, usages métier).
- **T25 (ÉLEVÉ)** : périmètre d'administration = organisations où le rôle EFFECTIF est administrateur (`getAdminOrgIds`, `getAdminScope` dans `lib/org-context.server.ts`) pour comptes, corbeille, journal d'audit + export, import d'utilisateurs en masse, création de compte. Test `src/__tests__/db/admin-scope.db.test.ts` (cookie d'org active simulé) : les 3 attaques réussissent sans la correction (vérifié par mutation), échouent avec.
- **Doc** : `docs/ARCHITECTURE.md` §5 liste les gardes communes à utiliser.
- **Vérifié** : `tsc` ; `npm test` 368 fichiers / 3 036 tests ; `npm run test:db` 19/19 ; `npm run lint` 0 erreur ; `npm run build` OK.
- **Prochain pas** : T3 phase 2 (`withAccess` pour les routes d'écriture hors `/api/admin`), T9 sauvegarde d'atelier (verrou optimiste), T10 (enums), T8 (`ConformiteEntree`).

## 2026-10-01 (32) — Claude Code : backlog technique, suite (même branche, PR #194)

- **Faits** : T7 (job CI `db-integration`, `npm run test:db`), T2 (réattribution des analyses : API + dialogue `/admin/users`, vérifié en navigateur), T24 (pas de liaison SSO auto d'un SUPER_ADMIN), T4 (ESLint + job CI `lint`), T12 (portée d'organisation sans charger toute l'instance : 10,4 → 3,9 ms à 2 871 orgs), T14 partiel (liste des actions du journal par balayage d'index : 87 → 0,3 ms à 1 M lignes), T9 partiel (double approbation projet 360 sous verrou), T11 (`Analyse.organizationId` obligatoire, migration `20261001090000_…`), T13 partiel (indicateurs de la liste des analyses en SQL).
- **Bugs trouvés en chemin et corrigés** : création concurrente de la ligne `Conformite` (P2002 → 500) ; override global `brace-expansion` qui cassait ESLint et `minimatch@5` (exceljs) ; `/api/import` créait des analyses sans organisation, sans contrôle du droit de création ni du plafond démo.
- **Pièges** : la migration `20261001090000` rattache les analyses sans organisation à `global` (créée si absente). `checkAnalyseCreation` (`lib/analyse-create-guard.server.ts`) est le point unique de contrôle de création d'analyse. `pkill -f "next dev …"` tue le shell appelant : utiliser `pkill -f "[n]ext dev …"`.
- **Vérifié** : `tsc` propre ; `npm test` 366 fichiers / 3 026 tests ; `npm run test:db` 15/15 (PostgreSQL 16 local, base existante + base vierge) ; `npm run lint` 0 erreur ; `npm run build` OK ; `i18n:check` OK ; CI GitHub verte jusqu'au commit `e89f341` (les suivants en cours au moment de l'écriture).
- **Décisions en attente (utilisateur)** : T5/T6 ajoutent une dépendance (client Redis, SDK S3) ; T17 validation DNS de l'issuer OIDC (refuserait les IdP internes) ; T23 parcours d'invitation (UX).
- **Prochain pas technique** : T3 (`withAccess`, gros chantier), T8 (`ConformiteEntree`), T10 (enums), T9 sauvegarde d'atelier (verrou optimiste côté client).

## 2026-10-01 (31) — Claude Code : audits sécurité/BDD et remédiation (branche `claude/tender-euler-bqjoe9`, PR #194)

- **Audits** : `rapports/ACRA-Audit-Code-OWASP-SAST-2026-09-30.md`, `rapports/ACRA-Audit-Architecture-BDD-Maintenabilite-2026-09-30.md`. Backlog technique T1–T24 dans `docs/CHANTIERS-EN-COURS.md` (statut par ligne).
- **Faits** : SSRF (`lib/ip-safety.ts`, `lib/safe-fetch.server.ts`), next 16.3.8, clés d'API (débit avant scrypt), upload (signatures), gestion des comptes (`lib/user-deletion.ts` : suppression, reset-password, SUPER_ADMIN protégé, comptes partagés, réattribution T2), plus d'auto-promotion SUPER_ADMIN, SSO (pas de rétrogradation ni de liaison auto d'un SUPER_ADMIN), secrets d'instance masqués (`maskSecret`), FK `Analyse.userId` RESTRICT (migration `20260930180000_…`), verrous de conformité (`lib/row-lock.server.ts`), ESLint + CI, tests d'intégration BDD.
- **Nouveaux outils** : `npm run lint` ; `npm run test:db` (exige `DATABASE_URL` vers une base migrée ; job CI `db-integration`).
- **Pièges** :
  - Un compte propriétaire d'analyses n'est plus supprimable : réattribuer d'abord (dialogue `/admin/users`).
  - `brace-expansion` : overrides **par branche majeure** (`minimatch@3/5/10`) ; un override global casse ESLint et `exceljs`.
  - Les `.db.test.ts` sont exclus de `npm test` (config `vitest.db.config.mts`).
  - Un SUPER_ADMIN se connecte par compte local + MFA (pas de liaison SSO automatique).
- **Vérifié** : `tsc` propre ; `npm test` 366 fichiers / 3 023 tests ; `npm run test:db` 7/7 (PostgreSQL 16 local, stable sur 5 exécutions) ; `npm run lint` 0 erreur ; `npm run build` OK ; `npm audit` 0 ; `i18n:check` OK ; parcours de réattribution vérifié en navigateur (dev :3005).
- **Non vérifié** : CI GitHub de ces commits ; recette navigateur des écrans SSO/SMTP/SIEM/SMS avec le marqueur `[CONFIGURED]` ; appels sortants réels (webhook, LDAP).
- **Prochain pas** : T3 (`withAccess`), T5/T6 (Redis, S3), T12 (portée d'organisation par préfixe de `path`), T23 (invitation), décision produit sur la validation DNS de l'issuer OIDC (T17).

## 2026-09-30 (30) — export Word : matrice des risques ; Windows/WSL

- `lib/risk-matrix-grid.ts` (modèle de matrice depuis la config + grille imprimable, partagé Word/PowerPoint) ; `analyse-docx.ts` : section « Matrice des risques » (brute, puis après traitement si résiduel), libellés ×5. Rendu vérifié en PDF (LibreOffice).
- `.gitattributes` (LF forcé pour `*.sh`, Dockerfile, yml, sql) + note Windows/WSL dans les 5 README (issue GitHub `$'\r': command not found`).

## 2026-09-30 (29) — import : retours d'usage sur le vrai fichier

- Bug d'import du vrai classeur : textes > plafond du schéma (socle de sécurité 1 000 car.) → raccourcis + avertissement (`lib/import-truncate.ts`, `buildAtelierContent.truncated`, route) ; erreurs de validation lisibles (`describeZodIssues`).
- Assistant : retour visible/annoncé après profil/mapping, récapitulatif « Ce qui sera importé » par objet, groupe « Ne pas importer les N lignes » toujours visible, marge basse. `refAliases` enregistrés avec un mapping ; migration `20260930170000_mapping_mzt_alias`.
- Vérifié : tsc, `npm test` (2906), `i18n:check`, build, e2e local sur le vrai fichier (16 risques, 21 mesures, 0 avertissement de référence).

## 2026-09-29 (28) — menus, mapping par défaut, méthodes classées, revue regroupée

- Menu « Nouvelle analyse » (`NouvelleAnalyseMenu`, hook `useDropdownMenu` clavier + ARIA) sur analyses / dashboard cyber / GRC, visible sur mobile ; `AnalyseImportMenu` idem.
- `mapping_mzt` : migration `20260930160000_mapping_import_defaut` (`AnalysisImportMapping.organizationId` nullable = défaut d'instance, index unique partiel sur le nom) ; GET des mappings renvoie org + défaut (`builtin`).
- Méthodes : `Configuration.methodesActives` = classement ; `cleanActiveMethodes`/`resolveMethodes`/`moveMethode`/`setMethodeActive` ; écran /admin/instance (↑ ↓).
- Revue « lignes à décider » regroupée par feuille (> 5 lignes). Chantiers à venir : `docs/specs/import-universel-chantiers-a-venir.md`.
- Vérifié : tsc, `npm test` (2897), `i18n:check`, build, e2e locaux (menus, mobile, revue, mapping_mzt). Non vérifié : écran admin méthodes dans le navigateur.

## 2026-09-29 (27) — import universel — CSV / JSON réels, doublons, cotations en clair

- Vérifié en réel (voir §7 bis du plan de test) : CSV (10 risques, rejets ligne à ligne), JSON libre (6 risques + 5 mesures), droits (403), idempotence ; tsc, `npm test` (2877), `i18n:check`, build, e2e import 4/4.
- Code : `partitionHistoricImportSheets` (DUPLICATE_REFERENCE, UNKNOWN sans décision, score mappé pris en compte), `linkChildSheetsToRisks`, `suggestScoreMapping`, `normalizeStrategy/MeasureStatus`, `refineReferenceMapping`, alias exacts `=mot`.
- Reste : IDOR autre organisation, gel, volumétrie, windows-1252 ; revue « lignes à décider » à regrouper ; liens actifs↔VM, champs calculés, API v2/MCP.

## 2026-09-29 (26) — import universel — session de test réelle (Docker/DB)

- Tests réels exécutés (voir §7 de `docs/specs/import-universel-plan-de-test.md`) : classeurs BTP/avocats de bout en bout en base, 7 défauts corrigés avec tests. Base Postgres relancée après suppression d'un `postmaster.pid` corrompu (octets nuls) dans le volume `ebios-rm_postgres_data`.
- Vérifié : tsc, `npm test` (2867), `i18n:check`. Spec local `e2e/local-import-fixtures.spec.ts` (exclu via `.git/info/exclude`, ne pas commiter).
- Reste : revue « lignes à décider » à regrouper ; IDOR/gel/idempotence/volumétrie à tester ; liens actifs↔VM, champs calculés, API v2/MCP.

## 2026-09-29 (25) — import universel — JSON libre (B-IMP-70, première version)

- Fait : `lib/json-workbook.ts` (tableaux d'objets → feuilles, imbriqués → feuille enfant + colonne parent, scalaires racine → `Propriétés`, bornes), `lib/tabular-workbook.ts` (chargement unique xlsx/csv/json pour aperçu + exécution), `looksLikeAcraJson` (JSON non ACRA → assistant), diagnostic JSON précis dans l'aperçu.
- Vérifié : tsc, `npm test` (2830 verts). Plan de test post-redémarrage : `docs/specs/import-universel-plan-de-test.md`.
- Reste : voir §6 du plan de test.

## 2026-09-29 (24) — import universel — CSV dans l'assistant

- Fait : un `.csv` vaut une feuille (`lib/csv-workbook.ts`, UTF-8/BOM ou windows-1252, `;`/`,`) passé à l'assistant (aperçu + exécution) ; `checkTabularUpload` ; CSV ACRA (`=== … ===`) reste sur l'import ACRA ; messages `excel_format_unsupported` ×5 mentionnent .csv.
- Vérifié : tsc, `npm test` (2820 verts), `i18n:check`, `npm run build`. Non vérifié : parcours navigateur, écriture DB réelle d'un CSV (CI).
- Reste : liens supportAssets↔businessValues, avertissement champs calculés, JSON libre + profil (B-IMP-70), API v2/MCP (B-IMP-72/73).

## 2026-09-29 (23) — Claude Code : import universel — contexte, risques résiduels, alias de préfixe — ⚠ à vérifier

- **Contexte** : `lib/excel-blocks` branché (rôle `CONTEXT` détecté sur les feuilles sans tableau : périmètre en texte libre, page de garde) → cadrage, titre et description de l'analyse.
- **Risques résiduels** : rôle `RESIDUAL_RISKS` (Réf.RR → Réf.RI), champ canonique `residualRisks`, écrit dans `Risque.*Actuelle/*Residuelle` (test avec faux `tx`, pas de vraie base).
- **Mesures ↔ risques** : références en liste / plage résolues sur les risques réels ; **alias de préfixe validé par l'utilisateur** (`refAliases`, route + UI + clé d'idempotence — présente seulement si utilisée).
- Profil livré étendu (RR, contexte, colonne des risques concernés des mesures). Fixtures locales inchangées (exclues de git).
- ⚠ Non vérifié : recette navigateur (case d'alias, rôle contexte), e2e sur un classeur d'ateliers, écriture sur vraie base.

---

## 2026-09-29 (22) — Claude Code : import universel I4 + I5 — ⚠ à vérifier

- **Import d'un dossier EBIOS RM complet** : le classeur (variantes locales BTP / avocats) donne, via aperçu → rôles détectés → paquet v3 → validation, 6 valeurs métier, 8 événements redoutés,
  10 sources (couples SR/OV regroupés), 14 parties prenantes, 8 scénarios stratégiques, 13 opérationnels, 13 risques, socle de sécurité et biens supports retenus. Test d'ensemble local
  (`analysis-imports-preview.route.test.ts`, ignoré en CI faute de fichiers) ; les briques pures sont testées en CI.
- **Écriture** (`executeAnalysisImport`) : cadrage (JSON), sources, parties prenantes, scénarios ; **non exercée sur une vraie base** (Docker indisponible) : seuls des faux `tx` la testent → à valider en recette
  et via l'e2e (aucun e2e ne couvre encore un classeur d'ateliers).
- **Idempotence** : l'empreinte d'un paquet sans atelier est identique à l'ancienne (test), aucun faux 409 sur les reçus existants.
- **Fixtures locales** régénérées (colonne des valeurs métier corrigée) ; dossier toujours exclu de git.
- ⚠ Non vérifié : recette navigateur (sélection des rôles d'atelier, profil appliqué), e2e, CI de ce push.

---

## 2026-09-29 (21) — Claude Code : import universel I2 + I3 (socle pur) — ⚠ à vérifier

- **CI** : l'e2e `analysis-import` cassait depuis `a3f8ac3` (l'attribut `accept` du champ Excel a été étendu pour faire remonter le message « .xls non pris en charge » ;
  le sélecteur e2e `input[accept=".xlsx"]` ne le trouvait plus → corrigé `ebf01ca` en `accept^=`). L'échec de `projets.spec` était collatéral (session perdue : page de connexion).
- **I2** : en-têtes sur deux niveaux composés (« Besoins de sécurité › Disponibilité »), alias multilingues, `lib/excel-blocks` (îlots, clé/valeur, texte) — pas encore dans l'assistant.
- **I3** : `lib/import-transforms` (références, plages, niveaux, symboles, valeurs, regroupement, retenu, lignes modèles) ; import historique : `N - libellé` accepté, lignes modèles ignorées et comptées
  (`IGNORED` / `EMPTY_TEMPLATE_ROW`, phrase au bilan ×5).
- **Vérifié** : `tsc` 0 · `npm test` (voir fin de tour) · `i18n:check`. ⚠ Non vérifié : e2e, recette navigateur.
- **I4 + I5 livrés (entrée 22)** : voir la spec (état suite 2). Reste : rôle « contexte », risques résiduels, UI de correspondance de valeurs, I7.

---

## 2026-09-29 (20) — Claude Code : lot I1 de l'import universel + menu « Nouvelle analyse » + messages d'import — ⚠ à vérifier

- **Spec** : `docs/specs/import-universel-analyses.md` (besoin, décisions du 2026-09-29, jeu d'essai). Jeu d'essai **local** (exclu de git,
  ne jamais committer ni publier) : `.local-fixtures/import-universel/` (variantes BTP et avocats du classeur EBIOS RM, faux `.xls`, CSV, JSON, générateur).
- **Messages d'import** : codes stables (`lib/import-errors`), traduits ×5 avec cause probable et solution ; JSON illisible → ligne, colonne, extrait et cause
  reconnue (virgule finale, apostrophes, commentaires, fichier tronqué : `lib/import-json-diagnostic`) ; page web / binaire / tableau / sans « nom » / CSV non ACRA
  distingués. **`.xls` (même renommé)** : « .xls non pris en charge, .xlsx pris en charge » **avant tout envoi** (`lib/import-file-format`, aussi côté serveur).
- **Détection Excel (I1)** : `lib/excel-grid` (échantillon d'en-tête sans doublons de fusion, zone utile, formules sans valeur / en erreur signalées à l'aperçu) ;
  `historic-import` : plus de feuille d'échelles ou de scénarios classée « Risques » ; alias lus en mots entiers ; paragraphes jamais en-tête. Vérifié sur les variantes locales.
- **Tableau de bord** : le bouton « Nouvelle analyse » devient un menu (nouvelle analyse, nouveau projet 360 si le module est actif, importer une analyse → `/analyses?import=1`
  ouvre le menu d'import) ; `/analyses/new?methode=PROJET_360` présélectionne la méthode. « Analyse Flash » → **« EBIOS RM flash »** (libellés ×5 ; « Démarche Flash » des textes d'aide inchangé) — à valider produit.
- **Vérifié** : `tsc` 0 · `npm test` 2707/2707 · `i18n:check` · `npm run build` OK. ⚠ Non vérifié : recette navigateur (menu, alertes, aperçu Excel), e2e.
- **Suite (I2…I7)** : en-têtes multi-niveaux, profils de mapping, transformations de cellules (références, plages, niveaux `N - libellé`, symboles), modèle canonique v3.

---

## 2026-09-29 (19) — Claude Code : « lance tous ces chantiers », tranche 1 = suite du lot L1 — ⚠ à vérifier

- **Livré (non poussé au moment de l'écriture)** : import CSV d'incidents (`lib/incident-import`, `POST /api/incidents/import`,
  ≤ 500 lignes, erreurs par ligne), `POST /api/v1/incidents` (+ OpenAPI), chronologie / cause racine / leçons apprises,
  impacts non financiers, allocation de la perte entre entités (B-PER-3, prise en compte dans R-PER-2 « par entité »),
  `IncidentAnalysePanel`, colonnes Incident (migration `20260930100000_incidents_l1_suite`).
- **Vérifié** : `tsc` 0 · `npm test` **2575/2575** · `i18n:check` · `npm run build` OK.
- ⚠ **Non vérifié** : migration `20260930100000` **non appliquée localement** (Docker indisponible) ; e2e non exécutés (CI).
- **B-PER-6 livré** : `lib/rapprochement-compta` (pur, testé) + `POST /api/incidents/rapprochement` (lecture seule, 2ᵉ ligne, journalisé) + bouton « Rapprocher (compta) » ; CSV `reference;montant[;devise]` comparé aux pertes « comptabilisé ».
- **L4 rappels + `auditConfig` livrés** : `lib/audit-config` (rappels, cycles par cotation) + `lib/audit-rappels` (purs, testés) ; cron `POST /api/cron/audit-rappels` (anti-doublon `AuditConstat.rappelLe`, planifié 06:00 scheduler.sh / 06:30 GitHub Actions) ; `GET/PUT /api/audit/config` (ADMIN) ; `AuditConfigEditor` sur `/audit/plan` ; cycles pris en compte par le plan et R-AUD-1 ; migration `20260930110000_audit_l4_rappels` (non appliquée localement, validée par `prisma generate` seulement).
- **L3 suite livrée** : `lib/controle-l3b` (comparaison N vs N-1, rejeu pré-rempli, rattachements) ; `Controle.arrangementTicId/projetId` (liens logiques vérifiés par `controle-rattachements.server`, migration `20260930120000_controle_rattachements`, non appliquée localement) ; ligne « N vs N-1 » et sélecteurs tiers / projet 360 dans `ControlesManager` ; l'exécution reprend la taille testée précédente.
- **L2 suite (1/3)** : masquage des données identifiantes (`lib/rapport-masquage`, bascule à l'écran + `export?masque=1`, pseudonymes cohérents #1, #2…) et gabarits surchargeables (titre, introduction, sections masquées ; `GET/PUT /api/rapports/config`, ADMIN ; `OrganizationConfig.rapportsConfig`, migration `20260930130000_rapports_config` non appliquée localement ; `RapportsGabaritsEditor`). L'édition figée n'est jamais modifiée.
- **L2 suite (2/3)** : diffusion e-mail à la diffusion d'une édition (`lib/rapport-diffusion` + `.server` : adresse d'un membre → e-mail avec lien, jamais le contenu ; adresse externe → consignée « hors organisation » ; résultat par destinataire) ; brouillons planifiés (`rapportsConfig.planifies`, cron `POST /api/cron/rapports-planifies` 05:00, les 1er–3 du mois, période précédente, créé par un ADMIN, idempotent).
- **L2 suite (3/3)** : R-INC-2 (registre des incidents) ; PDF serveur des éditions (`export?format=pdf`, modèle plat `contenuVersDocument` + `rapport-edition-pdf-template`, compilé par `compile-pdf-template.mjs` ; vérifié sur le bundle de production : `%PDF` produit) ; masque et gabarit appliqués au PDF. R-INC-3 (fiche de déclaration par régime) non fait : c'est un document par incident, pas par période — à traiter avec `NotificationsPanel`.
- **L4 papiers de travail livrés** : `lib/papiers-travail` (pur : programme / test / entretien / analyse ; brouillon → soumis → revu ; revue jamais par le préparateur, renvoi avec commentaire) ; `GET/POST /api/audit/missions/[id]/papiers` (audit + ADMIN seulement, lecture comprise ; écriture optimiste sur `updatedAt`, 409 en cas de conflit) ; `PapiersTravailPanel` dans le détail d'une mission ; colonne `AuditMission.papiers`, migration `20260930140000_audit_papiers_travail` (non appliquée localement). Pas de pièce jointe binaire : référence de la pièce en GED.
- **L5 limites levées** : champs personnalisés dans l'export LDC (colonnes visibles du rôle) et dans R-INC-2 (champs sans restriction de rôle seulement : l'édition figée est lue par tous) ; module de champs « constat » (colonne `AuditConstat.champs`, migration `20260930150000_constat_champs`, requis / restreints / préservés, invisibles en lecture pour les autres rôles) ; vocabulaire de l'organisation côté serveur (`getTOrg`) pour exports de rapports, génération de rapports et e-mail de diffusion — seuls les termes présents dans ces chaînes changent (aucune page n'est rendue côté serveur : toutes utilisent le contexte client).
- **Reste** : R-INC-3 (fiche de déclaration par régime, un document par incident) ; champs personnalisés absents des rapports R-CTL/R-AUD, de l'export des risques et de l'export des constats ; recette navigateur de tout ce qui précède (voir ⚠ ci-dessus).
- ⚠ Migrations non appliquées localement (Docker indisponible), dans l'ordre : `20260930100000_incidents_l1_suite`, `20260930110000_audit_l4_rappels`, `20260930120000_controle_rattachements`, `20260930130000_rapports_config`, `20260930140000_audit_papiers_travail`, `20260930150000_constat_champs` → `prisma migrate deploy` + `generate` + redémarrage du dev. Nouveaux crons à brancher (scheduler.sh / workflow déjà à jour) : `audit-rappels`, `rapports-planifies`.

---

## 2026-09-29 (18) — Claude Code : lot L5 « Personnalisation » + correctif « Vérifiée » — ⚠ à vérifier

- **CI PR #192** : 8/8 verts sur `6925f15` (L4), dont `e2e/audit-l4.spec.ts` (donc la migration L4 s'applique bien en CI).
- **L5** : `lib/vocabulaire`, `lib/champs-perso`, `lib/gabarits` (purs, testés) ; migration `20260929220000_personnalisation_l5`
  (`OrganizationConfig.vocabulaire/champsPersonnalises`, colonne `champs` sur Incident/Controle/AuditMission) ; routes
  `GET/PUT /api/personnalisation` (ADMIN pour PUT ; GET filtre les champs par rôle) et `POST /api/personnalisation/gabarit`
  (aperçu `dryRun`, ADMIN, journalisé) ; `I18nProvider` applique le vocabulaire (côté client) ; UI `/configuration/personnalisation`,
  champs dans les formulaires incident / contrôle / mission ; i18n ×5.
- **Sécurité des champs** : les champs restreints à un rôle sont retirés en lecture (liste, détail, réponses d'écriture) et
  ne peuvent ni être écrits ni écrasés par un autre rôle (`fusionnerChamps` conserve les valeurs existantes invisibles).
- **Régression corrigée (introduite en L4)** : le nouveau statut `VERIFIE` était traité comme « ouvert » dans la liste des
  missions, le plan d'action unifié, le suivi régulateur et la couverture des référentiels (jeux `RESOLU/ACCEPTE` codés en dur)
  → tous alignés sur `constatTermine`, avec tests de non-régression.
- **Vérifié** : `tsc` 0 · `npm test` **2554/2554** · `i18n:check` · `npm run build` OK · SQL de la migration comparé à
  `prisma migrate diff`.
- ⚠ **Non vérifié** : Docker Desktop toujours indisponible → migration L5 **non appliquée localement** (`prisma migrate deploy` +
  `generate` + redémarrage du dev à faire) et `e2e/personnalisation-l5.spec.ts` **non exécuté** (il tournera en CI). Recette
  navigateur à faire : page `/configuration/personnalisation` (ADMIN), renommage visible dans le menu, champs requis / réservés,
  aperçu puis application d'un gabarit (vérifier les modules effectivement activés, y compris sous politique d'instance FORCE_ON/OFF).
- **Limites connues L5** : vocabulaire non appliqué aux pages rendues côté serveur, aux exports et aux PDF ; champs personnalisés
  absents des exports / rapports et des constats d'audit ; un gabarit ne gère pas la politique d'instance.

---

## 2026-09-29 (17) — Claude Code : lot L4 « Audit interne » + brand + navbar — ⚠ TESTS À REFAIRE

### ⚠ Tests L3 (contrôle permanent) à refaire — demande explicite de l'utilisateur
Contexte : la CI du push L3 (`36129a1`) n'était **pas encore relue** ; la recette navigateur a été faite en E2E
automatisé uniquement (1 parcours). À refaire / compléter à la main sur l'instance de dev :
1. **CI PR #192** : relire les 8 contrôles sur `36129a1` et suivants ; en particulier « Production build & cyber E2E »
   (`e2e/controles-l3.spec.ts` s'exécute **avant** `incidents-l1` et `rapports`, en un seul run, sur la même org).
2. **Contrôles** : créer un contrôle avec type / mode / **contrôle clé** / méthode d'échantillonnage ; vérifier la taille
   d'échantillon suggérée (population 8 / 40 / 200 / 900 / 5000, clé ×1,5) et qu'elle reste modifiable.
3. **Conception** : évaluer la conception d'un contrôle **jamais exécuté** (détail ouvrable), puis d'un contrôle exécuté ;
   effacer l'évaluation (« Non évaluée ») ; contrôler RBAC (lecture seule pour un non-2ᵉ ligne, `LECTEUR`, `METIER`).
4. **Appréciation conjuguée** : combiner conception × efficacité (efficace / à surveiller / défaillant) avec de vraies exécutions.
5. **Plan annuel** `/controles/plan` : périodicités hebdo / mensuelle / trimestrielle / semestrielle / annuelle, changement
   d'année, contrôle créé en cours d'année, contrôle inactif exclu, pics de charge, affichage mobile et thème sombre.
6. **API v1** `POST /api/v1/controls/{id}/results` avec une **vraie clé** (scope write, puis scope read → 403), contrôle manuel
   (400), autre organisation (404), anomalie → action liée au risque, `fluxInterrompu` dans `GET /api/v1/controls`.
7. **Récurrence / escalade** : 2 anomalies consécutives (N2), contrôle clé (comité) ; badges dans la liste.
8. **Rapports R-CTL-1/2/3** : génération sur une vraie période, cycle relu → validé, export Excel, impression PDF ; ×5 langues.
9. **Migration** `20260929200000_controle_l3` sur une copie de base de production (colonnes par défaut, contrôles existants).

### Fait dans ce tour
- **Marque** : « Augmented Cyber **(& Business)** Risk Analysis » partout (README ×5, application : titres, footer, exports,
  PDF/Word/PowerPoint, i18n `appSubtitle`/`acraSubtitle`, page vie privée, `scripts/setup.sh`).
- **Navbar** : « Rapports » sort de Pilotage → groupe **Conformité & réglementaire** (mêmes rôles à lecture globale),
  libellé **« Rapports GRC »** ×5 (« Reporting réglementaire » existait déjà pour la page DORA — d'où le choix).
- **L4 audit** : `lib/audit-l4` (pur) ; migration `20260929210000_audit_l4` ; `VERIFIE` ajouté aux statuts de constat
  (terminal) ; routes `audit/constats/[id]/suivi`, `audit/missions/[id]/independance`, `audit/univers[/id]`, `audit/plan` ;
  rapports R-AUD-1/2/3 ; UI (suivi de recommandation, notation/jalons/indépendance, `/audit/plan`) ; i18n ×5.
- **Vérifié** : `tsc` 0 · `npm test` **2519/2519** · `i18n:check` · `npm run build` OK · SQL de la migration comparé
  hors ligne à `prisma migrate diff` (mêmes 14 colonnes + table `AuditUnivers`, mise en forme différente seulement).
- ⚠ **NON vérifié** : Docker Desktop ne démarrait plus (moteur indisponible après saturation du disque) → **migration
  `20260929210000_audit_l4` non appliquée localement** (`npx prisma migrate deploy` + `prisma generate` + redémarrage du
  dev à faire) et **`e2e/audit-l4.spec.ts` non exécuté** (à lancer : `E2E_BASE_URL=http://localhost:3000 npx playwright test
  e2e/audit-l4.spec.ts` avec `DATABASE_URL` en localhost). La vérification par l'AUDITEUR n'est couverte que par les tests
  de route (pas d'utilisateur AUDITEUR dans le seed E2E).
- **Reste L4** : relances automatiques par échéance, feuilles de travail, `auditConfig` (cycles / libellés de notation).
- **Environnement** : disque quasi plein (196/228 Go) — cache npm et `.next/cache` purgés ; à surveiller.

---

## 2026-09-29 (16) — Claude Code : lot L3 « Contrôle permanent » + correctif CI E2E

- **CI PR #192** : L1 8/8 verts ; sur le push L2, **E2E en échec** = contamination entre specs (l'incident créé par
  `incidents-l1` restait dans l'org et faussait les totaux de `rapports`) → `deleteMany` par organisation dans les
  deux specs. Piège : les specs E2E partagent une seule org et tournent dans l'ordre alphabétique **en un seul
  run** en CI — toujours nettoyer ce qu'on crée. Reproduit localement (3 specs enchaînés).
- **L3** : `lib/controle-l3` (pur) ; migration `20260929200000_controle_l3` (typeControle, modeControle, cle,
  methodeEchantillon, conception, `ControleExecution.source`) ; `GET /api/controles` enrichi (`l3`),
  `GET /api/controles/plan`, `POST /api/v1/controls/[id]/results` (contrôles AUTOMATIQUE, scope write, exécutant
  `api:<keyId>`, rate limit, OpenAPI à jour) ; rapports R-CTL-1/2/3 dans le cadre L2 ; UI (champs, pastilles,
  conception, plan annuel `/controles/plan`). Le détail d'un contrôle jamais exécuté est désormais ouvrable
  (la conception s'évalue avant toute exécution).
- **Vérifié** : `tsc` 0 · `npm test` **2474/2474** · `i18n:check` · `npm run build` OK · migration appliquée
  (pas de dérive) · e2e navigateur `controles-l3` + `incidents-l1` + `rapports` enchaînés **verts**.
- **Environnement** : disque du poste plein (ENOSPC) → cache npm (`npm cache clean --force`) et `.next/cache`
  purgés (régénérables). À surveiller : 196 Go / 228 Go utilisés.
- **Reste L3** : rejeu du test à la période suivante / comparaison N-1 (B-CTL-5), rattachement tiers / projet 360
  (B-CTL-8). Puis L4 (audit).

---

## 2026-09-29 (15) — Claude Code : lot L2 « Reporting » (éditions figées, 3 rapports)

**Branche** : `feat/historical-excel-import`, PR #192 (brouillon) — **CI de L1 : 8/8 verts**.

- **Modèle** `RapportEdition` (migration `20260929190000`) : contenu structuré figé, statuts BROUILLON → RELU →
  VALIDE → DIFFUSE ; quatre-yeux (`transitionRapport`) sauf mode ligne unique (validation directe et
  auto-validation, journalisée `autoValidation`). Seul un brouillon est régénérable / supprimable.
- **Rapports** (builders purs) : R-INC-1, R-PER-2, R-GRC-3 (réutilise `verdictDispositif` du cockpit). Libellés
  statiques = clés i18n `{k}` résolues à l'affichage ; libellés de données résolus à la génération.
- **API** : `GET/POST /api/rapports` (rate limit, disponibilité selon modules), `GET/PATCH/DELETE
  /api/rapports/[id]` (404 hors org active), `GET /api/rapports/[id]/export` (Excel). Droits : lecture =
  rôles à lecture globale ; écriture = admin / risk manager / RSSI (`lib/rapport-acces`).
- **UI** : `/rapports`, `/rapports/[id]` (impression PDF navigateur), lien « Rapports » dans Pilotage (et dans
  la barre cyber si le module incidents est actif).
- **Vérifié** : `tsc` 0 · `npm test` **2428/2428** · `i18n:check` · `npm run build` OK · migration appliquée (pas de
  dérive) · e2e navigateur `e2e/rapports.spec.ts` **vert** (génération → quatre-yeux → validation → figé).
- **Reste L2** : diffusion par e-mail, gabarits surchargeables, masquage pour rapports externes, rapports
  planifiés en brouillon, PDF serveur, R-INC-2/3 (registre, fiches de déclaration par régime).

---

## 2026-09-29 (14) — Claude Code : lot L1 « Incidents & pertes » (régimes de notification, pertes multi-composantes)

**Branche** : `feat/historical-excel-import`. Décisions §9 de la spec retenues sur les recommandations.

- **Régimes de notification** (`lib/notification-regimes`, pur) : catalogue NIS2 (24 h / 72 h / rapport
  final un mois après la notification — **délais et intitulés vérifiés sur EUR-Lex** FR/EN/DE/ES ; IT via
  considérant 102), RGPD art. 33 (72 h, intitulé officiel ×5) et « interne » (exemple modifiable) ; tous
  **inactifs par défaut** (rétrocompatible). Régimes personnalisés (≤ 12, ≤ 6 phases), déclencheurs
  (toujours / significatif / données personnelles / contractuel / manuel), horloges, notifications
  soumises. DORA garde `dora-reporting` (règle « le plus tôt des deux »).
- **Pertes** (`lib/pertes`) : lignes typées + récupérations, devises et taux (une devise sans taux est
  **exclue et signalée**, jamais convertie à un taux inventé), seuils de collecte / grande perte.
  `montantBrut` / `recuperations` restent les agrégats (somme des lignes en devise de référence).
- **Config org** : `OrganizationConfig.incidentsConfig` (JSON, `lib/incidents-config`) ; `GET/PUT
  /api/incidents/config` (PUT = ADMIN). Migration `20260929180000_incidents_l1`.
- **Incident** : `typeEvenement`, `quasiIncident`, `attributs`, `notifications`, `pertes`,
  `recuperationsLignes`, `dateReglement`. `POST/DELETE /api/incidents/[id]/notifications` (2ᵉ ligne).
  PATCH partiel : les agrégats sont recalculés sur l'ensemble lignes fournies + lignes existantes.
  Garde commune extraite dans `lib/incident-access.server.ts`.
- **UI** : `NotificationsPanel`, `PertesEditor`, `IncidentsConfigEditor`, colonne « Notifications »,
  pastilles type / quasi-incident / grande perte, export LDC enrichi.
- **Vérifié** : `tsc` 0 · `npm test` **2381/2381** · `i18n:check` · `npm run build` OK · migration
  appliquée (pas de dérive) · e2e navigateur `e2e/incidents-l1.spec.ts` **vert** (déclaration → horloge
  NIS2 → marquage « soumis » → pertes par composantes → « Grande perte »).
- **Piège** : `sed -i` sans extension échoue sur macOS et fait sauter le reste d'une chaîne `&&` (fichier
  non créé) ; utiliser python ou `sed -i ''`, et vérifier l'existence des fichiers créés.
- **Reste dans L1** : B-PER-3 (allocation entités/lignes de métier), B-PER-5 (impact non financier),
  B-PER-6 (rapprochement comptable), B-INC-3 (chronologie, cause racine), B-INC-5 (import CSV, API v1 en
  écriture). Puis L2 (reporting), L3 (contrôle), L4 (audit), L5, exemples L6 pour Incidents.

---

## 2026-09-29 (13) — Claude Code : cadrage reporting GRC (1.0.4) + exemples des modules récents

**Branche** : `feat/historical-excel-import` (PR #191 fusionnée ; on continue sur cette branche,
puis nouvelle PR). **Décision produit** : pas de publication de la v1.0.4 pour l'instant (la
1.0.3 vient de sortir) ; on ajoute d'abord des fonctionnalités. Notes de release brouillon :
`docs/releases/v1.0.4.md` (à compléter au fil des lots).

- **Cadrage détaillé** : `docs/specs/reporting-grc-besoins.md` — modules Incidents, Pertes,
  Contrôle permanent, Audit et **reporting** ; 9 contextes cibles, 4 couches d'adaptation
  (vocabulaire, catalogues, règles/seuils, workflows/droits), besoins B-INC/B-PER/B-CTL/B-AUD,
  catalogue de 14 rapports, gabarits sectoriels, lots L1–L6, 8 décisions à trancher
  (recommandations en gras). Contenu réglementaire = « à sourcer » (EUR-Lex/officiel) à l'implémentation.
- **Exemples et explications (L6, lot 1)** : composants `ExampleChips` (pastilles cliquables) et
  `ModuleGuide` (« À quoi ça sert / Comment s'en servir / Ce que vous en tirez ») ; branchés sur
  Projets (4 projets types), Dérogations (4 motifs + mesures), Tests de résilience DORA (4 tests
  aux types officiels), et guides sur RAS/RAD et Maturité. i18n ×5 (`exemples`, `projets.guide/examples`,
  `derogations.examples`, `testsResilience.guide/examples`, `appetence.guide`, `maturite.guide`) ;
  test de parité `exemples-modules-i18n`.
- **Vérifié** : `tsc` 0 · `npm test` **2309/2309** · `i18n:check` · e2e `projets.spec.ts` vert.
  `npm run build` non relancé (composants et i18n seulement).
- **Prochain pas** : trancher les décisions du §9 de la spec (surtout l'ordre des lots), puis L1
  (régimes de notification + pertes multi-composantes) en TDD ; poursuivre L6 (exemples
  Incidents/Contrôle/Audit) avec L1–L4.

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
- **Suite (tour 12)** : CI #191 — seul `npm audit` échouait (nodemailer GHSA-6vj9-mwq6-2f5v,
  advisory nouvelle) → `nodemailer@^10.0.12`, exceptions `image-size` retirées (devenues inutiles),
  `audit-check` propre. Recette navigateur réelle : `e2e/projets.spec.ts` (projet 360 → analyse
  cyber préremplie) **vert** contre le dev (`DATABASE_URL` en localhost, `E2E_BASE_URL=http://localhost:3000`).
  Champ « Nom » de la création d'analyse : `id`/`htmlFor` ajoutés. Cockpit GRC avec un seul module :
  `e2e/pilotage-grc.spec.ts` **vert** (registre off + contrôle permanent on → /pilotage reste, bloc projets visible). CI #191 : 8/8 verts après le correctif nodemailer.
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
