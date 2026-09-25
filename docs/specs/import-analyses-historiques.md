# Définition de besoin — Import d'analyses de risques historiques

## 1. Contexte et constat

Les clients arrivent avec un stock historique hétérogène : fichiers Excel métiers,
exports GRC, CSV, parfois plusieurs feuilles et des liens implicites entre risques,
mesures et plans d'action. L'import doit accélérer la reprise **sans transformer une
table source ambiguë en analyse approuvée sans contrôle humain**.

### Capacité actuelle (à ne pas confondre avec le besoin cible)

- `/analyses` accepte un export **JSON/CSV ACRA** et un classeur `.xlsx` historique
  avec une prévisualisation et un mapping explicite.
- Le JSON est surtout le format d'export ACRA ; le CSV attend des sections ACRA
  fixes et ne réconcilie pas les identifiants historiques.
- `POST /api/v1/import` importe des `RiskItem` et des contrôles GRC, pas une
  analyse EBIOS RM / ISO 27005 / ISO 31000 complète.
- L'API v2 et l'outil MCP `propose_analysis_import` sont disponibles ; le MCP ne
  dépose qu'une proposition à valider humainement.

Le bouton actuel doit donc être renommé à terme « Importer un export ACRA » ; il ne
doit pas laisser entendre qu'un classeur client quelconque est compatible.

## 2. Objectif produit

Permettre à un administrateur ou analyste autorisé de reprendre un portefeuille
historique en conservant la provenance, les références sources et les liens :

```
source Excel / CSV / API / MCP
       → prévisualisation et correspondances
       → corrections humaines
       → import traçable dans l'organisation active
       → analyses, risques, mesures et plans d'action liés
```

L'import crée par défaut des analyses `EN_COURS`, jamais soumises, approuvées ou
acceptées. Il ne remplace aucune donnée existante sans une action explicite.

## 3. Parcours proposés

| Canal | Utilisateur cible | Usage | Décision |
|---|---|---|---|
| Interface `/analyses/importer` | Analyste, Risk Manager, ADMIN | 1 à quelques fichiers historiques | **Priorité 1** |
| API publique v2 | ETL, GRC, intégrateur | Volumes récurrents et industrialisés | Priorité 2 |
| MCP | Consultant assisté par IA, sous contrôle humain | Exploration, mapping et préparation | Priorité 3 |

### 3.1 Interface web — parcours recommandé

1. Choisir le fichier : `.xlsx` pour l'historique ou export JSON/CSV ACRA.
2. Choisir la cible : organisation active et méthode (conserver la méthode source,
   ou convertir vers ISO 27005 / ISO 31000 / NIST 800-30 / EBIOS RM).
3. Afficher les feuilles détectées et proposer trois modes :
   - **modèle ACRA** : modèle Excel fourni, reconnaissance automatique ;
   - **mapping assisté** : l'utilisateur associe les colonnes ;
   - **import minimal** : uniquement registre de risques, les champs inconnus sont
     conservés dans le rapport d'import, non inventés.
4. Prévisualiser les lignes et les liens avant écriture : créations, mises à jour
   proposées, rejets, valeurs hors échelle, références introuvables.
5. Corriger dans la prévisualisation ou télécharger le rapport d'erreurs CSV.
6. Confirmer l'import ; afficher un résultat rejouable par lot.

Le fichier ne doit jamais être envoyé directement dans les tables métier sans cette
étape de prévisualisation. Pour un gros classeur, l'import devient un job asynchrone
avec progression, annulation avant validation et rapport téléchargeable.

### 3.2 API

Conserver `/api/v1/import` pour les risques et contrôles GRC existants. Ajouter une
API versionnée dédiée, par exemple `POST /api/v2/analysis-imports` :

- création d'un **lot** (`DRAFT → VALIDATED → IMPORTING → COMPLETED | FAILED`) ;
- chargement JSON normalisé ou URL d'un fichier préalablement déposée ;
- endpoint de prévisualisation et de validation ;
- résultats par ligne, clés sources et identifiants ACRA créés ;
- idempotence obligatoire via `externalSystem + externalId` ou clé d'idempotence.

Une clé API `write` reste bornée à son organisation. Aucun `organizationId` envoyé
par le client ne doit décider de la cible.

#### 3.2.1 Contrat API v2 attendu

Les intégrateurs utilisent un paquet JSON canonique : `analysis`, `risks`,
`vulnerabilities`, `measures`, `actions` et `links`. Chaque objet peut porter une
`externalId`; les liens utilisent exclusivement ces identifiants externes, jamais
un identifiant ACRA deviné. La référence `analysisExternalId` permet de découper
un fichier source en plusieurs analyses.

| Endpoint | Scope | Effet | Réponse attendue |
|---|---|---|---|
| `POST /api/v2/analysis-imports/preview` | `write` | Aucun | volumes, avertissements et liens orphelins |
| `POST /api/v2/analysis-imports` | `write` | Crée le lot | `201`, ou `200` lors d'un rejeu identique |
| `GET /api/v2/analysis-imports/{importId}` | `read` | Aucun | reçu du lot dans l'organisation de la clé |
| `GET /api/v2/analysis-imports/{importId}?format=csv` | `read` | Aucun | rapport téléchargeable |

`idempotencyKey` est obligatoire, stable côté intégrateur et unique par
organisation. Même clé + même payload = rejeu sûr; même clé + payload différent
= `409 IDEMPOTENCY_KEY_REUSED`. Les erreurs de contrat renvoient `400`, une clé
invalide `401`, un scope insuffisant `403` et une ressource hors périmètre `404`
sans divulguer son organisation.
Deux requêtes identiques concurrentes sont aussi rejouables : la transaction
perdante renvoie le reçu de la transaction gagnante, sans créer une seconde
analyse.

#### 3.2.2 Exploitation API

- L'import est atomique **par analyse**. Un fichier multi-analyses peut donc
  produire plusieurs reçus; un échec est explicitement rattaché à son analyse.
- Les clients doivent appeler `preview` avant `POST`, conserver l'`importId` et
  archiver le rapport CSV avec leur run d'intégration.
- Un import ne soumet jamais une analyse au workflow : statut initial
  `EN_COURS`, mesures par défaut `REALISE`, plans par défaut `A_FAIRE`.
- Les cotations hors échelle, les références absentes et les champs ambiguës sont
  des avertissements ou erreurs explicites; le serveur ne les interprète pas.

### 3.3 MCP

Le serveur MCP doit fournir des outils séparés :

1. `analyse_import_preview` : lit le paquet, propose un mapping et renvoie les
   anomalies ; aucune écriture.
2. `propose_analysis_import` : crée une proposition versionnée contenant le
   mapping et le résumé des créations/modifications.
3. L'application web applique uniquement une proposition approuvée par un humain
   autorisé ; aucun outil MCP ne contourne cette étape.

MCP ne doit jamais appliquer silencieusement un import ni accéder à une autre
organisation que celle du contexte de la clé/session.

#### 3.3.1 Contrat MCP et validation humaine

| Outil | Écriture | Prérequis | Résultat |
|---|---|---|---|
| `analyse_import_preview` | Non | paquet canonique | compteurs et anomalies de références |
| `propose_analysis_import` | Proposition seulement | `analyseId` dans l'organisation de la clé | proposition `EN_ATTENTE` ancrée à l'analyse |
| File `/mcp-propositions` | Oui, après décision humaine | droit d'édition de l'analyse | accepte ou rejette, avec piste d'audit |

Le MCP ne reçoit ni ne choisit d'`organizationId`. Son contexte vient de la clé
MCP authentifiée. `propose_analysis_import` doit être précédé d'un aperçu et ne
peut pas remplacer une analyse existante : à l'acceptation, il ajoute uniquement
les objets validés à l'analyse ancre. Chaque décision est journalisée avec
l'émetteur, le relecteur, l'ancre et l'identifiant de l'objet appliqué.

## 4. Modèle de fichier et liens

Le modèle Excel ACRA contient au minimum les feuilles suivantes :

| Feuille | Clé source obligatoire | Champs essentiels |
|---|---|---|
| `Analyses` | `analyse_external_id` | nom, méthode, périmètre, organisation source |
| `Risques` | `risk_external_id` | analyse_external_id, intitulé, gravité, vraisemblance, niveau résiduel, stratégie |
| `Vulnérabilités` | couple `risk_external_id` + libellé | vulnérabilité identifiée, description ; rattachée au risque de la même référence |
| `Mesures` | `measure_external_id` | intitulé, statut, responsable, échéance |
| `Plans_actions` | `action_external_id` | intitulé, statut, priorité, responsable, échéance |
| `Liens_risques_actions` | couple de clés | risk_external_id, action_external_id, type de lien |

Les identifiants de ligne sont indispensables : un libellé de risque ne constitue
pas une clé fiable. Quand une source ne possède pas de clé, le mode assisté permet
de générer une clé source stable et signale les doublons à confirmer.
Une même `externalId` ne peut apparaître deux fois dans une même collection ; le
lot est refusé au lieu de rattacher silencieusement les objets à la dernière ligne.
Un même lien risque–plan déclaré à la fois dans la ligne du plan et dans la feuille
de liens est conservé une seule fois.

Les échelles source doivent être déclarées (ex. 1–5) puis mappées explicitement
vers l'échelle ACRA de l'organisation. Les cellules vides, textes tels que
« N/A », et cotations incompatibles sont signalés — jamais remplacés silencieusement.

## 5. Règles de sécurité, conformité et exploitation

- RBAC : création de lot par ANALYSTE+ ; validation/application par RISK_MANAGER
  ou ADMIN selon la politique de l'organisation ; aucun droit supplémentaire via
  un fichier.
- Isolation : organisation active/clé API uniquement, vérifiée côté serveur.
- Traçabilité : auteur, date, empreinte du fichier, système source, mapping,
  résultat, erreurs et références créées dans le journal d'audit.
- Limites : taille de fichier, nombre de feuilles/lignes, antivirus ou validation
  du type MIME, protection contre les formules Excel et les entrées CSV malveillantes.
- Reprise : import atomique par analyse lorsque possible ; sinon lot partiel
  explicitement indiqué, avec relance des seules lignes en erreur.
- Conservation : les fichiers et rapports suivent la politique documentaire de
  l'organisation ; aucun fichier sensible ne part vers un service externe.

## 6. Critères d'acceptation

1. Un classeur modèle avec 2 analyses, 10 risques et 8 plans est prévisualisé sans
   écrire en base.
2. Les 8 liens risques ↔ plans sont visibles avant confirmation et conservés après
   import.
3. Une cotation 1–5 ne peut être importée sans mapping de l'échelle ; le rapport
   précise chaque ligne bloquante.
4. Une analyse importée est `EN_COURS`, attribuée à l'organisation active et porte
   sa provenance/source.
5. Un même lot rejoué avec la même clé d'idempotence ne duplique rien.
6. Une clé API d'une autre organisation et un outil MCP hors contexte sont refusés.
7. Le résultat affiche créés, ignorés, erreurs et un export de rapport.
8. L'aperçu API v2 ne crée aucun objet métier et renvoie les références orphelines
   avant l'appel d'import.
9. Un rejeu API avec la même clé et le même contenu est sans effet supplémentaire ;
   avec un contenu différent, il échoue explicitement en `409`.
10. Une proposition MCP ne crée aucun risque, mesure ou plan tant qu'un utilisateur
    autorisé ne l'a pas acceptée dans `/mcp-propositions`.
11. Un reçu ou un rapport d'import API est invisible depuis une autre organisation,
    y compris avec un identifiant de lot valide.

## 7. Découpage recommandé

- **Lot 1 — livré** : assistant web `.xlsx`, prévisualisation, mapping éditable,
  import transactionnel des risques, mesures et plans liés.
- **Lot 2 — livré** : mapping sauvegardable par organisation, multi-analyses et
  rapport téléchargeable; l'exécution asynchrone reste une évolution de capacité
  au-delà des limites synchrones documentées.
- **Lot 3 — livré** : `POST /api/v2/analysis-imports`, clé d'idempotence obligatoire
  et portée stricte de la clé API.
- **Lot 4 — livré** : `propose_analysis_import` MCP, acceptation humaine obligatoire
  dans la file de propositions.
