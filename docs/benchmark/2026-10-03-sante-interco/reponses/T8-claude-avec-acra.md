# T8 — Claude (Opus 5.5) avec ACRA

**Interconnexion bidirectionnelle assureur santé ↔ délégataire de gestion (API REST et fichiers)**
Sources : [ACRA] = sous-secteur sante-delegataire, catalogue TECHNIQUE et catalogue ASSURANCE.

*Cartographie des parties prenantes*
Méthode EBIOS RM : exposition = dépendance × pénétration ; fiabilité = maturité × confiance (échelles 1-4). Seuils de zone indicatifs.

| Partie prenante | Dép. | Pén. | Expo. | Mat. | Conf. | Fiab. | Zone |
|---|---|---|---|---|---|---|---|
| Délégataire de gestion (plateforme multi-organismes) [ACRA : délégant vu du délégataire 4/3/3/3] | 4 | 4 | 16 | 3 | 3 | 9 | Danger |
| Hébergeur HDS du délégataire [ACRA : 4/3/4/3] | 4 | 3 | 12 | 4 | 3 | 12 | Contrôle |
| Prestataire de numérisation des pièces justificatives [ACRA : 3/2/2/2] | 3 | 2 | 6 | 2 | 2 | 4 | Contrôle, fiabilité faible |
| Opérateurs de tiers payant et réseaux de soins [ACRA : 3/3/3/3] | 3 | 3 | 9 | 3 | 3 | 9 | Contrôle |
| Éditeur de la plateforme d'intégration / passerelle API (expertise) | 3 | 3 | 9 | 3 | 3 | 9 | Contrôle |
| Autres organismes délégants partageant la plateforme (expertise : risque de cloisonnement) | 1 | 2 | 2 | 2 | 2 | 4 | Veille, mais vecteur indirect |
| Autorités : ACPR, CNIL, ANS / CERT Santé [ACRA pour l'ANS : 2/1/4/4] | 2 | 1 | 2 | 4 | 4 | 16 | Hors zone |

*Scénarios stratégiques*

| # | Scénario | Critère | G | V |
|---|---|---|---|---|
| SS1 | La compromission de la plateforme du délégataire expose les données de plusieurs organismes (effet de concentration) ; l'attaquant rebondit ensuite vers le SI de l'assureur par l'API ou les dépôts de fichiers [ACRA + technique.risk.pivot] | C, puis D | 4 | 2 |
| SS2 | Un gestionnaire complice chez le délégataire modifie des coordonnées bancaires ou crée des bénéficiaires fictifs ; les prestations frauduleuses remontent dans les bordereaux comme légitimes [ACRA] | I | 3 | 3 |
| SS3 | Une rupture de cloisonnement fait transmettre ou exposer à un autre délégant les données de santé de l'assureur, pièces justificatives médicales comprises [ACRA, delegate-segregation] | C | 4 | 2 |

*Scénarios opérationnels*
*SO1, déclinaison de SS1.* Vraisemblance 2.
1. Hameçonnage d'un administrateur du délégataire ou vol d'un secret d'API stocké dans un dépôt de code (expertise et [ACRA] secret-theft).
2. Accès à la passerelle d'échange avec le compte technique d'interconnexion.
3. Abus des droits trop larges du compte : lecture des flux d'adhésions et de prestations de plusieurs délégants.
4. Exfiltration progressive par les canaux d'échange légitimes, peu visible.
5. Dépôt d'un fichier piégé ou appel d'API malveillant vers l'assureur, qui sert de rebond.
6. Chiffrement ou exfiltration des deux côtés.

*SO2, déclinaison de SS2.* Vraisemblance 3.
1. Gestionnaire habilité chez le délégataire.
2. Modification d'IBAN ou création d'un bénéficiaire fictif sans double validation [ACRA].
3. Saisie de prestations appuyées sur de faux justificatifs, numérisés par le prestataire.
4. Paiement, puis remontée dans les bordereaux de prestations.
5. Pas de rapprochement par bénéficiaire ni par IBAN côté assureur, donc la fraude est découverte tardivement par contrôle a posteriori.

*Mesures de sécurité de l'interconnexion*

| # | Mesure | Nature | Textes applicables (cités, non reproduits) |
|---|---|---|---|
| 1 | Convention de délégation et d'interconnexion : sécurité, sous-traitance ultérieure, droit d'audit, notification sans délai des incidents, reddition de comptes [ACRA] | Contractuelle | Solvabilité II, dir. 2009/138/CE, art. 49 [ACRA] ; règl. délégué (UE) 2015/35, art. 274 [ACRA] ; RGPD art. 28 ; DORA, règl. (UE) 2022/2554, art. 28-30 si l'assureur entre dans son champ (à vérifier) |
| 2 | Hébergement HDS du délégataire et de ses sous-traitants (numérisation comprise) ; périmètre du certificat vérifié chaque année [ACRA] | Contractuelle | CSP art. L. 1111-8 [ACRA] ; référentiel de certification HDS en vigueur (version à vérifier) |
| 3 | Authentification mutuelle des systèmes : mTLS ou OAuth 2.0 avec jetons de courte durée et périmètres (scopes) par type de flux ; SFTP par clé dédiée ; rotation trimestrielle des secrets [ACRA] | Technique | ISO/IEC 27001:2022, A.5.17 et A.8.24 ; OWASP API Security Top 10 2023 (API2) |
| 4 | Autorisation objet par objet et cloisonnement par délégant, avec tests de non-régression à chaque version [ACRA] | Technique | OWASP API Security Top 10 2023 (API1, API3) [ACRA] ; RGPD art. 32 |
| 5 | Chiffrement des flux (TLS récent) et chiffrement ou signature des fichiers ; contrôle d'intégrité à réception (empreinte, séquence, anti-rejeu) [ACRA] | Technique | ISO/IEC 27001:2022, A.8.24 ; RGPD art. 32 |
| 6 | Zone d'échange isolée, filtrage des flux en sens strictement nécessaire, analyse antivirus des pièces justificatives, interdiction de l'exécution [ACRA, A.8.22] | Technique | ISO/IEC 27001:2022, A.8.22 [ACRA] |
| 7 | Minimisation : seules les données de santé nécessaires à la finalité de gestion sont échangées ; rétention limitée ; pas de pièces médicales dans les flux non nécessaires [ACRA] | Technique et organisationnelle | RGPD art. 5 [ACRA] et art. 9 ; encadrement de l'usage du NIR (décret 2019-341, à vérifier) |
| 8 | Double validation des changements d'IBAN et de bénéficiaires chez le délégataire ; contrôle par échantillon des prestations côté assureur [ACRA] | Organisationnelle | Solvabilité II art. 49 ; contrôle des délégataires (contrôle ACRA assurance.control.delegated-managers, trimestriel) |
| 9 | Journalisation corrélée des deux côtés, rapprochement mensuel des données échangées, revue trimestrielle des rapports de sécurité du délégataire [ACRA] | Détective | ISO/IEC 27001:2022, A.8.15 [ACRA] ; règl. délégué 2015/35 art. 274 [ACRA] |
| 10 | Coupure d'urgence de l'interconnexion exercée chaque année, plan de continuité et ordre de reprise par délégant, plan de sortie et réversibilité testés [ACRA] | Corrective et contractuelle | DORA art. 11, 12 et 28 si applicable [ACRA] ; notifications RGPD art. 33-34 (72 h [ACRA]) et, le cas échéant, NIS2 (24 h / 72 h / 1 mois [ACRA]) |
