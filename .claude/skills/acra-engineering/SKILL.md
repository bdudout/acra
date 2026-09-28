---
name: acra-engineering
description: Développer, corriger, documenter et vérifier ACRA (EBIOS RM, ISO 27005/31000, NIST, GRC modulaire) — TDD, i18n ×5, RBAC, isolation multi-organisation. À utiliser pour TOUTE modification du dépôt ACRA (ebios-rm/), y compris reprendre le travail laissé par l'autre agent.
---

# ACRA engineering — skill commune Claude Code × Codex

Source unique, versionnée dans le dépôt (`ebios-rm/.claude/skills/acra-engineering/`).
Codex la lit via un lien symbolique depuis `~/.codex/skills/acra-engineering/`.
**Une seule copie : modifier ce fichier, jamais une copie locale.**
Les règles de projet (`CLAUDE.md` racine, `ebios-rm/AGENTS.md`) prévalent sur ce skill.

---

## 1. Collaboration à tour de rôle — règle n°1

Deux agents (Claude Code et Codex) développent ACRA **ensemble, à tour de rôle,
dans le même répertoire de travail et sur la même branche**. L'utilisateur passe
la main de l'un à l'autre (souvent quand les jetons d'un agent sont épuisés).

### Interdits
- **Ne jamais créer de branche**, ni `git checkout -b`/`git switch -c`, ni worktree.
- **Ne jamais changer de branche** (`git checkout <autre>`, `git switch`) : on reste
  sur `git branch --show-current`, quelle qu'elle soit.
- **Ne jamais détruire le travail de l'autre** : pas de `git reset --hard`,
  `git restore`/`git checkout -- <fichier>`, `git stash`, `git clean`, `--amend`
  d'un commit que l'on n'a pas créé dans ce tour, rebase ou `push --force`.
- Ne pas utiliser ni réinitialiser le `main` **local** (historique divergé) ; la
  référence stable est `origin/main`.
- `git push`, ouverture de PR, merge : **uniquement à la demande de l'utilisateur**.

### Début de tour (obligatoire, avant tout changement)
1. `git status --short --untracked-files=all` et `git log --oneline -8` ;
   `git fetch origin -q && git log --oneline HEAD..origin/main` (retard éventuel).
2. Lire [`docs/HANDOFF.md`](../../../docs/HANDOFF.md) : ce qui est fait, en cours,
   le prochain pas et les pièges laissés par le tour précédent.
3. **Tout changement non commité appartient au tour précédent** : le lire (`git diff`),
   le reprendre et le terminer — ne pas l'écraser. S'il contredit la demande en
   cours, le signaler à l'utilisateur avant d'y toucher.
4. `npx tsc --noEmit -p tsconfig.json` + `npm test` pour connaître l'état de départ
   (on ne peut pas attribuer une régression sans point de référence).

### Pendant le tour
- Commits **petits et fréquents** (un lot cohérent = un commit), message
  conventionnel en français (`feat(zone): …`, `fix(zone): …`), terminé par la
  ligne `Co-Authored-By` de l'agent.
- **Stager par chemin explicite**, jamais `git add -A`/`git add .` : ne jamais
  embarquer `.agents/`, `rapports/`, `.acra-test-memory/`, `.env*`.
- Mettre l'arrière-plan à jour sans changer de branche : `git merge origin/main`
  (pas de rebase). Conflit → le résoudre en préservant les deux intentions.
- Après un merge GitHub : `gh pr merge <n> --squash` **sans `--delete-branch`**
  (sinon `gh` bascule l'arbre sur le `main` local divergé). Puis `git merge origin/main`.

### Fin de tour (obligatoire)
1. Arbre **commité** (ou changements non commités explicitement décrits).
2. Mettre à jour `docs/HANDOFF.md` : fait / en cours / prochain pas / pièges /
   état des vérifications (commandes lancées et résultat réel).
3. Réponse finale : ce qui est vérifié vs non vérifié, commits créés (hash),
   ce qui attend une décision de l'utilisateur.

---

## 2. Prise de contexte proportionnée

Avant une zone inconnue : `docs/ARCHITECTURE.md` (« où vit quoi », modules M1–M5,
patterns d'API), puis la spec concernée dans `docs/specs/`. Le code est la source
de vérité ; corriger la divergence de doc découverte si elle est dans le périmètre.
Lire en parallèle les fichiers indépendants ; chercher un helper existant avant
d'en écrire un (`src/lib/`, cf. index de `ARCHITECTURE.md`).

## 3. Invariants ACRA

- **Pas de dépendance LLM/IA externe** (données de risque sensibles) sans décision produit.
- **Isolation organisationnelle** : accès via `analyseAccessWhere`,
  `getEffectiveRoleForOrg`, `getAccessibleOrgIds` ; droits via `lib/permissions`.
  Aucune vérification de rôle ad hoc (`role !== 'X'`) dans une route.
- **Gel d'analyse** : toute écriture sur une analyse passe par le même garde que la
  saisie directe (`guardDirectRisk` / `analyseGelee`) — y compris les chemins
  indirects (MCP, import, qualification).
- **Configuration à 3 niveaux** (défaut → org → politique d'instance) résolue en un
  seul point : `getOrgConfig`.
- **i18n ×5** (fr, en, de, es, it) pour toute chaîne visible, **y compris les
  données par défaut** (catalogues, risques proposés) : jamais de libellé français
  codé en dur dans une lib. Terminologie réglementaire = sources officielles, version citée.
- **Prisma** : champs sans accent ; toute évolution de schéma = migration
  horodatée ; ne jamais modifier une migration déjà commitée.
- **Contrats polymorphes** : créer les liens `PlanActionLien` via les helpers de
  `plan-action.server.ts`. `RISQUE_ANALYSE` exige `targetId = Risque.id` **et**
  `ref = analyseId` (compteurs et liens profonds en dépendent).

## 4. Construire (TDD)

Test d'abord (`src/__tests__/unit/{lib,components,api}/`), vérifier le rouge,
implémenter, vérifier le vert. Toute logique décidable d'une route → fonction
pure testée. Une logique dupliquée entre deux routes/fonctions → l'extraire.

## 5. Définition de « terminé »

Ne jamais déclarer une vérification sans l'avoir exécutée ; rapporter la sortie réelle.

| Changement | Vérification minimale |
|---|---|
| Toute modif | `npx tsc --noEmit -p tsconfig.json` · `npm test` |
| Clés/données i18n | `npm run i18n:check` (+ test de parité) |
| `route.ts`, exports, config Next | `npm run build` (le contrat « route n'exporte que des handlers » n'est **pas** vu par `tsc`) |
| Schéma Prisma | migration + `prisma migrate deploy` + `prisma generate` + **redémarrage du dev** |
| UI / parcours | vérification réelle dans le navigateur (dev :3005), y compris lecture seule / analyse gelée |
| PDF / export | test sur build de production (bundling) |

### Versions et canaux (issue #185)
- `package.json` est la source de la version affichée. `main` = canal **bêta** :
  préversion de la prochaine version (`1.0.4-beta.1`), à incrémenter quand une
  livraison notable est fusionnée. La PR de release aligne `package.json` sur le tag
  (`npm version X.Y.Z --no-git-tag-version`) ; le workflow refuse sinon.
- La branche `stable` n'est jamais modifiée à la main : elle avance à la publication
  d'une release stable (workflow « Align stable branch »).

## 6. Revue de sécurité avant commit

Relire `git diff --cached` contre cette liste (constats réels des audits ACRA) :
- Authz : helpers d'accès + rôle effectif dans l'org de la ressource ; 404 sans
  divulgation hors périmètre ; gel respecté.
- **Endpoints coûteux** (parsing de fichier, export, import) : rate limit
  (`lib/rate-limit`), taille max **décompressée** (xlsx/zip), traitement borné ;
  ne pas bloquer l'event loop (ExcelJS charge tout le classeur en mémoire).
- **Tableur/CSV** : neutraliser l'injection de formule (`lib/spreadsheet-safe.ts`) ;
  lire les cellules via `cell.text`/`result` (formules, texte enrichi).
- Journal d'audit (`auditLog`) pour toute écriture ou **export** de données sensibles.
- Erreurs : pas de message interne brut renvoyé au client (codes d'erreur stables).
- Idempotence et atomicité : transaction pour un lot, timeout adapté au volume,
  gestion de la course `P2002` (cf. registre).

## 7. Pièges d'environnement (poste local)

- Dev : `npm run dev` sur **:3005** (:3000 peut être occupé par un conteneur).
  Si `db:5432` est injoignable : préfixer `DATABASE_URL=…@localhost:5432/acra_rm`.
- `npm run build` écrase `.next` d'un dev en cours → arrêter le dev, builder, relancer.
- Après `prisma generate`, le dev garde l'ancien client → redémarrer.
- Avant de (re)lancer le dev : `lsof -nP -iTCP:3005 -sTCP:LISTEN`. Un serveur déjà
  présent (lancé par l'autre agent/l'utilisateur) fait échouer le nouveau en silence
  (EADDRINUSE dans le log) alors que le health check répond. Le redémarrer à
  l'identique (même port, même écoute) s'il sert un client Prisma périmé.
- `NEXTAUTH_URL=http://localhost:3000` : après login, revenir sur :3005 (cookie partagé).
- Un squash-merge fait apparaître la branche comme « non fusionnée » : vérifier le
  contenu (`git diff origin/main -- <fichier>`), pas le graphe.

## 8. Autonomie (modèles récents)

Agir directement sur ce qui est réversible et dans le périmètre ; demander à
l'utilisateur pour une décision produit (sémantique métier, ex. risques proposés
en EBIOS RM), une action destructive ou sortante (push, merge, suppression).
Pour un changement transverse, faire une seconde passe « adversariale » sur son
propre diff (cas limites, droits, données d'une autre org) avant de commiter.

## 9. Documentation et amélioration continue

Mettre à jour dans la même livraison : `docs/ARCHITECTURE.md` (pattern/couture),
`docs/specs/` (comportement exposé), `README.md` (capacité réellement disponible).
Consigner dans [`references/learned-practices.md`](references/learned-practices.md)
uniquement un apprentissage **vérifié** (règle non évidente, cause de régression,
piège récurrent) avec preuve et portée. Promouvoir une leçon dans ce `SKILL.md`
seulement si elle est stable, répétée ou critique ; retirer une règle devenue fausse.
Signaler toute modification du skill dans la réponse finale.
