# Résultats — Opus 5.5 seul / Opus 5.5 contraint par ACRA (santé, assurance santé, interconnexions — 2026-10-03)

Protocole : `docs/specs/benchmark-acra-vs-claude.md`. Énoncés et grille : [`tasks.md`](tasks.md) (écrits avant
l'enrichissement du contenu et avant les réponses). Réponses : [`reponses/`](reponses/).

- **Seul** : Opus 5.5, aucun outil, aucun fichier, pas de web.
- **ACRA** : Opus 5.5 limité à `scripts/acra-tool.ts` (outils de connaissance d'ACRA, catalogue 1.12) ; 14 appels,
  contrôle a posteriori : aucune lecture du dépôt (le seul `Read` portait sur la sortie de son propre appel d'outil).
- **Notation** : un évaluateur Opus 5.5 indépendant par tâche, à l'aveugle (réponses anonymisées : marqueurs
  « [ACRA] », clés de catalogue et mentions « expertise » retirés ; ordre X/Y tiré au sort), grille de faits + qualité /3,
  −1 par référence inventée.

| Tâche | ACRA | Seul | Verdict (confiance) | Ce qui a fait la différence |
|---|---|---|---|---|
| T6 Portail de données de santé (EBIOS 1-5) | **16,5/18** | 15/18 | **ACRA** (70 %) | ACRA couvre l'accès du médecin de ville hors relation de soins, le rebond portail → DPI (flux à sens unique), FranceConnect ; le seul est plus fin techniquement (chaîne MITRE, infogérant, sauvegardes immuables) |
| T7 Prestataire qui livre des données (mutuelle) | 14 | **14,5** | Seul (55 %, « quasi-égalité ») | Seul : injection via le parseur et validation stricte, registre DORA ; ACRA : rapprochement flux ↔ paiements avant remise bancaire, jetons de courte durée, KRI complets (unité, sens, périodicité). ⚠ La note qualité d'ACRA a été baissée pour des « [] » vides : **artefact de notre anonymisation** (clés de catalogue retirées), pas de la réponse |
| T8 Échange métier assureur ↔ délégataire | 13,5 | **14** | Seul (55 %, « quasi-égalité ») | ACRA : méthode EBIOS rigoureuse (exposition/fiabilité calculées, zones cohérentes, effet de concentration multi-délégants) mais **pas de validation de schéma** ; seul : vecteurs techniques plus fins (XXE, injection de formules), zones de cartographie incohérentes |
| T9 Contrôles et KRI d'une plateforme e-santé | 13/14 | 13/14 | Égalité (55 %) | ACRA plus spécifique (cloisonnement entre clients, accès de support, enregistrement des téléconsultations) mais **pas de test de continuité** ; seul ne contrôle pas la certification HDS de la plateforme elle-même |
| T10 Télésurveillance (**témoin**, aucun contenu dédié) | **13/13** | 12,5/13 | **ACRA** (65 %) | ACRA : références plus précises, mesures typées, obligations de déclaration ; seul : fatigue d'alerte et RTO clinique, mais une remarque DORA/mutuelle hors sujet |

**Aucune référence inventée** dans les dix réponses (selon les évaluateurs, de mémoire).

## Lecture honnête

- **Bilan : 2 victoires ACRA (T6, T10), 2 victoires « seul » de justesse (T7, T8), 1 égalité.** Les écarts sont
  faibles (0,5 à 1,5 point) et, sauf T6, dans le bruit d'un passage unique. On ne peut **pas** conclure à une
  supériorité générale d'ACRA sur ces sujets.
- **Là où ACRA aide** : la couverture des points « métier » non techniques que l'on oublie (relation de soins du
  médecin de ville, identitovigilance INS, rapprochement avant paiement, cloisonnement entre délégants), la
  cohérence méthode (cotations EBIOS calculées, KRI bien formés) et la traçabilité (chaque proposition vient d'un
  élément identifiable du catalogue, réutilisable tel quel dans l'outil).
- **Là où ACRA n'aide pas** : la finesse des vecteurs d'attaque techniques (MITRE, XXE, parseurs), que le modèle
  seul produit très bien. L'agent ACRA s'appuie sur le catalogue et explore moins sa propre expertise.
- **T10 (témoin)** : ACRA ne gagne pas grâce à un contenu écrit pour la tâche mais par réutilisation du socle santé et
  interconnexions — signe que le contenu se généralise un peu (un seul passage : à confirmer).

## Biais et limites

- Un seul passage par condition, pas de variance mesurée ; évaluateurs du même modèle que les candidats.
- **Contamination** : l'auteur du contenu ACRA a lu les réponses « seul » **après** avoir arrêté le plan du contenu
  mais **avant** de l'écrire (les éléments écrits étaient planifiés ; le risque de « teaching to the test » n'est pas nul).
- Anonymisation imparfaite : ses artefacts ont pénalisé ACRA sur la forme en T7.
- La grille est la nôtre, sans relecture par un expert ; condition « seul » sans web.

## Pistes d'amélioration (non appliquées, pour ne pas biaiser un prochain passage)

- Portail : risque « pièce jointe malveillante via la messagerie patient » et intégrité du contenu des documents
  (aucune des deux conditions ne l'a couvert).
- Interconnexions : rendre plus visibles la validation de schéma et le durcissement des analyseurs de fichiers
  (présents dans les mesures communes mais non repris par l'agent).
- E-santé : contrôle « test de continuité » propre à la plateforme.
- Refaire le comparatif sur des tâches **voisines non vues** (autre type d'organisme) et avec 3 passages.
