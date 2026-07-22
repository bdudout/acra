# Spec — Gestion des dérogations (acceptation temporaire de non-conformité)

## 1. Objectif

Permettre d'**accepter temporairement** une non-conformité au socle de sécurité, de façon
**justifiée, compensée, bornée dans le temps et surveillée**. C'est une forme de traitement
du risque (« acceptation temporaire ») distincte :

- de la **mesure** (plan d'action) qui vise à *fermer* l'écart ;
- de l'**acceptation des risques résiduels** (#3, globale à l'analyse, sans échéance) ;
- de la stratégie **ACCEPTER** (définitive).

Une dérogation **expirée redevient une non-conformité active** et ré-alimente le catalogue de
vulnérabilités. Le **registre des dérogations** est un livrable de conformité (ISO 27001,
registre d'exceptions DORA, dossier d'homologation ANSSI).

## 2. Rattachement (décision #1)

Une dérogation est rattachée à **l'un** de :
- **CONTROLE** — un contrôle (`ref`) d'un référentiel (`referentiel`), depuis l'analyse du socle (Atelier 1) ;
- **RISQUE** — un risque (`risqueId`), depuis le traitement du risque (Atelier 5, stratégie « acceptation temporaire ») ;
- **SOCLE** — le socle de conformité (référentiel) d'une **organisation** (dérogation « globale »). *(Phase ultérieure — décision #2 : d'abord le niveau analyse.)*

Une dérogation d'analyse pourra être **promue** au niveau socle/organisation ultérieurement.

## 3. Portée initiale (décision #2)

**Niveau ANALYSE d'abord.** `analyseId` toujours renseigné en Phase 1/2. Le niveau
organisation (rattachement à l'entité `Conformite`) est traité plus tard, en même temps que
le Palier 2 conformité.

## 4. Workflow d'approbation (décision #3)

```
                          (RSSI défavorable) ─────────────► REJETEE
                                 │
DEMANDEE ──(avis RSSI favorable)─┤
 (porteur)                       │
                    ┌────────────┴─── sans double regard ──► VALIDATION_METIER
                    │                                              │
       (RSSI demande│double regard)                     (métier valide)│(métier refuse)
                    ▼                                              ▼        │
              DOUBLE_REGARD ──(2e RSSI favorable)──► VALIDATION_METIER    ACTIVE   └► REJETEE
                    │                                              
             (2e RSSI défavorable) ─────────────────────────► REJETEE
```

Rôles :
- **porteur / demandeur** = celui qui peut éditer l'analyse (ANALYSTE propriétaire, ADMIN) → crée la demande ;
- **RSSI** = donne un **avis** sur la dérogation ET les mesures compensatoires ; peut demander un **double regard** ;
- **RSSI groupe** (double regard) = un **autre** RSSI (quatre-yeux, cf. #120). *(Phase 1 : tout RSSI ≠ premier ; multi-org plus tard : RSSI du parent.)* ;
- **métier** = rôle **DIRECTION_METIER** (cohérent avec l'acceptation des risques résiduels #3) → **valide** → la dérogation devient `ACTIVE`.

États terminaux : `REJETEE`, `CLOTUREE`, `REVOQUEE`.
États runtime **calculés** (non stockés) pour une dérogation `ACTIVE` : `ACTIVE` → `EXPIRE_BIENTOT`
(dans la fenêtre d'alerte) → `EXPIREE` (au-delà de `dateFin`). Calcul à la lecture (pas de job pour flipper l'état, comme la démo).

## 5. Durée & prolongation & clôture (décision #4)

- **Durée par défaut configurable** (admin) : `derogationDureeDefautJours` (défaut **180 j / 6 mois**). `dateFin = dateDebut + durée` à la validation métier.
- **Prolongation** : ré-ouvre un cycle de revue (retour `DEMANDEE` avec `prolongationDemandee`), motif obligatoire ; à la re-validation métier, `dateFin` mise à jour et l'historique `prolongations[]` complété.
- **Clôture avec preuves** : upload de **preuves** (data URL en base, comme les logos ; cap taille) pour passer en `CLOTUREE` (la non-conformité est résolue). Commentaire de clôture.
- **Révocation** : RSSI ou métier peut révoquer une dérogation active (`REVOQUEE`, motif).

## 6. Alertes (décision #5)

- **Fenêtre configurable** (admin) : `derogationAlerteJours` (défaut **30 j** avant `dateFin`).
- **Alerte individuelle** : à l'entrée dans la fenêtre → e-mail au **porteur** ET au **RSSI** (anti-doublon via `alerteeLe`).
- **Digest mensuel** : cron mensuel récapitulant les dérogations **expirées** et **prochainement expirées** (aux RSSI + porteurs concernés).
- Réutilise la mécanique de préavis démo (`shouldWarn`/`needsWarning`/`warnedAt` → ici `alerteeLe`) et le pattern cron `CRON_SECRET`.

## 7. État « dérogé » sur le socle

Pas de nouveau `ConformiteStatut` brut (on garde `conforme/partiel/non_conforme/na`, auditables).
L'état **« dérogé » est dérivé à la lecture** : un contrôle est *dérogé* s'il a une dérogation
`ACTIVE` non expirée. Impacts :
- il **sort** du catalogue de vulnérabilités tant que la dérogation est active ;
- il **y ré-entre** automatiquement à l'expiration ;
- le score de conformité expose un bucket `dérogé` : « X% conforme · Y% dérogé (temporaire) · Z% non-conforme » *(Phase 3)*.

## 8. Modèle de données

`Derogation` (voir schema.prisma) — champs clés : `organizationId`, `analyseId`, `portee`
(`CONTROLE|RISQUE|SOCLE`), `referentiel?`, `ref?`, `risqueId?`, `intitule`, `motif`,
`mesuresCompensatoires`, `statut`, `demandeurId`, avis RSSI (`avisRssiPar/Le/Favorable/Commentaire`),
double regard (`doubleRegard*`), validation (`valideePar/Le`), période (`dateDebut/dateFin`),
`prolongations` (Json), `prolongationDemandee`, `preuves` (Json data URLs),
clôture/révocation/rejet, `alerteeLe`.

`OrganizationConfig` : `derogationsActive` (toggle), `derogationDureeDefautJours` (180),
`derogationAlerteJours` (30).

`AuditAction` : `DEROGATION_REQUESTED`, `DEROGATION_RSSI_OPINION`, `DEROGATION_DOUBLE_REVIEW`,
`DEROGATION_VALIDATED`, `DEROGATION_REJECTED`, `DEROGATION_EXTENDED`, `DEROGATION_CLOSED`,
`DEROGATION_REVOKED`, `DEROGATION_EXPIRING`, `DEROGATION_EXPIRED`.

## 9. Phasage de développement

- **Phase 1 (fondation)** : modèle Prisma + migration + champs `OrganizationConfig` + **`lib/derogation.ts` pur** (machine à états, calcul d'état effectif/expiration, alertes, garde-fous RBAC/workflow) **+ tests**. *(Le présent incrément.)*
- **Phase 2 (workflow serveur + UI)** : routes CRUD + transitions (demander/avis/double-regard/valider/prolonger/clôturer/révoquer), panneau dérogations dans Atelier 1 (socle) et Atelier 5 (traitement), badge + registre `/derogations`, toggle `/configuration`, i18n 5 langues.
- **Phase 3 (alertes + conformité)** : cron alerte 30 j + digest mensuel (e-mail), bucket « dérogé » dans le score de conformité, roll-up dashboard, upload de preuves, promotion socle/organisation.

## 10. Décisions par défaut retenues (modifiables)

- Prolongation = nouveau cycle de revue complet (RSSI + métier), motif obligatoire.
- Double regard = un RSSI **différent** du premier (quatre-yeux, réutilise la logique #120).
- Clôture = par le porteur ou le RSSI, avec au moins une preuve.
- Preuves = data URL en base, cap **1 Mo / preuve**, **5 preuves** max.
- Pas de cap dur de durée totale, mais chaque prolongation est tracée et re-validée.
