# Déclarations d'incidents : incidents types, régulateurs, JSON et relances

Livré le 2 octobre 2026. Complète le module Incidents & pertes (L1) et le moteur DORA (art. 19). **Aide au suivi et à la déclaration : ACRA ne transmet rien à une autorité** ; l'entité dépose elle-même.

## 1. Incidents types (`lib/incident-types-catalogue.ts`)

28 incidents types, cherchables et à sélectionner depuis « Déclarer un incident » (`IncidentTypePicker`) :
- **Cyber (14)** : hameçonnage, rançongiciel, déni de service (DDoS), compromission de compte, fuite / exfiltration, logiciel malveillant, intrusion, vulnérabilité exploitée, chaîne d'approvisionnement / prestataire compromis, mauvaise configuration cloud, abus de privilèges, compromission web, fraude au président, perte / vol d'équipement.
- **Autres risques (14)** : panne majeure du SI, défaillance d'un prestataire TIC / cloud, échec d'un changement, perte ou corruption de données, coupure énergie / télécoms, sinistre sur site, intrusion physique, fraude interne, fraude externe sur moyens de paiement, erreur de traitement, envoi erroné de données personnelles, indisponibilité de personnel clé, défaillance d'un fournisseur non TIC, manquement de conformité.

Un type préremplit l'intitulé (5 langues), le type d'événement, la **liste « à compléter »** et les données personnelles possibles ; il **n'invente aucun fait** (ni date, ni chiffre, ni caractère significatif ou majeur). La clé est mémorisée (`Incident.catalogueKey`) : elle sert à suggérer les **obligations à examiner** (régimes de notification du catalogue activés en configuration) et à rappeler l'évaluation DORA pour les incidents liés aux TIC.

## 2. Régulateurs, régimes et délais

Les régulateurs se **sélectionnent dans la configuration des incidents** (activation des régimes ; délais en heures modifiables ; régimes personnalisés). Chaque régime a une **fiche d'information** (`lib/regime-info.ts`, `RegimeInfoBlock`, dans la configuration et dans l'écran Déclaration) : base légale, destinataire, déclencheur, délais, canal, sources. Informations de cadrage tirées des textes publiés, **pas un avis juridique**.

| Régime | Délais publiés | Destinataire / canal |
|---|---|---|
| **DORA** (règlement (UE) 2022/2554 art. 19 ; RTS (UE) 2025/301 art. 5) | initiale : 4 h après la classification « majeur » et ≤ 24 h après la connaissance ; intermédiaire : ≤ 72 h après l'initiale (puis à chaque mise à jour et à la reprise des activités) ; **final : ≤ 1 mois après le rapport intermédiaire (ou sa dernière mise à jour)** ; prolongation au lendemain midi ouvré si week-end / férié, sauf établissements de crédit, CCP, plates-formes de négociation, entités NIS2 | ACPR (France) via OneGate, rapport `DORA_IR`, JSON ; BCE pour les établissements importants |
| **NIS2** (directive (UE) 2022/2555 art. 23) | alerte précoce 24 h ; notification 72 h ; final 1 mois après la notification | CSIRT / autorité nationale |
| **RGPD** (art. 33-34) | 72 h après la connaissance | CNIL |
| **CRA** (règlement (UE) 2024/2847 art. 14, applicable depuis le 11/09/2026) | alerte 24 h ; notification 72 h ; final : vulnérabilité activement exploitée 14 j après la mesure corrective, incident grave 1 mois après la notification | plateforme unique ENISA (art. 16) |
| **SEC 8-K item 1.05** | 4 jours ouvrés après la détermination de la matérialité | EDGAR |
| **NYDFS 23 NYCRR 500.17** | 72 h après la détermination | portail NYDFS |
| **HIPAA** 45 CFR 164.404/406/408 | 60 jours calendaires (personnes ; HHS ≥ 500) | HHS |
| **Agences bancaires fédérales US** (12 CFR 225 N / 53 / 304) | 36 h après la détermination d'un « notification incident » | régulateur fédéral principal |
| **FTC Safeguards Rule** 16 CFR 314.4(j) | 30 jours après la découverte (≥ 500 consommateurs) | FTC |

**Correction livrée** : le rapport final DORA était calculé à 30 jours de la notification initiale ; l'article 5 du RTS 2025/301 le fixe à **un mois après le rapport intermédiaire** (ou sa dernière mise à jour). Les relances (`alertes-dora`) suivent.

Limites connues : CRA (14 jours après le correctif non modélisé), SEC (date de connaissance = date de détermination de la matérialité), NYDFS (rançon et mises à jour non modélisées), **CIRCIA** (CISA : règle finale attendue, non encore publiée au 2 octobre 2026 — 72 h / 24 h rançon — non modélisé), **BCE** : les établissements importants déposent auprès de la BCE selon son outil (eSurfi) ; la BCE n'est pas modélisée comme régime distinct. Délais en jours ouvrés : week-ends exclus, pas de calendrier de jours fériés.

## 3. Écran « Déclaration » (`DeclarationModal`)

Bouton **Déclaration** sur chaque incident (2ᵉ ligne). Par autorité : phases, échéance, statut, case **« formalisée en interne »** avec **date et heure du dépôt** (et référence de l'accusé) — cocher arrête les relances de la phase, décocher la rouvre — export JSON, et « Ajouter un régulateur ». DORA : champs de l'annexe I de l'ITS à compléter.

## 4. Fichiers de déclaration (JSON et Excel)

- **Champs DORA** : annexe II (**glossaire de données**) du règlement d'exécution (UE) 2025/302 — numérotation 1.1 à 4.16 (15 + 10 + 35 + 16 champs), intitulés officiels (anglais), **types** (choix, choix multiple, entier, pourcentage, date-heure UTC ISO 8601, durée `JJ:HH:MM`, montant en milliers, pays ISO 3166 alpha-2, devise ISO 4217, LEI), **listes de valeurs admises** (type de soumission, types d'entité, critères 2.5, découverte 2.7, 3.12, 3.13, 3.17, 3.18, 3.20, **types d'incident 3.23**, **menaces et techniques 3.25**, 3.28, 3.30, 3.31, **causes racines 4.1 / 4.2 / 4.3** hiérarchisées…) et **caractère obligatoire par étape** (toutes étapes / dès l'intermédiaire / final / conditionnel avec sa condition). Texte repris d'une transcription publiée de l'annexe (springlex.eu) ; **à confirmer sur EUR-Lex** (la page EUR-Lex n'est pas lisible par l'outil de recette).
- **Étape cumulative** : le rapport intermédiaire reprend les champs 1 et 2, le final les champs 1 à 4. `missing` = obligatoires sans valeur ; `toCheck` = conditionnels à examiner. Valeurs déduites de l'incident (jamais inventées) : critères de classification, chronologie, clients / transactions, durées, pertes (en milliers), cause, type et menaces suggérés par l'incident type ; la saisie prime.
- **JSON** `GET /api/incidents/[id]/declaration?regime=DORA&stage=INITIAL|INTERMEDIATE|FINAL` (schéma pivot `acra.dora-incident-report/1`) et schéma commun `acra.incident-notification/1` pour les autres régimes.
- **Excel** (`&format=xlsx&lang=fr|en|de|es|it`) : feuille « Lisez-moi » (incident, source, mise en garde, légende) + une feuille par étape (N°, champ, type, obligatoire, condition, valeur, statut, valeurs admises) ; régimes non DORA : fiche « Déclaration ». Neutralisation des formules (CWE-1236).
- **Saisie typée** dans l'écran Déclaration : listes officielles, cases à cocher (causes racines groupées), booléens, dates-heures (saisies en heure locale, enregistrées en UTC), durées, pays, LEI ; les valeurs hors liste sont refusées.
- **Ce que ce JSON n'est pas** : le **format de dépôt de l'ACPR**. L'ACPR collecte les incidents DORA par **OneGate** (domaine DSB banque / DSA assurance), rapport `DORA_IR`, **fichier JSON validé par le schéma officiel `DORA_IR_Schema` (v1.3) et les règles de validation `DORA IR Validation Rules` (v1.4, XLSX publié sur eSurfi)**, sans signature électronique, avec courriel de repli quand OneGate est indisponible (0 h–4 h, dimanche) ; les établissements importants déposent auprès de la BCE selon son outil. Le fichier de schéma n'est pas publié en accès libre : **pour produire le JSON exact de dépôt, il faut le fichier `DORA_IR_Schema_v1.3.JSON` (et le guide « DORA IR – V20260910 ») à récupérer sur eSurfi / OneGate** ; le générateur (`buildDoraReportJson`) est conçu pour recevoir ce mappage. Les AES ne publient pas de format commun : « canal, modèles et format établis au niveau national ».
- Droits : 2ᵉ ligne ; exports journalisés.

## 5. Relances

Le cron `alertes-dora` (horaire) couvre désormais **tous les régimes activés** (`lib/alertes-notifications.ts`) : alerte à l'approche de l'échéance (dernier quart du délai, 6 h minimum, 7 jours maximum) puis au retard, **une fois chacune** (clé `REGIME:PHASE:STATUT` dans `Incident.alertesDora`), e-mail urgent localisé aux RSSI / gestionnaires des risques. Les phases « intermédiaire » et « finale » sont relancées dès que leur point de départ (soumission de la phase précédente) est enregistré.

## 6. Correctif associé

`PATCH /api/incidents/[id]` refusait toute mise à jour partielle (« intitulé requis ») : les boutons DORA « marquer soumis » et l'ajout d'un régime ne pouvaient pas aboutir. L'intitulé, l'état et la taxonomie enregistrés valent désormais pour la validation quand le corps ne les fournit pas.
