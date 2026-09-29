# Import universel — chantiers à venir

Mis de côté volontairement (décision du 2026-09-29) : ils restent au backlog avec l'expression de besoin déjà rédigée dans
[`import-universel-analyses.md`](import-universel-analyses.md) (numéros `B-IMP-…` ci-dessous). Ce qui est **déjà livré** (I1–I7 hors API/MCP,
CSV, JSON libre, profils, mapping par défaut `mapping_mzt`) est décrit dans [`import-universel-plan-de-test.md`](import-universel-plan-de-test.md).

## 1. Liens biens supports ↔ valeurs métier (B-IMP-41)
- **Besoin** : un bien support doit pouvoir être rattaché à une ou plusieurs valeurs métier (`Cadrage.biensSupports[].valeurMetierIds`).
- **Constat** : le classeur EBIOS RM d'exemple ne porte **aucun lien** dans la feuille « 2 - Biens supports » (colonnes : Réf.BS, Catégorie,
  Bien support, Description, Retenu, Responsable, Commentaires) ; l'import écrit donc les biens sans lien.
- **À décider** : (a) simple avertissement « biens sans valeur métier rattachée » au bilan ; (b) colonne de liens optionnelle (rôle
  `SUPPORT_ASSETS`, champ `businessValueRefs` — le moteur `REFERENCE_LIST` et les avertissements de référence existent déjà) ; (c) aide à la
  saisie après import (proposition de rattachement par catégorie, jamais automatique).
- **Critère d'acceptation** : une colonne de références « VM_01, VM_02 » sur les biens supports est résolue (variantes `VM01`/`VM_01`),
  les références inconnues produisent un avertissement et rien n'est inventé.

## 2. Champs calculés : avertissement de divergence (B-IMP-09)
- **Besoin** : pour un champ que ACRA recalcule (niveau de risque, exposition, fiabilité, pertinence SR/OV, zone de menace), la valeur du
  fichier est **ignorée** ; si elle diffère du calcul ACRA avec les échelles de l'organisation, un **avertissement** (jamais une correction
  silencieuse) est ajouté au bilan.
- **Décision prise** : avertir seulement ; ACRA recalcule à partir de la vraisemblance et de l'impact.
- **Travail** : champ « niveau de risque » dans le mapping des risques (`RISKS`), comparaison avec la matrice de l'organisation, message
  traduit ×5 (`previewWarnings`). Les cellules calculées sans valeur enregistrée sont déjà signalées (B-IMP-08).
- **Critère d'acceptation** : un niveau « 8 » pour gravité 3 × vraisemblance 2 (= 6) produit un avertissement ; un niveau cohérent n'en produit pas.

## 3. API v2 avec profil (B-IMP-72)
- **Besoin** : `preview` de l'API v2 accepte le paquet canonique v3 **ou** un fichier + profil ; la réponse reprend les états de B-IMP-53
  (prêt / sans ce champ / à confirmer / non importable) ; `idempotencyKey` et 409 inchangés ; la description OpenAPI documente le paquet v3.
- **Existant** : l'API v2 accepte déjà le paquet v3 (`/api/v2/analysis-imports/preview`, ateliers résumés). Manque : fichier + profil,
  et les états par ligne.
- **Questions** : format de transport du fichier (base64 comme l'interface, ou multipart) ; profil inline ou référencé (`mapping_mzt`, mappings
  d'organisation) ; limites de taille et de débit alignées sur l'interface (500 lignes / feuille, 30 aperçus / 10 min).

## 4. MCP (B-IMP-73)
- **Besoin** : `analyse_import_preview` et `propose_analysis_import` acceptent le paquet v3 ; une proposition reste **ancrée à une analyse
  existante** (règle projet « propositions MCP ancrées ») et n'écrit que les objets validés, après acceptation humaine.
- **Contraintes** : RBAC hérité de l'ancre ; gel d'analyse respecté ; aucune écriture directe (proposition → acceptation).
- **Question ouverte** : un import qui crée une **nouvelle** analyse n'a pas d'ancre — à exclure du MCP (import web / API seulement) ou à
  ancrer à l'organisation ?

## 5. Autres idées notées
- Profil JSON enregistrable **par chemins** (`$.registre[*]`) : aujourd'hui un JSON libre est aplati en feuilles (B-IMP-70, version 1) ; un
  profil par chemins permettrait d'enregistrer le mapping d'une forme de JSON.
- Mapping par défaut **au niveau organisation** hérité dans l'arbre (aujourd'hui : défaut d'instance `mapping_mzt` en lecture seule + mappings
  par organisation).
- Méthode par défaut **par organisation** (`resolveMethodes` accepte déjà `orgAllowed` / `orgDefault`, sans écran) — cf. classement des méthodes.
