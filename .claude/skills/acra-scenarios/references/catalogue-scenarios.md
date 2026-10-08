# Catalogue des scénarios ACRA

Trois axes à combiner (profil × organisation × cas d'usage). Les combinaisons doivent
être **plausibles** : un DPO ne pilote pas un audit interne, une TPE n'a pas de 3ᵉ ligne.

## Axe 1 — Profils (rôles ACRA réels, cf. `enum UserRole`)

| Famille | Rôle ACRA | Persona type | Niveau cyber |
|---|---|---|---|
| Néophyte | ANALYSTE | Chef de projet métier qui doit « faire l'analyse de risques » de son projet | faible |
| Néophyte | METIER (1ʳᵉ ligne) | Responsable d'agence / de service qui déclare un incident | nul |
| Néophyte | DIRECTION_METIER | Directeur métier qui doit accepter un risque résiduel | faible |
| Spécialiste cyber | RSSI | RSSI (ou RSSI à temps partagé) qui pilote et approuve | élevé |
| Spécialiste risque | RISK_MANAGER | Risk manager / gestion des risques opérationnels | moyen |
| 2ᵉ ligne | CONTROLEUR | Contrôleur permanent | moyen |
| 2ᵉ ligne | CONFORMITE | Responsable conformité (ISO 27001, NIS2, DORA) | moyen |
| 2ᵉ ligne | DPO | Délégué à la protection des données | moyen (juridique) |
| 3ᵉ ligne | AUDITEUR | Auditeur interne | moyen |
| Consultation | LECTEUR | Membre du comité, prestataire en lecture | variable |
| Administration | ADMIN | Administrateur de l'organisation (souvent le RSSI lui-même en PME) | variable |
| Instance | SUPER_ADMIN | Consultant / cabinet gérant plusieurs clients ; DSI de groupe | élevé |

## Axe 2 — Organisations (créées en bac à sable, préfixe `Bac à sable —`)

| Famille | Profil d'organisation | Secteur / sous-secteur ACRA | Taille | Spécificités à exercer |
|---|---|---|---|---|
| Petite structure | TPE cabinet d'avocats | Professions juridiques | 8 p. | aucun spécialiste, budget nul, secret professionnel |
| Petite structure | Association / ESS | Associations / ESS | 20 p. + bénévoles | RGPD adhérents, outils gratuits |
| Petite structure | Officine / cabinet médical | Santé (sante-pharma, sante-cabinet) | 5–15 p. | données de santé, HDS |
| PME | Clinique privée | Santé (sante-clinique) | 80 p. | continuité des soins, rançongiciel |
| PME | E-commerce | E-commerce / Marketplace | 40 p. | PCI-DSS, fraude, prestataires SaaS |
| PME | Industriel sous-traitant | Industrie / Manufacturing | 250 p. | OT/IT, exigences donneurs d'ordre |
| ETI régulée | Banque régionale | Banque / Finance | 1 500 p. | DORA, contrôle permanent, 3 lignes, régulateur |
| ETI régulée | Assureur / mutuelle | Banque / Finance (assurance) ou Protection sociale | 800 p. | DORA, Solvabilité II, tiers critiques |
| ETI régulée | Société de gestion d'actifs | Banque / Finance | 120 p. | DORA, tiers TIC, petite équipe |
| Secteur public | Collectivité territoriale | Administration publique | 600 agents | NIS2 entité importante, élus, marchés publics |
| Secteur public | CHU | Santé (sante-hopital) | 8 000 p. | homologation, ANSSI, systèmes biomédicaux |
| Infrastructure | Régie d'eau | Eau / Assainissement | 150 p. | NIS2 essentielle, OT |
| Multi-org | Groupe avec filiales (dont 1 à l'étranger) | variable | groupe | héritage de config, consolidation, langue en/de/es/it |
| Multi-org | Cabinet de conseil multi-clients | Informatique / Numérique | 10 consultants | SUPER_ADMIN, isolation entre clients |

## Axe 3 — Cas d'usage (tâches concrètes à accomplir)

| Famille | Cas d'usage | Profils pertinents | Critère de réussite observable |
|---|---|---|---|
| Démarrage | Premier contact : comprendre quoi faire en < 5 min après la 1ʳᵉ connexion | tous néophytes, ADMIN | l'utilisateur identifie sa première action sans aide |
| Démarrage | Configurer l'organisation (secteur, modules utiles, échelles par défaut) | ADMIN | config cohérente avec la taille, modules inutiles désactivés |
| Analyse | Réaliser une analyse EBIOS RM complète (ateliers 1→5) d'un projet | ANALYSTE, RSSI | analyse soumise, livrable PDF lisible |
| Analyse | Analyse rapide avec une autre méthode (ISO 27005 / ISO 31000 / NIST) | ANALYSTE, RISK_MANAGER | analyse terminée avec la méthode choisie |
| Analyse | Importer une analyse existante (Excel/JSON) | RSSI, ANALYSTE | données reprises sans ressaisie |
| Décision | Approuver ou refuser une analyse soumise | RSSI, RISK_MANAGER | circuit d'approbation clair, trace d'audit |
| Décision | Accepter un risque résiduel | DIRECTION_METIER | acceptation enregistrée, analyse gelée si configuré |
| Décision | Préparer le comité des risques (pack comité, cartographie) | RSSI, RISK_MANAGER | livrable compréhensible en < 10 s par un dirigeant |
| Traitement | Construire et suivre un plan d'action (toutes origines) | RSSI, METIER, CONFORMITE | actions assignées, échéances, avancement visible |
| Traitement | Demander et instruire une dérogation | METIER, RSSI | dérogation tracée, échéance de revue |
| Conformité | Établir la SoA ISO/IEC 27001:2022 | CONFORMITE, RSSI | SoA exportable, justifications d'exclusion |
| Conformité | Évaluer sa situation NIS2 / DORA | CONFORMITE | écarts identifiés et reliés à des actions |
| Conformité | Tenir le registre RGPD (traitements, AIPD) | DPO | registre exploitable pour un contrôle CNIL |
| Opérations | Déclarer et qualifier un incident (dont incident majeur DORA) | METIER, RSSI | délais réglementaires visibles, notification préparée |
| Opérations | Gérer un tiers / prestataire critique (registre TIC) | CONFORMITE, RISK_MANAGER | tiers évalué, registre TIC exportable |
| 2ᵉ ligne | Définir et exécuter un contrôle permanent, constater une anomalie | CONTROLEUR | exécution tracée, anomalie → action |
| 2ᵉ ligne | Suivre les KRI et l'appétence au risque | RISK_MANAGER | dépassement visible et expliqué |
| 2ᵉ ligne | Lancer une campagne RCSA auprès des métiers | RISK_MANAGER, METIER | réponses collectées sans formation |
| 3ᵉ ligne | Mener une mission d'audit interne (constats, recommandations) | AUDITEUR | rapport de mission, recommandations suivies |
| 3ᵉ ligne | Planifier le programme pluriannuel d'audit | AUDITEUR | plan annuel validé |
| Pilotage | Lire le tableau de bord / cockpit de pilotage | DIRECTION_METIER, LECTEUR | message clé compris en < 10 s |
| Multi-org | Consolider plusieurs filiales / basculer entre clients | SUPER_ADMIN, ADMIN | aucune fuite entre organisations, bascule fluide |
| Robustesse | Utilisateur en lecture qui tente d'agir | LECTEUR, AUDITEUR | aucun bouton d'écriture interdit visible ; 403 propres |
| Robustesse | Reprendre une analyse laissée en cours il y a 3 mois | ANALYSTE | l'utilisateur retrouve où il en était |

## Scénarios pré-composés (amorce — à varier ensuite)

| # | Profil | Organisation | Cas d'usage |
|---|---|---|---|
| S01 | ADMIN (seul « informaticien ») | TPE cabinet d'avocats | Premier contact + configurer l'org au plus simple |
| S02 | ANALYSTE | Clinique privée | Analyse EBIOS RM du nouveau dossier patient informatisé |
| S03 | METIER | Banque régionale | Déclarer un incident de fraude au virement (BEC) |
| S04 | CONTROLEUR | Assureur / mutuelle | Exécuter un contrôle permanent et constater une anomalie |
| S05 | DPO | Association / ESS | Registre RGPD des adhérents et bénévoles |
| S06 | DIRECTION_METIER | Collectivité territoriale | Accepter un risque résiduel sur la messagerie des élus |
| S07 | CONFORMITE | Société de gestion d'actifs | Évaluation DORA + registre des tiers TIC |
| S08 | AUDITEUR | Banque régionale | Mission d'audit sur la gestion des accès |
| S09 | SUPER_ADMIN | Cabinet de conseil multi-clients | Créer 2 clients, vérifier l'isolation, basculer |
| S10 | RSSI | CHU | Préparer le comité (pack comité + cartographie) |
| S11 | RISK_MANAGER | Groupe avec filiale allemande | KRI + appétence, écran consulté en allemand |
| S12 | LECTEUR | E-commerce | Consulter la SoA et le plan d'action sans pouvoir modifier |
| S13 | ANALYSTE | Industriel sous-traitant | Analyse ISO 27005 rapide d'une ligne de production connectée |
| S14 | RSSI | Régie d'eau | Évaluation NIS2 (entité essentielle) + plan d'action |
