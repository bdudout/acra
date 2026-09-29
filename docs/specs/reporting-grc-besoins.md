# Reporting GRC — incidents, pertes, contrôle permanent, audit : définition détaillée des besoins

> Statut : **cadrage v0.1 (2026-09-29)** pour la v1.0.4 (pas de publication de release
> avant que ces lots soient livrés). Document de décision : les choix « à trancher »
> sont listés en §9. Il **étend** l'existant (cf. §2), il ne le remplace pas.
>
> **Règle réglementaire du projet** : ce document *décrit des besoins*. Aucun libellé,
> seuil ou délai réglementaire n'y fait foi. À l'implémentation, tout contenu normatif
> est repris de la source officielle (EUR-Lex pour les textes UE, version officielle
> pour les normes) avec sa version citée (cf. `CLAUDE.md`). Les références marquées
> « ⚠ à confirmer » sont données de mémoire et doivent être vérifiées avant d'être
> codées.

---

> **État d'avancement (2026-09-29)** — **L1 livré** (décisions §9 retenues sur les recommandations) :
> régimes de notification configurables (B-INC-1 : NIS2, RGPD art. 33, interne, personnalisés ;
> DORA garde son moteur dédié), pertes multi-composantes (B-PER-1/2/4 : lignes typées, devises,
> seuils de collecte et de grande perte, date de règlement), types d'événement (B-INC-2) et
> quasi-incidents (B-INC-4). Restent à faire dans L1 : allocation multi-entités (B-PER-3),
> impact non financier (B-PER-5), rapprochement comptable (B-PER-6), journal de chronologie et
> cause racine (B-INC-3), import CSV/API v1 en écriture (B-INC-5).

> **L2 livré (socle du reporting)** : éditions figées (`RapportEdition`), cycle brouillon → relu →
> validé → diffusé avec quatre-yeux (auto-validation tracée en mode ligne unique), périodes
> prédéfinies ou libres, export Excel, impression PDF, 3 rapports : **R-INC-1** (tableau de bord
> incidents), **R-PER-2** (pertes par type / catégorie / entité, grandes pertes), **R-GRC-3**
> (synthèse direction une page, verdict du cockpit). À venir : R-INC-2/3, R-CTL-*, R-AUD-* (avec
> L3/L4), gabarits surchargeables (sections, seuils, logo), diffusion par e-mail (après validation
> humaine), masquage pour rapports externes, rapports planifiés en brouillon, PDF serveur.

> **L3 livré (contrôle permanent)** : typologie (préventif / détectif / correctif, manuel / automatique,
> contrôle clé, méthode d'échantillonnage) ; **évaluation de la conception** distincte de l'efficacité
> opérationnelle avec appréciation conjuguée (efficace / à surveiller / défaillant) ; taille d'échantillon
> suggérée ; **plan annuel** (une occurrence par période, retards, charge par responsable, pics) ;
> **contrôle continu** (`POST /api/v1/controls/{id}/results`, détection d'un flux interrompu) ; **anomalies
> récurrentes et escalade** (N2, comité pour un contrôle clé) ; rapports **R-CTL-1/2/3**. Reste : rejeu du
> test à la période suivante et comparaison N/N-1 (B-CTL-5), rattachement à un tiers / un projet 360 (B-CTL-8).

## 1. Objectif et principe directeur

Permettre à **un maximum d'organisations et de contextes** d'utiliser les modules
Incidents, Pertes, Contrôle permanent et Audit interne — et surtout d'en **tirer des
rapports** exploitables (comité, direction, conseil, régulateur, auditeur) — sans les
tordre : ce qui varie d'une organisation à l'autre doit être **une donnée
configurable**, pas du code.

Principe : **le noyau reste petit et générique, la variabilité vit dans quatre
couches de configuration** (§4), toutes résolues au même point (`getOrgConfig`) selon le
modèle à 3 niveaux du projet (défaut → organisation → politique d'instance).

Non-objectifs (v1.0.4) : remplacer un outil de gestion comptable, un ITSM ou un SIEM
(on s'y **connecte**, on ne les duplique pas) ; produire des déclarations
réglementaires « officielles » (l'outil prépare et suit, l'entité soumet).

---

## 2. Existant (état du code au 2026-09-29)

| Module | Déjà en place | Où |
|---|---|---|
| **Incidents** | Déclaration simple (tout rôle), qualification, clôture/rejet ; maille catégorie × processus × entité ; impact estimé 1-4 ; déduplication ; rattachement au registre + **promotion en risque** + calibrage de la vraisemblance ; export CSV/Excel | `lib/incident.ts`, `IncidentsManager`, `api/incidents/*` |
| **Pertes (LDC)** | Montant brut, récupérations, **perte nette** ; total ; export LDC (référence, chronologie, brut/récup./net) | `lib/incident.ts`, `api/incidents/export` |
| **DORA** | Classification majeur/significatif/mineur (critères), workflow art. 19 (initiale 4 h/24 h, intermédiaire 72 h, finale 1 mois — délais paramétrables), export ITS, registre TIC | `lib/dora*.ts`, `reglementaire/*` |
| **Contrôle permanent** | Contrôles N1/N2, périodicité, échantillon, checklist, exécution (conforme/anomalie/N.A., preuves, indépendance), efficacité, échéances, rattachement risque/processus/référentiel, import, **campagnes**, supervision N2, action générée sur anomalie | `lib/controle.ts`, `lib/campagne-controle.ts`, `ControlesManager`, `CampagnesControleManager` |
| **Audit interne** | Missions (type, récurrence, programme + résultats), constats (criticité 1-4, recommandation, responsable, échéance, source interne/régulateur), rapports, catalogue de programmes | `AuditManager`, `lib/audit-programmes-catalogue.ts` |
| **KRI** | Indicateurs, seuils alerte/critique, mesures, tendance | `lib/kri.ts`, `KriManager` |
| **Reporting** | Cockpit `/pilotage` consolidé ; dossier de comité (PDF) ; **rapport annuel de contrôle interne** (PDF/PPTX) par ligne de défense ; export SoA ; RAS/RAD (PDF) ; suivi régulateur | `lib/comite-pack.ts`, `lib/rapport-controle-interne*.ts`, `ras-rad-pdf-template.tsx` |
| **Adaptation** | Taxonomie surchargeable, échelles/matrice (ADMIN), délais DORA paramétrables, ligne de défense 2 optionnelle, appétence, activation par module (3 niveaux) | `lib/taxonomie.ts`, `OrganizationConfig` |

**Constat** : la chaîne fonctionnelle est là ; ce qui manque, c'est (a) **la variabilité
maîtrisée** (un seul régime de notification codé, une seule vue de perte, un seul
cycle d'audit), (b) **le reporting** comme produit à part entière (catalogue, cadence,
destinataires, historisation), (c) la **boucle d'amélioration** (causes, leçons,
recommandations suivies jusqu'à clôture vérifiée).

---

## 3. Contextes cibles et ce qui change de l'un à l'autre

| # | Contexte | Ce qui le distingue (exemples) |
|---|---|---|
| C1 | **Banque / établissement de crédit** (ACPR) | Contrôle permanent N1/N2 formalisé, LDC Bâle (7 catégories, 8 lignes de métier), rapports annuels de contrôle interne, DORA, audit de la 3ᵉ ligne indépendant |
| C2 | **Assurance / mutuelle** (ACPR, Solvabilité II) | Fonctions clés (gestion des risques, vérification de la conformité, audit interne, actuarielle), ORSA, incidents opérationnels + cyber, DORA |
| C3 | **Entité NIS2 essentielle/importante** (industrie, énergie, transport, santé…) | Notification incident 24 h / 72 h / rapport final, autorité nationale (ANSSI/CERT), peu de « pertes » comptables, contrôle = ISO 27001/IEC 62443 |
| C4 | **Établissement de santé** | Incidents de sécurité des systèmes d'information + déclaration sectorielle, HDS, continuité de soins, pertes non financières (impact patient) |
| C5 | **Collectivité / secteur public** | Pas de « perte » en € mais impact service, RGS, audit interne réduit, reporting vers élus/DGS |
| C6 | **ETI/PME non régulée** | Une personne « qualité/risque », contrôle allégé, audit externe ponctuel, reporting = tableau de bord direction |
| C7 | **Éditeur / prestataire SaaS** | SOC 2 / ISO 27001, incidents clients (SLA), contrôles continus automatisés, audit = auditeur externe |
| C8 | **Groupe multi-entités** | Consolidation sous-arbre, seuils différents par filiale, devises multiples, exercice ≠ année civile |
| C9 | **Cabinet de conseil / RSSI à temps partagé** | Multi-clients isolés, rapports **au nom du client**, gabarits réutilisables d'un client à l'autre |

Conséquence : on ne modélise pas « la banque » ; on modélise des **axes de variation**
(§4) et on livre des **gabarits sectoriels** qui pré-remplissent ces axes.

---

## 4. Les quatre couches d'adaptation

### 4.1 Vocabulaire (terminologie)
Renommer sans toucher au code : « incident » ↔ « événement de risque » ↔ « évènement de
sécurité » ; « contrôle permanent » ↔ « contrôle interne » ↔ « auto-contrôle » ;
« mission d'audit » ↔ « audit » ↔ « revue » ; « perte » ↔ « impact ». Table de
libellés par organisation, surchargeant `t.*` **uniquement pour l'affichage**
(les 5 langues restent complètes).
*Critère d'acceptation* : renommer « Incident » en « Événement de sécurité » change
menu, titres, exports et PDF de l'organisation, pas ceux des autres.

### 4.2 Référentiels de données (catalogues éditables)
Chaque catalogue = liste `{ code stable, libellé (i18n ou custom), actif, ordre }`,
livré avec un défaut et surchargeable (comme `taxonomie.ts`) :

| Catalogue | Défaut livré | Variation typique |
|---|---|---|
| Taxonomie d'événements | 7 catégories Bâle | Assurance, santé, ISO 27001, taxonomie interne |
| Lignes de métier | 8 lignes Bâle (option) | Banque : oui ; autres : lignes internes ou désactivé |
| Types de perte | Perte directe, provision/dépréciation, réparation/remplacement, pénalité/amende, perte d'opportunité, quasi-incident (near-miss) | Non financier : « jours d'indisponibilité », « patients impactés » |
| Types de récupération | Assurance, tiers responsable, recouvrement client | — |
| Canaux de détection | SOC, contrôle, audit, collaborateur, client, régulateur | — |
| Causes racines | Processus, personnes, systèmes, externe (Bâle) + sous-causes | Cause « tiers » (DORA/NIS2) |
| Types de contrôle | Préventif / détectif / correctif ; manuel / automatique ; clé / non clé | Contrôle continu (CCM) |
| Méthodes d'échantillonnage | Fixe, statistique, aléatoire, exhaustif | — |
| Univers d'audit | Processus, entités, référentiels | Cycle pluriannuel |
| Notation de mission / criticité de constat | 4 niveaux (existant) | 3, 4 ou 5 niveaux, libellés propres |

### 4.3 Règles et seuils (paramètres)
- **Échelles** : impact, criticité, notation (nombre de niveaux et libellés) — s'appuie sur `risk-scale`.
- **Seuils** : seuil de collecte des pertes (ex. collecter dès X €), seuil « perte
  importante » (large loss) déclenchant une escalade, seuils de classification DORA,
  seuils d'alerte KRI, taux d'anomalie tolérés par contrôle, taux minimal
  d'exécution des campagnes.
- **Délais** : délais de notification par régime (§5.1), SLA de qualification d'incident,
  délais de traitement des recommandations, relances.
- **Périodicités et calendrier** : exercice fiscal ≠ année civile, jours ouvrés,
  fenêtres de campagne.
- **Devise** : devise de référence + taux par période (groupe multi-devises).

### 4.4 Processus et droits (workflows)
- **Qui** qualifie un incident, valide une clôture, approuve un report d'échéance de
  recommandation (rôles ou personnes désignées — s'appuie sur `permissions`, jamais de
  test de rôle ad hoc dans les routes).
- **Étapes optionnelles** : quatre-yeux à la qualification d'une perte, revue N2 des
  exécutions, validation du rapport avant diffusion.
- **Ligne de défense 2 optionnelle** (existant) : chaque étape reste utilisable en
  organisation mono-personne (auto-validation tracée).
- **Champs personnalisés** (par module) : texte, nombre, liste, date, oui/non, avec
  visibilité par rôle — pour absorber le « il nous faut aussi ce champ » sans migration.

---

## 5. Besoins détaillés par module

### 5.1 Incidents (et régimes de notification)

**Problème** : un incident peut relever de **plusieurs obligations simultanées**
(DORA, NIS2, RGPD, sectoriel, contractuel client), chacune avec sa propre horloge et
son destinataire ; aujourd'hui seul le workflow DORA art. 19 existe.

**B-INC-1 — Régimes de notification configurables.** Un *régime* =
`{ code, libellé, autorité/destinataire, critère de déclenchement (règle sur critères
de l'incident), phases[{ code, délai, point de départ }], gabarit de contenu }`.
Livrés (contenu à sourcer, ⚠ à confirmer) : DORA (art. 19 + RTS/ITS), NIS2 (alerte
précoce / notification / rapport final), RGPD art. 33 (violation de données, 72 h),
sectoriel santé, **régime interne** (escalade direction/comité) et **client/contractuel**
(SLA). Une organisation active les régimes qui la concernent ; l'incident affiche
**toutes les horloges applicables** avec échéance, statut (à faire / soumis / en retard)
et preuve de soumission (référence, date, pièce).
*Acceptation* : un incident cyber avec fuite de données affiche simultanément les
horloges DORA (si applicable), NIS2 et RGPD ; désactiver NIS2 dans l'org retire son
horloge ; un régime ajouté par l'org (« contractuel banque X, 2 h ») fonctionne sans code.

**B-INC-2 — Types d'événements au-delà du cyber.** Fraude interne/externe, défaillance
de processus, continuité, sécurité physique, qualité/HSE (optionnel). Un *type* porte
ses champs propres (custom fields) et ses régimes par défaut. Le formulaire de
déclaration reste à 2 minutes (champs de base) ; le reste se complète à la qualification.

**B-INC-3 — Chronologie et cause.** Journal horodaté (détection, escalade, confinement,
rétablissement, communication), **cause racine** (catalogue, § 4.2), **analyse
post-incident** (leçons, actions liées au plan d'action unifié `INCIDENT`), lien
tiers/fournisseur (registre TIC) et **incidents liés** (même événement générateur).

**B-INC-4 — Quasi-incidents.** Déclarés comme les autres mais typés « near-miss » (perte
= 0, potentiel estimé) : ils alimentent la fréquence sans polluer les pertes réalisées.

**B-INC-5 — Entrées/sorties.** Import CSV/Excel d'historique (gabarit), API v1 en
écriture (déclaration depuis ITSM/SIEM), webhook sortant à la qualification/clôture
(existant : webhooks) ; e-mail de déclaration (adresse dédiée) = *à trancher* (§9).

### 5.2 Pertes (LDC et au-delà)

**Problème** : la LDC bancaire n'est qu'un cas ; d'autres organisations suivent des
**coûts d'incident** ou des **impacts non financiers**.

**B-PER-1 — Perte multi-composantes.** Une perte = lignes `{ type de perte, montant,
devise, date de comptabilisation, statut (estimé/provisionné/comptabilisé), réf.
comptable (facultative) }` + `récupérations` typées. Brut = Σ lignes, net = brut −
récupérations (l'existant `montantBrut/recuperations` est conservé comme total agrégé
pour compatibilité, avec migration douce).
**B-PER-2 — Dates Bâle.** Survenance / découverte / comptabilisation / règlement
(le décalage est un indicateur en soi ; le seuil de temps de saisie est un KRI).
**B-PER-3 — Allocation.** Répartition d'un incident entre entités et lignes de métier
(pourcentages), utile aux groupes et aux banques.
**B-PER-4 — Seuils et escalade.** Seuil de collecte (ignoré en dessous), seuil de
« perte importante » (notification comité), tolérance d'écart (perte estimée vs constatée).
**B-PER-5 — Impact non financier.** Unités alternatives configurables (jours d'arrêt,
clients/patients touchés, données exposées) affichées à la place ou en plus de l'€.
**B-PER-6 — Rapprochement comptable.** Export/import de contrôle avec la comptabilité
(écarts LDC ↔ grand livre), sans lecture directe de l'ERP.
**B-PER-7 — Devises.** Taux par date ; consolidation en devise de référence de l'org.

### 5.3 Contrôle permanent

**B-CTL-1 — Plan de contrôle annuel.** Vue planifiée (qui, quoi, quand, échantillon)
générée depuis les contrôles + périodicités, avec charge par personne et détection des
pics ; ajustable par l'organisation (jours fériés, exercice).
**B-CTL-2 — Conception vs efficacité opérationnelle.** Deux évaluations distinctes
(le contrôle est-il bien *conçu* ? fonctionne-t-il *dans la durée* ?) — attendu des
auditeurs et des cadres de type COSO/SOC 2 ⚠ à confirmer pour les libellés.
**B-CTL-3 — Typologie.** Préventif/détectif/correctif, manuel/automatique, clé/non clé ;
les contrôles clés pilotent le reporting et l'appréciation globale.
**B-CTL-4 — Échantillonnage guidé.** Règle de taille selon le risque et la population
(méthodes du § 4.2) ; l'outil **propose** une taille, l'exécutant garde la main.
**B-CTL-5 — Preuves et rejeu.** Preuves versionnées, rejeu du même test à la période
suivante (pré-rempli), comparaison N vs N-1.
**B-CTL-6 — Contrôles continus / automatisés.** Résultat poussé par API (script, SIEM,
outil de configuration) au lieu d'une saisie ; seuil d'alerte si le flux s'arrête
(« le contrôle automatique ne remonte plus »).
**B-CTL-7 — Escalade des anomalies.** Anomalie → action (existant) → si récurrente ou
sur contrôle clé → escalade N2 puis comité ; taux de récurrence en indicateur.
**B-CTL-8 — Périmètres.** Contrôles rattachés à un référentiel (existant), à un
processus, à une entité, à un **tiers** (contrôle du prestataire) et à un **projet 360**.

### 5.4 Audit interne

**B-AUD-1 — Univers et plan d'audit.** Univers d'audit (processus/entités/référentiels)
coté par risque, **plan pluriannuel** (cycle de couverture configurable : 3, 5 ans…),
plan annuel dérivé, couverture en %. L'existant (missions + récurrence) devient une
vue de ce plan.
**B-AUD-2 — Cycle de la mission.** Lettre de mission, programme de travail (existant),
**feuilles de travail**, réunion d'ouverture/clôture, rapport provisoire → contradictoire
→ rapport final ; chaque étape datée et rôle-gardée.
**B-AUD-3 — Constats structurés.** Champs *critère / constat / cause / conséquence /
recommandation* (structure classique ; la structure est un choix d'org, cf. §4.2),
criticité configurable, lien vers le risque, le contrôle, le processus.
**B-AUD-4 — Suivi des recommandations.** Statuts (à démarrer, en cours, réalisé,
**vérifié par l'audit**, clos), demande de **report d'échéance** approuvée, relances
automatiques, taux de mise en œuvre et **ancienneté** en indicateurs. La clôture est
prononcée par l'audit, pas par l'audité.
**B-AUD-5 — Notation de mission.** Échelle configurable (ex. 4 niveaux) avec libellés
propres, alimentant l'appréciation globale du rapport annuel.
**B-AUD-6 — Sources externes.** Audits du régulateur, du commissaire aux comptes, de
clients, certifications : même objet, source différente (existant : `source`), avec
suivi commun des recommandations.
**B-AUD-7 — Indépendance.** Cloisonnement AUDITEUR (existant) + déclaration de
conflit d'intérêts par mission (case + commentaire, tracée).

### 5.5 KRI (transverse)
Lier chaque KRI à une **source automatique** (incidents/mois, taux d'anomalie de
contrôle, retard de recommandations…) plutôt qu'à une saisie manuelle : les modules
alimentent les KRI (« pertes nettes cumulées », « délai moyen de détection », « % de
contrôles clés en anomalie »).

---

## 6. Reporting — le produit

### 6.1 Concepts
- **Rapport** = `{ code, titre, destinataire(s), périodicité, périmètre, sections[],
  format(s), langue, statut de validation }` ; **gabarit** livré, surchargeable par
  l'org (sections, ordre, seuils, logo, texte d'intro/mentions).
- **Édition** = instantané figé d'un rapport pour une période (comme
  `ConformiteSnapshot`) : reproductible, comparable N vs N-1, **jamais recalculé** après
  validation.
- **Cycle** : brouillon → relu (N2/audit) → validé → diffusé (trace : qui, quand, à qui).
- **Périmètre** : organisation courante ou sous-arbre consolidé ; filtres entité,
  processus, catégorie, période, ligne de défense.
- **Formats** : PDF, Word, PowerPoint, Excel/CSV (existants selon rapport) ; **API v1**
  (lecture) pour l'alimentation d'un outil de BI.

### 6.2 Catalogue cible

| Code | Rapport | Destinataire | Cadence | Existant ? |
|---|---|---|---|---|
| R-INC-1 | Tableau de bord incidents (volumes, délais détection/résolution, tendances, top causes) | Direction, RSSI | Mensuel | Partiel (cockpit) |
| R-INC-2 | **Registre / historique des incidents** (art. 33(5)-type, journal complet) | Auditeur, DPO | À la demande | Partiel (export) |
| R-INC-3 | Fiche de déclaration par régime (DORA, NIS2, RGPD, interne) : contenu pré-rempli, **non soumis par l'outil** | Autorité (via l'entité) | À l'événement | DORA ITS oui, autres non |
| R-PER-1 | **LDC** (base de pertes) avec seuils, allocation, rapprochement | Risk manager, ACPR | Trimestriel/annuel | Partiel |
| R-PER-2 | Pertes par catégorie / ligne de métier / entité, grandes pertes, évolution | Comité des risques | Trimestriel | Non |
| R-CTL-1 | Avancement du plan de contrôle (réalisé/prévu, retards, anomalies) | Contrôle permanent, N2 | Mensuel | Partiel (campagnes) |
| R-CTL-2 | **Efficacité du dispositif** (conception vs opérationnelle, contrôles clés) | Comité de contrôle interne | Trimestriel | Non |
| R-CTL-3 | Anomalies récurrentes et actions | N2, direction | Mensuel | Non |
| R-AUD-1 | Plan d'audit, couverture, avancement | Comité d'audit | Trimestriel | Non |
| R-AUD-2 | **Rapport de mission** (constats structurés, notation, recommandations) | Audité, direction | À la mission | Partiel (rapports) |
| R-AUD-3 | **Suivi des recommandations** (taux, ancienneté, reports) | Comité d'audit | Trimestriel | Partiel (suivi régulateur) |
| R-GRC-1 | **Rapport annuel de contrôle interne** (3 lignes + TIC) | Conseil, régulateur | Annuel | **Oui** |
| R-GRC-2 | Dossier de comité (risques + signaux) | Comité | Périodique | **Oui** |
| R-GRC-3 | **Rapport « une page » direction** (voyants, 5 chiffres, 3 décisions à prendre) | DG / conseil | Mensuel | Non |

Le contenu réglementaire (intitulés de sections attendus par un régulateur) est repris
des textes officiels à l'implémentation et **cité avec sa version** ; sinon les rapports
restent « rapports de gestion ».

### 6.3 Diffusion et confiance
- Liste de destinataires par rapport (utilisateurs ou e-mails externes) ; envoi par
  e-mail (SMTP existant) avec lien authentifié, **pas de pièce jointe sensible en clair**
  par défaut ; journal d'audit de chaque export/diffusion (existant pour les exports).
- Masquage configurable (montants arrondis, noms d'entités, données personnelles) pour
  les rapports sortant du périmètre de confiance (client, régulateur, conseil).
- Rapports **planifiés** (cron existant) générés en brouillon, jamais diffusés sans
  validation humaine.

---

## 7. Gabarits sectoriels (packs de démarrage)

Un **gabarit** applique en un clic un ensemble cohérent de réglages **modifiables
ensuite** (aucun verrouillage) : catalogues, échelles, seuils, régimes de
notification, périodicités, modules activés, rapports actifs, vocabulaire.

| Gabarit | Modules | Régimes | Rapports mis en avant |
|---|---|---|---|
| Banque / établissement de crédit | Incidents, pertes LDC, N1/N2, audit, KRI, DORA | DORA, RGPD, interne | R-PER-1/2, R-CTL-2, R-AUD-1/3, R-GRC-1 |
| Assurance / mutuelle | Incidents, N1/N2, audit, fonctions clés | DORA, RGPD, interne | R-CTL-2, R-AUD-3, R-GRC-1 |
| Entité NIS2 | Incidents, contrôle (ISO 27001/62443), audit léger | NIS2, RGPD | R-INC-1/3, R-GRC-3 |
| Santé | Incidents (impact non financier), contrôle allégé | Sectoriel santé, RGPD | R-INC-1/2, R-GRC-3 |
| Secteur public | Incidents, contrôle allégé | RGPD, interne | R-GRC-3 |
| PME/ETI | Incidents simples, contrôle allégé | RGPD | R-GRC-3 |
| SaaS | Incidents clients, contrôles continus | Contractuel, RGPD | R-CTL-1/2 |
| Cabinet/multi-clients | Gabarit **par client** copiable | Selon client | Rapports au nom du client |

Le pack livre aussi des **exemples** (§8) marqués comme tels.

---

## 8. Exemples, propositions et explications (modules récents)

Objectif : qu'un utilisateur non spécialiste **comprenne à quoi sert chaque écran et
démarre avec du contenu réaliste**, sans page blanche.

### 8.1 Trois formes de contenu
1. **Explication in-situ** : bandeau repliable « À quoi ça sert / comment s'en servir /
   ce qu'on en tire » par module (une seule source i18n ×5).
2. **Exemples cliquables** (pattern déjà utilisé pour les risques) : un clic = pré-remplit
   le formulaire, l'utilisateur adapte. Libellés sectoriels, jamais présentés comme
   réglementaires.
3. **Jeu d'exemples chargeable** (démo/onboarding) : lot cohérent de données marquées
   `exemple`, supprimable en un clic, jamais mélangé aux données réelles à l'insu de
   l'utilisateur.

### 8.2 Contenu proposé par module récent

| Module | Explications | Exemples cliquables / jeux |
|---|---|---|
| **Projet 360** | Les six domaines et pourquoi ; lecture du tableau de bord ; validation RSSI + RM ; d'où viennent les réponses pré-remplies | 4 projets types (migration cloud, refonte portail client, nouveau service de paiement, externalisation de la paie) avec réponses au questionnaire et risques par domaine |
| **RAS / RAD** | Différence RAS/RAD, lecture des voyants, lien avec l'appétence | Seuils par catégorie pour banque, assurance, ETI industrielle, santé (illustratifs) |
| **Tests de résilience (DORA art. 24-26)** | Programme annuel, types de tests, TLPT, lien avec le rapport de réexamen | Programme annuel type sur 12 mois, 5 constats types avec sévérité et action |
| **Maturité (CMMI)** | Échelle 1-5, niveau actuel vs cible, écart par domaine | Profil cible « Basic »/« Enhanced » présenté comme modèle ACRA révisable (pas prescription) |
| **Dérogations** | Cycle, avis RSSI (favorable / réserves / défavorable), expiration | 6 motifs types avec mesures compensatoires crédibles |
| **Processus de cartographie** | Démarche pas à pas, fréquence de revue | Calendrier annuel type de revue |
| **Incidents / pertes** | Déclarer vs qualifier ; brut/récupération/net ; quasi-incident | 8 incidents types (phishing, indisponibilité fournisseur, fraude au virement, erreur de saisie, fuite de données, panne datacenter, ransomware, non-conformité process) avec pertes |
| **Contrôle permanent** | N1/N2, échantillon, efficacité | Bibliothèque de 30 contrôles types par processus (paiements, accès, sauvegardes, changement, tiers) avec checklist |
| **Audit** | Plan, mission, constat, recommandation | Programme de 5 missions types et 6 constats structurés |

### 8.3 Règles de qualité
- Chaque exemple est **traduit ×5 par un mécanisme i18n** (pas de français en dur), et
  tout contenu **réglementaire** cité provient de l'official (EUR-Lex/ISO) avec version.
- Un exemple n'invente aucun chiffre présenté comme statistique : les montants sont
  clairement illustratifs.
- Les exemples sont **testés** : parité des clés ×5, cohérence (codes de catégories
  valides, contrôles rattachables), non-régression du chargement/suppression.

---

## 9. Décisions à trancher (recommandation en gras)

1. **Ordre de livraison** — recommandé : **L1 régimes de notification + pertes
   multi-composantes**, puis L2 reporting (catalogue + éditions figées), L3 contrôle
   (plan annuel, conception vs efficacité), L4 audit (univers, recommandations vérifiées),
   L5 gabarits sectoriels, L6 exemples (en continu, dès L1 pour les modules récents).
2. **Champs personnalisés** : **oui, sous forme d'un mécanisme générique** (JSON validé +
   visibilité par rôle) plutôt que des colonnes ; limite (ex. 20 champs/module).
3. **Vocabulaire personnalisable** : **oui, affichage seulement**, table par
   organisation ; pas de renommage des clés techniques.
4. **Déclaration par e-mail** (adresse dédiée) : **différer** — surface d'attaque et
   modération à cadrer ; API v1 d'abord.
5. **Rapports planifiés envoyés automatiquement** : **brouillon + notification
   uniquement** ; envoi externe après validation humaine.
6. **Consolidation multi-devises** : **devise de référence + taux saisis par période**
   (pas de flux de change externe).
7. **Migration `montantBrut/recuperations`** : **conserver comme agrégat** et introduire
   les lignes de perte en parallèle (rétrocompatible, pas de rupture d'export).
8. **Régimes de notification** : **catalogue livré + régimes personnalisés**, avec
   avertissement « aide au suivi, ne vaut pas déclaration » (aligné sur l'existant DORA).

---

## 10. Lots, effort et critères d'acceptation globaux

| Lot | Contenu | Effort | Dépend de |
|---|---|---|---|
| L1 | Régimes de notification (B-INC-1), pertes multi-composantes (B-PER-1/2/4), types d'événement (B-INC-2) | Élevé | — |
| L2 | Reporting : rapport/gabarit/édition figée/cycle de validation, R-INC-1, R-PER-1/2, R-GRC-3 | Élevé | L1 (données) |
| L3 | Contrôle : plan annuel, conception vs efficacité, typologie, contrôle continu par API, R-CTL-1/2/3 | Moyen | — |
| L4 | Audit : univers/plan pluriannuel, constats structurés, recommandations vérifiées, R-AUD-1/2/3 | Moyen | — |
| L5 | Vocabulaire, champs personnalisés, gabarits sectoriels | Moyen | L1-L4 |
| L6 | Explications + exemples + jeux chargeables (modules récents puis L1-L5) | Moyen, continu | — |

**Critères d'acceptation transverses** (tous lots) : TDD (lib pure + composant testé),
i18n ×5 avec parité, config à 3 niveaux (défaut/org/instance), isolation par
organisation (tests IDOR), gel/rôles respectés, journal d'audit des exports,
`npm run build` vert, **vérification navigateur** des parcours, documentation
(ARCHITECTURE, README) et notes de release rédigées.

---

## 11. Risques

- **Exactitude réglementaire** : un délai ou un intitulé erroné est pire que son
  absence → sourcer à l'implémentation, citer la version, disclaimer « aide au suivi ».
- **Complexité de configuration** : trop d'options tue l'usage → gabarits par défaut,
  réglages avancés repliés, « cas courant » sans aucune configuration.
- **Confidentialité des incidents** : données sensibles (personnes, fraude) → accès par
  rôle, masquage dans les rapports sortants, pas d'envoi externe automatique.
- **Volume** : chaque lot livré et démontrable seul (comme la trajectoire M0→M5).
