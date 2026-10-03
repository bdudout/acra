# T10 — Claude (Opus 5.5) avec ACRA, passage 2

**Télésurveillance médicale de patients insuffisants cardiaques**

La chaîne de données est la suivante :
1. Dispositif au domicile (balance, tensiomètre, éventuellement implant).
2. Passerelle : box ou smartphone du patient.
3. Plateforme en nuage du fabricant.
4. Interface avec le logiciel de l'opérateur.
5. Alertes aux infirmiers et aux cardiologues.

**8 risques**

| # | Risque | Cause principale | Conséquence | G | V |
|---|---|---|---|---|---|
| R1 | Alerte perdue ou retardée | Panne de la plateforme du fabricant, échec silencieux de l'intégration, file de messages bloquée, perte de connexion d'un capteur non détectée | Décompensation non détectée, hospitalisation, décès | 4 | 3 |
| R2 | Mesures rattachées au mauvais patient ou altérées | Erreur d'appariement entre le numéro de série du dispositif et le patient, identité non qualifiée INS, conversion d'unités erronée | Ajustement thérapeutique erroné (diurétiques), alerte manquée | 4 | 2 |
| R3 | Compromission ou fuite chez le fabricant | Attaque sur le nuage du fabricant ; hébergement non HDS ou transfert hors UE mal encadré | Fuite massive de données de santé, manipulation des données, non-conformité | 4 | 2 |
| R4 | Vol des secrets de l'API ou des comptes techniques entre le fabricant et l'opérateur | Secrets statiques, absence de TLS mutuel et de rotation | Exfiltration, ou injection de fausses mesures qui saturent ou masquent les alertes | 3 | 2 |
| R5 | Usurpation d'un compte soignant (infirmier, cardiologue) | Mot de passe seul, hameçonnage | Accès aux dossiers, modification des seuils ou acquittement frauduleux d'alertes | 3 | 3 |
| R6 | Vulnérabilité du dispositif ou de la passerelle au domicile (Bluetooth basse consommation, box 4G, application du smartphone) | Micrologiciel non corrigé, appairage faible | Mesures falsifiées ou absentes, patient non surveillé | 3 | 2 |
| R7 | Rançongiciel sur le logiciel ou le SI de l'opérateur | Poste compromis, Active Directory faible, sauvegardes accessibles | Arrêt de la surveillance de toute la file active | 4 | 3 |
| R8 | Changement non maîtrisé : seuils d'alerte modifiés sans validation, mise à jour du fabricant ou de l'opérateur non qualifiée | Absence de gestion des changements et de tests cliniques | Alertes supprimées ou excès d'alertes (fatigue d'alerte) | 4 | 2 |

**8 mesures prioritaires**

| # | Mesure | Priorité | Risques | Référence |
|---|---|---|---|---|
| M1 | Supervision de bout en bout. Signal de vie attendu par patient : l'absence de transmission au-delà de N heures déclenche une alerte de silence du capteur. Accusés de réception, files persistantes, alerte sur la latence d'intégration. | P1 | R1, R6 | ISO/IEC 27001:2022, A.8.16 |
| M2 | Mode dégradé clinique écrit et exercé : accès de secours à la plateforme du fabricant, appel téléphonique des patients à haut risque, astreinte. PCA et PRA testés chaque année. | P1 | R1, R7 | ISO/IEC 27001:2022, A.5.30 |
| M3 | Identitovigilance : appariement dispositif et patient vérifié en double contrôle à l'installation, INS qualifiée, contrôles de plausibilité physiologique (prise de poids impossible, unités). | P1 | R2 | CSP art. L. 1111-8-1 |
| M4 | Sécurisation de l'interface avec le fabricant : TLS mutuel, OAuth 2.0 à portée minimale, secrets en coffre avec rotation, messages horodatés et signés, validation du schéma (par exemple ressources FHIR Observation) et détection des rejeux. | P1 | R4, R2 | OWASP API Security Top 10 — 2023 |
| M5 | Diligence et contrat avec le fabricant : hébergement HDS dans l'UE (ou transferts encadrés), clauses de notification d'incident et d'audit, nomenclature logicielle (SBOM) et gestion des vulnérabilités du dispositif et de l'application, réversibilité. | P1 | R3, R6 | CSP art. L. 1111-8 ; RGPD art. 28 et chapitre V ; Règlement (UE) 2017/745, annexe I, point 17 (à vérifier) ; MDCG 2019-16 |
| M6 | Authentification forte des soignants (Pro Santé Connect ou e-CPS), habilitations par rôle, journalisation de chaque acquittement d'alerte et de chaque modification de seuil. Double validation médicale des seuils. | P1 | R5, R8 | ISO/IEC 27001:2022, A.8.5 et A.8.15 |
| M7 | Défense contre le rançongiciel : EDR, durcissement de l'AD et tiering, cloisonnement du serveur de télésurveillance, sauvegardes immuables avec restauration testée, correctifs dans les délais. | P1 | R7 | ISO/IEC 27001:2022, A.8.7, A.8.13 et A.8.22 |
| M8 | Gestion des changements et vigilance : qualification en préproduction des mises à jour du fabricant et de l'opérateur avec des cas cliniques de test, revue périodique des seuils, déclaration des incidents de matériovigilance à l'ANSM et des incidents de sécurité au CERT Santé. | P2 | R8, R6 | ISO/IEC 27001:2022, A.8.32 ; Règlement (UE) 2017/745 (vigilance) |

Cadre de financement de la télésurveillance (Code de la sécurité sociale, art. L. 162-48 et suivants, à vérifier) : la certification de conformité aux référentiels d'interopérabilité et de sécurité de l'ANS est une condition de prise en charge (à vérifier).
