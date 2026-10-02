# Déclarations d'incidents : incidents types, régulateurs, JSON et relances

Livré le 2 octobre 2026. Complète le module Incidents & pertes (L1) et le moteur DORA (art. 19). **Aide au suivi et à la déclaration : ACRA ne transmet rien à une autorité** ; l'entité dépose elle-même.

## 1. Incidents types (`lib/incident-types-catalogue.ts`)

28 incidents types, cherchables et à sélectionner depuis « Déclarer un incident » (`IncidentTypePicker`) :
- **Cyber (14)** : hameçonnage, rançongiciel, déni de service (DDoS), compromission de compte, fuite / exfiltration, logiciel malveillant, intrusion, vulnérabilité exploitée, chaîne d'approvisionnement / prestataire compromis, mauvaise configuration cloud, abus de privilèges, compromission web, fraude au président, perte / vol d'équipement.
- **Autres risques (14)** : panne majeure du SI, défaillance d'un prestataire TIC / cloud, échec d'un changement, perte ou corruption de données, coupure énergie / télécoms, sinistre sur site, intrusion physique, fraude interne, fraude externe sur moyens de paiement, erreur de traitement, envoi erroné de données personnelles, indisponibilité de personnel clé, défaillance d'un fournisseur non TIC, manquement de conformité.

Un type préremplit l'intitulé (5 langues), le type d'événement, la **liste « à compléter »** et les données personnelles possibles ; il **n'invente aucun fait** (ni date, ni chiffre, ni caractère significatif ou majeur). La clé est mémorisée (`Incident.catalogueKey`) : elle sert à suggérer les **obligations à examiner** (régimes de notification du catalogue activés en configuration) et à rappeler l'évaluation DORA pour les incidents liés aux TIC.

## 2. Régulateurs et régimes

Les régulateurs se **sélectionnent dans la configuration des incidents** (activation des régimes ; délais modifiables ; régimes personnalisés). Catalogue : NIS2 (art. 23), RGPD (art. 33), **CRA** (règlement (UE) 2024/2847, art. 14 : 24 h / 72 h / rapport final 1 mois après la notification), **SEC 8-K item 1.05** (4 jours ouvrés), **NYDFS 23 NYCRR 500.17** (72 h), **HIPAA** 45 CFR 164.404/408 (60 jours), interne. DORA garde son moteur (initiale / intermédiaire / finale). Délais en heures, mois, **jours** et **jours ouvrés** (samedi / dimanche exclus, pas de jours fériés).
Limites connues : CRA — pour une vulnérabilité activement exploitée, le rapport final est à 14 jours après la mesure corrective (non modélisé, à adapter) ; SEC — le délai court à partir de la détermination du caractère significatif (la « date de connaissance » saisie en tient lieu) ; NYDFS — le paiement de rançon (24 h) n'est pas modélisé.

## 3. Écran « Déclaration » (`DeclarationModal`)

Bouton **Déclaration** sur chaque incident (2ᵉ ligne). Par autorité : phases, échéance, statut, case **« formalisée en interne »** avec **date et heure du dépôt** (et référence de l'accusé) — cocher arrête les relances de la phase, décocher la rouvre — export JSON, et « Ajouter un régulateur ». DORA : champs de l'annexe I de l'ITS à compléter.

## 4. JSON de déclaration

- **DORA** (`GET /api/incidents/[id]/declaration?regime=DORA&stage=INITIAL|INTERMEDIATE|FINAL`) : champs numérotés de l'**annexe I du règlement d'exécution (UE) 2025/302** (15 généraux, 10 initiaux, 35 intermédiaires, 16 finaux), intitulés officiels anglais, valeurs déduites de l'incident (critères DORA, chronologie, pertes en **milliers**, cause), compléments saisis prioritaires, liste `missing` des champs vides. Les listes de choix de l'ITS ne sont pas reproduites (texte libre). **Aucun format JSON de dépôt n'est publié par les AES** : le canal et le format sont fixés par l'autorité nationale ; ce fichier est un pivot structuré (schéma `acra.dora-incident-report/1`).
- **Autres régimes** : schéma commun `acra.incident-notification/1` (régime, autorité, phase, échéance, état, faits de l'incident).
- Droits : 2ᵉ ligne ; export journalisé.

## 5. Relances

Le cron `alertes-dora` (horaire) couvre désormais **tous les régimes activés** (`lib/alertes-notifications.ts`) : alerte à l'approche de l'échéance (dernier quart du délai, 6 h minimum, 7 jours maximum) puis au retard, **une fois chacune** (clé `REGIME:PHASE:STATUT` dans `Incident.alertesDora`), e-mail urgent localisé aux RSSI / gestionnaires des risques. Les phases « intermédiaire » et « finale » sont relancées dès que leur point de départ (soumission de la phase précédente) est enregistré.

## 6. Correctif associé

`PATCH /api/incidents/[id]` refusait toute mise à jour partielle (« intitulé requis ») : les boutons DORA « marquer soumis » et l'ajout d'un régime ne pouvaient pas aboutir. L'intitulé, l'état et la taxonomie enregistrés valent désormais pour la validation quand le corps ne les fournit pas.
