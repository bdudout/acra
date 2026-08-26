# Spec — Suivis des 4 niveaux de contrôle + 4ᵉ niveau externe

Demande : suivi spécifique des **constats régulateur / plan d'action autorité de
contrôle**, en distinguant le **4ᵉ niveau** qui peut être une **autorité de contrôle
(régulateur)** OU un **auditeur externe** (commissaire aux comptes / audit tiers) ;
et **mettre en place des suivis pour les 4 niveaux de contrôle**.

## Modèle des 4 niveaux
| Niveau | Nature | Source dans ACRA |
|-------|--------|------------------|
| **N1** | Contrôle permanent — 1ʳᵉ ligne (opérationnel) | `Controle.niveau = N1` + ses exécutions |
| **N2** | Contrôle permanent — 2ᵉ ligne (fonction de contrôle) | `Controle.niveau = N2` |
| **N3** | Contrôle périodique — audit interne (3ᵉ ligne) | `AuditConstat.source = AUDIT_INTERNE` |
| **N4** | Contrôle externe | `AuditConstat.source = REGULATEUR` (autorité) **ou** `AUDITEUR_EXTERNE` (audit tiers) |

## Chantier A — 4ᵉ niveau : source « auditeur externe » + suivi externe
- `CONSTAT_SOURCES` étendu : `AUDIT_INTERNE | REGULATEUR | AUDITEUR_EXTERNE`.
- `SOURCE_NIVEAU` / `niveauControle(source)` (pur) : mappe la source au niveau
  (AUDIT_INTERNE→N3 ; REGULATEUR, AUDITEUR_EXTERNE→N4).
- Suivi externe : `filtrerControleExterne` (REGULATEUR ∪ AUDITEUR_EXTERNE) ; la vue
  « suivi régulateur » devient « suivi autorité de contrôle & audit externe »,
  couvrant les deux sources, avec plan d'action (responsable, échéance, statut,
  retard) et export.
- UI : le formulaire de constat propose la source « auditeur externe » ; filtre par
  source. i18n 5 langues.
- Sans migration (`source` est une colonne texte ; nouvelle valeur d'énumération).

## Chantier B — Suivi consolidé des 4 niveaux
- Fonction pure `synthetiserQuatreNiveaux({ n1, n2, n3, n4 })` → 4 lignes, chacune
  avec : activité (contrôles/missions), anomalies/constats **ouverts**, **en retard**.
- Section « Suivi des 4 niveaux de contrôle » dans `/pilotage` (cockpit GRC) :
  agrège N1/N2 (contrôle permanent par niveau), N3 (constats audit interne), N4
  (constats externes), par sous-arbre d'organisation.

## Tests
- Unitaires : `niveauControle`, `filtrerControleExterne`, synthèse externe,
  `synthetiserQuatreNiveaux` (nominal + limites).
- Runtime : création d'un constat AUDITEUR_EXTERNE, présence dans le suivi externe,
  section 4 niveaux du cockpit.
