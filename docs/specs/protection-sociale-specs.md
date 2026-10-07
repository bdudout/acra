# Spécifications détaillées — organismes de protection sociale (lots P1 à P10)

Date : 2026-10-03 · Source : [`protection-sociale-besoins.md`](protection-sociale-besoins.md) · Statut : **en
réalisation** (l'état de chaque lot est tenu à jour au § 12).

**Décisions retenues (valeurs par défaut de l'expression de besoins, modifiables)** :
D1 nouvelle famille « Protection sociale » ; D2 ordre P1 → P2 → P3 → P4 (B8) → P5 (B9) → P6 (B5) → P7 (B4) →
P8 (B6) → P9 (B7) → P10 (B10) ; D3 plafond de 4 sous-secteurs (livré) ; D4 homologation = module à part, relié à
l'analyse.

**Règles communes** (skill `acra-engineering`) : test d'abord ; isolation par organisation (`getAnalyseScope`,
`visibleOrgIds`, 404 hors périmètre) ; rôle **effectif** dans l'organisation ; analyse gelée respectée ; nouveau
module = interrupteur à 3 niveaux (`DEFAULT_ORG_CONFIG` → `OrganizationConfig` → politique d'instance
`GOVERNABLE_MODULES`) ; i18n ×5 (y compris les données) ; journal d'audit de toute écriture ; migrations additives ou
de données uniquement (`check-migrations`) ; références citées avec leur version, jamais de reprise d'exigence ;
exemples génériques (aucun organisme cité) ; contenu « à relire par un expert ».

---

## P1 — Famille « Protection sociale » (B1)

**Taxonomie**
- `SECTEURS_ACTIVITE` : « Protection sociale / Sécurité sociale », inséré **avant** « Technique / Interconnexion de
  SI » (décaler les clés indexées `SECTEURS_ACTIVITE.n` des 5 dictionnaires `ebios-data/*.ts`, puis
  `node scripts/extract-ebios-data-i18n.mjs`).
- `SecteurFamille` + `FAMILY_KEYWORDS` : famille `protection_sociale`, mots-clés ×5 (`protection sociale`,
  `sécurité sociale`, `social security`, `sozialversicherung`, `sozialschutz`, `protección social`,
  `seguridad social`, `protezione sociale`, `previdenza sociale`), placée **avant** `sante` et `banque`
  (« assurance maladie » contient « assur »).
- 13 sous-secteurs `protsoc-*` (liste de l'expression de besoins § 3), libellés ×5.
- `sante-amo` est conservé (rétrocompatible) ; son libellé indique « voir aussi Protection sociale ».

**Exemples d'ateliers** (`exemples-sectoriels-ext.ts`, famille `protection_sociale`, textes ×5 dans la donnée) :
socle commun à la famille + éléments par sous-secteur ; chaque sous-secteur a ≥ 1 élément dans chacune des 9
catégories ; actions élémentaires avec technique ATT&CK ; mesures typées avec références.
`SECTOR_FAMILIES` : famille `protection_sociale` (match ×5) **en tête**.

**Catalogue** : `SectorCode` `PROTECTION_SOCIALE` (version 1.14) ; processus (droits, liquidation, paiements,
contrôle médical, relation usagers, professionnels de santé, risques professionnels, données, production) ;
≥ 12 risques, ≥ 20 contrôles (≥ 2 ancrés : RGPD, RGS, NIS2), ≥ 8 KRI, ≥ 4 missions, ≥ 3 incidents types ;
libellé de secteur ×5 ; historique 1.14 ; cliquet `sector-depth`.

**Tests** : taxonomie ×5 (famille résolue dans chaque langue, pas de collision avec santé / banque), exemples par
sous-secteur et par catégorie, traductions sans repli, absence de contenu protection sociale pour un secteur santé
sans sous-secteur `protsoc-*`, cliquet du catalogue, incidents types.
**Recette** : création d'une analyse « Protection sociale » avec 2 sous-secteurs, ateliers 1 et 5.

## P2 — Homologation de sécurité (B2)

**Modèle** `Homologation` : `id`, `organizationId`, `analyseId?` (relation), `systeme` (nom du SI), `perimetre`,
`autoriteId?` (utilisateur, autorité d'homologation), `statut` (`PREPARATION` → `COMMISSION` → `HOMOLOGUE` |
`HOMOLOGUE_RESERVES` | `REFUSE` ; `EXPIREE` calculé), `dateDecision?`, `dureeMois` (défaut 36), `dateFin?`
(calculée), `reserves` (JSON : texte + échéance), `pieces` (JSON : liste de types de pièces avec statut fourni /
manquant), `commentaireDecision?`, `rappelLe?`, horodatages. Migration additive.

**Logique pure** `lib/homologation.ts` : transitions autorisées ; `piecesRequises()` (analyse de risques, plan de
traitement, risques résiduels acceptés, test d'intrusion, PCA/PRA, attestations des prestataires) ; `dossierComplet` ;
`calcDateFin` ; `etatValidite(now)` (`VALIDE` | `A_RENOUVELER` < 6 mois | `EXPIREE`) ; RBAC : préparer = RSSI,
RISK_MANAGER, ADMIN ; décider = autorité désignée ou DIRECTION_METIER / ADMIN de l'organisation, **jamais** le
préparateur ; une décision exige un dossier complet (sauf `REFUSE`).

**API** : `GET/POST /api/homologations`, `GET/PATCH /api/homologations/[id]` (transitions ; `PATCH` refusé sur une
homologation décidée sauf réexamen), audit `HOMOLOGATION_*`. Module `homologationsActive` (défaut **false**).
**Relances** : homologation à renouveler (6 mois) et expirée, dans `executerRelances` (un e-mail de synthèse).
**UI** : `/homologations` (liste, filtres par état de validité, fiche avec pièces, décision), lien depuis l'analyse.
**Tests** : transitions, séparation préparateur / décideur, dossier incomplet, validité, routes (401/403/404 hors
périmètre, module inactif), relance.

**Reste à faire — lien homologation ↔ analyse** (confié à une autre session) :
- Fiche d'analyse (y compris projet 360) : encart « Homologation », affiché **seulement si** le module est actif pour
  l'organisation de l'analyse. Liste les homologations rattachées (`Homologation.analyseId`) avec statut, état de
  validité (badge, mêmes couleurs que `/homologations`) et date de fin ; lien vers `/homologations?h=<id>`.
- Bouton « Ouvrir un dossier d'homologation » pour un préparateur (`canPreparerHomologation` sur le rôle **effectif**
  dans l'organisation de l'analyse) : `POST /api/homologations` avec `analyseId` et `systeme` = nom de l'analyse,
  puis redirection vers la fiche.
- `/homologations?h=<id>` ouvre directement la fiche correspondante (paramètre lu à l'initialisation du composant).
- Pièce « Analyse de risques » : quand le dossier est rattaché à une analyse **approuvée**, la proposer cochée par
  défaut à la création (référence = nom de l'analyse) ; jamais cochée automatiquement après coup.
- Lecture : `GET /api/homologations?analyseId=<id>` (filtre facultatif ; l'analyse doit être accessible, sinon 404).
- i18n ×5 ; tests : route (filtre, 404 hors périmètre, module inactif), composant de l'encart (masqué si module
  inactif, bouton seulement pour un préparateur), ouverture par paramètre.
- Suppression d'une analyse : l'homologation reste (relation `SetNull`), le registre affiche « — ».

## P3 — Maîtrise des risques en réseau (B3)

**Principe** : un contrôle de l'organisation **mère** marqué « de référence » est **décliné** dans chaque entité fille
(copie liée), les entités saisissent leurs exécutions, la mère consolide.
**Modèle** : `Controle.referenceId?` (contrôle de référence d'origine) et `Controle.estReference` (booléen).
Migration additive.
**Logique pure** `lib/controle-reseau.ts` : `planDeclinaison(reference, entites, existants)` (crée ce qui manque,
n'écrase jamais une déclinaison existante) ; `consolider(reference, declinaisons, executions)` (par entité : dernier
résultat, taux de conformité, en retard).
**API** : `POST /api/controles/[id]/decliner` (RSSI / RISK_MANAGER de la mère, cible = descendants visibles) ;
`GET /api/controles/reseau` (consolidation des contrôles de référence du sous-arbre).
**UI** : page `/controles/reseau` (tableau contrôle × entité, codes couleur, export Excel).
**Tests** : déclinaison idempotente, isolation (une entité ne voit pas ses sœurs), consolidation.

## P4 — Portefeuille d'applications par entité (B8)

**Import** `POST /api/analyses/import-portefeuille` (CSV ou XLSX, 500 lignes max, 2 Mo, limitation de débit) :
colonnes `application`, `entite` (slug), `secteur`, `sous_secteurs` (séparés par « ; »), `socle` (nom d'analyse
socle, facultatif) ; mode **aperçu** (validation ligne à ligne : entité hors périmètre, sous-secteur incohérent,
doublon) puis mode **création** (transaction, analyses en brouillon héritant du socle, journal d'audit). Cellules
lues via `cell.text`, injection de formule neutralisée.
**Vue** `/analyses/portefeuille` : par entité, nombre d'analyses par statut, risques critiques, analyses sans
homologation valide (si P2 actif).
**Tests** : parsing, validation, aperçu sans écriture, création idempotente (même application + entité ignorée).

## P5 — Revues d'habilitations en masse (B9)

**Modèles** `RecertCampagne` (organisation, intitulé, application, statut `BROUILLON | OUVERTE | CLOTUREE`, échéance)
et `RecertLigne` (campagne, compte, titulaire, droit, responsable (email ou utilisateur), décision
`A_REVOIR | CONSERVER | RETIRER | MODIFIER`, commentaire, décidé par / le). Migration additive.
**Import** CSV/XLSX des droits (mêmes garde-fous que P4). **Revue** : chaque responsable voit ses lignes et décide ;
séparation : un responsable ne décide pas pour son propre compte. **Clôture** : interdite tant qu'il reste des lignes
`A_REVOIR` (sauf forçage motivé par l'ADMIN) ; export Excel des retraits à exécuter. **Relances** des lignes en
attente. Module `recertificationActive` (défaut **false**).
**Tests** : import, séparation, clôture, relance, isolation.

## P6 — Fraude (B5)

**Contenu** (catalogue `PROTECTION_SOCIALE`, version 1.14) : typologies de fraude en risques (faux professionnels,
fausses prescriptions, usurpation de comptes, détournement de prestations, fraude interne, fraude documentaire),
contrôles (détection, revue des alertes, échantillons), KRI (préjudice détecté, préjudice évité, délai de
traitement, signalements), mission d'audit « dispositif de lutte contre la fraude ».
**Régime** : `SIGNALEMENT_AGENT_PUBLIC` (Code de procédure pénale, art. 40, alinéa 2 — obligation d'aviser sans
délai le procureur de la République : délai « sans délai », déclencheur « crime ou délit constaté dans l'exercice
des fonctions »), fiche d'information ×5, désactivé par défaut.
**Tests** : catalogue, régime (sans délai chiffré, phase unique).

## P7 — Registre des algorithmes et systèmes d'IA (B4)

**Modèle** `SystemeIA` : organisation, nom, finalité, fournisseur, données utilisées (dont catégories
particulières), type de décision (`AIDE` | `AUTOMATISEE`), intervention humaine (texte), usage (liste fermée :
`ELIGIBILITE_PRESTATIONS`, `DETECTION_FRAUDE`, `ORIENTATION_USAGERS`, `TRI_DOCUMENTS`, `AUTRE`), classe indicative,
contrôles de biais / dérive (texte + date de dernière revue), `analyseId?`, `aipdReference?`, statut
(`EN_PROJET | EN_SERVICE | RETIRE`). Migration additive.
**Logique pure** `lib/registre-ia.ts` : `classeIndicative(usage, decision)` → `HAUT_RISQUE_PROBABLE` |
`A_QUALIFIER` | `RISQUE_LIMITE` **toujours marquée « indicative, à vérifier »** (règlement (UE) 2024/1689) ;
`revueEnRetard(derniereRevue, now)` (12 mois). Module `registreIaActive` (défaut **false**).
**UI** `/registre-ia` (liste, fiche, lien analyse / AIPD). **Tests** : classement indicatif, revue, routes.
**Livré (2026-10-08)** : modèle `SystemeIA` (migration `20261008100000_registre_ia`), `lib/registre-ia.ts`,
catalogue de systèmes types ×5 importable ligne par ligne (`lib/registre-ia-catalogue.ts`, comme le RoPA),
API `/api/registre-ia` (+ `[id]`, `catalogue`), page `/registre-ia` (`RegistreIaManager`), droits
`peutGererRegistreIa` (gouvernance). Usages élargis au-delà de la protection sociale : `RECRUTEMENT`,
`NOTATION_CREDIT`, `BIOMETRIE` (annexe III a priori), `IA_GENERATIVE` (art. 50). `RISQUE_LIMITE` est affiché
« Obligations de transparence (art. 50) ».

## P8 — Déclarations propres aux organismes publics (B6)

Régime `SIGNALEMENT_AGENT_PUBLIC` (P6) ; incident type « communication de crise vers un très grand nombre
d'usagers » (catalogue `PROTECTION_SOCIALE`) avec liste « à compléter » (canaux, messages, porte-parole,
coordination avec l'autorité) ; NIS2 et RGPD art. 33 / 34 existent déjà (vérifier qu'ils sont proposés au secteur).
**Tests** : régime proposé quand le secteur est actif, incident type présent.

## P9 — Tiers en grand nombre (B7)

**Import** CSV/XLSX de tiers (nom, identifiant légal, type, criticité déclarée, contact) avec dédoublonnage par
identité (`tier-identity`), aperçu puis création ; **criticité calculée** (pure : dépendance × accès aux données ×
substituabilité → 1–4) ; filtre et export des tiers critiques. Garde-fous de P4.
**Tests** : import, dédoublonnage, criticité.

## P10 — Référentiels (B10)

Vérifier la présence et la version citée de RGS, PGSSI-S, HDS, NIS2 art. 21 (déjà présents) et leur recommandation
pour le secteur `PROTECTION_SOCIALE`. **SecNumCloud** : aucune exigence ne sera transcrite sans la source officielle
(règle du projet) ; on ajoute seulement une **référence** (« Référentiel SecNumCloud, ANSSI — version à fournir ») à
la mesure « hébergement en nuage qualifié » du catalogue, et l'intégration complète reste **bloquée** jusqu'à
fourniture du document officiel.
**Tests** : recommandations du secteur.

---

## 11. Recette commune

Pour chaque lot : `tsc`, `npm test`, `i18n:check`, `check-migrations` si migration, `npm run build` si routes,
parcours navigateur (dev :3005 sur base locale migrée), y compris lecture seule et module désactivé.

## 12. État des lots

| Lot | État | Commit |
|---|---|---|
| P1 | livré (catalogue 1.14, 13 sous-secteurs, ateliers 1 à 5, 6 types d’incident) | df75376 |
| P2 | livré (3 modules activables ; homologation : registre, dossier, décision, séparation, relance) ; reste : lien depuis la fiche d’analyse (spécifié ci-dessus, confié à une autre session) | c8aa809 |
| P3 | livré (référence → déclinaison idempotente dans les entités descendantes visibles, consolidation contrôle × entité, export Excel, page /controles/reseau) | ce commit |
| P4 | à faire | |
| P5 | à faire | |
| P6 | à faire | |
| P7 | à faire | |
| P8 | à faire | |
| P9 | à faire | |
| P10 | à faire | |
