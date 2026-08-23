# Spec — Faciliter la saisie : défauts, autocomplétion, thème, tooltips

Issu de l'audit UX du 2026-08-23 (vérification runtime clair/sombre + libellés longs).
Objectif : réduire l'effort de saisie et lever deux frictions visuelles constatées.

## Chantier 1 — Valeurs de date par défaut = aujourd'hui

**Constat :** le formulaire de déclaration d'incident ouvre les champs *Survenance* et
*Détection* vides (`jj/mm/aaaa`). L'utilisateur doit saisir la date du jour à la main.

**Décision :** pré-remplir ces champs avec la date du jour (heure locale, format
`YYYY-MM-DD` attendu par `<input type="date">`). Idem pour la date de réalisation
d'une **exécution de contrôle** (même helper).

**Pur & testé :** `todayInputDate(now?: Date): string` dans `lib/form-defaults.ts`.
L'utilisateur reste libre de modifier la valeur.

## Chantier 2 — Autocomplétion des champs texte libres (`<datalist>`)

**Constat :** ~230 `<input>` texte libres, l'autocomplétion native n'existe que pour
les noms de tiers (ateliers 3/5). Rien pour les intitulés/responsables récurrents.

**Décision :** alimenter un `<datalist>` à partir des valeurs **déjà saisies** dans
l'organisation :
- Contrôle : `intitulé` et `responsable` (depuis les contrôles existants).
- Incident : `entité` (depuis les incidents existants).

**Pur & testé :** `suggestionsFromValues(values, limit=50): string[]` — valeurs
distinctes, non vides, `trim`, dédoublonnage insensible casse/accents (on garde la
1ʳᵉ casse rencontrée), tri alphabétique local.

## Chantier 3 — Responsable par défaut = utilisateur courant

**Constat :** le champ *Responsable* d'un nouveau contrôle est vide.

**Décision :** à la **création** (pas à l'édition), pré-remplir *Responsable* avec le
nom de l'utilisateur connecté. Modifiable. La page serveur `/controles` transmet
`currentUserName` (depuis la session) au composant.

**Pur & testé :** `defaultResponsable(currentUserName?: string | null): string`.

## Chantier 4 — Bascule de thème rapide + tooltips sur libellés tronqués

**Constat :** pas de bascule clair/sombre hors page profil ; certains libellés
tronqués (`truncate`) sans `title` au survol (ex. nom d'analyse au tableau de bord).

**Décision :**
- Ajouter un sélecteur de thème compact (Clair / Sombre / Auto) dans le menu
  utilisateur du `Navbar`, câblé sur `useTheme()` (déjà existant).
- Ajouter `title={valeur}` sur les libellés susceptibles d'être tronqués
  (tableau de bord : nom d'analyse ; tables contrôles/incidents : intitulés).

## Portée des tests
- Unitaires (Vitest) : `lib/form-defaults.ts` (3 fonctions) — cas nominaux + limites.
- Fonctionnels (runtime) : vérif live des 4 chantiers, thèmes clair **et** sombre,
  libellés courts et longs.
