# Import universel — plan de test après redémarrage (Docker + DB)

Non vérifié à ce jour (Docker indisponible) : tout ce qui touche la base ou le navigateur.
Fixtures locales (NON versionnées) : `.local-fixtures/import-universel/`.

## 0. Préparation
- [ ] `docker-compose up -d` ; `npx prisma migrate deploy` ; `npm run dev` (:3005).
- [ ] `npx tsc --noEmit -p tsconfig.json` · `npm test` · `npm run i18n:check` · `npm run build` (arrêter le dev avant le build).
- [ ] `npx playwright test e2e/analysis-import.spec.ts e2e/analysis-import-ateliers.spec.ts` (nettoyer ce qui est créé).

## 1. Messages d'erreur (navigateur)
- [ ] `ancien-format.xls` puis `ancien-format-renomme.xlsx` via « Importer une analyse » → carte « .xls non pris en charge, .xlsx pris en charge » (fr + une autre langue).
- [ ] JSON invalide (virgule finale, apostrophes, commentaire, tronqué, HTML renommé) via import ACRA **et** via l'assistant → code, ligne/colonne, extrait, indice.
- [ ] Fichier vide, .pdf, .zip, .ods → message dédié, aucun envoi inutile.

## 2. Tableau de bord
- [ ] Bouton « Nouvelle analyse » = menu (nouvelle analyse, nouveau projet 360, importer une analyse) ; clavier (Échap, flèches), rôle sans droit de création (LECTEUR), ×5 langues.
- [ ] « EBIOS RM flash » partout (création, liste, filtres, rapports) ; `?methode=` sur `/analyses/new`.

## 3. Assistant — classeur 15 feuilles (`dossier-securite-btp.xlsx`, `…-avocats.xlsx`)
- [ ] Rôles détectés par feuille (ateliers 1→5, contexte, risques résiduels, mesures/PACS), bandeau profil livré.
- [ ] Aperçu : colonnes sur deux niveaux, fusions, formules sans valeur (avertissement), lignes modèle ignorées.
- [ ] Correspondance des valeurs (catégories de sources, types de parties prenantes) ; alias de préfixe (mesures citant des risques).
- [ ] Exécution : bilan (6 VM, 8 ER, 10 SR, 14 PP, 8 SS, 13 SO, 13 risques, 13 résiduels, ≥ 8 mesures liées) ; ouvrir l'analyse, vérifier chaque atelier, cotations résiduelles, contexte/titre.
- [ ] Ré-import du même fichier → idempotence (409/reçu), aucun doublon ; réimport avec autre profil.
- [ ] Analyse gelée / autre organisation / rôle LECTEUR → refus (IDOR, 403/404). Méthode ≠ EBIOS RM → pas d'écriture des ateliers.
- [ ] Journal d'audit alimenté ; volumétrie (500+ lignes) et rate limit.

## 4. CSV (`registre-simple-btp.csv`)
- [ ] Séparateur `;`, BOM, cotations en clair, ligne sans intitulé rejetée, doublon de référence signalé ; encodage windows-1252 (export Excel FR).
- [ ] CSV d'export ACRA (`=== … ===`) reste sur l'import ACRA.

## 5. JSON libre (`registre-libre-avocats.json`) — NOUVEAU
- [ ] Feuilles proposées : `Propriétés`, `registre`, `registre.controles` ; mapping manuel (rôle Risques / Mesures) ; colonne « registre » = risque parent (à mapper en `riskExternalId`).
- [ ] Contrôle partagé entre deux risques → deux lignes liées ; valeur hors échelle signalée.
- [ ] Export ACRA `.json` d'une analyse réelle → toujours l'import ACRA (non-régression) ; JSON avec `nom` racine idem.
- [ ] Profil : enregistrer le mapping, ré-importer un second JSON de même forme.

## 6. Points à ajuster si constatés
- UX de sélection d'un risque parent pour les feuilles enfants JSON.
- Reste à développer : liens actifs supports ↔ valeurs métier, avertissement champs calculés (divergence vs vraisemblance × impact), profil JSON persistant par chemins (B-IMP-70 complet), API v2 / MCP (B-IMP-72/73).

## 7. Résultats de la session de test (2026-09-29, Docker + DB locaux, dev :3000)

Exécutés (spec local `e2e/local-import-fixtures.spec.ts`, exclu de git) :
- [x] e2e `analysis-import` + `analysis-import-ateliers` : 4/4 verts.
- [x] Classeurs BTP et avocats (15 feuilles) : profil appliqué + alias `R_`⇒`RI_` coché → **6 VM, 8 ER, 10 SR, 14 PP, 8 SS, 13 SO, 13 risques (stratégies, cotations résiduelles), 15-16 mesures (statuts, échéances, 13-15 liées à leur risque)**, 1 avertissement légitime (écart de gravité SS_04 / SS_06).
- [x] `.xls` : message dédié (Cause / Solution) ; CSV et JSON libre : feuilles proposées dans l'assistant.
- [x] Nettoyage des analyses créées.

Défauts trouvés et corrigés (tests unitaires ajoutés) :
1. Feuille PACS : deux colonnes « Réf. » (regroupement + vraie référence) → doublon « Exploitation » ; `refineReferenceMapping` préfère la colonne aux valeurs uniques.
2. « Description courte » n'était pas reconnue comme intitulé.
3. Feuilles non importées (Sommaire, Métriques) produisaient des « champs écartés » au bilan.
4. Tous les risques résiduels signalés « introuvables » à l'écriture (liste des risques non transmise) alors que les cotations étaient bien appliquées.
5. Message d'écart de gravité illisible (`SS_04:3:2`) ; clés techniques (`title`, `strategy`) dans le bilan → libellés ACRA.
6. Statuts (Terminé, A réaliser…) et stratégies (Réduction, Partage, Évitement…) usuels non reconnus sans profil.
7. Suggestions manquantes : « risques initiaux concernés » → risque lié, « date de mise en œuvre » → échéance.

À traiter / à décider (non corrigé) :
- Étape « Lignes à décider » très longue (≈ 26 groupes) pour des lignes de gabarit (référence + catégorie, sans intitulé) : regrouper par feuille avec une action globale.
- Le bandeau « Appliquer ce profil » n'est pas automatique (par conception) : les suggestions couvrent maintenant l'essentiel, le profil ajoute les correspondances de valeurs.
- Le limiteur de connexion bloque les campagnes e2e répétées (redémarrer le dev pour le réinitialiser).
- Reste non testé : rôle LECTEUR / autre organisation / analyse gelée (IDOR), volumétrie 500+ lignes, ré-import (idempotence), CSV windows-1252, jeu de langues ≠ FR.

### 7 bis — Suite de la session (CSV, JSON libre, droits, idempotence)

Vérifiés en réel (spec local, DB) :
- [x] **CSV** `registre-simple-btp.csv` : rôle Risques détecté, cotations en clair proposées (Critique→4…), **10 risques importés**, ligne sans intitulé et doublon `R-04` **rejetés ligne à ligne** (plus d'échec global).
- [x] **JSON libre** `registre-libre-avocats.json` : feuilles `registre` (Risques) et `registre.controles` (Mesures) détectées, colonne parent liée au risque, **6 risques + 5 mesures** (contrôle partagé fusionné, risques concernés listés) ; seule la valeur hors échelle « Extrême » est signalée.
- [x] **Droits** : profil `DIRECTION_METIER` → 403 (aperçu et exécution) ; anonyme → redirection vers la connexion.
- [x] **Idempotence** : le même classeur importé deux fois ne crée qu'une analyse.
- [x] tsc, `npm test` (2877), `i18n:check`, `npm run build`, e2e import (4/4).

Défauts supplémentaires corrigés (tests unitaires) : cotation mappée à la main perdue avant construction (import partiel) ; doublon de référence bloquait tout l'import → ligne rejetée `DUPLICATE_REFERENCE` (×5 langues) ; contrôle partagé fusionné ; colonne « Risque » / « id » / « code » reconnues ; « libellé + impact + probabilité » détecté comme registre de risques ; feuille `*.controles` → mesures ; cotations en clair proposées (valeurs reconnues seulement, inconnues laissées).

Encore à tester : autre organisation (IDOR), analyse gelée, CSV windows-1252, volumétrie (500+ lignes) et limite de débit, parcours dans une autre langue, thème sombre / mobile de l'assistant, accessibilité clavier du menu « Importer ».

### 7 ter — Isolation, encodage, volumétrie, débit (vérifiés en réel)
- [x] Organisation cible étrangère → 403 ; CSV windows-1252 (accents) lu correctement ; limite de débit : 429 à la 31e requête d'aperçu (30 / 10 min / utilisateur).
- [x] **Volumétrie** : 5 000 lignes → aperçu en 47 ms ; l'exécution tronquait **silencieusement à 500 lignes** → corrigé : erreur claire `excel_too_many_rows` (413, ×5 langues, feuille nommée). Limite : 500 lignes par feuille importée (`IMPORT_MAX_ITEMS`).
- Non testable en import : analyse gelée (l'import crée toujours une nouvelle analyse).
- Reste : thème sombre / mobile / clavier de l'assistant ; import via MCP / API v2 (non développés).
