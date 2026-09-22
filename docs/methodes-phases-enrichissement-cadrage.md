# Enrichissement des écrans de phase + refactor DRY — Cadrage

> Statut : **cadrage validé** (décisions arrêtées avec le porteur). Implémentation
> décomposée en 3 PR (R1 → R3). Fait suite au chantier « méthodes d'analyse »
> (`docs/methodes-analyse-cadrage.md`) : EBIOS RM + ISO 31000 + ISO/IEC 27005:2022 +
> NIST SP 800‑30 sont livrés ; ce cadrage couvre l'**enrichissement des parcours
> phasés** et leur **mutualisation**.

## 1. Objectif

Deux besoins, sur les méthodes à parcours phasé (ISO 27005, NIST 800‑30, et ISO 31000
ramené au même moule) :

- **A1 — Explications de phase, masquables** : chaque phase explique *ce qu'on y fait*
  et *comment*, dans un panneau **repliable** (préférence mémorisée), comme les conseils
  des ateliers EBIOS.
- **A2 — Exemples contextuels cliquables** : proposer, selon le **secteur** de l'analyse,
  des exemples de risques **cliquables** qui pré‑remplissent le registre — exactement
  l'ergonomie des ateliers EBIOS (`withSectorExemples` + tri par pertinence).

Et un besoin technique transverse :

- **DRY** : les composants `Iso27005Workshop` et `Nist80030Workshop` sont ~95 %
  identiques. On les remplace par **un composant générique piloté par le registre**.

## 2. Décisions arrêtées

| Sujet | Décision |
|---|---|
| **Source des exemples (A2)** | Packs sectoriels existants `evenementsRedoutes` + `scenariosStrategiques` (`lib/exemples-sectoriels.ts`). Zéro nouvelle donnée à produire. |
| **Contenu pré‑rempli (A2)** | **Intitulé + gravité/vraisemblance suggérées**, modifiables. La gravité vient du pack si présente, sinon **défaut neutre 2** ; vraisemblance = **défaut neutre 2**. Pas de faux niveau « précis ». |
| **Périmètre DRY** | Un `PhasedRiskWorkshop` générique pour **ISO 27005 + NIST + ISO 31000** (ISO 31000 = descripteur à **1 phase** `appreciation`). **EBIOS RM reste à part** (ateliers dédiés trop spécifiques). |
| **Explications (A1)** | Contenu pédagogique « maison » sur la *démarche* (autorisé) ; on ne recopie pas les libellés normatifs ISO/NIST. i18n par méthode × phase. Repli mémorisé (localStorage), motif `AtelierGuidancePanel`. |

## 3. Architecture cible

### 3.1 Registre enrichi (`lib/methodes.ts`, pur)

`MethodStep` gagne un **type** et des clés optionnelles :

```ts
interface MethodStep {
  num: number
  key: string
  labelKey: string
  type: 'context' | 'appreciation' | 'review' | 'note'
  guidanceKey?: string        // clé i18n du panneau de conseils (A1)
  exemplesCategory?: string   // catégorie de pack sectoriel pour les exemples (A2)
}
```

- **context** : périmètre/objectifs de l'analyse (+ conseils).
- **appreciation** : registre `RisquesDirects` **éditable** (+ conseils + exemples).
- **review** : `RisquesDirects` **lecture seule** (priorisation) (+ conseils).
- **note** : conseils seuls (ex. Communicate / Maintain sans saisie).

Chaque méthode phasée déclare ses phases **en données**. Ajouter une méthode phasée
(ou FAIR plus tard) = une entrée de registre, plus de composant.

### 3.2 Composant générique `PhasedRiskWorkshop`

Lit `methodSteps(methode)`, rend les onglets, et par `type` : contexte / RisquesDirects
(éditable ou lecture seule) / note. **A1 et A2 y sont implémentés une seule fois** →
toutes les méthodes phasées en bénéficient. Remplace `Iso27005Workshop`,
`Nist80030Workshop` et la branche ISO 31000 de la page d'ateliers.

### 3.3 Exemples cliquables (A2)

Réutilise la machinerie EBIOS : `withSectorExemples(pack, secteur, categorie, locale,
sousSecteur)` + `rankExemples(...)` pour trier par pertinence. Rendu = liste cliquable ;
un clic appelle `POST /api/analyses/[id]/risques` (API de saisie directe déjà en place)
avec `{ nom: <intitulé>, gravite: <pack|2>, vraisemblance: 2 }`.

## 4. Phasage (3 PR)

1. **R1 — Refactor DRY, sans changement fonctionnel** : `MethodStep` enrichi +
   `PhasedRiskWorkshop` + migration ISO 27005 / NIST / ISO 31000 + suppression des 3
   composants/branches dédiés. Tests de non‑régression (mêmes écrans qu'aujourd'hui).
2. **R2 — Explications de phase (A1)** : panneaux de conseils repliables (mémorisés) +
   i18n par méthode × phase.
3. **R3 — Exemples contextuels cliquables (A2)** : liste sectorielle triée + clic →
   création de risque (intitulé + G/V suggérées).

**R1 d'abord** dérisque : le générique en place, R2/R3 se branchent une fois pour
toutes les méthodes.

## 5. Points de vigilance

- **Non‑régression R1** : ISO 27005 / NIST / ISO 31000 doivent rendre exactement les
  mêmes écrans après migration (couvert par les tests composants existants + registre).
- **Suggestions honnêtes (A2)** : ne pas laisser croire à un niveau calculé — G/V
  suggérées = valeurs par défaut clairement modifiables.
- **Normatif** : conseils = reformulation pédagogique de la démarche, pas de copie des
  libellés ISO/NIST ; libellés de phases déjà en place (à confirmer AFNOR pour ISO).
- **EBIOS RM** : hors périmètre — conserve ses ateliers et son panneau de conseils.

---

Voir aussi : `docs/methodes-analyse-cadrage.md`, `src/lib/methodes.ts` (registre),
`src/components/RisquesDirects.tsx`, `src/components/AtelierGuidancePanel.tsx`,
`src/lib/exemples-sectoriels.ts` / `exemples-context.ts` (exemples + tri).
