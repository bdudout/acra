# T7 — Claude (Opus 5.5) seul

**Mutuelle santé, flux du prestataire de tiers payant (SFTP la nuit, API le jour)**

Contexte réglementaire :
- DORA (Règlement (UE) 2022/2554) s'applique si la mutuelle relève de Solvabilité II, à vérifier selon sa taille. Articles utiles : art. 28 à 30 (risque lié aux tiers prestataires TIC, clauses contractuelles, registre d'information).
- RGPD, art. 9, 28 et 32.

Registre des risques (G = gravité, V = vraisemblance) :
| # | Intitulé | Cause | Conséquence | G | V |
|---|---|---|---|---|---|
| R1 | Intégration d'un fichier de décomptes altéré ou falsifié | Compromission du prestataire ou du serveur SFTP, absence de signature | Paiements frauduleux (RIB ou montants modifiés), perte financière | 4 | 2 |
| R2 | Double intégration ou rejeu d'un fichier | Absence de contrôle d'unicité (numéro de lot, hash), relance manuelle | Double remboursement, régularisations, indus à recouvrer | 3 | 3 |
| R3 | Fichier incomplet ou tronqué intégré sans alerte | Transfert interrompu, absence de contrôle de complétude (compteurs, totaux de contrôle) | Remboursements manquants, réclamations, retards | 2 | 3 |
| R4 | Indisponibilité de l'API d'accords de prise en charge | Panne ou attaque DDoS chez le prestataire, absence de mode dégradé | Accords bloqués, hospitalisations sans prise en charge, insatisfaction, risque d'image | 3 | 3 |
| R5 | Fuite de données de santé dans les échanges | SFTP exposé ou mal configuré, clés SSH partagées, API sans authentification forte, logs contenant des données | Violation de données (RGPD, art. 33 et 34), sanction, atteinte au secret | 4 | 2 |
| R6 | Compromission de la mutuelle par rebond depuis le prestataire | Fichier piégé, injection via le parseur, jeton d'API volé | Intrusion dans le SI de gestion, rançongiciel | 4 | 2 |
| R7 | Erreur de règle métier ou de format chez le prestataire, propagée sans contrôle | Changement de format non annoncé, erreur de paramétrage des garanties | Remboursements erronés en masse | 3 | 3 |
| R8 | Fraude au tiers payant (actes fictifs d'un professionnel de santé ou d'un complice interne) | Contrôles a posteriori insuffisants, faible détection d'anomalies | Pertes financières récurrentes | 3 | 3 |
| R9 | Dépendance et défaillance durable du prestataire (sortie, faillite, cyberattaque majeure) | Absence de stratégie de sortie, réversibilité non testée | Arrêt du tiers payant, non-conformité DORA (art. 28) | 3 | 2 |
| R10 | Accès excessifs aux fichiers et à l'API côté mutuelle | Comptes techniques génériques, droits non revus, secrets en clair dans les scripts | Consultation illégitime, fraude interne, fuite | 3 | 2 |

Plan d'action :
| # | Action | Type | Responsable type | Échéance | Risques |
|---|---|---|---|---|---|
| A1 | Signature et chiffrement des fichiers (PGP ou équivalent), vérification de signature avant intégration, rejet en cas d'échec | Préventif | RSSI + responsable des flux | 3 mois | R1, R5, R6 |
| A2 | Contrôles d'intégration : numéro de lot séquentiel, hash anti-rejeu, compteurs et montants de contrôle, contrôle de schéma | Préventif | Responsable applicatif gestion | 3 mois | R2, R3, R7 |
| A3 | Contrôles bloquants avant paiement : seuils de montant, nouveaux RIB, variation anormale d'un lot par rapport à l'historique ; validation 4 yeux au-delà des seuils | Préventif / détectif | Directeur des prestations + contrôle interne | 3 mois | R1, R7, R8 |
| A4 | Durcissement SFTP et API : clés SSH dédiées et rotation, filtrage IP, mTLS ou OAuth2 avec client credentials, secrets dans un coffre, aucune donnée de santé dans les logs | Préventif | Responsable infrastructure | 3 mois | R5, R6, R10 |
| A5 | Analyse antivirus / bac à sable des fichiers entrants, parseur isolé, validation stricte des entrées | Préventif | RSSI | 6 mois | R6 |
| A6 | Supervision des flux : alerte si fichier absent, en retard ou de volumétrie anormale ; supervision de la disponibilité de l'API ; journaux dans le SIEM | Détectif | Exploitation / SOC | 3 mois | R3, R4, R6 |
| A7 | Mode dégradé pour les accords de prise en charge : procédure manuelle ou de secours, test annuel | Correctif | Responsable continuité (PCA) | 6 mois | R4, R9 |
| A8 | Avenant contractuel conforme à DORA (art. 30) et au RGPD (art. 28) : niveaux de service, notification d'incident, droit d'audit, gestion des changements de format, stratégie de sortie ; inscription au registre d'information | Préventif | Achats + juriste + responsable du risque tiers | 6 mois | R7, R9, R5 |
| A9 | Contrôle de second niveau anti-fraude : analyse a posteriori par échantillonnage et scoring des professionnels de santé atypiques | Détectif | Lutte contre la fraude / contrôle permanent | 6 mois | R8, R1 |
| A10 | Revue semestrielle des comptes techniques et des droits, plus procédure de recyclage et de recouvrement des indus après incident | Détectif / correctif | Propriétaire applicatif + RSSI | 6 mois, puis semestriel | R10, R2 |

Indicateurs de risque (KRI) :
| KRI | Unité | Seuil indicatif |
|---|---|---|
| Fichiers rejetés ou en anomalie (signature, complétude, rejeu) | % des fichiers reçus par mois | Alerte au-delà de 2 % |
| Disponibilité de l'API d'accords de prise en charge | % mensuel ; nombre d'indisponibilités de plus de 30 min | En dessous de 99,5 % |
| Montant des indus détectés liés au flux tiers payant (doubles paiements, erreurs) | € et % des prestations versées | À fixer selon l'historique |
| Délai de traitement par le prestataire des incidents ou vulnérabilités notifiés, et nombre de notifications hors délai | Jours ; nombre | Selon le contrat |
