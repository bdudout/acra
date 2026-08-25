# Analyse & expression de besoins — 2ᵉ ligne de défense optionnelle

> Statut : **proposition à valider** (aucun code écrit à ce stade).
> Objet : permettre aux organisations **non bancaires / non financières** d'utiliser
> ACRA sans la séparation stricte des 3 lignes de défense, tout en préservant le
> mode réglementé pour les entités qui y sont soumises.

---

## 1. Contexte

ACRA implémente le modèle des **3 lignes de défense** (réf. arrêté ACPR du 3 nov. 2014,
IIA « Three Lines Model ») :

| Ligne | Rôle | Ce que le produit impose aujourd'hui |
|------|------|--------------------------------------|
| **1ʳᵉ** (opérationnel / métier) | exécute | déclare incidents, exécute les contrôles N1, cote en RCSA |
| **2ᵉ** (risques & conformité) | supervise, cadre | **définit** le plan de contrôle, **valide** (quatre-yeux), pilote KRI/appétit, supervise N2, valide les dérogations |
| **3ᵉ** (audit interne) | assure | missions d'audit, constats |

Cette séparation est **structurante et partout dans le code**. Pour une PME, une
collectivité, un industriel ou une structure de santé **hors périmètre ACPR/DORA**,
elle est **surdimensionnée** : souvent la même personne porte le risque *et* le
contrôle. Le formalisme « quatre-yeux » devient un frein plutôt qu'une garantie.

**Besoin exprimé :** rendre la **2ᵉ ligne optionnelle** au niveau de la configuration
GRC, pour proposer un **mode simplifié (« ligne unique »)** aux organisations non
régulées — sans dégrader le mode réglementé existant.

---

## 2. Problème à résoudre

Aujourd'hui, désactiver la 2ᵉ ligne est **impossible** :

1. **Séparation des fonctions codée en dur** — plusieurs contrôles d'accès exigent un
   **rôle de 2ᵉ ligne distinct** ou un **second acteur** :
   - `peutDefinir2eLigne` (plan de contrôle, KRI, campagnes RCSA, campagnes de contrôle) ;
   - `canValiderDerogation` — **quatre-yeux** : le valideur ≠ demandeur (CWE-863) ;
   - **RCSA** (M1 v2) : cotation 1ʳᵉ ligne **puis** validation 2ᵉ ligne (étape distincte) ;
   - **qualification d'incident** réservée à la 2ᵉ ligne (`peutQualifier`) ;
   - **contrôle du contrôle N2→N1** et **attestation d'indépendance** (livrés récemment).
2. **Vocabulaire & parcours** — libellés « 2ᵉ ligne », sections dédiées, rapport annuel
   segmenté 1/2/3.
3. **Conséquence** : une organisation à une seule ligne se retrouve **bloquée** (personne
   pour « valider » à la 2ᵉ ligne) ou obligée d'attribuer artificiellement des rôles.

---

## 3. Cibles & cas d'usage

- **Org non régulée, petite structure** : 1 à 3 personnes couvrent tout. Veut un
  dispositif de maîtrise **léger** : des risques, des contrôles, des incidents, sans
  double validation ni rôles séparés.
- **Org non régulée, structurée** : veut garder l'audit (3ᵉ ligne) mais **fusionner**
  1ʳᵉ et 2ᵉ lignes.
- **Org régulée (banque/assurance)** : **inchangé** — séparation imposée. La politique
  d'instance doit pouvoir **verrouiller** la 2ᵉ ligne à ON pour ces locataires.

---

## 4. Options d'architecture

### Option A — Relâcher la **séparation des fonctions** (recommandée pour le MVP)
Un toggle gouverne **l'exigence de séparation**, pas la présence des modules :
- quand OFF, la 1ʳᵉ ligne (ou l'ADMIN/RSSI) peut **réaliser les tâches de 2ᵉ ligne
  elle-même** ; les workflows quatre-yeux passent en **étape unique** ; l'indépendance
  N2 n'est plus exigée.
- Les modules (KRI, appétit, RCSA, dérogations, contrôle permanent, audit) **restent
  pilotés par leurs toggles existants** — pas de double commande.
- **Avantages** : chirurgical, testable (fonctions pures de permissions), réversible,
  rétrocompatible (défaut = ON). N'introduit aucun masquage fragile.
- **Inconvénient** : ne « nettoie » pas l'UI des modules peu pertinents (mais ils sont
  déjà désactivables un par un).

### Option B — Masquer les **modules purement 2ᵉ ligne**
Le toggle masque KRI / appétit / RCSA / dérogations.
- **Avantage** : UI plus épurée d'emblée.
- **Inconvénient** : **double commande** avec les toggles de modules existants
  (source d'incohérences), et masque des fonctions parfois utiles hors régulation
  (ex. KRI). **Écarté comme mécanisme principal.**

### 👉 Recommandation
**Option A** comme socle (le toggle = « séparation des fonctions 1ʳᵉ/2ᵉ ligne »), avec,
en **lot 2 optionnel**, des **valeurs par défaut de modules** adaptées au profil non
régulé (préréglage à la création d'org), plutôt qu'un masquage piloté par le toggle.

---

## 5. Modèle de configuration (aligné sur l'existant à 3 niveaux)

Nouveau toggle **`secondeLigneActive: boolean`** (nom à confirmer) :

1. **Défaut** : `true` dans `DEFAULT_ORG_CONFIG` → **rétrocompatible** (comportement
   actuel inchangé pour tout l'existant).
2. **Par organisation** : réglé par l'**ADMIN** dans `/configuration` (section
   « Fonctionnalités »), hérité dans l'arbre multi-org via `resolveOrgConfig`.
3. **Politique d'instance** : le **SUPER_ADMIN** surplombe via
   `Configuration.modulesPolicy` (`PER_ORG | FORCE_ON | FORCE_OFF`) →
   `resolveModuleActivation`. **FORCE_ON** = séparation imposée partout (locataires
   régulés) ; **FORCE_OFF** = mode ligne unique imposé.

**Règle d'or respectée** : résolution en **un seul point** (`getOrgConfig`) ; tout le
code lit `orgConfig.secondeLigneActive` déjà résolu. Fonction de résolution **pure et
testée**.

---

## 6. Effets détaillés quand `secondeLigneActive = false` (mode ligne unique)

| Domaine | Comportement 2ᵉ ligne ON (actuel) | Comportement 2ᵉ ligne OFF (nouveau) |
|--------|-----------------------------------|-------------------------------------|
| **Plan de contrôle / KRI / campagnes** | `peutDefinir2eLigne` (RSSI/RM/CONTROLEUR/CONFORMITE/ADMIN) | ouvert aussi à la 1ʳᵉ ligne responsable (capacité « définir » élargie) |
| **RCSA** | cote (1ʳᵉ) → **valide** (2ᵉ) | **clôture en une étape** par l'évaluateur ; pas d'étape de validation distincte |
| **Dérogations** | avis RSSI → **2ᵉ valideur ≠ demandeur** (quatre-yeux) | **validation simple** (RSSI/ADMIN), le demandeur peut être l'acteur ; **tracé** au journal d'audit |
| **Qualification d'incident** | 2ᵉ ligne (`peutQualifier`) | ouverte à la 1ʳᵉ ligne responsable |
| **Contrôle du contrôle N2 / indépendance** | proposés / attendus | **masqués** (pas de N2 obligatoire, pas d'attestation d'indépendance) |
| **Reporting (rapport de contrôle interne)** | sections 1 / 2 / 3 + segmentation N1/N2 | **fusion 1ʳᵉ+2ᵉ** en « contrôle interne » ; segmentation N1/N2 **optionnelle** |
| **Navigation / libellés** | mentions « 2ᵉ ligne » | vocabulaire neutre (« contrôle », « validation ») |

> Les **modules** (registre, incidents, contrôle permanent, audit, KRI, réglementaire,
> dérogations) **restent régis par leurs toggles**. Le toggle 2ᵉ ligne agit sur la
> **séparation** et le **vocabulaire**, pas sur la présence des modules.

---

## 7. Besoins fonctionnels (exigences)

- **EX-1** — L'ADMIN d'une organisation peut activer/désactiver la 2ᵉ ligne de défense
  depuis `/configuration`, avec un libellé clair et une aide expliquant l'effet
  (séparation des fonctions).
- **EX-2** — Par défaut, la 2ᵉ ligne est **active** (aucune régression pour l'existant).
- **EX-3** — Le SUPER_ADMIN peut **imposer** (FORCE_ON) ou **interdire** (FORCE_OFF) la
  2ᵉ ligne au niveau instance ; l'UI org verrouille le toggle en conséquence
  (« imposé / désactivé au niveau instance »).
- **EX-4** — En mode ligne unique, **aucune action n'est bloquée faute de 2ᵉ acteur** :
  les workflows quatre-yeux deviennent mono-acteur.
- **EX-5** — Le relâchement du **quatre-yeux des dérogations** (CWE-863) n'est effectif
  **que** lorsque la 2ᵉ ligne est explicitement désactivée, et chaque validation
  mono-acteur est **journalisée** (auditabilité).
- **EX-6** — Le mode est **résolu en un point** (`getOrgConfig`) et lu partout via
  `orgConfig.secondeLigneActive` ; la logique de résolution est **pure et testée**.
- **EX-7** — Le **rapport de contrôle interne** s'adapte : fusion 1ʳᵉ+2ᵉ ligne et
  segmentation N1/N2 masquée quand la 2ᵉ ligne est off.
- **EX-8** — **Rétrocompatibilité totale** : migration idempotente, colonne à défaut
  `true`, toutes les orgs existantes conservent le comportement actuel.
- **EX-9 (i18n)** — Libellés du toggle et vocabulaire adaptatif dans les **5 langues**.

## 8. Exigences non fonctionnelles

- **Sécurité** : ne jamais relâcher une séparation par défaut ; le passage en mono-acteur
  est un **choix explicite, org-scopé, verrouillable par l'instance et tracé**. Le
  re-audit R01/R02 ne doit pas régresser.
- **Testabilité** : chaque assouplissement passe par une **fonction de permission pure**
  paramétrée par `secondeLigneActive` (TDD).
- **Réversibilité** : réactiver la 2ᵉ ligne rétablit immédiatement les exigences (aucune
  donnée perdue ; les validations déjà faites restent valides).
- **Cohérence** : un seul point de vérité ; pas de double commande avec les toggles de
  modules.

## 9. Règles de gestion clés

- **RG-1** : `secondeLigneActive` par défaut `true`.
- **RG-2** : `peutDefinir2eLigne(role, { secondeLigneActive })` — quand OFF, renvoie
  vrai aussi pour la 1ʳᵉ ligne responsable (à définir : ANALYSTE/METIER porteur, ou
  tout rôle non-LECTEUR).
- **RG-3** : `canValiderDerogation(user, d, { secondeLigneActive })` — quand OFF,
  n'impose plus `user.id !== d.demandeurId`.
- **RG-4** : RCSA — quand OFF, la cotation vaut clôture (pas d'état « à valider »).
- **RG-5** : la politique d'instance prime toujours sur le toggle org.

## 10. Périmètre d'impact (inventaire technique)

- `lib/org-config.ts` / `org-config.server.ts` : champ + défaut + résolution.
- `lib/module-policy.ts` : overlay instance.
- `prisma/schema.prisma` + migration : `OrganizationConfig.secondeLigneActive` (défaut true).
- `lib/permissions.ts` : `peutDefinir2eLigne`, `peutQualifier` (audit), signatures paramétrées.
- `lib/derogation.ts` : `canValiderDerogation` (quatre-yeux paramétré).
- RCSA (`lib/campagne-rcsa*` / registre v2) : workflow de validation.
- `lib/navigation.ts` : entrées/vocabulaire.
- `lib/rapport-controle-interne.ts` : fusion des lignes + segmentation conditionnelle.
- Composants concernés : `ControlesManager` (N2/indépendance/import), `IncidentsManager`
  (qualification), dérogations, RCSA, `/configuration`.
- i18n × 5.

## 11. Plan de mise en œuvre proposé (lots)

1. **Lot 0 — socle config** : champ `secondeLigneActive` (défaut true) + migration +
   résolution 3 niveaux + toggle `/configuration` (aide + verrou instance) + i18n.
   *Sans effet fonctionnel encore : purement additif et testé.*
2. **Lot 1 — permissions** : paramétrer `peutDefinir2eLigne`, `peutQualifier`,
   `canValiderDerogation` par `secondeLigneActive` (TDD), câblage aux routes/pages.
3. **Lot 2 — workflows** : RCSA mono-étape, dérogations mono-acteur (tracé), masquage
   N2/indépendance quand OFF.
4. **Lot 3 — reporting & vocabulaire** : fusion 1ʳᵉ/2ᵉ ligne, segmentation N1/N2
   conditionnelle, libellés adaptatifs.
5. **Lot 4 (option)** : préréglages de modules « profil non régulé » à la création d'org.

Chaque lot = une PR indépendante, TDD, CI verte, vérif runtime.

## 12. Points ouverts à trancher (décisions attendues)

- **D-1** — Nom du toggle : `secondeLigneActive` vs `separationDesFonctionsActive` vs
  `modeLigneUnique` (inverse). *Reco : `secondeLigneActive` (positif, cohérent avec les
  autres `xxxActive`).*
- **D-2** — En mode OFF, qui hérite des tâches 2ᵉ ligne ? *Reco : tout rôle **non-LECTEUR**
  ayant déjà accès au module (ADMIN/RSSI/RM + 1ʳᵉ ligne responsable).*
- **D-3** — Masque-t-on réellement N2/indépendance, ou les laisse-t-on **facultatifs mais
  visibles** ? *Reco : masqués (moins de bruit pour non régulé).*
- **D-4** — Le toggle doit-il **aussi** proposer un préréglage de modules (Lot 4) ou
  rester strictement « séparation » ? *Reco : rester « séparation » ; préréglage séparé.*
- **D-5** — Faut-il un **profil d'organisation** (« régulé / non régulé ») qui pilote
  plusieurs défauts d'un coup, dont la 2ᵉ ligne ? *À arbitrer (peut remplacer un simple
  toggle par un choix de profil plus lisible).*

---

## 13. Impact sur le chantier en cours (audit / N3)

Le chantier 5 (audit N3 : programme, périmètre audité, plan pluriannuel) est **compatible**
et **orthogonal** : l'audit est la 3ᵉ ligne, non concernée par le toggle 2ᵉ ligne. Les
briques N2 déjà livrées (contrôle du contrôle, indépendance) devront simplement **se
masquer** quand la 2ᵉ ligne est OFF (traité au Lot 2). Reprise de WS5 après validation de
cette expression de besoins, ou intercalage du Lot 0 selon priorité.
