# T6 — Claude (Opus 5.5) avec ACRA

**Portail patients et médecins de ville d'un GHT : analyse EBIOS RM, ateliers 1 à 5**
Sources : [ACRA] = exemples sectoriels « santé / sante-portail » et catalogue SANTE d'ACRA ; le reste vient de mon expertise.

**Atelier 1 : cadrage et socle**
Socle applicable (expertise) :
- RGPD art. 9, 28, 32, 33-34 et 35. Une AIPD est quasi certainement requise.
- CSP art. L. 1111-8 (HDS) [ACRA], L. 1111-8-1 (INS) [ACRA], L. 1110-4 (secret et partage entre professionnels), L. 1111-7 (accès du patient à ses informations) et L. 1111-8-2 (signalement des incidents graves de sécurité des SI).
- PGSSI-S et référentiel d'identification électronique de l'ANS (version à vérifier).
- NIS2 : directive (UE) 2022/2555, sous réserve de l'état de la transposition française (à vérifier).

*Valeurs métier (DICT 1-4)*

| # | Valeur métier [ACRA] | D | I | C | T |
|---|---|---|---|---|---|
| VM1 | Mise à disposition des comptes rendus, résultats et images aux patients | 3 | 4 | 4 | 4 |
| VM2 | Accès des médecins correspondants aux documents de leurs patients | 3 | 4 | 4 | 4 |
| VM3 | Comptes et identités des usagers (patients, aidants, professionnels) | 3 | 4 | 4 | 4 |
| VM4 | Prise de rendez-vous et messagerie patients ↔ services | 3 | 3 | 3 | 3 |
| VM5 | Consentements, oppositions et traces d'accès | 2 | 4 | 3 | 4 |

*Biens supports*

| # | Bien support [ACRA] | Type |
|---|---|---|
| BS1 | Portail web et application mobile (interfaces et API) | Logiciel |
| BS2 | Fournisseur d'identité et fédération (FranceConnect, Pro Santé Connect, double facteur) | Logiciel |
| BS3 | Connecteurs portail ↔ DPI (HL7, FHIR, documents CDA) | Réseau |
| BS4 | Infrastructure de l'hébergeur certifié HDS (serveurs, bases, stockage, sauvegardes) | Sous-traitance |
| BS5 | Service d'envoi de notifications (courriel, SMS, push), qui voit des métadonnées patients | Sous-traitance |
| BS6 | Base des comptes usagers et journaux d'accès | Données |

*Événements redoutés*

| # | Événement redouté | VM | Gravité |
|---|---|---|---|
| ER1 | Consultation de documents de santé par un tiers après usurpation d'un compte patient [ACRA] | VM1, VM3 | 4 [ACRA]. Je le ramènerais à 3 si les cas restent isolés. |
| ER2 | Document ou résultat diffusé au mauvais patient (erreur d'identité ou de rattachement) [ACRA] | VM1, VM2 | 4 |
| ER3 | Moissonnage massif de documents par énumération d'identifiants sur l'API [ACRA] | VM1 | 4 |
| ER4 | Indisponibilité prolongée du portail et des rendez-vous en ligne [ACRA] | VM4 | 2 |

**Atelier 2 : sources de risque**

| # | Source de risque | Objectif visé | Pertinence |
|---|---|---|---|
| SR1 | Cybercriminel pratiquant le bourrage d'identifiants sur les comptes patients [ACRA] | Revente de données de santé, extorsion | 3 [ACRA] |
| SR2 | Groupe de rançongiciel ciblant les hôpitaux [ACRA] | Gain par extorsion, en visant l'hébergeur ou le rebond vers le DPI | 3 [ACRA] |
| SR3 | Proche ou tiers malveillant connaissant le patient (conjoint, employeur) [ACRA] | Contrôle, conflit, curiosité | 3 [ACRA] |

Retenu en complément (non chiffré) : l'attaquant opportuniste qui teste l'API publique [ACRA], pertinence 2.

**Atelier 3 : écosystème et scénarios stratégiques**
Parties prenantes critiques [ACRA] :
- hébergeur HDS du portail (dépendance 4, pénétration 4, maturité 3, confiance 3) ;
- éditeur du portail (4 / 3 / 3 / 3) ;
- fournisseurs d'identité (3 / 2 / 4 / 4) ;
- médecins de ville (2 / 3 / 2 / 3), maillon le moins fiable.

| # | Scénario stratégique | ER | G | V |
|---|---|---|---|---|
| SS1 | SR1 prend le contrôle de comptes patients, par bourrage d'identifiants ou détournement de la réinitialisation faute de double facteur, et exfiltre leurs documents [ACRA] | ER1 | 4 | 3 |
| SS2 | Un attaquant exploite un défaut d'autorisation objet par objet de l'API (OWASP API1:2023) pour lire les documents d'autres patients [ACRA] | ER3 | 4 | 2 [ACRA]. Je le passerais à 3 si l'application mobile expose des identifiants séquentiels. |
| SS3 | SR2 compromet l'hébergeur : le portail devient indisponible, puis l'attaquant tente de rebondir vers le DPI par les connecteurs d'interopérabilité [ACRA] | ER4, et extension possible vers le DPI | 3 | 2 |

**Atelier 4 : scénarios opérationnels**
*SO1, déclinaison de SS1 : prise de contrôle de comptes patients.* Vraisemblance estimée : 3.
1. Reconnaissance : achat de listes d'identifiants issues de fuites tierces (expertise).
2. Accès initial : bourrage d'identifiants automatisé sur la page de connexion [ACRA]. Variante : détournement de la réinitialisation par SMS après échange frauduleux de carte SIM [ACRA].
3. Maintien : ajout d'un facteur ou d'un appareil contrôlé par l'attaquant, modification de l'adresse de notification (expertise).
4. Exploitation : consultation et téléchargement des comptes rendus, résultats et images.
5. Impact : revente des données ou chantage envers le patient (expertise).

*SO2, déclinaison de SS2 : moissonnage par l'API.* Vraisemblance estimée : 2 à 3.
1. Création d'un compte patient légitime.
2. Analyse du trafic de l'application mobile et découverte des points d'accès aux documents (expertise).
3. Escalade : énumération des identifiants de documents, où un compte légitime télécharge les documents d'autrui [ACRA].
4. Exfiltration automatisée en masse sous les seuils de débit (expertise).
5. Impact : publication ou revente. La violation doit être notifiée à la CNIL (RGPD art. 33, 72 h [ACRA]) et aux personnes (art. 34). Il faut aussi signaler l'incident à l'ARS / CERT Santé (L. 1111-8-2, délai à vérifier).

**Atelier 5 : plan de traitement (8 mesures)**

| # | Mesure | Type | Priorité | Risques couverts |
|---|---|---|---|---|
| M1 | Double facteur pour les patients et fédération FranceConnect ; réinitialisation sans SMS seul [ACRA] (ISO/IEC 27001:2022, A.8.5) | Technique / protection | P1 | SS1, SO1 |
| M2 | Contrôle d'autorisation objet par objet sur chaque appel d'API, identifiants non prévisibles, tests automatisés [ACRA] (OWASP API1:2023) | Technique / protection | P1 | SS2, SO2 |
| M3 | Limitation de débit, détection du bourrage d'identifiants, blocage progressif, alerte au centre de supervision [ACRA] | Technique / défense | P1 | SO1, SO2 |
| M4 | Diffusion au patient seulement après rapprochement avec l'INS qualifiée et validation médicale [ACRA] (CSP L. 1111-8-1) | Organisationnelle / protection | P1 | ER2 |
| M5 | Accès des médecins de ville conditionné à une relation de soins vérifiée, limitée dans le temps et tracée ; Pro Santé Connect ou e-CPS [ACRA] | Organisationnelle et technique | P1-P2 | ER1, abus de compte professionnel |
| M6 | Flux portail → DPI restreints (sens unique, passerelle dédiée) [ACRA] ; convention HDS et éditeur couvrant incidents, tests d'intrusion et réversibilité [ACRA] | Technique et contractuelle / écosystème | P1 | SS3 |
| M7 | Détection des accès anormaux, alerte au patient à chaque nouvelle connexion, historique des accès visible par le patient [ACRA] | Détective / défense | P2 | SS1, SS2, SR3 |
| M8 | Tests d'intrusion du portail et de l'application à chaque version majeure [ACRA] (ISO/IEC 27001:2022, A.8.29) ; continuité testée avec l'hébergeur (rendez-vous par téléphone, restauration) [ACRA] | Technique et organisationnelle | P2 | SS2, SS3, ER4 |

Risques résiduels à suivre :
- KRI [ACRA] : part des comptes protégés par un double facteur (%) et nombre de comptes signalés comme usurpés.
- Contrôles [ACRA] : tests d'autorisation de l'API (trimestriels) et échantillonnage INS des documents publiés (mensuel).
