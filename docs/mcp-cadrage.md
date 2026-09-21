# MCP — Expression de besoins & cadrage

> Statut : **cadrage validé** (choix structurants arrêtés). Implémentation non
> démarrée. La surface MCP est déjà **gardée** par l'interrupteur d'instance
> `mcpEnabled` (SUPER_ADMIN, désactivé par défaut — cf. `/admin/instance`).

## 1. Objectif

Permettre à une organisation d'utiliser **son propre agent / LLM souverain** pour
**accélérer la complétion** d'une analyse EBIOS RM et de la conformité dans ACRA,
via le protocole **MCP (Model Context Protocol)** — sans jamais compromettre la
souveraineté des données, le RBAC, l'isolation multi-organisation ni la
traçabilité.

## 2. Décisions de cadrage (arrêtées)

| Choix | Décision | Conséquence |
|---|---|---|
| **Rôle** | ACRA = **serveur MCP** | ACRA *expose* des outils ; l'org branche SON client/agent. ACRA n'émet **aucun** appel sortant vers un LLM. |
| **Portée** | **Lecture + écritures VALIDÉES** | Les outils d'écriture produisent des **propositions** (brouillons) validées par un humain dans l'UI — jamais de mutation finale directe. |
| **Identité / auth** | **Clé d'API + scope `mcp`** | Réutilise l'infra existante (clés org-scopées, scopes, révocation, `lastUsedAt`, audit). Un nouveau scope `mcp` distinct de `read`/`write`/`provision`. |
| **Cas d'usage initiaux** | Intake assisté · Édition assistée · Recommandations | (Le reporting pur n'est pas prioritaire ; la lecture sert de **contexte** aux flux ci-dessus.) |

## 3. Principes non négociables

1. **Souveraineté des données** : ACRA est serveur ; c'est l'org qui choisit et
   héberge le LLM/agent. ACRA **ne transmet jamais** de données à un LLM externe
   de sa propre initiative. Le SUPER_ADMIN active MCP en conscience (`mcpEnabled`,
   OFF par défaut) et documente le modèle utilisé (interne & souverain recommandé).
2. **Aucune écriture finale par la machine** : toute mutation passe par une
   **proposition** revue et validée par un humain habilité dans l'UI (préserve le
   workflow d'approbation, le RBAC et l'auditabilité).
3. **Isolation multi-organisation** : chaque appel est borné à l'organisation de la
   clé d'API — mêmes gardes que l'API v1 / les routes org-scopées (cf.
   `docs/ARCHITECTURE.md` §5 et les tests IDOR). Aucun accès transverse.
4. **Traçabilité** : **chaque invocation d'outil** est journalisée (clé/agent,
   outil, arguments résumés, organisation, horodatage) et transférable au SIEM.
5. **Moindre privilège** : outils de lecture et d'écriture séparés ; le scope `mcp`
   n'accorde que la surface MCP, pas l'API v1 générale.
6. **Réversibilité** : révocation immédiate (désactiver `mcpEnabled`, ou révoquer la
   clé / son scope `mcp`).

## 4. Architecture cible

- **Serveur MCP** exposé par l'instance ACRA (endpoint dédié, ex. `/api/mcp`),
  transport **HTTP streamable** (standard MCP actuel) — l'agent de l'org s'y
  connecte en **Bearer clé d'API** (scope `mcp`).
- **Gating** : l'endpoint refuse tout si `mcpEnabled` est faux (helper
  `isMcpEnabled`, déjà en place) ; puis auth clé d'API + scope `mcp` ; puis
  résolution du périmètre org (identique à `authenticateApiRequest`).
- **Rate limiting** : réutiliser `lib/rate-limit` (clé `mcp:<keyId>`).
- **Audit** : `auditLog('MCP_TOOL_INVOKED', …)` par appel.

## 5. Périmètre initial — outils MCP

> Convention : outils **`read_*`** (lecture, contexte) et **`propose_*`** (écriture
> = proposition validée). Entrées typées (JSON Schema), sorties déterministes,
> erreurs sans fuite de données.

### Lecture (contexte, org-scopée)
- `read_referentiels` — liste des référentiels de l'org (+ exigences d'un référentiel).
- `read_taxonomie` — taxonomie des risques disponible.
- `read_sector_examples` — exemples sectoriels (valeurs métier, biens supports, sources de risque…).
- `read_risk_posture` — synthèse risques / conformité / plans d'action (lecture seule).

### Intake assisté (proposition)
- `propose_referentiel_from_text` — à partir d'un texte de **PSSI** fourni par
  l'agent : propose un **référentiel interne** (exigences structurées) → brouillon
  validable. *(Rappel : c'est l'org qui fait analyser sa PSSI par son LLM ; ACRA
  reçoit le résultat structuré, pas le LLM.)*
- `propose_analysis_intake_from_text` — à partir d'une **présentation projet** :
  pré-remplit **atelier 1** (valeurs métier, biens supports, périmètre) → brouillon.

### Édition assistée (proposition)
- `propose_risk` / `propose_measure` / `propose_plan_action` /
  `propose_conformite_treatment` — crée une **proposition** de création/mise à jour,
  matérialisée dans une **file de propositions** revue en UI. Assainissement via les
  libs existantes (`import-sanitize`, validateurs `*.ts`).

### Recommandations (proposition)
- `recommend_risks_scenarios` — propose des risques/scénarios recommandés (secteur,
  contexte, référentiels) → importables après validation.

## 6. Modèle « écritures validées »

Les outils `propose_*` **n'écrivent pas** l'objet final : ils créent une
**proposition** (brouillon typé, rattaché à l'org + à la clé/agent émetteur + à
l'analyse ou au socle cible), présentée dans une **file de validation** de l'UI où
un utilisateur habilité (selon le RBAC de la ressource) **accepte, édite ou
rejette**. À l'acceptation, l'objet réel est créé/mis à jour via les chemins
existants (mêmes validations, mêmes audits). Options d'implémentation à trancher en
conception : réutiliser les mécanismes d'import/brouillon existants ou un modèle
`McpProposal` dédié.

## 7. Sécurité & gouvernance (récapitulatif)

- Activation **SUPER_ADMIN** (`mcpEnabled`, OFF par défaut) — **fait**.
- Auth **clé d'API + scope `mcp`** ; org-scope strict ; rate limiting ; révocation.
- **Human-in-the-loop** imposé côté serveur (propositions, pas de mutation directe).
- **Journalisation** par appel + transfert SIEM ; tests IDOR à étendre aux outils MCP.
- **Localisation des données** : LLM/agent **interne & souverain** recommandé ; le
  toggle et cette doc rendent le choix explicite et tracé.

## 8. Bonnes pratiques MCP retenues

- **Outils peu nombreux et bien décrits** (nom explicite, description, schéma
  d'entrée typé) ; séparation lecture / écriture ; **moindre privilège**.
- **Idempotence** et **pagination** pour les lectures ; **propositions** (non
  destructives) pour les écritures.
- **Erreurs déterministes** sans divulgation d'existence de ressources hors périmètre.
- **Versionnage** de la surface d'outils ; **découvrabilité** via le protocole.
- **Transport HTTP streamable** authentifié ; pas d'exécution de code arbitraire.

## 9. Ce qui est déjà en place / reste à faire

- ✅ Interrupteur d'instance `mcpEnabled` (SUPER_ADMIN, OFF par défaut) + helper
  `isMcpEnabled` (fail-closed) + UI `/admin/instance`.
- ⬜ Scope `mcp` sur les clés d'API (+ UI de gestion) et garde d'auth MCP.
- ⬜ Endpoint serveur MCP (`/api/mcp`, transport streamable) + enregistrement des outils.
- ⬜ File de **propositions** + validation UI (modèle et parcours).
- ⬜ Outils `read_*` puis `propose_*` (par vagues, cf. §10).
- ⬜ Journalisation `MCP_TOOL_INVOKED` + SIEM + tests IDOR MCP.

## 10. Phasage proposé

1. **Socle** : scope `mcp`, endpoint MCP gardé (`mcpEnabled` + clé + org-scope),
   audit, rate limit, un premier outil `read_referentiels` (validation de bout en bout).
2. **Lecture de contexte** : `read_taxonomie`, `read_sector_examples`, `read_risk_posture`.
3. **File de propositions** (modèle + UI de validation) + `propose_risk`.
4. **Intake assisté** : `propose_referentiel_from_text`, `propose_analysis_intake_from_text`.
5. **Édition assistée & recommandations** : `propose_measure`, `propose_plan_action`,
   `propose_conformite_treatment`, `recommend_risks_scenarios`.

## 11. Points de vigilance

- **Volume/DoS** : cap des tailles d'entrée et de propositions (réutiliser
  `import-sanitize` : `capArr`, `clampInt`).
- **Prompt/tool injection** : le contenu fourni par l'agent est **de la donnée**,
  jamais des instructions pour ACRA ; assainir avant persistance.
- **Cohérence RBAC** : la validation d'une proposition applique le RBAC de la
  ressource cible (une proposition n'élève jamais les droits).
- **Souveraineté** : documenter et rappeler que brancher un LLM externe sur MCP
  ferait sortir des données — responsabilité de l'exploitant, hors défaut.

---

Voir aussi : `docs/ARCHITECTURE.md` (patterns d'auth, org-scope), mémoire projet
`idees-ai-intake` (idées d'intake), `docs/CHANTIERS-EN-COURS.md` (chantier « IA gouvernée »).
