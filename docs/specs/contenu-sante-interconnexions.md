# Contenu sectoriel — santé, assurance santé / mutuelle, portail de données de santé, interconnexions de SI

Date : 2026-10-03 · Statut : **livré (catalogue 1.12), contenu « à relire par un expert du secteur »**.

## Demande

Compléter un maximum de secteurs et sous-secteurs sur la santé, l'assurance santé, la mutuelle,
les portails d'accès à des données de santé et les interconnexions entre SI (nouvelle catégorie
« technique » : interconnexion avec un prestataire qui livre des données, échange de données
métier), avec des propositions de risques et de plans d'action, d'abord pour l'analyse de risque
puis pour les autres modules, et comparer Opus 5.5 seul à Opus 5.5 contraint par ACRA.

## Livré

### Taxonomie
- Secteur d'analyse **« Technique / Interconnexion de SI »** (avant « Autre », ×5 langues),
  famille `technique` résolue en tête (l'italien « Interconnessione » contient « ess », motif de la
  famille associations).
- Sous-secteurs : `technique-interco-prestataire`, `technique-interco-metier`,
  `technique-api-exposee`, `technique-integration` ; santé : `sante-portail`, `sante-entrepot`,
  `sante-delegataire` (les sous-secteurs santé existants — dont `sante-amc` « complémentaire santé
  (mutuelle, institution de prévoyance, assureur santé) » — sont conservés).

### Analyse de risque (ateliers 1 à 5) — `lib/exemples-sectoriels-ext.ts`
- Nouvelles catégories d'exemples sectoriels : `actionsElementaires` (atelier 4),
  `mesuresEcosysteme` (atelier 3), `mesures` (atelier 5, avec type, catégorie EBIOS, priorité et
  références citées).
- Contenu : santé commune (identitovigilance INS, HDS, CPS/e-CPS, MSSanté, journalisation des
  accès, mode dégradé, vulnérabilités des équipements) ; portail ; entrepôt de données de santé ;
  délégataire de gestion ; complémentaire santé / mutuelle (IBAN, fraude, tiers payant, DORA) ;
  plans de traitement pour tiers payant, e-santé, AMO, hôpital, cabinet ; interconnexions (socle
  commun + 4 sous-secteurs).
- UI : atelier 5 « Mesures proposées pour votre secteur » (ajout en un clic, pré-rempli,
  modifiable ; masqué en lecture seule ; mesures du sous-secteur en tête) ; ateliers 3 et 4 :
  exemples sectoriels en tête des listes ; saisie directe (ISO 27005 / 31000 / NIST) : suggestions
  de risques reprises automatiquement (`suggestRisqueExemples`).
- MCP `read_sector_examples` : nouvelles catégories, `sousSecteursDisponibles` dans la réponse.

### Autres modules — catalogue 1.12 (`lib/sector-packs-sante-technique.ts`)
- Secteur de catalogue **TECHNIQUE** : 5 processus, 13 risques (catégories bâloises), 23
  contrôles-types (11 ancrés sur un texte cité : ISO/IEC 27001:2022, DORA, OWASP API Security
  Top 10 — 2023, RGPD), 9 KRI, 4 missions d'audit, 4 incidents types — atteint le cliquet de
  profondeur (`sector-depth.test.ts`).
- SANTE : processus portail et réutilisation pour la recherche, 6 risques, 7 contrôles, 4 KRI,
  2 missions.
- ASSURANCE (mutuelle santé) : détournement de remboursements par changement d'IBAN, délégation
  de gestion, flux de tiers payant (3 risques, 4 contrôles, 2 KRI).
- Proposés partout où le catalogue l'est déjà (registre, contrôle permanent, KRI, audit,
  incidents types, plan de contrôle type MCP), selon les secteurs choisis par l'organisation.

## Règles respectées
- Aucune cotation, exécution, seuil, date ou constat créés : suggestions à qualifier.
- Références : intitulé + version, jamais de reprise d'exigence ; voir § « À relire ».
- Traductions ×5 dans la donnée (aucun dictionnaire indexé par position pour le nouveau contenu).

## À relire par un expert (non vérifié contre la source officielle dans ce tour)
- Code de la santé publique, art. L. 1111-8 (HDS) et L. 1111-8-1 (INS) : numéros d'articles à
  confirmer sur Légifrance.
- « CNIL — référentiel relatif aux entrepôts de données de santé (2021) » : intitulé exact et date
  à confirmer.
- OWASP API Security Top 10 — 2023 : API1, API3, API4, API9 (repris de mémoire).
- Directive 2009/138/CE art. 49 et règlement délégué (UE) 2015/35 art. 274 (sous-traitance).
- Applicabilité de DORA aux mutuelles hors champ Solvabilité II.

## Pistes non réalisées
- Rattacher une analyse à **deux** familles (ex. santé + interconnexion) : aujourd'hui une analyse
  d'interconnexion d'une mutuelle choisit l'une ou l'autre.
- Questionnaires de contrôle et gabarits de personnalisation propres au secteur TECHNIQUE.
- Télésurveillance médicale : pas de sous-secteur dédié (tâche témoin du comparatif).

Comparatif : [`docs/benchmark/2026-10-03-sante-interco/`](../benchmark/2026-10-03-sante-interco/).
