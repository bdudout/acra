# Méthodes d'analyse de risque configurables — Expression de besoins & cadrage

> Statut : **cadrage** (décisions structurantes arrêtées avec le porteur). Implémentation
> non démarrée. Objectif : permettre des analyses **plus simples ou d'autres méthodes**
> que EBIOS RM, activables au niveau **instance** et/ou **par analyse** (configuration
> avancée), **EBIOS RM restant le défaut**.

## 1. Objectif

Aujourd'hui l'application impose **EBIOS RM** (ANSSI, 2018) partout : 5 ateliers, UI
`analyses/[id]/atelier/[num]`, `atelierCourant`, `ATELIERS_META`. Le besoin : offrir le
**choix de la méthode** d'analyse selon le contexte (cyber approfondi vs risque
opérationnel simple, référentiel international), sans casser l'existant ni la
souveraineté méthodologique.

## 2. Décisions de cadrage (arrêtées)

| Choix | Décision |
|---|---|
| **Méthode par défaut** | **EBIOS RM** (rétrocompatibilité totale ; l'existant ne change pas). |
| **Activation** | **Instance** (SUPER_ADMIN : méthodes autorisées + défaut) **et par analyse** (config avancée, dans l'ensemble autorisé). |
| **Méthodes visées** | EBIOS RM · **ISO/IEC 27005:2022** (pur, non‑EBIOS) · **US = NIST SP 800‑30 Rev.1** · **ISO 31000:2018** (simple, risque opérationnel). |
| **Périmètre v1** | **EBIOS RM + ISO 31000 simple** (socle multi‑méthode + méthode simple). ISO 27005 et NIST 800‑30 en incréments suivants. |
| **ISO 31000 v1** | **Qualitatif** : appréciation **gravité × vraisemblance** via les échelles et la matrice existantes ; **pas** d'ateliers cyber. |
| **US** | **NIST SP 800‑30 Rev.1** (MEHARI écartée : méthode **française** du CLUSIF, pas américaine). |

## 3. Principe : libellés normatifs officiels

**Ne jamais traduire soi‑même** les intitulés d'étapes/normes. Reprendre la
terminologie **officielle** et **citer la version** :
- **ISO/IEC 27005:2022** — *Information security, cybersecurity and privacy protection —
  Guidance on managing information security risks* (termes de l'article « Terms and
  definitions » et des phases du processus). Traduction FR : version **AFNOR**.
- **ISO 31000:2018** — *Risk management — Guidelines* (processus §6 : périmètre/contexte/
  critères, appréciation = identification/analyse/évaluation, traitement, surveillance,
  enregistrement). Traduction FR : version **AFNOR**.
- **NIST SP 800‑30 Rev.1** — *Guide for Conducting Risk Assessments* (étapes
  Prepare / Conduct / Communicate / Maintain, et le modèle threat source → threat event →
  vulnerability → likelihood → impact → risk).
- **EBIOS RM** — ANSSI, guide 2018 (les 5 ateliers, déjà en place).

Les libellés ci‑dessous sont **descriptifs** et à **remplacer** par les intitulés
officiels à l'implémentation.

## 4. Les méthodes et leurs étapes

> Convention : chaque méthode déclare un **jeu d'étapes** (au lieu des 5 ateliers EBIOS
> figés). L'analyse suit ces étapes ; le reste (échelles, matrice, référentiels de
> mesures, plans d'action, conformité) est **partagé**.

| Méthode | Étapes (descriptif — à caler sur la source) | Nature |
|---|---|---|
| **EBIOS RM** (défaut) | Atelier 1 Cadrage/socle · 2 Sources de risque · 3 Scénarios stratégiques · 4 Scénarios opérationnels · 5 Traitement | Cyber approfondie (existant) |
| **ISO/IEC 27005:2022** | Établissement du contexte · Identification des risques · Analyse · Évaluation · Traitement (+ acceptation, communication, surveillance) | Cyber/SI, par phases |
| **NIST SP 800‑30 Rev.1** | Prepare · Conduct (sources de menace, événements, vulnérabilités, vraisemblance, impact, détermination du risque) · Communicate · Maintain | Cyber/SI (US) |
| **ISO 31000:2018** (simple) | Périmètre & critères · **Appréciation simple (gravité × vraisemblance)** · Traitement | Risque **opérationnel**, générique |

**Communs à toutes** : échelles gravité/vraisemblance (`ebios-data`, config org),
**matrice** qualitative/quantitative (`risk-scale`, déjà multi‑mode), référentiels de
mesures (`referentielMesures`), plans d'action unifiés, conformité, exports.

## 5. Modèle de configuration à 3 niveaux (+ par analyse)

Application du modèle projet (cf. `CLAUDE.md` § config à 3 niveaux) :

1. **Défaut** (lib pure) : `methode = EBIOS_RM`. Rétrocompatible : toute analyse
   existante reste EBIOS RM.
2. **Par organisation** (ADMIN, `/configuration`) : **méthodes autorisées** dans l'org +
   **méthode par défaut** de l'org (dans l'ensemble autorisé par l'instance).
3. **Politique d'instance** (SUPER_ADMIN, `/admin/instance`) : **méthodes activées** au
   niveau instance (une méthode désactivée à l'instance est indisponible partout) +
   éventuel **défaut d'instance**.
4. **Par analyse** (**configuration avancée**, à la création) : choix de la méthode dans
   l'ensemble **effectif** (instance ∩ org). Défaut = défaut org → défaut instance →
   EBIOS RM.

**Résolution en un seul point** : une fonction pure `resolveMethodes(...)` retourne
l'ensemble effectif + le défaut, comme `resolveModuleActivation`. Le champ `methode` de
l'analyse est **figé à la création** (changer de méthode = nouvelle analyse ; pas de
conversion silencieuse d'un jeu d'étapes à un autre).

## 6. Impact technique (esquisse)

- **Schéma** : `Analyse.methode String @default("EBIOS_RM")` (+ migration ; backfill
  implicite via le défaut). Valeurs : `EBIOS_RM | ISO_27005 | NIST_800_30 | ISO_31000`.
- **Étapes par méthode** : lib pure `lib/methodes.ts` — pour chaque méthode, la liste
  d'étapes (clé, libellé i18n, composant/section). L'UI `analyses/[id]/atelier/[num]`
  et `WorkshopProgress` lisent ce jeu au lieu des 5 ateliers figés (EBIOS = jeu actuel).
- **Création d'analyse** : `/api/analyses` accepte `methode` (validée contre l'ensemble
  effectif) ; UI de création avec sélecteur en **config avancée** (repliée par défaut).
- **Config** : `OrganizationConfig` (méthodes autorisées + défaut) ; `Configuration`
  (méthodes activées instance) ; helpers de résolution purs + testés.
- **i18n** : intitulés d'étapes des nouvelles méthodes dans les 5 langues (libellés
  **officiels**, pas de traduction maison).
- **Rétrocompat** : EBIOS RM inchangé ; les vues/agrégations (dashboard, plans d'action,
  conformité) restent agnostiques de la méthode (elles consomment risques/mesures).

## 7. Périmètre v1 (proposé)

1. **Socle multi‑méthode** — ✅ **livré (phase 1)** : champ `Analyse.methode`
   `@default("EBIOS_RM")` (+ migration) ; registre **pur** `lib/methodes.ts`
   (métadonnées + jeux d'étapes des 4 méthodes + `resolveMethodes` = ensemble
   effectif avec **garde-fou EBIOS RM toujours disponible**) ; validation de la
   méthode à la **création** (`/api/analyses`, retombe sur le défaut si non
   proposable). `IMPLEMENTED_METHODS = ['EBIOS_RM']` : seule EBIOS RM est câblée
   → **zéro changement fonctionnel**, les autres méthodes se « débloquent » en
   ajoutant leur parcours. Tests purs (`methodes.test.ts`).
2. **ISO 31000 simple** — en cours, en **3 sous-étapes** (les risques EBIOS
   dérivent des scénarios ; ISO 31000 exige une **saisie directe**, donc du neuf) :
   - **2a. Saisie directe des risques** — ✅ **livré** : logique pure
     `lib/risque-direct.ts` (appréciation G×V, `computeRiskScore`) + API
     `/api/analyses/[id]/risques` (GET/POST/PATCH/DELETE) **gardée** aux méthodes à
     saisie directe (`usesDirectRiskEntry`, garde `analyse-direct-risk.server.ts` :
     accès + méthode + édition F01 + gel). Tests purs + route.
   - **2b. Parcours ISO 31000** — ✅ **livré** : `ISO_31000` câblé
     (`IMPLEMENTED_METHODS`). Comme la méthode est une **évaluation simple** (risque
     opérationnel), le parcours n'est **pas** un tunnel d'ateliers EBIOS mais un
     **écran unique d'appréciation** : composant `RisquesDirects` (tableau
     gravité × vraisemblance → niveau via la matrice, stratégie de traitement,
     CRUD via l'API 2a). La page d'ateliers court-circuite tout le parcours EBIOS
     quand `methode === 'ISO_31000'` (aucune fuite de contenu EBIOS). i18n
     `risquesDirects` + `methodes` (5 langues). Tests composant.
   - **2c. Activation + sélecteur** — ⬜ `Configuration.methodesActives` (défaut
     `["EBIOS_RM"]`) + toggle SUPER_ADMIN + sélecteur à la création (config
     avancée) + i18n libellés **officiels** ISO 31000.

Incréments suivants : **ISO 27005** (phases), **NIST 800‑30** (Prepare/Conduct/…),
option **quantitative** (FAIR‑like) si besoin.

## 8. Points de vigilance

- **Rétrocompatibilité** : le défaut EBIOS RM et le figement à la création garantissent
  que rien ne bouge pour l'existant.
- **Terminologie normative** : libellés officiels ISO/NIST/ANSSI, versions citées
  (règle projet). Pas de traduction automatique.
- **Cohérence des agrégats** : dashboard, `/plans-actions`, conformité, exports doivent
  rester **agnostiques** de la méthode (ils lisent risques/mesures/plans, pas les
  ateliers). À vérifier au fil de l'eau.
- **Ne pas dupliquer** : une méthode = un **jeu d'étapes** + d'éventuels masquages de
  sections ; pas de duplication du moteur de risque, des échelles ni de la matrice.

---

Voir aussi : `CLAUDE.md` (§ config à 3 niveaux, § traductions officielles),
`src/lib/risk-scale.ts` (matrice multi‑mode), `src/lib/ebios-data.ts` (échelles,
`ATELIERS_META`), `docs/ARCHITECTURE.md`.
