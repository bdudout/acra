# Analyse comparative — ISO/IEC 27005:2022 & ISO 31000:2018 vs ACRA (parcours à saisie directe)

> Cadrage produit en réponse au retour terrain sur les parcours ISO 27005 / ISO 31000.
> Objectif : dire **ce qu'une analyse de risque conforme à la norme doit contenir**,
> **ce qu'ACRA propose aujourd'hui**, l'**écart**, et un **plan priorisé**.
> Constat transversal : **le modèle de données porte déjà l'essentiel** (risque brut
> ET résiduel, mesures liables au risque, vulnérabilités) — **les manques sont dans le
> parcours/UI des méthodes directes**, qui n'exposent qu'un tableau plat `nom + G×V +
> stratégie`. EBIOS RM, lui, expose déjà mesures (atelier 5), résiduel et plans d'action.

---

## Partie A — ISO/IEC 27005:2022

### A.1 Ce que la norme attend (processus de gestion des risques SI)

1. **Établissement du contexte** — périmètre, parties prenantes, **critères de risque**
   (critères d'évaluation ET critères d'**acceptation**).
2. **Appréciation des risques** :
   - **Identification** — approche *par événement* ou *par actif*. En approche par
     actif : **actifs → menaces → mesures existantes → vulnérabilités → conséquences**,
     et **propriétaire du risque**.
   - **Analyse** — estimer **conséquence** et **vraisemblance** en **tenant compte des
     mesures existantes** → **niveau de risque** (le risque « actuel »).
   - **Évaluation** — **comparer aux critères**, **prioriser** les risques à traiter,
     décider lesquels sont **acceptables**.
3. **Traitement des risques** — choisir les options (réduire par des **mesures/contrôles**,
   accepter, éviter, partager), bâtir un **plan de traitement**, déterminer le **risque
   résiduel**, le faire **approuver par le propriétaire du risque**.
4. **Communication & consultation**, **surveillance & revue** (continu).

Notions clés : **menace + vulnérabilité**, **mesures existantes**, **risque inhérent
(brut) vs résiduel**, **critère d'acceptation**, **propriétaire du risque**, **plan de
traitement**.

### A.2 Ce qu'ACRA propose aujourd'hui (méthode ISO_27005)

- Parcours par phases (contexte / identification / analyse / évaluation / traitement).
- **Contexte éditable** (périmètre + objectifs/critères) — livré (#171).
- **Phases différenciées** (identification = liste, analyse = cotation G×V, traitement =
  stratégie) — livré (#172).
- **Évaluation** = priorisation par niveau + décision acceptable/à traiter — livré (#173),
  mais **lecture seule et sans seuil configurable**.
- Registre de risques : `nom`, `gravité`, `vraisemblance`, `niveau`, `stratégie`.

### A.3 Écarts (gap analysis)

| Attendu ISO 27005 | ACRA aujourd'hui | Écart | Le modèle le porte déjà ? |
|---|---|---|---|
| Menaces **+ vulnérabilités** rattachées au risque | Absent (juste un intitulé) | 🔴 majeur | `Risque.vulnerabilitesResiduelles`, `evenementRedouteRef` existent (non exposés) |
| **Mesures de sécurité** (contrôles) rattachées au risque | Absent en direct (existe en EBIOS A5) | 🔴 majeur | `Mesure.risqueId` existe |
| **Risque brut / actuel (avec mesures) / résiduel (après plan)** | Un seul niveau (G×V) | 🔴 majeur | `niveauRisque` + `graviteResiduelle/vraisemblanceResiduelle/niveauResiduel` existent |
| **Plans d'action** de traitement | Un simple libellé de stratégie | 🔴 majeur | `PlanAction` + lien polymorphe `RISQUE` existent |
| **Évaluation** réellement actionnable (seuil d'acceptation, décision tracée) | Lecture seule, seuil = paliers figés | 🟠 moyen | seuil à ajouter |
| **Propriétaire du risque** | Absent | 🟠 moyen | à ajouter (champ) |
| Exemples de risques par actif/menace | Suggestions sectorielles (bien), mais estampillées EBIOS et par secteur seulement | 🟠 moyen | packs existants |

---

## Partie B — ISO 31000:2018

### B.1 Ce que la norme attend (lignes directrices génériques)

Processus : **communication & consultation** · **périmètre, contexte & critères** ·
**appréciation** (identification / analyse / évaluation) · **traitement** · **surveillance
& revue** · **enregistrement & reporting**.
Le **traitement** est **itératif** : choisir les options, planifier & mettre en œuvre,
**apprécier le risque résiduel**, décider s'il est acceptable, sinon re-traiter.
ISO 31000 est **générique** (pas de taxonomie actifs/menaces imposée) — mais **traitement
+ risque résiduel** sont bien au cœur.

### B.2 Ce qu'ACRA propose aujourd'hui (méthode ISO_31000)

- **Écran unique** d'appréciation « simple » : `nom + G×V + stratégie`.
- Suggestions sectorielles cliquables (pré-remplissent le formulaire).
- Panneau de conseils (repliable).

### B.3 Écarts

| Attendu ISO 31000 | ACRA aujourd'hui | Écart |
|---|---|---|
| **Traitement** (mesures) + **plans d'action** | Libellé de stratégie seul | 🔴 majeur |
| **Risque résiduel** (après traitement) | Un seul niveau | 🔴 majeur |
| **Critères** de risque + décision d'acceptation | Contexte non exposé en ISO 31000 (écran unique) | 🟠 moyen |
| **Liste de risques par défaut large** (pas seulement sectorielle) | Uniquement suggestions par secteur | 🟠 moyen |
| Surveillance & revue (réévaluation périodique) | Absent | 🟢 mineur (v2) |

> ISO 31000 « simple » **peut rester léger**, mais « léger » ≠ « sans traitement ni
> résiduel » : au minimum **mesures + plan d'action + niveau résiduel** sont nécessaires
> pour que l'écran ait une valeur de gestion (sinon c'est un simple tableur de cotation).

---

## Partie C — Points transversaux (retour terrain)

1. **Clic sur un exemple → ajout AUTOMATIQUE au registre** (aujourd'hui : pré-remplit le
   formulaire). Décision : ajouter directement (avec undo/suppression facile) plutôt que
   pré-remplir. 🔴
2. **Exemples valables pour TOUS les secteurs** (rançongiciel sur l'AD, fuite de données
   via un tiers, phishing → compromission, indisponibilité d'un SaaS critique, perte de
   sauvegardes…). Aujourd'hui : suggestions **uniquement** sectorielles → écran vide si
   secteur non couvert. 🔴 Ajouter un **socle de risques transverses**.
3. **Liens « Réduire » (origine d'un plan d'action / registre) qui mènent à l'accueil de
   l'analyse** au lieu de la bonne phase/objet, pour les analyses ISO. 🔴 Bug de
   navigation (résolution d'URL d'ancre par méthode).
4. **Risques proposés/imposés selon la QUALIFICATION** : dans la config du questionnaire
   de qualification, permettre d'attacher des risques **proposés** (suggérés) ou
   **imposés** (injectés) selon les réponses (ex. « traite des données de santé » →
   impose « fuite de données de santé (RGPD art. 9) »). 🟠 Nouveau moteur de règles.

---

## Partie D — Plan priorisé (proposé)

> Principe directeur : **exposer dans les parcours directs la machinerie qu'ACRA a déjà**
> (mesures liées au risque, résiduel, plans d'action), plutôt que de réinventer.

**Lot 1 — Traitement & niveaux de risque (cœur, le plus fort impact)**
- Registre direct : colonnes **brut → actuel (mesures existantes) → résiduel (plans)**.
- **Mesures de sécurité** rattachables au risque (réutilise `Mesure.risqueId`, `efficacite`).
- **Plans d'action** rattachables au risque (réutilise `PlanAction` + lien `RISQUE`).
- Recalcul du **niveau résiduel** (réutilise `niveauResiduel`).
- Corrige #3 (liens origine → bonne cible) et rend l'écran **Évaluation** actionnable (#4).

**Lot 2 — Identification enrichie (ISO 27005)**
- **Menaces + vulnérabilités** par risque (phase identification/analyse).
- **Socle de risques transverses** (tous secteurs) + clic = **ajout auto** (#1, #2).
- Suggestions débarrassées des libellés EBIOS (déjà fait #4-léger), enrichies menace/vuln.

**Lot 3 — Qualification → risques**
- Config questionnaire : attacher des **risques proposés/imposés** par réponse.
- À la création/qualification : injecter/suggérer ces risques dans le registre.

**Lot 4 — Finitions**
- Seuil d'acceptation **configurable** (échelle ADMIN) pour l'Évaluation.
- Propriétaire du risque ; surveillance/revue (réévaluation).

Chaque lot = incréments TDD, EBIOS RM inchangé, i18n 5 langues.
