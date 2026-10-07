# Expression de besoins — organismes de protection sociale (assurance maladie obligatoire et régimes de base)

Date : 2026-10-03 · Statut : **à valider** (§ 9) · Rédigée pour un organisme national de protection sociale organisé
en réseau (tête de réseau, caisses locales, service du contrôle médical, centres de production informatique).
Tous les exemples sont **génériques** : aucun n'est propre à un organisme existant.

## 1. Contexte et constat

ACRA couvre aujourd'hui ce métier par **un seul sous-secteur** de la santé (« assurance maladie obligatoire »), avec
une quinzaine d'exemples. Pour un organisme national, c'est insuffisant :

- les métiers (droits, liquidation, contrôle médical, risques professionnels, prévention, fraude, données nationales,
  international, action sociale) ont des risques et des mesures très différents ;
- une même application relève souvent de **plusieurs** métiers et d'une **interconnexion** ;
- le statut d'organisme public impose des démarches absentes d'ACRA (homologation de sécurité, contrôle interne en
  réseau, signalements propres aux agents publics) ;
- les volumes (centaines d'applications, milliers d'agents, millions d'usagers) dépassent les usages actuels.

## 2. Déjà livré (2026-10-03)

| Besoin | Livraison |
|---|---|
| Plusieurs sous-secteurs par analyse | `Analyse.sousSecteurs` (liste, le premier = principal recopié dans `sousSecteur`), sélecteur `SousSecteursPicker`, routes de création / modification, ateliers 1 à 5, suggestions de risques, MCP (`read_sector_examples.sousSecteurs`, `recommend_risks_scenarios`) |
| Ne proposer que ce qui est cohérent | Sous-secteurs proposés = famille du secteur + interconnexions (transverses), jamais ceux d'un autre secteur ; sélection re-validée côté serveur et à chaque changement de secteur ; contenu commun d'une famille masqué pour les sous-secteurs où il n'a pas de sens (`notFor`, ex. INS, CPS ou biomédical pour la santé animale ou les organismes payeurs) |

## 3. Besoin B1 — Taxonomie « Protection sociale »

Nouveau secteur d'analyse **« Protection sociale / sécurité sociale »** (famille dédiée, ×5 langues, avant « Autre »)
et secteur de catalogue correspondant, avec 13 sous-secteurs :

| Id proposé | Libellé | Ce qui le distingue |
|---|---|---|
| `protsoc-tete-reseau` | Tête de réseau (pilotage national) | référentiels nationaux, consolidation, maîtrise des risques du réseau |
| `protsoc-caisse-locale` | Caisse locale | accueil, gestion des droits, liquidation, relations avec les professionnels du territoire |
| `protsoc-controle-medical` | Service du contrôle médical | avis médicaux, arrêts de travail, accords préalables, secret médical |
| `protsoc-production` | Centre de production informatique | traitements de masse, éditique, paiements, grands systèmes |
| `protsoc-services-usagers` | Services en ligne aux usagers | compte usager, application, carte d'assurance dématérialisée |
| `protsoc-services-pro` | Services aux professionnels de santé | téléservices, conventionnement, rémunérations forfaitaires |
| `protsoc-risques-pro` | Risques professionnels | accidents du travail, maladies professionnelles, tarification des employeurs |
| `protsoc-prevention` | Gestion du risque et prévention | dépistage, accompagnement de patients chroniques, centres d'examens de santé |
| `protsoc-fraude` | Lutte contre la fraude | exploration de données, enquêtes, contentieux |
| `protsoc-donnees` | Données nationales | entrepôt médico-administratif, mise à disposition, statistiques publiques |
| `protsoc-international` | Relations internationales | soins à l'étranger, coordination européenne |
| `protsoc-action-sociale` | Action sanitaire et sociale | aides individuelles |
| `protsoc-mandats` | Gestion pour le compte d'autres régimes | mandats, délégations, reddition de comptes |

Critères : chaque sous-secteur reçoit des exemples dans les 9 catégories d'atelier ; le secteur de catalogue atteint le
cliquet de profondeur (≥ 12 risques, 20 contrôles, 8 KRI, 4 missions, 3 incidents types, 2 contrôles ancrés sur un
texte cité) ; l'actuel `sante-amo` reste disponible (rétrocompatibilité) et oriente vers la nouvelle famille.

## 4. Besoin B2 — Homologation de sécurité

Décision d'homologation d'un système d'information reliée à son analyse de risques : dossier (analyse, plan de
traitement, risques résiduels, tests d'intrusion, attestations), commission, décision (homologué, homologué sous
réserve, refusé), **durée de validité**, réexamen, relances à échéance, registre des systèmes homologués, journal
d'audit. Le référentiel RGS existe déjà dans ACRA ; le flux de décision manque.

## 5. Besoin B3 — Plan de maîtrise des risques en réseau

Référentiel national de contrôles **décliné** par entité (caisse, centre), saisie locale des résultats, consolidation
et comparaison à la tête de réseau, écarts et plans d'action remontés. S'appuie sur le multi-organisation existant
(arbre, héritage) et sur le contrôle permanent.

## 6. Besoin B4 — Registre des algorithmes et systèmes d'IA

Pour chaque algorithme ou système d'IA : finalité, données utilisées, décision assistée ou automatisée, intervention
humaine, contrôles de biais et de dérive, classification au titre du règlement (UE) 2024/1689 sur l'intelligence
artificielle (l'évaluation de l'éligibilité à des prestations publiques relève a priori des systèmes à haut risque —
**à vérifier**), lien avec l'analyse de risques et l'AIPD.

## 7. Besoins B5 à B10

| # | Besoin | Contenu |
|---|---|---|
| B5 | Fraude | typologies de fraude (catalogue), KRI (préjudice détecté et évité, délais de traitement), lien contrôles / contentieux, obligation de signalement des agents publics à l'autorité judiciaire |
| B6 | Régimes de déclaration | NIS2 (entité essentielle), RGPD art. 33 et 34, signalement des agents publics, communication de crise vers un très grand nombre d'usagers |
| B7 | Tiers à très grand volume | éditeurs de logiciels raccordés et certifiés, professionnels de santé, prestataires d'éditique et de numérisation : import en masse, campagnes de questionnaires, criticité calculée |
| B8 | Passage à l'échelle | import depuis une CMDB (centaines d'applications), analyses socles héritées par toutes les entités, vues de portefeuille par entité |
| B9 | Revues d'habilitations en masse | campagnes de recertification sur des milliers d'agents, import des droits, relances, preuves |
| B10 | Référentiels | vérifier ou ajouter : RGS (homologation), qualification SecNumCloud pour les données sensibles en nuage, PGSSI-S, HDS, NIS2 art. 21 |

## 8. Exemples génériques à proposer par défaut

**Valeurs métier** : ouverture et maintien des droits des assurés et ayants droit ; liquidation et paiement des
prestations en nature et en espèces (dont revenus de remplacement) ; référentiel national des bénéficiaires ;
identifiant national et carte d'assurance (physique et dématérialisée) ; téléservices aux professionnels de santé ;
avis du contrôle médical ; données de remboursement à l'échelle nationale ; paiements de masse et recouvrement des
indus ; tarification des risques professionnels des employeurs.

**Biens supports** : chaînes de traitement de masse sur grands systèmes (traitements de nuit), ordonnanceur ;
plateforme d'éditique et de courrier de masse ; centre de contacts (téléphonie, enregistrements) ; compte usager en
ligne et application mobile ; fournisseur d'identité des usagers ; annuaire national des professionnels ; passerelle
des flux de facturation électronique ; entrepôt national de données ; archivage électronique à valeur probante ;
agent conversationnel.

**Événements redoutés** : paiements erronés en masse après une régression d'un traitement de nuit ; détournement
massif de prestations par changement de coordonnées bancaires ; indisponibilité nationale des téléservices aux
professionnels ; consultations illégitimes du référentiel des bénéficiaires par des agents ; fuite de données à partir
de comptes de professionnels compromis ; décision automatisée biaisée ou contestée ; réidentification à partir de
données nationales mises à disposition ; retard massif des revenus de remplacement.

**Sources de risque** : réseau de fraude organisée (faux professionnels, fausses ordonnances) ; revendeurs d'accès à
des comptes de professionnels ; agent interne corrompu ; rançongiciel ciblant le secteur public ; acteur étatique
visant des données nationales ; activiste (atteinte à la réputation).

**Scénarios stratégiques** : compromission de comptes de professionnels pour consulter ou extraire massivement des
données d'assurés ; changement d'IBAN en masse à partir de comptes usagers usurpés ; rançongiciel sur un centre de
production arrêtant les paiements ; agent consultant des proches ou des personnalités ; prestataire d'éditique
compromis diffusant des courriers frauduleux.

**Mesures** : homologation de chaque téléservice ; authentification forte des professionnels et des usagers ; délai
de sécurité avant tout paiement vers un nouvel IBAN ; détection des consultations atypiques par les agents (motif
obligatoire, revue) ; tests de non-régression sur les montants avant toute mise en production d'un traitement de
masse ; rapprochement des paiements par lot (totaux de contrôle) ; bastion d'administration des grands systèmes ;
plan de continuité des paiements prioritaires ; contrôle humain des décisions algorithmiques ; revue du risque de
réidentification avant chaque mise à disposition de données.

**KRI** : changements d'IBAN par période ; indus détectés (nombre et montant) ; consultations atypiques par des
agents ; délai de paiement des revenus de remplacement ; disponibilité des téléservices ; comptes de professionnels
compromis signalés ; décisions automatisées contestées.

**Incidents types** : paiement en double d'un lot ; usurpation massive de comptes usagers ; campagne d'hameçonnage
usurpant l'identité de l'organisme auprès des assurés ; indisponibilité de la carte dématérialisée ; erreur de
tarification d'employeurs.

Règles : suggestions à qualifier (aucune cotation figée, aucune exécution, aucun seuil) ; références citées avec leur
version, sans reprise d'exigence ; traductions ×5 dans la donnée ; contenu « à relire par un expert ».

## 9. Décisions attendues

| # | Question | Proposition par défaut |
|---|---|---|
| D1 | Nouvelle famille « Protection sociale » ou sous-secteurs sous « Santé » | Nouvelle famille (les régimes de retraite, de famille, de recouvrement pourront s'y ajouter) |
| D2 | Ordre des besoins | B1 → B2 → B3 → B8 → B9 → B5 → B4 → B6 → B7 → B10 |
| D3 | Plafond de sous-secteurs par analyse | 4 (livré) ; à relever si nécessaire |
| D4 | Homologation : module à part ou extension du workflow d'approbation des analyses | Module à part, relié à l'analyse |

## 10. Critères d'acceptation communs

- Contenu affiché seulement s'il est cohérent avec le secteur et les sous-secteurs choisis (tests de non-affichage).
- Isolation multi-organisation, RBAC et gel d'analyse respectés pour toute nouvelle écriture.
- i18n ×5, `npm run i18n:check`, cliquet de profondeur, grille de revue régénérée.
- Migrations additives ou de données uniquement (politique `check-migrations`).
