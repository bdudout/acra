# Expression de besoin — socles sectoriels, tiers uniques et écarts des modules

Statut : cadrage proposé, non implémenté · 30 septembre 2026

## 1. Décisions de produit recherchées

ACRA doit aider une organisation à démarrer ses modules sans présenter des données
fictives comme des risques évalués, des incidents survenus, des contrats signés ou
des obligations satisfaites. Le meilleur point de départ est un **catalogue de
suggestions sélectionnables et éditables**, composé d'un socle transversal et de
packs sectoriels. Une organisation peut aussi importer ses propres référentiels.

La page Tiers doit devenir la vue d'une **identité de tiers unique par organisation**.
L'écosystème cyber et le registre TIC sont deux vues et deux jeux de relations sur
ce tiers, non deux répertoires indépendants de prestataires.

Décisions confirmées par l'utilisateur : **suggestions à valider avant création**
(aucun préremplissage automatique à la création de l'organisation) ; **socle
transversal d'abord, puis packs sectoriels**. L'identité des tiers au niveau de
chaque organisation est une proposition d'architecture, encore à confirmer.

## 2. État observé dans le code

| Domaine | Déjà présent | Écart à traiter |
|---|---|---|
| Registre des risques | `buildRegistreDefaut` fournit 16 risques génériques, et `POST /api/risk-items/seed-defaut` les crée sur confirmation. | Catalogue français uniquement, orienté taxonomie Bâle ; pas d'aperçu ligne à ligne, de pack sectoriel, de version/provenance de catalogue ; dédoublonnage par intitulé. |
| Processus | `Processus` hiérarchique, CRUD `/api/processus`, liens aux risques/contrôles/KRI/incidents, champs de criticité et continuité. | Aucun catalogue de processus par secteur ni import guidé trouvé ; saisie manuelle unitaire. Le secteur n'est pas une propriété d'`Organization` aujourd'hui (un `secteur` existe sur `Analyse`). |
| Autres socles | Gabarits sectoriels de modules (`gabarits.ts`), catalogues de contrôles et programmes d'audit, socle RoPA, règles de qualification de risques. | Parcours et sémantique hétérogènes ; pas de vue transversale « suggestions → aperçu → sélection → bilan », ni de provenance/version des éléments créés. Certains catalogues contiennent des textes français en dur. |
| Tiers ↔ TIC | `tiers-tic-link.ts` joint les deux vues en lecture par nom normalisé ; badge TIC sur `/tiers`, résumé écosystème sur `/registre-tic`. | Pas d'identifiant canonique ni de lien persistant. `/tiers` part des seules `PartiePrenante` : un prestataire TIC sans analyse n'y apparaît pas. Le badge ne renvoie pas à une liste d'arrangements identifiés. Les variantes de nom ne sont pas rapprochées sûrement. |

Les deux niveaux de criticité doivent rester distincts : menace/fiabilité d'une
partie prenante **dans une analyse** d'un côté ; criticité du service ou de la
fonction couverte par un **arrangement TIC** de l'autre. Aucune valeur ne doit être
copiée automatiquement de l'un à l'autre.

## 3. Axe A — Suggestions et imports de données de départ

### A.1 Parcours utilisateur

1. Dans la configuration de l'organisation, l'ADMIN renseigne un ou plusieurs
   secteurs d'activité, avec un secteur principal facultatif. L'absence de secteur
   laisse disponible le socle transversal. Les gabarits de modules existants ne
   doivent pas imposer un secteur ni créer de données métier silencieusement.
2. À l'ouverture d'un module vide, proposer « Démarrer avec un socle » et
   « Importer mes données ». Afficher le nombre, la version, la langue, la source,
   les dépendances et un avertissement : **exemples à qualifier, pas données
   validées**. Le démarrage à vide reste possible.
3. L'aperçu compare chaque suggestion à l'existant : à créer, déjà importée,
   potentiellement similaire, non applicable (module inactif ou référence
   absente). L'utilisateur choisit un sous-ensemble, modifie les champs permis,
   rattache les propriétaires/processus et confirme. Une ressemblance de titre
   n'entraîne jamais une fusion automatique.
4. L'import de fichier (CSV/XLSX puis API si demandée) reprend le même moteur
   d'aperçu et de bilan : feuille/ligne/colonne source, valeurs attendues,
   relations non résolues, lignes sélectionnables, correction ou exclusion.
   Les lignes valides restent importables en sous-ensemble. Un lot confirmé est
   atomique pour la sélection retenue ; aucun échec partiel silencieux.
5. Le bilan détaille créé / ignoré car déjà présent / écarté par l'utilisateur /
   non importable avec sa raison. Les éléments créés restent éditables, même si
   le catalogue évolue. Une nouvelle version de pack propose un **diff**, jamais
   un écrasement automatique des lignes modifiées localement.

### A.2 Contenu proposé par module

| Module | Suggestion acceptable | Ne jamais créer automatiquement |
|---|---|---|
| Processus | Arbre transversal (gouvernance, RH, finances, achats, SI, opérations) puis processus métier du secteur ; descriptions et rôles indicatifs. | Propriétaire réel, criticité DORA/FCI, RTO/RPO non attestés. |
| Registre des risques | Événements-types liés au secteur et, si possible, à un processus proposé ; taxonomy stable ; scénarios « à évaluer ». | Cotations, acceptations, contrôles efficaces ou plans d'action présentés comme déjà décidés. |
| Contrôle permanent | Contrôles-types existants, sélection par référentiel et secteur, avec périodicité suggérée. | Exécution, preuve, efficacité ou conformité acquise. |
| Audit | Programmes et points de revue types existants, sans constat préjugé. | Missions réalisées, constats ou recommandations acceptées. |
| KRI / appétence | Bibliothèque d'indicateurs candidats, unité/source/fréquence proposées, seuils à définir. | Valeurs mesurées, seuils approuvés ou voyants « vert » par défaut. |
| Incidents / résilience | Typologies, formulaires et plans de test modèles. | Incidents réellement survenus, tests effectués ou pertes chiffrées. |
| Registre TIC | Types de service, trame de qualification et import de contrats existants. | Prestataires, contrats, sous-traitants ou fonctions critiques fictifs. |
| RoPA / conformité | Réutiliser le socle existant avec champs « à compléter » et références officielles vérifiées. | Base légale, durée de conservation ou état de conformité déclarés vrais sans validation. |

Un pack sectoriel **complète** le socle transversal ; il ne le duplique pas. Le
catalogue décrit des **suggestions**, séparées des instances d'organisation.
L'ADMIN décide de l'activation, mais les utilisateurs autorisés du module
peuvent consulter les aperçus selon leur RBAC.

Les suggestions du **registre GRC** créent des `RiskItem`, pas des `Risque`
d'analyse. Les suggestions de qualification d'une analyse restent dans le
parcours propre à sa méthodologie ; leur publication ultérieure au registre
porte la provenance de l'analyse. Une même situation visible dans ces deux
contextes n'est ni fusionnée ni comptée deux fois sans décision explicite.

### A.3 Modèle et contrats à concevoir

- Catalogue versionné immuable : `packId`, `version`, `itemId` stable, type d'objet,
  secteurs/méthodes applicables, référence/source/version du référentiel le cas
  échéant, clés de traduction dans les cinq langues, dépendances explicites.
- Instance créée : provenance structurée (`packId`, `itemId`, `version` ou
  `importId` + référence de ligne), **sans retirer** les champs éditables. Unicité
  par organisation + type + origine stable pour l'idempotence ; ne pas utiliser
  le titre seul. La fusion d'une ligne ressemblante est une décision utilisateur.
- `GET aperçu` sans écriture ; `POST sélection` avec jeton/empreinte de l'aperçu,
  vérification de la version du catalogue et des droits, transaction, audit et
  récapitulatif. Limites de taille, débit et prévisualisation adaptées aux imports.
- Les liens entre processus, risques, contrôles et KRI sont résolus par IDs dans
  l'organisation cible ; si un parent ou une référence manque, expliquer la
  dépendance et proposer de l'inclure, de remapper ou d'écarter la ligne.
- Les modules désactivés restent intacts ; la politique d'instance `FORCE_OFF`
  interdit aussi l'instanciation de suggestions. Aucun pack n'active en secret un
  module. i18n ×5 pour l'UI et les libellés de catalogue. Termes normatifs et
  réglementaires contrôlés sur les versions officielles avant livraison.

### A.4 Critères d'acceptation prioritaires

- Une organisation neuve peut démarrer vide ou sélectionner 3 risques sur 16 ;
  seules ces 3 lignes sont créées, avec provenance, statut « à évaluer » et bilan.
- Un second import du même pack n'ajoute aucune ligne déjà importée, même si le
  titre a été édité ; un titre similaire créé manuellement est présenté à
  confirmer, jamais supprimé ou renommé.
- Un fichier de processus hiérarchiques peut être prévisualisé puis importé ;
  parent absent, doublon et cycle sont expliqués à la ligne. Les lignes valides
  peuvent être conservées. Les liens existants restent stables à la réimportation.
- Le choix d'un pack « banque » ne force ni la criticité FCI ni une cotation de
  risque ; la désactivation du module masque l'entrée sans supprimer ses données.
- Test de concurrence sur l'idempotence, tests de changement de version, droits,
  isolation multi-org, import partiel, langues et clavier ; recette sur vraie DB.

## 4. Axe B — Identité de tiers unique, vues cyber et TIC

### B.1 Décision de modélisation proposée

Créer un `Tier` **canonique par organisation**, avec `id` stable, nom affiché,
statut, pays et identifiants qualifiés (LEI lorsqu'il existe, autres identifiants
avec leur type), plus des alias documentés. Les occurrences restent séparées :

```text
Organization ──< Tier (identité du prestataire / personne morale)
                  ├──< PartiePrenante (rôle et score dans chaque Analyse)
                  └──< ArrangementTic (contrat, service, criticité TIC)
```

Ajouter des `tierId` optionnels aux deux objets existants pendant la migration ;
garder leurs noms historiques comme **instantanés**, sans les réécrire lors d'un
renommage de Tier. Un Tier peut avoir zéro, une ou plusieurs parties prenantes et
zéro, un ou plusieurs arrangements. Une entreprise peut fournir plusieurs
services/contrats ; des filiales juridiquement distinctes ne sont pas fusionnées
parce qu'elles partagent une marque. Un groupe/parent de tiers est une évolution
ultérieure, distincte de l'identité légale.

Le lien est **explicite et validé** : suggestion de rapprochement par identifiant
stable valide d'abord, puis alias/nom normalisé pour revue humaine. Un nom seul
ne prouve pas l'identité. Si plusieurs candidats existent, afficher leurs
attributs et demander un choix ou la création d'un nouveau Tier. Ne jamais
faire de jointure incertaine passer pour un lien confirmé, notamment dans les
exports ou indicateurs agrégés.

### B.2 Parcours et droits

- Depuis `/registre-tic`, la saisie/import d'un arrangement demande de choisir
  un Tier existant, d'en créer un ou de laisser « à rapprocher » si les données
  sont insuffisantes. Le contrat conserve son propriétaire, son service et ses
  champs réglementaires propres. Un lien mène vers la fiche Tier.
- `/tiers` montre **tous** les Tiers du périmètre autorisé : « cyber seulement »,
  « TIC seulement », « cyber + TIC », « à rapprocher ». Chaque fiche liste les
  analyses accessibles et les arrangements accessibles avec leurs IDs/liens,
  sans recopier les contrats ni agréger des scores incompatibles.
- Depuis l'atelier d'analyse, une partie prenante peut se rattacher à un Tier
  existant ou créer un candidat ; elle conserve exposition/fiabilité/menace
  propres à l'analyse. Une analyse gelée ne peut pas être modifiée par ce flux.
- L'ADMIN/gestionnaire habilité peut approuver un rapprochement, dissocier un
  mauvais lien et proposer une fusion de Tiers avec **aperçu de toutes les
  relations**, audit et confirmation. Pas de suppression automatique. La vue
  lecture seule est disponible aux rôles autorisés sans ouvrir les données
  d'analyses auxquelles ils n'ont pas accès.
- Le périmètre multi-org est explicite : un Tier d'une filiale n'est pas le même
  enregistrement que celui d'une autre. Une vue groupe peut rapprocher ces IDs
  sous autorisation, sans faire pointer un contrat d'une org vers un Tier d'une
  autre org. Toute mutation vérifie que la cible appartient à l'org source.

### B.3 Migration progressive et critères d'acceptation

1. Inventorier, **sans modifier**, les groupes de noms et identifiants, y
   compris contrats TIC sans partie prenante et parties prenantes sans TIC.
2. Introduire Tier et liens nullable avec contraintes d'organisation, index et
   migration. Préparer des candidats de rapprochement avec degré de confiance,
   **sans fusion automatique**. Basculer les vues sur les liens confirmés ; pour
   les anciennes lignes non rapprochées, afficher « lien supposé par nom » ou
   « à rapprocher », jamais un badge de certitude.
3. Ajouter sélection de Tier dans les formulaires et imports, puis une file de
   revue des doublons. Préserver les IDs, relations, historiques, exports et
   références contractuelles ; tester sur une copie de base avant généralisation.

Acceptation : un fournisseur présent uniquement dans le registre TIC apparaît
sur `/tiers` ; deux contrats pointent vers **un** Tier ; une partie prenante du
même fournisseur rejoint ce Tier après validation ; ses scores d'analyse ne
modifient ni la criticité ni le questionnaire des contrats. Deux filiales ou
deux personnes morales homonymes restent distinctes. Un lecteur ne voit aucune
analyse hors de son périmètre via le résumé TIC. Les liens erronés sont
dissociables sans perte d'historique.

## 5. Fonctionnalités en développement : écarts vérifiés à prioriser

Inventaire **ciblé**, fondé sur le code et les spécifications au 30 septembre
2026 ; ce n'est ni une promesse de livraison ni une affirmation sur les données
réelles de la base. « Non implémenté » est distingué de « non recetté ».

| Priorité | Fonction / état présent | Manque précis et prochaine preuve |
|---|---|---|
| P0 | Tiers/TIC : jonction en lecture par nom (`tiers-tic-link.ts`). | Identité et lien persistants, TIC-only sur `/tiers`, lien vers chaque arrangement, rapprochement sûr ; vérifier aussi que `consolidatedTiersForOrg` (toutes les analyses de l'org) respecte les droits d'analyse du lecteur de l'API TIC. |
| P0 | Registre : socle FR instancié en un bloc (`registre-catalogue.ts`, `seed-defaut`). | Sélection et aperçu, version/provenance, i18n ×5, packs sectoriels, idempotence par clé stable ; recette d'import concurrent sur vraie DB et diagnostic des doublons historiques de publication avant contrainte UNIQUE. |
| P0 | Processus : CRUD et hiérarchie (`ProcessusManager`, `/api/processus`). | Bibliothèque transversale/sectorielle, import CSV/XLSX avec mapping et contrôle des parents/cycles ; secteur d'organisation configurable. |
| P1 | Catalogues contrôles/audit, socle RoPA et gabarits disponibles. | Parcours de suggestions cohérent, provenance/version et traduction du contenu ; revue métier/juridique des champs présumés et des terminologies normatives avant diffusion. |
| P1 | RAS/RAD `/appetence` livré (backlog `CHANTIERS-EN-COURS.md`). | Export PDF de la vue et tendances ; test sur données historiques réelles. |
| P1 | Tests de résilience livrés (même backlog). | Constats reliés au plan d'action unifié et pièces de preuve ; recette des permissions. |
| P1 | Import universel v3 et API v2 partielle (`import-universel-chantiers-a-venir.md`). | Fichier + profil via API, état par ligne, lien biens supports ↔ valeurs métier, avertissement si champ calculé du fichier diverge ; tests IDOR/gel/volumétrie indiqués dans HANDOFF. |
| P1 | MCP propositions phases 1–4b livrées (backlog). | Traitement de conformité, recommandation de scénarios et intake assisté ; tests IDOR MCP étendus. Rien ne doit écrire sans validation humaine. |
| P2 | Analyse projet 360 livrée (backlog). | Rapport PDF/Excel par domaine et agrégation multi-projets. |
| P2 | CAF : profils de maturité opérationnelle (`profils-operationnels-us-uk.md`). | Cibles « résultats attendus » Basic/Enhanced à sourcer officiellement et valider. |
| P2 | SAML en mode maintenance (`sso-oidc.md`, routes SAML). | AuthnRequest/signatures et recette avec IdP ; ne pas l'annoncer comme fonctionnel. |
| Vérification | Plusieurs fonctions récentes sont testées unitairement. | Recette sur vraie base et navigateur encore à effectuer pour les parcours explicitement signalés dans HANDOFF/CHANTIERS ; ne pas confondre absence de recette et absence de code. |

## 6. Découpage recommandé

1. **Lot 1 — socle utilisable** : aperçus/sélection des risques existants +
   processus transversaux et import guidé ; provenance stable ; aucune donnée
   évaluée fictive. Ce lot ne dépend pas de la refonte des tiers.
2. **Lot 2 — tiers sans doublons** : modèle Tier nullable, inventaire et file de
   rapprochement, pages unifiées, liens confirmés, migrations et tests d'accès.
3. **Lot 3 — extension sectorielle** : packs de processus/risques et raccordement
   des catalogues contrôles/audit/KRI, versionnement, mises à jour en diff.
4. **Lot 4 — backlog adjacent** : traiter séparément les écarts P1/P2 de la table,
   selon la valeur métier et la recette disponible ; ne pas les assimiler au
   périmètre des trois premiers lots.

## 7. Questions de décision

1. Quels secteurs prioriser après le socle transversal ? Une première série
   raisonnable serait finance/assurance, santé, secteur public, SaaS et PME,
   cohérente avec les gabarits existants, mais le contenu métier doit être revu.
2. Qui peut créer/rapprocher l'identité canonique d'un Tier : seulement ADMIN,
   ou aussi un gestionnaire tiers/TIC de 2e ligne ?
3. Pour les grandes organisations, la fiche Tier doit-elle vivre à la filiale
   (recommandé pour l'isolation), avec une vue groupe, ou être unique à toute la
   hiérarchie d'organisations ?
