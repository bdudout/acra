# Consolidation des entités — registre cohérent qui suit les réorganisations

**Statut :** expression de besoin (2026-10-08), décisions prises le 2026-10-08 (§ 4), lot E1 livré (modèle, référentiel, écran de configuration, choix de la source de vérité) · **Origine :** programme d'audit et de contrôle — les
sollicitations multiples ne comptent aujourd'hui que les filiales (organisations) et les tiers, pas les entités saisies
en texte libre (cf. `programme-audit-controle.md` § 8).

## 1. Existant

| Où | Représentation | Limite |
|---|---|---|
| Arbre des organisations (`Organization`, `path`) | filiales et entités structurées, gérées dans *Configuration › Entités et rôles* | une réorganisation (fusion, scission, renommage) se fait à la main ; pas d'identifiant externe ni d'historique |
| Connecteurs d'import (REST, LDAP — `lib/entity-sync`) | liste de **noms**, aperçu puis validation | rapprochement par nom uniquement ; ne gère pas les entités disparues ou renommées |
| Registre des risques (`RiskItem.entite`), incidents, plans d'action, traitements de conformité | **texte libre** | variantes d'écriture (« DSI », « Direction SI »…), aucune agrégation fiable |
| Mesures (`Mesure.entite`, liste `entitesMesures`) | liste configurable de **services responsables** (DSI, Métier…) | notion différente (fonction responsable, pas périmètre) — à garder distincte |
| Suivis de conformité (`Conformite.entite`) | libellé d'entité ou de socle | idem texte libre |

## 2. Besoin

1. **Un référentiel d'entités unique** par organisation : identifiant stable, nom, alias, identifiant externe (code
   RH, code LDAP, LEI pour les entités juridiques), type (filiale, direction, site, service), rattachement hiérarchique,
   dates de validité.
2. **Import et synchronisation** depuis un fichier (CSV / Excel) ou les connecteurs existants, avec **aperçu des
   écarts** : nouvelles, renommées (même identifiant externe), disparues, doublons probables (nom proche, alias).
3. **Réorganisations** : renommer, fusionner (A + B → C), scinder (A → B + C), clore ; chaque opération est datée,
   tracée, et **reporte les références** des objets rattachés (risques, incidents, plans, lignes de plan, conformité)
   avec une table de correspondance ; l'historique reste consultable (« à quelle entité ce risque appartenait-il en 2025 ? »).
4. **Rapprochement du texte libre existant** : proposer, pour chaque valeur distincte des champs `entite`, l'entité du
   référentiel la plus proche ; validation par lot par un administrateur ; le texte d'origine est conservé.
5. **Usage partout** : sélecteur d'entité (au lieu du texte libre) dans le registre, les incidents, les plans d'action et
   les lignes de plan d'audit / contrôle ; l'indicateur de sollicitations multiples et les tableaux de bord agrègent par
   entité, y compris à travers une réorganisation.

## 3. Lots proposés

| Lot | Contenu |
|---|---|
| E1 | Modèle `Entite` (identifiant externe, alias, type, parent, validité) + migration additive ; lien optionnel `entiteId` à côté des champs texte existants (rétrocompatible) |
| E2 | Import fichier et connecteurs : aperçu des écarts (nouvelles, renommées, disparues, doublons), validation, journal |
| E3 | Rapprochement des valeurs en texte libre existantes (proposition par similarité, validation par lot) |
| E4 | Réorganisations : renommage, fusion, scission, clôture, avec report des références et historique |
| E5 | Sélecteur d'entité dans les écrans ; agrégation des indicateurs (sollicitations du programme d'audit et de contrôle, tableaux de bord) |

## 4. Décisions (2026-10-08)

| Question | Décision |
|---|---|
| Filiales et entités | Une **filiale peut être une entité** du référentiel (type `FILIALE`), éventuellement **liée** à une organisation de l'arbre ACRA (`organisationLieeId`) quand elle a ses propres utilisateurs et sa configuration. Ce n'est pas une entité *interne* : le type le dit. |
| Services responsables des mesures | **Oui**, ils entrent dans le référentiel (type `SERVICE`). La liste `entitesMesures` reste lue tant que le rapprochement (E3) n'est pas fait. |
| Source de vérité avec un connecteur | **Choix de l'administrateur** quand un annuaire est connecté (`entitesSourceVerite` = `ACRA` ou `ANNUAIRE`), car toutes les organisations ne gèrent pas leurs entités dans l'annuaire. Si l'annuaire fait foi, le nom, l'identifiant externe et le rattachement des entités venues de l'annuaire ne sont pas modifiables dans ACRA ; alias et liens restent modifiables. |
| Rétention de l'historique des réorganisations | **5 ans** (purge des événements plus anciens ; les entités closes restent tant qu'elles sont référencées). |
