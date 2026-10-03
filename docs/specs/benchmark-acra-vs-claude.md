# Comparatif « Claude avec ACRA » / « Claude seul »

Objectif : mesurer si l'accès aux connaissances vérifiées d'ACRA (outils MCP de connaissance et de contexte) améliore réellement les réponses d'un assistant sur des tâches de risque, de contrôle et de conformité — et pas seulement sa fluidité.

## Protocole

- **Deux conditions**, mêmes consignes, mêmes tâches (5) :
  - **A — Claude seul** : aucun outil, aucun fichier, pas de web ; il répond de mémoire.
  - **B — Claude avec ACRA** : mêmes consignes + la ligne de commande `scripts/acra-tool.ts`, qui appelle les **mêmes handlers** que le serveur MCP d'ACRA (`read_notification_regimes`, `read_incident_types`, `read_dora_fields`, `read_catalogue`, `read_resilience_tests`, `read_sector_examples`, `read_taxonomie`). Il lui est interdit d'ouvrir d'autres fichiers du dépôt ou le web.
- **Notation à l'aveugle** : un évaluateur indépendant reçoit les deux réponses étiquetées X / Y (ordre tiré au sort) et la grille ci-dessous ; il ne sait pas laquelle utilise ACRA.
- **Faits de référence** : écrits avant les réponses, à partir des textes publics. Les listes de champs de l'ITS DORA et les types de l'art. 25 sont **à confirmer sur EUR-Lex** (l'outil de lecture n'a pas pu lire EUR-Lex) : un biais est possible là où ACRA et la référence partagent la même source.
- **Limites assumées** : un seul passage par condition (pas de variance mesurée) ; la condition A n'a pas le web, alors qu'un usage réel peut l'avoir ; les tâches sont choisies parmi celles que couvrent les connaissances d'ACRA (un comparatif sur des sujets hors périmètre d'ACRA ne montrerait aucun écart) ; les experts humains n'ont pas relu la grille.

## Tâches et grille

Les énoncés figurent dans `docs/benchmark/2026-10-03/tasks.md`.

| Tâche | Faits de référence (1 point chacun sauf mention) |
|---|---|
| **T1 — Déclaration DORA** | Initiale : **18:00** le lundi (4 h après la classification à 14:00, et au plus tard 24 h après la connaissance — le plus tôt des deux) · Intermédiaire : **72 h après la notification initiale** (ou avant, dès rétablissement de l'activité normale) · Final : **1 mois après le dernier rapport intermédiaire à jour** (règlement délégué (UE) 2025/301 art. 5) · Destinataire **ACPR** · Canal **OneGate, rapport DORA_IR** (banque : DSB) · Champs de la notification initiale : **18 champs obligatoires** (1.1–1.4 ; 2.1–2.7 ; 2.5 critères etc.) — score = part des numéros + intitulés exacts, **−1 par champ inventé** |
| **T2 — Multi-régimes** | À examiner : **DORA** (ACPR) · **RGPD art. 33** (CNIL, 72 h après la connaissance, données personnelles) · **NYDFS 23 NYCRR 500.17** (72 h après la détermination d'un événement déclarable) · **Règle bancaire fédérale américaine « computer-security incident »** (36 h après la détermination, régulateur fédéral principal de la succursale) — Ne s'appliquent pas : **NIS2** pour une entité financière soumise à DORA (lex specialis) ; **SEC 8-K item 1.05** (non cotée aux USA) ; **HIPAA** · Points de départ corrects (connaissance 09:15 ; classification/détermination à décider) · Calendrier consolidé cohérent · Décisions de l'entité signalées (significatif/majeur, matérialité) |
| **T3 — EBIOS cabinet médical** | 12 éléments attendus d'un expert du métier : fraude à la facturation par usurpation de la CPS / des identifiants · rançongiciel sur le logiciel de gestion de cabinet · dépendance à l'éditeur / hébergeur · données de santé (RGPD art. 9) · télétransmission / facturation à l'Assurance Maladie · accès des remplaçants et comptes partagés · sauvegardes locales insuffisantes · box internet grand public / Wi-Fi · messagerie sécurisée de santé · téléconsultation ou prise de rendez-vous en ligne · hébergement HDS · phishing ciblant les secrétaires/médecins · **+ qualité** : cotations 1-4 présentes et cohérentes, spécificité (pas de générique) |
| **T4 — Contrôles d'une mutuelle** | 12 domaines attendus : gouvernance / fonctions clés (Solvabilité II, Code de la mutualité) · aptitude et honorabilité des dirigeants · LCB-FT et gel des avoirs · devoir de conseil / distribution (DDA) · réclamations · protection des données de santé (RGPD art. 9) · prestations et paiements (fraude, doubles paiements) · cotisations et recouvrement · délégations de gestion / tiers payant / sous-traitance · résilience TIC (DORA) · continuité d'activité · provisions / solvabilité (ORSA) — **+ qualité** : périodicité et type présents, référence précise et plausible, **−1 par référence manifestement inventée** |
| **T5 — Tests DORA** | **12 types** exacts de l'art. 25 § 1 (évaluations et analyses de vulnérabilité ; analyses de sources ouvertes ; évaluations de la sécurité des réseaux ; analyses des écarts ; examens de la sécurité physique ; questionnaires et logiciels d'analyse ; examens du code source ; tests fondés sur des scénarios ; tests de compatibilité ; tests de performance ; tests de bout en bout ; tests de pénétration) · TLPT : **au moins tous les 3 ans**, entités identifiées par l'autorité, testeurs externes (internes sous conditions, externes tous les 3 tests), couvre les fonctions critiques ou importantes · répartition entité / autorité |

Chaque évaluateur rend, par tâche et par condition : score / total, faits corrects, faits manquants, erreurs factuelles (hallucinations), et une appréciation de l'utilité pratique.

## Résultats

Voir `docs/benchmark/2026-10-03/resultats.md` (produits après exécution).
