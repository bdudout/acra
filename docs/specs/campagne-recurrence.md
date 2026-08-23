# Spec — Campagnes de contrôle récurrentes

Demande utilisateur : pouvoir planifier automatiquement une campagne périodique.

## Principe
Une campagne porte une **récurrence** : `NONE | HEBDOMADAIRE | MENSUEL |
TRIMESTRIEL | SEMESTRIEL | ANNUEL`. À la **clôture** d'une campagne récurrente, la
suivante est **planifiée automatiquement** : même périmètre (`controleIds`), même
niveau, même récurrence, **statut PLANIFIEE**, fenêtre décalée d'une période
(durée préservée). NONE = campagne ponctuelle (comportement historique).

## Fonction pure (`lib/campagne-controle.ts`, testée)
`prochaineFenetreCampagne(recurrence, dateDebut, dateFin)` → `{dateDebut, dateFin}`
ou `null` :
- `NONE`, ou fenêtre incomplète (une des deux dates absente) → `null` ;
- `HEBDOMADAIRE` → +7 jours sur début et fin ;
- sinon → +N mois (borne au dernier jour du mois cible).

`cleanCampagneControleInput` accepte `recurrence` (valeur inconnue → `NONE`).

## Serveur
`PATCH /api/controles/campagnes/[id]` : au **passage** en `CLOTUREE` (et seulement
au passage — idempotent si déjà clôturée) d'une campagne à récurrence ≠ NONE,
crée la campagne suivante via `prochaineFenetreCampagne`. Réponse enrichie de
`suivanteId`. `POST` accepte aussi `recurrence`.

## Migration
`20260823130000_campagne_recurrence` : `recurrence TEXT NOT NULL DEFAULT 'NONE'`.
Rétrocompatible (campagnes existantes → NONE).

## UI (`CampagnesControleManager`)
- Sélecteur de récurrence au formulaire + libellé d'aide.
- Statut modifiable **en ligne** dans le tableau (2ᵉ ligne) → rend la **clôture**
  possible, ce qui déclenche la planification automatique.
- Indicateur « ↻ Trimestrielle » sur les campagnes récurrentes.

## Vérifié (runtime)
Campagne trimestrielle 01→07 janv. clôturée ⇒ suivante PLANIFIEE 01→07 avril
(+3 mois). Re-clôture d'une campagne déjà close ⇒ pas de doublon (`suivanteId`
null). Sélecteur + libellés OK en UI.
