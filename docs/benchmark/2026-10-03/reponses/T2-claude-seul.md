# Régimes de déclaration : rançongiciel du 12/10/2026 (banque française, succursale NYDFS)

Réponse rédigée de mémoire, sans consultation de source. Les points marqués « à vérifier » sont des incertitudes explicites.

## 0. Hypothèses et pièges de datation

- Le 12 octobre 2026 est un lundi. Aucun jour férié n'est en jeu sur la période critique (12 au 16 octobre).
- Décalage horaire : Paris est en UTC+2 jusqu'au 25 octobre 2026, New York est en UTC-4 jusqu'au 1er novembre. L'écart est donc de 6 h pendant tout l'incident.
- Faits : chiffrement à 09h00 Paris (03h00 New York), connaissance à 09h15 Paris (03h15 New York).
- Les points de départ diffèrent selon les textes :
  - DORA : « prise de connaissance » de l'incident, et classification comme majeur.
  - RGPD : prise de connaissance de la violation de données, avec un « degré raisonnable de certitude » (lignes directrices EDPB 9/2022).
  - NYDFS et agences fédérales américaines : « détermination » qu'un incident s'est produit.
  - Pour la simplicité, les calendriers ci-dessous supposent que la connaissance ou la détermination intervient à 09h15 le 12/10. C'est l'hypothèse la plus prudente.
- Les délais en heures se comptent en heures calendaires, week-ends compris.

## 1. Régimes à examiner

### 1.1 DORA : incident majeur lié aux TIC (cœur du dispositif UE)

- **Texte d'origine** : règlement (UE) 2022/2554, art. 19, applicable depuis le 17/01/2025. Les délais et contenus sont précisés par le règlement délégué (UE) 2025/301 (RTS contenu et délais) et le règlement d'exécution (UE) 2025/302 (modèles). La classification relève du règlement délégué (UE) 2024/1772. Numéros « à vérifier ».
- **Destinataire** : l'autorité compétente (art. 46 DORA). C'est l'ACPR pour un établissement de crédit, ou la BCE via le MSU si la banque est un établissement important. Le canal exact est « à vérifier » auprès de l'ACPR.
- **Déclencheur** : un incident lié aux TIC classé « majeur » selon les critères de classification (clients, durée, pertes de données, services critiques, impact économique, etc.). Un rançongiciel qui chiffre la maison mère et la succursale est très probablement majeur.
- **Délais** :
  - Notification initiale : 4 h après la classification comme majeur, et au plus tard 24 h après la prise de connaissance. Échéance butoir : 13/10 à 09h15 Paris.
  - Rapport intermédiaire : 72 h après la notification initiale, avec mises à jour ensuite (reprise des activités, demande de l'autorité).
  - Rapport final : au plus tard un mois après le dernier rapport intermédiaire (à vérifier : si l'incident n'est pas résolu, un mois après sa résolution).
- **Obligation liée (art. 19(4))** : informer sans retard indu les clients dont les intérêts financiers sont touchés.
- **Faculté (art. 19(2))** : notification volontaire de cybermenaces importantes.

### 1.2 RGPD : violation de données à caractère personnel

- **Texte d'origine** : règlement (UE) 2016/679, art. 33 (autorité) et art. 34 (personnes concernées).
- **Destinataire** : la CNIL, autorité chef de file si l'établissement principal est en France. Elle dispose d'un téléservice de notification. Si des clients résident dans d'autres États membres, la coopération se fait via le guichet unique.
- **Déclencheur** : violation de données (ici confidentialité par exfiltration, et disponibilité par chiffrement) susceptible d'engendrer un risque pour les personnes.
- **Délai** : 72 h au plus tard après en avoir pris connaissance, « si possible ». Une notification tardive doit être motivée. Une notification par phases est admise (art. 33(4)).
- **Point de départ** : prise de connaissance, c'est-à-dire la certitude raisonnable que des données ont été compromises. Hypothèse prudente : 12/10 à 09h15, donc échéance le 15/10 à 09h15 Paris.
- **Art. 33(5)** : documentation interne de la violation, obligatoire dans tous les cas.
- **Art. 34** : communication aux personnes concernées « dans les meilleurs délais » si le risque est élevé. Les données bancaires de clients exfiltrées par rançongiciel sont à traiter comme un risque élevé probable.
- **Champ d'application** : le RGPD s'applique au traitement du responsable de traitement établi dans l'UE, y compris celui exécuté par la succursale de New York (art. 3(1)).

### 1.3 NYDFS : 23 NYCRR 500.17

- **Texte d'origine** : 23 NYCRR Part 500 (Cybersecurity Requirements for Financial Services Companies), seconde modification de novembre 2023, en vigueur depuis le 01/12/2023.
- **Applicabilité** : la succursale titulaire d'une licence NYDFS est une « covered entity ». Les exemptions limitées de 500.19 ne couvrent pas 500.17(a) (à vérifier).
- **Destinataire** : le Superintendent du NYDFS, via le portail en ligne du NYDFS.
- **Déclencheur (500.17(a))** : un « cybersecurity incident » survenu chez la covered entity, ses affiliés ou un prestataire tiers. Trois critères alternatifs :
  - il nécessite une notification à un organisme gouvernemental ou de supervision ;
  - il a une probabilité raisonnable de nuire sensiblement à une part importante des opérations normales ;
  - il se traduit par le déploiement d'un rançongiciel dans une partie importante des systèmes.
  - Ici les trois critères sont probablement remplis, et la maison mère étant un affilié, l'incident chez elle compte aussi.
- **Délai** : « dès que possible » et au plus tard 72 h après la détermination qu'un incident s'est produit. Hypothèse : 12/10 à 03h15 New York (09h15 Paris), donc échéance le 15/10 à 03h15 New York (09h15 Paris). Obligation continue de mise à jour et de complément.
- **Paiement de rançon (500.17(c))** :
  - notification dans les 24 h suivant le paiement ;
  - dans les 30 jours, description écrite des raisons de la nécessité du paiement, des alternatives envisagées, et des diligences de conformité (dont OFAC).
- **Certification annuelle (500.17(b))** : le 15/04/2027, pour l'exercice 2026. Le contenu devra refléter l'incident ou l'éventuelle non-conformité.

### 1.4 Règle fédérale américaine « Computer-Security Incident Notification »

- **Texte d'origine** : règle interagences, 12 CFR Part 225 Subpart N (Réserve fédérale), 12 CFR Part 53 (OCC) et 12 CFR Part 304 Subpart C (FDIC). Effective depuis le 01/04/2022, conformité depuis le 01/05/2022.
- **Applicabilité** : pour une succursale d'État d'une banque étrangère, c'est la Réserve fédérale qui est concernée. La définition de « banking organization » vise les opérations américaines des organisations bancaires étrangères. À vérifier pour la qualification exacte de la succursale.
- **Destinataire** : le point de contact de supervision de la Federal Reserve Bank compétente (probablement la FRBNY).
- **Déclencheur** : un « notification incident ». C'est un incident informatique qui a perturbé ou dégradé matériellement, ou est raisonnablement susceptible de perturber ou dégrader matériellement, les opérations bancaires, une ligne de métier significative, ou des opérations dont la défaillance menacerait la stabilité financière.
- **Délai** : dès que possible et au plus tard 36 h après la détermination qu'un notification incident s'est produit. Hypothèse : 12/10 à 03h15 New York, donc échéance le 13/10 à 15h15 New York (21h15 Paris). C'est l'échéance la plus courte du dossier après DORA.
- **Nature** : notification informelle (courriel ou téléphone), sans modèle imposé.

### 1.5 SAR : Suspicious Activity Report (FinCEN)

- **Texte d'origine** : Bank Secrecy Act, 31 CFR 1020.320. Guidances FinCEN sur les cyber-événements (FIN-2016-A005) et sur les rançongiciels (FIN-2021-A004). Numéros « à vérifier ».
- **Destinataire** : FinCEN.
- **Déclencheur** : intrusion informatique ou activité suspecte, avec les seuils applicables. Les seuils précis pour un cyber-événement sont « à vérifier ».
- **Délai** : 30 jours calendaires après la détection initiale des faits, ou jusqu'à 60 jours si aucun suspect n'est identifié (à vérifier). Hypothèse : échéance le 11/11/2026.
- **Applicabilité** : les succursales américaines de banques étrangères sont des « banks » au sens du BSA.
- **Règle de confidentialité** : le dépôt d'un SAR est confidentiel, sans information du client.

### 1.6 Loi de programmation LOPMI : dépôt de plainte pour indemnisation cyber

- **Texte d'origine** : loi n° 2023-22 du 24/01/2023 (LOPMI), art. 5, codifié au Code des assurances (art. L. 12-10-1, à vérifier).
- **Destinataire** : police ou gendarmerie (dépôt de plainte).
- **Déclencheur** : atteinte à un système de traitement automatisé de données, avec l'objectif d'obtenir l'indemnisation du sinistre cyber par l'assureur.
- **Délai** : 72 h après la connaissance de l'atteinte par la victime. Échéance probable : 15/10 à 09h15 Paris.
- **Nature** : condition d'indemnisation, non une obligation de déclaration à une autorité de supervision. Elle ne s'applique que si un contrat d'assurance cyber existe.

### 1.7 France : ANSSI (OIV, OSE)

- **Texte d'origine** :
  - OIV : Code de la défense, art. L. 1332-6-2.
  - OSE : loi n° 2018-133 du 26/02/2018 (transposition NIS1).
  - La transposition française de NIS2 (loi « résilience ») est à vérifier quant à son entrée en vigueur à cette date.
- **Destinataire** : l'ANSSI.
- **Déclencheur** : la banque est-elle désignée OIV ou OSE ? De nombreuses grandes banques françaises le sont.
- **Délai** : « sans délai » pour les incidents affectant les systèmes d'information d'importance vitale (OIV) ou les services essentiels (OSE).
- **Statut** : à vérifier, comme condition préalable. L'interaction avec DORA après la fin de NIS1 est à clarifier.

### 1.8 Autres régimes conditionnels

- **MAR** (règlement (UE) 596/2014, art. 17) :
  - Déclencheur : si la banque est cotée en Europe (Euronext Paris par exemple), information privilégiée à communiquer au public « dès que possible ».
  - Report possible sous les conditions de l'art. 17(4), avec information ultérieure de l'AMF.
  - Le sujet « non cotée aux États-Unis » ne dit rien de la cotation européenne.
- **SHIELD Act de New York** (General Business Law § 899-aa) :
  - Déclencheur : n'est applicable que si des résidents de l'État de New York sont touchés par l'exfiltration. Les données exfiltrées sont celles de clients européens, donc a priori non.
  - Délai : 30 jours après la découverte (modification de décembre 2024, à vérifier).
  - Destinataires : personnes concernées, Attorney General, Department of State, State Police, et NYDFS depuis cette modification (à vérifier).
- **CIRCIA** (Cyber Incident Reporting for Critical Infrastructure Act) : règle finale de la CISA (72 h pour les incidents, 24 h pour les paiements de rançon). Son entrée en vigueur à cette date et sa portée pour une succursale étrangère sont à vérifier.
- **Notifications contractuelles** :
  - assureur cyber (souvent 24 à 72 h selon la police) ;
  - SWIFT (Customer Security Programme) ;
  - systèmes de paiement (Fedwire, CHIPS, T2) ;
  - schémas de cartes ;
  - banques correspondantes ;
  - clients institutionnels ;
  - commissaires aux comptes.
- **OFAC et sanctions UE** : pas une déclaration en soi, mais une vérification obligatoire avant tout paiement de rançon (responsabilité objective côté OFAC). L'autodivulgation volontaire à l'OFAC reste une option.
- **Signalement volontaire aux autorités** : CERT-FR / ANSSI, FBI (IC3), US Secret Service.

## 2. Régimes qui NE s'appliquent PAS

| Régime | Raison |
|---|---|
| SEC Form 8-K Item 1.05 (4 jours ouvrés après détermination de matérialité) | Banque non inscrite à la SEC, donc ni émetteur domestique ni obligation 6-K. À écarter sauf programme d'ADR enregistré. |
| NIS2 art. 23 (alerte 24 h, notification 72 h, rapport final 1 mois) | DORA est un acte sectoriel de l'Union qui prime (lex specialis, art. 1(2) DORA et art. 4 NIS2). Statut de la transposition française « à vérifier ». |
| Directive DSP2, art. 96 et lignes directrices EBA sur les incidents majeurs de paiement | Remplacées par DORA depuis le 17/01/2025. |
| OCC 12 CFR Part 53, FDIC Part 304 | Succursale d'État, ni succursale fédérale (OCC) ni établissement assuré (FDIC), sauf preuve contraire. |
| FTC Safeguards Rule (16 CFR 314) | Réservée aux institutions financières non bancaires. |
| GLBA, notification clients américains | Données de clients européens, et non de consommateurs américains, sauf cas contraire. |
| HIPAA | Hors périmètre. |
| Code des postes et communications électroniques L. 226-17-1 (notification des violations par les opérateurs de communications électroniques) | La banque n'est pas un opérateur de communications électroniques. |
| SHIELD Act (§ 899-aa) | À écarter tant qu'aucun résident de l'État de New York n'est touché. Voir 1.8. |

## 3. Calendrier consolidé (heure de Paris, hypothèse : connaissance et détermination à 09h15 le 12/10)

| Échéance | Régime | Remarque |
|---|---|---|
| 12/10, 09h00 | Chiffrement | T0 |
| 12/10, 09h15 | Connaissance | Point de départ prudent de tous les délais ci-dessous |
| 12/10, dès que possible | ANSSI (si OIV ou OSE), MAR (si cotée), assureur cyber, SWIFT et systèmes de paiement | « Sans délai » ou « dès que possible » |
| 12/10, 4 h après classification (13h15 si classification à 09h15) | DORA notification initiale | Butoir absolu : 13/10 à 09h15 |
| 13/10, 09h15 | DORA : 24 h après connaissance | Butoir absolu de la notification initiale |
| 13/10, 21h15 (15h15 New York) | Fed, règle interagences (36 h) | Échéance américaine la plus courte |
| 15/10, 09h15 (03h15 New York) | RGPD art. 33 (72 h) | Notification CNIL, par phases possible |
| 15/10, 09h15 (03h15 New York) | NYDFS 500.17(a) (72 h) | Portail NYDFS |
| 15/10, 09h15 | LOPMI : plainte (72 h) | Condition d'indemnisation |
| 72 h après notification initiale DORA (ex. 16/10 si initiale le 13/10 à 09h15) | DORA rapport intermédiaire | Points de mise à jour ensuite |
| Sans délai, après décision | RGPD art. 34, DORA art. 19(4) | Information des clients |
| 24 h après un paiement éventuel | NYDFS 500.17(c) | Notification du paiement |
| 30 jours après un paiement éventuel | NYDFS 500.17(c) | Justification écrite |
| 11/11/2026 | SAR FinCEN (30 jours) | Calcul indicatif |
| 11/11/2026 | SHIELD Act (30 jours) | Seulement si résidents NY touchés |
| 1 mois après le dernier rapport intermédiaire | DORA rapport final | À vérifier (voir 1.1) |
| 15/04/2027 | NYDFS certification annuelle | Doit refléter l'incident |

## 4. Ce qui relève d'une décision de l'entité

1. **Classification DORA comme incident majeur** : l'entité décide, avec le point de départ du délai de 4 h. Un classement retardé sans motif sérieux serait risqué, car le butoir de 24 h court dès la connaissance, quelle que soit la classification.
2. **Moment de la « connaissance » ou de la « détermination »** :
   - RGPD : certitude raisonnable de la compromission des données.
   - NYDFS et Fed : détermination qu'un incident s'est produit.
   - À documenter, avec une préférence pour la prudence.
3. **Notification aux personnes concernées** : risque « élevé » (RGPD art. 34) et intérêts financiers des clients (DORA art. 19(4)).
4. **Notification volontaire** : cybermenaces (DORA art. 19(2)), CERT-FR, FBI.
5. **Paiement ou non de la rançon** : vérification OFAC et sanctions UE préalable, avec les déclenchements 24 h et 30 jours côté NYDFS, et la question de la prise en charge par l'assureur.
6. **Qualité de l'entité** : OIV ou OSE (ANSSI), cotation en Europe (MAR), établissement important ou non (BCE ou ACPR).
7. **Résidents de l'État de New York touchés** : SHIELD Act.
8. **Dépôt de plainte** : conditionné à l'existence d'une assurance cyber.
9. **SAR** : qualification et seuils, décision de dépôt, confidentialité.
10. **Notifications contractuelles** : calendrier selon chaque contrat.
11. **Mutualisation des canaux** : coordination d'une seule chronologie factuelle cohérente entre ACPR, CNIL, NYDFS, Fed, pour éviter des déclarations divergentes.

## 5. Récapitulatif des incertitudes (« à vérifier »)

- Numéros exacts des règlements délégué et d'exécution DORA (2025/301, 2025/302, 2024/1772).
- Délai exact du rapport final DORA (un mois après le dernier intermédiaire ou après la résolution).
- Canal de notification DORA : ACPR ou BCE.
- Application exacte de la règle fédérale 36 h à une succursale d'État (Fed).
- Seuils FinCEN pour les cyber-événements, numéros des guidances, délai de 60 jours.
- Article du Code des assurances pour la LOPMI.
- Statut de la transposition française de NIS2 et articulation OIV/OSE avec DORA.
- Entrée en vigueur de CIRCIA et sa portée pour une succursale étrangère.
- Calendrier et destinataires du SHIELD Act après la modification de décembre 2024.
- Statut de 500.19 sur 500.17(a).