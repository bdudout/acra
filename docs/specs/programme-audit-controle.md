# Programme pluriannuel d'audit et de contrôle — plans annuels validés

**Statut :** en cours de réalisation (lot P1 démarré le 2026-10-07) · **Modules :** audit interne
(3ᵉ ligne), contrôle permanent (2ᵉ ligne)

## 1. Objectif

Permettre à chaque équipe d'audit et de contrôle de bâtir un **programme pluriannuel** (3 à 5 ans), d'en tirer chaque
année un **plan annuel validé**, de suivre sa réalisation, et d'offrir une **vision globale** de tous les plans qui fait
ressortir les doublons de sollicitation et les angles morts.

## 2. Ce qui existe et que l'on réutilise

| Existant | Rôle dans le programme |
|---|---|
| Univers d'audit (`AuditUnivers` : processus, entité, référentiel, autre ; risque 1-4 ; cycle 1-10 ans) et plan pluriannuel **calculé** (`planPluriannuel`, lib `audit-l4`) | source du programme d'audit ; reste le calcul de couverture |
| Plan annuel **calculé** des contrôles (occurrences selon la périodicité, lib `controle-l3`) | source du programme de contrôle |
| Missions d'audit (dates, processus couverts), contrôles (risque, processus, référentiel), campagnes de contrôle | **réalisations** rattachées aux lignes du plan |
| Processus (`criticite` 1-4, `criticiteDora` CRITIQUE / IMPORTANTE), registre des risques (cotations inhérente / résiduelle), organisations du sous-arbre (filiales), tiers canoniques (`Tier`) | objets ciblés par les lignes et base des indicateurs |
| Cycle de validation des rapports (brouillon → relu → validé, double regard) | modèle du cycle de validation des plans |

## 3. Choix validés

1. **Plan figé ou dynamique : un choix par plan**, avec une valeur par défaut dans la configuration de l'organisation.
   - *Figé* (client final, plan approuvé par un comité) : la version validée est figée ; toute modification en cours
     d'année crée une **révision** tracée (motif, auteur, nouvelle validation).
   - *Dynamique* (cabinet d'audit qui répond aux demandes de ses clients) : les lignes évoluent librement ; la validation
     porte sur l'état du plan à la date de validation, conservé comme jalon ; les écarts ultérieurs restent visibles.
   - Défaut proposé : *figé*.
2. **Validateurs configurables** dans la configuration de l'organisation, avec ces valeurs par défaut :
   - plan d'**audit** : préparé par l'audit interne (auditeur), validé par la direction (direction métier) ou
     l'administrateur, au titre du comité d'audit ;
   - plan de **contrôle** : préparé par le contrôle permanent ou la conformité, validé par le gestionnaire des risques ou
     le RSSI.
3. **Double regard** (préparateur ≠ validateur) : **désactivable, désactivé par défaut**.
4. **Plans d'audit et de contrôle séparés**, réunis dans une **vue commune**.
5. **Plusieurs plans** d'audit et de contrôle par organisation, un par **équipe ou spécialité** (ex. audit SI, audit
   métier, contrôle conformité, contrôle opérationnel).

## 4. Modèle (proposé)

### Plan (`PlanProgramme`)
`organizationId`, `type` (AUDIT | CONTROLE), `nom`, `equipe` (spécialité), `prismePrincipal` (PERIMETRE | RISQUE |
PROCESSUS | REFERENTIEL), `mode` (FIGE | DYNAMIQUE), horizon (année de début, année de fin), propriétaires.

### Version annuelle (`PlanAnnee`)
`planId`, `annee`, `statut` (BROUILLON → SOUMIS → VALIDE → REVISION), préparé par / le, validé par / le, commentaire de
validation, **contenu figé** (lignes de l'année au moment de la validation, JSON), numéro de révision et motif.

### Ligne du plan (`PlanLigne`)
`planId`, `annee`, intitulé, **prisme** de la ligne (par défaut celui du plan), **cibles** (plusieurs possibles) :
- **périmètres** : organisations du sous-arbre (filiales, entités) et **tiers** ; avec la **méthode d'échantillonnage**
  (exhaustif, aléatoire, selon le risque, à dire d'expert), la population et la taille de l'échantillon, tracées ;
- **risques** du registre (un ou plusieurs) ;
- **processus** ;
- **référentiel** et ses **exigences**, qui servent de **critères d'audit** ;

période prévue (dates ou trimestre), charge estimée (jours), responsable, priorité ; **réalisations** liées (missions
d'audit, contrôles, campagnes) ; statut calculé (à venir, en cours, réalisée, reportée, annulée).

### Configuration de l'organisation (modèle à 3 niveaux)
Dans `OrganizationConfig.planificationConfig` : mode par défaut, rôles préparateurs et validateurs par type de plan,
double regard (désactivé par défaut), seuil d'ancienneté des angles morts (défaut : 3 ans). Le module suit les
interrupteurs existants (audit interne, contrôle permanent) ; pas d'interrupteur supplémentaire.

## 5. Écrans

1. **Plan d'audit / plan de contrôle** (un par équipe) : liste des lignes par année, filtres par prisme et par cible,
   actions de cycle (soumettre, valider, réviser), historique des versions.
2. **Graphique annuel** sur chaque plan : frise des 12 mois, une ligne par audit ou contrôle prévu (barre de la période
   prévue, repère de la période réalisée), couleur selon le statut, regroupement par cible ou par prisme ; export image et
   Excel.
3. **Vue globale** de tous les plans d'audit et de contrôle (filtrables par type, équipe, année), avec le même graphique
   annuel et les **indicateurs** :
   - **entités, filiales et tiers sollicités plusieurs fois** dans l'année, et **en même temps** (périodes qui se
     chevauchent entre plans ou équipes) ;
   - **risques critiques ou majeurs** et **processus critiques ou importants** (criticité 3-4 ou classement DORA)
     **non audités ni contrôlés depuis 3 ans ou plus** (seuil configurable), ou jamais ;
   - taux de réalisation par plan et par équipe, lignes reportées, charge prévue / réalisée.
4. **Configuration** : section « Planification » (rangée sous *Contrôle & audit*) pour le mode par défaut, les validateurs
   et le double regard.

## 6. Droits

- Lecture des plans : rôles à lecture globale du dispositif (comme le cockpit) ; un plan d'audit reste visible des seuls
  rôles qui voient les résultats d'audit (règle des résultats d'audit et de contrôle).
- Préparation : rôles préparateurs configurés ; validation : rôles validateurs configurés ; double regard s'il est
  activé ; toute action journalisée (`auditLog`).
- Isolation par organisation (404 hors périmètre), plans d'une filiale visibles depuis le groupe selon la portée.

## 7. Lots

| Lot | Contenu |
|---|---|
| P1 ✅ | Modèle (plan, année, ligne), migration additive, API, configuration « Planification » ; lib pure (cycle de validation, figé / dynamique, révisions) testée |
| P2 | Écran d'un plan : lignes multi-prismes (périmètres échantillonnés, risques, processus, référentiel et exigences), cycle de validation, historique |
| P3 | Graphique annuel (frise 12 mois) sur un plan ; export |
| P4 | Rattachement des réalisations (missions, contrôles, campagnes) et statut calculé ; reprise de l'univers d'audit et du plan annuel de contrôle comme point de départ d'un plan |
| P5 | Vue globale : agrégation de tous les plans, frise commune, indicateurs (doublons et chevauchements de sollicitation, angles morts ≥ 3 ans) |
| P6 | Exports (Excel, PDF pour le comité), i18n ×5, recette par rôle |

## 8. Décisions complémentaires (2026-10-07)

- **Pas de plafond de charge** par équipe : la charge estimée reste une information, sans alerte.
- **Questionnaires envoyés aux tiers** : ce sont des contrôles de niveau 1 (CN1), **non comptés** dans les sollicitations
  des plans d'audit et de contrôle.
- **Entités** : l'indicateur de sollicitations multiples s'appuie sur les organisations du sous-arbre (filiales) et les
  tiers canoniques. Les entités saisies en texte libre (registre des risques) relèvent d'un **chantier distinct** :
  consolidation et import des entités pour un registre cohérent qui suit les réorganisations (fusions, scissions,
  renommages) ; d'ici là, elles ne sont pas comptées.
