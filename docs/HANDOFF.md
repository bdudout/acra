# Journal de passation — Claude Code ⇄ Codex

À lire en **début de tour**, à mettre à jour en **fin de tour** (cf. skill
`acra-engineering` §1). Le plus récent en haut. Rester factuel : ce qui a été
vérifié l'est avec la commande et son résultat.

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
