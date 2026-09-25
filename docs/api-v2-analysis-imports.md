# API v2 — import d'analyses historiques

`POST /api/v2/analysis-imports` reçoit une clé API ACRA `write`. L'organisation
cible est toujours celle de la clé : le corps ne contient pas d'`organizationId`.

Chaque appel doit contenir une `idempotencyKey` stable et unique par organisation.
Rejouer le même corps renvoie `200` et le résultat d'origine ; réutiliser la clé
avec un corps différent renvoie `409 IDEMPOTENCY_KEY_REUSED`.
Deux appels identiques concurrents restent également sûrs : l'appel qui perd la
course sur la contrainte d'unicité retourne le reçu créé par le premier, sans
créer une seconde analyse.

Avant l'écriture, `POST /api/v2/analysis-imports/preview` accepte le même corps,
ne crée aucune donnée et renvoie les compteurs ainsi que les références de risque
ou d'action non résolues. Le serveur MCP expose la même vérification sans écriture
via l'outil `analyse_import_preview` ; `propose_analysis_import` reste soumis à
l'acceptation humaine.

```json
{
  "idempotencyKey": "migration-grc-2026-0001",
  "analysis": { "title": "PRA 2026", "methode": "ISO_31000" },
  "risks": [{ "externalId": "R-1", "title": "Indisponibilité", "gravity": 3, "likelihood": 2 }],
  "measures": [{ "title": "Sauvegardes vérifiées", "riskExternalId": "R-1", "status": "REALISE" }],
  "actions": [{ "externalId": "A-1", "title": "Tester le PRA", "riskExternalId": "R-1" }]
}
```

La réponse contient `importId`, `analyseId`, `nom`, les compteurs créés et `replayed`.
`GET /api/v2/analysis-imports/{importId}` restitue ce reçu uniquement à une clé
de la même organisation. Les
analyses sont toujours créées `EN_COURS`; les mesures sans statut sont `REALISE`
et les plans d'action sans statut sont `A_FAIRE`.

## Cycle d'intégration

| Étape | Appel | Écriture | Attendu |
|---|---|---|---|
| Valider | `POST /preview` | Non | Corriger les erreurs de schéma et les références orphelines. |
| Importer | `POST /analysis-imports` | Oui | Conserver l'`importId` et la clé d'idempotence. |
| Contrôler | `GET /{importId}` | Non | Obtenir le reçu, les compteurs et l'analyse créée. |
| Archiver | `GET /{importId}?format=csv` | Non | Télécharger le rapport de lot. |

Le paquet canonique peut contenir `risks`, `vulnerabilities`, `measures`,
`actions` et `links`. Les relations utilisent `riskExternalId` et
`actionExternalId`; aucun identifiant interne ACRA n'est requis ni accepté comme
référence métier. Un classeur multi-analyses doit être découpé côté intégrateur en
un paquet et une clé d'idempotence par analyse.

Un `externalId` non vide est unique dans chaque collection. Les doublons de
risques, vulnérabilités, mesures ou actions sont refusés avec
`duplicate_external_id:<collection>:<id>` : ACRA ne choisit jamais arbitrairement
la dernière ligne. Les liens action–risque identiques, qu'ils soient implicites
dans une action ou déclarés dans `links`, ne sont créés qu'une fois.

## Erreurs et sécurité

- `400 Import invalide` : JSON ou contrat invalide ; le détail explique le champ
  rejeté et aucune donnée n'est créée.
- `401` / `403` : clé API absente, invalide ou sans le scope nécessaire (`write`
  pour aperçu/import, `read` pour le reçu).
- `404 import_not_found` : reçu inexistant ou hors organisation de la clé, sans
  révéler l'organisation propriétaire.
- `409 IDEMPOTENCY_KEY_REUSED` : même clé avec un contenu différent. L'intégrateur
  doit produire une nouvelle clé, pas forcer le rejeu.

## Équivalent MCP

`analyse_import_preview` réalise la même vérification sans écriture. Ensuite,
`propose_analysis_import` dépose un paquet sur une analyse existante de
l'organisation portée par la clé MCP. Il n'existe pas d'outil MCP d'application
directe : un utilisateur habilité accepte ou rejette la proposition dans
`/mcp-propositions`, ce qui laisse une trace d'audit.
