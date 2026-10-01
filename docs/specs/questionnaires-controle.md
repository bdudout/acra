# Expression de besoin — questionnaires de contrôle, missions de contrôle et conformité

Statut : **livré** (1er octobre 2026) — lots 0 à 4, cf. § 7 pour ce qui a été réellement implémenté et les écarts avec la proposition initiale.

## 1. Besoin exprimé

En contrôle permanent, il faut pouvoir faire répondre les métiers (1ʳᵉ ligne) à des questionnaires, de deux façons :

1. **Exigences à justifier** : le métier répond à des exigences (d'un référentiel) en joignant des **preuves**, que les **contrôleurs revoient**.
2. **Questionnaires** : le métier répond à des questions associées à des **points de contrôle**, des **exigences**, des **risques** ou des **processus**.

Les réponses complétées alimentent le travail des contrôleurs : **préconisations** et **plans d'action**, rattachés à des **missions de contrôle** qui donnent lieu à un **rapport de contrôle**.

Quand une exigence est contrôlée **non conforme** (contrôle permanent ou audit), la conformité au référentiel doit en être affectée, au moins sous la forme d'une **association visible depuis la page de conformité**.

## 2. Existant réutilisé

| Brique | Existant | Usage prévu |
|---|---|---|
| Contrôle | `Controle` (référentiel + `exigenceRefs`, processus, risque, `checklist`) et `ControleExecution` (résultat, preuves, checklist OK/KO/NA) | Un point de contrôle peut porter un questionnaire ; une revue de réponse peut produire une exécution. |
| Campagne / mission de contrôle | `CampagneControle` (niveau, périmètre de contrôles, récurrence, clôture, rapports **déposés**) | Devient la **mission de contrôle** : on y ajoute questionnaires envoyés, préconisations et rapport **généré**. |
| Constats | `AuditConstat` (recommandation, échéance, suivi, vérification, référentiel + exigence, risque) | Même cycle de vie pour les **préconisations de contrôle** (source « contrôle permanent ») plutôt qu'un second modèle. |
| Plans d'action | `PlanAction` + `PlanActionLien` (types ANALYSE, CONFORMITE, CONTROLE, AUDIT, RISQUE…) | Une préconisation ouvre un plan d'action lié (nouveau type de lien MISSION_CONTROLE). |
| Preuves | `Document` (stockage, empreinte, version) | Pièces jointes aux réponses. |
| Conformité dérivée | `couverture-referentiel.ts` (contrôles + constats d'audit par exigence) | Étendue aux réponses revues non conformes (§ 5). |

## 3. Modèle proposé

- **Modèle de questionnaire** (`QuestionnaireModele`) : titre, questions ordonnées `{ id, libellé, type : OUI_NON | CHOIX | TEXTE | NOMBRE | DATE, choix?, obligatoire, preuveRequise, rattachement? }`. Rattachement de chaque question (ou du questionnaire) à : un point de contrôle (`Controle` ou item de checklist), une exigence (`referentielCode` + `ref`), un risque (`RiskItem`), un processus (`Processus`).
  - **Mode « exigences à justifier »** : modèle généré depuis un référentiel (une question par exigence choisie : « Conforme ? » + preuve requise).
- **Envoi** (`QuestionnaireEnvoi`) dans une mission de contrôle : modèle, destinataires (comptes de l'organisation, par personne ou par entité), échéance, relances.
- **Réponse** (`QuestionnaireReponse`) : par destinataire, statut `A_REPONDRE → SOUMISE → EN_REVUE → REVUE` (ou `A_COMPLETER` renvoyée au métier), réponses par question avec preuves (`Document`).
- **Revue** par question, par le contrôleur : `ACCEPTEE | A_COMPLETER | NON_CONFORME` + commentaire. Une question NON_CONFORME rattachée à une exigence compte comme une anomalie sur cette exigence ; rattachée à un point de contrôle, elle alimente l'exécution du contrôle (résultat ANOMALIE).
- **Préconisation** : constat de mission de contrôle (même cycle que `AuditConstat`, source CONTROLE_PERMANENT), créée par le contrôleur depuis une réponse non conforme ; ouvre si besoin un plan d'action lié.
- **Rapport de contrôle** : document généré à la clôture de la mission (périmètre, questionnaires et taux de réponse, revues, anomalies par exigence / processus / risque, préconisations et plans d'action), en plus des rapports déposés.

Droits : le métier ne voit que ses envois et ses réponses ; la revue, les préconisations et le rapport relèvent de la 2ᵉ ligne (`peutDefinir2eLigne`) ; isolation par organisation, journal d'audit sur soumission et revue, limites de taille sur les preuves.

## 4. Découpage proposé

1. **Lot 1 — questionnaires et réponses** : modèles (avec génération depuis un référentiel), envoi dans une mission, réponse du métier avec preuves, revue par le contrôleur.
2. **Lot 2 — préconisations et plans d'action** : création depuis une réponse non conforme, suivi, lien au plan d'action.
3. **Lot 3 — rapport de contrôle** généré à la clôture de la mission.
4. **Lot 4 — conformité** : réponses revues NON_CONFORME prises en compte dans la conformité dérivée (§ 5).

## 5. Conformité : déclaré vs constaté (lot 0, livré)

Sur la page de conformité (`/conformite/socle`), chaque exigence affiche ce que constatent le contrôle permanent (efficacité des contrôles qui la couvrent) et l'audit (constats ouverts) ; une exigence **déclarée conforme mais en anomalie** est signalée « à revoir », avec un compteur en tête de page. Le statut déclaré **n'est jamais modifié automatiquement** (`confronterDeclaration`, `conformite-constats.ts`).

## 6. Décisions (1er octobre 2026)

1. **Répondants** : comptes de l'organisation uniquement.
2. **Suite des réponses** : le contrôleur pose des **préconisations** ; le **métier** y répond par un **plan d'action**, suivi dans les plans d'action. Le lien à la conformité est **visible mais facultatif**. Le métier peut aussi faire **accepter le risque**, avec un suivi dans la conformité (traitement « acceptation de risque »).
3. **Conformité** : la non-conformité constatée est affichée et le responsable peut **mettre à jour le statut en un clic** (trace dans le commentaire). Jamais de mise à jour automatique.
4. **Préconisations** : même cycle de vie que les constats d'audit (recommandation, responsable, échéance, report, réalisation, vérification par une autre personne).

## 7. Implémentation livrée (1er octobre 2026)

Page `/controles/questionnaires` (menu Contrôle & audit, module contrôle permanent actif, tout rôle sauf LECTEUR), onglets : **À répondre** (métier), **Préconisations** (contrôleur : toutes ; métier : celles dont il est responsable), **Modèles** et **Envois et revue** (2ᵉ ligne, `peutDefinir2eLigne` sur le rôle **effectif**).

| Lot | Livré | Code |
|---|---|---|
| 1 — questionnaires | Modèles libres (questions OUI_NON/CHOIX/TEXTE/NOMBRE/DATE, obligatoire, preuve requise, rattachement contrôle/exigence/risque/processus) ou « exigences à justifier » générés depuis un référentiel ; envoi (questions **figées** à l'envoi) à des comptes de l'organisation, rattachable à une mission ; brouillon, soumission bloquée tant qu'une réponse obligatoire ou une preuve requise manque ; revue par question (ACCEPTEE / A_COMPLETER / NON_CONFORME + commentaire), jamais par le répondant lui-même. | `lib/questionnaire.ts` (pur), `lib/questionnaire.server.ts`, routes `api/questionnaires/**` |
| 2 — préconisations | Modèle `Preconisation` dédié (même cycle de vie que les constats d'audit via `appliquerSuivi` : réalisation, vérification, réouverture, report) ; créée depuis une réponse NON_CONFORME (hérite l'exigence / le risque / le processus / le contrôle et le répondant comme responsable) ou librement ; le métier répond par un **plan d'action** (lien `PRECONISATION`, et facultativement `CONFORMITE` / `RISQUE`) ou **accepte le risque** (justification, traitement de conformité `ACCEPTATION_RISQUE` facultatif). | routes `api/preconisations/**` |
| 3 — rapport | Rapport de contrôle Word **à la demande** depuis la liste des missions (📄) : synthèse, exécutions des contrôles du périmètre dans la fenêtre, questionnaires et taux de réponse, non-conformités relevées et leur rattachement, préconisations, plans d'action et acceptations, conclusions à compléter. | `lib/rapport-mission-controle.ts` (pur), `api/controles/campagnes/[id]/rapport-controle` |
| 4 — conformité | Les réponses revues NON_CONFORME sur une exigence (non reprises par une préconisation) et les préconisations ouvertes comptent comme anomalies **de contrôle** dans la couverture ; la page de conformité les affiche et propose la mise à jour en un clic. | `couverture-referentiel.ts` (`nbAnomaliesControle`), `/api/referentiels/couverture` |

Écarts avec la proposition (§ 2-3) : préconisations dans un modèle propre plutôt que `AuditConstat` (droits et périmètre différents, même fonctions de cycle de vie) ; preuves en data URL dans la réponse (`lib/preuves`, types inertes, 3 par question, 15 par réponse) plutôt que `Document` ; pas de statut `EN_REVUE`.

### 7.1 Compléments (décisions du 1er octobre 2026)

- **Non-conformité sur un point de contrôle ⇒ exécution « anomalie »** : à la revue **conclue** (statut REVUE, pas lors d'un renvoi « à compléter »), chaque question NON_CONFORME rattachée à un contrôle actif de l'organisation enregistre une exécution `ANOMALIE` de ce contrôle (`source = QUESTIONNAIRE`, constat = questionnaire, question et commentaire du contrôleur, preuves du répondant, exécutant = contrôleur), dans la même transaction que la revue. L'efficacité du contrôle et la conformité dérivée en tiennent compte. **La préconisation reste facultative** ; aucun plan d'action n'est créé automatiquement (`anomaliesControles`, route de revue).
- **Relances automatiques** (`lib/relances.ts`, cron `relances`, quotidien) : questionnaires à répondre ou à compléter (répondant), préconisations ouvertes (responsable, sinon gouvernance) et **plans d'action** ouverts (responsable de la préconisation liée, sinon porteur reconnu parmi les membres par e-mail ou nom, sinon gouvernance RSSI / RISK_MANAGER / ADMIN). Une relance quand l'échéance entre dans la fenêtre (14 jours par défaut), une au dépassement, puis **tous les 30 jours par défaut** tant que l'élément reste ouvert (avec ou sans échéance). Un seul e-mail par personne et par organisation, en 5 langues. Anti-doublon par `rappelLe`. Paramétrage par organisation (`relancesConfig` : actives, jours avant, périodicité ; 0 = pas de relance périodique), éditable par l'ADMIN dans l'onglet « Relances », visible en lecture par la 2ᵉ ligne. Migration `20261001170000_relances`.
- **Relances des décisions en attente** (même cron, même paramétrage ; première relance après `attenteJours`, 7 par défaut, puis tous les `periodiciteJours`) :
  - préconisation **déclarée réalisée, à vérifier** → le contrôleur qui l'a posée, sinon la 2ᵉ ligne de l'organisation (jamais le responsable) ;
  - **analyse soumise** → approbateurs (RSSI et Risk Manager, jamais l'auteur ni un accès granulaire sans droit d'APPROBATION ; administrateurs à défaut) ; **projet 360** → le rôle dont l'avis manque encore ;
  - **dérogation en revue** → RSSI pour l'avis (≠ demandeur) et le double regard (≠ premier avis, RSSI du groupe inclus via les organisations parentes à portée « sous-arbre »), direction métier pour la validation (administrateurs à défaut) ; seulement si le module Dérogations est actif ;
  - les **constats d'audit réalisés** restent relancés vers l'audit par le cron `audit-rappels` (paramétrage de l'audit).
  `Analyse.soumisLe` (posé à la soumission, repris pour les analyses déjà soumises) et `rappelLe` sur `Analyse` et `Derogation` : migration `20261001180000_relances_validations`.
- **Un seul e-mail de synthèse par personne** (décision du 1er octobre 2026) : toutes les relances partent d'un même passage quotidien (`executerRelances`, `lib/relances.server.ts`) et sont regroupées par destinataire, **toutes organisations confondues** (le nom de l'organisation préfixe chaque ligne quand il y en a plusieurs), triées du plus urgent au moins urgent. Le passage reprend aussi les relances qui partaient jusque-là en e-mails séparés : recommandations d'audit (échéance, retard, à vérifier — règles et paramétrage de l'audit inchangés), contrôles à exécuter, dérogations arrivant à expiration. Les routes `audit-rappels`, `controles-echeances` et `derogations-expiry` restent appelables mais exécutent ce même passage, idempotent (marqueurs par élément) : aucun double envoi. Seule la synthèse mensuelle des dérogations (`derogations-digest`) reste un e-mail à part.
- **Tableau de bord mensuel** (décision du 1er octobre 2026) : le 1er du mois, pour le mois écoulé, un e-mail par RSSI et gestionnaire des risques (administrateurs à défaut ; gestionnaires du groupe inclus pour les filiales via la portée « sous-arbre »), une section par organisation : indicateurs clés des modules actifs (risques élevés et hors appétit, plans d'action en retard, incidents, incidents majeurs DORA et perte nette du mois, taux de contrôles conformes et anomalies du mois, préconisations et recommandations d'audit en retard, constats critiques, KRI en alerte, dérogations à expirer ou expirées, décisions en attente) puis **points d'attention** nommés (3 au plus par type, 12 au total, le plus grave d'abord). Règles des modules réutilisées (`lib/tableau-bord-mensuel.ts`, pur). Un seul envoi par mois (`EnvoiPeriodique`, unicité tâche + période). Remplace la synthèse mensuelle des dérogations (`derogations-digest` devient un alias). Désactivable par organisation (onglet « Relances »).

