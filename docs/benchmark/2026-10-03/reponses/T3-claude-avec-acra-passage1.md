# Cabinet de 6 médecins généralistes : EBIOS RM, ateliers 1 à 3

## Cadrage
- Périmètre : cabinet de groupe de 6 médecins et 2 à 3 secrétaires (hypothèse). Il utilise un logiciel de gestion de cabinet (LGC) hébergé chez l'éditeur (SaaS). Les feuilles de soins sont télétransmises à l'Assurance Maladie. Des remplaçants saisonniers interviennent. Il a une messagerie sécurisée de santé (MSSanté) et une box internet grand public.
- Échelles : 1 = mineur, 2 = significatif, 3 = grave, 4 = critique. Les cotations sont des propositions à valider avec les médecins associés.
- Point de contrôle à faire dès l'atelier 1 : confirmer que l'éditeur du LGC est bien certifié HDS (hébergeur de données de santé). Il n'a pas été possible de le vérifier ici.

## Atelier 1 : Cadrage et socle de sécurité

### 5 valeurs métier
| # | Valeur métier | Type | Description spécifique | D/I/C/T (1-4) |
|---|---|---|---|---|
| VM1 | Dossier médical patient (antécédents, ordonnances, comptes rendus, résultats de biologie) | Information | Il couvre environ 8 000 patients. Il contient des données de santé (RGPD art. 9) et des données couvertes par le secret médical. Il est partagé entre les 6 médecins et les remplaçants. | D3 / I4 / C4 / T3 |
| VM2 | Facturation et télétransmission des actes (feuilles de soins électroniques, tiers payant) | Processus | Il assure la trésorerie du cabinet, qui vit des paiements de l'Assurance Maladie. Une erreur ou une fraude est imputée au médecin signataire. | D3 / I4 / C3 / T4 |
| VM3 | Continuité des consultations (agenda, rendez-vous, accueil, ordonnances de renouvellement) | Processus | Sans agenda ni dossier, le cabinet ne peut pas fonctionner. L'agenda sert aussi à repérer les patients chroniques ou fragiles. | D4 / I3 / C2 / T2 |
| VM4 | Échanges sécurisés avec confrères, laboratoires, hôpitaux et pharmacies (MSSanté) | Processus | Les comptes rendus d'hospitalisation, les résultats d'examens et les courriers de spécialistes transitent par cette messagerie. Elle n'est pas facultative pour la coordination des soins. | D3 / I3 / C4 / T3 |
| VM5 | Confiance des patients et réputation du cabinet (secret médical) | Image et conformité | Une fuite dans une commune de taille moyenne se sait vite. La patientèle peut partir et l'Ordre peut être saisi. | D1 / I3 / C4 / T2 |

### 5 biens supports
| # | Bien support | Type | Valeurs métier concernées | Point de vigilance propre au cabinet |
|---|---|---|---|---|
| BS1 | LGC hébergé chez l'éditeur (SaaS, accès par navigateur ou client lourd) et son hébergeur | Logiciel et sous-traitance | VM1, VM2, VM3 | Vérifier la certification HDS, les sauvegardes, la réversibilité et la gestion des comptes éditeur (maintenance à distance). Les médecins ne maîtrisent ni le chiffrement ni les journaux. |
| BS2 | Cartes CPS / e-CPS, lecteurs de cartes Vitale et comptes nominatifs des médecins | Matériel et identité | VM2, VM1 | Les cartes sont souvent laissées dans le lecteur toute la journée. Les codes PIN sont connus des secrétaires. Les remplaçants utilisent la carte du titulaire ou un compte partagé. |
| BS3 | Postes de travail des cabinets (salle de consultation, accueil), imprimante-scanner, clés USB | Matériel | VM1, VM3, VM4 | Ces postes sont souvent mis à jour tardivement. Des comptes génériques sont partagés. Il y a des sauvegardes locales sur disque USB branché en permanence. Les postes accèdent aussi au web (navigation, courriels personnels). |
| BS4 | Box internet grand public et Wi-Fi du cabinet (réseau commun accueil, consultations, éventuellement salle d'attente) | Réseau | VM1 à VM4 | Il n'y a ni segmentation, ni pare-feu professionnel, ni supervision. Le mot de passe d'administration est souvent celui d'usine. Le Wi-Fi est parfois partagé avec les patients. Il y a un seul opérateur et pas de ligne de secours. |
| BS5 | Messagerie sécurisée de santé (MSSanté ou opérateur de messagerie intégré au LGC) et boîtes de messagerie nominatives | Logiciel | VM4, VM1 | Si la messagerie classique sert aussi à échanger des données de santé, le secret n'est plus protégé. Les boîtes sont sensibles à l'hameçonnage ciblé qui imite l'Assurance Maladie ou l'éditeur. |

Ce que le cabinet n'a pas listé mais qu'il faudra ajouter après validation : le personnel (secrétaires, remplaçants) comme bien support humain, et le prestataire informatique local s'il en existe un.

### Socle de sécurité (écarts probables à documenter)
- Comptes partagés, remplaçants sans compte nominatif et sans fin de droits à leur départ.
- Pas de segmentation réseau entre poste administratif, poste médical et Wi-Fi invité.
- Sauvegardes locales non déconnectées et jamais testées.
- Pas de procédure écrite d'incident ni de registre des violations de données.
- Pas de désignation formelle d'un référent sécurité parmi les associés.

## Atelier 2 : Sources de risque (3)

| # | Source de risque | Catégorie | Objectif visé | Motivation | Ressources | Pertinence | Spécificité cabinet |
|---|---|---|---|---|---|---|---|
| SR1 | Groupe cybercriminel opportuniste (rançongiciel automatisé ciblant les petites structures de santé) | Cybercriminel | Chiffrer le dossier patient et les sauvegardes locales, exiger une rançon | Lucratif, motivation forte | Moyennes | Forte (3-4) | Il ne cible pas le cabinet en particulier. Il balaye les box exposées, les accès à distance non protégés et les postes non mis à jour. C'est la source la plus probable. |
| SR2 | Cybercriminel spécialisé dans le vol et la revente de données de santé et la fraude à l'assurance maladie | Cybercriminel (fraude) | Voler des dossiers (identité, numéro de sécurité sociale, pathologies) ou utiliser une CPS/identifiants pour facturer des actes fictifs | Lucratif, motivation forte | Moyennes à élevées | Forte (3) | L'attaque passe par un message d'hameçonnage imitant l'Assurance Maladie ou l'éditeur du LGC, ou par une carte CPS oubliée ou copiée. |
| SR3 | Acteur interne involontaire ou malveillant : remplaçant saisonnier, secrétaire, ancien collaborateur | Interne | Accès non justifié à des dossiers (curiosité, personnalité connue, conflit), ou erreur ou négligence (carte laissée, mot de passe partagé, clé USB infectée) | Curiosité, vengeance ou négligence | Faibles, mais accès légitimes | Moyenne (2-3) | Le turnover des remplaçants rend la gestion des droits difficile. Les accès sont légitimes, donc difficiles à repérer sans journalisation. |

À considérer en plus, non retenu dans les 3 : l'éditeur du LGC (défaillance ou compromission de la chaîne d'approvisionnement). Il apparaît comme partie prenante critique à l'atelier 3.

## Atelier 2 (suite) : Événements redoutés (4, avec gravité)

| # | Événement redouté | Valeur métier | Critère | Impacts | Gravité (1-4) |
|---|---|---|---|---|---|
| ER1 | Fuite massive de dossiers patients (données de santé, identité, numéro de sécurité sociale) | VM1, VM5 | C | Atteinte à la vie privée des patients. Notification de violation à la CNIL (72 h) et information des patients (RGPD art. 33-34). Sanction possible. Poursuites ordinales. Perte de patientèle. | 4 |
| ER2 | Indisponibilité du dossier et de l'agenda pendant plusieurs jours (rançongiciel, panne de l'éditeur ou de la box) | VM1, VM3 | D | Consultations annulées, prescriptions sans historique (risque de prescription inadaptée, allergies, interactions). Perte de revenu. Retard de prise en charge des patients chroniques. | 3 (4 si perte définitive de données de santé sans sauvegarde exploitable) |
| ER3 | Facturation frauduleuse ou erronée imputée au médecin (usurpation de CPS ou d'identifiants, altération des feuilles de soins) | VM2 | I, T | Indus à rembourser, enquête de l'Assurance Maladie, mise en cause personnelle du médecin, atteinte à la réputation. | 3 |
| ER4 | Altération de données médicales (allergies, traitements, résultats modifiés) ou de comptes rendus transmis par la messagerie | VM1, VM4 | I | Risque direct pour la santé d'un patient (erreur de prescription). Responsabilité civile ou ordinale du médecin. Il est difficile à détecter sans journalisation. | 4 |

Remarque d'expert : les événements ER1 et ER4 touchent à la sécurité des patients, pas seulement au patrimoine du cabinet. Il faut donc retenir la gravité maximale même si le volume de données est modeste.

## Atelier 3 : Scénarios stratégiques (3)

L'écosystème est surtout composé de l'éditeur du LGC et de son hébergeur, de l'Assurance Maladie, de l'opérateur de messagerie sécurisée, du prestataire informatique éventuel et des remplaçants. L'éditeur est la partie prenante la plus critique : forte dépendance, forte pénétration (il a accès aux données) et maturité cyber inconnue du cabinet.

| # | Scénario stratégique | Source | Événement redouté | Chemin d'attaque (haut niveau) | Gravité | Vraisemblance |
|---|---|---|---|---|---|---|
| SS1 | Rançongiciel opportuniste sur les postes et les sauvegardes locales | SR1 | ER2 | Exploitation de la box (accès distant ou mot de passe d'usine) ou hameçonnage d'une secrétaire, puis chiffrement des postes et du disque de sauvegarde USB branché. Le SaaS peut rester disponible, mais les documents locaux, les scans et les accès sont perdus. | 3 | 4 |
| SS2 | Compromission de la chaîne d'approvisionnement : accès de maintenance de l'éditeur ou de l'hébergeur détourné pour exfiltrer des dossiers | SR2 | ER1 (et ER4) | Un attaquant compromet l'éditeur du LGC ou un compte de maintenance, puis accède à la base de données de tous les cabinets clients, dont celui-ci. | 4 | 2 |
| SS3 | Détournement des moyens d'authentification (CPS, identifiants, compte de remplaçant non retiré) pour consulter des dossiers et facturer | SR2, SR3 | ER3, ER1 | Hameçonnage imitant l'Assurance Maladie pour obtenir les identifiants, ou carte CPS laissée dans le lecteur, ou compte de remplaçant resté actif après son départ. | 3 | 3 |

Remarques de cotation :
- Le SS2 est peu vraisemblable pour ce cabinet précis, mais sa gravité est critique et le cabinet n'a aucune maîtrise. Il faut donc agir par contrat et par exigences vis-à-vis de l'éditeur, pas par la technique.
- Pour ER4 (altération), un scénario dédié n'a pas été retenu faute de place dans les 3 scénarios. Il est traité par SS3 et à approfondir à l'atelier 4.

## Mesures prioritaires à anticiper pour l'atelier 5
1. Comptes nominatifs pour tous, y compris les remplaçants, avec ouverture et fermeture de droits par date de fin de remplacement. Authentification forte (carte CPS ou e-CPS) et verrouillage de session automatique.
2. Sauvegarde déconnectée du réseau (3-2-1), avec test de restauration annuel.
3. Remplacer la box grand public par un routeur professionnel avec pare-feu. Changer les mots de passe d'usine. Désactiver l'administration à distance. Séparer le Wi-Fi des patients et celui du cabinet.
4. Clauses contractuelles avec l'éditeur : certification HDS, notification d'incident, réversibilité des données, journalisation des accès de maintenance, sauvegarde et plan de reprise.
5. Sensibilisation courte et répétée à l'hameçonnage (faux courriels Assurance Maladie, faux éditeur), avec consigne de signalement.
6. Procédure d'incident écrite : numéro à appeler, qui décide, et rappel que la notification d'une violation de données personnelles à la CNIL est à faire sous 72 h. Un registre des violations est à tenir.

## Ce que les outils couvrent et ne couvrent pas
- Utile : les exemples sectoriels « sante-cabinet » ont servi de socle. Ils fournissent le dossier patient, la facturation, l'agenda, le LGC, la CPS, la messagerie, les rançongiciels opportunistes et l'usurpation d'authentification. Les régimes de notification confirment RGPD art. 33 (72 h, CNIL). Les types d'incidents confirment que le rançongiciel et l'exfiltration relèvent de NIS2 et du RGPD.
- Non couvert, apporté par jugement d'expert :
  - Les remplaçants saisonniers : le catalogue n'a aucun exemple de gestion des droits de remplaçants.
  - La box grand public et la segmentation réseau.
  - L'événement redouté d'altération des données médicales (ER4) et sa dimension de sécurité du patient.
  - La source interne (SR3) et le scénario de chaîne d'approvisionnement chez l'éditeur (SS2). Les exemples ne contiennent que des cybercriminels.
- Limites des régimes : les régimes listés (DORA, NIS2, CRA, SEC, HIPAA...) sont surtout financiers ou américains. Aucun régime propre à la santé en France n'est dans la base (par exemple la déclaration des incidents de sécurité des systèmes d'information de santé au CERT Santé / ANS, ou l'obligation de déclaration des établissements de santé). NIS2 vise des entités importantes ou essentielles : un cabinet de 6 médecins n'est probablement pas dans le champ, à confirmer auprès d'un juriste. Seul le RGPD art. 33 s'applique de façon certaine. Ces points sont à confirmer et ne constituent pas un avis juridique.
- Les cotations de gravité et de vraisemblance sont des propositions de départ à valider avec les associés du cabinet.

## Liste des appels d'outils réalisés
1. `read_sector_examples` avec `{"secteur":"Santé / Médico-social","sousSecteur":"sante-cabinet","locale":"fr"}` : 21 exemples (valeurs métier, biens supports, événements redoutés, sources de risque, scénarios stratégiques, parties prenantes).
2. `read_notification_regimes` avec `{"secteur":"Santé / Médico-social"}` : régimes DORA, NIS2, RGPD_33 et suivants.
3. `read_incident_types` avec `{"secteur":"Santé / Médico-social"}` : 30 types d'incidents.
4. `read_notification_regimes` avec `{}`, filtré sur les codes et destinataires : confirmation qu'aucun régime santé français n'est dans la base.
5. `read_incident_types` avec `{}`, filtré sur les clés : liste complète des types d'incidents.
6. `read_catalogue` avec `{"secteur":"Santé / Médico-social"}` : renvoie des éléments génériques transversaux (processus et risques), aucun contenu propre à la médecine de ville.