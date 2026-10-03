# T7 — Claude (Opus 5.5) avec ACRA

**Mutuelle santé : flux de décomptes (SFTP de nuit) et API d'accords de prise en charge d'un prestataire de tiers payant**
Sources : [ACRA] = catalogue TECHNIQUE (interconnexion), catalogue ASSURANCE et sous-secteurs sante-tiers-payant et sante-amc.

*Registre de risques (G = gravité, V = vraisemblance, 1-4)*

| # | Risque | Cause | Conséquence | G | V |
|---|---|---|---|---|---|
| R1 | Un flux de décomptes erroné entraîne des paiements indus [ACRA, assurance.risk.tpa-feed] | Erreur de production chez le prestataire, mauvais paramétrage des garanties | Remboursements indus ou refusés en masse, réclamations, recouvrement difficile | 3 | 3 |
| R2 | Un fichier incomplet, corrompu ou rejoué est intégré sans détection [ACRA, technique.risk.corrupt-feed] | Pas de contrôle de complétude (nombre, totaux, empreinte) ni d'anti-rejeu | Doubles paiements, base de prestations faussée | 3 | 3 |
| R3 | Des données falsifiées reçues d'un prestataire compromis sont intégrées [ACRA, technique.risk.forged-feed] | Compromission du SI du prestataire, pas de signature ni de contrôle d'origine | Paiements frauduleux (bénéficiaires ou IBAN fictifs), perte financière | 4 | 2 |
| R4 | Une livraison attendue n'arrive pas et son absence n'est pas détectée [ACRA, technique.risk.late-feed] | Pas de calendrier attendu ni d'alerte d'absence | Retards de remboursement, rattrapage en volume, risque de doublons | 2 | 3 |
| R5 | Un changement de format non annoncé fausse l'intégration [ACRA, technique.risk.format-change] | Évolution de norme ou de version côté prestataire, pas de recette commune | Montants mal interprétés, rejets massifs | 3 | 2 |
| R6 | Un secret d'API, une clé SFTP ou un certificat est volé et réutilisé [ACRA, technique.risk.secret-theft] | Secrets statiques et non renouvelés, partagés entre environnements | Usurpation du canal, injection ou lecture de données de santé | 4 | 2 |
| R7 | Un attaquant rebondit du prestataire vers le SI de gestion [ACRA, technique.risk.pivot] | Flux trop ouverts, zone d'échange non isolée, compte de dépôt avec droits excessifs | Rançongiciel ou exfiltration dans le SI de la mutuelle | 4 | 2 |
| R8 | L'API d'accords de prise en charge est indisponible ou saturée [ACRA, technique.risk.api-abuse et platform-outage] | Panne ou DDoS chez le prestataire, pas de mode dégradé | Accords impossibles, avance de frais pour les adhérents, perte de confiance des professionnels [ACRA sante-tiers-payant] | 3 | 3 |
| R9 | Données de santé transmises ou conservées au-delà du besoin, ou divulguées [ACRA, technique.risk.over-sharing et assurance.risk.customer-data] | Pas de minimisation, rétention des fichiers en zone SFTP, prestataire non HDS | Violation RGPD art. 5, 9 et 32, notification CNIL sous 72 h [ACRA], sanction | 4 | 2 |
| R10 | Interconnexion sans convention, propriétaire ni réversibilité [ACRA, technique.risk.unmanaged-interco et partner-lockin] | Raccordement historique, contrat sans clauses de sécurité | Pas de levier en cas d'incident, pas de droit d'audit, sortie impossible ; non-conformité DORA art. 28-30 si la mutuelle y est soumise (à vérifier selon son régime prudentiel) | 3 | 2 |

*Plan d'action (échéances relatives, à compter du lancement)*

| # | Action | Type | Responsable type | Échéance | Risques traités |
|---|---|---|---|---|---|
| A1 | Contrôles automatiques d'intégration : nombre d'enregistrements, totaux de contrôle, empreinte, numéro de séquence et anti-rejeu, avec quarantaine des lots non conformes [ACRA] | Préventif | Responsable des flux / DSI | 3 mois | R1, R2, R3 |
| A2 | Rapprochement quotidien flux ↔ paiements (totaux, doublons) avant chaque remise bancaire [ACRA, tpa-feed-reconciliation] | Détectif | Responsable des prestations / contrôle de gestion | 1 mois | R1, R2, R3 |
| A3 | Calendrier attendu des livraisons, alerte d'absence ou de retard et procédure d'escalade avec le prestataire [ACRA] | Détectif | Exploitation / pilotage des flux | 1 mois | R4 |
| A4 | Signature ou scellement des fichiers par le prestataire et vérification à réception ; SFTP par clé dédiée, avec liste des adresses autorisées (expertise) | Préventif | RSSI / architecte | 6 mois | R3, R6 |
| A5 | API protégée par mTLS ou OAuth 2.0 avec jetons de courte durée ; rotation trimestrielle des clés et certificats et coffre-fort de secrets [ACRA, secret-rotation] | Préventif | RSSI / équipe intégration | 3 mois | R6 |
| A6 | Zone d'échange isolée (DMZ) : dépôt sans exécution, analyse antivirus, flux en sens unique vers la gestion, comptes techniques à moindre privilège [ACRA, 27001 A.8.22] | Préventif | Architecte réseau / RSSI | 6 mois | R7 |
| A7 | Seuils métier sur les décomptes (montant unitaire, cumul par bénéficiaire, IBAN nouvellement créé) avec mise en attente et double validation [ACRA, sante-tiers-payant] | Détectif | Responsable des prestations / lutte anti-fraude | 3 mois | R1, R3 |
| A8 | Convention d'interconnexion et avenant contractuel : sécurité, notification d'incident, audit, réversibilité, HDS, recette commune de tout changement de format [ACRA] (RGPD art. 28 ; DORA art. 30 si applicable) | Préventif | Achats / juridique / RSSI | 6 mois | R5, R9, R10 |
| A9 | Mode dégradé pour l'indisponibilité de l'API (accord différé, règles par défaut, information des professionnels), exercé une fois par an avec le prestataire [ACRA] | Correctif | Responsable PCA / opérations | 6 mois | R8 |
| A10 | Minimisation et rétention : purge des fichiers SFTP après intégration, revue annuelle des données échangées [ACRA, data-minimisation-review] ; procédure de réintégration et de correction de lots erronés (expertise) | Correctif | DPO / responsable des flux | 3 mois | R9, R1, R2 |

*KRI [ACRA]*

| KRI | Unité | Dégradation | Périodicité |
|---|---|---|---|
| Écarts de rapprochement des flux de tiers payant [assurance.kri.tpa-feed-gaps] | nombre | hausse | mensuel (quotidien en pilotage) |
| Taux de livraisons rejetées ou mises en quarantaine [technique.kri.rejected-deliveries] | % | hausse | mensuel |
| Livraisons en retard au-delà du délai convenu [technique.kri.late-deliveries] | nombre | hausse | mensuel |
| Secrets, clés et certificats d'échange non renouvelés à échéance [technique.kri.secrets-overdue] | nombre | hausse | trimestriel |

KRI d'appoint : durée d'indisponibilité de l'API du prestataire, en minutes, à la hausse, mensuel (adapté de technique.kri.platform-downtime [ACRA]).
