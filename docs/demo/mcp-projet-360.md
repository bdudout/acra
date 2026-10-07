# Démo MCP — un projet 360 piloté par trois assistants (Claude, Codex, Mistral Vibe)

> **Message** : trois assistants différents, une même expression de besoins, un même garde-fou. ACRA fournit le
> référentiel, l'échelle et les calculs ; l'assistant propose ; un humain valide chaque proposition, avec sa trace.
> « La valeur est dans le référentiel, pas dans le modèle. »

Données **entièrement fictives** (organisation, personnes, chiffres) : les outils renvoient leurs réponses à un modèle
hébergé par l'éditeur de l'assistant (Anthropic, OpenAI, Mistral AI).

---

## 1. Expression de besoins (document remis tel quel aux trois assistants)

**Mutuelle Horizon Santé — Projet « Espace adhérent 2027 »**
*Expression de besoins v1.0 — Direction de la relation adhérents — document fictif de démonstration*

### 1.1 Contexte
Mutuelle santé de 180 000 adhérents (particuliers et contrats collectifs d'entreprise), 420 salariés, régie par le
Code de la mutualité et soumise à Solvabilité II. L'espace adhérent actuel (2014) ne permet ni la souscription en
ligne ni le dépôt de justificatifs ; 62 % des appels au centre de relation concernent le suivi des remboursements.

### 1.2 Objectifs
1. Souscription et avenant 100 % en ligne, avec **signature électronique** (prestataire de services de confiance).
2. **Dépôt de justificatifs** (factures d'optique, devis dentaires, ordonnances) depuis le web ou le mobile, avec
   lecture automatique des documents (extraction des montants).
3. **Assistant conversationnel** (IA générative) qui répond aux questions de remboursement et de garanties, et
   passe la main à un conseiller sur demande.
4. Paiement des cotisations par prélèvement SEPA et carte bancaire, via un prestataire de paiement.
5. Réduire de 30 % les appels « où en est mon remboursement ? » dans les 12 mois suivant la mise en service.

### 1.3 Périmètre
- **Inclus** : portail web et application mobile (iOS, Android) ; parcours souscription, avenant, dépôt de
  justificatif, suivi des remboursements, attestation de tiers payant, messagerie sécurisée ; assistant IA ;
  passerelle d'API vers le système de gestion des contrats et des prestations (hébergé en interne) ; reprise des
  comptes existants.
- **Exclu** : refonte du système de gestion des prestations ; espace des professionnels de santé ; parcours
  courtiers (lot 2).

### 1.4 Données traitées
Identité et coordonnées, numéro de sécurité sociale, coordonnées bancaires (IBAN), **données de santé**
(justificatifs, actes remboursés, garanties choisies), échanges avec l'assistant et les conseillers. Volume :
environ 1,2 million de justificatifs par an.

### 1.5 Architecture envisagée
- Portail et API **exposés sur Internet**, derrière un pare-feu applicatif ; **applications mobiles**.
- Hébergement du portail chez un **hébergeur certifié HDS** (cloud IaaS / PaaS) ; données de santé chiffrées.
- **Services SaaS** : signature électronique, CRM, envoi de SMS et de courriels.
- **Service d'IA** : modèle de langage hébergé dans l'Union européenne, accédé par API ; aucune donnée de santé
  ne doit servir à l'entraînement.
- **Interconnexions** : passerelle d'API vers le SI de gestion interne ; flux de tiers payant avec un opérateur
  externe ; prestataire de paiement.
- Authentification forte des adhérents ; administration par bastion ; supervision par le SOC interne.

### 1.6 Calendrier et équipe
Lancement : novembre 2026 · recette : décembre 2026 à février 2027 · **mise en service : 1er mars 2027**.
Chef de projet : Claire Martin (fictive) · intégrateur web externe · éditeur de l'assistant IA · équipe interne
de 6 personnes. Budget : 1,4 M€.

### 1.7 Contraintes et exigences
- RGPD (règlement (UE) 2016/679) : données de santé (art. 9), **analyse d'impact (AIPD)** attendue ; information
  des personnes ; durées de conservation.
- Hébergement de données de santé : **certification HDS** du prestataire (référentiel en vigueur, à vérifier).
- **DORA** (règlement (UE) 2022/2554) : la mutuelle est une entité financière ; les prestataires TIC (hébergeur,
  signature, IA, paiement) entrent au **registre d'informations** ; incidents majeurs à déclarer.
- **Règlement (UE) 2024/1689** sur l'intelligence artificielle : l'assistant conversationnel relève a priori des
  **obligations de transparence (art. 50)** — à vérifier.
- Disponibilité visée : 99,5 % ; perte de données maximale : 1 heure ; reprise en moins de 4 heures.

### 1.8 Points ouverts
Choix de l'éditeur de l'assistant IA ; réversibilité des données en fin de contrat ; conservation des échanges avec
l'assistant ; conduite du changement auprès des conseillers.

---

## 2. Ce qu'ACRA doit en tirer (référence pour juger les trois assistants)

| Élément | Attendu |
|---|---|
| Méthode | Projet 360 (ISO 31000:2018) |
| Secteur / sous-secteurs | Santé / Médico-social — `sante-amc` (complémentaire santé), `sante-portail` (portail d'accès aux données de santé) ; le catalogue y ajoute l'assurance |
| Patterns d'architecture | `EXPOSITION_INTERNET`, `APPLICATIONS_MOBILES`, `CLOUD_IAAS_PAAS`, `CLOUD_SAAS`, `IA_SERVICES`, `API_PARTENAIRES`, `INTERCO_TIERS`, `SI_SENSIBLE`, `SI_ADMINISTRATION` |
| Mise en service | 2027-03-01 |
| Risques attendus (au moins) | fuite de données de santé ; compromission de comptes adhérents ; fraude au justificatif (faux documents) ; indisponibilité du portail ou de l'hébergeur ; défaillance d'un prestataire (signature, IA, paiement) ; réponse erronée de l'assistant IA ; non-conformité RGPD (AIPD, conservation) ; dérive du planning et du budget ; adhésion des conseillers |
| Domaines 360 couverts | cyber, IT, projet, métier, fraude, externalisation |
| Plans d'action | rattachés aux risques, porteur et échéance avant la mise en service |
| Validation | chaque proposition acceptée ou refusée par un humain dans « Propositions MCP » |

## 3. Scénario de la démo (60 à 90 secondes à l'écran)

1. **Même consigne aux trois assistants** : « Voici l'expression de besoins du projet Espace adhérent 2027.
   Prépare dans ACRA le suivi de risques 360 complet : contexte, risques par domaine, mesures et plans d'action. »
2. L'assistant **lit** (exemples du secteur et des patterns, catalogue), **demande les recommandations** calculées
   par ACRA, puis **propose** le projet, les risques et les plans.
3. **Écran partagé** : les propositions arrivent dans ACRA ; un humain accepte ou refuse, et chaque décision est
   tracée.
4. **Résultat** : page du projet (météo, matrice brut / actuel / résiduel, plans R1, R2…), export PowerPoint.
5. **Chiffres à capturer** : durée jusqu'au registre complet ; nombre de propositions ; taux d'acceptation ;
   doublons évités ; couverture des risques attendus (§ 2).

## 4. Connexion des clients

Clé d'API de l'organisation avec le **seul** droit `mcp` (page *Activité MCP*, administrateur), expiration courte ; module MCP
activé pour l'instance et pour l'organisation. Guide complet : [`../mcp-clients.md`](../mcp-clients.md). Variable d'environnement : `ACRA_MCP_KEY`.

- **Claude Code** : `claude mcp add --transport http acra http://localhost:3005/api/mcp --header "Authorization: Bearer $ACRA_MCP_KEY"`
- **Codex (CLI 0.160, livré avec l'application ChatGPT)** : `codex mcp add acra --url http://localhost:3005/api/mcp --bearer-token-env-var ACRA_MCP_KEY`,
  ou ponctuellement `-c 'mcp_servers.acra.url="…"' -c 'mcp_servers.acra.bearer_token_env_var="ACRA_MCP_KEY"'` — **vérifié** :
  Codex liste les outils et appelle `read_sector_examples`.
- **Mistral Vibe (CLI)** : serveur MCP en transport HTTP déclaré dans la configuration de Vibe, avec l'en-tête
  `Authorization: Bearer …` (syntaxe à confirmer à l'installation). Le modèle tourne chez Mistral AI : rien à
  charger en mémoire sur le poste, contrairement à un modèle local.
- Les interfaces web (claude.ai, Le Chat) exigent une adresse HTTPS publique et, en pratique, OAuth : hors du
  périmètre de cette démo (voir § 5, lot M6).

## 5. État du serveur MCP et changements

### Corrigé (2026-10-06)
- `/api/mcp` était redirigé vers la page de connexion par le middleware de session : **aucun client ne pouvait se
  connecter**. Route exemptée (la clé d'API et le droit `mcp` sont vérifiés dans le handler).
- Consignes de serveur à l'initialisation (démarche lire → recommander → proposer, cotations reprises d'ACRA,
  validation humaine) : identiques pour tous les clients.
- Titres et **annotations** d'outils : lectures et recommandations en lecture seule (approbation automatique
  possible), propositions non destructives.
- En-tête `WWW-Authenticate` sur les refus 401.

### Lots de la démo (M1 à M5 livrés le 2026-10-07)
| Lot | Changement | Pourquoi |
|---|---|---|
| M1 | `read_analyses` : analyses et projets de l'organisation (id, nom, méthode, secteur, statut) | aujourd'hui un assistant ne peut pas trouver l'identifiant d'un projet |
| M2 | `read_projet` : contexte d'un projet 360 (secteur, sous-secteurs, patterns, mise en service), risques existants avec leur référence R1, R2…, plans | éviter les doublons, rattacher les plans |
| M3 | `propose_projet360` : proposition de création d'un projet (nom, objectifs, périmètre, secteur, sous-secteurs, patterns, mise en service), validée par un humain | point de départ de la démo |
| M4 | `propose_risk` enrichi : domaine 360, cotations brut / actuel / résiduel complètes, échelle de l'organisation (4 ou 5 niveaux) au lieu de 1 à 4 figé ; acceptation par le même garde que la saisie directe (analyse gelée, cohérence des cotations) | qualité et cohérence avec la page projet |
| M5 | `recommend_risks_scenarios` pour un projet : catalogue complet des risques types (registre, sous-secteurs, architecture, secteur, communs) | recommandations aussi riches que l'import en phase d'identification |
| M7 | `propose_nouvelle_analyse` : nouvelle analyse rédigée d'après une expression de besoins ou reprise d'une analyse existante (paquet de l'import historique, secteur, sous-secteurs, contenu des ateliers EBIOS RM) ; acceptée par un rôle qui crée des analyses | démarrer une analyse complète depuis un assistant |
| M8 | `propose_pssi` : PSSI importée en référentiel de mesures de type PSSI, document Markdown de la bibliothèque et suivi de conformité ; acceptée par un administrateur | réutiliser la politique existante comme référentiel |
| M9 | Page *Activité MCP* : clés, appels, erreurs, outils, propositions par clé, création d'une clé `mcp` et révocation ; guide [`mcp-clients.md`](../mcp-clients.md) | suivre et couper les assistants connectés |
| M6 (plus tard) | OAuth 2.1 pour les interfaces web (claude.ai, Le Chat) ; transport en flux si un client l'exige | ouvrir aux interfaces grand public |

## 6. Points de vigilance
- Données fictives uniquement : les réponses des outils partent chez l'éditeur de l'assistant.
- Débit limité à 120 appels par minute et par clé : suffisant pour une démo, à surveiller pour trois clients en
  parallèle sur la même clé (prévoir une clé par client).
- Chaque appel d'outil est journalisé (`MCP_TOOL_INVOKED`) : la trace fait partie de la démonstration.

## 7. Démo réalisée (2026-10-07, instance locale)

L'assistant est **Claude** (session Claude Code) appelant le serveur MCP d'ACRA par le protocole (client
`docs/demo/scripts/mcp.sh`) ; l'humain qui valide est piloté par Playwright (`docs/demo/scripts/capture.cjs`).
Codex a été vérifié en lecture (§ 4) ; son quota d'usage était épuisé pour le parcours complet ; Mistral Vibe n'est pas
installé sur le poste.

| # | Étape | Outil / action | Capture |
|---|---|---|---|
| 1 | L'assistant lit les sous-secteurs et patterns disponibles, puis propose le projet (3 sous-secteurs, 11 patterns, mise en service 2027-03-01) | `read_sector_examples`, `propose_projet360` | `captures/01-proposition-projet.png` |
| 2 | L'humain accepte : le projet est créé comme depuis le formulaire, avec ses 13 risques et 8 plans par défaut | Accepter | `captures/02-projet-accepte.png`, `captures/03-projet-cree.png` |
| 3 | L'assistant retrouve le projet, lit son contexte et les recommandations (80 risques types : 21 sous-secteurs, 31 architecture, 23 secteur, 5 registre) | `read_analyses`, `read_projet`, `recommend_risks_scenarios` | — |
| 4 | Il propose les 8 risques manquants, avec domaine, cotations brut / actuel / résiduel, 9 mesures et 10 plans datés avant la mise en service | `propose_risk` ×8 | `captures/04-propositions-risques.png` |
| 5 | L'humain accepte les 8 propositions : 21 risques, plans rattachés R1, R2… | Accepter ×8 | `captures/05-file-vide.png` |
| 6 | Page du projet : météo, matrice (R1 « Fuite des données de santé » en tête), plans par priorité | — | `captures/06-page-projet.png`, `captures/07-matrice-des-risques.png`, `captures/08-plans-par-priorite.png`, `captures/09-page-projet-complete.png` |
| 7 | Export PowerPoint de la revue de projet (8 diapositives) | Exporter | `captures/revue-projet-espace-adherent-2027.pptx`, `captures/10-pptx-*.png` |
| 8 | L'assistant propose un risque **hors périmètre** (refonte du système de gestion) : l'humain le rejette, la trace reste (statut REJETEE) | `propose_risk`, Rejeter | `captures/11-proposition-hors-perimetre.png`, `captures/12-proposition-rejetee.png` |

**Contrôles de sécurité rejoués** sur l'instance : analyse d'une autre organisation introuvable (proposition et
lecture) ; projet sans pattern refusé ; `organizationId` injecté ignoré (l'outil reste sur l'organisation de la clé) ;
plan d'action ancré sur l'organisation entière refusé ; aucune proposition déposée par ces tentatives.

**Constats** : quelques risques types d'architecture sont classés au domaine « Fraude » alors qu'ils relèvent du cyber
(ex. « Un serveur de la DMZ compromis sert de rebond ») — classement à revoir dans le catalogue (catégorie bâloise →
domaine 360). En mode développement, l'acceptation d'un projet prend une dizaine de secondes (compilation et peuplement).

**Rejouer** : `.acra-test-memory/mcp-demo.json` (clé `mcp`), puis `docs/demo/scripts/mcp.sh <outil> '<json>'` et
`ACRA_EMAIL=… ACRA_PASSWORD=… node docs/demo/scripts/capture.cjs projet|risques|projet-page|export|rejet`.

### Nouvelle analyse et PSSI (2026-10-07)

| # | Étape | Outil / action | Capture |
|---|---|---|---|
| 9 | L'assistant propose la reprise d'une analyse de 2024 (ISO/IEC 27005:2022, 2 risques, 1 mesure, 1 plan lié) et l'import de la PSSI du groupe (6 exigences) | `propose_nouvelle_analyse`, `propose_pssi` | `captures/13-propositions-analyse-pssi.png` |
| 10 | Le RSSI tente d'accepter : refus (la création d'analyse revient à l'analyste ou à l'administrateur, la PSSI à l'administrateur), motif affiché sur la carte | Accepter | — |
| 11 | L'analyste accepte l'analyse : créée avec son secteur, sa méthode, ses risques positionnés R1 et R2 dans la matrice et sa mesure | Accepter | `captures/17-analyse-reprise.png` |
| 12 | Une 2ᵉ proposition PSSI de même version : refusée à l'acceptation (`code_existant`, 409) après la première ; à rejeter | Rejeter | — |

Acceptation de la PSSI par un administrateur : à rejouer par l'administrateur de l'instance de démonstration
(aucun compte administrateur de recette).

