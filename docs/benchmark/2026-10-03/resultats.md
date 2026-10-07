# Résultats — Claude avec ACRA / Claude seul (2026-10-03)

Protocole : `docs/specs/benchmark-acra-vs-claude.md`. Notation à l'aveugle par sous-agents indépendants (ordre X/Y tiré au sort), un seul passage par condition.

## Passage 1 (avant enrichissement des connaissances)

| Tâche | Verdict | Remarque |
|---|---|---|
| T1 Déclaration DORA | **ACRA** nettement | délais et champs exacts |
| T5 Tests DORA | **ACRA** nettement | 12 types de l'art. 25 exacts |
| T2 Multi-régimes | mitigé | ACRA sous-utilisé par l'agent |
| T3 EBIOS cabinet médical | seul ≥ ACRA | catalogue santé trop mince |
| T4 Contrôles mutuelle | seul ≥ ACRA | catalogue mutuelle trop mince |

Leçon : ACRA gagne là où il détient des faits vérifiés ; il ne gagne pas sur le contenu génératif quand son catalogue est mince. Ergonomie corrigée à la suite (arguments inconnus signalés, alias `secteur`, recherche par domaine/références).

## Passage 2 (après sous-secteurs santé, enrichissement mutuelle/assurance maladie, outils plus ergonomiques)

| Tâche | ACRA | Seul | Verdict (confiance) |
|---|---|---|---|
| T2 Multi-régimes | 12/12 | 11/12 | ACRA, écart faible (~60 %) : un renvoi d'article faux (art. 19(4) au lieu de 19(3)) et un jour férié ignoré côté « seul » |
| T3 EBIOS cabinet médical | 13/15 | 11,5/15 | ACRA |
| T4 Contrôles mutuelle | 10,5/15 | 12/15 | **Seul**, de peu (~70 %) : ACRA consacre 5 contrôles sur 12 aux TIC/DORA et laisse hors plan gouvernance, honorabilité, LCB-FT, cotisations. Références d'ACRA plus précises. |

### Passage 3 de T4 (après correction : outil `recommend_control_plan`, contrôles LCB-FT / données de santé / continuité / remédiation, catalogue 1.11)

| Tâche | ACRA | Seul | Verdict (confiance) |
|---|---|---|---|
| T4 Contrôles mutuelle | ≈ 13/15 | ≈ 11,5/15 | ACRA (~75 %) : un contrôle par domaine, références vérifiables ; le « seul » est plus riche sur provisions/ORSA mais verbeux, types multiples, références incomplètes |

Attention : cette correction a été faite **après** avoir vu l'échec sur T4 et testée sur la même tâche : le gain est en partie du « teaching to the test » ; il faudrait une tâche voisine non vue (autre type d'organisme) pour confirmer. Faiblesses restantes relevées : gel des avoirs et provisions/ORSA couverts à moitié, aucun contrôle correctif dans un plan de 12.

Bilan honnête : après correction ACRA est meilleur sur les 5 tâches, mais l'écart de T4 est obtenu en ciblant la tâche ; ne pas conclure à une supériorité générale.

## Limites

- Un seul passage par condition, pas de variance mesurée.
- Condition « seul » sans accès web.
- Grille rédigée par nous ; listes de champs DORA à confirmer sur EUR-Lex (circularité possible).
- Aveugle imparfait : des traces (« de mémoire », outils) permettent de deviner la condition.
- Risque de « teaching to the test » : le catalogue a été enrichi après le passage 1 sur les mêmes sujets.
- Écarts faibles (T2, T4) dans le bruit probable.

## Pistes d'amélioration (issues de T4)

- Ajouter au catalogue mutuelle un plan type équilibré (gouvernance/fonctions clés, honorabilité, LCB-FT et gel des avoirs, cotisations/recouvrement, provisions) et un outil de recommandation qui répartit les domaines au lieu de sur-représenter le TIC.
- Consigner les références du Code de la mutualité vérifiées (statut « à relire » tant qu'un expert n'a pas validé).
