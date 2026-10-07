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

---

# Passage 2 — après application des pistes d'amélioration (catalogue 1.13)

**Changements côté ACRA** (commit `0520f01`, génériques, pas écrits pour une tâche) : techniques MITRE ATT&CK sur les
actions élémentaires, validation de schéma et analyseurs de fichiers durcis, pièces jointes de la messagerie d'un
portail et intégrité du contenu publié, test de continuité d'une plateforme e-santé, personnes concernées et autorités
dans l'écosystème, **consignes de restitution** renvoyées par `read_sector_examples` et `read_catalogue` (compléter le
socle par la chaîne d'attaque et les vecteurs techniques, pas d'identifiants internes).
**Changement de mode d'emploi** : la consigne de l'agent ACRA lui demande explicitement de compléter le socle par son
expertise et de ne pas écrire d'identifiants internes ni de marqueurs de source.

**Protocole** : condition « seul » inchangée (réponses du passage 1 pour T6–T10) ; deux tâches **voisines non vues**
T11–T12 ajoutées avant les améliorations, jouées par les deux conditions ; nouveau tirage X/Y ; un évaluateur Opus 5.5
indépendant par tâche.

| Tâche | ACRA (p. 2) | Seul | Verdict (confiance) | Ce qui a fait la différence |
|---|---|---|---|---|
| T6 Portail | **18/18** | 14,5/18 | **ACRA** (85 %) | grille complète (médecin hors relation de soins, messagerie piégée, rebond DPI, intégrité), ATT&CK dense et exact |
| T7 Prestataire de données | **14/15** | 13/15 | **ACRA** (65 %) | analyseurs, DMZ à rapatriement interne, validation des réponses d'API, KRI complets |
| T8 Assureur ↔ délégataire | **15/16** | 14,5/16 | **ACRA** (60 %) | cartographie EBIOS complète et calculée (assurés, autorités, maillon faible indirect), ATT&CK exact |
| T9 Plateforme e-santé | 13/14 | 13/14 | Égalité (55 %) | ACRA plus spécifique (WebRTC, cloisonnement) mais pas de contrôle des sous-traitants |
| T10 Télésurveillance (témoin) | 12/13 | 12/13 | Égalité (55 %, léger avantage ACRA) | ACRA : cotations et références ; seul : escalade des alertes |
| **T11 Laboratoire (non vue)** | **14,5** | 13,5 | **ACRA** (70 %) | INS, MSSanté, rendu téléphonique des résultats critiques, autovalidation HL7/ASTM, 16 ATT&CK exacts |
| **T12 Courtier gestionnaire (non vue)** | 12,5 | **14** | Seul (70 %) | ACRA : **−1 pour une référence mal appliquée** (ISO/IEC 27001:2022 A.8.28 « codage sécurisé » cité pour un contrôle de complétude de fichiers), contrôles tous typés « détectif » ; meilleur sur le contrôle des droits à la date des soins |

**Bilan passage 2 : ACRA 4 victoires, 1 défaite, 2 égalités** (passage 1 : 2 / 2 / 1). Total des points : ACRA 99,
seul 94,5. Sur les deux tâches non vues : 1–1.

## Lecture honnête du passage 2

- Le gain est net sur les tâches dont le contenu a été enrichi (T6–T8) — **attendu, et en partie « teaching to the
  test »** : les pistes appliquées venaient des évaluations de ces tâches.
- Sur les tâches **non vues**, le résultat est partagé : ACRA gagne T11 (le socle santé générique — INS, MSSanté,
  intégrité, ATT&CK — se transfère) et perd T12 (gestion déléguée d'affiliations : peu de contenu dédié, et une référence
  du catalogue reprise hors de son objet).
- Facteur confondant : la consigne de l'agent ACRA a changé (compléter par son expertise). Une partie du gain peut venir
  de cette consigne plutôt que du contenu.
- Contamination : la réponse « seul » à T11/T12 est passée dans le contexte de l'auteur avant l'écriture du contenu
  1.13 ; aucun contenu propre aux laboratoires ou aux courtiers n'a été ajouté, mais le biais n'est pas nul.
- Un passage par condition, évaluateurs du même modèle, grille maison : écarts de 0,5 à 1,5 point dans le bruit
  (sauf T6).

## Pistes suivantes

- Références : préciser dans le catalogue **l'objet** de chaque référence (A.8.28 pour l'analyse des entrées par le
  code, pas pour un contrôle de complétude) et différencier les types de contrôle (préventif / détectif / correctif)
  dans les suggestions.
- Gestion déléguée d'affiliations (fichiers d'adhésions, cotisations collectives, droits à la date des soins) : contenu
  générique à ajouter pour la complémentaire santé.
- Mesurer l'effet de la consigne seule (ACRA sans contenu 1.13 mais avec consigne) pour séparer les deux effets.
