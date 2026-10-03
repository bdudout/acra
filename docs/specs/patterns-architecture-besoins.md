# Patterns d'architecture de SI — expression de besoins

**Statut :** livré — lots A1 à A6 (décisions D1–D5 prises le 2026-10-03) · **Date :** 2026-10-03
**Périmètre :** analyses de risques (toutes méthodes) et projets 360

## 1. Constat

Aujourd'hui, une analyse ou un projet 360 est contextualisé par un **secteur** et un ou
plusieurs **sous-secteurs** (jusqu'à 4). Ces choix pilotent les exemples proposés
(valeurs métier, biens supports, sources de risque, scénarios, mesures…) et les
suggestions du catalogue.

Le secteur est une **vision métier** (« que fait l'organisation ? »). Il ne dit rien de
la **forme technique** du système étudié : un même service d'assurance santé peut
être un portail exposé sur Internet, un traitement par lots interne au datacenter ou
une interconnexion avec un délégataire. Or la forme technique détermine une grande
partie des biens supports, des chemins d'attaque et des mesures.

Le secteur « Technique / Interconnexion de SI », ajouté à la version 1.13 du
catalogue, mélange les deux visions : c'est une **typologie technique rangée parmi
les secteurs métier**. Elle oblige à choisir entre « je suis une mutuelle » et « j'ai
une interconnexion » (le sous-secteur transverse atténue le problème sans le
résoudre), et elle ne couvre que les interconnexions.

## 2. Besoin

Pouvoir qualifier une analyse ou un projet 360 par un ou plusieurs **patterns
d'architecture de SI**, au moyen de **cases à cocher**, **indépendamment du secteur**.
Les patterns cochés **complètent** les exemples par défaut et les suggestions, en plus
de ceux du secteur et des sous-secteurs.

> Secteur et sous-secteurs = vision métier.
> Patterns d'architecture = vision technique.
> Les deux se combinent ; aucun ne remplace l'autre.

## 3. Proposition de patterns

25 patterns en 5 familles. La liste couvre les exemples demandés (repérés ★) et
ajoute ceux qui reviennent le plus souvent dans les analyses.
**Lot 1** = socle recommandé pour la première livraison.

### 3.1 Exposition et zones de sécurité

| Code | Libellé | Ce que ça couvre | Lot |
|---|---|---|---|
| `EXPOSITION_INTERNET` ★ | Exposition sur Internet | site, portail, téléservice, API publique joignables depuis Internet | 1 |
| `DMZ` ★ | Zone démilitarisée (DMZ) | frontaux, reverse proxy, relais, filtrage entre Internet et le SI interne | 1 |
| `ZONE_CONFIANCE` ★ | Zone de confiance | cœur de SI hébergeant les données et traitements les plus sensibles, accès restreint | 1 |
| `ZONE_MOINDRE_CONFIANCE` ★ | Zone de moindre confiance | réseau invités, BYOD, laboratoire, partenaires sur site, équipements non maîtrisés | 1 |
| `ACCES_DISTANT` | Accès distant des utilisateurs | télétravail, VPN, accès « zero trust », nomadisme | 1 |
| `APPLICATIONS_MOBILES` | Applications et terminaux mobiles | application grand public, flotte de terminaux, MDM | 2 |

### 3.2 Interconnexions, tiers et externalisation

| Code | Libellé | Ce que ça couvre | Lot |
|---|---|---|---|
| `INTERCO_TIERS` ★ | Interconnexion avec un tiers | flux réseau ou applicatifs avec un partenaire, une filiale, un délégataire (entrants et sortants) | 1 |
| `API_PARTENAIRES` | API exposées à des partenaires | API authentifiées pour clients ou partenaires, passerelle d'API | 1 |
| `ECHANGE_FICHIERS` | Transfert de fichiers et intégration | MFT, SFTP, bus, ETL, traitements par lots inter-SI | 1 |
| `EXTERNALISATION_DONNEES` ★ | Externalisation avec échange de données | infogérance, sous-traitance d'un processus, prestataire qui reçoit ou livre des données | 1 |
| `TELEMAINTENANCE` ★ | Télémaintenance | intervention à distance d'un éditeur, d'un constructeur ou d'un prestataire | 1 |
| `CLOUD_SAAS` | Services en ligne (SaaS) | messagerie, collaboratif, applications métier en ligne | 2 |
| `CLOUD_IAAS_PAAS` | Hébergement en nuage (IaaS / PaaS) | infrastructure ou plateforme chez un fournisseur de nuage | 2 |

### 3.3 Administration et exploitation

| Code | Libellé | Ce que ça couvre | Lot |
|---|---|---|---|
| `SI_STANDARD` | SI standard | système courant sans exposition, nuage, interconnexion ni contrainte particulière déclarée ; repli à choisir explicitement | 1 |
| `SI_ADMINISTRATION` ★ | Système d'administration | bastion, postes d'administration dédiés, annuaire, outils de déploiement, comptes à privilèges | 1 |
| `FLUX_INTERNES_DC` ★ | Flux internes au datacenter | flux « est-ouest » entre serveurs, segmentation, micro-segmentation | 1 |
| `SAUVEGARDE` | Infrastructure de sauvegarde | sauvegardes, copies hors ligne, restauration | 2 |
| `SUPERVISION` | Journalisation et supervision | collecte des journaux, SIEM, SOC interne ou externalisé | 2 |

### 3.4 Postes et usages

| Code | Libellé | Ce que ça couvre | Lot |
|---|---|---|---|
| `BUREAUTIQUE` ★ | SI bureautique | postes de travail, messagerie, partage de fichiers, impression | 1 |
| `SI_TPE` ★ | SI de très petite entreprise | peu ou pas de compétence interne, box internet, NAS, prestataire unique, comptes partagés | 1 |
| `IA_SERVICES` | Usage de services d'IA | assistants, IA générative, modèles hébergés ou en ligne | 2 |

### 3.5 Sensibilité et systèmes particuliers

| Code | Libellé | Ce que ça couvre | Lot |
|---|---|---|---|
| `SI_SENSIBLE` ★ | SI sensible | SI traitant des informations sensibles, soumis à homologation renforcée, cloisonné | 1 |
| `SI_ISOLE` | SI isolé ou déconnecté | réseau sans lien avec Internet, échanges par support amovible ou passerelle | 2 |
| `SI_INDUSTRIEL` | Systèmes industriels et objets connectés | automates, supervision industrielle, IoT, systèmes embarqués | 2 |
| `SI_PATRIMONIAL` | Patrimoine applicatif ancien | grands systèmes, applications obsolètes, systèmes hors support | 2 |

Les libellés seront traduits dans les 5 langues. Les intitulés qui reprennent une
terminologie officielle (« SI sensible », administration sécurisée, cloisonnement)
s'alignent sur les guides publiés de l'ANSSI, dont la **version sera citée** dans les
specs, après vérification sur la source officielle.

## 4. Exigences fonctionnelles

### BE-1 — Sélection par cases à cocher
- Présente à la **création** et à la **modification** des métadonnées d'une analyse,
  pour **toutes les méthodes**, y compris les projets 360.
- Cases regroupées par famille (§ 3), chaque pattern accompagné d'une aide courte
  (définition, exemple).
- **Obligatoire à la création** : au moins un pattern doit être choisi. Lorsque
  aucune caractéristique particulière ne s'applique, l'utilisateur choisit
  explicitement `SI_STANDARD`. La modification reste possible sans rétroactivité
  sur les analyses existantes et les imports historiques.
- Plafond **configurable** (décision D4) : défaut **12**, réglé par l'administrateur de
  l'organisation dans `/configuration` (borné de 1 à 25, hérité dans l'arbre
  multi-organisation). Une architecture réelle combine souvent 4 à 8 patterns.

### BE-2 — Indépendance vis-à-vis du secteur
- Les patterns sont proposés **quel que soit le secteur**, y compris « Autre » ou sans
  secteur.
- Changer de secteur ne modifie pas les patterns cochés (contrairement aux
  sous-secteurs, purgés s'ils deviennent incohérents).

### BE-3 — Exemples par défaut complétés
- Pour chaque catégorie d'exemples (valeurs métier, biens supports, événements
  redoutés, sources de risque et objectifs visés, parties prenantes, scénarios
  stratégiques et opérationnels, actions élémentaires, mesures), la liste proposée
  devient l'**union** : sous-secteurs + **patterns cochés** + socle du secteur.
- Ordre : éléments propres aux sous-secteurs, puis aux patterns, puis socle commun ;
  sans doublon.
- **Rien n'est affiché pour un pattern non coché** (même règle de cohérence que pour
  les sous-secteurs).
- Les suggestions de risques en saisie directe (ISO 27005, NIST, ISO 31000, projet 360)
  suivent la même union.

### BE-4 — Contenu générique, variantes sectorielles possibles
- Le contenu d'un pattern est formulé de façon **générique** (valable pour tout
  secteur).
- Un élément peut être restreint ou adapté à un secteur quand c'est pertinent (par
  exemple la télémaintenance d'équipements biomédicaux en santé), avec le mécanisme de
  cohérence déjà en place pour les sous-secteurs.

### BE-5 — Combinaisons de patterns
Certains risques n'apparaissent qu'en combinaison. Le contenu peut être conditionné à
**plusieurs** patterns cochés, par exemple :
- `EXPOSITION_INTERNET` + `SI_SENSIBLE` → passerelle d'échange maîtrisée, cloisonnement
  renforcé ;
- `TELEMAINTENANCE` + `SI_INDUSTRIEL` → prise de main à distance sur des automates ;
- `SI_TPE` + `EXTERNALISATION_DONNEES` → dépendance à un prestataire unique sans
  réversibilité.

### BE-6 — Projets 360 et questionnaire de qualification
- Les patterns cochés **pré-remplissent** les réponses correspondantes du questionnaire
  de qualification (par exemple `EXPOSITION_INTERNET` → « exposition à Internet : oui »,
  `INTERCO_TIERS` / `EXTERNALISATION_DONNEES` → questions tiers et externalisation),
  sans écraser une réponse déjà donnée.
- Dans un projet 360, les risques proposés par les patterns sont classés dans les
  domaines `IT`, `CYBER` ou `OUTSOURCING`.

### BE-7 — Catalogue
- Les contrôles, indicateurs (KRI) et audits du catalogue peuvent être rattachés à des
  patterns, pour être recommandés quand le pattern est coché.
- Le contenu des patterns est **versionné** avec le catalogue (journal des
  modifications), comme les packs sectoriels, et soumis à un **plancher de
  profondeur** testé (nombre minimal d'éléments par pattern du lot 1).

### BE-8 — Assistant et serveur MCP
- Les outils de lecture d'exemples et de recommandation acceptent les patterns, en plus
  du secteur et des sous-secteurs.
- Les consignes de l'assistant précisent la distinction métier / technique.

### BE-9 — Import, export, rapports
- Les patterns figurent dans les exports (JSON, tableur, rapport) et sont reconnus par
  l'import universel (colonne « patterns d'architecture », codes ou libellés).
- La vue portefeuille des analyses permet de **filtrer par pattern** (par exemple :
  toutes les analyses qui comportent de la télémaintenance).

### BE-10 — Devenir du secteur « Technique / Interconnexion de SI »
- Les 4 sous-secteurs techniques deviennent des patterns :

  | Sous-secteur actuel | Pattern |
  |---|---|
  | `technique-interco-prestataire` | `EXTERNALISATION_DONNEES` + `INTERCO_TIERS` |
  | `technique-interco-metier` | `INTERCO_TIERS` |
  | `technique-api-exposee` | `API_PARTENAIRES` |
  | `technique-integration` | `ECHANGE_FICHIERS` |

- Leur contenu (exemples et pack catalogue) est **repris** dans ces patterns, pas
  perdu.
- **Pas de rétrocompatibilité à assurer** (décision D1 : aucun client en production) :
  le secteur « Technique / Interconnexion de SI » et ses 4 sous-secteurs sont
  **supprimés** de la taxonomie, des familles d'exemples et du catalogue sectoriel (le
  contenu est déplacé vers les patterns, pas dupliqué). Les données de démonstration ou
  de recette qui les portent sont converties en patterns par la migration de données du
  lot, ou simplement recréées.
- Les sous-secteurs transverses proposés à tous les secteurs (interconnexions) cessent
  d'exister : ce rôle est tenu par les patterns.

### BE-11 — Personnalisation par l'organisation (lot ultérieur, décision D3)
- L'administrateur de l'organisation peut **masquer** des patterns non pertinents pour
  elle (par exemple `SI_INDUSTRIEL` pour une organisation sans système industriel).
  Pas d'activation de module : la fonctionnalité est disponible pour tous.

## 5. Exigences non fonctionnelles

- **i18n** : libellés, aides et contenu dans les 5 langues (fr, en, de, es, it).
- **Données** : un champ liste de codes stables sur l'analyse (`patternsArchi`, sans
  accent), migration **additive** uniquement (défaut : liste vide).
- **Codes stables** : un code de pattern ne change jamais ; un pattern retiré reste lu.
- **Configuration** : plafond de sélection dans `OrganizationConfig` (`patternsArchiMax`,
  défaut 12, borné 1–25), lu par la résolution de configuration habituelle.
- **Validation** : codes inconnus ignorés à l'enregistrement, doublons retirés.
- **Tests** : fonctions de résolution pures et testées (union, ordre, combinaisons,
  pré-remplissage sans écrasement, plafond configurable), plancher de profondeur du contenu, composant de
  sélection.
- **Performance** : la résolution des exemples reste en mémoire, sans requête
  supplémentaire.

## 6. Critères d'acceptation

1. Une mutuelle qui coche `EXPOSITION_INTERNET` et `INTERCO_TIERS` voit, dans les
   biens supports et les mesures, à la fois son contenu mutuelle et le contenu propre à
   ces deux patterns, sans doublon.
2. Une nouvelle analyse requiert au moins un pattern ; `SI_STANDARD` fournit le
   comportement de repli quand aucune caractéristique particulière ne s'applique.
3. Le secteur « Technique / Interconnexion de SI » n'est plus proposé ; le contenu
   d'interconnexion qu'il portait apparaît en cochant `INTERCO_TIERS`,
   `EXTERNALISATION_DONNEES`, `API_PARTENAIRES` ou `ECHANGE_FICHIERS`.
4. Un projet 360 qui coche `EXPOSITION_INTERNET` trouve la question d'exposition à
   Internet pré-remplie à « oui » ; si la question avait déjà reçu « non », elle reste à
   « non ».
7. Avec un plafond réglé à 6 par l'administrateur, une 7ᵉ case ne peut pas être cochée
   (et l'API refuse une liste plus longue).
5. Le contenu d'une combinaison (`TELEMAINTENANCE` + `SI_INDUSTRIEL`) n'apparaît que si
   les deux sont cochés.
6. Les patterns sont visibles dans l'export et filtrables dans le portefeuille.

## 7. Décisions (prises le 2026-10-03)

| # | Question | Décision |
|---|---|---|
| D1 | Retirer le secteur « Technique » ? | **Oui, et sans conserver l'existant** (pas de client en production) : suppression du secteur et de ses sous-secteurs, contenu déplacé vers les patterns. |
| D2 | Liste du lot 1 | **Validée** : les 17 patterns marqués « Lot 1 » (dont les 12 demandés). |
| D3 | Masquage par organisation (BE-11) | **Oui, plus tard** (lot A6). |
| D4 | Plafond de patterns cochés | **12 par défaut, configurable** par l'administrateur de l'organisation (1–25). |
| D6 | Cadrage obligatoire à la création | **Secteur et au moins un pattern** ; `SI_STANDARD` est le repli explicite et reste visible même si l'organisation masque ce pattern. |
| D5 | Pré-remplissage du questionnaire (BE-6) | **Oui, sans jamais écraser une réponse saisie.** |

## 8. Découpage proposé

| Lot | Contenu |
|---|---|
| A1 | Référentiel des patterns (codes, familles, libellés ×5), champ `patternsArchi`, plafond configurable `patternsArchiMax`, sélection par cases à cocher (création, métadonnées, projets 360), API, export |
| A2 | Moteur d'exemples : union sous-secteurs + patterns + socle, ordre, combinaisons ; suggestions de risques |
| A3 | Contenu du lot 1 : exemples par pattern (toutes catégories, ×5 langues), plancher de profondeur testé |
| A4 | Suppression du secteur Technique : contenu déplacé vers les patterns, taxonomie et catalogue nettoyés, tests existants adaptés |
| A5 | Catalogue (contrôles, KRI, audits par pattern, version de catalogue), questionnaire 360 pré-rempli, MCP et assistant |
| A6 | Portefeuille filtrable, import universel, contenu du lot 2, masquage par organisation |
