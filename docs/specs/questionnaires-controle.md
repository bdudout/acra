# Expression de besoin — questionnaires de contrôle, missions de contrôle et conformité

Statut : **décisions prises, en développement** (1er octobre 2026). Lot 0 livré : la page de conformité affiche ce que constatent le contrôle permanent et l'audit (§ 5).

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
