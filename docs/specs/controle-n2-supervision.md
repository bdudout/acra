# Spec — Contrôle du contrôle (N2→N1) + indépendance

Renforcement du contrôle permanent 2ᵉ niveau (bancaire, arrêté ACPR 3 nov. 2014).

## Contrôle du contrôle (N2→N1)
Un contrôle **N2** peut **superviser** un ou plusieurs contrôles **N1** : le N2
vérifie la bonne exécution et l'efficacité des contrôles de 1ʳᵉ ligne.

- `Controle.superviseIds` (Json `string[]`) : identifiants des contrôles N1
  supervisés. Lien logique (pas de FK) — tolérant aux suppressions.
- Formulaire (niveau N2 uniquement) : liste à cocher des contrôles N1, avec
  leur efficacité observée en aperçu.
- Détail du contrôle : rappel des N1 supervisés + leur taux de conformité.

## Indépendance de l'exécutant (séparation des fonctions)
- `ControleExecution.independant` (Boolean?) : l'exécutant atteste être
  indépendant de la 1ʳᵉ ligne. Case à cocher à l'exécution (contrôle N2).
- Affiché en badge « Indépendant » dans l'historique des exécutions.

## Pur & testé (`lib/controle.ts`)
- `cleanControleInput` nettoie `superviseIds` (dédup, chaînes non vides).
- `cleanExecutionInput` normalise `independant` (booléen ou null).

## Migration
`20260823140000_controle_supervision_independance` :
`Controle.superviseIds JSONB DEFAULT '[]'`, `ControleExecution.independant BOOLEAN`.
Rétrocompatible.

## Vérifié (runtime)
Création N1 + N2 (superviseIds=[N1]) ; exécution N2 avec independant=true ;
relecture : superviseIds et independant persistés (201). Formulaire N2 affiche la
liste des N1 à superviser.
