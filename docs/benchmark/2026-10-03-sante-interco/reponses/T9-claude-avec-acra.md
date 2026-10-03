# T9 — Claude (Opus 5.5) avec ACRA

**Plateforme de téléconsultation hébergeant des données de santé pour des professionnels : contrôles permanents et KRI**
Sources : [ACRA] = catalogue SANTE, catalogue TECHNIQUE, contrôles transverses et sous-secteur sante-esante ; références ISO ajoutées par expertise quand ACRA n'en fournit pas.

*Contrôles permanents (types D = détectif, P = préventif)*

| # | Contrôle | Périodicité | Type | Risque couvert | Référence |
|---|---|---|---|---|---|
| C1 | Vérification de la certification HDS (périmètre, activités, échéance) de la plateforme et de ses sous-traitants, et des clauses contractuelles [ACRA, sante.control.hds-certificates] | Annuel | P | Hébergeur non certifié ou défaillant | CSP art. L. 1111-8 [ACRA] ; référentiel de certification HDS (version à vérifier) |
| C2 | Revue des accès aux dossiers hors relation de soins et des accès « bris de glace » [ACRA, record-access et break-glass] | Mensuel | D | Divulgation de données de santé | PGSSI-S [ACRA] ; RGPD art. 32 [ACRA] |
| C3 | Couverture de l'authentification forte : Pro Santé Connect / e-CPS pour les professionnels, double facteur pour les patients [ACRA, portal-mfa-coverage] | Mensuel | D | Usurpation de comptes | ISO/IEC 27001:2022, A.8.5 [ACRA] |
| C4 | Tests automatisés d'autorisation des API et du cloisonnement entre clients (établissements, cabinets) [ACRA, api-authz-tests et sante-esante] | Trimestriel | D | Fuite multi-clients par API ou rupture d'isolation | OWASP API Security Top 10 2023, API1 et API3 [ACRA] |
| C5 | Revue des comptes à privilèges et des accès de support et d'administration à distance [ACRA, privileged-review] | Trimestriel | D | Compromission par un accès de support | ISO/IEC 27001:2022, A.8.2 et A.5.18 (expertise) |
| C6 | Suivi des correctifs de sécurité en retard (plateforme, briques vidéo, application mobile) [ACRA, patch-follow-up] | Mensuel | D | Vulnérabilité exploitée | ISO/IEC 27001:2022, A.8.8 (expertise) |
| C7 | Test de restauration des sauvegardes des données de santé et des dossiers [ACRA, backup-restore] | Semestriel | D | Perte de données, rançongiciel | ISO/IEC 27001:2022, A.8.13 (expertise) |
| C8 | Vérification du chiffrement au repos et en transit et de la séparation des clés vis-à-vis des administrateurs applicatifs ; absence d'enregistrement des téléconsultations sans consentement [ACRA, sante-esante] | Semestriel | P | Divulgation, accès d'un administrateur | ISO/IEC 27001:2022, A.8.24 [ACRA] |
| C9 | Revue des alertes et journaux de sécurité, avec un test de la procédure de notification des violations aux clients responsables de traitement [ACRA] | Mensuel (revue) ; annuel (test) | D | Intrusion non détectée, notification tardive | ISO/IEC 27001:2022, A.8.15 et A.8.16 ; RGPD art. 33 [ACRA] ; CSP art. L. 1111-8-2 pour le signalement à l'ARS / CERT Santé (applicabilité à un hébergeur à vérifier) |
| C10 | Suivi des demandes d'accès et de rectification des patients, et contrôle par échantillon des consentements et oppositions [ACRA, patient-rights et consent-sample] | Mensuel ; trimestriel pour l'échantillon | D | Droits des personnes non respectés | RGPD art. 15-16 [ACRA : RGPD] ; CSP art. L. 1111-7 (expertise) |

*KRI*

| KRI | Unité | Sens de dégradation | Périodicité |
|---|---|---|---|
| Part des comptes protégés par un double facteur ou par Pro Santé Connect [ACRA, sante.kri.portal-mfa-rate] | % | baisse | mensuel |
| Accès d'urgence aux dossiers sans justification a posteriori [ACRA, sante.kri.breakglass-accesses] | nombre | hausse | mensuel |
| Vulnérabilités critiques non corrigées dans les délais [ACRA, core.kri.overdue-patches] | nombre | hausse | mensuel |
| Durée d'indisponibilité du service de téléconsultation [adapté d'ACRA, sante.kri.care-downtime] | heures (ou % de disponibilité) | hausse de la durée (baisse du %) | mensuel |
| Ancienneté du dernier test de restauration réussi [ACRA, core.kri.restore-age] | jours | hausse | mensuel |
| Requêtes d'API refusées pour défaut d'autorisation [ACRA, technique.kri.api-denied-requests] : un pic signale un sondage, une chute brutale un contrôle désactivé | nombre | écart à la référence, à la hausse ou à la baisse | mensuel |
