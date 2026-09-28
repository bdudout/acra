# Audit des méthodes à saisie directe — ISO/IEC 27005:2022, ISO 31000:2018, NIST SP 800-30 Rev. 1

*Mis à jour le 2026-09-28 (remplace le comparatif du 2026-09-22). Audit sur le
code (`lib/methodes.ts`, `components/PhasedRiskWorkshop.tsx`, `RisquesDirects.tsx`,
`lib/risque-priorisation.ts`, routes `api/analyses/[id]/risques/**`, export) et
recette navigateur. Références : ISO/IEC 27005:2022 (clauses 6 à 10), ISO 31000:2018
(clause 6), NIST SP 800-30 Rev. 1 (chapitre 3, annexes D à I). Les renvois ISO 27005
plus fins que la clause sont indicatifs : à confirmer sur le texte publié (AFNOR/ISO).*

Légende : ✅ conforme · 🟠 partiel · 🔴 absent.

## 1. Ce qui a été comblé depuis le 2026-09-22

Vulnérabilités (ISO 27005), mesures existantes (`Mesure`, brut → actuel), plans
d'action (`PlanAction` via `RISQUE_ANALYSE`), trois niveaux brut / actuel / résiduel,
suggestions transverses + sectorielles, ajout direct avec annulation, risques
proposés/imposés par la qualification, tableau responsive (`max-w-6xl`, cartes sur
mobile), gardes d'accès / gel / isolation testés.

## 2. Écarts transverses (les trois méthodes)

| # | Attendu | ACRA aujourd'hui | Écart | Normes |
|---|---|---|---|---|
| T1 | **Critères de risque de l'organisation** (échelles, seuils, matrice) appliqués à l'appréciation | EBIOS utilise `getEffectiveScaleConfig` (4 ou 5 niveaux, seuils, matrice qualitative). Les méthodes directes restent **figées en 1–4** (`echelle = [1,2,3,4]`, `clampInt(…,1,4)`) avec les paliers **codés en dur** (`getRiskTier`). Une org configurée en 5 niveaux voit deux échelles différentes selon la méthode. | 🔴 | 27005 §6.4, 7.3.4 · 31000 §6.3.4 · NIST annexes G, H, I (échelles à 5 niveaux) |
| T2 | **Évaluation** : comparer le risque analysé aux critères d'**acceptation** et prioriser | Phase « Évaluation » : décision *à traiter / acceptable* sur le niveau **brut** (et non actuel, qui intègre les mesures existantes), seuil = paliers figés ; l'**appétit au risque** configuré (`appetitRisque`, par catégorie) n'est pas utilisé. | 🟠 | 27005 §7.4.1–7.4.2 · 31000 §6.4.4 |
| T3 | **Propriétaire du risque** (identifié, approuve le traitement et le résiduel) | Aucun champ propriétaire sur `Risque` d'analyse (le registre d'org `RiskItem` en a un). L'acceptation du résiduel existe mais au niveau de l'analyse entière (Direction métier). | 🔴 | 27005 §7.2.2 et §8 (approbation du plan et du résiduel par les propriétaires) · ISO/IEC 27001:2022 §6.1.2 c) 2), §6.1.3 f) |
| T4 | **Rapport / information documentée** | Bouton d'export (PDF/CSV) seulement dans l'atelier 5 EBIOS ; le modèle PDF est structuré en ateliers EBIOS et ignore `analyse.methode` → pas de rapport ISO 27005 / 31000 / NIST (registre 3 niveaux, mesures, plans, vulnérabilités). | 🔴 | 27005 clause 10 (information documentée) · 31000 §6.7 · NIST étape 3 |
| T5 | **Surveillance et revue** | Aucune date de revue, fréquence ni déclencheur sur le risque d'analyse ; la phase NIST « Maintain » réaffiche simplement le registre complet. | 🔴 | 27005 clause 10 (surveillance et revue) · 31000 §6.6 · NIST étape 4 |
| T6 | **Catégorie de risque** | `Risque.taxonomieCode` existe en base mais n'est ni saisi ni affiché en saisie directe (la qualification en a pourtant une : cyber / projet / opérationnel / fraude). | 🟠 | 31000 §6.3.4 · appétit par catégorie |
| T7 | **Options de traitement** dans les termes de la norme | Libellés EBIOS : Réduire / Accepter / Transférer / Refuser / **Surveiller**. ISO 27005 : *modification, maintien, refus, partage* ; « surveiller » n'est pas une option de traitement (c'est un processus). | 🟠 | 27005 §8 (options de traitement) · 31000 §6.5.2 |

## 3. ISO/IEC 27005:2022

| Clause | Attendu | ACRA | Écart |
|---|---|---|---|
| 6 | Contexte : périmètre, exigences des parties intéressées, **critères d'appréciation et d'acceptation** | Phase « Établissement du contexte » : périmètre + objectifs en texte libre ; les critères ne sont pas structurés ni reliés à l'évaluation (T1, T2) | 🟠 |
| 7.2.1 | Identifier les risques — approche par **événements** ou par **biens** (actifs, menaces, vulnérabilités) | Intitulé + vulnérabilités (✅) ; ni **bien support / actif**, ni **menace / source de risque** rattachés | 🟠 |
| 7.2.2 | Identifier les **propriétaires** | Absent (T3) | 🔴 |
| 7.3 | Conséquences (critères DICT touchés) et vraisemblance | Cotation G×V ✅ ; **conséquences** non décrites (pas de critères de sécurité impactés) | 🟠 |
| 7.3.4 | Niveau de risque selon les critères | 3 niveaux ✅ mais échelle figée (T1) | 🟠 |
| 7.4 | Évaluation + priorisation | T2 | 🟠 |
| 8 (options) | Options de traitement | ✅ (libellés, T7) | 🟠 |
| 8 (mesures) | Mesures nécessaires, **comparaison avec l'annexe A d'ISO/IEC 27001**, déclaration d'applicabilité | Mesures libres, **sans référence à un contrôle** (l'EBIOS A5 a `referentiel`/`codeRef`, pas le panneau direct) ; le module conformité/SoA existe mais n'est pas relié | 🟠 |
| 8 (plan) | Plan de traitement (actions, responsables, échéances) | `PlanAction` ✅ | ✅ |
| 8 | Approbation du plan et acceptation du **résiduel par le propriétaire** | Acceptation globale de l'analyse ✅ ; pas par propriétaire / par risque (T3) | 🟠 |
| 10 | Processus SMSI associés : communication, information documentée, surveillance et revue | T4, T5 | 🔴 |

Terminologie : intitulés de phases proches de la norme ; la version AFNOR ajoute
« des risques **de sécurité de l'information** » (§7.2 à §8).

## 4. ISO 31000:2018

| Clause | Attendu | ACRA | Écart |
|---|---|---|---|
| 6.2 | Communication et consultation | Collaborateurs de l'analyse ✅ ; pas de trace des parties consultées | 🟠 |
| 6.3 | **Domaine d'application, contexte, critères** | **Aucune phase de contexte** : ISO 31000 est un écran unique (`METHOD_STEPS.ISO_31000` = une phase « appréciation »), alors qu'ISO 27005 et NIST en ont une | 🔴 |
| 6.4.2–6.4.4 | Identification, analyse, évaluation | Tout sur un écran (mode *full*) ✅ ; **évaluation** (décision d'acceptation) absente de cet écran | 🟠 |
| 6.5 | Traitement : options, **plans de traitement** | Mesures + plans ✅ | ✅ |
| 6.6 | Suivi et revue | T5 | 🔴 |
| 6.7 | Enregistrement et compte rendu | T4 | 🔴 |
| — | Risques non cyber (stratégiques, opérationnels, financiers…) ; effets **positifs** (opportunités) | Suggestions et libellés orientés cyber ; pas de catégorie (T6) ; pas d'opportunités (hors périmètre produit, à décider) | 🟠 |

## 5. NIST SP 800-30 Rev. 1

| Élément | Attendu | ACRA | Écart |
|---|---|---|---|
| Étape 1 | *Prepare for Assessment* : finalité, périmètre, hypothèses et contraintes, sources d'information, **modèle de risque et approche analytique** | Phase « Prepare » : périmètre + objectifs en texte libre ; hypothèses/contraintes, modèle de risque, approche (qualitative / semi-quantitative) non structurés | 🟠 |
| Tâche 2-1 | **Sources de menace** : adversariales (capacité, intention, ciblage) / non adversariales (portée des effets) — annexe D | Absent | 🔴 |
| Tâche 2-2 | **Événements de menace** — annexe E | Intitulé libre | 🟠 |
| Tâche 2-3 | **Vulnérabilités et conditions prédisposantes** (sévérité) — annexe F | Vulnérabilités activées **seulement pour ISO 27005** (`withVulnerabilites = methode === 'ISO_27005'`) → absentes en NIST, alors que le guide de la phase « Conduct » demande de les identifier | 🔴 |
| Tâche 2-4 | Vraisemblance = initiation/occurrence × impact défavorable — annexe G | Une seule vraisemblance 1–4 | 🟠 |
| Tâche 2-5 | Impact — annexe H | Gravité 1–4 | 🟠 |
| Tâche 2-6 | **Risque sur 5 niveaux** (*Very Low … Very High*) — annexe I | Paliers 4 niveaux (T1) | 🔴 |
| Étape 3 | *Communicate Results* | Phase en lecture seule ✅ ; pas de livrable exportable (T4) | 🟠 |
| Étape 4 | *Maintain Assessment* : surveiller les facteurs de risque, mettre à jour | Duplique le registre complet ; pas de suivi (T5) | 🟠 |

Terminologie : les intitulés officiels sont *Prepare for Assessment*, *Conduct
Assessment*, *Communicate Results*, *Maintain Assessment* (ACRA : versions courtes).
NIST n'a pas de traduction officielle : garder l'intitulé anglais en référence.

## 6. Sécurité et robustesse (rappel)

Accès (404 hors périmètre), édition (403), gel après acceptation, isolation d'org,
recalcul serveur des niveaux, liens `RISQUE_ANALYSE` avec `ref` : couverts par des
tests de route. Aucun nouveau constat de sécurité propre à ces méthodes.

## 7. Plan proposé (par valeur / effort)

| Lot | Contenu | Effort | Normes couvertes |
|---|---|---|---|
| **P1** | **Échelles et critères de l'org** dans les méthodes directes (4/5 niveaux, seuils, libellés) — lib pure partagée avec l'EBIOS ; NIST en 5 niveaux par défaut | M | T1 · NIST 2-6 |
| **P2** | **Évaluation** sur le niveau actuel + **seuil d'acceptation / appétit** de l'org ; décision affichée aussi en ISO 31000 | S | T2 |
| **P3** | **Propriétaire du risque** (membre de l'org) + filtre ; acceptation du résiduel par risque (optionnelle) | M | T3 · 27005 §7.2.2 et §8 |
| **P4** | **Rapport par méthode** (PDF/Excel : contexte, registre 3 niveaux, vulnérabilités, mesures, plans, décisions) + bouton d'export dans le parcours | M-L | T4 |
| **P5** | ISO 31000 : phases **Contexte** et **Évaluation** ; catégorie de risque (T6) | S | 31000 §6.3, 6.4.4 |
| **P6** | NIST : vulnérabilités activées, **sources de menace** (adversariale / non), hypothèses et modèle de risque en préparation | M | NIST 2-1, 2-3, étape 1 |
| **P7** | Surveillance : date de prochaine revue + phase « Maintain » réellement de suivi | S-M | T5 |
| **P8** | Terminologie normative (options de traitement ISO, intitulés NIST officiels) ; mesures reliées aux contrôles ISO 27001 annexe A / SoA | S / M | T7 · 27005 §8 (mesures, annexe A, SoA) |
