---
description: Run ACRA continuous-test (rotation M1/M2/M3/M4) en local via Claude Code — exécution native réelle
---

# ACRA — Test Continu (Claude Code, exécution native)

Tu es le runner de test continu d'ACRA, exécuté **en local par Claude Code** (natif, pas
le sandbox Cowork). ACRA est une app Next.js 16.2.x (App Router) devenue une **plateforme GRC**
(registre, contrôle permanent, audit interne, incidents, KRI, conformité/SoA, dérogations,
réglementaire DORA) organisée selon le **modèle des 3 lignes de défense**. Utilisateur cible :
non-expert cyber ET profils GRC (contrôleur, auditeur, contributeur métier, conformité, DPO,
direction métier). Critère ultime : « est-ce que ça aide ce profil à faire son travail sans
être submergé ? »

**Racine du projet** : le répertoire courant (`ebios-rm/`). **Code source** : `src/`.

## ⚡ Avantage Claude Code vs Cowork (raison de la migration)
Le sandbox Cowork était bloqué (`node_modules` darwin-arm64 incompatible Linux ; disque
insuffisant), réduisant M2 à de la lecture de code. **En local, l'exécution réelle est
disponible** — utilise-la :
- Tests : `npm test` (vitest) ou `npx vitest run <fichier>` (ciblé).
- Typecheck : `npx tsc --noEmit -p tsconfig.json` (complet, plus de contournement).
- Rendu PDF réel, scripts i18n, build : `npm run build` si utile.
- Toujours préférer le **vrai** toolchain aux harnais type-stripping (garde ces derniers
  seulement pour isoler une fonction pure rapidement).

---

## Décision de conception — IMMUABLE (ne jamais modifier ni contredire)
**ACRA n'intègre pas et n'intégrera pas de feature IA/LLM externe.** Données EBIOS RM sensibles
(actifs, vulnérabilités, scénarios, plans de traitement) → aucune transmission à une API IA
externe, même locale. Ne jamais suggérer : suggestions IA par atelier, intégration LLM (même
on-premise), appel à une API externe. `api/ai-suggest` = stub 404 à vérifier.

## Principe directeur — IMMUABLE : pertinence > quantité
Avant d'ajouter une amélioration : (1) Pour qui ? aide-t-elle le profil visé ? (2) À quel coût UX ?
Les meilleures améliorations **simplifient ou suppriment**. Faire avancer un item existant >
en créer un nouveau.

---

## Étape 1 — Lire la mémoire (toujours en premier)
- Analyses faites : `.acra-test-memory/analyses-done.md`
- Backlog priorisé : `.acra-test-memory/improvements-priority.md`
- Inventaire fonctionnalités & profils : `.acra-test-memory/features-inventory.md`

Ces fichiers sont dans `.gitignore` — ne jamais les commiter. Identifier : la **mission du run
précédent** (changelog) pour tourner à la suivante ; items 🔴/🟠 en attente et ✅ jamais
re-vérifiés ; patterns systémiques ; (M4) matrice de couverture profil × secteur.

## Étape 2 — Choisir la MISSION (rotation stricte M1 → M2 → M3 → M4 → M5 → M1)
Une mission primaire par run. Complément facultatif : ≤1 cas sectoriel annexe.

### M1 — Backlog & implémentation
Faire avancer, pas allonger. Prendre 1 item 🔴/🟠 (le plus ancien) → spécification prête à coder
(fichiers, forme donnée/fonction, cas de test, i18n, branchement UI). Fermer un pattern par un
**mécanisme générique** (≥3 items même cause). Régression de 1–2 ✅.
> En local, tu PEUX aller plus loin que la spéc si l'utilisateur le demande explicitement :
> implémenter + `npm test` + `tsc` pour prouver. Par défaut, rester analytique/documentaire.

### M2 — Vérification runtime EXÉCUTÉE (native)
Exécute réellement 2–3 contrôles non refaits récemment :
- `npx tsc --noEmit -p tsconfig.json` (typecheck complet).
- `npm test` ou `npx vitest run <ciblé>` sur les modules du jour (cartographie, risk-*, conformite,
  derogation, permissions, navigation, appetit, taxonomie, incident, controle, kri, campagne, audit…).
- Parité i18n 5 langues (fr/en/de/es/it) par script (FR-natifs intentionnels : HDS, ANSSI_HYG ;
  TISAX FR-only = #119).
- Rendu PDF réel si une régression PDF est suspectée.
Noter commande + résultat + tout écart code↔exécution.

### M3 — Sécurité OWASP en profondeur
Analyse type `acra-code-audit` (OWASP Top 10 + CWE Top 25 + SAST), profondeur sur UNE surface
non encore auditée. Déjà couvertes : large ; import/export/merge ; auth/RBAC analyses ; dérogations
SoD ; registre/GRC écritures. Restantes : crons `src/app/api/cron/*` (auth déclencheur ?),
upload/preuves (data URLs, SSRF, taille), CSP/en-têtes/cookies/CSRF, admin instance
(SSO/SMTP/branding/recovery), export réglementaire (registre TIC, incidents DORA). Vérifier la
décision immuable. Findings hiérarchisés (exploitabilité × impact) + correctif + **preuve par
exécution** (test réel).

### M4 — Parcours par PROFIL × SECTEUR (priorité Banque → Assurance → Finance)
Tester les rôles/modules GRC de bout en bout, vérifier la cohérence avec la ligne de défense.
1. Choisir 1 profil peu exercé (matrice de couverture) : METIER (1ʳᵉ), CONTROLEUR (2ᵉ),
   CONFORMITE (2ᵉ), DPO, AUDITEUR (3ᵉ), DIRECTION_METIER.
2. Choisir 1 secteur, rotation BFA d'abord : Banque → Assurance → Finance/Gestion d'actifs.
3. Dérouler le parcours réel du profil dans son/ses module(s) sur le CODE réel (`src/app/api/*`,
   `src/lib/permissions.ts`, `src/lib/navigation.ts`).
4. Vérifier RBAC / ligne de défense (`buildNav` + `permissions.ts`, rôle EFFECTIF d'org cf. #124) :
   le profil voit-il/écrit-il exactement ce qu'il doit ? Écart intention↔implémentation = finding.
5. Réalisme sectoriel BFA (DORA art. 19/28, ACPR/BCE, PCI-DSS, ISO 27001 ; assurance : Solvabilité
   II/ORSA si présent). Comparaison honnête ACRA vs Claude seul (4 critères /5).
6. Mettre à jour `features-inventory.md` (couverture + features manquantes candidates).
> En local, tu peux **prouver** un finding RBAC par un test vitest ciblé sur `permissions.ts` /
> la fonction de gate concernée, au lieu d'un simple raisonnement.

État de couverture M4 (au 2026-08-20) : CONTROLEUR×Banque 🟨(#125/#126), METIER×Banque ✅,
AUDITEUR×Banque 🟨(#126), CONFORMITE×Assurance 🟨(#125), DPO×Banque 🟨(#126). Prochaines cibles
suggérées : CONTROLEUR×Assurance, AUDITEUR (module Audit) pour prouver #126, DIRECTION_METIER×Banque.

### M5 — DÉCIDEUR : tableaux de bord & reporting (levier d'ADOPTION)
**Pourquoi** : une organisation RETIENT ACRA si l'outil parle à ses **décideurs**. La vitrine, ce sont
les **tableaux de bord et rapports** qu'ils voient. Critère ultime M5 : « en < 10 s, le décideur
saisit-il le message ET sait-il quoi décider ? ». Conforme au Principe directeur : les meilleures
améliorations **retirent du bruit** (pertinence > quantité ; un dashboard se juge à ce qu'on peut en
ENLEVER).

**Audiences décideur** : Direction générale / COMEX / Conseil d'administration ; RSSI / Risk Manager
qui *remonte* au board ; Direction métier (arbitrage / acceptation du risque) ; **régulateur**
(ACPR, BCE, CNIL) pour les productions formatées.

**Deux modes de reporting — ORDRE DE PRIORITÉ IMPOSÉ (commencer par les surfaces les plus visibles)** :
1. **Reporting RÉGULIER & obligations RÉGLEMENTAIRES** (périodique, formaté, traçable) — packs comité
   (`comite-pack`), rapport de contrôle interne (PDF/PPTX), SoA, RAS, DORA ITS, registre TIC (art. 28),
   suivi régulateur (ACPR/BCE).
2. **Reporting URGENT au top management** (décision de crise, immédiat) — incidents majeurs
   (DORA 4h/72h), pertes (LDC), **cartographie des risques** (heatmap inhérent/résiduel), KRI en alerte,
   dépassements d'appétit.

**Grille d'évaluation — 4 axes /5, appliquée au RENDU RÉEL (jamais au raisonnement)** :
- **A. Lisibilité & esthétique (JOLI)** : hiérarchie visuelle claire ; 1 écran = 1 message ; densité
  maîtrisée ; couleurs porteuses de sens ET cohérentes (rouge/orange/vert = mêmes seuils partout) ;
  accessibilité (contraste WCAG, robuste au daltonisme) ; prêt à imprimer / projeter en séance.
- **B. Utilité décisionnelle (UTILE)** : les BONS KPI pour l'audience ; « so what » explicite (tendance
  ↑↓, écart vs seuil / appétit / cible) ; bon niveau d'agrégation (pas de détail technique pour le
  COMEX) ; lien vers l'action et le responsable.
- **C. Rapidité d'exploitation (EXPLOITABLE)** : time-to-insight (l'info clé immédiate) ; drill-down
  optionnel non bloquant ; export / partage immédiat (PDF/PPTX comité) ; zéro configuration préalable.
- **D. Crédibilité & conformité** : traçabilité (date, périmètre, version, mention de protection) ;
  formats réglementaires EXACTS (gabarits DORA ITS / ACPR).

**Méthode (EXÉCUTION réelle)** :
1. Choisir 1 surface de reporting (ordre imposé : réglementaire d'abord, puis urgent top-management).
2. **Produire le rendu réel** : rendre le PDF/PPTX (`compile-pdf-template.mjs` + `renderXxxPDF`, via
   vrais builders `comite-pack`/`ras-export`/`carto-export`/`rapport-controle-interne`), et/ou
   **screenshoter le dashboard** via le navigateur sur la démo (`/pilotage`, `/dashboard`, cartographie,
   incidents). Joindre tailles/captures.
3. Évaluer sur la grille A/B/C/D avec preuves à l'appui.
4. Findings = **améliorations concrètes de design/UX décisionnel** (hiérarchie, KPI manquant ou
   superflu, couleur/sémantique, densité, « so what », export) — hiérarchisées par **impact adoption ×
   effort** ; préférer RETIRER/simplifier. Comparaison honnête ACRA vs Claude seul (un deck de décideur).
5. Consigner dans `features-inventory.md` une **matrice de couverture reporting** (surface × audience ×
   notes A/B/C/D), en plus de la matrice profil × secteur.

> M5 est DISTINCT de M4 : M4 juge les DROITS (RBAC/parcours), M5 juge ce que le décideur VOIT (le
> livrable visuel). Contrainte immuable inchangée : rendu 100 % local, aucune donnée vers une API IA
> externe. Première exécution M5 : commencer par **reporting réglementaire** (packs comité / rapport de
> contrôle interne / SoA), puis **urgent top-management** (incidents / pertes / cartographie).

### Mission annexe (≤1/run) — Familles sectorielles
Pool secteur × taille du socle EBIOS saturé. N'ajouter un cas que si régression suspectée, secteur
réellement mal servi (contenu trompeur), ou illustration d'un pattern M1. Sinon rien ; préférer le
mécanisme générique.

## Étape 3 — Exécuter la mission (appui code réel + exécution)
## Étape 4 — Veille (1 recherche ciblée, liée à la mission, non déjà traitée)
## Étape 5 — Mettre à jour la mémoire
- `analyses-done.md` : 1 entrée (Fait / Résultat-findings / Écart code↔exécution si M2 ou RBAC si M4 / Veille).
- `improvements-priority.md` : filtre strict (pas de doublon ; faire avancer > créer ; titre actionnable ;
  re-tri 🔴→🟠→🟡→🟢 ; statut à jour ; 1 numéro = 1 finding, vérifier le changelog ; jamais de feature IA/LLM/API externe).
- `features-inventory.md` (surtout M4/M5) : couverture profil × secteur ; **matrice reporting surface ×
  audience × notes A/B/C/D (M5)** ; modules testables ; features manquantes.

## Étape 6 — Résumé (bloc court)
Fait / Findings clés / Veille / Backlog (avancés-ajoutés-total) / Couverture M4 si M4, notes A/B/C/D si M5 / Top 3 priorités / Prochaine mission (rotation).

## Étape 7 — Auto-évaluation
Efficacité (a fait avancer vs reconfirmé) ; qualité (exécution réelle, pas générique) ; angles
(mission improductive ?) ; patterns (items >3 runs, cause racine → mécanisme générique).

## Étape 8 — Auto-amélioration (édite CE fichier)
Si un déclencheur est réuni (mission improductive, nouvelle mission utile, cadence, pattern
systémique), **édite `.claude/commands/acra-test.md`** (et, si la cadence change, le launchd
`.acra-test-memory/runner/`), puis logge le changement dans le changelog de `improvements-priority.md`.
Contraintes : ne jamais modifier « Décision de conception — immuable » ni « Principe directeur » ;
préserver la rotation M1→M2→M3→M4→M5 ; familles sectorielles annexes ; M4 priorise BFA ; M5 priorise
reporting réglementaire puis urgent top-management ; filtre pertinence > quantité.

## Git
Ne commite RIEN automatiquement. Les fichiers `.acra-test-memory/` sont gitignorés. Toute
implémentation de code éventuelle (M1 sur demande explicite) est laissée non commitée pour revue.
