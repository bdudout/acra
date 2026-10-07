# Rançongiciel du 12 octobre 2026 : banque française avec succursale new-yorkaise sous licence NYDFS

Cadrage : ceci n'est pas un avis juridique, les points signalés « à vérifier » doivent être confirmés auprès des autorités ou du conseil.

## 0. Faits et hypothèses de calcul

- Le chiffrement date du lundi 12 octobre 2026, 09h00 (Paris). La banque en a eu connaissance à 09h15 (Paris), soit 03h15 à New York (EDT, UTC-4). Le décalage horaire est de 6 h à cette date. Le changement d'heure européen a lieu le 25 octobre et le changement américain le 1er novembre, donc après les échéances à court terme.
- Les calculs ci-dessous prennent 09h15 le 12 octobre comme point de départ pour tous les régimes. C'est l'hypothèse la plus prudente. Pour certains régimes, le point de départ est une « détermination » ou une qualification faite par la banque. Il peut alors être légèrement postérieur, mais il doit être documenté et ne pas être retardé artificiellement.
- Le 12 octobre 2026 est un jour férié fédéral américain (Columbus Day). Cela n'a pas d'effet sur les délais calculés en heures calendaires ci-dessous, mais cela peut gêner les contacts avec les autorités américaines.
- Le week-end du 17-18 octobre ne tombe sur aucune échéance en heures. Aucun report vers un jour ouvré n'est donc en jeu.

## 1. Régimes à examiner (applicables ou très probablement applicables)

### 1.1 DORA, déclaration d'incident majeur lié aux TIC

- **Textes** : règlement (UE) 2022/2554, art. 19 ; règlement délégué (UE) 2025/301, art. 5 (contenu et délais) ; règlement d'exécution (UE) 2025/302 (formulaires et modèles) ; règlement délégué (UE) 2024/1772 (classification).
- **Destinataire** : l'ACPR, via OneGate (rapport DORA_IR, domaine DSB pour une banque). Si la banque est un établissement important sous supervision directe de la BCE, la remise passe par l'ACPR vers la BCE (point à confirmer selon le statut).
- **Déclencheur** : un incident majeur lié aux TIC, selon les critères du règlement délégué 2024/1772. Un rançongiciel qui paralyse les systèmes de la maison mère, avec exfiltration de données de clients, sera très probablement qualifié de majeur. Le détail des seuils est à vérifier.
- **Délais** :
  - Notification initiale : 4 h après la classification « majeur », et au plus tard 24 h après la connaissance de l'incident. Échéance butoir : **13 octobre 2026, 09h15 (Paris)**, soit 03h15 à New York.
  - Rapport intermédiaire : au plus tard 72 h après la notification initiale. Si la notification initiale est remise à l'échéance butoir, le rapport intermédiaire est dû au plus tard le 16 octobre à 09h15. Il est mis à jour à chaque changement pertinent et dès la reprise des activités habituelles.
  - Rapport final : au plus tard un mois après le dernier rapport intermédiaire (ou sa dernière mise à jour). La date exacte dépend de cette mise à jour : à titre d'exemple, un rapport intermédiaire remis le 16 octobre donne une échéance autour du 16 novembre.
- **Report de week-end** : l'allongement jusqu'au jour ouvré suivant, avant midi, est exclu pour les établissements de crédit.
- **Point d'attention** : si un délai est impossible à tenir, l'autorité doit être informée sans délai, avec les raisons.
- **Information des clients** : l'art. 19, § 3 de DORA impose d'informer sans retard indu les clients dont les intérêts financiers sont ou peuvent être affectés. Le délai exact n'est pas chiffré. Le périmètre est à vérifier.
- **Succursale new-yorkaise** : la déclaration DORA est portée par l'entité financière de l'UE, c'est-à-dire la maison mère. Elle couvre l'incident tel qu'il affecte l'entité et le groupe. La portée précise pour une succursale de pays tiers est à vérifier.

### 1.2 RGPD, art. 33 (CNIL) et art. 34 (personnes concernées)

- **Texte** : règlement (UE) 2016/679, art. 33 et 34.
- **Destinataire** : la CNIL, autorité de contrôle chef de file si l'établissement principal est en France et que le traitement est transfrontalier. Elle relaie ensuite aux autres autorités concernées (guichet unique). Les personnes concernées sont destinataires au titre de l'art. 34.
- **Déclencheur** : une violation de données à caractère personnel, sauf si elle n'est pas susceptible d'engendrer un risque pour les droits et libertés des personnes. Ici, l'exfiltration de données clients rend une notification quasi certaine.
- **Délai** : dans les meilleurs délais et, si possible, 72 h au plus tard après en avoir pris connaissance. La notification peut se faire par phases (art. 33, § 4). Échéance indicative : **15 octobre 2026, 09h15 (Paris)**. Au-delà, le retard doit être motivé.
- **Point de départ** : selon les lignes directrices du CEPD, le responsable de traitement a connaissance de la violation lorsqu'il a un degré raisonnable de certitude que des données personnelles sont compromises. Si l'exfiltration n'est confirmée que plus tard, le point de départ peut être postérieur au 12 octobre à 09h15. La prudence recommande de ne pas s'appuyer sur cet argument sans l'avoir documenté.
- **Art. 34** : communication aux personnes concernées « dans les meilleurs délais » si le risque est élevé. Il n'y a pas de délai chiffré.
- **Inscription au registre interne** : obligatoire dans tous les cas (art. 33, § 5).
- **Clients d'autres pays** : pour des clients hors UE mais en Europe, comme le Royaume-Uni ou la Suisse, d'autres régimes peuvent s'ajouter (UK GDPR avec l'ICO, loi suisse sur la protection des données). Délais et destinataires à vérifier.

### 1.3 NYDFS, 23 NYCRR 500.17

- **Texte** : 23 NYCRR 500.17 (notices to superintendent), dans sa version modifiée en vigueur depuis décembre 2023.
- **Destinataire** : le Superintendent du Department of Financial Services de l'État de New York, via le portail de déclaration en ligne du NYDFS.
- **Applicabilité** : la succursale new-yorkaise titulaire d'une licence du NYDFS est une « covered entity ».
- **Déclencheur** : un incident de cybersécurité survenu chez l'entité couverte, chez ses affiliés (donc la maison mère) ou chez un prestataire, si l'un des critères suivants est rempli :
  1. L'incident doit être notifié à une autre autorité. C'est le cas ici avec DORA et le RGPD.
  2. Il est raisonnablement susceptible de nuire de façon importante aux opérations normales.
  3. Il a conduit au déploiement d'un rançongiciel dans une partie importante des systèmes de l'entité. C'est le cas ici : les systèmes de la succursale sont chiffrés.
- **Délai** : dès que possible et au plus tard 72 h après la **détermination** qu'un incident de cybersécurité a eu lieu. Échéance indicative si la détermination date de 09h15 le 12 octobre : **15 octobre 2026, 03h15 EDT (09h15 Paris)**.
- **Obligations continues** : mise à jour du Superintendent et fourniture des informations qu'il demande.
- **Rançon (500.17(c))** : en cas de paiement, notification au Superintendent dans les 24 h suivant le paiement, puis description écrite des motifs, des alternatives envisagées et des diligences (dont les sanctions) dans les 30 jours. Le point de départ exact des 30 jours est à vérifier dans le texte en vigueur.
- **Certification annuelle (500.17(b))** : au plus tard le 15 avril 2027 pour l'année 2026. L'incident peut avoir une incidence sur la possibilité de certifier la conformité (à vérifier).

### 1.4 Notification d'incident informatique des agences bancaires fédérales américaines (« 36 heures »)

- **Textes** : 12 CFR 225 sous-partie N (Réserve fédérale), 12 CFR 53 (OCC) et 12 CFR 304 sous-partie C (FDIC).
- **Destinataire** : le régulateur fédéral principal de l'organisation bancaire. Pour une succursale d'État d'une banque étrangère, ce sera très probablement la Réserve fédérale, ou l'OCC pour une succursale fédérale. L'identification est à vérifier.
- **Déclencheur** : un « incident de notification », c'est-à-dire un incident ayant matériellement perturbé ou dégradé, ou susceptible de perturber ou dégrader, les opérations bancaires, les activités ou la fourniture de produits à une part importante de la clientèle. Le rançongiciel qui chiffre les systèmes de la succursale correspond vraisemblablement à ce critère. La qualification relève de la banque. Je n'ai pas pu confirmer que la règle de la Réserve fédérale vise bien les opérations américaines des banques étrangères : c'est le point principal à faire valider, et c'est lui qui conditionne l'applicabilité de ce régime.
- **Délai** : dès que possible et au plus tard 36 h après la détermination qu'un incident de notification a eu lieu. Échéance indicative : **13 octobre 2026, 15h15 EDT (21h15 Paris)**. Le canal est un courriel ou un appel au point de contact désigné par le régulateur.
- **Point d'attention** : à partir de ce régime, l'échéance de 36 h est la deuxième plus proche après la notification initiale DORA. Elle est souvent oubliée par les banques européennes.

### 1.5 FinCEN, rapport d'activité suspecte (SAR)

- **Texte** : 31 CFR 1020.320.
- **Applicabilité** : elle vise la succursale en tant que banque exerçant aux États-Unis. Elle n'est pas automatique. Pour les incidents cyber, la pratique de FinCEN est de considérer qu'un SAR est attendu quand l'événement atteint les seuils (à vérifier : seuil et nature de l'événement). Les orientations de FinCEN sur les rançongiciels recommandent aussi de déposer un SAR.
- **Délai** : en principe 30 jours calendaires après la détection initiale des faits, porté à 60 jours si aucun suspect n'est identifié (à vérifier). Échéance indicative : **11 novembre 2026**, ou **11 décembre 2026** dans le cas des 60 jours.
- Si une rançon est payée, des obligations de conformité aux sanctions s'ajoutent (voir § 3).

### 1.6 Régimes connexes (à examiner, applicabilité à confirmer)

- **Plainte pénale et indemnisation cyber (loi LOPMI n° 2023-22)** : le dépôt de plainte dans les 72 h suivant la connaissance de l'atteinte est une condition d'indemnisation par l'assureur. Elle ne concerne la banque que si elle a un contrat cyber qui joue. Échéance indicative : 15 octobre 2026, 09h15. L'article du Code des assurances (L12-10-1) est à vérifier. Le dépôt de plainte en France est de toute façon recommandé pour la conservation des preuves.
- **Lois d'État américaines sur les violations de données** (par exemple le NY SHIELD Act, General Business Law § 899-aa) : seulement si des résidents de l'État de New York, ou d'un autre État américain, sont concernés par les données exfiltrées. Les délais et destinataires sont à vérifier, y compris l'information du NYDFS et du procureur général.
- **MAR, art. 17 (règlement (UE) n° 596/2014)** : uniquement si la banque est cotée sur un marché européen (la question n'exclut que la cotation américaine, donc la cotation en Europe est possible). Dans ce cas, une information privilégiée est à communiquer au public dès que possible. Un report est possible sous conditions : art. 17, § 4, et art. 17, § 5 pour les établissements de crédit, avec l'accord de l'autorité compétente (à vérifier).
- **ANSSI, opérateur d'importance vitale ou opérateur de services essentiels** : déclaration sans délai si la banque est désignée comme tel. L'applicabilité dépend de la désignation et de la transposition en vigueur : à vérifier.
- **CIRCIA (États-Unis)** : 72 h pour un incident et 24 h pour un paiement de rançon, mais seulement après l'entrée en vigueur de la règle finale de la CISA. L'état de cette règle en octobre 2026 est à vérifier. L'applicabilité à une entité étrangère opérant sur le sol américain l'est aussi.
- **Notifications contractuelles** : assureur cyber, SWIFT (programme Customer Security Programme), systèmes de paiement (Fedwire, CHIPS), schémas de cartes, banques correspondantes, commissaires aux comptes. Les délais sont propres à chaque contrat. Ils sont souvent de 24 à 72 h : à relever dans les contrats.

## 2. Régimes qui NE s'appliquent PAS (ou pas ici)

| Régime | Motif |
|---|---|
| **NIS2** (directive (UE) 2022/2555, art. 23) | Une banque relève de DORA, qui est le texte sectoriel spécial. La déclaration DORA tient lieu de déclaration NIS2 (art. 1, § 2 de DORA et art. 4 de NIS2). Pas de double déclaration. La transposition française est à vérifier, mais le résultat est le même. |
| **SEC Form 8-K, item 1.05** | La banque n'est pas cotée aux États-Unis, donc pas un émetteur soumis à la SEC. Même si elle l'était comme émetteur privé étranger, le régime 8-K ne s'appliquerait pas à elle. |
| **HIPAA** | Pas d'entité couverte ni de données de santé. |
| **FTC Safeguards Rule (16 CFR 314.4(j))** | Elle vise les institutions financières non bancaires relevant de la FTC. Une banque relève des agences bancaires. |
| **Cyber Resilience Act (règlement (UE) 2024/2847, art. 14)** | Il vise les fabricants de produits comportant des éléments numériques. Une banque n'est pas fabricant pour ses systèmes internes. |
| **Notification d'incident majeur de paiement (DSP2, art. 96)** | Elle est absorbée par DORA depuis son entrée en vigueur. Il n'y a pas de déclaration distincte. |
| **Régimes sectoriels santé (ARS, CERT Santé)** | Hors secteur. |

## 3. Ce qui relève d'une décision de l'entité

1. **Qualification « majeur » DORA** et date de la classification. Elle déclenche le délai de 4 h. Elle doit être faite rapidement et de façon documentée, avec l'analyse au regard du règlement délégué 2024/1772.
2. **Date de connaissance de l'exfiltration de données personnelles** (RGPD) et **date de la « détermination »** (NYDFS, agences fédérales). La décision doit être motivée et conservée au dossier.
3. **Qualification « incident de notification »** aux agences bancaires fédérales américaines.
4. **Risque élevé pour les personnes** (RGPD art. 34) : décision de communiquer ou non aux clients, et modalités.
5. **Information des clients** au titre de DORA, art. 19, § 3.
6. **Paiement ou non de la rançon.** Avant tout paiement : vérification des sanctions (OFAC et UE) et décision d'une éventuelle autodivulgation à l'OFAC. En cas de paiement : notification NYDFS sous 24 h puis dossier de justification sous 30 jours. Un paiement aggrave aussi le risque de SAR et de risque de sanctions.
7. **Dépôt de plainte** (en France et, le cas échéant, aux États-Unis) et partage volontaire avec les autorités (CERT-FR, FBI, CISA, Europol). La décision relève de la banque.
8. **Dépôt d'un SAR** auprès de FinCEN.
9. **Statut de la banque** : cotation européenne (MAR), désignation OIV ou OSE, établissement important sous supervision BCE. Ces faits déterminent des régimes additionnels.
10. **Organisation des dépôts** : une notification groupée NYDFS couvrant la succursale et ses affiliés, et la manière dont les trois dépôts parallèles (ACPR, CNIL, NYDFS) sont coordonnés pour rester cohérents. Les contradictions entre déclarations sont un risque en soi.

## 4. Calendrier consolidé

Les heures sont données à Paris. L'heure de New York (EDT) est entre parenthèses.

| Échéance | Régime | Remarque |
|---|---|---|
| 12 oct. 09h00 (03h00) | Chiffrement | Début de l'incident |
| 12 oct. 09h15 (03h15) | Connaissance | Point de départ prudent de tous les délais |
| Dès classification « majeur » + 4 h | DORA, notification initiale | Plafonné à 24 h après la connaissance |
| **13 oct. 09h15 (03h15)** | DORA, notification initiale (butoir) | Établissement de crédit : pas de report de week-end |
| **13 oct. 21h15 (15h15)** | Agences bancaires fédérales américaines (36 h) | Si l'incident de notification est déterminé à 09h15 |
| **15 oct. 09h15 (03h15)** | RGPD art. 33 (CNIL) | 72 h, notification par phases possible |
| **15 oct. 09h15 (03h15)** | NYDFS 500.17(a) (72 h) | Depuis la détermination |
| 15 oct. 09h15 (03h15) | Plainte (LOPMI) si assurance cyber | Condition d'indemnisation, art. à vérifier |
| 16 oct. au plus tard (09h15 si l'initial est remis au butoir) | DORA, rapport intermédiaire | 72 h après la notification initiale, puis mises à jour |
| Dans les 24 h suivant un paiement | NYDFS 500.17(c) | Seulement si rançon payée |
| Dans les 30 jours | NYDFS 500.17(c) | Seulement si rançon payée, point de départ à vérifier |
| Sans délai chiffré | RGPD art. 34 ; DORA art. 19, § 3 | Information des personnes et des clients |
| **11 nov. 2026** | SAR FinCEN (30 jours) | Ou 11 déc. 2026 si aucun suspect (60 jours) ; à vérifier |
| Un mois après le dernier rapport intermédiaire | DORA, rapport final | Autour du 16 nov. si intermédiaire le 16 oct. |
| 15 avr. 2027 | NYDFS, certification annuelle 2026 | Hors incident, mais à anticiper |

## 5. Points à vérifier (récapitulatif)

- Régulateur fédéral compétent et inclusion des succursales d'État de banques étrangères dans la règle des 36 h.
- Point de départ des 30 jours de l'obligation NYDFS liée à la rançon.
- Seuils et obligation de dépôt d'un SAR pour un rançongiciel.
- Référence exacte de l'article du Code des assurances (LOPMI).
- Statut CIRCIA, désignation OIV ou OSE, cotation européenne (MAR).
- Délais et destinataires des lois d'État américaines et des régimes de protection des données hors UE.
- Portée de la déclaration DORA pour la succursale de pays tiers.

---OUTILS---
- read_notification_regimes {"locale":"fr"}
- read_incident_types {"query":"rançongiciel","limit":3,"locale":"fr"}
- (liste des outils : appel sans argument)