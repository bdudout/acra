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

Écarts avec la proposition (§ 2-3) : préconisations dans un modèle propre plutôt que `AuditConstat` (droits et périmètre différents, même fonctions de cycle de vie) ; preuves en data URL dans la réponse (`lib/preuves`, types inertes, 3 par question, 15 par réponse) plutôt que `Document` ; pas de statut `EN_REVUE` ; une NON_CONFORME rattachée à un point de contrôle **ne crée pas** d'exécution de contrôle (à décider) ; pas de relances automatiques.

