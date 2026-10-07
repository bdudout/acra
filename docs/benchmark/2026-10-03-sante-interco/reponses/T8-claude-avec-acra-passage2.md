# T8 — Claude (Opus 5.5) avec ACRA, passage 2

**Interconnexion bidirectionnelle entre un assureur santé et son délégataire de gestion**

**Cartographie des parties prenantes**

L'exposition est le produit dépendance × pénétration (de 1 à 16) ; la fiabilité est le produit maturité × confiance (de 1 à 16).

| Partie prenante | Dépendance | Pénétration | Maturité | Confiance | Exposition | Fiabilité | Zone |
|---|---|---|---|---|---|---|---|
| Délégataire de gestion (adhésions, cotisations, prestations) | 4 | 4 | 3 | 3 | 16 | 9 | Danger : prioritaire |
| Hébergeur HDS du délégataire | 4 | 3 | 4 | 3 | 12 | 12 | Contrôle |
| Éditeurs des progiciels de gestion et de la plateforme d'échange des deux parties | 3 | 3 | 3 | 3 | 9 | 9 | Contrôle |
| Opérateurs de tiers payant et réseaux de soins (reliés au délégataire) | 3 | 3 | 3 | 3 | 9 | 9 | Contrôle |
| Centre de numérisation des pièces justificatives (sous-traitant du délégataire) | 3 | 2 | 2 | 2 | 6 | 4 | Danger : maillon faible indirect |
| Assurance maladie obligatoire (flux de remboursement transitant par le délégataire) | 4 | 2 | 4 | 4 | 8 | 16 | Veille |
| Entreprises clientes et courtiers (contrats collectifs) | 2 | 2 | 2 | 2 | 4 | 4 | Contrôle |
| Opérateur réseau (VPN ou lien dédié) | 3 | 1 | 3 | 3 | 3 | 9 | Veille |
| Assurés et ayants droit (personnes concernées) | 2 | 1 | 1 | 2 | 2 | 2 | Veille |
| Autorités : ACPR, CNIL | 2 | 1 | 4 | 4 | 2 | 16 | Veille |

**Scénarios stratégiques**

| # | Scénario | Chemin | Gravité | Vraisemblance |
|---|---|---|---|---|
| SS1 (C) | Un attaquant compromet le délégataire et exfiltre, par le compte technique de l'API, les données de santé des assurés. Si le cloisonnement entre délégants est rompu, plusieurs organismes sont touchés : c'est l'effet de concentration. | Cybercriminel → délégataire (gestionnaire hameçonné, VPN vulnérable) → jeton d'API aux droits trop larges → base de l'assureur | 4 | 3 |
| SS2 (I) | Un gestionnaire complice chez le délégataire crée des bénéficiaires fictifs, modifie des IBAN ou injecte des prestations fictives, transmises par les flux et payées par l'assureur. | Fraudeur interne → outil de gestion → fichiers de prestations → paiement | 3 | 3 |
| SS3 (D puis I/C) | Un rançongiciel touche le délégataire : il faut couper l'interconnexion, ce qui arrête les prestations. L'attaquant tente en plus un rebond vers le SI de l'assureur par un fichier ou une pièce justificative piégés. | Groupe de rançongiciel → SI du délégataire → répertoire d'échange → analyseur de l'assureur | 4 | 2 |

**Scénarios opérationnels**

SO1, qui décline SS1 :
1. Hameçonnage ciblé d'un gestionnaire ou d'un administrateur du délégataire, avec une page de proxy inverse qui intercepte la session et le second facteur (T1566.002, T1557, T1539).
2. Accès au poste puis aux outils internes.
3. Recherche du secret client de l'API dans des fichiers de configuration ou un dépôt de code (T1552.001).
4. Appels à l'API avec ce jeton valide, dont la portée couvre bien plus que le flux convenu (T1078).
5. Énumération des adhérents et des prestations par pagination automatisée (T1119).
6. Exfiltration en HTTPS vers un stockage en nuage (T1567.002), puis extorsion de l'assureur et du délégataire.

SO2, qui décline SS3 :
1. L'attaquant est installé dans le SI du délégataire (accès initial acheté ou VPN exploité, T1133).
2. Il dépose une archive de pièces justificatives piégée dans le répertoire d'échange, par exemple un ZIP à traversée de répertoire ou un PDF malveillant (T1080).
3. L'analyseur ou le module d'OCR de l'assureur traite le fichier, ce qui exécute du code (T1203).
4. Persistance sur le serveur d'intégration, puis mouvement latéral vers le progiciel de gestion (T1021).
5. Suppression des sauvegardes et chiffrement (T1490, T1486). Les remboursements sont arrêtés des deux côtés.

**10 mesures de sécurité de l'interconnexion**

| # | Mesure | Nature | Textes et référentiels applicables |
|---|---|---|---|
| 1 | Convention de délégation et accord de sous-traitance des données : objet, instructions, sécurité, sous-traitance ultérieure soumise à autorisation, notification d'incident avec délai chiffré, droit d'audit, sort des données, réversibilité. AIPD conjointe. | Contractuelle | RGPD art. 28 et 35 ; Directive 2009/138/CE (Solvabilité II), art. 49 ; Règlement délégué (UE) 2015/35, art. 274 ; DORA — Règlement (UE) 2022/2554, art. 28 et 30 |
| 2 | Convention d'interconnexion : flux autorisés par sens, propriétaires, contacts d'urgence, procédure de coupure, revue annuelle. Inscription au registre d'information des prestataires TIC. | Contractuelle | ISO/IEC 27001:2022, A.5.14 ; DORA art. 28 |
| 3 | Hébergement des données de santé par un hébergeur certifié HDS (ou certification du délégataire s'il héberge lui-même pour le compte de l'assureur). Vérification annuelle du certificat et de son périmètre. | Contractuelle et technique | CSP art. L. 1111-8 |
| 4 | Authentification mutuelle des systèmes (TLS mutuel), OAuth 2.0 en client credentials avec un client technique par flux et par sens, portées minimales, jetons de courte durée, restriction d'adresse source, secrets en coffre avec rotation. | Technique | OWASP API Security Top 10 — 2023 (API2, API5) ; ISO/IEC 27001:2022, A.8.5 |
| 5 | Autorisation objet par objet et cloisonnement par délégant à chaque appel, avec tests de non-régression à chaque version. | Technique | OWASP API Security Top 10 — 2023 (API1, API3) |
| 6 | Minimisation et séparation des données : seuls les champs nécessaires à la finalité sont transmis. Les pièces médicales circulent dans un flux distinct, réservé au service médical (médecin-conseil). | Technique et organisationnelle | RGPD art. 5, 9 et 25 ; CSP art. L. 1110-4 (secret, application à vérifier selon l'organisme) |
| 7 | Validation stricte des schémas, analyseurs durcis, désarmement et reconstruction (CDR) et analyse antivirale des pièces justificatives, quarantaine des lots hors norme. | Technique | ISO/IEC 27001:2022, A.8.28 et A.8.7 |
| 8 | Intégrité métier : double validation des changements d'IBAN, contrôles de vraisemblance des prestations, rapprochement mensuel des référentiels et des bordereaux avec les paiements, contrôle par échantillon chez le délégataire. | Organisationnelle, détective | Solvabilité II, art. 49 ; Code de la mutualité ou Code des assurances selon l'assureur |
| 9 | Passerelle d'échange en DMZ avec rupture protocolaire et sans VPN « à plat ». Journalisation corrélée des deux côtés par identifiant de transaction. Supervision par les SOC des deux parties. | Technique | ISO/IEC 27001:2022, A.8.22, A.8.15 et A.8.16 |
| 10 | Gestion conjointe des incidents et de la continuité : notification croisée dans des délais compatibles avec RGPD art. 33 (72 h) et, si l'assureur relève de DORA, art. 19 (notification initiale 4 h après classification et au plus tard 24 h). Mode dégradé et coupure d'urgence exercés. PCA commun testé chaque année. | Contractuelle et organisationnelle | RGPD art. 33 et 34 ; DORA art. 11, 12 et 19 |
