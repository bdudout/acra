# T11 — Claude (Opus 5.5) seul

**Laboratoire de biologie médicale (LBM) multisite, 12 sites : EBIOS RM, ateliers 3 à 5**

Hypothèses de périmètre :
- **Valeurs métier** : réalisation des examens (dont les urgences), intégrité des résultats, confidentialité des données de santé, continuité de la transmission aux prescripteurs et aux patients.
- **Biens supports** : système de gestion de laboratoire (SGL), middleware et automates, interfaces de prescription électronique, serveur de résultats patients, messagerie sécurisée (MSSanté), annuaire et AD, sauvegardes.

**Barèmes appliqués** (guide ANSSI EBIOS RM) :
- Dépendance, pénétration, maturité et confiance sont cotées de 1 à 4.
- Menace = (Dépendance × Pénétration) / (Maturité cyber × Confiance).
- Les seuils de zone (danger, contrôle, veille) relèvent de la convention de l'analyse. Ici : danger si menace ≥ 2,5, contrôle entre 1 et 2,5, veille en dessous de 1 (à ajuster).

### Atelier 3 : 4 parties prenantes cotées

| # | Partie prenante | Catégorie | Dépendance | Pénétration | Maturité | Confiance | Menace | Zone |
|---|---|---|---|---|---|---|---|---|
| PP1 | Éditeur du SGL (télémaintenance, mises à jour, accès admin) | Prestataire informatique | 4 (SGL critique, pas d'alternative) | 4 (accès distant privilégié, comptes à hauts droits) | 2 (télémaintenance par VPN ou outil de prise en main, MFA non systématique) | 3 (relation ancienne, clauses contractuelles) | 16/6 = **2,67** | Danger |
| PP2 | Fabricants et distributeurs d'automates (maintenance à distance, middleware) | Prestataire technique et fournisseur | 3 | 3 (connexions de télémaintenance, postes pilotes sous OS parfois obsolètes) | 2 (systèmes souvent non patchables, comptes génériques) | 2 (multiples fournisseurs, peu de visibilité) | 9/4 = **2,25** | Contrôle (proche du danger) |
| PP3 | Hébergeur du serveur de résultats (certifié HDS) | Prestataire d'hébergement | 3 | 3 (héberge et administre la plateforme exposée sur Internet) | 3 (certification HDS, ISO 27001) | 3 | 9/9 = **1,00** | Contrôle |
| PP4 | Établissements et cabinets prescripteurs (flux de prescription électronique, comptes d'accès aux résultats) | Partenaires | 3 | 2 (flux entrants et comptes nominatifs, sans accès admin) | 2 (hétérogène, cabinets libéraux peu outillés) | 3 | 6/6 = **1,00** | Contrôle |

**Mesures sur l'écosystème** :
- PP1 et PP2 : bastion de télémaintenance, MFA, sessions ouvertes à la demande et enregistrées, plan d'assurance sécurité (PAS) contractuel.
- PP3 : suivi de la certification HDS, clauses de réversibilité et de notification des incidents.
- PP4 : authentification forte des prescripteurs (Pro Santé Connect / e-CPS), validation des flux entrants.

### Atelier 3 : 3 scénarios stratégiques

| # | Source de risque / objectif visé | Chemin d'attaque | Événement redouté | Gravité | Vraisemblance |
|---|---|---|---|---|---|
| SS1 | Cybercriminel (gain financier) / rançongiciel | Compromission de l'éditeur du SGL (PP1) ou de son accès de télémaintenance, puis propagation dans le SI du laboratoire et chiffrement du SGL, du middleware et des sauvegardes | Indisponibilité du SGL sur les 12 sites. Arrêt ou forte dégradation des analyses (dont les urgences), retards de résultats critiques, mode dégradé papier | **4** | **3** |
| SS2 | Cybercriminel / exfiltration et chantage (double extorsion), revente de données | Attaque directe du serveur de résultats exposé (vulnérabilité, bourrage d'identifiants sur les comptes patients) ou rebond via l'hébergeur (PP3) | Divulgation massive de résultats nominatifs (sérologies, génétique, grossesse…). Atteinte à la vie privée, notification CNIL et patients, atteinte à l'image | **3** | **3** |
| SS3 | Acteur malveillant (vengeance, initié, activiste) / sabotage | Accès à un poste pilote d'automate ou au middleware via la télémaintenance d'un fabricant (PP2), ou injection de prescriptions falsifiées via un compte prescripteur compromis (PP4) | Altération de résultats ou de valeurs de référence non détectée. Erreurs diagnostiques ou thérapeutiques, perte de confiance, mise en cause de l'accréditation | **4** | **2** |

### Atelier 4 : 2 scénarios opérationnels

**SO1 (déclinaison de SS1) : rançongiciel via la télémaintenance de l'éditeur du SGL**
1. **Connaître** : reconnaissance sur l'éditeur et ses techniciens (réseaux sociaux professionnels, fuites d'identifiants).
2. **Rentrer** : hameçonnage d'un technicien de l'éditeur ou réutilisation d'identifiants volés. Connexion à l'outil de télémaintenance ou au VPN du laboratoire sans MFA.
3. **Trouver** : découverte du réseau (AD, serveurs SGL, NAS de sauvegarde) et collecte d'identifiants (dump LSASS, comptes de service du SGL à hauts privilèges).
4. **Exploiter** : élévation au rang d'administrateur du domaine, mouvements latéraux vers les sites (réseau à plat, absence de cloisonnement inter-sites).
5. **Exploiter** : suppression ou chiffrement des sauvegardes en ligne, désactivation de l'EDR.
6. **Exploiter** : exfiltration préalable (double extorsion), puis déploiement du rançongiciel par GPO.
7. **Effet** : SGL et middleware indisponibles, automates déconnectés, demande de rançon.

Vraisemblance : **V3**. La télémaintenance est un vecteur avéré dans le secteur santé, et la difficulté technique est modérée.

**SO2 (déclinaison de SS2) : exfiltration via le serveur de résultats patients**
1. **Connaître** : identification du portail de résultats (nom de domaine public, version du logiciel affichée).
2. **Rentrer** : au choix, (a) exploitation d'une vulnérabilité connue non corrigée sur le portail ou son composant web, ou (b) bourrage d'identifiants sur les comptes patients si le portail n'impose qu'un identifiant et un mot de passe faible, sans limitation de tentatives.
3. **Trouver** : énumération d'identifiants de comptes rendus (référence directe non contrôlée, de type IDOR) ou accès à la base via un compte applicatif trop privilégié.
4. **Exploiter** : extraction en masse des comptes rendus PDF et des données d'identité (IN


*(suite transmise dans un second message, la première réponse ayant été tronquée à la transmission)*

**Fin de SO2** : non fournie. Sa rédaction a été interrompue par un filtre de sécurité et je ne la reproduis pas, même reformulée. Pour l'analyse :
- **Effet** : divulgation de résultats nominatifs (événement redouté de SS2).
- **Vraisemblance** : **V3**. Le portail est exposé sur Internet et les comptes patients sont nombreux.

**10 mesures de traitement**

| # | Mesure | Type | Priorité | Risque couvert | Référence |
|---|---|---|---|---|---|
| M1 | Bastion de télémaintenance unique pour l'éditeur du SGL et les fabricants d'automates : MFA, comptes nominatifs, sessions ouvertes à la demande et enregistrées | Technique, préventive | P1 | SS1, SS3 / SO1 | Guide d'hygiène informatique ANSSI ; PGSSI-S (à vérifier) |
| M2 | Sauvegardes déconnectées ou immuables du SGL et du middleware, avec test de restauration trimestriel | Technique, corrective | P1 | SS1 / SO1 | ISO/IEC 27001:2022, annexe A 8.13 |
| M3 | Cloisonnement du réseau : zone des automates et du middleware, séparation entre sites, filtrage des flux vers le SGL | Technique, préventive | P1 | SS1, SS3 | ISO/IEC 27001:2022, A 8.22 |
| M4 | Durcissement de l'AD (tiering, LAPS, comptes de service à droits minimaux) et EDR supervisé 24/7 | Technique, préventive et détective | P1 | SS1 / SO1 | Recommandations ANSSI sur la sécurité de l'AD (à vérifier) |
| M5 | Portail de résultats : authentification forte des patients et des prescripteurs (Pro Santé Connect / e-CPS pour les professionnels), limitation des tentatives, contrôle d'accès vérifié côté serveur, test d'intrusion annuel | Technique, préventive | P1 | SS2 / SO2 | Référentiels ANS (à vérifier) ; OWASP ASVS |
| M6 | Gestion des vulnérabilités et correctifs du portail exposé et de son hébergement, avec un délai cible par criticité | Organisationnelle et technique, préventive | P1 | SS2 | ISO/IEC 27001:2022, A 8.8 |
| M7 | Contrôle d'intégrité des résultats : règles de cohérence et delta-check dans le middleware, validation biologique, traçabilité des modifications des paramètres des automates | Organisationnelle et technique, détective | P1 | SS3 | NF EN ISO 15189:2022 (accréditation COFRAC) |
| M8 | Clauses contractuelles de sécurité avec l'éditeur, les fabricants et l'hébergeur : PAS, notification des incidents, droit d'audit, réversibilité ; suivi de la certification HDS de l'hébergeur | Organisationnelle / contractuelle, préventive | P2 | SS1, SS2, SS3 (PP1 à PP3) | Art. L.1111-8 du Code de la santé publique (HDS) ; RGPD art. 28 |
| M9 | Plan de continuité d'activité : mode dégradé papier, priorisation des urgences, sous-traitance d'analyses entre sites ou vers un laboratoire partenaire, exercice de crise cyber annuel | Organisationnelle, corrective | P2 | SS1 | ISO 22301:2019 ; NIS2, art. 21 (à vérifier selon la transposition française) |
| M10 | Journalisation centralisée (SIEM) et procédure de gestion des incidents : signalement des incidents graves au CERT Santé / ARS et notification à la CNIL sous 72 h | Organisationnelle et technique, détective et corrective | P2 | SS1, SS2, SS3 | Art. L.1111-8-2 du Code de la santé publique (à vérifier) ; RGPD art. 33 et 34 |
