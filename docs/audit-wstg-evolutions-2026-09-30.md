# Audit ciblé OWASP WSTG — évolutions récentes ACRA

Date : 30 septembre 2026. Périmètre : vues `/actions` et `/projets`, import de risques « projet 360 », imports historiques Excel et éditions de rapports. Référence méthodologique : [OWASP WSTG v4.2](https://wstg.owasp.org/stable/), notamment [WSTG-ATHZ-02](https://wstg.owasp.org/v4.2/4-Web_Application_Security_Testing/05-Authorization_Testing/02-Testing_for_Bypassing_Authorization_Schema/), [WSTG-BUSL-02](https://wstg.owasp.org/latest/4-Web_Application_Security_Testing/10-Business_Logic/02-Ability_to_Forge_Requests/) et [WSTG-BUSL-08](https://wstg.owasp.org/latest/4-Web_Application_Security_Testing/10-Business_Logic/08-Upload_of_Unexpected_File_Types/).

Il s'agit d'une revue de code et de tests ciblés, **pas** d'une certification WSTG complète ni d'un pentest authentifié de la démonstration. Les sévérités ci-dessous concernent les défauts observés avant les correctifs de ce lot.

## Constats confirmés et traités

| Priorité | Contrôle | Constat et impact avant correction | Correction et preuve |
| --- | --- | --- | --- |
| Haute | WSTG-ATHZ-02 | `/actions` chargeait les mesures, mesures d'écosystème et plans liés à toutes les analyses d'une organisation, y compris privées ou en corbeille. Un analyste autorisé dans l'organisation pouvait donc lire des données d'une analyse non partagée. | `gatherActionItems` calcule d'abord les ID d'analyses visibles avec `analyseWhereClause`, puis restreint les trois requêtes concernées. Tests `action-items-access.test.ts` : propriétaire/partage, exclusion corbeille, aucune analyse visible. |
| Haute | WSTG-BUSL-02 | Deux demandes simultanées de changement de statut d'un rapport pouvaient toutes deux valider l'ancien statut. Pour `DIFFUSE`, l'e-mail partait avant l'enregistrement du statut, avec risque de double diffusion. | Les transitions et la suppression passent par `updateMany`/`deleteMany` conditionnés par ID, organisation et statut initial ; la seconde requête reçoit `409`. Les e-mails ne sont déclenchés qu'après la transition gagnante. Tests `rapports-id.route.test.ts`. |
| Moyenne | WSTG-ATHZ-02 | L'import de risques « projet 360 » filtrait les analyses sources avec le rôle de session, puis avec le rôle de l'organisation active, qui peut différer de celui de l'organisation cible. Une appartenance cible moins privilégiée pouvait ainsi être ignorée. | Le rôle effectif est résolu **dans l'organisation de la cible**, avec repli `LECTEUR` sans appartenance ; le filtre reste borné à cette organisation. Une cible historique sans organisation est refusée. Tests `projet360.route.test.ts`. |

## Contrôles effectués sans défaut confirmé dans ce périmètre

- `/actions` et `/projets` : le super-administrateur sans organisation active obtient une lecture consolidée des organisations visibles. Les contrôles de création/édition gardent une organisation active explicite. Le filtre des projets conserve `analyseWhereClause`, donc exclut notamment la corbeille. Tests `org-context.test.ts`.
- Import Excel historique : la cible est vérifiée par `getEffectiveRoleForOrg` et `canCreateAnalyse`, l'extension et la signature sont confrontées, et les archives XLSX sont bornées avant ExcelJS. Cela couvre les contrôles statiques principaux de WSTG-BUSL-08 ; aucun fichier malveillant réel n'a été exécuté.
- Accès non authentifié à `/actions` sur `https://acra-cyber.com` : redirection HTTP 307 vers l'authentification observée ; présence des en-têtes HSTS, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` et `Referrer-Policy` vérifiée. Cette requête ne démontre pas les droits d'une session authentifiée.

## Risques résiduels et actions suivantes

1. **P2 — diffusion de rapport partiellement échouée.** La transition vers `DIFFUSE` précède l'envoi SMTP et l'enregistrement des destinataires. Si la fonction d'envoi ou la sauvegarde échoue brutalement, le rapport peut rester `DIFFUSE` sans bilan fiable ni relance sûre. Prévoir une intention de diffusion persistée, un état intermédiaire et un traitement idempotent par destinataire (outbox), puis tester les pannes SMTP/DB.
2. **P2 — corps JSON surdimensionnés.** Les routes d'import analysent `req.json()` avant toute limite de taille de corps au niveau applicatif. Les schémas Zod limitent `data` à 14 Mo et les classeurs décompressés sont bornés, mais ces garde-fous interviennent après le parsing JSON. Ajouter une limite de corps HTTP/stream en amont et tester un transfert chunked dépassant la limite. La disponibilité et le paramétrage du reverse-proxy n'ont pas été vérifiés de bout en bout.
3. **P2 — validation dynamique à compléter.** Rejouer sur un environnement de recette isolé les matrices de rôles (analyste, lecteur, admin d'organisation, super-admin focalisé ou non), les accès à des analyses privées/supprimées, deux transitions `DIFFUSE` concurrentes, les imports malformés et les échecs SMTP. Une observation locale authentifiée ou un test de pénétration de la démo n'a pas été réalisé dans ce lot.
4. **P3 — dépendances.** `npm audit --omit=dev --audit-level=high` n'a pas pu aboutir : DNS indisponible dans le bac à sable, puis exécution réseau refusée par la revue automatique car elle transmet l'arbre des dépendances au registre. Aucun verdict « sans vulnérabilité » n'est donc revendiqué. Relancer dans une CI autorisée.

## Vérifications exécutées

- TDD : chaque correctif ci-dessus a d'abord été couvert par un test rouge, puis vert.
- `NODE_NO_WARNINGS=1 npm test -- --reporter=dot --maxWorkers=2` : **361 fichiers, 2 931 tests réussis** sur la version finale. Un premier lancement à concurrence implicite a expiré sur le démarrage de workers Vitest ; la relance limitée à deux workers est verte.
- `npx tsc --noEmit` : réussi sur la version finale. `git diff --check` : réussi sur les fichiers suivis.
- `npm run build` : réussi ; les routes dynamiques `/actions` et `/projets` figurent dans la compilation de production. Avertissements non bloquants préexistants sur `document-storage.ts` (dépendance dynamique) et la convention `middleware`.

Ce rapport n'affirme ni couverture WSTG exhaustive, ni absence de vulnérabilité sur les composants non audités.
