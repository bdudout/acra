# T8 — Claude (Opus 5.5) seul

**Assureur santé ↔ délégataire de gestion (API REST et fichiers, flux dans les deux sens)**

Textes applicables (cités sans reproduction) :
- RGPD : art. 9 (données de santé), art. 26 ou 28 (qualification responsable conjoint ou sous-traitant, à analyser), art. 32, art. 33 et 34, art. 35 (AIPD).
- Code de la santé publique, art. L.1111-8 (HDS), si le délégataire héberge des données de santé pour le compte de l'assureur (applicabilité à vérifier selon le schéma).
- Solvabilité II : directive 2009/138/CE, art. 49 (sous-traitance) ; règlement délégué (UE) 2015/35, art. 274 ; transposition dans le Code des assurances (article à vérifier) ; orientations de l'EIOPA sur la sous-traitance au cloud.
- DORA (Règlement (UE) 2022/2554) : art. 28 à 30 (tiers TIC, registre d'information, clauses), art. 19 (notification des incidents majeurs).
- Pour une mutuelle ou une institution de prévoyance : Code de la mutualité, Code de la sécurité sociale (applicabilité à vérifier).
- Recommandations de la CNIL sur les données de santé des organismes complémentaires (à vérifier).
- ISO/IEC 27001:2022, Annexe A, mesures 5.19 à 5.23 (fournisseurs, dont le cloud en 5.23).

**Cartographie des parties prenantes (atelier 3)**
Méthode : exposition = dépendance × pénétration ; fiabilité cyber = maturité × confiance.
| Partie prenante | Dépendance | Pénétration | Maturité | Confiance | Zone |
|---|---|---|---|---|---|
| Délégataire de gestion | 4 | 4 (API et fichiers dans les deux sens, données de santé) | 2-3 | 2-3 | Danger, à surveiller en priorité |
| Infogérant ou hébergeur du délégataire | 3 | 3 | 3 | 2 | Contrôle |
| Éditeur du logiciel de gestion du délégataire | 3 | 3 (télémaintenance) | 2 | 2 | Danger |
| Prestataire de numérisation et de GED (pièces justificatives) | 2 | 2 | 2 | 2 | Contrôle |
| Opérateur de transfert de fichiers / plateforme d'API (passerelle) | 3 | 3 | 3 | 3 | Veille |
| Courtiers et entreprises clientes (adhésions collectives) | 2 | 1-2 | 2 | 2 | Veille |
| Professionnels de santé et organismes de tiers payant (flux de prestations) | 2 | 1 | 2 | 2 | Hors zone |

**Scénarios stratégiques**
| # | Scénario | G | V |
|---|---|---|---|
| SS1 | Un cybercriminel compromet le délégataire (moins mature), utilise le canal d'API ou de fichiers de confiance pour rebondir dans le SI de l'assureur (rançongiciel) et exfiltre les données de santé des adhérents | 4 | 3 |
| SS2 | Un fraudeur, interne au délégataire ou externe, modifie les flux de prestations ou de cotisations (RIB, montants, adhésions fictives) pour détourner des fonds | 4 | 2 |
| SS3 | Fuite de données de santé par sur-partage (flux non minimisés, pièces justificatives transmises en clair, accès excessifs côté délégataire) ou par erreur de routage | 3 | 3 |

**Scénarios opérationnels**
SO1, rattaché à SS1 :
1. Phishing d'un gestionnaire du délégataire.
2. Mouvement latéral jusqu'au serveur portant le secret client de l'API (client_id / secret) ou la clé SFTP.
3. Appels à l'API de l'assureur avec un jeton légitime : énumération massive des adhérents, faute de quota et de contrôle de périmètre.
4. Dépôt d'un fichier piégé (macro, ou exploitation du parseur XML / CSV : XXE, injection de formules) traité automatiquement côté assureur.
5. Exécution de code, puis compromission de l'assureur.

SO2, rattaché à SS2 :
1. Création ou réactivation d'un compte interne au délégataire.
2. Modification en masse de RIB d'adhérents ou création d'adhérents fictifs.
3. Génération de prestations fictives transmises dans le fichier hebdomadaire.
4. Intégration automatique et paiement par l'assureur, sans contrôle de cohérence.
5. Effacement des traces chez le délégataire.

**Mesures de sécurité de l'interconnexion**
| # | Mesure | Nature | Référence |
|---|---|---|---|
| 1 | Authentification mutuelle forte des systèmes (mTLS, OAuth2 avec certificats), secrets dans un coffre, rotation | Technique | RGPD art. 32 ; ISO 27001:2022 A.8.5 et A.8.24 |
| 2 | Moindre privilège sur les API : périmètre limité au portefeuille délégué, quotas et limitation de débit, contrôle d'autorisation objet par objet | Technique | ISO 27001 A.5.15 ; OWASP API Security Top 10 2023 |
| 3 | Signature et chiffrement de bout en bout des fichiers, contrôle d'intégrité, anti-rejeu, validation de schéma | Technique | RGPD art. 32 ; ISO 27001 A.8.24 |
| 4 | Zone d'échange (DMZ / passerelle) avec analyse antivirale et bac à sable ; parseurs durcis ; aucun lien réseau direct entre les SI | Technique | ISO 27001 A.8.20 à A.8.22 |
| 5 | Minimisation : échange des seules données de santé nécessaires, pièces justificatives séparées et chiffrées, pseudonymisation lorsque c'est possible | Technique / organisationnelle | RGPD art. 5 et 25 ; AIPD (art. 35) |
| 6 | Contrôles métier croisés avant paiement : rapprochement des cotisations et des prestations, alerte sur les changements de RIB, validation 4 yeux, réconciliation périodique | Organisationnelle | Solvabilité II art. 46 (contrôle interne, à vérifier) |
| 7 | Journalisation corrélée des deux côtés, envoi vers le SOC, alertes sur les volumes anormaux | Technique | ISO 27001 A.8.15 et A.8.16 ; DORA art. 10 |
| 8 | Convention d'interconnexion et contrat : qualification RGPD (art. 26 ou 28), clauses DORA (art. 30) ou Solvabilité II, niveaux de service, notification d'incident (délai), sous-traitance ultérieure soumise à accord, localisation, réversibilité et stratégie de sortie | Contractuelle | RGPD art. 28 ; DORA art. 28 à 30 ; règlement délégué 2015/35 art. 274 |
| 9 | Droit d'audit et plan de contrôle du délégataire : questionnaire annuel, preuves (certification ISO 27001 ou HDS si applicable), pentest de l'interface, suivi des écarts | Contractuelle / contrôle | DORA art. 28 ; EIOPA (orientations sous-traitance) |
| 10 | Plan de coupure et de continuité de l'interconnexion : coupure d'urgence (kill switch) en cas de compromission d'une partie, exercice conjoint de crise, procédure commune de notification (CNIL sous 72 h, RGPD art. 33 ; autorité de contrôle) | Technique / organisationnelle | RGPD art. 33 et 34 ; DORA art. 11 et 19 |
