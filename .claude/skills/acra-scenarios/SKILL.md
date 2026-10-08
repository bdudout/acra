---
name: acra-scenarios
description: Test quotidien d'ACRA par scénarios d'usage réels — tire chaque jour une combinaison profil × organisation × cas d'usage, la joue sur l'app locale (navigateur + API), et alimente une liste d'améliorations classée par priorité et intérêt, avec un filtre « ne pas alourdir ». Ajuste le volume de tests au budget de tokens hebdomadaire restant. À utiliser pour « test quotidien ACRA », « jouer des scénarios ACRA », « tester ACRA comme un utilisateur », ou depuis la tâche planifiée de 7 h.
---

# ACRA — Scénarios d'usage quotidiens

Tu joues ACRA **comme un vrai utilisateur** : un profil donné, dans une organisation
donnée, qui veut accomplir une tâche donnée. Tu observes ce qui marche, ce qui bloque,
ce qui est superflu — et tu en tires des améliorations **qui gardent l'application
souple et facile à utiliser**.

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

## Étape 3 — Préparer l'environnement (une fois)

1. Vérifier la base : `docker ps` doit montrer le conteneur Postgres (`ebios_db`).
   S'il est arrêté : `docker start ebios_db`. Si Docker Desktop n'est pas lancé,
   ne pas insister : jouer les scénarios en **mode API/code** (étape 4, variante B) et
   le noter.
2. Démarrer l'app avec `preview_start` `{name: "acra-dev-3005"}` (config
   `.claude/launch.json`). Ne jamais lancer le serveur via Bash.
3. **Organisations bac à sable** : réutiliser les organisations de test existantes
   dont le nom commence par `Bac à sable —` (ex. `Bac à sable — Clinique 80 p.`).
   N'en créer une (via SUPER_ADMIN, en local) que si le profil d'organisation du
   scénario n'existe pas encore ; la réutiliser ensuite. Ne jamais toucher aux
   organisations de démonstration ni aux données hors bac à sable.
4. Se connecter avec le compte de test du rôle voulu (fichiers de comptes ci-dessus).
   Si le rôle manque dans l'org bac à sable, l'y rattacher en local via l'ADMIN.

## Étape 4 — Jouer chaque scénario

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
- Statuts : `nouvelle` · `confirmée` (≥ 2 occurrences) · `à revérifier` (code changé) ·
  `corrigée` (revérifiée OK → déplacer dans « Corrigées »).
- Si un commit récent semble traiter une proposition, la passer `à revérifier`.
- Recalculer le score et **re-trier** à chaque run.

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
- Prochains scénarios suggérés (cases vides de la matrice).

Si un **bug bloquant** est trouvé (erreur 500, perte de données, fuite entre
organisations), le mettre en tête du rapport avec les étapes de reproduction.

## Étape 8 — Nettoyage

- Laisser les organisations bac à sable (réutilisées), mais supprimer (corbeille de
  l'app) les objets créés dans la journée qui ne servent pas aux scénarios suivants.
- Arrêter le serveur de preview (`preview_stop`) en fin de run.
- Aucun fichier hors `.acra-test-memory/` ne doit être modifié — vérifier avec
  `git status --short` (seuls les fichiers non suivis préexistants sont tolérés).

## Auto-amélioration (prudente)

Si un axe du catalogue s'avère improductif 3 runs de suite, ou qu'un type
d'organisation/usage réel manque, éditer `references/catalogue-scenarios.md` (pas ce
fichier) et le noter dans le journal. Ne jamais assouplir les principes immuables.
