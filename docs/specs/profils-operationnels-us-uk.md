# Expression de besoin — Profils opérationnels US/UK

**Statut :** lot 1 livré (profils de référence) · lots 2–3 à décider · **Date :** 2026-09-28

## 1. Objectif

Permettre à une organisation qui le souhaite de piloter ses risques et ses
contrôles contre les pratiques opérationnelles américaines et britanniques, sans
alourdir le parcours standard EBIOS RM / ISO 27005 / RCSA d’ACRA.

Le module doit rendre visible l’écart entre un état actuel et un état cible,
transformer les écarts retenus en plans d’action ACRA, et produire une preuve
lisible pour la direction, la deuxième ligne et un auditeur.

## 2. Périmètre fonctionnel

### Lot 1 — Profils de référence (livré en premier)

- profil **NIST CSF 2.0** : Current Profile, Target Profile, niveau de rigueur
  de gouvernance, appétence, propriétaire et justification ;
- profil **NCSC CAF v4.0** : Basic Profile ou Enhanced Profile, objectifs A à D
  et leurs 14 principes (les IGP par résultat contributif relèvent d'un lot ultérieur) ;
- couverture réutilisant les référentiels et évaluations de conformité ACRA ;
- écarts : non applicable, couvert, partiellement couvert, non couvert ;
- décision explicite sur chaque écart et promotion vers le plan d’action unifié ;
- export du bilan de profil et journalisation des modifications/exportations.

### Lot 2 — Résilience opérationnelle UK

- important business service, propriétaire, client/objectif concerné ;
- impact tolerance, unités et critères d’atteinte ;
- cartographie dépendances : processus, applications, données, sites, équipes,
  tiers et contrôles ;
- scénario sévère mais plausible, test, résultat, brèche de tolérance et action ;
- rapprochement avec incidents et continuité. Cette couche vise notamment la
  PRA SS1/21 ; elle ne constitue pas une attestation réglementaire.

### Lot 3 — Quantification optionnelle US

- hypothèses de fréquence et de perte, plages documentées, scénarios ;
- calcul FAIR-like séparé du scoring qualitatif, sans mélange implicite ;
- simulation et agrégation uniquement après validation métier des données.

## 3. Utilisateurs et droits

| Rôle | Droit |
|---|---|
| ADMIN organisation | active le module, configure le profil cible |
| RISK_MANAGER / RSSI | évalue, propose et valide les écarts |
| Métier propriétaire | renseigne les preuves et traite les actions assignées |
| AUDITEUR / LECTEUR | lecture selon son périmètre, sans modification |
| SUPER_ADMIN | impose ou interdit le module à l’échelle instance |

Les accès suivent le rôle **effectif dans l’organisation** et non le rôle global.

## 4. Activation et non-régression

Le module `profilsOperationnels` applique le modèle ACRA à trois niveaux :

1. défaut : `false` — aucune page, navigation ni obligation nouvelle pour les
   utilisateurs standards ;
2. organisation : ADMIN peut l’activer ; héritage dans l’arbre ;
3. instance : SUPER_ADMIN choisit `PER_ORG`, `FORCE_ON` ou `FORCE_OFF`.

Toute route et toute page doivent lire la valeur **effective** de `getOrgConfig`.
Un module désactivé répond 404 aux routes métier et masque ses entrées de
navigation. Les données conservées restent intactes si l’organisation le désactive.

## 5. Exigences non fonctionnelles

- i18n française, anglaise, allemande, espagnole et italienne ; titres
  normatifs conservés dans leur forme officielle quand applicable ;
- multi-organisation, RBAC, audit trail, rate-limit des écritures et protection
  des analyses gelées ;
- aucune donnée de risque envoyée vers un LLM ou un service tiers ;
- pagination/bornes pour les grilles CAF/CSF, import idempotent et exports
  protégés contre l’injection de tableur ;
- critères de risque, appétence, contrôles et plans d’action sont réutilisés,
  pas dupliqués dans un silo de profil.

## 6. Critères d’acceptation — lot 1

1. Une organisation standard ne voit rien par défaut.
2. L’ADMIN active le module, sélectionne CSF, CAF Basic ou CAF Enhanced et voit
   un état vierge sans données inventées.
3. Un évaluateur change un outcome ; l’historique et le propriétaire sont tracés.
4. Un écart retenu crée ou lie un plan d’action ACRA sans doublon.
5. Une organisation hors périmètre ou un rôle sans droit ne lit ni ne modifie le
   profil ; une politique `FORCE_OFF` prévaut.
6. Le tableau de bord donne couverture, écarts prioritaires, actions en retard
   et dernière revue, sans prétendre à une certification NIST, CAF ou PRA.

## 7. Décision d’architecture

Un **module de profils**, séparé de la conformité, est retenu. La conformité
mesure l’état de contrôles ; le profil exprime une cible de gouvernance et de
résilience, et référence les contrôles ou preuves existants. Cette séparation
évite de transformer chaque référentiel ACRA en pseudo-certification CAF/CSF et
permet d’ajouter la résilience puis FAIR sans altérer le socle standard.

## 8. Hors périmètre du lot 1

FedRAMP/RMF complet, autorisation système, certification CAF, calcul FAIR,
simulation Monte Carlo, connecteurs CMDB/ITSM et collecte automatique de preuves.
Ils feront l’objet d’une décision avant les lots 2 et 3.

## 9. Challenge de l'expression de besoin et réalisation du lot 1 (2026-09-28)

Le premier jet (Codex) évaluait 6 fonctions CSF et 4 objectifs CAF, stockés dans
la table de conformité. Challenge retenu et livré :

| Point du besoin | Constat | Décision livrée |
|---|---|---|
| Granularité | 6 fonctions / 4 objectifs : trop grossier pour un Current/Target Profile exploitable | **22 catégories CSF 2.0** (6 fonctions) et **14 principes CAF v4.0** (objectifs A–D), intitulés et énoncés **officiels** (export NIST CSF 2.0 ; pages NCSC CAF v4.0), non traduits |
| « Niveau de rigueur de gouvernance » (CSF) | Correspond aux **Tiers** CSF 2.0 | Niveau cible du profil : Tier 1 Partial → Tier 4 Adaptive |
| Basic / Enhanced (CAF) | Libellés officiels : « Basic Profile », « Enhanced Profile » | Niveau cible du profil CAF ; pas de calcul automatique des attendus IGP (lot ultérieur) |
| Séparation de la conformité (§ 7) | Le stockage en `Conformite` (préfixe `OP_PROFILE:`) contredisait la décision d'architecture et exigeait des filtres dispersés | Table dédiée **`OperationalProfile`** (unique par org × cadre) ; migration des données existantes ; filtre retiré de la conformité |
| Historique et propriétaire (critère 3) | Aucune trace par point | Horodatage **serveur** par point (`updatedAt`, `updatedById`, non forgeables) ; **diff par champ** journalisé (`OPERATIONAL_PROFILE_UPDATED`, catégorie SIEM Gouvernance) |
| « Sans doublon » (critère 4) | Chaque clic créait une action | Action **ouverte** existante renvoyée (200, `existing`) ; nouveau type de lien `OPERATIONAL_PROFILE` (`targetId` = profil, `ref` = point) ; visible dans le plan d'action unifié (facette conformité) |
| Module inactif (§ 4) | 403 | **404** sur page et routes (valeur effective, politique d'instance incluse) |
| Rate limit, export, journalisation (§ 5) | Absents | Rate limit des écritures ; **export CSV** du bilan (injection de formule neutralisée, journal `EXPORT`) |
| Tableau de bord (critère 6) | Absent | Couverture (% couverts parmi évalués applicables), points évalués, écarts, écarts à la cible, actions ouvertes / en retard, dernière revue |
| i18n (§ 5) | Libellés français codés en dur | Interface ×5 langues ; textes normatifs en anglais officiel, version citée |
| « Couverture réutilisant les référentiels ACRA » | Rapprochement CSF/CAF ↔ contrôles non outillé | **Reporté** : le mapping officiel CSF 2.0 → ISO/IEC 27001:2022 figure dans l'export NIST (Informative References) et pourra alimenter un lot « preuves » |
| « Décision explicite sur chaque écart » | Pas de statut de décision distinct | Exprimée par l'**état cible** du point (Non applicable = écart accepté/hors périmètre ; Couvert = à traiter) + promotion en action ; un circuit de validation formel relève du lot 2 |

Droits : lecture pour tout membre de l'organisation active ; évaluation et
promotion réservées à ADMIN, RSSI, RISK_MANAGER et CONFORMITE
(`peutEvaluerProfilOperationnel`). Le « métier propriétaire » (§ 3) est en lecture
au lot 1 : il est désigné comme responsable du point et porte l'action promue
(`porteur`) qu'il traite dans le plan d'action. Aucune donnée n'est envoyée à un service tiers.
