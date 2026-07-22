# Tests end-to-end (Playwright)

Parcours réels dans le navigateur, en complément des tests unitaires Vitest.

## Exécuter en local

Prérequis : la base PostgreSQL Docker tournante (port 5432 exposé sur l'hôte).

```bash
export DATABASE_URL="postgresql://acra_user:<mdp>@localhost:5432/acra_rm"
export NEXTAUTH_SECRET="$(docker exec ebios_app printenv NEXTAUTH_SECRET)"
export E2E_PORT=3101
npm run test:e2e            # démarre next dev sur :3101 (ou réutilise) + lance les specs
npm run test:e2e:ui        # mode interactif (débogage)
```

Pour cibler un serveur déjà démarré : `E2E_BASE_URL=http://localhost:3101 npm run test:e2e`
(dans ce cas le serveur n'est pas lancé par Playwright).

## Fonctionnement

- `global-setup.ts` amorce un jeu de données déterministe (préfixe `e2e_`) :
  une organisation (dérogations + conformité actives, workflow RSSI), trois
  utilisateurs (porteur / RSSI / métier) et une analyse avec un socle contenant
  une non-conformité dérogeable. `global-teardown.ts` nettoie.
- `helpers.ts` : connexion via le flux credentials + locale forcée en FR.
- Specs : `auth.spec.ts` (connexion OK / refus), `derogations.spec.ts` (dérogation
  d'un contrôle non-conforme depuis le socle → « En revue » → registre).

## Ajouter un parcours

1. Étendre le seed dans `global-setup.ts` si besoin (rester idempotent, préfixe `e2e_`).
2. Créer `e2e/<domaine>.spec.ts`, utiliser `login()` et des locators par rôle/texte.
3. Forcer la locale via `login()` (déjà fait) pour des libellés stables.
