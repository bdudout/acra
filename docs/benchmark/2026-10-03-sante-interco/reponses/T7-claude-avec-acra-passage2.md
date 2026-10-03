# T7 — Claude (Opus 5.5) avec ACRA, passage 2

**Mutuelle santé : interconnexion avec un prestataire de tiers payant (fichiers SFTP de nuit, API de jour)**

**Registre de 10 risques** (gravité G et vraisemblance V de 1 à 4)

| # | Risque | Cause | Conséquence | G | V |
|---|---|---|---|---|---|
| R1 | Fichier de décomptes falsifié déposé par un prestataire compromis, intégré puis payé | Ni signature ni contrôle de vraisemblance avant paiement ; intégration automatique de nuit | Paiements indus à grande échelle (bénéficiaires ou IBAN modifiés), fraude | 4 | 2 |
| R2 | Fichier incomplet, corrompu ou rejoué (doublon) intégré sans détection | Ni totaux de contrôle ni identifiant unique de lot ; reprise manuelle après incident | Doubles paiements, ou remboursements manquants | 3 | 3 |
| R3 | Absence ou retard de livraison nocturne non détecté | Aucune alerte d'échéance ; la supervision ne voit que les échecs, pas les absences | Remboursements retardés, traitements sur des données périmées | 2 | 3 |
| R4 | Changement de format non annoncé (version de norme, champ décalé, nouvelle codification) | Ni contrat d'interface versionné ni recette commune | Montants ou actes mal interprétés, rejets massifs, reprise manuelle | 3 | 3 |
| R5 | Vol de la clé privée SFTP ou du secret de l'API | Secret partagé, stocké sur un poste d'administrateur, dans un dépôt de code ou dans des journaux ; pas de restriction d'origine ni de rotation | Exfiltration de données de santé, ou dépôt de fichiers frauduleux sous l'identité du prestataire | 3 | 3 |
| R6 | Fichier piégé qui exploite l'analyseur (entité externe XML, formule dans un CSV, bombe de décompression, nom de fichier en traversée de répertoire) | Analyseurs non durcis, exécutés avec des droits étendus et un accès réseau | Compromission du serveur d'intégration, lecture de fichiers internes | 4 | 2 |
| R7 | Rebond depuis le prestataire ou le serveur SFTP vers le SI interne | Passerelle placée dans le réseau applicatif, flux bidirectionnels, pas de rupture protocolaire | Rançongiciel ou fuite de données étendus au SI de gestion | 4 | 2 |
| R8 | Indisponibilité de l'API des accords de prise en charge (rançongiciel chez le prestataire, déni de service, panne) | Pas de mode dégradé, engagement de disponibilité faible | Hospitalisations, optique et dentaire bloqués ; adhérents contraints d'avancer les frais ; réclamations | 3 | 3 |
| R9 | Réponse de l'API altérée ou acceptée sans validation, conduisant à un accord accordé à tort | Consommation non sûre d'une API tierce (pas de validation de schéma ni de cohérence avec les droits et les plafonds) | Engagements financiers indus, litiges avec les établissements | 3 | 2 |
| R10 | Encadrement contractuel insuffisant : prestataire ou sous-traitant ultérieur non certifié HDS, données transmises au-delà du besoin, pas de réversibilité | Achat sans exigences de sécurité, aucune revue annuelle | Non-conformité (RGPD, CSP art. L. 1111-8, DORA si applicable), dépendance sans issue | 3 | 3 |

**Plan d'action de 10 actions**

| # | Action | Type | Responsable type | Échéance | Risques traités |
|---|---|---|---|---|---|
| A1 | Contrôle de complétude et d'intégrité de chaque livraison : nombre d'enregistrements, totaux de montants, séquence, signature détachée (CMS ou OpenPGP) ou empreinte transmise par un canal distinct. Rejet automatique en cas d'écart. | Préventif | Propriétaire métier du flux avec la DSI intégration | M+3 | R1, R2 |
| A2 | Détection des rejeux : identifiant unique et horodatage par lot, registre des lots déjà intégrés, idempotence sur la clé de décompte. | Préventif | DSI (études) | M+3 | R2 |
| A3 | Quarantaine et seuils de vraisemblance avant paiement : écart de volume ou de montant par rapport à la moyenne glissante, nouveaux IBAN, professionnels inconnus, dépassement des plafonds de garantie. Validation humaine au-delà du seuil. Rapprochement mensuel entre décomptes, paiements et relevés du prestataire. | Détectif | Direction des prestations | M+2 | R1, R2, R4 |
| A4 | Supervision des flux : alerte si le fichier n'est pas arrivé à l'heure convenue, tableau de bord des rejets, escalade vers le prestataire. Supervision de la disponibilité et de la latence de l'API. | Détectif | Exploitation / propriétaire du flux | M+1 | R3, R8 |
| A5 | Contrat d'interface versionné (fichiers et API), validation stricte du schéma à l'entrée (champs inconnus rejetés), préavis de changement et recette commune signée. Validation des réponses de l'API : schéma, cohérence avec les droits et les plafonds. | Préventif | MOA du flux et prestataire | M+6 | R4, R9 |
| A6 | Durcissement des analyseurs : entités externes XML désactivées, formules CSV neutralisées, taille, profondeur et taux de décompression bornés, noms de fichiers assainis. Traitement dans un conteneur isolé sans accès réseau sortant. Analyse antivirale. Tests réguliers avec des fichiers malformés (fuzzing). | Préventif | DSI (développement) et RSSI | M+3 | R6 |
| A7 | Authentification forte des échanges : une clé SFTP par flux, conservée dans un coffre, avec restriction d'adresse source, chroot et rotation au moins annuelle. API en TLS mutuel avec jetons OAuth 2.0 de courte durée et portée minimale. | Préventif | RSSI / infrastructure | M+3 | R5 |
| A8 | Cloisonnement : serveur SFTP et passerelle API en DMZ, rapatriement des fichiers à l'initiative du SI interne (aucune connexion entrante vers l'interne), rupture protocolaire, règles de filtrage revues chaque semestre. | Préventif | Infrastructure réseau | M+6 | R7 |
| A9 | Procédure de coupure d'urgence de l'interconnexion et mode dégradé : prises en charge par le portail ou le téléphone du prestataire, accord provisoire plafonné, dernière livraison valide comme référence. Exercice annuel. | Correctif | Direction des prestations et responsable du PCA | M+6 | R7, R8 |
| A10 | Encadrement contractuel : clauses de sécurité, notification d'incident avec délai chiffré, droit d'audit, sous-traitance ultérieure, certification HDS, minimisation, réversibilité. Inscription au registre d'information des prestataires TIC et évaluation de criticité. | Préventif | Achats, juridique, DPO et RSSI | M+6 | R10, R1 |

Pour A10 :
- DORA (règlement (UE) 2022/2554, art. 28 à 30) s'applique si la mutuelle relève de Solvabilité II (à vérifier pour une petite mutuelle).
- RGPD art. 28.
- CSP art. L. 1111-8.

**4 indicateurs de risque (KRI)**

| KRI | Unité | La situation se dégrade quand | Périodicité |
|---|---|---|---|
| Taux de livraisons rejetées ou mises en quarantaine | % | il augmente | suivi quotidien, revue mensuelle |
| Livraisons arrivées au-delà du délai convenu | nombre | il augmente | mensuelle |
| Écarts de rapprochement entre décomptes et paiements (doublons compris) | nombre et montant en € | ils augmentent | mensuelle |
| Disponibilité de l'API des accords de prise en charge | % (ou minutes d'indisponibilité) | la disponibilité baisse | mensuelle |
