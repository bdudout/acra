# T9 — Claude (Opus 5.5) seul

**Plateforme de téléconsultation hébergeant des données de santé (hébergeur HDS)**

Références :
- Référentiel de certification HDS en vigueur (v2 ; numérotation exacte des exigences à vérifier). Il s'appuie sur ISO/IEC 27001:2022 et sur ISO/IEC 27018 (à vérifier).
- CSP, art. L.1111-8 (HDS), R.1111-8-8 et suivants (à vérifier), R.6316-1 et suivants (télésanté, à vérifier).
- RGPD.
- PGSSI-S (ANS).

Contrôles permanents :
| # | Contrôle | Périodicité | Type | Risque couvert | Référence |
|---|---|---|---|---|---|
| C1 | Revue des comptes à privilèges (administrateurs, comptes de service) et de leurs droits | Trimestrielle | Détectif, manuel | Accès illégitime, élévation de privilèges | ISO 27001:2022 A.5.18, A.8.2 |
| C2 | Vérification que les professionnels de santé s'authentifient par MFA ou Pro Santé Connect (aucun compte sans facteur fort) | Mensuelle | Détectif, automatisé | Usurpation de compte de professionnel | ISO 27001 A.8.5 ; référentiel d'identification électronique ANS (à vérifier) |
| C3 | Test de restauration des sauvegardes (base, documents) et contrôle de leur immuabilité | Trimestrielle | Correctif / probant | Perte de données, rançongiciel | ISO 27001 A.8.13 ; HDS (activité 6, sauvegarde) |
| C4 | Revue des vulnérabilités critiques et du respect des délais de correctif (SLA) | Mensuelle | Détectif | Exploitation de vulnérabilité | ISO 27001 A.8.8 |
| C5 | Contrôle de la journalisation des accès aux données de santé et revue des alertes SIEM non traitées | Hebdomadaire | Détectif | Consultation illégitime non détectée | ISO 27001 A.8.15, A.8.16 ; RGPD art. 32 |
| C6 | Contrôle de la localisation des données et des sous-traitants (EEE), et de leur conformité HDS ou ISO | Semestrielle | Préventif, conformité | Transfert hors EEE, sous-traitant non certifié | Référentiel HDS v2 (localisation, à vérifier) ; RGPD chap. V ; ISO 27001 A.5.19 à A.5.23 |
| C7 | Vérification du chiffrement des flux de téléconsultation (vidéo, chat, documents) : configuration TLS / SRTP et gestion des clés | Trimestrielle | Préventif, technique | Interception de la consultation | ISO 27001 A.8.24 ; PGSSI-S |
| C8 | Test du PCA / PRA : bascule et RTO / RPO atteints | Annuelle | Correctif / probant | Indisponibilité de service | ISO 27001 A.5.30, A.8.14 ; HDS |
| C9 | Contrôle du traitement des incidents : délais de qualification, de notification au client responsable de traitement, au CERT Santé / ANS et à la CNIL | Mensuelle (revue de registre) | Détectif | Notification tardive, non-conformité | RGPD art. 33 ; CSP art. L.1111-8-2 (à vérifier) ; ISO 27001 A.5.24 à A.5.26 |
| C10 | Revue des mises en production : changements validés, tests de sécurité (SAST / DAST) passés, absence de données réelles en recette | Mensuelle | Préventif | Régression de sécurité, fuite en environnement hors production | ISO 27001 A.8.25, A.8.29, A.8.32, A.8.33 |

Indicateurs de risque (KRI) :
| KRI | Unité | Sens de dégradation | Périodicité |
|---|---|---|---|
| Vulnérabilités critiques ou élevées ouvertes au-delà du délai prévu | Nombre | Hausse | Hebdomadaire |
| Disponibilité du service de téléconsultation | % | Baisse (seuil à fixer, par exemple 99,9 %) | Mensuelle |
| Comptes de professionnels actifs sans authentification forte | % | Hausse | Mensuelle |
| Incidents de sécurité affectant des données de santé | Nombre (et nombre de patients concernés) | Hausse | Mensuelle |
| Taux de réussite des tests de restauration | % | Baisse | Trimestrielle |
| Délai moyen de détection et de traitement des alertes critiques (MTTD / MTTR) | Heures | Hausse | Mensuelle |
