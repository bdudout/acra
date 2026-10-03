# T10 — Claude (Opus 5.5) seul

**Télésurveillance médicale de l'insuffisance cardiaque (dispositif connecté → plateforme du fabricant → logiciel de l'opérateur → alertes aux infirmiers et cardiologues)**

Cadre réglementaire :
- Télésurveillance prise en charge dans le droit commun depuis la LFSS 2022 (article de la LFSS et du CSS à vérifier).
- Dispositifs et logiciels relevant du règlement (UE) 2017/745 (dispositifs médicaux), avec un volet cybersécurité (guide MDCG 2019-16).
- HDS, RGPD, PGSSI-S.
- Exigences de l'ANS sur l'interopérabilité et la sécurité des solutions de télésurveillance (à vérifier).

Risques (G = gravité, V = vraisemblance) :
| # | Risque | G | V |
|---|---|---|---|
| R1 | Alerte clinique non transmise ou retardée (panne de la plateforme du fabricant, échec de l'intégration, file de messages bloquée), conduisant à une décompensation non prise en charge | 4 | 3 |
| R2 | Données physiologiques altérées ou attribuées au mauvais patient (erreur d'appariement entre le dispositif et le patient, erreur d'identité, falsification) : fausse alerte ou absence d'alerte, décision médicale erronée | 4 | 2 |
| R3 | Compromission de la plateforme du fabricant (tiers critique), avec fuite des données de santé de l'ensemble des patients | 4 | 2 |
| R4 | Rançongiciel sur le SI de l'opérateur rendant le logiciel de télésurveillance indisponible | 3 | 3 |
| R5 | Vulnérabilité d'un dispositif ou de sa passerelle (Bluetooth, application smartphone) permettant interception ou manipulation | 3 | 2 |
| R6 | Fatigue d'alerte : trop d'alertes non pertinentes, les alertes critiques sont ignorées | 3 | 3 |
| R7 | Accès illégitime aux données par des professionnels ou des tiers : comptes partagés, absence de MFA, accès d'astreinte non tracés | 3 | 2 |
| R8 | Hébergement ou transfert non conforme (fabricant hors UE ou non certifié HDS, flux hors EEE), entraînant une non-conformité HDS ou RGPD et un risque de déremboursement ou de sanction | 3 | 2 |

Mesures de traitement prioritaires :
| # | Mesure | Risques |
|---|---|---|
| M1 | Supervision de bout en bout de la chaîne de télétransmission : messages « heartbeat » par patient, alerte de « silence de données » au-delà d'un seuil, accusé de réception des alertes, escalade automatique si une alerte n'est pas acquittée | R1, R6 |
| M2 | Mode dégradé clinique documenté et testé : bascule vers le portail du fabricant ou vers un appel téléphonique aux patients à risque, astreinte joignable, exercice semestriel | R1, R4 |
| M3 | Identitovigilance : appariement dispositif ↔ patient (INS qualifiée, numéro de série) vérifié à l'installation et à chaque intégration ; contrôle de plausibilité et d'intégrité des données reçues (signature des messages si le fabricant la permet) | R2, R5 |
| M4 | Gestion du tiers critique (fabricant) : certification HDS ou équivalent, contrat (RGPD art. 28 ou responsabilité conjointe à qualifier, niveaux de service de disponibilité et de délai de transmission, notification d'incident, audit), preuve de conformité au règlement 2017/745 et de la gestion des vulnérabilités (SBOM, correctifs), localisation des données dans l'EEE | R3, R5, R8 |
| M5 | Interconnexion sécurisée entre fabricant et opérateur : mTLS / OAuth2, filtrage, validation des messages, journalisation dans le SIEM | R3, R2 |
| M6 | Résilience face au rançongiciel côté opérateur : sauvegardes immuables, EDR, segmentation entre le logiciel de télésurveillance et la bureautique, PRA avec RTO compatible avec la sécurité clinique (quelques heures) | R4 |
| M7 | Contrôle d'accès : comptes nominatifs, MFA ou Pro Santé Connect pour les infirmiers et les cardiologues, revue trimestrielle des droits, traçabilité des consultations | R7 |
| M8 | Paramétrage clinique des seuils d'alerte par patient, validé par le cardiologue et revu périodiquement ; suivi du taux de faux positifs ; formation des infirmiers à la gestion des alertes | R6, R1 |

Points à vérifier dans chaque contexte : numérotation exacte des exigences du référentiel HDS v2 ; état de la transposition de NIS2 en France ; articles exacts de la LFSS et du CSP sur la télésurveillance et le signalement d'incident ; applicabilité de DORA selon le régime prudentiel de la mutuelle ou de l'assureur.
