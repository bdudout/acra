---
name: acra-scenarios
description: Test quotidien d'ACRA par scénarios d'usage réels — tire chaque jour une combinaison profil × organisation × cas d'usage, la fait jouer sur l'app locale par une lentille tournante (/acra-qa, /acra-ux, /acra-test), gère l'environnement (Docker limité à la base, 2 Go, arrêt propre en fin de run) et alimente une liste d'améliorations classée par priorité et intérêt, avec un filtre « ne pas alourdir ». Ajuste le volume de tests au budget de tokens hebdomadaire restant. À utiliser pour « test quotidien ACRA », « jouer des scénarios ACRA », « tester ACRA comme un utilisateur », ou depuis la tâche planifiée de 7 h.
---

# ACRA — Scénarios d'usage quotidiens

Tu joues ACRA **comme un vrai utilisateur** : un profil donné, dans une organisation
donnée, qui veut accomplir une tâche donnée. Tu observes ce qui marche, ce qui bloque,
ce qui est superflu — et tu en tires des améliorations **qui gardent l'application
souple et facile à utiliser**.

Cette skill est le **chef d'orchestre** du run : budget, tirage des scénarios, environnement,
journal et liste d'améliorations. Le **contenu du test** est confié chaque jour à une
**lentille** différente (étape 2 bis) : 🧪 `/acra-qa`, 🎨 `/acra-ux` ou `/acra-test`.

Ce n'est PAS une campagne de développement : tu **ne modifies pas le code**, tu ne
commites rien, tu ne pousses rien. (Le développement passe par la skill `acra-engineering`.)

## Principes immuables

1. **Ne pas alourdir.** La meilleure amélioration supprime un clic, un champ, un écran
   ou une notion. Une proposition qui ajoute un module, un réglage ou un écran doit
   prouver qu'elle remplace quelque chose ou qu'elle débloque un usage réel observé.
   Tout ce qui peut être un **défaut intelligent** plutôt qu'une option est un défaut.
2. **Constat réel avant proposition.** Chaque proposition cite le scénario joué et ce
   qui a été observé (écran, message, temps, nombre de clics, code HTTP). Pas de
   proposition « de principe ».
3. **Faire avancer > ajouter.** Si le constat rejoint une proposition existante,
   on renforce celle-ci (occurrence +1, nouvel exemple) au lieu d'en créer une autre.
4. **Pas d'IA externe** : ne jamais proposer d'envoyer des données d'analyse à une API
   d'IA/LLM externe (décision de conception d'ACRA). Le serveur MCP local existant
   (OFF par défaut) n'est pas concerné.
5. **Données de test uniquement**, sur l'instance **locale** (localhost). Jamais sur
   acra-cyber.com ni sur une instance distante.

## Fichiers

| Rôle | Chemin (depuis `ebios-rm/`) | Suivi git |
|---|---|---|
| Catalogue des axes et scénarios | `.claude/skills/acra-scenarios/references/catalogue-scenarios.md` | oui |
| Journal + couverture des scénarios joués | `.acra-test-memory/scenarios-joues.md` | non (gitignoré) |
| **Liste des améliorations proposées** (classée) | `.acra-test-memory/ameliorations-proposees.md` | non (gitignoré) |
| Comptes de test par rôle | `.acra-test-memory/recette-roles.json` (et `recette-claude.json`) | non |
| Boîte aux lettres de 🛠️ ACRA Dev (transmission des pistes) | `.acra-messages/acra-dev.md` | non (gitignoré) |
| Ancien backlog volumineux (lecture seule, référence) | `.acra-test-memory/improvements-priority.md` | non |

Ne jamais recopier les mots de passe des comptes de test dans un rapport ou dans le chat.

## Étape 0 — Budget : combien de scénarios aujourd'hui ?

Appelle `mcp__ccd_session_mgmt__get_usage` (via ToolSearch si différé) et lis les
fenêtres « 5-hour limit » et « Weekly · all models ».

| Situation | Nombre de scénarios |
|---|---|
| Fenêtre 5 h > 70 % utilisée, ou hebdo > 85 % | **1** scénario court, puis rapport |
| Cas normal | **2** scénarios |
| **Relance fin de semaine** : hebdo ≤ 60 % utilisé ET renouvellement dans ≤ 48 h | **4** scénarios, puis +2 par palier tant que hebdo < 80 % et fenêtre 5 h < 75 % (max 10) |
| Outil indisponible | 2 scénarios (cas normal) |

Re-vérifie l'usage **entre chaque scénario** en mode relance et arrête-toi proprement
dès qu'un seuil est franchi. Note dans le journal le mode retenu et les pourcentages lus.

## Étape 1 — Lire la mémoire

1. `scenarios-joues.md` : matrice de couverture + 5 dernières entrées du journal.
2. `ameliorations-proposees.md` : propositions ouvertes (pour renforcer plutôt que dupliquer)
   et celles marquées « à revérifier ».
3. Si `ameliorations-proposees.md` n'existe pas : le créer depuis le modèle de l'étape 5,
   en y reprenant au plus **10** items ouverts 🔴/🟠 de `improvements-priority.md`
   (statut « hérité — à revérifier »).
4. `git log --oneline -15` : repérer les fonctionnalités récentes — elles sont
   prioritaires pour au moins un scénario (fumée sur du neuf).

## Étape 2 — Tirer les scénarios

Utilise `references/catalogue-scenarios.md`. Pour chaque scénario, combine
**1 profil × 1 organisation × 1 cas d'usage** compatibles, en suivant ces règles :

- **Varier** : ne pas rejouer une combinaison jouée dans les 14 derniers jours ;
  privilégier les cases vides ou anciennes de la matrice de couverture.
- **Alterner** les natures : un jour sur deux au moins un scénario « petite structure /
  non-spécialiste » (le cœur de cible d'ACRA : rester simple pour un néophyte).
- **Neuf d'abord** : si un commit récent touche un module, au moins un scénario l'exerce.
- **1 scénario sur 4 « revérification »** : rejouer le scénario d'origine d'une
  proposition marquée corrigée ou « à revérifier » pour confirmer ou fermer.
- En mode relance, couvrir des familles différentes (pas 4 scénarios Banque).

Écrire pour chaque scénario une **intention utilisateur en une phrase**
(« En tant que DPO d'une clinique de 80 personnes, je veux préparer le registre RGPD
avant le contrôle CNIL ») et un **critère de réussite observable**.

## Étape 2 bis — Lentille du jour (rotation)

Lire la ligne `lentille :` de la dernière entrée du journal et prendre la suivante :
**qa → ux → test → qa…** (journal vide : `qa`).

| Lentille | Skill invoquée (outil Skill) | Ce qu'elle apporte | Consigne à lui passer en `args` |
|---|---|---|---|
| **qa** | `acra-qa` | non-régression sur les commits récents, droits, isolation entre organisations, cas limites | « mode A sur les commits des 7 derniers jours qui touchent l'UI ou les droits, puis les scénarios tirés ; ne PAS invoquer `acra-scenarios` (déjà en cours) » |
| **ux** | `acra-ux` | facilité d'utilisation : clics, champs, jargon, accessibilité, simplifications | « parcours = les scénarios tirés ; écrire les propositions directement dans `ameliorations-proposees.md` ; pas de message à 🛠️ ni de rapport .docx » |
| **test** | `acra-test` | mission suivante de sa rotation M1–M5 (backlog, vérification exécutée, sécurité, profil × secteur, reporting décideur) | « mission suivante de ta rotation ; si M4 ou M5, utiliser le profil et l'organisation tirés ; reporter aussi les constats dans `ameliorations-proposees.md` » |

Règles communes passées à chaque lentille (à recopier dans `args`) : environnement **déjà
prêt** (URL, comptes) — ne pas relancer ni arrêter Docker ou le serveur ; ne modifier aucun
code, ne rien commiter ; principes immuables ci-dessus ; garde de durée (heure de début du
run) ; en mode réduit, un seul parcours ; **ne pas écrire soi-même à 🛠️ `acra-dev`** (c'est
l'étape 5 bis qui transmet, une seule fois, pour éviter les doublons).

- Mode **relance** : alterner les lentilles **par scénario** (scénario 1 = lentille du jour,
  scénario 2 = la suivante, etc.).
- Les sous-agents lancés par `acra-qa` / `acra-ux` (🔬 `acra-verificateur`…) jouent les
  parcours **en série** sur la même instance (jamais deux navigateurs en parallèle).
- Si la skill de la lentille est introuvable ou échoue au démarrage : jouer les scénarios
  soi-même (étape 4) et le noter dans le journal.
- Noter dans l'entrée du journal : `lentille : qa|ux|test` (+ mission M1–M5 pour `test`).

## Étape 3 — Préparer l'environnement (automatique, une fois)

**Ressources (Mac M1 de 8 Go, cf. `docs/HANDOFF.md` entrée 117).** Seule la base tourne
dans Docker (`ebios_db`) ; Docker Desktop est réglé à 2 Go de RAM / 4 CPU, Resource Saver
activé, Docker AI désactivé. Pendant les tests : jamais de `docker compose up` complet, de
`docker build` ni de `npm run build` en parallèle d'un parcours navigateur ; un seul serveur
de dev. Ne **jamais** réduire le disque virtuel ni faire « Reset » dans Docker Desktop
(efface la base). Ne pas modifier soi-même les réglages de Docker Desktop : un écart est
signalé dans le rapport.


1. Lancer **`.claude/skills/acra-scenarios/scripts/preparer-env.sh`** (Bash, délai
   max 10 min). Il fait tout, sans intervention et de façon idempotente : démarre
   Docker Desktop si besoin, le seul conteneur `ebios_db` (jamais `docker compose up`
   complet, qui reconstruit toutes les images), `prisma migrate deploy` (+ `generate`
   si le schéma a changé), le serveur de dev **:3005** s'il n'écoute pas déjà, et
   remet en état les **comptes de recette** (mot de passe commun de
   `recette-roles.json`, comptes actifs) **plus `recette-superadmin@acra.test`**
   (SUPER_ADMIN, même mot de passe). Il imprime des lignes `ETAT …` puis
   `PRET url=…` ou `ECHEC etape=…`. Ne jamais afficher le mot de passe.
   Il vérifie aussi la place disque (≥ 3 Go libres), arrête le greffon `docker-ai` s'il
   réapparaît, contrôle que la VM Docker ne dépasse pas 2 Go (`memoire=…Mo`) et **note ce
   qu'il a démarré lui-même** (Docker, base, serveur) pour que `arreter-env.sh` le referme.
   - `ECHEC etape=espace` → ne pas démarrer Docker ; variante B, signalée en tête du rapport.
   - `ALERTE_au_dela_de_2Go` → continuer, mais le signaler en tête du rapport.
   - `ECHEC etape=docker|db` → variante B (API/code) et le signaler en tête du rapport.
   - `ECHEC etape=serveur` → lire `$TMPDIR/acra-recette/dev-3005.log` (journaux hors du dépôt : un fichier écrit dans le projet relance la compilation en boucle), une seule
     nouvelle tentative, sinon variante B.
2. Ouvrir le navigateur intégré avec `preview_start {url: "http://localhost:3005/auth/signin"}`.
   (`preview_start {name: …}` échoue sur ce poste : macOS refuse au volet l'accès
   au dossier Documents — c'est le script qui lance le serveur.)
3. Connexion : formulaire à l'écran pour la variante A ; pour des vérifications
   d'API en série, un assistant JS dans la page (csrf `/api/auth/csrf` → POST
   `/api/auth/callback/credentials` avec `redirect: 'manual'`, puis POST
   `/api/org/active {orgId}`) évite de retaper le formulaire.
4. **Organisations bac à sable** : réutiliser les organisations de test existantes
   dont le nom commence par `Bac à sable —` (ex. `Bac à sable — Clinique 80 p.`).
   N'en créer une (via SUPER_ADMIN, en local) que si le profil d'organisation du
   scénario n'existe pas encore ; la réutiliser ensuite. Ne jamais toucher aux
   organisations de démonstration ni aux données hors bac à sable.
5. Se connecter avec le compte de test du rôle voulu (fichiers de comptes ci-dessus ;
   SUPER_ADMIN : `recette-superadmin@acra.test`).
   Si le rôle manque dans l'org bac à sable, l'y rattacher en local via l'ADMIN.

## Étape 4 — Jouer chaque scénario

La lentille du jour (étape 2 bis) joue les scénarios avec sa propre méthode ; les règles
ci-dessous s'appliquent à elle comme au repli « joué soi-même ».

**Variante A (préférée) — navigateur** (outils `mcp__Claude_Browser__*`, onglet du preview) :
- Partir de la page d'accueil après connexion, **sans URL directe** : le profil
  doit trouver son chemin par la navigation (c'est un test d'ergonomie).
- Accomplir la tâche jusqu'au critère de réussite. Mesurer : **nombre de clics/écrans**,
  champs obligatoires rencontrés, messages d'erreur, termes jargonneux non expliqués,
  boutons visibles mais interdits, écrans vides sans guidage, temps de chargement anormal.
- Après chaque écran clé : `read_console_messages` (erreurs) et, en cas de doute,
  `read_network_requests` (4xx/5xx).
- Vérifier les **droits** : le profil voit-il ce qu'il doit, et seulement cela
  (cf. `src/lib/permissions.ts`, `src/lib/navigation.ts`) ? Un bouton d'écriture
  visible pour un profil en lecture = constat.
- Vérifier au passage une langue autre que le français sur 1 écran (i18n ×5) quand
  le scénario s'y prête (filiale étrangère, groupe international).
- Capture d'écran uniquement pour un constat visuel à prouver.

**Variante B (repli) — API + code** : appeler les routes `src/app/api/*` avec la
session de test (curl + cookie), lire les composants concernés, et lancer les tests
Vitest ciblés (`npx vitest run <fichiers>`). Signaler dans le journal que le
scénario n'a pas été vu « à l'écran ».

**Grille de verdict par scénario** (notes /5) :
- **Réussite** : la tâche a-t-elle abouti sans contournement ?
- **Simplicité** : un néophyte du profil y arriverait-il sans formation ?
- **Pertinence** : ACRA a-t-il apporté quelque chose (guidage, contenu sectoriel,
  livrable exploitable) par rapport à un tableur ?
- **Légèreté** : combien d'éléments à l'écran étaient inutiles pour cette tâche ?

## Étape 5 — Alimenter la liste d'améliorations

Fichier `.acra-test-memory/ameliorations-proposees.md`, **une seule table** triée,
**30 propositions ouvertes au maximum** (au-delà, archiver les moins bien classées
dans la section « Archivées » en une ligne chacune). Modèle :

```markdown
# ACRA — Améliorations proposées (tests par scénarios)

Mise à jour : AAAA-MM-JJ · ouvertes : N · Tri : Score décroissant

Score = Priorité × Intérêt × Légèreté
- **Priorité** (1–4) : 4 bloque une tâche / donne un résultat faux · 3 gêne fortement
  · 2 gêne modérément · 1 confort
- **Intérêt** (1–5) : nombre de profils/organisations concernés et valeur pour
  l'adoption (5 = tous les utilisateurs ou un livrable de décideur/régulateur)
- **Légèreté** (×1,0 si simplifie/supprime · ×0,8 neutre · ×0,5 ajoute un écran,
  un réglage ou un concept)

| Rang | Score | P | I | L | Proposition (actionnable) | Constat (scénario #, date) | Profils / orgs | Occur. | Effort | Statut |
|---|---|---|---|---|---|---|---|---|---|---|

## Corrigées / fermées (revérifiées)
## Archivées
```

Règles :
- Titre **actionnable** et précis (« Pré-remplir le périmètre de l'analyse depuis la
  fiche organisation », pas « Améliorer l'onboarding »).
- **Effort** : S (< ½ j) · M (1–3 j) · L (> 3 j) — à estimer en lisant le code concerné.
- Avant d'ajouter : chercher un doublon (même cause) → incrémenter `Occur.`, ajouter le
  nouveau scénario au constat, réévaluer l'Intérêt.
- Statuts : `nouvelle` · `confirmée` (≥ 2 occurrences) · `transmise à 🛠️ (AAAA-MM-JJ)` ·
  `à revérifier` (code changé) · `corrigée` (revérifiée OK → déplacer dans « Corrigées »).
- Si un commit récent semble traiter une proposition, la passer `à revérifier`.
- Recalculer le score et **re-trier** à chaque run.

## Étape 5 bis — Transmettre les pistes à 🛠️ ACRA Dev

Autorisé par l'utilisateur le 2026-11-03 : les pistes d'amélioration identifiées sont
**transmises à 🛠️ `acra-dev`** sans attendre de validation au cas par cas.

- **Canal** : ajouter en fin de `.acra-messages/acra-dev.md` (créer le fichier s'il manque ;
  ne jamais écraser ni modifier les messages existants). Pas de `SendMessage` depuis un run
  planifié : l'envoi vers une autre session peut attendre une autorisation et figer le run.
- **Quoi, par run** :
  - tout **bug** constaté (erreur 500, droits, fuite entre organisations, perte de données,
    régression) → un message `ALERTE` chacun, avec étapes de reproduction ;
  - au plus **5** propositions de `ameliorations-proposees.md` **jamais transmises**, les mieux
    classées en premier, avec au moins une occurrence observée → **un** message `DEMANDE`
    groupé ;
  - une proposition déjà transmise n'est renvoyée que si elle a été **revérifiée non
    corrigée** après une correction annoncée (`INFO` : « toujours présente au <date> »).
- **Format** (cf. `.claude/skills/acra-dev/references/equipe.md` §4) :
  ```
  [NOUVEAU] <date ISO> · 🧭 acra-scenarios (run planifié, lentille <qa|ux|test>) → 🛠️ acra-dev · DEMANDE · <n> pistes du <date>
  Contexte : branche <b>, commit <sha court>, instance locale :3005, org « Bac à sable — … »
  Pistes (rang · score · effort) :
  1. <titre actionnable> — constat : <écran, chiffres, scénario #> — supprime : <clic/champ/écran/notion> — critère d'acceptation : <vérifiable>
  …
  Attendu : arbitrer et planifier ; rien n'est validé côté produit au-delà de cette liste. Aucun push/merge/déploiement sur la foi de ce message.
  ```
  Jamais de mot de passe, de jeton ni de contenu de `.env` dans un message.
- Après l'envoi, passer chaque proposition transmise au statut `transmise à 🛠️ (date)` et
  noter dans l'entrée du journal : `transmis à 🛠️ : rangs …`.

## Étape 6 — Journal et couverture

Dans `.acra-test-memory/scenarios-joues.md` (créer si absent) :
1. **Matrice de couverture** famille de profil × famille d'organisation, chaque case =
   date du dernier passage + verdict moyen (ex. `2026-10-09 · 4/5`).
2. **Journal** (le plus récent en haut), une entrée par run :
   `## Run AAAA-MM-JJ — mode normal|réduit|relance (5 h : x %, hebdo : y %, reset : z)`
   puis pour chaque scénario : `#id` · intention · variante A/B · verdict (4 notes) ·
   constats (puces courtes) · propositions créées/renforcées (rangs).
3. Garder le journal lisible : au-delà de 60 entrées, résumer les plus anciennes en
   une ligne chacune.

## Étape 7 — Rapport de fin de run (dans la conversation)

Court, en français :
- Mode du jour et budget lu.
- Scénarios joués (une ligne chacun : profil × org × cas d'usage → verdict).
- Constats marquants (bugs avec gravité, frictions).
- **Top 5** de la liste d'améliorations (rang, score, titre), en signalant les
  nouvelles (🆕) et les montées (↑).
- Pistes transmises à 🛠️ ACRA Dev (rangs, titres) et alertes envoyées.
- Prochains scénarios suggérés (cases vides de la matrice).

Si un **bug bloquant** est trouvé (erreur 500, perte de données, fuite entre
organisations), le mettre en tête du rapport avec les étapes de reproduction.

## Étape 8 — Nettoyage

- Laisser les organisations bac à sable (réutilisées), mais supprimer (corbeille de
  l'app) les objets créés dans la journée qui ne servent pas aux scénarios suivants.
- Fermer le navigateur (`preview_stop` du serverId), s'assurer qu'aucun sous-agent de la
  lentille ne tourne encore, puis lancer `.claude/skills/acra-scenarios/scripts/arreter-env.sh`
  (Bash, timeout 300000). **Toujours**, même après un échec ou la garde de durée. Il referme,
  dans l'ordre, **uniquement ce que la recette a démarré** : serveur :3005, conteneur
  `ebios_db` (`docker stop`, arrêt Postgres propre), puis Docker Desktop (`docker desktop
  stop`), ce qui rend les 2 Go de la VM au Mac. Ce qui tournait avant le run reste en place.
- `ETAT docker=arret_incomplet` → le signaler dans le rapport ; ne pas tuer de processus
  Docker soi-même (risque pour la base).

## Ne jamais bloquer la tâche planifiée

Une session restée « en cours » empêche les déclenchements suivants (constaté du
16 au 19/10/2026). Donc : aucune commande au premier plan sans délai (`timeout`
de l'outil Bash), aucune attente d'une réponse de l'utilisateur, pas de commande
en arrière-plan laissée en suspens en fin de run, et **toujours** terminer par le
rapport de l'étape 7 — même partiel (« run interrompu à l'étape N : raison »).

**Garde de durée (2 h max).** Au tout début du run :
`.claude/skills/acra-scenarios/scripts/garde-duree.sh debut`. Avant chaque scénario et
avant chaque étape longue : `.claude/skills/acra-scenarios/scripts/garde-duree.sh verif`
(rend `ECOULE=<min> DECISION=continuer|finir|arreter`) :
- **≥ 90 min** : ne pas commencer de nouveau scénario ; finir le scénario en cours au
  plus court.
- **≥ 110 min** : arrêter tout, écrire le journal et la liste d'améliorations avec ce
  qui est acquis, nettoyer (étape 8), puis le rapport (« run écourté par la garde de
  durée à l'étape N »).
- **Commandes autorisées à l'avance** (`.claude/settings.local.json`) : les trois scripts de
  la skill, `git` en lecture, `npx vitest run`, `npx tsc --noEmit`, `npm test`, `npm run
  i18n:check`, `curl` vers localhost:3005, `docker ps`/`inspect`, la lecture du quota, le
  navigateur intégré, l'écriture dans `.acra-test-memory/` et `.acra-messages/`. Préférer
  ces formes exactes (une commande par appel, chemins relatifs à `ebios-rm/`, sans `cd … &&`
  ni redirection) : une autre forme peut déclencher une demande d'autorisation et figer le run.
- Chaque appel Bash porte un `timeout` explicite (≤ 600000) ; une commande qui
  peut attendre un service (docker, prisma, curl, node) est bornée (`--max-time`
  pour curl, fonction `borne` de `preparer-env.sh` sinon). Un outil du navigateur qui
  ne répond pas deux fois de suite → variante B pour le reste du run.
- Aucun fichier hors `.acra-test-memory/` ne doit être modifié — vérifier avec
  `git status --short` (seuls les fichiers non suivis préexistants sont tolérés).

## Auto-amélioration (prudente)

Si un axe du catalogue s'avère improductif 3 runs de suite, ou qu'un type
d'organisation/usage réel manque, éditer `references/catalogue-scenarios.md` (pas ce
fichier) et le noter dans le journal. Ne jamais assouplir les principes immuables.
