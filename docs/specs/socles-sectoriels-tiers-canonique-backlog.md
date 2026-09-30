# Expression de besoin — socles sectoriels, tiers uniques et écarts des modules

Statut : cadrage validé, **lot 1 livré** et **lot 2 livré en grande partie** (voir § 8) · mis à jour le 30 septembre 2026

## 1. Décisions de produit recherchées

ACRA doit aider une organisation à démarrer ses modules sans présenter des données
fictives comme des risques évalués, des incidents survenus, des contrats signés ou
des obligations satisfaites. Le meilleur point de départ est un **catalogue de
suggestions sélectionnables et éditables**, composé d'un socle transversal et de
packs sectoriels. Une organisation peut aussi importer ses propres référentiels.

La page Tiers doit devenir la vue d'une **identité de tiers unique au sein d'un
groupe d'organisations**, partagée uniquement avec les filiales explicitement
autorisées. L'écosystème cyber et le registre TIC sont deux vues et deux jeux de
relations sur ce tiers, non deux répertoires indépendants de prestataires.

Décisions confirmées par l'utilisateur : **suggestions à valider avant création**
(aucun préremplissage automatique à la création de l'organisation) ; **socle
transversal d'abord, puis packs sectoriels**. L'identité des tiers au niveau de
groupe avec accès explicite est retenue pour prendre en charge les contrats groupe.
Une filiale ne devient pas bénéficiaire d'un contrat par simple héritage de l'arbre.

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

## 4. Axe B — Tiers, services, contrats groupe et usages

### B.1 Décision de modélisation

Créer un `Tier` **canonique dans le périmètre du groupe**, avec `id` stable, nom
affiché, pays, LEI facultatif et alias documentés. Son statut et les autres
identifiants qualifiés (avec leur type) sont une extension à instruire. Il représente une
**personne morale ou contrepartie identifiée**, pas un service, une marque ou un
contrat. Un fournisseur peut proposer plusieurs offres distinctes de même type.
Un contrat peut couvrir plusieurs offres, et une offre peut être achetée sous
plusieurs contrats. Les occurrences et usages restent séparés :

```text
Groupe ──< Tier (identité de la personne morale, accès org explicite)
            ├──< PartiePrenante (rôle et score dans chaque Analyse)
            └──< TierService (produit/offre du prestataire, type TIC)
                     >──< TierContractService >── ArrangementTic (contrat signé)
                               │                    └──< TierContractBeneficiary (filiale)
                               └──< TierServiceUsage (filiale × processus × cas d'usage)
```

`TierService` est l'offre identifiable du prestataire (« SignNow Signature »),
`typeService` sa **catégorie** (« signature électronique »). `TierServiceUsage` est
le contexte concret (« signature des contrats fournisseurs » pour Achats ou
« signature des contrats de travail » pour RH). Une même offre, ou deux offres
de même catégorie, peuvent ainsi avoir plusieurs usages, processus, entités,
criticités et analyses de risque **sans être dédoublonnées**. Un service peut
aussi être consommé hors contrat recensé : il reste visible « couverture
contractuelle à confirmer », sans inventer un accord.

`ArrangementTic` reste l'accord contractuel et conserve son organisation
porteuse ; `TierContractBeneficiary` indique explicitement chaque filiale couverte
et son état `PROPOSED`, `CONFIRMED` ou `REJECTED`. Le périmètre précis et les dates
de début/fin de couverture restent à ajouter si les cas réels le nécessitent.
Un contrat groupe n'est
donc **pas copié** dans chaque registre filiale : les vues filiales affichent la
même référence de contrat avec leur propre usage. Ajouter des `tierId`
optionnels aux deux objets existants pendant la migration ; garder leurs noms
historiques comme **instantanés**, sans les réécrire lors d'un renommage de Tier.
La criticité contractuelle de l'accord et la criticité métier d'un usage doivent
rester distinctes (champ de criticité d'usage non encore implémenté). Des
filiales juridiquement distinctes ne sont pas fusionnées parce
qu'elles partagent une marque.

Le lien est **explicite et validé** : suggestion de rapprochement par identifiant
stable valide d'abord, puis alias/nom normalisé pour revue humaine. Un nom seul
ne prouve pas l'identité. Si plusieurs candidats existent, afficher leurs
attributs et demander un choix ou la création d'un nouveau Tier. Ne jamais
faire de jointure incertaine passer pour un lien confirmé, notamment dans les
exports ou indicateurs agrégés.

### B.2 Parcours et droits

- Depuis `/registre-tic`, la saisie/import d'un arrangement demande de choisir
  un Tier existant, d'en créer un ou de laisser « à rapprocher » si les données
  sont insuffisantes. On choisit les offres couvertes et les filiales
  bénéficiaires ; une filiale peut ensuite documenter plusieurs cas d'usage de
  la même offre, chacun lié à son processus. Le contrat conserve son propriétaire,
  sa référence et ses champs réglementaires propres. Un lien mène vers la fiche Tier.
- `/tiers` montre **tous** les Tiers du périmètre autorisé : « cyber seulement »,
  « TIC seulement », « cyber + TIC », « à rapprocher ». Chaque fiche liste les
  analyses, services, contrats et usages accessibles avec leurs IDs/liens,
  sans recopier les contrats ni agréger des scores incompatibles.
- Depuis l'atelier d'analyse, une partie prenante peut se rattacher à un Tier
  existant ou créer un candidat ; elle conserve exposition/fiabilité/menace
  propres à l'analyse. Une analyse gelée ne peut pas être modifiée par ce flux.
- L'ADMIN/gestionnaire habilité peut approuver un rapprochement, dissocier un
  mauvais lien et proposer une fusion de Tiers avec **aperçu de toutes les
  relations**, audit et confirmation. Pas de suppression automatique. La vue
  lecture seule est disponible aux rôles autorisés sans ouvrir les données
  d'analyses auxquelles ils n'ont pas accès.
- Le périmètre multi-org est explicite : un Tier commun garde le même ID dans
  le groupe, mais une filiale ne voit que les fiches/contrats/services pour
  lesquels elle a un droit explicite. Un contrat groupe n'accorde aucun accès
  automatique à toutes les filiales. Un usage ne peut référencer qu'un processus
  de son organisation et un contrat qui la couvre ; une mutation vérifie ces
  relations côté serveur et en transaction. Aucune donnée d'une filiale n'est
  révélée à une autre par les agrégats ou l'autocomplétion.

### B.3 Migration progressive et critères d'acceptation

État de la première tranche technique (30/09/2026) : schéma additif et migration
préparés, règles pures testées, routes de proposition/confirmation/refus des
bénéficiaires et de création d'usage par cas métier. La confirmation accorde
l'accès explicite au Tier. **Pas encore d'écran de saisie**, de liste des
propositions reçues, de création/rapprochement de Tier et de ses offres, ni de
recette sur PostgreSQL : la migration n'a pas été appliquée localement (Docker
indisponible). Les critères ci-dessous restent donc des critères **cibles**, pas
des fonctionnalités toutes livrées.

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
modifient ni la criticité ni le questionnaire des contrats. Un contrat groupe
est visible par deux filiales explicitement bénéficiaires sans duplication ; une
troisième ne le voit pas. La même offre de signature électronique peut être
utilisée par Achats et RH dans deux processus et cas d'usage distincts ; deux
offres d'hébergement de même type restent deux offres distinctes. Un usage
hors couverture contractuelle est signalé, non rattaché artificiellement. Deux
personnes morales homonymes restent distinctes. Un lecteur ne voit aucune
analyse hors de son périmètre via le résumé TIC. Les liens erronés sont
dissociables sans perte d'historique.

## 5. Fonctionnalités en développement : écarts vérifiés à prioriser

Inventaire **ciblé**, fondé sur le code et les spécifications au 30 septembre
2026 ; ce n'est ni une promesse de livraison ni une affirmation sur les données
réelles de la base. « Non implémenté » est distingué de « non recetté ».

| Priorité | Fonction / état présent | Manque précis et prochaine preuve |
|---|---|---|
| P0 | Tiers/TIC : jonction en lecture par nom (`tiers-tic-link.ts`). | Identité et lien persistants, offres de services, contrats groupe avec bénéficiaires explicites, usages par filiale/processus/cas, TIC-only sur `/tiers`, rapprochement sûr ; vérifier aussi que `consolidatedTiersForOrg` (toutes les analyses de l'org) respecte les droits d'analyse du lecteur de l'API TIC. |
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
2. **Lot 2 — tiers sans doublons** : modèle Tier partagé au niveau groupe mais
   droits explicites, offres, couverture contractuelle des filiales et usages
   par processus, inventaire/file de rapprochement, migrations et tests d'accès.
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
3. **Décision actée** : l'ADMIN du groupe propose la qualité de bénéficiaire
   d'un contrat groupe ; un ADMIN directement membre de la filiale confirme ou
   refuse. Avant confirmation, le contrat ne donne aucun accès à la filiale.

## 8. Avancement et écarts constatés (recette du 30 septembre 2026)

### 8.1 Lot 1 — socle utilisable : livré et recetté sur PostgreSQL

| Exigence (§ A) | État | Preuve |
|---|---|---|
| Secteurs de l'organisation (A.1 pt 1) | **Livré** : jusqu'à trois secteurs, le premier est le principal, écran dans /configuration › « Référentiels et options » (ADMIN), `GET/PUT /api/catalogue-suggestions/sectors`. | Recette navigateur + base : `["SAAS","SANTE"]` enregistré, le secteur principal est proposé par défaut. |
| Suggestions sélectionnables, sans création automatique (A.1 pt 2-3, A.2) | **Livré** pour *processus* et *registre des risques* (8 secteurs + socle transversal, libellés ×5). Aperçu sans écriture, « déjà importé », sélection, avertissement si le processus parent n'est pas sélectionné (import sans lien, jamais de lien inventé). | 2 processus puis 1 risque créés ; `statut = IDENTIFIE`, **aucune cotation** ; 2ᵉ ouverture : lignes déjà importées non sélectionnables. |
| Provenance stable et idempotence (A.3) | **Livré** : `catalogueKey` + `catalogueVersion`, index unique `(organisation, clé)`, verrou consultatif transactionnel. | Clés `core.process.govern`, `core.risk.ransomware` en base. |
| **Import de fichier de processus** (A.1 pt 4, A.4 critère 3) | **Livré** : CSV/XLSX, aperçu ligne à ligne, parents par référence ou par nom, parent introuvable / ambigu, cycle, auto-parentage, doublon de référence, nom manquant ou trop long ; lignes valides importables ; doublon de nom = *possible* à confirmer (jamais de fusion) ; clé d'origine `import:<réf>` ⇒ réimport idempotent, liens et noms saisis conservés. | Fichier de 8 lignes : 3 créées avec hiérarchie, 4 rejetées expliquées, 1 vide ignorée ; réimport : 3 « déjà importées », 0 créée. |
| Autres modules (contrôles, audit, KRI, incidents, RoPA, registre TIC — A.2) | **Non fait** (lot 3). | — |
| Diff de version d'un pack (A.1 pt 5) | **Non fait** : seule la version (`1.0`) est tracée. | — |

**Décisions prises pendant la mise en œuvre** (à confirmer) :
1. La création de **processus** reste réservée aux ADMIN de l'organisation (comme le CRUD existant) ; les suggestions de **risques** sont ouvertes aux rôles d'écriture du registre.
2. Un fichier de processus peut porter sa propre référence ; sans référence, seule la règle « même nom sous le même parent » signale un doublon possible.
3. L'import de fichier ne crée ni criticité, ni RTO/RPO, ni propriétaire inventé : seuls nom, description et propriétaire **du fichier** sont repris.
4. Limites : 500 lignes par fichier, débit partagé avec les imports Excel (30 / 10 min).

### 8.2 Écarts à traiter

- **Incohérence de droits sur /configuration** : la page décide `isAdmin` d'après le rôle *de session* (`session.user.role`), alors que les API d'écriture (secteurs, processus) utilisent le rôle *effectif dans l'organisation active*. Un ADMIN d'organisation au rôle global « analyste » ne voit pas l'onglet d'options. À harmoniser (rôle effectif partout) avec un test d'accès.
- **Contenu du catalogue** : 4 processus et 5 risques par secteur, titres seuls. Il faut des descriptions indicatives, plus d'événements-types et une **revue métier** par secteur avant diffusion (questions 1 de § 7).
- **Niveaux d'arbre** : les suggestions de processus n'ont qu'un niveau de parent (`core.process.*`) ; prévoir des sous-processus.
- **Lot 2** : écrans Tiers / offres / contrats / usages, liste des propositions de bénéficiaires, rapprochement et recette PostgreSQL restent à faire (§ B.3).

### 8.3 Lot 2 — tiers canoniques : première tranche livrée et recettée (30/09/2026)

| Exigence (§ B) | État | Preuve |
|---|---|---|
| Identité de tiers créable, sans doublon silencieux (B.1) | **Livré** : `POST /api/tier-registry` (ADMIN ou 2ᵉ ligne : `peutGererRegistreTic`), racine du groupe d'après le chemin de l'organisation, accès explicite accordé à l'organisation active, LEI normalisé, alias. Candidat existant (LEI identique = *fort* ; nom ou alias identique, forme juridique ignorée = *faible*) ⇒ 409 avec candidats ; création seulement avec confirmation. Un LEI déjà connu dans le groupe mais non autorisé pour l'organisation ⇒ 409 **sans rien révéler**. | Tests routes (9) + moteur (9) ; recette base : `Acme Logiciels`, LEI normalisé, `rootOrganizationId` = racine, accès `TierOrganization`. |
| `/tiers` montre les tiers TIC seulement / cyber seulement / les deux (acceptation B.3) | **Livré** : panneau « Identités de tiers » sur `/tiers` avec couverture, LEI, références d'arrangements, nombre d'analyses **accessibles à l'utilisateur**. | Recette : un tiers lié uniquement à des arrangements apparaît « TIC seulement ». |
| Rapprochement sûr (B.1, B.3 pt 2) | **Livré** pour les **arrangements TIC** : file « à rapprocher » avec candidats et raison affichée ; lien posé au clic seulement (`POST /api/tier-registry/link`), tiers doit être autorisé pour l'organisation de l'arrangement, détachement possible, nom historique du prestataire conservé (instantané), journal d'audit. | Recette : C-1 → création d'identité ; C-2 (« ACME LOGICIELS SAS ») proposé « nom identique », non lié avant clic, lié après ; nom conservé. |
| Lecture seule pour les rôles non habilités (B.2) | **Livré** : liste visible, aucune action. | Recette navigateur (rôle analyste). |
| Parties prenantes d'analyse rattachées à un tiers (B.2) | **Non fait** : rattachement depuis l'atelier (analyse non gelée) et file de doublons côté écosystème. | — |
| Sélecteur de tiers dans la saisie / l'import du registre TIC (B.2) | **Non fait** (le rapprochement se fait depuis `/tiers`). | — |
| Offres (`TierService`), contrats groupe / bénéficiaires, usages : **écrans** | **Non fait** : schéma, règles et routes de Codex existent, sans interface ni liste des propositions reçues. | — |
| Fusion de tiers avec aperçu de toutes les relations | **Non fait**. | — |

**Décisions prises** (à confirmer — cf. question 2 de § 7) : la création et le rapprochement d'identités sont ouverts à l'ADMIN **et** aux rôles de 2ᵉ ligne du registre TIC (RSSI, risk manager, conformité, DPO), comme la tenue du registre ; un simple analyste lit seulement. Les alias ne sont pas encore saisissables dans l'interface (champ géré côté API).

### 8.4 Lot 2 — tranche 2 : offres, couverture, usages, propositions de bénéficiaires (recettée)

| Exigence (§ B) | État | Preuve |
|---|---|---|
| Offres d'un prestataire, plusieurs de même catégorie (B.1) | **Livré** : ajout (ADMIN / 2ᵉ ligne), renommage, désactivation (jamais de suppression : usages et contrats y restent rattachés) ; la catégorie TIC n'est qu'un attribut. | Recette : « SignNow Signature » et « SignNow Archivage », même catégorie, deux offres distinctes. |
| Couverture contrat ↔ offres (B.1) | **Livré** : un contrat *de l'organisation* couvre un sous-ensemble d'offres **du tiers du contrat** ; retrait refusé (409) tant que des usages s'y appuient. | Tests routes + recette. |
| Usages par filiale / processus / cas (B.1, acceptation B.3) | **Livré** : liste par offre pour **l'organisation active seulement**, ajout (ADMIN, route de Codex), suppression ; couverture **confirmée** (contrat de l'organisation ou contrat groupe dont elle est bénéficiaire *confirmée*) ou **« à confirmer »** (hors contrat recensé, jamais rattaché artificiellement). | Recette : Achats (groupe) et RH (filiale) sur la même offre ; usage hors contrat signalé. |
| Contrat groupe : proposition → confirmation (B.2, décision actée § 7.3) | **Livré** : les propositions reçues apparaissent sur `/tiers` ; **aucun accès avant confirmation** (le tiers reste invisible, 404) ; confirmation par l'ADMIN de la filiale accorde l'accès explicite au tiers ; refus possible. | Recette groupe + 2 filiales : avant confirmation 404 et aucun `TierOrganization` ; après : accès. |
| Isolation (acceptation B.3) | **Vérifié** : la filiale ne voit que ses usages, pas ceux du groupe ; une 3ᵉ organisation non bénéficiaire n'accède ni au tiers ni à un usage sous contrat (403 `service_not_accessible`). | Recette navigateur + base. |

**Décisions** : les usages restent créés/supprimés par l'**ADMIN** de l'organisation concernée (règle de Codex), les offres et couvertures par l'ADMIN **ou** la 2ᵉ ligne ; un contrat groupe n'est modifiable que par son organisation porteuse, les bénéficiaires le consultent en lecture seule.

**Reste (lot 2)** : proposer les bénéficiaires depuis l'interface (aujourd'hui la route existe, sans écran côté groupe) ; rattacher les **parties prenantes** d'analyse à un tiers (atelier 3, analyse non gelée) ; **sélecteur de tiers** à la saisie/import d'un arrangement TIC ; **fusion** de tiers avec aperçu des relations ; criticité d'usage et dates/périmètre de couverture (à instruire selon les cas réels).
