# Journal de passation — Claude Code ⇄ Codex

À lire en **début de tour**, à mettre à jour en **fin de tour** (cf. skill
`acra-engineering` §1). Le plus récent en haut. Rester factuel : ce qui a été
vérifié l'est avec la commande et son résultat.

---

## 2026-09-28 (6) — Codex : connecteurs d’entités REST/LDAP, persistants et explicites

**Branche** : `feat/historical-excel-import`. Commit `dbf4ec4` (non poussé).

- Ajout de `entitesSyncConfig` (JSON) dans `OrganizationConfig` et migration
  `20260928280000_entites_sync_config` **appliquée localement**. Les jetons REST et
  mots de passe LDAP sont AES-256-GCM (`secret-crypto`) ; la projection GET les
  masque. Une sauvegarde sans nouveau secret — y compris le marqueur `[CONFIGURED]`
  de l’UI — conserve le secret chiffré au lieu de l’écraser.
- Admin : `/configuration/entites` contient `EntitySyncManager` : choix REST ou
  LDAPS, sauvegarde, test/aperçu, cases à cocher et import explicite. Aucun nom
  n’est créé automatiquement : l’import sélectionné enrichit uniquement
  `OrganizationConfig.entitesMesures` (les responsables de mesures), avec audit.
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
