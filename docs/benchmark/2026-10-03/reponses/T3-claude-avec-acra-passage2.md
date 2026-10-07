# Analyse de risques EBIOS RM, ateliers 1 à 3
## Cabinet de groupe de 6 médecins généralistes

**Périmètre.** Six médecins généralistes en cabinet de groupe, avec un secrétariat, des remplaçants saisonniers et un logiciel de gestion de cabinet (LGC) hébergé chez l'éditeur. La télétransmission des feuilles de soins passe par la carte de professionnel de santé (CPS) et le lecteur de carte Vitale. La messagerie sécurisée de santé (MSSanté) sert aux échanges avec les confrères et les laboratoires. L'accès internet se fait par une box grand public.

**Échelles utilisées.** Gravité et vraisemblance vont de 1 (minime/peu vraisemblable) à 4 (critique/quasi certain). Les besoins de sécurité D (disponibilité), I (intégrité), C (confidentialité) et T (traçabilité) sont cotés de 1 à 4.

---

## Atelier 1 : Cadrage et socle de sécurité

### 1.1 Valeurs métier (5)

| # | Valeur métier | Type | Description | Responsable | D | I | C | T |
|---|---|---|---|---|---|---|---|---|
| VM1 | Dossier médical des patients | Information | Antécédents, allergies, traitements, ordonnances, comptes rendus et résultats d'examens, tenus dans le LGC. C'est le cœur de la valeur du cabinet et il relève du secret médical (art. L.1110-4 du Code de la santé publique). | Médecin responsable du cabinet | 3 | 4 | 4 | 3 |
| VM2 | Consultations et continuité des soins | Processus | Agenda, prise de rendez-vous (téléphone et en ligne), visites, renouvellements d'ordonnances. Un cabinet à l'arrêt reporte des soins, y compris pour des patients chroniques ou fragiles. | Secrétariat et médecins | 4 | 3 | 3 | 2 |
| VM3 | Facturation et télétransmission à l'Assurance Maladie | Processus | Feuilles de soins électroniques (FSE), tiers payant, rapprochement des paiements. C'est la trésorerie du cabinet, et le médecin reste responsable des actes facturés en son nom. | Médecins et secrétariat | 3 | 4 | 3 | 4 |
| VM4 | Échanges sécurisés avec les confrères, laboratoires et établissements | Processus | Envoi et réception de comptes rendus, résultats biologiques et courriers d'adressage via MSSanté. Ces échanges alimentent les décisions de prise en charge. | Médecins | 3 | 4 | 4 | 3 |
| VM5 | Accueil et gestion des remplaçants saisonniers | Processus | Droits d'accès nominatifs, carte du professionnel de santé, contrat de remplacement, retrait des accès à la fin du remplacement. Les remplaçants se succèdent, et leurs dates de départ ne sont pas toujours connues des personnes qui gèrent les comptes. | Médecin responsable | 3 | 4 | 4 | 4 |

### 1.2 Biens supports (5)

| # | Bien support | Type | Valeurs soutenues | Particularité du cabinet |
|---|---|---|---|---|
| BS1 | Logiciel de gestion de cabinet hébergé chez l'éditeur (dossier patient, agenda, facturation) | Logiciel, sous-traitance | VM1, VM2, VM3 | Les données sont chez l'éditeur ou son hébergeur. Le cabinet ne maîtrise ni les sauvegardes, ni les accès de maintenance, ni la sécurité de la plateforme. Une certification HDS (hébergeur de données de santé) de l'hébergeur est à vérifier. |
| BS2 | CPS ou e-CPS, lecteur de carte Vitale et postes de consultation | Matériel | VM1, VM3, VM5 | Les postes sont partagés entre associés et remplaçants. Les cartes et leurs codes circulent. Certains postes restent ouverts en consultation. |
| BS3 | Messagerie sécurisée de santé et messagerie courante du secrétariat | Logiciel | VM4, VM1 | La MSSanté est sûre, mais les pièces jointes sont ouvertes sur les postes. La messagerie courante, non sécurisée, reçoit hameçonnage et fausses pièces jointes, par exemple de faux résultats de laboratoire. |
| BS4 | Box internet grand public et réseau local du cabinet (Wi-Fi, imprimantes, objets connectés) | Réseau | VM1, VM2, VM3, VM4 | Mot de passe d'administration souvent d'origine, micrologiciel rarement mis à jour, réseau à plat, Wi-Fi parfois partagé avec la salle d'attente, pas de segmentation. |
| BS5 | Comptes utilisateurs du LGC, de la messagerie et des postes (associés, secrétaires, remplaçants) | Organisation | VM1, VM3, VM5 | Comptes partagés « secrétariat » ou « consultation ». Départ d'un remplaçant sans désactivation. Pas d'authentification forte. |

### 1.3 Événements redoutés (4)

| # | Événement redouté | Valeur métier | Critère | Impacts principaux | Gravité |
|---|---|---|---|---|---|
| ER1 | Fuite et publication des dossiers de patients du cabinet, ou de l'ensemble des clients de l'éditeur | VM1 | C | Atteinte à la vie privée de patients dont les données de santé sont sensibles (RGPD art. 9). Violation du secret médical. Notification CNIL sous 72 h (RGPD art. 33) et information des patients (art. 34). Chantage aux patients. Sanction et perte de confiance. | **4** |
| ER2 | Cabinet à l'arrêt plusieurs jours, avec dossier indisponible (rançongiciel ou panne de l'éditeur) | VM2, VM1 | D | Rendez-vous annulés. Consultations sans antécédents ni allergies sous les yeux du médecin. Renouvellements de traitements chroniques retardés. Facturation suspendue, ce qui pèse sur la trésorerie, avec 6 praticiens et un secrétariat à rémunérer. Perte de données récentes si les sauvegardes sont incomplètes. | **3** |
| ER3 | Altération non détectée des données médicales (allergies, traitements, résultats) | VM1, VM4 | I | Erreur de prescription ou de prise en charge, avec risque physique pour le patient. Mise en cause de la responsabilité du médecin. Détection difficile sans journalisation fine. | **4** |
| ER4 | Facturation frauduleuse ou détournée au nom d'un médecin du cabinet | VM3, VM5 | I, T | Feuilles de soins ou ordonnances fictives imputées au praticien. Indus à rembourser et contrôle de l'Assurance Maladie. Atteinte à la réputation. Difficulté à prouver qui a agi en l'absence de comptes nominatifs. | **3** |

### 1.4 Socle de sécurité (écarts à traiter)
- **Hébergement et éditeur.** Demander le certificat HDS de l'hébergeur, le contrat de sous-traitance (RGPD art. 28) précisant la gestion des incidents, la réversibilité et les sauvegardes, et les accès de maintenance.
- **Comptes.** Comptes nominatifs, authentification forte, désactivation à la date de fin du remplacement. Aucun compte partagé.
- **Postes et réseau.** Mises à jour des postes et de la box, mot de passe d'administration changé, Wi-Fi des patients séparé du réseau médical, pare-feu professionnel ou box dédiée.
- **Sauvegardes.** Copie hors ligne et test de restauration des données qui ne sont pas chez l'éditeur, plus une procédure de repli papier pour les consultations (ordonnances, feuilles de soins sur papier).
- **Sensibilisation.** Hameçonnage et fausses pièces jointes, y compris pour le personnel temporaire.

---

## Atelier 2 : Sources de risque (3)

| # | Source de risque | Objectif visé | Motivation | Ressources | Activité | Pertinence |
|---|---|---|---|---|---|---|
| SR1 | Cybercriminels opportunistes de la rançon (campagnes automatisées de rançongiciel contre les petites structures de santé) | Chiffrer le dossier et les sauvegardes locales pour obtenir une rançon, ou voler puis revendre les données | Lucratif (4) | Moyennes (3) | Forte (4) | **Retenue, 4** |
| SR2 | Cybercriminels spécialisés dans la fraude à l'Assurance Maladie et la revente de données de santé | Utiliser des identifiants, une CPS ou des comptes de télétransmission volés pour facturer à tort, ou monnayer des bases de patients | Lucratif (4) | Moyennes (3) | Moyenne (3) | **Retenue, 3** |
| SR3 | Remplaçant, ancien collaborateur ou secrétaire (menace interne malveillante ou négligente) | Consulter par curiosité, copier ou falsifier des dossiers, facturer pour son compte, ou simplement subir une erreur de manipulation | Curiosité, vengeance, avantage concurrentiel ou négligence (3) | Faibles (2), mais accès légitime | Moyenne (3) | **Retenue, 3** |

**Sources écartées ou à surveiller.** Un acteur étatique est peu pertinent pour un cabinet isolé (le risque passerait par l'éditeur, voir SC3). Un hacktiviste est peu motivé par ce profil. Un attaquant interne spécialisé est écarté, car les moyens d'un cabinet de 6 médecins n'attirent pas un ciblage sur mesure.

---

## Atelier 3 : Scénarios stratégiques (3)

| # | Scénario stratégique | Source | Événement redouté visé | Chemin d'attaque (partie prenante ou bien support) | Gravité | Vraisemblance | Niveau de risque |
|---|---|---|---|---|---|---|---|
| SC1 | Rançongiciel via un courriel piégé ou la box vulnérable, qui chiffre le poste du cabinet, ses partages et ses sauvegardes locales, avec exfiltration préalable des dossiers (double extorsion) | SR1 | ER2 (D), ER1 (C) | Faux résultat de laboratoire ou fausse pièce jointe sur la messagerie courante (BS3), ou box non mise à jour exposée (BS4), puis poste de consultation (BS2). Rebond vers le dossier et les sauvegardes. | **3** (4 en cas d'exfiltration publiée) | **4** | Élevé, prioritaire |
| SC2 | Compromission de l'éditeur du logiciel de cabinet ou de son hébergeur, exposant les bases de tous ses clients, dont celles du cabinet | SR1 et SR2 | ER1 (C), ER2 (D), ER3 (I) | Partie prenante critique : l'éditeur et son hébergeur (dépendance 4, pénétration 3). Accès de maintenance ou faille de la plateforme (BS1). Le cabinet n'a ni visibilité, ni maîtrise des correctifs. | **4** | **2** | Élevé |
| SC3 | Abus d'accès par un remplaçant ou un compte non révoqué : consultation, copie ou modification de dossiers, facturation à tort, par un compte partagé ou resté actif | SR3, et SR2 en cas de vol des identifiants | ER4 (I, T), ER3 (I), ER1 (C) | Comptes partagés ou non désactivés (BS5), CPS et postes partagés (BS2), LGC sans journalisation exploitable (BS1). | **3** | **3** | Élevé |

**Lecture croisée.**
- Pour SC1, la vraisemblance de 4 se justifie par l'automatisation des campagnes, les mises à jour tardives et les sauvegardes locales accessibles depuis le poste. La gravité de 3 passe à 4 si les données sont publiées.
- Pour SC2, la vraisemblance reste faible mais non nulle (2). La gravité maximale tient à l'effet de concentration : une seule faille expose la patientèle de nombreux cabinets. Le cabinet ne peut réduire ce risque que par la contractualisation, la vérification de l'hébergeur et la capacité à continuer de travailler sans le LGC.
- Pour SC3, la vraisemblance de 3 résulte de la rotation saisonnière des remplaçants et de la pratique courante des comptes partagés.
- Un scénario de menace interne ou d'usurpation de la CPS pour fraude à l'Assurance Maladie est couvert par SC3 (volet facturation). Une altération volontaire de données médicales (ER3) par un tiers reste à détailler à l'atelier 4.

## Obligations de notification à anticiper
- **RGPD, art. 33 et 34.** Toute violation de données de santé implique une notification à la CNIL dans les 72 heures après en avoir pris connaissance. Une information des patients s'impose en cas de risque élevé, ce qui est presque systématique pour des données de santé.
- **Signalement des incidents de sécurité des systèmes d'information de santé.** Le portail de signalement national géré par l'Agence du Numérique en Santé (ANS, CERT Santé) existe, et la directive (UE) 2022/2555 (NIS2), art. 23, prévoit alerte précoce sous 24 h, notification sous 72 h et rapport final sous un mois pour les entités concernées. L'applicabilité à un cabinet libéral de cette taille est à confirmer auprès de l'ANS ou d'un conseil juridique. Ce n'est pas un avis juridique.
- **Éditeur de logiciel.** Le contrat doit imposer l'information du cabinet en cas d'incident chez l'éditeur ou son hébergeur, car le cabinet reste responsable de traitement.

## Priorités pour l'atelier 4 et la suite
1. Comptes nominatifs avec authentification forte et procédure d'entrée et de sortie des remplaçants.
2. Cloisonnement du réseau, mise à jour de la box et des postes, et sauvegarde hors ligne testée.
3. Revue contractuelle de l'éditeur : certification HDS, sous-traitance, accès de maintenance, incident, réversibilité.
4. Sensibilisation courte et répétée, adaptée aux remplaçants et au secrétariat.

---OUTILS---
- read_sector_examples {"secteur":"Santé / Médico-social","sousSecteur":"sante-cabinet","locale":"fr"} (OK)
- read_notification_regimes {} (OK, sortie tronquée aux premiers régimes : DORA, NIS2, RGPD_33)
- read_incident_types {"secteur":"Santé / Médico-social"} (refusé : argument inconnu, valides : query, sectors, locale, limit ; non relancé)