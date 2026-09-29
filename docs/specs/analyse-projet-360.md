# Analyse « Projet 360 » — risque opérationnel d'un projet

**Statut :** en cours de réalisation · **Date :** 2026-09-29 · **Méthode :** `PROJET_360`

## 1. Objectif

Couvrir en une seule analyse **tout le risque opérationnel d'un projet** — cyber,
IT (architecture, maintenance), projet, métier, fraude, externalisation — avec une
démarche **ISO 31000:2018** (établir le contexte → identifier → analyser → évaluer →
traiter), guidée par un **questionnaire de qualification 360** qui propose les
risques pertinents. Les risques cyber peuvent être saisis directement ou **importés
d'une analyse cyber existante** (EBIOS RM, ISO/IEC 27005, NIST SP 800-30).

## 2. Parcours (méthode `PROJET_360`, saisie directe)

| # | Phase | Contenu |
|---|---|---|
| 1 | Contexte | périmètre, objectifs, parties prenantes, critères (écran de contexte existant) |
| 2 | Qualification 360 | questionnaire par domaine ; risques proposés / imposés ; import cyber |
| 3 | Appréciation | registre des risques (brut → actuel → résiduel) avec **domaine** par risque |
| 4 | Évaluation | tableau de bord 360 par domaine (lecture seule) |
| 5 | Traitement | mesures et plans d'action par risque |

## 3. Domaines

`CYBER` · `IT` (architecture, maintenance, obsolescence) · `PROJECT` (délais, budget,
dépendances, pilotage) · `BUSINESS` (processus métier, continuité, conduite du
changement) · `FRAUD` (interne / externe) · `OUTSOURCING` (prestataires, cloud,
sous-traitance). Stockés dans `Risque.domaine` (null = non classé, méthodes existantes
inchangées). Les codes reprennent ceux des catégories de qualification.

## 4. Questionnaire 360

Questions fermées par domaine (oui/non ou choix), stockées avec la qualification de
l'analyse (`Analyse.qualification`, identifiants préfixés `p360.`). Chaque question
peut déclencher un **risque proposé** (catalogue traduit ×5, gravité/vraisemblance par
défaut, stratégie, domaine) via le moteur existant des risques de qualification :
idempotent par règle, risques imposés non décochables. Les règles 360 s'ajoutent aux
règles de l'organisation pour cette méthode uniquement.

## 5. Import des risques cyber

Depuis une analyse **cyber** (méthode `cyber` du registre) de la même organisation,
accessible à l'utilisateur : sélection des risques, copie dans l'analyse 360 avec
`domaine = CYBER` et traçabilité (`sourceRisqueId`, `sourceAnalyseId`), idempotent
par risque source. Les cotations (brut, actuel, résiduel) sont reprises ; l'échelle
de l'organisation s'applique (même organisation). Gel et droits d'édition respectés.

## 6. Validation par le RSSI **et** le Risk Manager

Pour `PROJET_360`, l'approbation exige **deux avis favorables distincts** : un RSSI et
un RISK_MANAGER (personnes différentes, jamais l'auteur). Le premier avis est
enregistré (`Analyse.approbations`), l'analyse reste « soumise » ; au second, elle
passe « approuvée ». Un rejet par l'un ou l'autre la renvoie à l'auteur et efface les
avis. Un ADMIN conserve la dérogation historique (organisations mono-administrateur),
journalisée. Les autres méthodes gardent l'approbation simple.

## 7. Tableau de bord 360

Par domaine : nombre de risques, niveau maximal et moyen (brut / résiduel), risques au-
dessus de l'appétit, part traitée, trois risques principaux ; carte de chaleur par
domaine ; progression du questionnaire par domaine.

## 8. Hors périmètre (lot suivant)

Quantification, agrégation multi-projets, synchronisation continue avec l'analyse
cyber source (l'import est une copie tracée, ré-importable).
