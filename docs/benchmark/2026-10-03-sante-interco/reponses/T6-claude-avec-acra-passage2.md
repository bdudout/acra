# T6 — Claude (Opus 5.5) avec ACRA, passage 2

**Portail patients et professionnels d'un groupement hospitalier : analyse EBIOS RM, ateliers 1 à 5**

**Atelier 1 : cadrage et socle**

Valeurs métier (cotation D/I/C/T de 1 à 4) :

| # | Valeur métier | Nature | D | I | C | T | Responsable |
|---|---|---|---|---|---|---|---|
| VM1 | Mise à disposition des comptes rendus, résultats de biologie et images aux patients | Processus | 3 | 4 | 4 | 4 | Direction du numérique et direction des soins |
| VM2 | Accès des médecins de ville aux documents de leurs patients | Processus | 3 | 4 | 4 | 4 | Direction médicale et DSI |
| VM3 | Prise de rendez-vous et messagerie entre patients et services | Processus | 3 | 3 | 3 | 3 | Direction des patients et secrétariats médicaux |
| VM4 | Comptes et identités des usagers (patients, aidants, professionnels) | Information | 3 | 4 | 4 | 4 | RSSI et DPO |
| VM5 | Consentements, oppositions et traces d'accès | Information | 2 | 4 | 3 | 4 | DPO |

Biens supports :

| # | Bien support | Type | Valeurs portées |
|---|---|---|---|
| BS1 | Front web, application mobile et API du portail (backend for frontend, jetons de session et de rafraîchissement) | Logiciel | VM1 à VM4 |
| BS2 | Fournisseur d'identité et fédération : FranceConnect pour les patients, Pro Santé Connect ou e-CPS pour les professionnels, double facteur | Logiciel | VM2, VM4 |
| BS3 | Connecteurs d'interopérabilité entre le portail et le dossier patient (EAI ; HL7 v2, FHIR, documents CDA ; DICOMweb pour l'imagerie) | Réseau / logiciel | VM1, VM2 |
| BS4 | Infrastructure de l'hébergeur certifié HDS (IaaS/PaaS, stockage des documents, sauvegardes, infogérance) | Sous-traitance | Toutes |
| BS5 | Service d'envoi de notifications (SMS, courriel, notifications mobiles), utilisé aussi pour les codes de réinitialisation | Sous-traitance | VM3, VM4 |
| BS6 | Base des comptes usagers, des consentements et des journaux d'accès | Données | VM4, VM5 |

Événements redoutés :

| # | Événement redouté | Impacts | Gravité |
|---|---|---|---|
| ER1 | Divulgation massive de documents de santé, par moissonnage de l'API ou par exfiltration chez l'hébergeur | Violation de données de santé (RGPD art. 9), notification à la CNIL et aux personnes, crise médiatique, extorsion | 4 |
| ER2 | Document ou résultat publié au mauvais patient, ou altéré entre le dossier patient et le portail | Divulgation de données de santé, décision médicale erronée, perte de confiance | 4 |
| ER3 | Consultation illégitime des documents d'un patient : compte usurpé, proche malveillant, médecin hors relation de soins | Atteinte grave à la vie privée (par exemple violences conjugales), violation à notifier | 3 |
| ER4 | Indisponibilité prolongée du portail, des rendez-vous en ligne et de la messagerie | Consultations reportées, accueil téléphonique saturé | 2 |

Socle de sécurité :
- Code de la santé publique (CSP) : art. L. 1111-8 (hébergement de données de santé), L. 1111-8-1 (identifiant national de santé, INS), L. 1111-8-2 (signalement des incidents de sécurité à l'ARS et au CERT Santé, à vérifier).
- RGPD : art. 9, 28, 32, 33 et 34, et art. 35. Une analyse d'impact (AIPD) est requise pour un traitement de données de santé à grande échelle.
- PGSSI-S.
- ISO/IEC 27001:2022.
- OWASP API Security Top 10 — 2023.

**Atelier 2 : sources de risque et objectifs visés**

| Source de risque | Objectif visé | Motivation | Ressources | Pertinence |
|---|---|---|---|---|
| SR1. Cybercriminel pratiquant le bourrage d'identifiants et l'analyse d'API publiques | Collecter en masse des documents de santé pour les revendre ou faire chanter les patients | Lucrative (forte) | Listes d'identifiants issues de fuites, proxys résidentiels, outils d'analyse d'API | Élevée |
| SR2. Groupe de rançongiciel ciblant les hôpitaux (double extorsion) | Chiffrer et exfiltrer le SI de soins en entrant par le portail, sa messagerie ou ses prestataires | Lucrative (forte) | Élevées : courtiers d'accès initial, outils de mouvement latéral | Élevée |
| SR3. Proche ou tiers malveillant connaissant le patient (conjoint, famille), ou professionnel indiscret | Lire les données d'un patient précis | Contrôle, conflit, curiosité | Faibles, mais accès au téléphone ou aux codes du patient, ou compte professionnel légitime | Moyenne à élevée |

**Atelier 3 : écosystème et scénarios stratégiques**

Parties prenantes critiques. L'exposition est le produit dépendance × pénétration ; la fiabilité est le produit maturité × confiance.

| Partie prenante | Dépendance | Pénétration | Maturité | Confiance | Exposition | Fiabilité | Lecture |
|---|---|---|---|---|---|---|---|
| Hébergeur HDS du portail | 4 | 4 | 3 | 3 | 16 | 9 | Danger |
| Éditeur du portail (maintenance, mises en production) | 4 | 3 | 3 | 3 | 12 | 9 | Danger |
| Médecins de ville correspondants | 2 | 3 | 2 | 3 | 6 | 6 | Contrôle |
| Fournisseurs d'identité (FranceConnect, Pro Santé Connect) | 3 | 2 | 4 | 4 | 6 | 16 | Veille |

Scénarios stratégiques :

| # | Scénario (critère touché) | Chemin d'attaque | Événements redoutés | Gravité | Vraisemblance |
|---|---|---|---|---|---|
| SS1 | Prise de contrôle de comptes patients puis exfiltration de leurs documents (C) | SR1 → page de connexion et réinitialisation par SMS (bien support du service de notifications) → comptes patients sans double facteur → téléchargement de documents | ER3, puis ER1 à l'échelle | 4 | 3 |
| SS2 | Moissonnage par défaut d'autorisation de l'API (accès direct à un objet non autorisé), ou par un compte de médecin de ville compromis par hameçonnage qui cherche des patients hors de sa patientèle (C) | SR1 → API du portail (identifiants de documents prévisibles, contrôle objet absent côté serveur) ou poste du médecin de ville → documents d'autres patients | ER1 | 4 | 2 (3 sans test d'intrusion ni test automatisé) |
| SS3 | Rançongiciel : rebond depuis le portail vers le dossier patient (D, puis C) | SR2 → pièce jointe piégée déposée dans la messagerie et ouverte par un soignant, ou compromission de l'éditeur ou de l'hébergeur → connecteurs d'interopérabilité ou poste hospitalier → dossier patient chiffré et exfiltré | ER4 étendu au SI de soins, ER1 | 4 | 2 |

**Atelier 4 : scénarios opérationnels**

SO1, qui décline SS1 (vraisemblance 3) :
1. Reconnaissance : l'attaquant achète des listes d'identifiants issues de fuites (T1589.001).
2. Accès initial : bourrage d'identifiants distribué sur des proxys résidentiels, à faible débit par adresse pour rester sous les seuils (T1110.004, T1090.002).
3. Contournement du facteur SMS : échange frauduleux de carte SIM (T1451), ou appel au support en se faisant passer pour le patient pour obtenir la réinitialisation (T1656). La réinitialisation par SMS seul est ainsi détournée (T1111).
4. Connexion avec un compte valide depuis l'application mobile, puis réutilisation d'un jeton de rafraîchissement à longue durée (T1078).
5. Collecte : téléchargement scripté de tous les comptes rendus, résultats et images via l'API (T1119, T1213).
6. Monétisation : revente des documents, ou extorsion des patients ciblés (sérologies, psychiatrie, IVG).

SO2, qui décline SS3 (vraisemblance 2) :
1. L'attaquant crée un compte patient ou en usurpe un, puis envoie par la messagerie du portail un PDF, un document Office à macro ou une archive piégée (T1566.003).
2. Une secrétaire médicale ouvre le fichier sur un poste du réseau hospitalier (T1204.002).
3. Un chargeur installe un canal de commande en HTTPS (T1071.001).
4. Vol d'identifiants : extraction de la mémoire des identifiants et Kerberoasting jusqu'à un compte d'administration (T1003, T1558.003).
5. Mouvement latéral en SMB ou RDP vers les serveurs de l'EAI et du dossier patient (T1021.002, T1021.001).
6. Suppression des sauvegardes accessibles (T1490), exfiltration vers un stockage en nuage (T1567.002), puis chiffrement (T1486). Les soins basculent en mode dégradé.

**Atelier 5 : plan de traitement**

| # | Mesure | Type | Priorité | Risque couvert | Référence |
|---|---|---|---|---|---|
| M1 | Double facteur pour les patients (application TOTP ou clé d'accès FIDO2) avec fédération FranceConnect. Réinitialisation jamais par SMS seul. Jetons de rafraîchissement courts et révocables. | Technique, préventive | P1 | SS1, ER3 | ISO/IEC 27001:2022, A.8.5 |
| M2 | Anti-automatisation : limitation de débit par compte, par adresse et par empreinte d'appareil, détection du bourrage d'identifiants, blocage progressif, alerte au SOC. Alerte au patient à chaque nouvelle connexion et historique des accès visible par lui. | Détective | P1 | SS1, SS2 | OWASP API4:2023 |
| M3 | Contrôle d'autorisation objet par objet sur chaque appel d'API, identifiants opaques non prévisibles, tests BOLA automatisés dans la chaîne d'intégration continue, plafond de téléchargements par session. | Technique, préventive | P1 | SS2, ER1 | OWASP API Security Top 10 — 2023, API1 |
| M4 | Professionnels authentifiés par Pro Santé Connect ou e-CPS. Accès des médecins de ville conditionné à une relation de soins vérifiée (accord du patient, durée limitée, retrait automatique). Revue mensuelle des accès atypiques avec le DPO. | Technique et organisationnelle | P1 | SS2, ER3 | RGPD art. 32 ; PGSSI-S |
| M5 | Analyse des pièces jointes de la messagerie : formats autorisés limités (PDF, JPEG), taille bornée, désarmement et reconstruction du contenu (CDR), bac à sable, quarantaine, ouverture sur un poste isolé. | Technique, défensive | P1 | SS3 | ISO/IEC 27001:2022, A.8.7 |
| M6 | Flux du portail vers le dossier patient restreints : le dossier patient publie vers le portail (sens unique), passerelle dédiée en DMZ, TLS mutuel, filtrage strict. Télémaintenance de l'éditeur et de l'hébergeur ouverte à la demande, nominative et enregistrée. | Technique, préventive | P1 | SS3 | ISO/IEC 27001:2022, A.8.22 et 5.20 |
| M7 | Publication uniquement après rapprochement avec l'INS qualifiée et validation médicale. Empreinte de chaque document publié et contrôle de concordance avec le dossier patient : toute divergence bloque la publication. | Organisationnelle et technique | P1 | ER2 | CSP art. L. 1111-8-1 |
| M8 | Gouvernance HDS et résilience. Contrat avec l'hébergeur et l'éditeur couvrant le sous-traitant (RGPD art. 28) : notification d'incident chiffrée, droit d'audit, réversibilité, sous-traitance ultérieure. Test d'intrusion avant chaque version majeure. Sauvegardes immuables et restauration testée. Mode dégradé du portail exercé une fois par an (message d'indisponibilité, rendez-vous par téléphone). | Organisationnelle, résilience | P2 | SS3, ER4 | CSP art. L. 1111-8 ; ISO/IEC 27001:2022, A.8.29 et 5.30 |
