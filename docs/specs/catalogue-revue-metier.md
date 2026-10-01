# Revue métier du catalogue de suggestions

Statut : **première passe faite le 1er octobre 2026 (catalogue 1.6)** · revue par des experts métier : **à faire**, aucun secteur n'est validé.

Le catalogue propose des processus, des risques (événements-types), des contrôles-types, des KRI candidats, des missions d'audit types et des plans de test de résilience modèles (cf. [socles-sectoriels-tiers-canonique-backlog.md](socles-sectoriels-tiers-canonique-backlog.md) § 8.9). Ce sont des **suggestions à qualifier** : rien n'est créé sans sélection, rien n'est coté, mesuré ou déclaré réalisé. Avant de les présenter comme un contenu de référence, chaque secteur doit être relu par une personne du métier.

## 1. Grille de revue

[`catalogue-revue-grille.csv`](catalogue-revue-grille.csv) contient une ligne par élément (197 en 1.6) :

- la clé stable, la version d'ajout, le secteur, la nature et le rattachement (processus parent ou processus concerné) ;
- le libellé dans les 5 langues, les attributs suggérés (périodicité, type de contrôle, unité, sens de dégradation, type de test) et les points de revue des missions d'audit ;
- deux colonnes vides, **Avis** (OK / À revoir / Retirer) et **Commentaire**, pour le relecteur.

Le fichier s'ouvre directement dans un tableur (séparateur « ; », UTF-8). Il est **généré** : après toute modification du catalogue, lancer `npm run catalogue:review` ; un test échoue si la grille n'est pas à jour. Les avis des relecteurs se reportent ensuite dans le code (`src/lib/sector-suggestions.ts`, `sector-packs.ts`, `catalogue-resilience.ts`), jamais dans la grille.

## 2. Critères de relecture

| Nature | Ce que le relecteur vérifie |
|---|---|
| Processus | Le vocabulaire est celui du secteur ; le rattachement au macro-processus est juste ; aucun processus essentiel ne manque au premier niveau. |
| Risque (événement-type) | La situation est plausible et formulée comme un événement (« un paiement est détourné… »), pas comme une cause ni une conséquence ; elle se rattache au bon processus. |
| Contrôle-type | L'intitulé décrit une vérification réalisable ; la périodicité est usuelle ; le type (préventif / détectif / correctif) correspond à ce que fait le contrôle, pas à la mesure qu'il vérifie. |
| KRI candidat | L'indicateur est mesurable avec des données dont l'organisation dispose ; l'unité et le sens de dégradation sont justes. Aucun seuil n'est proposé : il relève de l'appétence. |
| Mission d'audit | Les points de revue sont vérifiables par un auditeur et ne préjugent d'aucun constat. |
| Plan de test de résilience | Le type de test correspond à la liste de l'art. 25 § 1 DORA ; l'intitulé décrit un test réaliste pour l'entité. Le TLPT n'est jamais proposé. |

Termes réglementaires : un libellé qui reprend un terme normatif (« provisions techniques », « fonction critique ou importante », types de tests DORA) doit être vérifié sur le texte officiel, dans sa version citée.

## 3. Première passe (1er octobre 2026)

Relecture faite par l'équipe de développement, sans expertise sectorielle revendiquée. Elle corrige ce qui était **manifestement** incohérent et liste le reste pour les experts.

### 3.1 Corrections appliquées

Les clés sont inchangées : une organisation qui a déjà importé ces éléments conserve ses données ; seules les importations futures sont concernées.

| Clé | Correction | Raison |
|---|---|---|
| `core.control.payment-validation` | Type `PREVENTIF` → `DETECTIF`. | Un contrôle **par échantillon, a posteriori**, détecte ; c'est la double validation elle-même qui prévient. |
| `core.control.leavers` | « Retrait des accès… » → « Vérification du retrait des accès des collaborateurs partis » (×5). | L'intitulé décrivait l'action de gestion, pas le contrôle. |
| `assurance.process.brokers` | Parent `core.process.buy` → `core.process.deliver`. | Courtiers et distributeurs sont des canaux de distribution, pas des fournisseurs. |
| `finance.risk.account-takeover` | « …est pris en main frauduleusement » → « …est usurpé par un fraudeur » (FR). | Formulation française maladroite. |
| `sante.process.lab` | « Réaliser les examens et résultats » → « Réaliser les examens et rendre les résultats » (FR). | Phrase incomplète. |
| `finance.control.reconciliation`, `finance.kri.reconciliation-breaks` (nouveaux en 1.5) | Rattachés à `finance.process.payments`. | Cohérence avec le risque `finance.risk.reconciliation`, déjà rattaché à ce processus. |

### 3.2 Points ouverts pour les experts

| Secteur / clé | Question |
|---|---|
| Tous les secteurs | 4 processus de premier niveau par secteur, sans sous-processus. Faut-il un second niveau (par exemple « Exécuter les paiements » → virements, prélèvements, paiements par carte) ? |
| `assurance.risk.reserve` | Rattaché à « Administrer les contrats en cours » faute de processus actuariel. Ajouter un processus « Évaluer les engagements (actuariat) » ? Vérifier le terme « provisions techniques » (Solvabilité II). |
| `core.kri.security-incidents` | Un nombre d'incidents **déclarés** qui « se dégrade à la hausse » peut décourager les déclarations. Préférer « incidents détectés tardivement » ou un délai de détection ? |
| `commerce.process.stock` | Rangé sous les achats ; le relier plutôt à la livraison (logistique) ? |
| `sante.process.records` | Rangé sous « Exploiter les systèmes et les données » ; le métier le voit-il comme un processus de soins ? |
| FINANCE, ASSURANCE | Les plans de test de résilience sectoriels (bout en bout des paiements, charge des canaux, continuité des sinistres, échanges avec les distributeurs) sont-ils les plus représentatifs ? |
| PUBLIC, SANTE, SAAS, INDUSTRIE, COMMERCE, SERVICES | Pas de plan de test sectoriel : le programme de tests DORA vise les entités financières ; le socle transversal suffit-il pour les autres ? |
| Tous | Traductions DE / ES / IT : relecture par un locuteur natif du métier. |

## 4. Suivi de la validation

| Périmètre | Relecteur | Date | Avis |
|---|---|---|---|
| Socle transversal | — | — | à relire |
| Finance | — | — | à relire |
| Assurance | — | — | à relire |
| Santé | — | — | à relire |
| Secteur public | — | — | à relire |
| Logiciels et SaaS | — | — | à relire |
| Industrie | — | — | à relire |
| Commerce | — | — | à relire |
| Services professionnels | — | — | à relire |
