# Régimes de déclaration : banque française avec succursale NYDFS, rançongiciel du 12/10/2026

**Hypothèses de calcul.** Les calculs partent de T0 = connaissance de l'incident le lundi 12 octobre 2026 à 09h15 (Paris, CEST). Cela correspond à 03h15 à New York (EDT, écart de 6 h). Le 12 octobre 2026 est aussi un jour férié fédéral américain (Columbus Day). Aucune règle ci-dessous ne le prend en compte, mais il peut jouer sur les interlocuteurs américains.

Les faits tirés de l'outil ACRA sont marqués **[outil]**. Mes ajouts, qui ne sont pas dans l'outil, sont marqués **[hors outil]**, et ceux que je ne peux pas garantir sont marqués « à vérifier ». Ce document est un cadrage et non un avis juridique.

## 1. Régimes à examiner

### 1.1 DORA (banque : régime central) [outil]
- **Texte d'origine :** règlement (UE) 2022/2554, art. 19. Le contenu et les délais figurent dans le règlement délégué (UE) 2025/301 (art. 5). Les formulaires sont dans le règlement d'exécution (UE) 2025/302, et la classification dans le règlement délégué (UE) 2024/1772.
- **Destinataire :** l'ACPR, via le portail OneGate (rapport DORA_IR, domaine DSB pour la banque). Si l'établissement est supervisé directement par la BCE, la remise passe par l'ACPR et l'outil BCE.
- **Déclencheur :** incident majeur lié aux TIC, selon la classification du règlement délégué 2024/1772.
  - Un chiffrement des systèmes de la maison mère avec exfiltration de données est très probablement majeur.
  - La qualification reste toutefois une décision de l'entité.
- **Délais :**

| Étape | Délai | Point de départ |
|---|---|---|
| Notification initiale | 4 h après la classification « majeur », **et au plus tard 24 h après la connaissance** | Classification, plafonnée par la connaissance à 09h15 |
| Rapport intermédiaire | 72 h après la notification initiale, puis à chaque mise à jour et à la reprise des activités | Notification initiale |
| Rapport final | 1 mois après le dernier rapport intermédiaire | Dernier rapport intermédiaire |

  - **Échéance plafond de la notification initiale :** mardi 13/10/2026 à 09h15 (Paris). Retarder la classification ne repousse pas ce plafond.
  - **Week-end ou jour férié :** la tolérance (remise avant midi le jour ouvré suivant) est exclue pour les établissements de crédit.
  - **Délai impossible à tenir :** informer l'autorité sans délai, avec les raisons.
- **Portée :**
  - La succursale new-yorkaise n'est pas un « établissement de l'UE ».
  - Mais les systèmes de la maison mère, entité DORA, sont touchés, donc DORA s'applique à l'incident.
  - La façon dont la partie américaine est prise en compte dans la classification est à vérifier (par exemple le périmètre géographique et les clients).

### 1.2 RGPD, art. 33 et 34 [outil]
- **Texte d'origine :** règlement (UE) 2016/679.
- **Destinataire :** la CNIL, via son téléservice. Les personnes concernées sont informées au titre de l'art. 34.
- **Déclencheur :** violation de données personnelles, sauf absence de risque pour les droits et libertés des personnes. L'exfiltration de données de clients européens déclenche ce régime.
- **Délai :** « dans les meilleurs délais » et si possible 72 h au plus tard après avoir pris connaissance de la violation.
  - **Échéance :** jeudi 15/10/2026 à 09h15 (Paris).
  - Au-delà, le retard doit être motivé. La notification peut être faite par phases.
  - Le registre interne des violations est à tenir dans tous les cas.
- **Art. 34 :** la communication aux personnes est exigée si le risque est élevé, « dans les meilleurs délais » (pas de délai chiffré).
- **Point de départ :** la « connaissance » est un degré de certitude raisonnable qu'une violation a eu lieu. Si l'exfiltration n'est confirmée qu'après 09h15, la date retenue peut différer, mais la prudence est de compter depuis 09h15. À vérifier avec le DPO.
- **Autorité chef de file (one-stop-shop) [hors outil] :** le principal établissement étant en France, la CNIL devrait être l'autorité unique pour les clients de l'UE. À vérifier si des filiales ou succursales dans d'autres États membres sont concernées.

### 1.3 NYDFS, 23 NYCRR 500.17 [outil, avec compléments hors outil]
- **Texte d'origine :** 23 NYCRR 500.17 (notices to superintendent).
- **Destinataire :** le Superintendent du NYDFS, via le portail en ligne.
- **Entité couverte :** la succursale titulaire d'une licence NYDFS est une « covered entity ». La maison mère n'a pas besoin de l'être, car le texte vise aussi les incidents survenus chez les affiliées ou chez des tiers prestataires (version amendée en 2023 [hors outil], à vérifier).
- **Déclencheur :** un incident de cybersécurité qui répond à l'un de ces cas.
  - Il doit être notifié à une autre autorité. C'est le cas ici, avec l'ACPR et la CNIL.
  - Il est susceptible de nuire matériellement aux opérations.
  - Il a conduit au déploiement d'un rançongiciel. Ce critère est rempli.
- **Délai :** 72 h après la **détermination** qu'un incident a eu lieu.
  - Échéance conservatrice depuis 09h15 : jeudi 15/10/2026 à 09h15 Paris, soit 03h15 à New York.
  - Le point de départ légal est la détermination, pas la connaissance. L'outil assimile les deux.
- **Obligations complémentaires [hors outil], à vérifier dans le texte en vigueur :**
  - Une mise à jour continue de l'information au Superintendent.
  - En cas de **paiement de rançon**, une notification dans les 24 h suivant le paiement, puis une description écrite dans les 30 jours (raisons du paiement, alternatives envisagées, vérifications de sanctions). L'outil indique que ces éléments ne sont pas modélisés.

### 1.4 Notification bancaire fédérale américaine, 36 h (Computer-Security Incident Notification) [outil]
- **Texte d'origine :** 12 CFR 225 sous-partie N (Fed), 12 CFR 53 (OCC), 12 CFR 304 sous-partie C (FDIC).
- **Destinataire :** le régulateur fédéral principal de l'organisation bancaire, par courriel ou téléphone au point de contact désigné.
- **Déclencheur :** un « incident de notification », c'est-à-dire un incident informatique ayant matériellement perturbé ou dégradé, ou susceptible de perturber ou dégrader, les opérations bancaires.
  - Un chiffrement des systèmes de la succursale correspond vraisemblablement à ce critère.
  - L'appréciation de la matérialité revient à l'entité.
- **Délai :** dès que possible et au plus tard 36 h après la détermination qu'un incident de notification a eu lieu.
  - Échéance conservatrice si la détermination est faite à 09h15 : mardi 13/10/2026 à 21h15 Paris, soit 15h15 à New York.
  - C'est la première échéance américaine, plus courte que le NYDFS.
- **Applicabilité à vérifier :** je ne suis pas certain que la règle couvre une succursale d'une banque étrangère à licence d'État. Je crois que la règle de la Fed vise les opérations américaines des banques étrangères, mais c'est à vérifier avec un conseil américain. Le régulateur principal de la succursale (Fed, OCC ou FDIC) dépend de son statut. La prudence est d'instruire ce régime comme applicable.

## 2. Régimes qui ne s'appliquent pas, et pourquoi

| Régime | Motif d'exclusion |
|---|---|
| **NIS2** (art. 23, directive (UE) 2022/2555) [outil] | Pour une entité financière soumise à DORA, la déclaration DORA tient lieu de déclaration NIS2 (lex specialis). L'outil précise de ne pas déclarer deux fois sans vérifier la règle nationale. Le type « rançongiciel » de l'outil liste NIS2 de façon générique, mais pour une banque DORA prime. |
| **SEC Form 8-K, item 1.05** [outil] | La banque n'est pas cotée aux États-Unis, donc n'est pas une société soumise aux obligations d'information de la SEC. L'item 1.05 vise les sociétés cotées. |
| **HIPAA** (45 CFR 164.404, 164.406 et 164.408) [outil] | Aucune donnée de santé protégée, et la banque n'est ni entité couverte ni partenaire commercial. |
| **FTC Safeguards Rule** (16 CFR 314.4(j)) [outil] | Elle vise les institutions financières non bancaires relevant de la FTC. Une banque relève des agences bancaires. |
| **Cyber Resilience Act**, art. 14 [outil] | Il vise les fabricants de produits comportant des éléments numériques. La banque n'en est pas un, sauf si elle édite et commercialise un logiciel (à vérifier). |
| **Déclaration spécifique PSD2 des incidents de paiement** [hors outil] | DORA a remplacé ce reporting, donc un seul rapport DORA suffit. À vérifier pour d'éventuelles remontées de fraude distinctes. |
| **Régime « INTERNE »** de l'outil | Ce n'est pas un régime réglementaire. Ce sont des valeurs d'exemple modifiables : informer la direction sous 4 h (12/10 à 13h15 Paris) et rendre compte au comité sous un mois (12/11/2026). À adapter à votre gouvernance. |

## 3. Points hors couverture de l'outil, à instruire

Ces points ne sont pas dans l'outil. Je ne les affirme pas : ils sont tous à vérifier.
- **Lois d'État américaines de notification de violation** (par exemple NY SHIELD Act, GBL 899-aa). Elles ne s'appliquent que si des résidents américains sont concernés. L'énoncé ne mentionne que des clients européens, mais la succursale peut détenir des données de résidents américains.
- **CIRCIA** (CISA), qui vise les infrastructures critiques américaines, avec une notification d'incident sous 72 h et une notification de paiement de rançon sous 24 h. Son règlement d'application n'est peut-être pas encore en vigueur.
- **Rapport d'activité suspecte (SAR, FinCEN)** pour la succursale américaine.
- **Plainte pénale** : l'assurance du remboursement d'une rançon est conditionnée en droit français (loi LOPMI de 2023) à un dépôt de plainte sous 72 h après la connaissance, soit jeudi 15/10/2026 à 09h15. À vérifier si la banque a une police cyber couvrant les rançons.
- **ANSSI / CERT-FR** : signalement volontaire, hors obligation DORA.
- **Sanctions (OFAC)** : un paiement de rançon est à vérifier au regard des sanctions américaines avant toute décision.

## 4. Calendrier consolidé (hypothèse : T0 = 12/10/2026 09h15 Paris = 03h15 New York)

| Échéance (Paris) | New York | Régime | Remarque |
|---|---|---|---|
| Lun. 12/10, 13h15 | 07h15 | Interne (exemple) | Information de la direction (4 h). Valeur d'exemple de l'outil. |
| Dès la classification, plafond **mar. 13/10, 09h15** | 03h15 | DORA : notification initiale | 4 h après la classification « majeur », plafond absolu 24 h après T0. |
| **Mar. 13/10, 21h15** | 15h15 | Fed/OCC/FDIC : 36 h | Si applicable. Départ à la « détermination ». |
| **Jeu. 15/10, 09h15** | 03h15 | RGPD art. 33 : CNIL | 72 h après la connaissance. |
| **Jeu. 15/10, 09h15** | 03h15 | NYDFS 500.17(a) | 72 h après la détermination (conservateur : T0). |
| Jeu. 15/10, 09h15 | 03h15 | Plainte pénale | Si assurance du remboursement de rançon. Hors outil, à vérifier. |
| Notification initiale + 72 h | | DORA : rapport intermédiaire | Au plus tard ven. 16/10 à 09h15 si la notification initiale part au plafond. Puis à chaque mise à jour et à la reprise des activités. |
| Paiement + 24 h, puis paiement + 30 jours | | NYDFS 500.17(c) | Seulement si une rançon est payée. Hors outil, à vérifier. |
| Sans délai fixe | | RGPD art. 34 | Communication aux personnes si risque élevé. |
| Dernier rapport intermédiaire + 1 mois | | DORA : rapport final | Exemple : si le dernier rapport intermédiaire est le 16/10, échéance lun. 16/11/2026. |
| Mois du 12/11/2026 | | Interne (exemple) | Compte rendu au comité (1 mois). |

## 5. Décisions qui relèvent de l'entité

1. **Classification DORA « incident majeur »** (règlement délégué 2024/1772). Elle déclenche le délai de 4 h. Le plafond de 24 h après la connaissance court quoi qu'il arrive.
2. **Date de la « détermination »** pour le NYDFS et pour la règle fédérale 36 h. Une détermination tardive est une décision risquée, car la détermination doit intervenir sans retard déraisonnable. La prudence est de partir de T0.
3. **Évaluation du risque RGPD** (art. 33, puis art. 34) et date de « connaissance » de l'exfiltration. Décision du responsable de traitement, avec avis du DPO.
4. **Applicabilité à la succursale** de la règle fédérale 36 h, selon son statut et son régulateur, avec un conseil américain.
5. **Paiement ou non d'une rançon**, qui déclenche des notifications complémentaires NYDFS et un examen de sanctions.
6. **Dépôt de plainte** et déclaration à l'assureur.
7. **Une notification unique ou des notifications séparées** selon les autorités (ACPR, CNIL, NYDFS, régulateur fédéral). Les contenus doivent rester cohérents entre eux, et DORA exige que certains champs ne changent pas entre la notification initiale et le rapport final.

## Appels d'outils réalisés
1. `acra-tool.ts read_notification_regimes '{}'` : liste des 10 régimes, avec texte, destinataire, déclencheur et délais. Source de la plupart des faits ci-dessus.
2. `acra-tool.ts read_incident_types '{}'` : le type « cyber.ransomware » est rattaché à NIS2 et RGPD_33, avec TIC et données personnelles à vrai. Pas de rattachement NYDFS ou DORA dans cette liste.
3. `acra-tool.ts read_catalogue '{}'` : sans apport utile pour la question.