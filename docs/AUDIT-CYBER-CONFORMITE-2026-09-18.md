# Audit fonctionnel cyber et conformité — préparation de la première stable

Date : 18 septembre 2026. Cibles : démo publique les 19–20 septembre ; CLUSIR le 23 septembre.

## Décision

**Ne pas ouvrir les inscriptions publiques en l'état.** Le produit possède une chaîne cyber riche, mais des défauts de périmètre d'accès et des lacunes de qualification de la livraison empêchent de déclarer cette version stable. Une présentation encadrée reste envisageable après correction des points du scénario et répétition complète.

Cette conclusion remplace, pour la décision de mise en ligne, la note « prêt à 8/10 » de `EVALUATION-GRC-CYBER-DEMO-2026-09-23.md`. Une couverture fonctionnelle ne prouve pas la fiabilité d'un parcours ni l'isolation des testeurs.

## Périmètre et niveau de preuve

Inclus : ateliers EBIOS RM 1–5, tiers cyber, cotation, mesures, approbation, acceptation, conformité du socle/organisation, dérogations, exports et fonctionnement de la démo. Exclus : registre GRC généraliste, RCSA, incidents/pertes, contrôle permanent, audit interne, reporting réglementaire transverse.

État examiné : branche `chore/docs-et-heatmap-mobile`, HEAD `6280c8f0b6489d651fb371326408ec2cbb4085ff` **avec modifications locales préexistantes**. L'audit ne porte donc pas sur une release reproductible. Aucun jeu de données n'a été injecté ; aucune donnée métier existante n'a été modifiée.

Vérifications exécutées :

- `npm test` : **174 fichiers, 1 686 tests réussis**.
- `npx tsc --noEmit -p tsconfig.json` : réussi, aucune erreur rapportée.
- `npm run i18n:check` : réussi, 1 585 clés du catalogue synchronisées avec `fr.ts`. Ce contrôle ne certifie pas l'exactitude des cinq traductions.
- Probes exécutées sur les fonctions TypeScript réelles : risque 5×5 ramené à 4×4 sans mesure réalisée ; un contrôle conforme sur 93 produit un taux de 100 % avec `evalues=1` ; statut NA accepté sans commentaire.
- `/api/health` de l'instance Docker locale : `status=ok`, `db=connected`, **`version=unknown`**. Cela ne prouve ni que son image correspond au code local ni que ses parcours fonctionnent.
- GitHub : dernière exécution Security & Quality consultée réussie sur `b971abb5…`, [run 35243569678](https://github.com/bdudout/acra/actions/runs/35243569678). **Ce SHA n'est pas le HEAD audité.** Aucune release renvoyée par `gh release list`, aucun tag local.
- Les parcours authentifiés, SMTP réel, purge effective, restauration et déploiement public n'ont pas été exécutés. Les trois cas E2E présents couvrent connexion acceptée/refusée et création de dérogation, pas le cycle cyber complet.

Les constats de routes ci-dessous sont établis par lecture de leurs gardes et résolveurs ; ils ne sont pas présentés comme des exploitations HTTP reproduites. Le build de production est consigné séparément en fin de document.

## Capacités utiles et réserves

| Domaine | Capacité constatée dans le code | Réserve pour la démo |
|---|---|---|
| Ateliers 1–4 | Cadrage métier, biens supports, événements redoutés, SR/OV, tiers, scénarios stratégiques/opérationnels | Vérifier en navigation que tous les liens du cas Novera restent cohérents après sauvegarde/rechargement |
| Atelier 5 | Risques initiaux/résiduels, mesures et suivi ; matrice à date | Correction des échelles et distinction estimation/cible/risque validé indispensables |
| Gouvernance | Soumission, approbation RSSI/Risk Manager, décision métier distincte, journalisation | Auto-validation mono-utilisateur existante : ne pas la présenter comme un contrôle à quatre yeux |
| Conformité cyber | Statuts, écarts, traitements, héritage de socle, snapshots | Dénominateur du taux à expliquer ; dérogation ne signifie pas conformité |
| SoA | Export des contrôles, statuts et commentaires, formats CSV/PDF/PPTX | Justifications et décision d'applicabilité insuffisamment structurées pour promettre une SoA complète |
| Démo | Organisation par inscrit, vérification e-mail, exemple chargeable, limites et purge | Amorçage, accès, SMTP, purge et restauration à qualifier sur une instance dédiée |

Référence méthodologique : les [cinq ateliers ANSSI](https://cyber.gouv.fr/securisation/analyse-des-risques/methode-ebios-rm/) relient cadrage, menaces, scénarios et traitement. ACRA en fournit les objets ; leur existence ne constitue pas une labellisation.

## Constats priorisés

P0 = condition de l'ouverture publique ; P1 = correction avant la stable/présentation ; P2 = chantier après la démo. Efforts indicatifs, à confirmer après reproduction et tests.

| ID | Priorité / effort | Constat et preuve | Action / critère de fermeture |
|---|---|---|---|
| C01 | **P0**, 0,5–1 j | Six routes de lecture acceptent `orgId === 'global'` ou `visibles.length === 0`. Or `resolveOrgContext` renvoie une liste vide pour un utilisateur sans appartenance. Conformité, SoA, suivis, traitements et actions sont concernés. | Garde de périmètre commune refusant par défaut, exception SUPER_ADMIN explicite. Tests API : utilisateur sans org, org étrangère, global, sous-arbre autorisé, super-admin focalisé. |
| C02 | **P0 si seed utilisé**, 1–3 h | `prisma/seed-demo-clusir.ts` crée/réinitialise quatre comptes, dont SUPER_ADMIN, avec un mot de passe fixe présent dans le code. | Retirer le secret fixe, injecter des secrets individuels hors dépôt et interdire le seed sur une cible non explicitement dédiée. Si déjà exécuté sur une instance accessible : remplacer les identifiants concernés et invalider les sessions. |
| C03 | **P0**, 2–4 h | Premier inscrit d'une démo prouvée = SUPER_ADMIN (`resolveSignupDecision`). Le guide demande seulement de s'inscrire avant de communiquer l'URL. Une URL non annoncée n'empêche pas une inscription extérieure. | Amorcer l'exploitant avant exposition publique, derrière restriction d'accès ; privilégier la CLI locale après vérification de son usage en démo. Tester que le visiteur suivant n'obtient aucun droit d'instance. |
| C04 | **P0**, 0,5–1 j | CI locale déclarée : tests, TS, i18n et audit dépendances, sans build production ni E2E. Le vert GitHub consulté ne porte pas sur l'état audité. | Qualifier le SHA final avec build, migrations en base vierge et existante, recette cyber et isolation. Associer résultat, image et release au même SHA. |
| C05 | **P1**, 1–3 h | `risk-current.ts` utilise `clamp14`, alors que `risk-scale.ts` autorise 5 niveaux. Probe : risque 5/5, cible 3/3, aucune mesure → 4/4. Utilisé par `RiskMatrixTabs.tsx`. | Test de non-régression puis résolution selon l'échelle effective ; zéro avancement doit conserver le brut. |
| C06 | **P1**, 2–4 h puis P2 | La position « à date » interpole selon le nombre de mesures REALISE, toutes de poids égal, sans preuve d'efficacité. | Afficher explicitement « estimation selon avancement » ; ne pas la présenter comme une réévaluation validée. P2 : décision de cotation datée et justifiée avec preuves. |
| C07 | **P1**, 2–4 h | `conformiteStats` calcule le taux sur les seuls évalués hors NA : 1 conforme/93 contrôles donne 100 %. Ce calcul est documenté, mais peut être pris pour une conformité globale. | Montrer systématiquement le taux **et** « 1/93 évalués », inconnus visibles ; vérifier dashboard et tous les exports. Ne pas changer silencieusement le sens historique du taux. |
| C08 | **P1/P2**, 0,5 j / plusieurs jours | `sanitizeConformite` accepte NA sans justification ; `buildSoaExport` exporte statut et commentaire optionnel, sans champs distincts de justification d'inclusion/exclusion. | P1 : exiger/expliquer une justification des exclusions, vérifier l'export. P2 : SoA structurée, décisions, preuves et revue. Ne pas annoncer une conformité ISO automatique. |
| C09 | **P1**, 2–4 h | Seed CLUSIR : `controlePermanentActive: true`. Conducteur : `/controles`, constat puis écran SUPER_ADMIN. Cela contredit le périmètre cyber/conformité demandé. | Parcours de remplacement ci-dessous ; modules GRC FORCE_OFF via politique d'instance sur la démo dédiée, vérification UI et API. |
| C10 | **P1**, 0,5 j | PATCH général d'analyse permet de modifier périmètre, méthode et statut sans garde `analyseGelee`, présente sur les ateliers. Un statut accepté peut ainsi rester attaché à des métadonnées modifiées. | Test API après acceptation puis gel des champs pertinents ou nouvelle révision invalidant la décision. Vérifier aussi la conservation des métadonnées d'approbation lors d'une réouverture. |
| C11 | **P1**, 2–4 h | `/api/demo/load-example` résout un rôle mais ne l'utilise pas ; aucun `canCreateAnalyse` ni contrôle du plafond, contrairement à POST `/api/analyses`. Création de l'exemple en plusieurs écritures sans transaction globale. | Appliquer droits et quota ; création atomique et protection concurrente. Tests lecteur, plafond, double clic et échec au milieu : aucun exemple partiel persistant. |
| C12 | **P0 qualification**, 0,5–1 j | Mise à jour documentée par `git pull` ; version de santé inconnue ; Dockerfile replie `npm ci` en `npm install` ; app/migrator reconstruits sur le serveur. | Livraison identifiée, sans dépendances recalculées, sauvegarde/restauration testée et procédure stable → stable. Voir guide associé. |

### Fichiers de preuve C01

- `src/lib/org-context.server.ts` : absence d'appartenance → `visibleOrgIds: []`, `isSuperAdmin: false` ; `getAnalyseScope` transmet les deux informations.
- `src/app/api/organizations/[orgId]/conformite/route.ts` (GET).
- `src/app/api/organizations/[orgId]/conformite/soa/route.ts`.
- `src/app/api/organizations/[orgId]/conformite/suivis/route.ts`.
- `src/app/api/organizations/[orgId]/conformite/traitements/route.ts`.
- `src/app/api/organizations/[orgId]/plans-actions/route.ts`.
- `src/app/api/organizations/[orgId]/action-items/promotable/route.ts`.

La correction doit distinguer lecture et écriture : certaines écritures utilisent déjà `getEffectiveRoleForOrg`. Ne pas déduire de ce constat que toutes les écritures sont ouvertes.

## Lots proposés

1. **Lot A — ouverture sûre** : C01, C02, C03, C11, tests d'isolation sur deux organisations. Prioritaire même pour une démo ne contenant que des données fictives.
2. **Lot B — démo métier fidèle** : C05, C06, C07, C09, C10 ; C08 limité aux justifications et à la formulation de la promesse.
3. **Lot C — première stable** : C04, C12, build/image et migrations, recette de l'exact candidat, SMTP, purge et restauration ; tag/release seulement après réussite.
4. **Après CLUSIR** : SoA et preuve d'efficacité structurées, vraie réévaluation du risque courant, suivi de fraîcheur des preuves, profils CSF actuel/cible. Aucun élargissement GRC avant stabilisation du socle cyber.

Estimation globale : plusieurs jours de travail avec recette, pas une promesse de livraison en quelques heures. Pour dimanche, réduire le périmètre visible et reporter les nouveautés plutôt que supprimer les portes de validation. Si un P0 reste ouvert, garder une démo privée pour le CLUSIR.

## Parcours CLUSIR proposé — 15 minutes, cyber/conformité seulement

Conserver Novera et Orion Admin pour rester cohérent avec les supports déjà préparés.

| Durée | Écran / action | Message |
|---|---|---|
| 2 min | Atelier 1 : facturation, actifs, altération redoutée, socle | Le risque commence par l'impact métier |
| 4 min | Ateliers 2, 3, 4 : SR/OV, tiers, chemin d'attaque | Une chaîne de raisonnement explicable |
| 3 min | Atelier 5 : risque initial, cible, mesures, responsables, échéances | La cible dépend de mesures réalisées et vérifiées |
| 2 min | Conformité cyber : exigence, écart, traitement et justification | Un plan d'action ou une dérogation ne rend pas un contrôle conforme |
| 2 min | RSSI : approbation ; direction : acceptation distincte | Qui valide l'analyse, qui assume le risque |
| 2 min | Synthèse et export pré-généré | Une décision traçable et révisable |

Activer explicitement acceptation des risques et, si montrées, dérogations : ces deux fonctions sont désactivées dans les défauts d'organisation. Préparer des comptes séparés. Retirer la séquence contrôle permanent et administration d'instance. Le conducteur existant et les slides restent à adapter dans le lot B ; ils n'ont pas été modifiés par cet audit.

## Recette bloquante de la première stable

Exécuter sur base dédiée à la recette, avec données fictives. Conserver pour chaque cas : SHA/image, date, rôle, résultat, capture ou trace ; « non exécuté » n'est jamais « réussi ».

| Cas | Résultat attendu |
|---|---|
| Exploitant puis deux inscriptions | Exploitant créé avant exposition ; OTP reçu ; testeurs isolés, jamais SUPER_ADMIN |
| Deux organisations + compte sans appartenance | Aucun accès croisé aux analyses, conformité, SoA, exports et actions, y compris par URL/API et `global` |
| Création puis A1→A5 | Saisie, sauvegarde, rechargement et liens conservés ; pas d'échec d'autosave masqué |
| Échelles 4 et 5 | Brut inchangé sans mesure réalisée ; cible et seuils cohérents dans UI et export |
| Soumettre/rejeter/corriger/approuver | Bon rôle, bon état, commentaire de rejet, quatre-yeux ; décision journalisée |
| Accepter puis tenter une modification | Direction distincte, gel effectif, nouvelle version nécessaire pour changer le fond |
| Conformité et NA | Non évalué visible, NA motivé, taux avec dénominateur, traitement ≠ conformité |
| Dérogation si retenue | Autorisation, échéance, statut actif/expiré et impact sur l'écart cohérents |
| Export PDF et SoA | Génération avec l'image de production ; données, langue, version et scores exacts |
| Démo | Chargement idempotent/atomique, quotas, compte lecteur refusé ; préavis et purge sans toucher une org non ciblée |
| Déploiement / retour arrière | Installation vierge, migration version précédente, sauvegarde restaurable, version visible et retour qualifié |

La [note pédagogique du groupe de pratiques d'audit ISO sur la SoA](https://committee.iso.org/files/live/sites/jtc1sc27/files/resources/ISO-IECJTC1-SC27-WG1_N3298_Auditing%20Practices%20Note%20-%20SoA.pdf), non approuvée formellement par l'ISO selon son avertissement, constitue une piste pour approfondir le chantier SoA, pas un substitut au texte normatif ; cet audit n'est pas une certification.

## Résultat du build

Deux tentatives exécutées de `npm run build`, aucune validée :

1. Échec de téléchargement de la police Inter depuis Google Fonts dans l'environnement restreint.
2. Relance avec demande d'accès réseau : échec interne Turbopack/PostCSS lors de la création d'un processus et liaison d'un port, `Operation not permitted (os error 1)`.

Ces échecs ne démontrent pas une régression applicative : la qualification du build reste **non acquise dans cet environnement**, à refaire en CI ou dans un environnement de build autorisé. Avertissements observés : `experimental.instrumentationHook` non reconnu, convention `middleware` dépréciée et adaptateur optionnel `document-storage-s3` introuvable. À trier sans engager une migration technique générale avant CLUSIR.

Traces locales de cette session : `/tmp/acra-audit-tests.log`, `/tmp/acra-audit-tsc.log`, `/tmp/acra-audit-i18n.log`, `/tmp/acra-audit-build.log`, `/tmp/acra-audit-build-network.log`. Ces fichiers temporaires ne sont pas une archive de preuves de release.


## Suivi de correction — 19 septembre 2026

Les constats ci-dessus décrivent l’état initial. Les corrections locales couvrent
C01–C03, C05–C08, C10 et C11 : périmètre fermé par défaut, amorçage CLI, seed
protégé, échelle 5 conservée, taux explicite, NA motivé, gel et exemple atomique.
C09 : conducteur cyber réécrit et seed limitant les modules ; slides à aligner.
C04/C12 : CI build/E2E et workflows release/déploiement ajoutés, qualification
GitHub/image/OVH encore en cours. Aucune stable publiée à ce stade.

Preuves locales : 188 fichiers / 1 733 tests réussis, TypeScript et i18n réussis.
Build Webpack réussi ; quatre E2E sur base PostgreSQL isolée réussis, dont le
cycle cinq ateliers → approbation → acceptation → gel → PDF réel et les refus
hors périmètre. Une régression de chargement PDF en build a été corrigée puis
retestée. Le build final sera revalidé sur le SHA exact par GitHub.

VPS inspecté par SSH : `/home/debian/acra`, branche main à `77be373`, historique
de `git pull`, ancien conteneur du 22 juillet ; instance DEMO, sept analyses.
Aucun document dans les deux emplacements historiques vérifiés ; PostgreSQL
non publié sur l’hôte. Sauvegarde base/config protégée réalisée dans
`/home/debian/acra-backups/pre-release-20260919`, image précédente conservée.
Le dump a été restauré avec `ON_ERROR_STOP` dans une base temporaire distincte :
sept analyses retrouvées, base temporaire ensuite supprimée. Cela qualifie la
restauration du dump actuel, pas encore le rollback d’une nouvelle release.
SMTP existant configuré sur `ssl0.ovh.net:587`, dernier test mémorisé du 9 juillet ;
la cible demandée `smtp.mail.ovh.net` reste à tester avant changement.

Restent bloquants : recette de l’image exacte, migration de l’existant, SMTP et
inscription e-mail réels, purge sur données fictives, déploiement/rollback et
recette publique. Les tests unitaires du rollback ne remplacent pas cet essai.
