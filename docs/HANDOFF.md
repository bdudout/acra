# Journal de passation — Claude Code ⇄ Codex

À lire en **début de tour**, à mettre à jour en **fin de tour** (cf. skill
`acra-engineering` §1). Le plus récent en haut. Rester factuel : ce qui a été
vérifié l'est avec la commande et son résultat.

---

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
