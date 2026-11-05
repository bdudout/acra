# Stratégie cyber / IT / résilience et plans d'action catégorisés — cadrage

Demande utilisateur (2026-11-05) : « pouvoir créer, agréger ou construire une stratégie cyber / IT / résilience dans
ACRA, et que les différents plans d'action soient présentés de manière cohérente et catégorisée ; il faudra des
interfaces MCP sur ce sujet et les autres ».

## Décisions

| Sujet | Décision | Source |
|---|---|---|
| Validation | Le **cadre** (axes, objectifs) est validé ; on peut **rattacher des éléments au fil de l'eau** (actions issues d'audits, contrôles, analyses de risques, incidents, conformité, résilience…) même après validation. | Utilisateur, 2026-11-05 |
| Figeage | **Option configurable par organisation** `strategieCadreFige` (défaut : figé) : figé → modifier le cadre validé exige une nouvelle version ; non figé → modification autorisée avec justification. | Utilisateur, 2026-11-05 |
| Traçabilité | Dans tous les cas : **instantané de la version validée** (qui, quand) et **historique des ajouts / modifications après validation avec justification obligatoire** ; écart calculé entre cadre validé et cadre courant. | Utilisateur, 2026-11-05 |
| Structure | Plusieurs stratégies par organisation, typées `CYBER` / `IT` / `RESILIENCE` / `INTEGREE`, chacune avec une période ; vue consolidée des stratégies actives. | Recommandation retenue par défaut (non contredite) |
| Catégorisation des plans | Catégorie **automatique** (famille de risque TIC du risque lié, sinon origine) + **rattachement manuel** à un ou plusieurs axes. | Idem |
| MCP | Outils de **lecture** sur tous les domaines qui n'en ont pas ; **propositions** (validées par un humain) pour stratégie, axes, rattachements. MCP reste OFF par défaut. | Idem |
| Export | La stratégie et sa feuille de route s'exportent en **PPTX** (pptxgenjs, comme `projet-pptx.ts`) et en **PDF** (`@react-pdf/renderer`), avec les identifiants internes. | Utilisateur, 2026-11-05 |
| Identifiants internes | `referenceInterne` (facultatif) + `identifiantsExternes` (liste `{systeme, valeur}`, ≤ 10) sur stratégie, axe, objectif, pour faire le lien avec les outils comptables / budgétaires ; modifiables même cadre figé, mais tracés dans l'historique. | Utilisateur, 2026-11-05 |
| Module | Modèle de configuration à 3 niveaux : `strategieActive` (défaut : activé), toggle org ADMIN, politique d'instance SUPER_ADMIN. | CLAUDE.md |

## Modèle (lot S1)

- `Strategie` : organizationId, titre, description, type, periodeDebut, periodeFin, statut `BROUILLON | VALIDEE |
  ARCHIVEE`, version (entier), versionPrecedenteId, valideePar / valideeLe.
- `AxeStrategique` : strategieId, ordre, titre, description, referenceRef (facultatif, ex. fonction d'un référentiel).
- `ObjectifStrategique` : axeId, titre, indicateur (texte), cible, echeance, kriId (facultatif).
- `RattachementStrategique` : organizationId, axeId, sourceType (mêmes sources que le store d'actions
  `ACTION_SOURCES` : MESURE, RISK_ACTION, CONFORMITE, AUDIT, CONTROLE, INCIDENT, PLAN_ACTION), sourceId, provenance
  `MANUEL | ASSISTANT | MCP`, ajoutePar, createdAt ; unique (axeId, sourceType, sourceId).
- `StrategieEvolution` : historique après validation (type d'évolution, cible, avant / après, justification, auteur).
  Instantané du cadre validé conservé sur la version.
- Règles : BROUILLON modifiable sans justification ; VALIDEE → rattachements autorisés avec justification ; cadre :
  409 si `strategieCadreFige`, sinon modifiable avec justification (400 `justification_requise`) ; « nouvelle
  version » copie axes, objectifs et rattachements, l'ancienne passe ARCHIVEE.
- Droits : rédiger (ADMIN, RSSI, RISK_MANAGER) ; valider (ADMIN, RSSI, DIRECTION_METIER) ; rattacher (gouvernance +
  CONFORMITE, CONTROLEUR, DPO) ; lecture (rôles à lecture globale du dispositif). AUDITEUR : lecture seule.

## Lots

| Lot | Contenu |
|---|---|
| S1a | Modèle Prisma + migration additive, lib pure (transitions, figeage, versionnage), routes API org-scopées, droits, toggle 3 niveaux, i18n ×5 |
| S1b | Écrans : liste `/strategie`, création, détail (axes, objectifs, rattachements), validation, nouvelle version |
| S2 | Catégorie automatique des actions + facettes « famille » / « axe » dans `/actions` ; rattacher depuis une action |
| S3 | Agréger / construire : assistant qui propose axes et rattachements depuis l'existant ; modèles d'axes de référentiels officiels (libellés officiels vérifiés) |
| S4 | Feuille de route (axe × trimestre), avancement par axe, section « Stratégie » du dossier comité et du pilotage ; **export PPTX et PDF** de la stratégie et de la feuille de route (identifiants internes inclus) |
| S5a | MCP lecture des domaines existants (plans, registre, conformité, contrôles, audits, incidents, registre TIC, résilience) |
| S5b | MCP lecture stratégie ; S6 : `propose_strategie`, `propose_axe`, `propose_rattachement` (ancres ORGANISATION / STRATEGIE) |
