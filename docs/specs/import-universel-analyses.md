# Expression de besoin — Import universel d'analyses de risques (Excel / CSV / JSON)

> Statut : **besoin à valider** (aucun code livré par ce document). Il **complète** la
> [définition de besoin de l'import historique](import-analyses-historiques.md) (lots 1 à 4 livrés) ;
> il ne la remplace pas. Déclencheur : l'analyse du classeur client
> « Dossier de sécurité_exemple.xlsx » (analyse EBIOS RM complète, 15 feuilles, format « dossier de
> sécurité » de type administration / MCAS), le 2026-09-29.
>
> Règle de projet : ce document décrit des **besoins**. Aucun libellé réglementaire n'y est traduit
> (cf. `CLAUDE.md`) ; les intitulés du classeur (SR/OV, PACS, ER…) sont cités tels que sources.

---

## 1. Contexte et déclencheur

Le classeur fourni n'est ni un registre de risques ni un export GRC : c'est un **dossier d'analyse
EBIOS RM rédigé à la main dans Excel**, dont la structure suit les cinq ateliers (cadrage et socle,
sources de risque, scénarios stratégiques, scénarios opérationnels, traitement). Il représente le
cas le plus exigeant que rencontrera l'outil d'import : plusieurs feuilles reliées par des
références, des en-têtes sur deux niveaux, des cellules fusionnées, des formules, des listes de
références dans une cellule, des libellés d'échelle (« 3 - Elevé »), des blocs de texte libre.

L'outil actuel (`/analyses` → « Importer » → Excel historique) sait importer **des risques, des
vulnérabilités, des mesures, des plans d'action et des liens**. Or ACRA porte un modèle EBIOS RM
complet (Cadrage, valeurs métier, biens supports, événements redoutés, sources de risque, parties
prenantes, scénarios stratégiques et opérationnels, risques à trois cotations, mesures). L'import ne
sait aujourd'hui alimenter que la dernière partie de ce modèle.

**Objectif de ce besoin** : faire évoluer l'import pour qu'il reprenne ce type de dossier **et**
reste un outil **versatile**, capable de coller à *n'importe quelle* analyse de risques fournie en
Excel (`.xlsx`), CSV ou JSON, sans développement spécifique par client.

## 2. Analyse du classeur exemple

Fichier : 2,2 Mo, 15 feuilles, tout en français, marqué « Confidentiel » (valeurs anonymisées
`XXX`). Les volumes ci-dessous sont les lignes réellement renseignées.

| # | Feuille | Nature | Structure | Volume utile | Particularités qui comptent pour l'import |
|---|---|---|---|---|---|
| 1 | Page de garde | Métadonnées du document | **Blocs clé/valeur** (libellé en B, valeur en C:D fusionnées) + 2 tableaux (destinataires, versions) | ~30 champs | 31 fusions ; rédacteur / contrôleur / approbateur + dates ; nom de projet, MOA/MOE ; **formule cassée** (`#REF!`) |
| 2 | Sommaire | Navigation | Tableau de liens | — | À **ignorer** (aucune donnée d'analyse) |
| 3 | Métriques | **Échelles et tables de calcul** | ~12 mini-tableaux côte à côte (colonnes B à CM), en-têtes sur 2 niveaux | 12 lignes × 92 colonnes | Gravité 4 niveaux avec 5 catégories d'impact ; vraisemblance 4 niveaux ; probabilité et facilité d'exploitation 5 niveaux ; matrice de risque ; pertinence SR/OV ; zones de menace ; statuts, priorités P0–P3, avancement en % |
| 4 | 1 - Périmètre | Texte libre | 4 blocs « titre : texte » + schéma | 4 blocs | **81 927 cellules** formatées vides (149 lignes × 16 384 colonnes) : piège de performance |
| 5 | 1 - SROV | Couples source de risque / objectif visé | Tableau, **bandeau de groupes** au-dessus des en-têtes (Identification / Cotation / Commentaires) | 20 couples | Symboles `+ + +` pour motivation et ressources ; **pertinence = formule** croisant la feuille Métriques ; « Retenu ? » Oui/Non ; sources répétées sur plusieurs lignes |
| 6 | 1 - Valeurs Métiers | Valeurs métier | Tableau, **en-tête sur 2 niveaux** (Besoins de sécurité → D / I / C / justification) | 6 renseignées sur 10 références pré-numérotées | Lignes modèles vides (`VM_07` à `VM_10` : une référence, rien d'autre) |
| 7 | 1 - Événements redoutés | Événements redoutés | Tableau | 8 | Gravité `2 - Limitée` ; **liste de références** de valeurs métier dans une cellule (`VM02, VM03, VM04`) alors que les références sont écrites `VM_02` ailleurs |
| 8 | 2 - Biens supports | Catalogue de biens supports | Tableau avec **sous-catégorie répétée** en colonne A et intertitres de catégories | 73 biens (14 « Oui », 59 « Non ») | Catalogue pré-rempli : l'utilisateur ne retient que quelques biens (`Retenu` Oui/Non/Peut-être) |
| 9 | 2 - Parties prenantes | Parties prenantes | Tableau | 32 parties prenantes (31 renseignées) | Exposition, niveau SSI, niveau de menace, zone = **formules** ; **71 formules sans valeur en cache** (résultat perdu à la lecture) ; certaines lignes « N/A » |
| 10 | 2 - Socle de sécurité | Exigences du socle (PSSI) | Tableau, catégories fermées (Gouvernance, Protection, Défense, Résilience) | 184 exigences | Colonne « Exigence » (référence) **vide** : seul le texte identifie la ligne ; couverture projet / transverse ; 11 colonnes |
| 11 | 3 - S.Stratégiques | Scénarios stratégiques | Tableau | 10 références, 9 renseignées (`SS-09` vide) | Sources de risques et parties prenantes en **listes de références** ; événements redoutés cités **par référence + libellé dans une même cellule** (`ER03 : … ER07: …`, orthographes `ER03` / `ER_03` / `ER_05`) ; chemin d'attaque numéroté (`1 - … 2 - …`) ; source parfois **absente** (ligne suivante) |
| 12 | 4 - S.Opérationnels | Scénarios opérationnels | Tableau, **bandeau** « Cinématique de l'attaque » (Connaître / Rentrer / Trouver / Exploiter) | 13 | Références suffixées (`SO_03a`, `SO_03b`…) ; facilité et probabilité en libellés `2 - Difficile` ; vraisemblance = **formule** (matrice de Métriques) ; source et objectif hérités de la ligne du dessus (cellules laissées vides) |
| 13 | 5 - Risques initiaux | Risques initiaux | Tableau, **titre sur 2 lignes** | 16 | Gravité = **RECHERCHEV** vers la feuille scénarios stratégiques ; description = formule vers scénarios opérationnels ; niveau de risque = INDEX/EQUIV vers Métriques ; traitement : Partage / Réduction ; mention « NON RETENU » dans une colonne libre |
| 14 | 5 - PACS | Plan d'amélioration continue (mesures) | Tableau | 21 mesures | Statuts `Terminé` / `A réaliser` ; priorité `P0..P3` ; origine (liste fermée) ; **références de risques en plage ou en liste** (`R_01 à R_09`, `R_05 R_07 R_08`) avec un préfixe `R_` qui **ne correspond pas** à `RI_` |
| 15 | 5 - Risques résiduels | Risques résiduels | Tableau, **bandeau** Initial / Actuel / Cible | 16 | Trois cotations gravité / vraisemblance / niveau ; niveaux = formules ; intitulé et option de traitement = formules vers d'autres feuilles |

**Conventions implicites à exploiter** (elles se retrouvent dans la plupart des dossiers de ce type) :

- le **nom de feuille** est préfixé par l'atelier (`1 - …`, `5 - …`) ;
- chaque entité a une **référence à préfixe stable** : `Réf.VM`, `Réf.ER`, `Réf.BS`, `Réf.PP`, `Réf.SR/OV`,
  `Réf.SS`, `Réf.SO`, `Réf.RI`, `Réf.RR` ; les liens entre feuilles passent par ces références ;
- les colonnes contraintes portent des **listes de validation Excel** (Oui/Non/Peut-être, catégories du
  socle, origines, 1-4…) : elles décrivent le vocabulaire fermé de la colonne.

## 3. Comportement actuel de l'outil sur ce classeur (simulation)

La logique de prévisualisation actuelle (`src/lib/historic-import.ts` + route
`/api/analysis-imports/preview`) a été rejouée sur le fichier. Résultat :

| Feuille | Ligne d'en-tête retenue | Rôle deviné | Verdict |
|---|---|---|---|
| Page de garde | 13 (« Nom projet ») | Inconnu | Bloc clé/valeur non pris en charge |
| Sommaire | 11 | Inconnu | Correct (à ignorer) |
| Métriques | 2 | **Risques (confiance haute)** | **Faux** : les échelles seraient proposées comme risques |
| 1 - Périmètre | 12 (un paragraphe est pris pour l'en-tête) | Inconnu | Texte libre non pris en charge |
| 1 - SROV | 4 (bandeau « Identification ») | Inconnu | En-tête faux : la vraie ligne est la 5 |
| 1 - Valeurs Métiers | 5 | Inconnu | Colonnes reconnues, mais **aucun rôle « valeur métier »** |
| 1 - Événements redoutés | 5 | Inconnu | Idem (aucun rôle « événement redouté ») ; « Impacts » pris pour la gravité |
| 2 - Biens supports | 6 | Inconnu | Aucun rôle « bien support » |
| 2 - Parties prenantes | 5 | Inconnu | Aucun rôle ; formules sans cache perdues |
| 2 - Socle de sécurité | 5 | Inconnu | Aucun rôle ; pas de référence d'exigence |
| 3 - S.Stratégiques | 5 | **Risques (haute)** | **Faux** : des scénarios stratégiques importés comme risques |
| 4 - S.Opérationnels | 6 | **Risques (haute)** | **Faux** : des scénarios opérationnels importés comme risques |
| 5 - Risques initiaux | 2 (bandeau de titre) | Inconnu | En-tête faux ; la vraie ligne est la 5 |
| 5 - PACS | 5 | Mesures (moyenne) | Correct pour le rôle ; références de risques en plage non exploitables |
| 5 - Risques résiduels | 2 (bandeau de titre) | Inconnu | En-tête faux |

Conclusion : sur 15 feuilles, **une seule** est correctement interprétée de bout en bout, **trois**
sont interprétées à tort avec une confiance « haute » (risque d'import de données fausses), et le
modèle cible ne peut de toute façon pas recevoir les ateliers 1 à 4.

### 3.1 Problèmes constatés (numérotation reprise dans les exigences)

| Id | Problème | Gravité |
|---|---|---|
| P1 | Un fichier `.xls` (ou `.xlsb`, `.ods`) est refusé avec le code `excel_file_type_invalid`, **qui n'a aucune traduction** : l'utilisateur n'a pas d'explication ni de solution | Majeur |
| P2 | Le modèle d'import ne contient que analyse / risques / vulnérabilités / mesures / actions / liens : **ateliers 1 à 4 non importables** | Majeur |
| P3 | Détection de rôle par mots-clés isolés : faux positifs à confiance haute (Métriques, scénarios) | Majeur |
| P4 | Détection d'en-tête sur une seule ligne : bandeaux de groupes et titres sur deux lignes pris pour l'en-tête ; **en-têtes à deux niveaux** non gérés | Majeur |
| P5 | Cellules fusionnées : valeur répétée sur toutes les cellules esclaves (bruit) ; « reprendre la dernière valeur » disponible mais manuel | Moyen |
| P6 | Formules : seule la valeur en cache est lue ; **formules sans cache (71 ici) = valeur vide silencieuse** ; formules cassées (`#REF!`) non signalées | Majeur |
| P7 | Références entre feuilles : pas de résolution `feuille A → feuille B` sur un espace de références à préfixe ; pas de tolérance aux variantes (`VM02` / `VM_02`, `SS-09`, `SO_03a`) | Majeur |
| P8 | Listes de références dans une cellule (`VM02, VM03`, `R_05 R_07`, `R_01 à R_09`) : pas d'extraction ni de plages | Majeur |
| P9 | Références et libellés **mélangés** dans une même cellule (`ER03 : … ER07: …`) | Moyen |
| P10 | Échelles : le mapping ne sait lire que `1-4` ou une table saisie à la main ; les libellés `N - libellé` (`3 - Elevé`) et les symboles `+ + +` ne sont pas reconnus automatiquement ; échelles à 5 niveaux (probabilité, facilité) sans cible | Majeur |
| P11 | Lignes modèles vides (référence seule) importées ou rejetées bruyamment ; pas de filtre « Retenu = Oui » | Moyen |
| P12 | Feuilles de type **clé/valeur** (page de garde, périmètre) et **texte libre** non prises en charge | Moyen |
| P13 | Performance : 81 927 cellules vides sur une feuille ; lecture des 100 premières colonnes ligne à ligne ; classeur de 2,2 Mo mais coût mémoire fort | Moyen |
| P14 | Regroupement **N lignes → 1 objet parent + enfants** (une source de risque × plusieurs objectifs visés ; un scénario × plusieurs sous-étapes `SO_03a…d`) non exprimable | Majeur |
| P15 | Valeurs métier à énumération fermée (catégories de source : Etat, Crime organisé, Vengeur…) sans table de correspondance vers les énumérations ACRA (`CategorieSource`, `TypePartiePrenante`…) | Moyen |
| P16 | Aucune mémoire de « ce format » : chaque dossier du même cabinet ou de la même administration est re-mappé de zéro (le mapping sauvegardable existe mais ne couvre que les rôles historiques) | Moyen |

## 4. Objectifs et principes

1. **Reprendre un dossier EBIOS RM complet** (ateliers 1 à 5) depuis un classeur de ce type, en
   conservant les liens entre objets, avec une prévisualisation fidèle.
2. **Rester universel** : aucun code spécifique à ce classeur. Le cas « dossier de sécurité » est un
   **profil de mapping livré**, pas une branche du moteur. Un autre client, un autre cabinet, une autre
   méthode (ISO 27005, NIST 800-30, ISO 31000) ou un simple registre CSV passent par le même moteur.
3. **Le moteur propose, l'humain décide** : la détection est une suggestion **calibrée** ; en dessous
   d'un seuil de confiance, aucun rôle n'est présélectionné. Aucune donnée n'est créée sans aperçu.
4. **Jamais d'invention** : une cellule ambiguë, une référence introuvable, une échelle non déclarée,
   une formule sans valeur ne produisent ni valeur par défaut silencieuse ni objet arbitraire ; elles
   sont **rapportées** (feuille, ligne, colonne, valeur brute, règle, motif).
5. **Meilleur sous-ensemble fiable** (principe déjà acté) : un import partiel explicite plutôt que
   « tout ou rien ».
6. **Provenance et rejeu** : chaque objet importé garde sa référence source et sa cellule d'origine ;
   un même fichier rejoué n'écrit rien de plus.
7. **Sécurité inchangée** : mêmes garde-fous que l'existant (RBAC, isolation organisation, limites de
   taille, neutralisation des formules, aucune exécution de macro, aucun envoi externe).

## 5. Architecture cible

```
Fichier (.xlsx / .csv / .json)                                       [B-IMP-01..05]
   └─ 1. LECTEUR  → tables normalisées, blocs clé/valeur, blocs de texte, échelles détectées
   └─ 2. DÉTECTION → rôle de chaque feuille + en-têtes + colonnes (scores explicables)   [B-IMP-10..15]
   └─ 3. PROFIL de mapping (livré / de l'organisation / ad hoc) : rôles, colonnes,
   │      règles de transformation, espaces de références, tables de correspondance      [B-IMP-20..29]
   └─ 4. MODÈLE CANONIQUE v3 (ateliers 1 à 5 + registre + mesures + liens), avec
   │      références externes, provenance, statut de retenue                              [B-IMP-30..34]
   └─ 5. RÉSOLUTION des références et des échelles ; contrôles d'intégrité               [B-IMP-40..46]
   └─ 6. APERÇU et DÉCISIONS (prêt / sans ce champ / à confirmer / non importable)       [B-IMP-50..55]
   └─ 7. ÉCRITURE transactionnelle par analyse, idempotente, journalisée                  [B-IMP-60..64]
```

Les étapes 1 à 6 sont **sans écriture** et **pures / testables** (fonctions sans base de données) ;
seule l'étape 7 touche Prisma. Le même moteur sert l'interface web, l'API v2 et le MCP (les deux
derniers ne fournissant que l'étape 3 déjà résolue, sous forme de paquet canonique).

## 6. Exigences fonctionnelles

Priorité : **M** = indispensable au cas du classeur exemple, **S** = nécessaire à la versatilité,
**C** = confort. « Pb » renvoie au tableau 3.1.

### A. Formats acceptés et alertes de format

| Id | P | Pb | Exigence |
|---|---|---|---|
| B-IMP-01 | M | P1 | **Alerte de format** : à la sélection d'un fichier `.xls` (Excel 97-2003), l'assistant affiche, **avant tout envoi**, un message bloquant explicite : *« Le format .xls n'est pas pris en charge. Le format .xlsx est pris en charge : ouvrez le fichier dans Excel ou LibreOffice, faites Enregistrer sous → Classeur Excel (*.xlsx), puis réimportez-le. »* Le même contrôle est refait côté serveur avec un code d'erreur dédié `excel_xls_unsupported` (400). |
| B-IMP-02 | M | P1 | Message générique pour les autres formats reconnus mais non pris en charge (`.xlsb`, `.xlsm`, `.ods`, `.numbers`) : code `excel_format_unsupported`, avec la liste des formats acceptés (`.xlsx`, `.csv`, `.json`). Une extension inconnue ou une extension `.xlsx` dont le contenu n'est pas un classeur (signature ZIP absente, ou ancienne signature binaire OLE2 `D0 CF 11 E0` d'un `.xls` renommé) reçoit le **même** message que `.xls`, pas « fichier corrompu ». |
| B-IMP-03 | M | P1 | Tous les codes d'erreur d'import sont **traduits dans les 5 langues** (fr, en, de, es, it) avec le triplet existant *titre / cause probable / solution* ; un test vérifie qu'aucun code renvoyé par les routes d'import n'est dépourvu de traduction. |
| B-IMP-04 | S | — | Le sélecteur de fichier annonce les formats acceptés (`accept=".xlsx,.csv,.json"`) et l'aide contextuelle les cite ; le glisser-déposer applique la même validation. |
| B-IMP-05 | S | — | CSV : détection de l'encodage (UTF-8 avec/sans BOM, Windows-1252) et du séparateur (`;` `,` tabulation) ; fichier CSV **unique = une feuille** ; plusieurs CSV (ou une archive ZIP de CSV) = plusieurs feuilles, le nom du fichier valant nom de feuille. JSON : voir B-IMP-70. |

### B. Lecture tabulaire robuste

| Id | P | Pb | Exigence |
|---|---|---|---|
| B-IMP-06 | M | P13 | **Zone utile** : la lecture borne chaque feuille à la plage réellement renseignée (dernière ligne et dernière colonne contenant une valeur), pas à la plage formatée ; lecture en flux au-delà d'un seuil ; plafonds configurables (feuilles, lignes par feuille, colonnes) avec message explicite au dépassement. La feuille « Périmètre » (16 384 colonnes) s'ouvre sans latence perceptible. |
| B-IMP-07 | M | P5 | **Cellules fusionnées** : la valeur n'est portée que par la cellule maîtresse ; les cellules esclaves sont marquées « fusionnées » et non dupliquées. Pour une fusion verticale dans une colonne de référence ou de regroupement, l'assistant propose (et mémorise dans le profil) la règle « reprendre la valeur du dessus » (`CARRY_FORWARD`) au lieu de la laisser à découvrir. |
| B-IMP-08 | M | P6 | **Formules** : la valeur lue est le résultat en cache. Une formule **sans résultat** est traitée comme *valeur inconnue* (jamais comme vide) et signalée dans l'aperçu (« 71 cellules calculées sans valeur enregistrée dans *2 - Parties prenantes* — réenregistrez le classeur dans Excel ou recalculez ») ; une erreur de formule (`#REF!`, `#N/A`, `#DIV/0!`) est signalée avec l'adresse de la cellule. Aucune formule n'est évaluée par ACRA en v1. |
| B-IMP-09 | S | P6 | **Champs dérivés** : pour un champ que ACRA calcule lui-même (pertinence SR/OV, niveau de risque, exposition, zone de menace), le profil peut le marquer « calculé » : la valeur source est alors **ignorée à l'import** et, si elle diffère du calcul ACRA avec les échelles de l'organisation, un avertissement de divergence est ajouté au rapport (jamais un écrasement silencieux). |

### C. Détection des feuilles, des en-têtes et des colonnes

| Id | P | Pb | Exigence |
|---|---|---|---|
| B-IMP-10 | M | P4 | **En-têtes multi-niveaux** : détection d'un bloc d'en-tête de 1 à 3 lignes (bandeau de groupes + sous-en-têtes) ; les libellés sont **composés** (`Besoins de sécurité › Disponibilité`) et les fusions horizontales du bandeau propagées aux colonnes couvertes. L'utilisateur peut corriger « l'en-tête commence ligne N et compte K lignes » ; les données commencent après. |
| B-IMP-11 | M | P4 | La ligne d'en-tête n'est jamais choisie sur un titre de feuille (une seule cellule remplie, ou une cellule fusionnée sur toute la largeur) ni sur un paragraphe (cellule de plus de N caractères). Critères de score explicites et testés : nombre de cellules courtes distinctes, régularité des lignes suivantes, correspondance avec des alias connus, présence d'une colonne de référence à préfixe. |
| B-IMP-12 | M | P3 | **Détection de rôle multi-indices** : nom de feuille (préfixe d'atelier compris), libellés d'en-tête, **préfixe des références** de la première colonne (`VM_`, `ER_`, `BS_`, `PP_`, `SS_`, `SO_`, `RI_`, `RR_`, `M_`), types de valeurs, listes de validation de la colonne, résolution croisée des références vers d'autres feuilles. Chaque hypothèse reçoit un **score et une explication** (« reconnu car en-tête *Réf.SS* + nom de feuille *S.Stratégiques* »). |
| B-IMP-13 | M | P3 | **Seuil de prudence** : sous le seuil de confiance (paramétrable, défaut à définir en recette), le rôle n'est pas présélectionné ; en cas d'hypothèses concurrentes proches (ex. *scénario stratégique* vs *risque*), les deux sont présentées et l'utilisateur tranche. Une feuille dont les colonnes sont surtout des **tables d'échelle** (niveau / définition) est proposée « Échelles » et non « Risques ». Non-régression obligatoire : sur le classeur exemple, aucune feuille n'est classée *Risques* à tort. |
| B-IMP-14 | S | P4 | **Feuilles à plusieurs tableaux** (cas de Métriques : douze mini-tableaux côte à côte) : détection des îlots de cellules séparés par des colonnes vides ; chaque îlot est proposé comme table distincte, nommée par son titre. |
| B-IMP-15 | S | P12 | **Blocs clé/valeur** (page de garde) et **blocs de texte** (périmètre) : nouveaux modes de lecture proposés par la détection (libellé à gauche, valeur à droite ; titre suivi de paragraphe). Les paires sont présentées dans une liste éditable ; l'utilisateur associe chaque libellé à un champ ACRA (nom de l'analyse, périmètre, rédacteur…) ou l'ignore. |
| B-IMP-16 | C | — | Suggestion de colonnes par **alias enrichis et multilingues** (fr/en/de/es/it), y compris avec ponctuation et abréviations (`Réf.`, `Ref.`, `N°`), et par les **listes de validation** Excel de la colonne (une colonne dont la liste vaut « Oui,Non,Peut-être » est proposée comme *retenu*). |

### D. Profils de mapping (versatilité et réutilisation)

| Id | P | Pb | Exigence |
|---|---|---|---|
| B-IMP-20 | M | P16 | **Profil** = document versionné (JSON) décrivant, pour un format de classeur : rôle de chaque feuille (par nom exact, motif ou détection), position de l'en-tête, champ → colonne(s), règles de transformation, espaces de références, tables de correspondance de valeurs, échelles, filtres de lignes, champs calculés. Il **remplace** progressivement le mapping « champ → colonne » actuel, qui reste lisible (migration automatique vers un profil sans règles). |
| B-IMP-21 | M | P16 | **Trois portées** de profil, dans l'esprit du modèle de configuration à 3 niveaux du projet : *livré* (fourni avec ACRA, non modifiable), *organisation* (enregistré par un utilisateur autorisé, hérité dans l'arbre multi-organisation), *ad hoc* (le temps d'un import). Un profil livré peut être **dupliqué** puis adapté. |
| B-IMP-22 | M | — | **Profils livrés** au premier lot : (a) *Modèle ACRA* (existant) ; (b) *Dossier de sécurité EBIOS RM* (cas de ce classeur : feuilles et colonnes du §7) ; (c) *Registre de risques simple* (une feuille, une ligne = un risque). D'autres profils (ISO 27005, NIST 800-30…) s'ajoutent par simple fichier de profil, sans modifier le moteur. |
| B-IMP-23 | M | P16 | **Reconnaissance automatique d'un profil** : à l'ouverture d'un fichier, l'outil calcule un taux de correspondance avec chaque profil connu (feuilles attendues présentes, en-têtes reconnus) et propose le meilleur au-delà d'un seuil ; sinon, il bascule en mapping assisté. La correspondance est **tolérante** (colonne renommée ou déplacée, feuille supplémentaire) et liste précisément ce qui manque ou diffère. |
| B-IMP-24 | S | P16 | Un profil est **exportable / importable** (JSON) pour être partagé entre organisations d'un même client ou par un cabinet ; son import est validé par schéma (aucun code exécutable, aucune expression libre). |
| B-IMP-25 | S | — | **Assistant de création de profil** : à partir d'un classeur inconnu, l'assistant produit un profil *proposé* (rôles, colonnes, règles suggérées) que l'utilisateur corrige et enregistre ; les écarts entre la proposition et la correction alimentent seulement l'affichage (pas d'apprentissage automatique, pas d'IA externe — cf. invariant « aucune dépendance LLM externe »). |

### E. Transformations de cellules

Extension du « contrat de transformation » de la définition précédente (modes `SCALAR`, `LINES`,
`SEMICOLON`, `PIPE`, `CARRY_FORWARD`). Chaque valeur normalisée conserve sa provenance
(`feuille!cellule`), sa valeur brute et la règle appliquée.

| Id | P | Pb | Règle | Usage dans le classeur |
|---|---|---|---|---|
| B-IMP-26 | M | P8 | `REFERENCE_LIST` : extrait toutes les références d'un **espace de références** dans une cellule, séparateurs quelconques (virgule, espace, retour ligne, « et », « ; »), tolère les variantes d'écriture, **développe les plages** (`R_01 à R_09`, `R_01-R_09`) à condition que les bornes existent et soient de même préfixe ; les valeurs qui ne sont pas des références sont rapportées comme « non résolues », jamais ignorées | `VM02, VM03…`, `PP_01, PP_27…`, `R_05 R_07`, `R_01 à R_09` |
| B-IMP-27 | M | P9 | `REFERENCE_AND_LABEL` : sépare, dans une cellule, des couples *référence + libellé libre* (`ER03 : Modification… ER07: Suppression…`) ; le libellé sert de contrôle de cohérence avec l'objet référencé (avertissement si divergence forte), la référence fait foi | Événements redoutés des scénarios stratégiques |
| B-IMP-28 | M | P10 | `LEVEL_LABEL` : lit un niveau dans un libellé `N - texte` (`3 - Elevé`, `2 - Limitée`, `1 - Peu vraisemblable`) : le **nombre** est proposé comme niveau source, le **texte** comme libellé ; les deux servent à vérifier la cohérence avec la table d'échelle déclarée | Gravité, vraisemblance, facilité, probabilité, niveaux de risque |
| B-IMP-29 | M | P10 | `SYMBOL_LEVEL` : convertit une suite de symboles répétés (`+`, `+ +`, `+ + +`) en niveau (1, 2, 3) ; le nombre maximal est **déclaré** par l'échelle (ici 3), il n'est pas deviné | Motivation et ressources des sources de risque |
| B-IMP-30 | M | P14 | `GROUP_BY` : regroupe des lignes en un **objet parent** identifié par une colonne (la source de risque) portant une **liste d'objets enfants** (les objectifs visés, les sous-scénarios) ; les colonnes propres au parent doivent être identiques entre lignes du groupe, sinon avertissement de conflit (le parent garde la première valeur, la divergence est rapportée) | Une source × N objectifs visés ; `SO_03a`…`SO_03d` sous `SS_03` |
| B-IMP-31 | S | — | `NUMBERED_STEPS` : découpe une cellule numérotée (`1 - … 2 - …`, `1) … 2) …`, puces) en étapes ordonnées ; le découpage n'a lieu que si la règle est explicitement choisie (cf. principe « pas de séparation implicite sur virgule ») | Chemins d'attaque stratégiques, actions élémentaires |
| B-IMP-32 | M | P15 | `MAP_VALUES` : table de correspondance **valeur source → valeur ACRA** pour toute énumération (catégorie de source, type de partie prenante, statut de mesure, priorité, option de traitement, oui/non/peut-être, nature de valeur métier). L'assistant **pré-remplit** la table à partir d'un dictionnaire livré (synonymes fr/en) et affiche en orange les valeurs non résolues ; une valeur sans correspondance vaut « non importable » ou la valeur ACRA neutre (`AUTRE`) **si l'utilisateur l'a choisi**. Les valeurs sont recensées automatiquement (jusqu'à N valeurs distinctes par colonne) pour ne pas saisir la table à la main. |
| B-IMP-33 | S | — | `DATE` : dates ISO, `jj/mm/aaaa`, numéros de série Excel et objets date ; format ambigu (`03/04/2025`) → format demandé une fois par profil ; jamais de bascule silencieuse jj/mm ↔ mm/jj |
| B-IMP-34 | S | — | `PERCENT_RANGE` : plages de pourcentage `[25% ; 49%]` (échelle d'avancement) lues comme intervalle, pour alimenter le statut d'avancement d'une mesure |
| B-IMP-35 | C | — | `ROW_FILTER` : filtres de lignes déclaratifs (`retenu = Oui`, colonne non vide, référence seule sans autre contenu) ; voir aussi B-IMP-45. |

### F. Références, liens et intégrité

| Id | P | Pb | Exigence |
|---|---|---|---|
| B-IMP-40 | M | P7 | **Espaces de références** déclarés dans le profil : préfixe, séparateur, largeur numérique, sensibilité à la casse, suffixes autorisés (`SO_03a`). La comparaison utilise une **forme canonique** (`VM_02` = `VM02` = `vm-02`) ; l'orthographe d'origine est conservée pour l'affichage et le rapport. Deux références qui **différeraient seulement par le préfixe** entre feuilles (`R_05` dans les mesures pour `RI_05` dans les risques) ne sont **jamais** rapprochées automatiquement : l'assistant signale l'incohérence et propose explicitement un alias de préfixe (`R_` ⇒ `RI_`), à valider. |
| B-IMP-41 | M | P7 | **Graphe de liens** entre rôles : *événement redouté → valeurs métier*, *bien support → valeurs métier*, *scénario stratégique → source de risque, parties prenantes, événements redoutés*, *scénario opérationnel → scénario stratégique*, *risque initial → scénario stratégique + scénario opérationnel*, *risque résiduel → risque initial*, *mesure → risques*. Chaque lien est résolu par référence ; un lien vers une référence absente est rapporté (« orphelin ») et **n'invente aucun objet**. |
| B-IMP-42 | M | — | **Doublons de référence** dans un même espace : refus de la feuille concernée avec liste des lignes ; jamais de rattachement à la dernière ligne (règle existante conservée). |
| B-IMP-43 | M | P14 | **Référence absente** : pour un rôle qui n'a pas de colonne de référence (le socle de sécurité), l'assistant propose une clé de ligne **stable** (rang de ligne + empreinte du texte) déclarée dans le profil ; elle sert à l'idempotence et à la provenance, pas à créer des liens. |
| B-IMP-44 | M | P11 | **Ligne modèle vide** : une ligne dont seule la colonne de référence est renseignée (`VM_07`…`VM_10`, `SS-09`) est **ignorée sans erreur** et comptée (« 4 lignes modèles vides ignorées »). |
| B-IMP-45 | M | P11 | **Statut de retenue** : les colonnes du type « Retenu ? » (Oui / Non / Peut-être) sont exploitables de trois façons au choix de l'utilisateur, mémorisées dans le profil : *importer seulement les retenus*, *tout importer avec l'indicateur de retenue* (quand le modèle cible le porte : `SourceRisque.retenu` par ex.), *importer les retenus + à confirmer*. Les biens supports non retenus (catalogue de 73 lignes) ne créent aucun objet dans le premier mode. |
| B-IMP-46 | S | — | **Cohérence transverse** vérifiée à l'aperçu : gravité d'un scénario stratégique = maximum des gravités des événements redoutés référencés (règle EBIOS RM déjà portée par ACRA) ; écart avec la valeur source → avertissement ; vraisemblance du risque initial = celle du scénario opérationnel référencé ; les niveaux de risque source sont comparés au calcul ACRA. |

### G. Échelles et valeurs cotées

| Id | P | Pb | Exigence |
|---|---|---|---|
| B-IMP-47 | M | P10 | **Échelles déclarées** : chaque champ coté (gravité, vraisemblance, probabilité d'exploitation, facilité, niveau de risque, motivation, ressources, dépendance, pénétration, maturité, confiance…) est rattaché à une **échelle source** (nombre de niveaux, libellés) et à sa **cible ACRA**. Cible et source de même taille → correspondance directe proposée ; tailles différentes (5 niveaux → 4) → **correspondance explicite obligatoire**, jamais un arrondi implicite (règle existante étendue à tous les champs cotés). |
| B-IMP-48 | M | P10 | **Lecture de la feuille d'échelles** (« Métriques ») : la détection propose de lire les tables *niveau / libellé / définition* comme **échelles source** du profil (elles alimentent les libellés reconnus par `LEVEL_LABEL` et la vérification de cohérence). Elle ne modifie **jamais** les échelles de l'organisation : une proposition d'alignement (import des libellés et de la matrice de risque) est une action séparée, réservée à l'ADMIN (règle RBAC existante sur les échelles) et soumise à aperçu. |
| B-IMP-49 | S | — | **Matrice de risque source** (gravité × vraisemblance → niveau) lue quand elle est fournie ; comparée à la matrice ACRA de l'organisation ; toute différence de cellule est listée. |
| B-IMP-50 | S | — | Un niveau hors échelle, un texte non numérique (« N/A »), une cellule vide sur un champ coté : traités comme *champ omis* (règle existante `FIELD_OMITTED`), rapportés avec la valeur brute. |

### H. Prévisualisation, décisions et rapport

| Id | P | Pb | Exigence |
|---|---|---|---|
| B-IMP-52 | M | P2 | **Aperçu par atelier** : compteurs et échantillons par rôle (valeurs métier, biens supports, événements redoutés, sources de risque, parties prenantes, scénarios stratégiques, scénarios opérationnels, risques, mesures, liens) ; la navigation suit les ateliers ; un **graphe de complétude** indique pour chaque lien le nombre de références résolues / orphelines. |
| B-IMP-53 | M | — | Quatre états par ligne, repris de l'existant : **prêt / importable sans ce champ / à confirmer / non importable**, avec feuille, ligne Excel, colonne, valeur brute, règle appliquée et motif. Les décisions humaines sur les valeurs manquantes (compléter ou ne pas importer) sont conservées. |
| B-IMP-54 | M | — | **Rapport téléchargeable** (CSV) exhaustif : lignes ignorées (modèles vides, non retenues), références non résolues, divergences de calcul, formules sans valeur, valeurs mappées par défaut, échelles converties. Le rapport est produit dans la langue de l'utilisateur. |
| B-IMP-55 | S | — | **Comparaison à l'existant** en cas de réimport dans une analyse déjà importée : *créé / inchangé / modifié / absent du fichier*, sans jamais supprimer sans action explicite (règle « aucun remplacement silencieux » conservée). |

### I. Modèle cible et écriture

| Id | P | Pb | Exigence |
|---|---|---|---|
| B-IMP-56 | M | P2 | **Paquet canonique v3** : extension rétro-compatible du paquet actuel (`analysis`, `risks`, `vulnerabilities`, `measures`, `actions`, `links`) par les collections `context` (cadrage, périmètre, contexte juridique), `businessValues`, `supportAssets`, `feareEvents`, `riskSources`, `stakeholders`, `strategicScenarios`, `operationalScenarios`, `securityBaseline`, `scales` (informatif). Chaque objet porte `externalId`, `analysisExternalId`, `provenance` (`sheet`, `cell`), `retained`. Le v1/v2 actuel reste accepté sans changement (versionnement de schéma). |
| B-IMP-57 | M | P2 | **Écriture par atelier** dans les modèles existants (§8) : `Cadrage` (valeurs métier, biens supports, événements redoutés, socle), `SourceRisque` (avec `objectifsVises`), `PartiePrenante`, `ScenarioStrategique`, `ScenarioOperationnel`, `Risque` (cotations initiale / actuelle / résiduelle), `Mesure`, plans d'action et liens `PlanActionLien` créés **via les helpers de `plan-action.server.ts`** (contrat polymorphe rappelé au skill d'ingénierie : `RISQUE_ANALYSE` exige `targetId = Risque.id` et `ref = analyseId`). |
| B-IMP-58 | M | — | **Méthode cible** : l'analyse importée reçoit la méthode déclarée par le profil (`EBIOS_RM` pour le dossier de sécurité) ; un profil ne peut pas écrire un objet que la méthode n'admet pas (ex. scénarios stratégiques dans une analyse ISO 27005 : la feuille est alors ignorée avec explication). Une analyse importée reste `EN_COURS`, jamais soumise ni approuvée (règle existante), et **respecte le gel d'analyse** pour toute écriture dans une analyse existante. |
| B-IMP-59 | M | — | **Atomicité** : par analyse (règle existante) ; timeout de transaction adapté au volume (le classeur écrit plusieurs centaines d'objets) ; gestion de la course `P2002` sur la clé d'idempotence. |
| B-IMP-60 | S | — | **Métadonnées du document** (rédacteur, contrôleur, approbateur, dates, historique de versions) : stockées comme *provenance et notes d'import* de l'analyse ; elles **n'affectent pas** le workflow d'approbation d'ACRA (un approbateur cité dans un fichier n'est pas une approbation). |

### J. JSON et API

| Id | P | Pb | Exigence |
|---|---|---|---|
| B-IMP-70 | S | — | **JSON arbitraire** : au-delà du paquet canonique, l'import accepte un JSON de forme libre avec un profil « JSON » : liste de chemins (`$.risks[*]`) par rôle et colonnes = champs par chemin relatif ; mêmes transformations, mêmes échelles, même aperçu que pour une feuille. Profondeur, taille et nombre de nœuds bornés ; aucune exécution de code, aucune référence externe (`$ref`) suivie. |
| B-IMP-71 | S | — | **CSV avec en-têtes libres** : mêmes profils, un CSV valant une feuille (B-IMP-05). |
| B-IMP-72 | S | — | **API v2** : `preview` accepte un paquet canonique v3 *ou* un fichier + profil ; la réponse d'aperçu reprend les états de B-IMP-53 ; `idempotencyKey` et 409 inchangés. La description OpenAPI documente le paquet v3. |
| B-IMP-73 | C | — | **MCP** : `analyse_import_preview` et `propose_analysis_import` acceptent le paquet v3 ; une proposition reste ancrée à une analyse existante (règle existante) et n'écrit que les objets validés, après acceptation humaine. |

### K. Sécurité, limites et exploitation

| Id | P | Pb | Exigence |
|---|---|---|---|
| B-IMP-80 | M | — | Contrôles existants **conservés** : RBAC (création d'analyse), organisation active / clé API uniquement, limite de débit, taille compressée et **décompressée**, plafond de feuilles et de lignes, `sanitizeForSpreadsheet` en sortie, aucune macro exécutée (un `.xlsm` est refusé, B-IMP-02), aucun accès réseau depuis le fichier (liaisons externes, images distantes ignorées). |
| B-IMP-81 | M | P13 | **Budget de ressources** : temps et mémoire d'analyse mesurés sur le classeur exemple (2,2 Mo, 81 927 cellules vides sur une feuille) ; cible de recette à fixer (ordre de grandeur : aperçu en quelques secondes). Au-delà du seuil synchrone, bascule en traitement asynchrone avec progression (déjà prévue au besoin historique). |
| B-IMP-82 | M | — | **Confidentialité** : le fichier n'est jamais conservé au-delà de l'import sauf choix de l'organisation (empreinte SHA-256 seule par défaut) ; le rapport et l'aperçu n'exposent que ce qui est nécessaire ; **aucun service externe ni IA externe** n'est appelé pour la détection ou le mapping. |
| B-IMP-83 | M | — | **Journal d'audit** : auteur, date, empreinte, profil (id + version), volumes par rôle, décisions, références créées ; l'aperçu est aussi journalisé (comme un export) dès lors qu'il expose du contenu. |
| B-IMP-84 | M | — | **i18n ×5** de tous les libellés de l'assistant, des états, des motifs de rejet et des rapports (règle projet) ; les profils livrés portent leurs libellés dans les 5 langues ; les intitulés propres au classeur (SR/OV, PACS…) ne sont pas traduits. |

## 7. Profil livré « Dossier de sécurité EBIOS RM » (contenu du besoin)

Pour ce classeur, le profil livré déclare (à affiner en recette) :

| Feuille (motif) | Rôle | En-tête | Références | Points de règle |
|---|---|---|---|---|
| `Page de garde` | Métadonnées + clé/valeur | blocs | — | nom du projet → nom de l'analyse ; rédacteur / contrôleur / approbateur → notes d'import (B-IMP-60) ; « XXX » et valeurs modèles à confirmer |
| `Sommaire` | Ignorée | — | — | — |
| `Métriques` | Échelles (lecture seule) | îlots | — | alimente `LEVEL_LABEL` / `SYMBOL_LEVEL` ; proposition d'alignement des échelles à part (B-IMP-48) |
| `1 - Périmètre` | Cadrage (texte) | blocs | — | contexte et description → `Cadrage.perimetre` ; contexte juridique → objectifs / notes ; architecture → notes ; image ignorée |
| `1 - SROV` | Sources de risque | 5 (bandeau ligne 4) | `SR/OV_nn` | `GROUP_BY` source ⇒ N objectifs visés ; `SYMBOL_LEVEL` motivation / ressources (échelle 3) ; pertinence = champ calculé ; retenu + justification ; `MAP_VALUES` source → `CategorieSource` (Etat → ETAT_NATION, Crime organisé → CYBERCRIMINEL, Vengeur → EMPLOYE_MALVEILLANT, Amateur → AMATEUR, Terroriste → TERRORISTE, Acteur privé → CONCURRENT, Activiste → ACTIVISTE, sinon AUTRE, à confirmer) |
| `1 - Valeurs Métiers` | Valeurs métier | 6 (sur 2 niveaux) | `VM_nn` | D / I / C en niveaux 1–4 ; nature (Processus / Information / les deux) ; lignes vides ignorées |
| `1 - Événements redoutés` | Événements redoutés | 5 | `ER_nn` | `LEVEL_LABEL` gravité ; `REFERENCE_LIST` vers valeurs métier (`VM02` = `VM_02`) ; retenu |
| `2 - Biens supports` | Biens supports | 6 | `BS_MAT.nn`… | sous-catégorie répétée = groupe ; **retenu = Oui seulement** par défaut ; liens vers valeurs métier absents de la feuille (à signaler) |
| `2 - Parties prenantes` | Parties prenantes | 5 | `PP_nn` | dépendance / pénétration / maturité / confiance ; exposition, fiabilité, menace, zone = calculés (B-IMP-09) ; formules sans valeur signalées ; lignes « N/A » ignorées ; `MAP_VALUES` catégorie → `TypePartiePrenante` |
| `2 - Socle de sécurité` | Socle de sécurité | 5 | clé de ligne stable | catégories fermées ; couverture projet / transverse ; mesures à décliner ; cible : `Cadrage.socleSecurite` / référentiel personnalisé |
| `3 - S.Stratégiques` | Scénarios stratégiques | 5 | `SS_nn`, `SS-nn` | `REFERENCE_LIST` parties prenantes ; `REFERENCE_AND_LABEL` événements redoutés (`ER03` = `ER_03` = `ER_03`) ; `NUMBERED_STEPS` chemin d'attaque ; source absente → `CARRY_FORWARD` ou à confirmer ; gravité comparée au maximum des ER (B-IMP-46) |
| `4 - S.Opérationnels` | Scénarios opérationnels | 6 (bandeau ligne 5) | `SO_nn` + suffixe | `CARRY_FORWARD` source et objectif ; `LEVEL_LABEL` facilité (5 niveaux) et probabilité (5 niveaux) : **correspondance obligatoire** vers la vraisemblance ACRA 1–4 ; vraisemblance source = calculée |
| `5 - Risques initiaux` | Risques | 5 (titre sur 2 lignes) | `RI_nn` | gravité et vraisemblance = valeurs de cache (formules RECHERCHEV / INDEX) ; description = formule vers scénario (résolue par le lien SO) ; traitement → stratégie (`MAP_VALUES` Partage → TRANSFERER, Réduction → REDUIRE…) ; mention « NON RETENU » → exclusion à confirmer |
| `5 - PACS` | Mesures | 5 | `M_nn` | `MAP_VALUES` statut (Terminé → REALISE, A réaliser → A_FAIRE…) ; priorité P0–P3 ; origine ; `REFERENCE_LIST` risques avec alias de préfixe `R_` ⇒ `RI_` à valider ; plages `R_01 à R_09` |
| `5 - Risques résiduels` | Risques (cotations actuelle / résiduelle) | 6 (bandeau ligne 5) | `RR_nn` → `RI_nn` | triple cotation initiale / actuelle / cible ; niveaux calculés ; option de traitement = formule vers risques initiaux |

## 8. Correspondance feuilles → objets ACRA

| Source | Objet ACRA | Champs alimentés | Remarque |
|---|---|---|---|
| Page de garde | `Analyse` + notes d'import | nom, méthode `EBIOS_RM`, description | approbation non reprise |
| Périmètre | `Cadrage` | `perimetre`, `objectifsEtude`, `missions` | blocs de texte |
| Valeurs métier | `Cadrage.valeursMetier` | id, nom, type, description, responsable, besoins D/I/C | — |
| Biens supports | `Cadrage.biensSupports` | id, nom, type, description, liens valeurs métier | non retenus exclus par défaut |
| Événements redoutés | `Cadrage.evenementsRedoutes` | id, valeur métier, description, impacts, gravité | — |
| Socle de sécurité | `Cadrage.socleSecurite` / `referentiels` | exigence, catégorie, couverture, mesures | lien avec l'idée « PSSI → référentiel personnalisé » (mémoire projet) |
| SR/OV | `SourceRisque` | nom, catégorie, motivation, ressources, pertinence, `objectifsVises`, `retenu`, justification | pertinence recalculée par ACRA |
| Parties prenantes | `PartiePrenante` | nom, type, dépendance, pénétration, maturité, confiance | exposition / fiabilité recalculées |
| Scénarios stratégiques | `ScenarioStrategique` | nom, source, objectif, ER liés, chemin d'attaque, parties prenantes | gravité héritée des ER |
| Scénarios opérationnels | `ScenarioOperationnel` | nom, scénario stratégique, actions élémentaires, vraisemblance, gravité héritée | échelle 5 → 4 explicite |
| Risques initiaux / résiduels | `Risque` | gravité, vraisemblance, niveau ; actuelle ; résiduelle ; stratégie | trois cotations |
| PACS | `Mesure` (+ `PlanAction` si échéance / porteur) | intitulé, statut, priorité, responsable, échéance, origine, risques liés | via helpers plan d'action |
| Métriques | *aucun objet* (référence) | libellés d'échelle, matrice | proposition ADMIN séparée |

## 9. Critères d'acceptation

1. **Alerte de format** : déposer un `.xls` affiche, sans envoi au serveur, le message de B-IMP-01 dans
   les 5 langues ; un `.xls` renommé en `.xlsx` reçoit le même message ; un test échoue si un code
   d'erreur d'import n'est pas traduit.
2. **Non-régression de détection** : sur le classeur exemple, *Métriques*, *S.Stratégiques* et
   *S.Opérationnels* ne sont plus proposés comme *Risques* ; les en-têtes de *SROV*, *Risques initiaux*
   et *Risques résiduels* sont trouvés sur la bonne ligne ; *Sommaire* est proposé « ignorée ».
3. **Aperçu du classeur exemple** avec le profil livré : compteurs attendus par atelier, dont
   6 valeurs métier, 8 événements redoutés, 20 couples SR/OV regroupés par source, 9 scénarios
   stratégiques (`SS-09` modèle vide ignoré), 13 scénarios opérationnels, 16 risques initiaux et 16 risques
   résiduels, 21 mesures, 14 biens supports retenus sur 73 (mode « retenus seulement ») ;
   aucune écriture en base.
4. **Références** : `VM02`, `VM_02` et `vm-02` désignent le même objet ; `R_01 à R_09` est développé ;
   `R_05` (mesures) face à `RI_05` (risques) n'est rapproché **qu'après** validation de l'alias de préfixe ;
   toute référence absente apparaît dans le rapport avec sa cellule.
5. **Formules** : les 71 formules sans valeur enregistrée de *Parties prenantes* sont signalées ; une
   valeur calculée ne remplace jamais une valeur ACRA recalculée sans avertissement de divergence.
6. **Échelles** : aucune conversion 5 → 4 (facilité, probabilité) sans table de correspondance validée ;
   les libellés `N - texte` sont reconnus automatiquement.
7. **Versatilité** : un registre CSV à 6 colonnes (une ligne = un risque) et un JSON de forme libre
   (B-IMP-70) s'importent avec un profil créé dans l'assistant, sans modification de code ; un profil
   enregistré est reproposé automatiquement sur un second fichier de même forme.
8. **Import** : l'analyse créée est `EN_COURS`, méthode `EBIOS_RM`, dans l'organisation active, avec
   provenance feuille/cellule ; un rejeu du même fichier avec la même clé n'écrit rien de plus ; un
   import partiel (feuille retirée par l'utilisateur) reste atomique pour ce qui est retenu.
9. **Sécurité** : mêmes refus qu'aujourd'hui (rôle, organisation, taille décompressée, débit) ; un
   `.xlsm` est refusé ; aucun appel réseau sortant pendant l'analyse.
10. **Performance** : l'aperçu du classeur exemple (dont la feuille de 81 927 cellules vides) aboutit
    sans blocage de l'interface ni dépassement mémoire ; le budget mesuré est consigné dans `HANDOFF.md`.
11. **i18n** : `npm run i18n:check` et le test de parité passent ; le profil livré est complet en fr, en,
    de, es, it.

## 10. Découpage recommandé

| Lot | Contenu | Valeur | Dépend de |
|---|---|---|---|
| **I1 — Format et robustesse** (petit, isolable) | B-IMP-01 à 04 (alerte `.xls` / formats, codes traduits) ; B-IMP-06 à 08 (zone utile, fusions, formules sans cache signalées) ; B-IMP-11, B-IMP-13 (plus de faux positifs « risques à confiance haute ») | Corrige les défauts P1, P3, P5, P6, P13 sans changer le modèle | — |
| **I2 — En-têtes et détection** | B-IMP-10, 12, 14, 15, 16 | Feuilles à bandeaux, multi-tableaux, clé/valeur | I1 |
| **I3 — Références, transformations** | B-IMP-26 à 35, 40 à 45, 47 à 50 | Cœur de la versatilité (références, plages, symboles, niveaux, regroupements, correspondances) | I1 |
| **I4 — Profils** | B-IMP-20 à 25 | Réutilisation ; profil livré (a) et (c) | I2, I3 |
| **I5 — Modèle canonique v3 et écriture par atelier** | B-IMP-52 à 60 | Import d'un dossier EBIOS RM complet | I3, I4 |
| **I6 — Profil « Dossier de sécurité »** | §7 et §8 ; critères 2 à 8 sur le classeur exemple | Cas d'usage déclencheur | I5 |
| **I7 — JSON libre, API v2, MCP** | B-IMP-70 à 73 | Industrialisation | I5 |

**Recommandation** : livrer **I1 immédiatement** (il corrige des défauts visibles aujourd'hui :
message `.xls` absent, faux positifs de détection) et ne lancer I2–I6 qu'après validation des
décisions du §11. I1 se fait en TDD sur des fonctions pures (`historic-import`, `xlsx-guard`) et
n'impose aucune migration.

## 11. Décisions attendues et risques

**Décisions produit à prendre**

1. **Portée du premier import EBIOS complet** : reprendre les ateliers 1 à 5 d'emblée (I5–I6), ou
   d'abord ateliers 3 à 5 (scénarios, risques, mesures) — le reste restant en texte libre dans
   `Cadrage` ? Le coût est très différent (valeurs métier, biens supports et socle sont des JSON du
   `Cadrage`, pas des tables).
2. **Sources de risque** : ACRA porte une source avec une liste d'objectifs (`objectifsVises`), le
   classeur porte des **couples** SR/OV. Le regroupement par source (B-IMP-30) est-il acceptable, ou
   faut-il garder un couple par source de risque ?
3. **Énumérations ACRA** (`CategorieSource`, `TypePartiePrenante`) : accepte-t-on la valeur neutre
   `AUTRE` quand la source n'a pas de correspondance, ou faut-il bloquer ?
4. **Échelles** : l'organisation veut-elle que l'import propose d'aligner ses échelles sur la feuille
   *Métriques* (B-IMP-48), ou se limite-t-on à la lecture ? (Action réservée à l'ADMIN dans tous les cas.)
5. **Champs calculés** : divergence entre la valeur du fichier et le calcul ACRA → **avertir seulement**
   (proposé) ou proposer de conserver la valeur du fichier ?
6. **Données du fichier exemple** : il est marqué « Confidentiel » ; peut-on en tirer une **version
   réduite et anonymisée** comme jeu d'essai versionné (et les critères d'acceptation en dépendent) ?
7. **Fichiers ZIP de CSV** (B-IMP-05) : nécessaires, ou un CSV par import suffit-il ?

**Risques**

- *Sur-ingénierie d'un langage de mapping* : le profil doit rester **déclaratif et borné** (pas
  d'expression libre) ; sinon risque de sécurité (exécution) et de maintenabilité.
- *Faux sentiment de fiabilité* : un score de détection élevé ne doit jamais dispenser d'aperçu ;
  l'interface montre les preuves de la détection.
- *Volume* : ~500 objets par dossier ; l'écriture transactionnelle et le timeout Prisma doivent être
  dimensionnés (leçon déjà tirée de l'import historique).
- *Qualité des sources* : le classeur contient des incohérences (préfixe `R_` / `RI_`, `SS-09` /
  `SS_09`, `ER_05` / `ER05`, formule `#REF!`). Le moteur doit les **révéler**, pas les masquer.
- *Divergence de terminologie* : les libellés du classeur (SR/OV, PACS, MCAS) sont ceux d'une
  organisation ; les libellés ACRA restent ceux du produit — aucune traduction réglementaire à
  improviser.

## 12. Annexe — méthode d'analyse du classeur

Lecture par ExcelJS (celle de l'outil) : feuilles, dimensions, fusions, validations de données,
formules et valeurs en cache, images. Simulation de la prévisualisation actuelle en exécutant
`detectHistoricHeaderLayout`, `detectHistoricImportSheet` et `suggestHistoricColumnMapping` sur chaque
feuille (mêmes paramètres que la route : 20 premières lignes, 100 premières colonnes). Les résultats
du §3 en sont issus ; aucun fichier n'a été modifié, aucune donnée n'a été écrite.
