# T10 — Claude (Opus 5.5) avec ACRA

**Télésurveillance médicale de patients insuffisants cardiaques (dispositif → plateforme du fabricant → logiciel de l'opérateur → infirmiers et cardiologues)**
ACRA ne propose pas de sous-secteur « télésurveillance ». Je m'appuie sur les risques et contrôles SANTE et TECHNIQUE d'ACRA, marqués [ACRA], et sur mon expertise.

Cadre (expertise) :
- prise en charge de droit commun de la télésurveillance (CSS art. L. 162-48 et suivants, à vérifier) ;
- règlement (UE) 2017/745 (DM), annexe I, points 17.2 et 17.4 (sécurité informatique ; numérotation à vérifier) [ACRA cite le règlement 2017/745] ;
- matériovigilance (CSP art. L. 5212-2, à vérifier) ;
- référentiel ANS d'interopérabilité et de sécurité des DMN de télésurveillance (version à vérifier) ;
- HDS (CSP art. L. 1111-8) [ACRA] ;
- RGPD art. 9, 28 et 35.

*Risques*

| # | Risque | G | V |
|---|---|---|---|
| R1 | Une alerte clinique (prise de poids, signes de décompensation) n'arrive pas ou arrive en retard, et l'absence de données n'est pas détectée : silence pris pour « patient stable » [ACRA, technique.risk.late-feed, adapté] | 4 | 3 |
| R2 | Des données reçues de la plateforme du fabricant sont altérées ou rattachées au mauvais patient (erreur d'appairage ou d'identité) [ACRA, sante.risk.feed-integrity et patient-identity] | 4 | 2 |
| R3 | Le dispositif médical connecté (balance, tensiomètre, implant ou passerelle) est défaillant ou compromis : firmware vulnérable, appairage non sécurisé [ACRA, sante.risk.device] | 3 | 2 |
| R4 | La plateforme du fabricant est indisponible ou compromise et sert de rebond vers le logiciel de l'opérateur [ACRA, technique.risk.platform-outage et pivot] | 4 | 2 |
| R5 | Un changement de format ou de version d'API du fabricant, non annoncé, fausse l'intégration (unités, seuils) [ACRA, technique.risk.format-change] | 3 | 2 |
| R6 | Des données de santé de patients sont divulguées (comptes soignants usurpés, API, fabricant réutilisant les données hors finalité) [ACRA, sante.risk.patient-data et technique.risk.over-sharing] | 3 | 3 |
| R7 | Un rançongiciel ou une panne rend le logiciel de l'opérateur indisponible : plus de tri des alertes [ACRA, ransomware et it-outage] | 4 | 2 |
| R8 | Une alerte reçue n'est pas traitée dans le délai : saturation, mauvais paramétrage des seuils, astreinte non joignable, notification non délivrée (expertise) | 4 | 2 |

*Mesures de traitement prioritaires*

| # | Mesure | Type | Risques |
|---|---|---|---|
| M1 | Supervision de bout en bout de la fraîcheur des données par patient (« dernière mesure reçue ») avec alerte d'absence de transmission, distincte de l'alerte clinique ; pulsation (heartbeat) de l'interface fabricant [ACRA, late-delivery-alerts, adapté] | Détective | R1, R4 |
| M2 | Identitovigilance : appairage dispositif ↔ patient vérifié à l'installation, rapprochement INS et contrôle mensuel des rejets et anomalies d'identité des flux [ACRA, INS et feed-integrity-check] | Préventive et détective | R2 |
| M3 | Convention fabricant ↔ opérateur couvrant : HDS, sécurité de l'API, notification d'incident et des vulnérabilités, préavis et recette commune des changements de format, réversibilité, interdiction de réutilisation hors finalité [ACRA] (RGPD art. 28 ; MDR 2017/745) | Contractuelle | R3, R4, R5, R6 |
| M4 | Validation à l'intégration : contrôle des unités et des plages de valeurs, cohérence, quarantaine des valeurs aberrantes avec revue humaine [ACRA, quarantine-review] | Préventive | R2, R5 |
| M5 | Suivi mensuel des alertes de sécurité des fabricants de DM et des correctifs ; inventaire des dispositifs déployés ; voie de matériovigilance en cas d'incident [ACRA, device-vulnerabilities et unpatched-devices] | Détective et corrective | R3 |
| M6 | Authentification forte des soignants (Pro Santé Connect / e-CPS), mTLS et jetons de courte durée sur l'API fabricant, flux en sens unique et zone d'échange isolée [ACRA] | Préventive | R4, R6 |
| M7 | Mode dégradé clinique exercé une fois par an : liste des patients à haut risque, appels téléphoniques programmés, tests de restauration semestriels du logiciel [ACRA, downtime-procedures et backup-restore-care] | Corrective / résilience | R4, R7, R1 |
| M8 | Gestion des alertes : délais cibles de prise en compte par niveau de criticité, escalade automatique si l'alerte n'est pas acquittée, astreinte cardiologique formalisée, revue trimestrielle des seuils et des événements indésirables [ACRA, adverse-events] | Organisationnelle et détective | R8, R1 |

Déclarations en cas d'incident :
- violation de données : RGPD art. 33, sous 72 h [ACRA] ;
- incident lié au dispositif : matériovigilance (expertise) ;
- incident grave de sécurité des SI : signalement à l'ARS / CERT Santé selon CSP art. L. 1111-8-2 (applicabilité à l'opérateur à vérifier) ;
- NIS2 : 24 h / 72 h / 1 mois [ACRA], si l'opérateur entre dans son champ (à vérifier).
