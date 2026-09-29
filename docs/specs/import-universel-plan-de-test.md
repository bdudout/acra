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
