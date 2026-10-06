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

Clé d'API de l'organisation avec le **seul** droit `mcp` (Configuration › Clés d'API), expiration courte ; module MCP
activé pour l'instance et pour l'organisation. Variable d'environnement : `ACRA_MCP_KEY`.

- **Claude Code** : `claude mcp add --transport http acra http://localhost:3005/api/mcp --header "Authorization: Bearer $ACRA_MCP_KEY"`
- **Codex (CLI)** : dans `~/.codex/config.toml`, une entrée `[mcp_servers.acra]` avec `url = "http://localhost:3005/api/mcp"`
  et `bearer_token_env_var = "ACRA_MCP_KEY"` (syntaxe à confirmer sur la version installée).
- **Mistral Vibe (CLI)** : serveur MCP en transport HTTP déclaré dans la configuration de Vibe, avec l'en-tête
  `Authorization: Bearer …` (syntaxe à confirmer à l'installation). Le modèle tourne chez Mistral AI : rien à
  charger en mémoire sur le poste, contrairement à un modèle local.
- Les interfaces web (claude.ai, Le Chat) exigent une adresse HTTPS publique et, en pratique, OAuth : hors du
  périmètre de cette démo (voir § 5, lot M5).

## 5. État du serveur MCP et changements

### Corrigé (2026-10-06)
- `/api/mcp` était redirigé vers la page de connexion par le middleware de session : **aucun client ne pouvait se
  connecter**. Route exemptée (la clé d'API et le droit `mcp` sont vérifiés dans le handler).
- Consignes de serveur à l'initialisation (démarche lire → recommander → proposer, cotations reprises d'ACRA,
  validation humaine) : identiques pour tous les clients.
- Titres et **annotations** d'outils : lectures et recommandations en lecture seule (approbation automatique
  possible), propositions non destructives.
- En-tête `WWW-Authenticate` sur les refus 401.

### À faire pour la démo (lots proposés)
| Lot | Changement | Pourquoi |
|---|---|---|
| M1 | `read_analyses` : analyses et projets de l'organisation (id, nom, méthode, secteur, statut) | aujourd'hui un assistant ne peut pas trouver l'identifiant d'un projet |
| M2 | `read_projet` : contexte d'un projet 360 (secteur, sous-secteurs, patterns, mise en service), risques existants avec leur référence R1, R2…, plans | éviter les doublons, rattacher les plans |
| M3 | `propose_projet360` : proposition de création d'un projet (nom, objectifs, périmètre, secteur, sous-secteurs, patterns, mise en service), validée par un humain | point de départ de la démo |
| M4 | `propose_risk` enrichi : domaine 360, cotations brut / actuel / résiduel complètes, échelle de l'organisation (4 ou 5 niveaux) au lieu de 1 à 4 figé ; acceptation par le même garde que la saisie directe (analyse gelée, cohérence des cotations) | qualité et cohérence avec la page projet |
| M5 | `recommend_risks_scenarios` pour un projet : catalogue complet des risques types (registre, sous-secteurs, architecture, secteur, communs) | recommandations aussi riches que l'import en phase d'identification |
| M6 (plus tard) | OAuth 2.1 pour les interfaces web (claude.ai, Le Chat) ; transport en flux si un client l'exige | ouvrir aux interfaces grand public |

## 6. Points de vigilance
- Données fictives uniquement : les réponses des outils partent chez l'éditeur de l'assistant.
- Débit limité à 120 appels par minute et par clé : suffisant pour une démo, à surveiller pour trois clients en
  parallèle sur la même clé (prévoir une clé par client).
- Chaque appel d'outil est journalisé (`MCP_TOOL_INVOKED`) : la trace fait partie de la démonstration.
