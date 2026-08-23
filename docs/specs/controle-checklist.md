# Spec — Checklist (points à vérifier) sur un contrôle

Demande utilisateur : pouvoir définir des « questionnaires QCM » pour les contrôles.
Niveau retenu : **checklist simple** (liste de points cochés OK/KO/N-A, résultat déduit).

## Modèle
- `Controle.checklist` : `string[]` de libellés (points à vérifier). Vide ⇒ pas de
  checklist → l'exécution saisit un **résultat unique** (comportement historique,
  rétrocompatible).
- `ControleExecution.checklistResultats` : `[{label, statut: OK|KO|NA, commentaire?}]`.
  Le `label` est dénormalisé (copié) → l'historique reste lisible même si la
  checklist du contrôle change ensuite.

## Déduction du résultat (pure, testée)
`deduireResultatChecklist(resultats)` :
- checklist vide → `null` (résultat saisi manuellement) ;
- au moins un **KO** → `ANOMALIE` ;
- aucun point évalué (que des NA) → `NON_APPLICABLE` ;
- sinon → `CONFORME`.
- `anomaliesTrouvees` = nombre de KO ; `tailleTestee` = OK + KO (hors NA).

Côté serveur (`POST /api/controles/[id]/executions`) : quand `checklistResultats`
est fourni, le résultat global est **déduit** et prime sur toute valeur envoyée.
Si l'anomalie n'a pas de constat global, un constat est **synthétisé** à partir des
points KO (traçabilité auditeur). La boucle « anomalie → plan d'action » (si le
contrôle est rattaché à un risque) reste inchangée.

## Fonctions pures (`lib/controle.ts`)
- `CHECKLIST_STATUTS = ['OK','KO','NA']`
- `cleanChecklist(v): string[]` — trim, non vides, dédupliqués, plafond 50.
- `cleanChecklistResultats(v): ChecklistResultat[]` — label + statut valides,
  commentaire trimé ou null.
- `deduireResultatChecklist(resultats): {resultat, anomaliesTrouvees, tailleTestee} | null`.

## UI (`ControlesManager`)
- Formulaire de définition : éditeur de points (ajouter / éditer / retirer).
- Formulaire d'exécution : si le contrôle a une checklist, chaque point se cote
  OK/KO/N-A (+ commentaire), avec un **aperçu du résultat déduit** en direct ;
  sinon le formulaire classique (résultat/échantillon/anomalies) est conservé.

## Migration
`20260823120000_controle_checklist` : deux colonnes `JSONB NOT NULL DEFAULT '[]'`.
Rétrocompatible (contrôles et exécutions existants → checklist vide).
