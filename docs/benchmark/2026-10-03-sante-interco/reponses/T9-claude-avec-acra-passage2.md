# T9 — Claude (Opus 5.5) avec ACRA, passage 2

**Plateforme de téléconsultation hébergeant des données de santé pour des professionnels : contrôles permanents et KRI**

Le cadre est le suivant : la plateforme est sous-traitante des professionnels, qui sont responsables de traitement, et soumise à la certification HDS.

**10 contrôles permanents**

| # | Contrôle | Périodicité | Type | Risque couvert | Référence |
|---|---|---|---|---|---|
| 1 | Vérification du maintien de la certification HDS (périmètre, activités couvertes, audits de surveillance) et suivi des écarts d'audit jusqu'à leur clôture | Annuelle, suivi trimestriel des écarts | Préventif | Hébergement non conforme, perte de la certification | CSP art. L. 1111-8 ; référentiel de certification HDS en vigueur (version à vérifier) |
| 2 | Revue des accès de support et d'administration : ouverts à la demande, nominatifs, enregistrés, sans compte permanent ni partagé | Trimestrielle | Détectif | Compromission d'un compte d'administration par un outil de support à distance | ISO/IEC 27001:2022, A.8.2 et A.5.18 |
| 3 | Tests automatisés du cloisonnement entre clients et de l'autorisation objet par objet de l'API (identifiant de client non modifiable côté navigateur) | À chaque version, synthèse trimestrielle | Détectif | Fuite des dossiers d'un cabinet vers un autre | OWASP API Security Top 10 — 2023, API1 et API3 |
| 4 | Couverture de l'authentification des professionnels par Pro Santé Connect ou e-CPS, sans compte local à mot de passe seul | Mensuelle | Détectif | Usurpation d'un compte professionnel | ISO/IEC 27001:2022, A.8.5 ; PGSSI-S |
| 5 | Vérification du chiffrement des téléconsultations (TLS, DTLS-SRTP), de la configuration des relais média et de l'absence d'enregistrement sans consentement | Semestrielle et à chaque changement | Détectif | Interception ou enregistrement illicite d'une consultation | ISO/IEC 27001:2022, A.8.24 ; CSP art. R. 6316-1 et suivants (télémédecine, à vérifier) |
| 6 | Revue des accès aux dossiers hors relation entre le patient et le professionnel, et des accès d'urgence | Mensuelle | Détectif | Consultation illégitime de données de santé | RGPD art. 32 ; PGSSI-S |
| 7 | Contrôle de la gestion des clés : clés gérées hors de la plateforme applicative (KMS ou HSM), séparation des administrateurs, rotation | Semestrielle | Préventif | Déchiffrement des données par un administrateur ou un attaquant interne | ISO/IEC 27001:2022, A.8.24 |
| 8 | Test de restauration des bases et des documents depuis des sauvegardes immuables, avec RTO et RPO chronométrés | Semestrielle | Détectif | Rançongiciel, perte de données | ISO/IEC 27001:2022, A.8.13 |
| 9 | Suivi des vulnérabilités critiques (composants web, WebRTC, dépendances, images de conteneurs) corrigées dans les délais, et test d'intrusion annuel | Mensuelle, test d'intrusion annuel | Détectif | Exploitation d'une faille exposée | ISO/IEC 27001:2022, A.8.8 et A.8.29 |
| 10 | Exercice de la procédure de notification des violations aux clients, avec tenue du registre des violations, et test du PCA/PRA de la plateforme (bascule, durées mesurées, information des clients) | Semestrielle pour la notification, annuelle pour le PCA | Correctif | Notification tardive, indisponibilité prolongée | RGPD art. 33 § 2 et art. 28 ; ISO/IEC 27001:2022, A.5.30 |

**6 KRI**

| KRI | Unité | La situation se dégrade quand | Périodicité |
|---|---|---|---|
| Part des comptes professionnels sous Pro Santé Connect ou e-CPS | % | elle baisse | mensuelle |
| Vulnérabilités critiques non corrigées dans le délai cible | nombre | il augmente | mensuelle |
| Indisponibilité du service de téléconsultation | minutes par mois | elle augmente | mensuelle |
| Comptes de support ou d'administration permanents ou non revus | nombre | il augmente | trimestrielle |
| Écarts d'audit HDS non clos à échéance | nombre | il augmente | trimestrielle |
| Ancienneté du dernier test de restauration réussi | jours | elle augmente | mensuelle |
