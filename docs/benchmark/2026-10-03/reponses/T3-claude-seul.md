# EBIOS RM, Ateliers 1 à 3 : cabinet de groupe de 6 médecins généralistes

Échelle utilisée pour la gravité et la vraisemblance : 1 = mineure, 2 = significative, 3 = grave, 4 = critique.

Hypothèses : environ 6 000 à 8 000 patients de file active, un éditeur SaaS de logiciel de gestion de cabinet (LGC), et des remplaçants saisonniers (étés, hiver, congés). Le cabinet a deux ou trois secrétaires et pas d'informaticien, donc l'éditeur et un prestataire d'infogérance sont des tiers critiques.

---

## ATELIER 1 : Cadrage et socle de sécurité

### 1.1 Valeurs métier (5)

| # | Valeur métier | Description spécifique | Propriétaire | Besoin DICP dominant |
|---|---|---|---|---|
| VM1 | Dossier médical patient (DMP local du LGC) | Antécédents, observations, ordonnances, résultats d'examens, courriers de spécialistes, données de santé au sens de l'art. 9 RGPD, couvertes par le secret médical (art. L.1110-4 CSP) | Médecin titulaire du patient, responsable de traitement conjoint pour le cabinet | Confidentialité et intégrité |
| VM2 | Continuité des consultations et de la permanence de soins | Accès au dossier, prescription et agenda pendant les heures d'ouverture. Une panne de plus de 4 h dégrade la prise en charge, notamment pour les patients chroniques et les urgences relatives | Médecins associés | Disponibilité |
| VM3 | Facturation et télétransmission SESAM-Vitale | Production des feuilles de soins électroniques (FSE), tiers payant, rapprochement des paiements CPAM et mutuelles. Il en dépend la trésorerie du cabinet et sa conformité vis-à-vis de l'Assurance Maladie | Médecin gestionnaire, secrétariat | Intégrité et disponibilité |
| VM4 | Échanges sécurisés avec les confrères et les patients | Messagerie sécurisée de santé (MSSanté), adressage de patients, comptes rendus d'hospitalisation, résultats de biologie | Médecins | Confidentialité et intégrité |
| VM5 | Réputation et relation de confiance avec la patientèle | Confiance des patients et du Conseil de l'Ordre, base du cabinet de groupe. La fuite de données de santé en est le risque principal | Médecins associés | Image et conformité |

### 1.2 Biens supports (5)

| # | Bien support | Valeurs métier supportées | Particularité |
|---|---|---|---|
| BS1 | LGC hébergé chez l'éditeur (SaaS, hébergeur HDS) et comptes utilisateurs associés | VM1, VM2, VM3 | Le cabinet ne maîtrise ni les sauvegardes ni les correctifs. Il dépend de la certification HDS et du contrat de service. Comptes partagés fréquents sur les postes de consultation |
| BS2 | Postes de travail des cabinets (6 salles de consultation plus accueil) et lecteurs de cartes CPS/Vitale | VM1, VM2, VM3 | Sessions laissées ouvertes entre deux consultations, cartes CPS en lecteur toute la journée, imprimantes réseau |
| BS3 | Box internet grand public et réseau local (Wi-Fi) | VM2, VM3, VM4 | Mot de passe d'administration par défaut, firmware rarement mis à jour, un seul réseau mêlant postes médicaux, Wi-Fi patients et objets connectés (ECG, tensiomètre, imprimante) |
| BS4 | Comptes et cartes d'authentification : CPS/e-CPS, comptes des remplaçants, boîte MSSanté | VM1, VM3, VM4 | Remplaçants avec cartes CPS temporaires ou, plus souvent, emprunt des identifiants d'un titulaire. Comptes non désactivés après le départ |
| BS5 | Flux de télétransmission et de sauvegarde (FSE vers l'Assurance Maladie, exports vers l'éditeur) | VM3, VM2 | Chaîne dépendant de l'éditeur, de l'opérateur télécom et du service SESAM-Vitale |

### 1.3 Événements redoutés (4)

| # | Événement redouté | Valeur(s) impactée(s) | Impact | Gravité |
|---|---|---|---|---|
| ER1 | Divulgation ou publication massive des dossiers médicaux des patients (fuite et revente ou chantage) | VM1, VM5 | Atteinte à la vie privée de milliers de patients (pathologies, santé mentale, IVG, VIH), notification CNIL sous 72 h et information des patients, sanction CNIL, saisine ordinale, perte de confiance durable | 4 (critique) |
| ER2 | Indisponibilité prolongée du LGC et du dossier patient (rançongiciel chez l'éditeur ou au cabinet) pendant plus de 72 h | VM2, VM3 | Consultations en mode dégradé sans historique (risque d'erreur de prescription, d'interaction ou d'allergie), perte du chiffre d'affaires de 3 à 5 jours, report des soins chroniques | 3 (grave) |
| ER3 | Altération ou falsification de données de santé ou de facturation (ordonnance modifiée, actes fictifs, fausses FSE) | VM1, VM3 | Risque pour le patient en cas de traitement erroné. Facturation frauduleuse à l'Assurance Maladie imputée au médecin, contrôle CPAM et indus, poursuites éventuelles | 3 (grave) |
| ER4 | Usurpation de l'identité professionnelle d'un médecin (CPS ou compte MSSanté détournés) | VM3, VM4, VM5 | Prescriptions frauduleuses (stupéfiants, arrêts de travail), envois de données à de faux confrères, hameçonnage de patients au nom du cabinet | 3 (grave) |

Point de justification : la gravité 4 est réservée à ER1, car la donnée de santé est irréversible une fois divulguée. L'indisponibilité (ER2) est jugée à 3 car l'activité peut se poursuivre en mode papier dégradé.

### 1.4 Socle de sécurité (écarts constatés, à traiter en priorité)

- Référentiel : PGSSI-S de l'ANS, exigences HDS pour l'hébergeur, guide de l'ANSSI pour les TPE/PME, règles Ordre des médecins, RGPD.
- Écarts probables : authentification par mot de passe partagé, absence de MFA sur le LGC, absence de procédure d'arrivée et de départ des remplaçants, box non durcie, sauvegarde locale inexistante, pas de registre des traitements à jour, pas d'AIPD, aucune sensibilisation formelle.

---

## ATELIER 2 : Sources de risque (3)

| # | Source de risque | Objectif visé (OV) | Motivation | Ressources | Pertinence |
|---|---|---|---|---|---|
| SR1 | Cybercriminels opportunistes (affiliés rançongiciel) | Extorquer le cabinet ou l'éditeur par chiffrement et menace de divulgation (double extorsion) | Lucrative. Les établissements de santé sont ciblés car la pression est forte et les moyens de défense faibles | Élevées. Kits de phishing, accès initiaux achetés auprès de courtiers, outils prêts à l'emploi | Forte |
| SR2 | Revendeurs de données de santé et fraudeurs à l'Assurance Maladie | Exfiltrer des bases de dossiers (identité, NIR, pathologies) pour revente, usurpation d'identité ou fraude aux remboursements et aux ordonnances | Lucrative. Le NIR associé à des données de santé a une grande valeur sur le marché noir | Moyennes à élevées. Réseaux organisés, ciblage de l'éditeur de LGC (attaque sur de nombreux cabinets à la fois) | Forte |
| SR3 | Initié malveillant ou négligent : remplaçant, ancien salarié ou secrétaire | Consulter des dossiers de proches, de célébrités ou de personnalités locales, copier la patientèle avant un départ, ou subir une erreur de manipulation | Curiosité, vengeance, avantage concurrentiel (reprise de patientèle), ou simple erreur (le cas négligent) | Faibles en technique mais accès légitime direct | Moyenne à forte |

Source écartée avec justification : un État-nation n'est pas retenu, car aucune valeur du cabinet ne présente un intérêt stratégique, sauf cas particulier d'un patient exposé.

---

## ATELIER 3 : Scénarios stratégiques (3)

Échelle de vraisemblance : 1 = peu probable, 2 = possible, 3 = probable, 4 = très probable.

### SS1 : Compromission de l'éditeur du LGC (attaque de la chaîne d'approvisionnement)

- Source : SR2, avec SR1 possible.
- Chemin d'attaque : l'attaquant compromet l'éditeur du LGC ou son prestataire d'infogérance (accès administrateur volé par hameçonnage, vulnérabilité sur le portail web). Il exfiltre les bases de plusieurs centaines de cabinets, dont celle du cabinet, puis les revend ou exerce un chantage.
- Valeurs ciblées : VM1, VM3, VM5. Événements redoutés : ER1 (principal), ER2.
- Partie prenante critique : éditeur du LGC. Cabinet très dépendant, avec une maîtrise de sécurité quasi nulle sur ce tiers.
- Gravité : 4, car le cabinet est exposé à des milliers de dossiers sans pouvoir agir.
- Vraisemblance : 3. Plusieurs fuites de grands éditeurs de LGC et de plateformes de santé ont déjà été publiées en France depuis 2021.
- Niveau de risque : élevé (4 x 3).
- Mesures stratégiques : clauses contractuelles (audit, notification sous 24 h, certification HDS et ISO 27001 vérifiées), cartographie du sous-traitant, plan de réponse pour la notification CNIL.

### SS2 : Hameçonnage du secrétariat ou d'un médecin puis rançongiciel sur le poste et la box

- Source : SR1.
- Chemin d'attaque : faux mail Assurance Maladie ou faux courriel de patient avec pièce jointe. Le poste de l'accueil est compromis, puis rebond via le réseau local mal cloisonné, accès à la session ouverte du LGC, chiffrement des postes, des sauvegardes locales et de la box, éventuellement exfiltration préalable des exports.
- Valeurs ciblées : VM2, VM3, VM1. Événements redoutés : ER2 (principal), ER1.
- Parties prenantes : secrétariat, remplaçants (peu formés), prestataire informatique du cabinet.
- Gravité : 3.
- Vraisemblance : 4. C'est le scénario le plus fréquent dans les cabinets de santé, avec un réseau à plat, des mots de passe faibles et une box sans mise à jour.
- Niveau de risque : élevé (3 x 4).
- Mesures stratégiques : sensibilisation avec exercices de phishing, séparation des réseaux (VLAN ou box professionnelle avec pare-feu), sauvegardes hors ligne testées, MFA, procédure de fonctionnement dégradé (agenda papier, ordonnancier de secours).

### SS3 : Abus d'accès par un remplaçant saisonnier ou un ancien collaborateur

- Source : SR3.
- Chemin d'attaque : le remplaçant utilise les identifiants d'un titulaire (partage de CPS, compte commun) pour parcourir des dossiers sans lien avec sa mission. Il peut aussi exporter la patientèle, ou falsifier des actes (facturation à son profit). Les comptes ne sont pas révoqués à son départ, ce qui permet un accès différé. Le vecteur peut être MSSanté (envoi de dossiers vers une boîte privée).
- Valeurs ciblées : VM1, VM4, VM3, VM5. Événements redoutés : ER3, ER4, ER1 (à moindre échelle).
- Parties prenantes : remplaçants, médecins titulaires, éditeur (journalisation et gestion des droits).
- Gravité : 3. L'impact est limité à un nombre restreint de dossiers mais touche au secret médical et à la responsabilité pénale du cabinet.
- Vraisemblance : 3. Le turnover saisonnier combiné à l'absence de profil de droits et de revue des accès rend l'événement probable, même si l'intention malveillante reste minoritaire.
- Niveau de risque : élevé (3 x 3).
- Mesures stratégiques : comptes nominatifs avec droits limités à la période de remplacement, usage de la e-CPS propre au remplaçant, journalisation et revue trimestrielle des accès, convention de remplacement avec clause de confidentialité, procédure de départ avec révocation immédiate.

---

### Synthèse de la cartographie

| Scénario | Source | Événement(s) redouté(s) | Gravité | Vraisemblance | Risque |
|---|---|---|---|---|---|
| SS1 Compromission de l'éditeur LGC | SR2 (et SR1) | ER1, ER2 | 4 | 3 | 12 |
| SS2 Phishing puis rançongiciel local | SR1 | ER2, ER1 | 3 | 4 | 12 |
| SS3 Abus d'accès d'un remplaçant | SR3 | ER3, ER4, ER1 | 3 | 3 | 9 |

Prochaine étape (Atelier 4) : décliner chaque scénario stratégique en scénarios opérationnels. Les trois priorités de traitement ressortant de l'atelier 3 sont, dans l'ordre : le contrat et l'audit de l'éditeur, le cloisonnement du réseau et la sauvegarde hors ligne, puis la gestion des accès des remplaçants.

Référentiels cités de mémoire, à vérifier à la source officielle avant d'être repris tels quels dans ACRA : PGSSI-S (ANS), RGPD (règlement UE 2016/679 sur EUR-Lex), art. L.1110-4 du Code de la santé publique, hébergement de données de santé (HDS).
