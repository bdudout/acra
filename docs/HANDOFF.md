# Journal de passation — Claude Code ⇄ Codex

À lire en **début de tour**, à mettre à jour en **fin de tour** (cf. skill
`acra-engineering` §1). Le plus récent en haut. Rester factuel : ce qui a été
vérifié l'est avec la commande et son résultat.

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
