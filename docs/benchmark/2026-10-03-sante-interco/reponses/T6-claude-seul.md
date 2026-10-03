# T6 — Claude (Opus 5.5) seul

**Portail patients / médecins de ville, groupement hospitalier (EBIOS RM, ateliers 1 à 5)**

**Atelier 1 : cadrage et socle de sécurité**
Socle applicable :
- RGPD, art. 9 (données de santé), art. 32 et art. 35 (AIPD a priori obligatoire : données de santé traitées à grande échelle).
- Code de la santé publique (CSP) : secret médical (art. L.1110-4) et hébergement HDS (art. L.1111-8). Le référentiel HDS en vigueur est la v2 (date d'arrêté à vérifier).
- PGSSI-S et référentiels de l'ANS : identification électronique des usagers et des professionnels (Pro Santé Connect / e-CPS), INS.
- Référentiels de la doctrine du numérique en santé.
- NIS2 : l'établissement de santé serait entité essentielle, transposition française à vérifier.
- Signalement des incidents graves (CSP, art. L.1111-8-2, à vérifier) auprès du CERT Santé / ANS.

Valeurs métier (VM) :
| # | Valeur métier | Besoins D / I / C / T |
|---|---|---|
| VM1 | Mise à disposition des comptes rendus, résultats de biologie et imagerie aux patients | D modéré, I forte, C très forte, T forte |
| VM2 | Partage des documents avec les médecins de ville (coordination des soins) | D forte, I très forte, C très forte |
| VM3 | Prise de rendez-vous en ligne | D forte, I modérée |
| VM4 | Messagerie patient ↔ services de soins | C très forte, I forte, T forte |
| VM5 | Gestion des identités et des droits d'accès (patients, représentants légaux, professionnels) | I très forte, T très forte |

Biens supports (BS) :
| # | Bien support | Valeurs métier portées |
|---|---|---|
| BS1 | Application web du portail et API (front + back), chez l'hébergeur HDS | VM1 à VM4 |
| BS2 | Application mobile patient (iOS / Android) et ses services de notification push | VM1, VM3, VM4 |
| BS3 | Fournisseur d'identité / IAM : comptes patients, MFA, fédération Pro Santé Connect | VM5 |
| BS4 | Passerelle d'interconnexion avec le DPI (flux HL7 / FHIR, middleware EAI) | VM1, VM2 |
| BS5 | Infrastructure de l'hébergeur HDS : IaaS / PaaS, bases de données, stockage des images (viewer PACS / DICOM), sauvegardes | Toutes |
| BS6 | Équipes d'exploitation : infogérant, DSI du groupement, éditeur du portail, accès d'administration à distance | Toutes |

Événements redoutés (ER) :
| # | Événement redouté | Impacts | G (1-4) |
|---|---|---|---|
| ER1 | Divulgation massive de données de santé (exfiltration de la base ou des documents) | Atteinte au secret médical, sanction CNIL, chantage, perte de confiance | 4 |
| ER2 | Altération ou mauvaise attribution de documents (résultat d'un patient affiché chez un autre, collision d'identité) | Erreur de prise en charge, risque vital, responsabilité médicale | 4 |
| ER3 | Indisponibilité prolongée du portail ou de l'interconnexion DPI (plus de 48 h) | Retards de soins, report vers le téléphone, rendez-vous perdus | 2 |
| ER4 | Usurpation d'un compte patient ou professionnel, accès illégitime à des dossiers ciblés | Atteinte à la vie privée (VIP, mineurs, violences conjugales), plaintes | 3 |

**Atelier 2 : sources de risque (SR) et objectifs visés (OV)**
| SR | Objectif visé | Pertinence |
|---|---|---|
| SR1 | Groupe cybercriminel, rançongiciel avec double extorsion : chiffrement et exfiltration pour obtenir une rançon | Élevée (secteur santé très ciblé) |
| SR2 | Individu malveillant ciblé : conjoint, proche, journaliste ou enquêteur privé, qui veut accéder au dossier d'une personne précise | Élevée |
| SR3 | Initié ou prestataire (administrateur de l'infogérant, salarié curieux) : consultation illégitime ou revente de données | Moyenne |

**Atelier 3 : scénarios stratégiques (G = gravité, V = vraisemblance)**
| # | Scénario | ER | G | V |
|---|---|---|---|---|
| SS1 | SR1 compromet l'éditeur ou l'infogérant (accès d'administration à distance), rebondit sur l'infrastructure HDS du portail, exfiltre les documents puis chiffre | ER1, ER3 | 4 | 3 |
| SS2 | SR2 obtient les identifiants du patient (phishing, appareil partagé, réinitialisation par SMS) ou exploite une faille d'autorisation de l'API (IDOR) pour consulter le dossier de la cible | ER4 (ER1 si l'IDOR est exploitée à grande échelle) | 3 | 3 |
| SS3 | SR3, ou une erreur dans la chaîne d'interconnexion DPI (rapprochement d'identité défaillant, INS non qualifiée), aboutit à une publication sur le mauvais dossier | ER2 | 4 | 2 |

**Atelier 4 : scénarios opérationnels**
SO1, rattaché à SS1 (MITRE ATT&CK) :
1. Phishing ciblé ou achat d'identifiants VPN / bastion d'un technicien de l'infogérant (T1566, T1078).
2. Connexion au bastion sans MFA, ou contournement de la MFA par fatigue de notifications (MFA fatigue).
3. Découverte de l'environnement et élévation de privilèges vers un compte d'administration du cloud ou de l'hyperviseur (T1068, T1087).
4. Accès aux bases du portail et au stockage objet des documents.
5. Exfiltration HTTPS vers un stockage cloud de l'attaquant (T1567).
6. Suppression ou chiffrement des sauvegardes en ligne, puis chiffrement des machines virtuelles (T1490, T1486).
7. Chantage et publication sur un site de fuite.
Vraisemblance : 3.

SO2, rattaché à SS2 :
1. Reconnaissance de la cible : date de naissance et numéro de téléphone obtenus par les réseaux sociaux ou la vie commune.
2. Demande de réinitialisation du mot de passe, avec interception de l'OTP par SMS (SIM swapping, ou téléphone de la cible accessible).
3. Connexion au compte patient.
4. Variante : authentification sur son propre compte, puis énumération des identifiants de documents dans l'API (IDOR, OWASP API1:2023 BOLA).
5. Consultation et téléchargement des comptes rendus de la cible.
6. Aucune alerte, car l'accès paraît légitime.
Vraisemblance : 3.

**Atelier 5 : plan de traitement**
| # | Mesure | Type | Priorité | Risque couvert |
|---|---|---|---|---|
| M1 | MFA résistante au phishing et bastion PAM avec enregistrement des sessions pour tous les accès d'administration (infogérant, éditeur, hébergeur) ; comptes nominatifs ; ouverture des accès à la demande | Préventif, technique | P1 | SS1, SO1 |
| M2 | Sauvegardes immuables ou hors ligne (3-2-1), tests de restauration trimestriels, PRA du portail testé | Correctif | P1 | SS1, ER3 |
| M3 | Contrôle d'autorisation objet par objet côté serveur sur toute l'API, identifiants non prédictibles, tests IDOR automatisés en CI et pentest annuel | Préventif | P1 | SS2, SO2 |
| M4 | Identification électronique des patients au niveau requis par le référentiel ANS (niveau à vérifier), alternative à l'OTP SMS pour la réinitialisation, authentification des professionnels par Pro Santé Connect | Préventif | P1 | SS2, ER4 |
| M5 | Identitovigilance : publication uniquement sur INS qualifiée, rapprochement contrôlé, blocage et revue des anomalies, procédure de retrait d'un document mal attribué | Préventif / correctif | P1 | SS3, ER2 |
| M6 | Supervision SOC / SIEM : connexions anormales, volumétrie de téléchargement, accès d'administration. Traçabilité des consultations visible par le patient | Détectif | P2 | SS1, SS2, SS3 |
| M7 | Clauses contractuelles avec l'hébergeur HDS, l'éditeur et l'infogérant : art. 28 RGPD, notification d'incident sous 24 h, droit d'audit, réversibilité, périmètre HDS de chaque activité | Préventif, contractuel | P2 | SS1 |
| M8 | Chiffrement des données au repos (clés gérées dans un HSM / KMS séparé de l'exploitant) et en transit (TLS 1.2+), DLP sur les exports, cloisonnement réseau entre portail, passerelle et DPI | Préventif | P2 | ER1, SS1, SS3 |

Risques résiduels à suivre : SS2 (comportement de l'usager) et SS3 (qualité des identités en amont du DPI).
