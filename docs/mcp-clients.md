# Serveur MCP d'ACRA — guide de connexion pour un assistant IA

> Public : un assistant IA (Claude, Codex, Mistral Vibe…) ou la personne qui le branche. Ce guide décrit
> **comment obtenir une clé, se connecter, appeler les outils et interpréter les erreurs**. La conception
> (sécurité, isolation, propositions) est détaillée dans [`mcp-cadrage.md`](mcp-cadrage.md) ; une démonstration
> complète figure dans [`demo/mcp-projet-360.md`](demo/mcp-projet-360.md).

## 1. Principe

ACRA expose un serveur **MCP** ([Model Context Protocol](https://modelcontextprotocol.io)) qui permet à un assistant :

1. de **lire** le contexte de l'organisation (référentiels, analyses, projets, catalogues sectoriels…) ;
2. d'obtenir des **recommandations calculées par ACRA** (sans IA externe) ;
3. de **proposer** des créations ou des modifications. **Rien n'est écrit directement** : chaque proposition est mise
   en attente et un humain habilité l'accepte ou la rejette dans ACRA (menu *Propositions MCP*).

Le contenu envoyé par l'assistant est traité comme de la **donnée**, jamais comme des instructions. Une clé ne
donne accès qu'à **son** organisation : tout identifiant d'une autre organisation est « introuvable ».

## 2. Prérequis côté ACRA

| Étape | Qui | Où |
|---|---|---|
| Activer le serveur MCP pour l'instance | super-administrateur | *Administration › Instance › Interfaces programmatiques* (`mcpEnabled`) |
| Activer le MCP pour l'organisation | administrateur de l'organisation | *Configuration › Fonctionnalités optionnelles › Serveur MCP (agents IA)* (`mcpActive`) |
| Créer une clé MCP | administrateur de l'organisation | *Activité MCP* (`/mcp-activite`) › *Nouvelle clé MCP* |

La clé créée depuis *Activité MCP* porte le **seul** droit `mcp` (moindre privilège : elle n'ouvre pas l'API REST).
Elle est affichée **une seule fois**, avec la commande de connexion prête à copier. Donnez-lui un nom qui identifie
l'assistant et la personne (« Claude Code — RSSI ») et une date d'expiration courte.

**Suivi et révocation** : la page *Activité MCP* montre, par clé, l'état (active, révoquée, expirée), le dernier
appel, le nombre d'appels et d'erreurs sur 30 jours, les outils les plus appelés et les propositions déposées
(en attente, acceptées, rejetées). Le bouton *Révoquer* coupe l'accès **immédiatement** (irréversible).

> Un assistant ne peut **pas** demander lui-même une clé : c'est un acte d'administration, fait par un humain dans
> ACRA. L'assistant reçoit la clé par une variable d'environnement (`ACRA_MCP_KEY`), jamais dans la conversation.

## 3. Connexion

| Élément | Valeur |
|---|---|
| Point d'accès | `https://<votre-instance>/api/mcp` (en local : `http://localhost:3005/api/mcp`) |
| Transport | HTTP « streamable », **POST uniquement** (réponse JSON, pas de flux SSE ; `GET` → 405) |
| Authentification | en-tête `Authorization: Bearer <clé>` (clé `acra_…`, droit `mcp`) |
| En-têtes recommandés | `Content-Type: application/json`, `Accept: application/json, text/event-stream` |
| Protocole | JSON-RPC 2.0 ; versions MCP `2025-06-18` (défaut), `2025-03-26`, `2024-11-05` |
| Méthodes | `initialize`, `ping`, `tools/list`, `tools/call`, notifications (réponse 202) ; lots JSON-RPC acceptés |
| Débit | 120 requêtes par minute et par clé (au-delà : 429 `rate_limited`) |

### Claude Code

```bash
claude mcp add --transport http acra https://<votre-instance>/api/mcp --header "Authorization: Bearer $ACRA_MCP_KEY"
```

### Codex (CLI)

```bash
codex mcp add acra --url https://<votre-instance>/api/mcp --bearer-token-env-var ACRA_MCP_KEY
```

### Mistral Vibe et autres clients

Déclarer un serveur MCP en transport HTTP avec l'URL ci-dessus et l'en-tête `Authorization: Bearer <clé>`
(la syntaxe dépend du client). Les interfaces web (claude.ai, Le Chat) exigent une adresse HTTPS publique et,
en pratique, OAuth, qu'ACRA ne propose pas encore.

### Sans client MCP (test, script)

```bash
curl -s https://<votre-instance>/api/mcp \
  -H "Authorization: Bearer $ACRA_MCP_KEY" -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

```bash
curl -s https://<votre-instance>/api/mcp \
  -H "Authorization: Bearer $ACRA_MCP_KEY" -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"read_analyses","arguments":{"limite":10}}}'
```

Le résultat d'un outil est un texte JSON dans `result.content[0].text` ; une erreur métier est signalée par
`result.isError: true` (le code est dans le texte). Le script [`demo/scripts/mcp.sh`](demo/scripts/mcp.sh) est un
client minimal (`mcp.sh <outil> '<arguments JSON>'`).

## 4. Démarche attendue de l'assistant

`initialize` renvoie des **consignes** (identiques pour tous les clients) :

1. **Lire** avec les outils `read_*` ;
2. demander les **recommandations** d'ACRA (`recommend_*`) plutôt que d'inventer ;
3. **proposer** avec les outils `propose_*`, chaque proposition étant rattachée à un objet existant ;
4. reprendre les cotations de l'échelle de l'organisation, citer les références telles qu'ACRA les donne et
   marquer « à vérifier » ce qui ne vient pas d'ACRA.

## 5. Outils

Lecture et recommandation (annotés *lecture seule*) :

| Outil | Rôle |
|---|---|
| `read_referentiels` | Référentiels de l'organisation et leurs exigences (dont PSSI importées) |
| `read_taxonomie` | Taxonomie des risques |
| `read_sector_examples` | Exemples par secteur, sous-secteurs et patterns d'architecture de SI |
| `read_catalogue` | Catalogue sectoriel (processus, risques, contrôles types, KRI, missions d'audit) |
| `read_risk_posture` | Posture de risque de l'organisation |
| `read_analyses` | Analyses et projets 360 de l'organisation |
| `read_projet` | Contexte complet d'un projet 360 (échelle, risques R1…, plans) |
| `read_notification_regimes`, `read_incident_types`, `read_dora_fields` | Régimes de déclaration, incidents types, champs DORA |
| `read_resilience_tests` | Tests de résilience |
| `recommend_risks_scenarios` | Risques et scénarios recommandés (calculés par ACRA) |
| `recommend_control_plan` | Plan de contrôle recommandé |
| `analyse_import_preview` | Vérifie un paquet d'analyse sans rien écrire (volumes, liens orphelins) |

Propositions (annotées *non destructives* ; validées par un humain) :

| Outil | Ancre | Qui accepte |
|---|---|---|
| `propose_projet360` | organisation | rôle qui crée des analyses (analyste, administrateur) ; module Projets 360 actif |
| `propose_nouvelle_analyse` | organisation | rôle qui crée des analyses (analyste, administrateur) |
| `propose_pssi` | organisation | administrateur ; module conformité actif |
| `propose_risk`, `propose_measure` | analyse | éditeur de l'analyse (analyse non gelée) |
| `propose_analysis_import` | analyse | éditeur de l'analyse |
| `propose_plan_action` | risque, conformité, contrôle, audit, incident ou analyse | gouvernance (administrateur, RSSI, risk manager, direction métier) |
| `propose_conformite` | suivi de conformité | gouvernance de la conformité (dont conformité et DPO) |

### Nouvelle analyse : `propose_nouvelle_analyse`

Pour une analyse rédigée d'après une **expression de besoins** (`origine: "EXPRESSION_BESOINS"`, défaut) ou la
**reprise d'une analyse existante** hors outil (`"ANALYSE_HISTORIQUE"`). Vérifier d'abord le paquet avec
`analyse_import_preview`.

```json
{
  "origine": "ANALYSE_HISTORIQUE",
  "import": {
    "analysis": { "title": "Téléconsultation 2024 (reprise)", "methode": "ISO_27005", "secteur": "Santé / Médico-social" },
    "context": { "perimetre": "Plateforme de téléconsultation", "objectifs": "Reprendre l'historique" },
    "risks": [{ "externalId": "R1", "title": "Interruption de la visio", "gravity": 3, "likelihood": 2, "strategy": "REDUIRE" }],
    "measures": [{ "externalId": "M1", "title": "Chiffrement de bout en bout", "riskExternalId": "R1" }],
    "actions": [{ "externalId": "A1", "title": "Plan de continuité", "responsible": "DSI", "dueDate": "2026-12-31" }],
    "links": [{ "riskExternalId": "R1", "actionExternalId": "A1" }]
  }
}
```

Méthodes : `EBIOS_RM`, `ISO_27005`, `ISO_31000`, `NIST_800_30` (à défaut, la méthode par défaut de l'instance).
En EBIOS RM, le paquet peut porter le contenu des ateliers (`businessValues`, `supportAssets`, `fearedEvents`,
`riskSources`, `stakeholders`, `strategicScenarios`, `operationalScenarios`…). Gravité et vraisemblance : 1 à 4.
À l'acceptation, l'analyse est créée par l'import historique (une transaction), et le relecteur en est le créateur.

### PSSI : `propose_pssi`

La PSSI devient un **référentiel de mesures** de type PSSI (utilisable en conformité), un **document** Markdown de
la bibliothèque rattaché à ce référentiel, et un **suivi de conformité** (si `suivreConformite` n'est pas `false`
et si la conformité est portée par l'organisation).

```json
{
  "pssi": {
    "titre": "PSSI Mutuelle Horizon Santé", "version": "2.1", "date": "2026-06-30",
    "texte": "# PSSI…  (texte intégral en Markdown, facultatif)",
    "exigences": [
      { "ref": "GOV-01", "nom": "Désigner un RSSI rattaché à la direction générale", "categorie": "Gouvernance" },
      { "ref": "ACC-01", "nom": "Authentification multifacteur pour les accès distants", "categorie": "Contrôle d'accès", "type": "TECHNIQUE" }
    ]
  }
}
```

Code du référentiel : `code` s'il est fourni, sinon `PSSI-<version>` ; un code déjà utilisé est refusé
(`code_existant`) : fournir un autre code ou une autre version.

## 6. Erreurs

| HTTP | Code | Signification |
|---|---|---|
| 503 | `mcp_disabled` | Serveur MCP désactivé pour l'instance |
| 401 | `missing_or_invalid_authorization` | En-tête `Authorization: Bearer` absent ou mal formé |
| 401 | `invalid_api_key` / `api_key_revoked_or_expired` | Clé inconnue, révoquée ou expirée |
| 403 | `insufficient_scope` | La clé ne porte pas le droit `mcp` |
| 403 | `mcp_org_disabled` | MCP désactivé pour l'organisation de la clé |
| 429 | `rate_limited` | Plus de 120 requêtes par minute |
| 405 | `method_not_allowed` | Requête `GET` (utiliser `POST`) |

Erreurs d'outil (HTTP 200, `isError: true`) : `analyse_introuvable` / `ancre_introuvable` (objet absent **ou** hors de
l'organisation, sans distinction), `proposition_invalide: …` (le motif suit), `module_projets360_inactif`,
`module_conformite_inactif`, `code_existant: …`.

## 7. Traçabilité

Chaque appel d'outil est journalisé (`MCP_TOOL_INVOKED` : clé, outil, succès) et transmis au SIEM s'il est
configuré ; chaque décision sur une proposition l'est aussi (`MCP_PROPOSAL_REVIEWED`). La page *Activité MCP*
agrège ces traces par clé.
