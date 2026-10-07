# Tests de résilience DORA : article 25 § 1 et TLPT (article 26)

Les 12 types de l'article 25 § 1 viennent de l'outil ACRA `read_resilience_tests`, dont la note demande de confirmer sur EUR-Lex. Le cadrage TLPT vient aussi de l'outil, complété par ma connaissance du texte, signalée comme telle. Aucun point n'a été revérifié sur EUR-Lex.

## 1. Types de tests de l'article 25 § 1 (12 types)

Le programme de tests doit prévoir « une série d'évaluations, de tests, de méthodologies, de pratiques et d'outils ». Ils sont mis en œuvre selon une approche fondée sur les risques (art. 24 et 25).

| # | Type | Code ACRA |
|---|---|---|
| 1 | Évaluations et analyses de vulnérabilité | VULNERABILITY |
| 2 | Analyses de sources ouvertes | OPEN_SOURCE |
| 3 | Évaluations de la sécurité des réseaux | NETWORK_SECURITY |
| 4 | Analyses des écarts | GAP_ANALYSIS |
| 5 | Examens de la sécurité physique | PHYSICAL_SECURITY |
| 6 | Questionnaires et solutions logicielles de balayage | QUESTIONNAIRE_SCAN |
| 7 | Examens du code source (« lorsque c'est possible », à vérifier dans le texte officiel) | SOURCE_CODE |
| 8 | Tests fondés sur des scénarios | SCENARIO |
| 9 | Tests de compatibilité | COMPATIBILITY |
| 10 | Tests de performance | PERFORMANCE |
| 11 | Tests de bout en bout | END_TO_END |
| 12 | Tests de pénétration | PENETRATION |

Le choix et le calendrier de ces tests restent ceux de l'entité. Le règlement ne les impose pas tous à chaque cycle.

## 2. TLPT (article 26, testeurs à l'article 27)

**À qui il s'applique**
- Il vise les entités financières identifiées par l'autorité compétente, hors microentreprises. L'outil indique « autres que les microentreprises ».
- Les critères d'identification sont : impact systémique, profil de risque TIC, niveau de maturité TIC. Je cite ces critères de mémoire, à vérifier.
- Le test porte sur plusieurs ou toutes les fonctions critiques ou importantes. Il est réalisé en production, sur des systèmes réels. Cela inclut les systèmes fournis par des prestataires TIC tiers (à vérifier).

**Fréquence**
- Au moins tous les 3 ans.
- L'autorité peut demander de réduire ou d'augmenter cette fréquence selon le profil de risque et les circonstances opérationnelles.

**Testeurs (art. 27)**
- L'entité doit recourir à des testeurs externes.
- Elle peut recourir à des testeurs internes, sous conditions, à condition de faire appel à des testeurs externes tous les trois tests. L'outil le dit ainsi. L'éventuelle approbation préalable de l'autorité est à vérifier.
- Exigences sur les testeurs, de mémoire et à vérifier sur l'art. 27 :
  - haute aptitude et réputation ;
  - compétences en renseignement sur la menace, tests de pénétration et red team ;
  - certification par un organisme d'accréditation ou adhésion à des codes de conduite formels ;
  - assurance de l'indépendance et de la gestion des informations confidentielles ;
  - assurance responsabilité civile professionnelle.

## 3. Entité ou autorité

**Entité**
- Organiser et financer le test.
- Définir le périmètre : fonctions critiques ou importantes et systèmes support, y compris ceux externalisés.
- Désigner des testeurs conformes à l'art. 27.
- Gérer les risques liés à un test en production.
- Associer les prestataires TIC tiers concernés. Un test mutualisé est possible sous la responsabilité de l'entité (à vérifier).
- Corriger les constats et établir un plan de remédiation.

**Autorité**
- Identifier les entités tenues de réaliser un TLPT.
- Valider le périmètre.
- Délivrer l'attestation de réalisation. Le texte la rattache à l'autorité qui a validé le test (à vérifier).
- Pouvoir ajuster la fréquence.
- Désigner une autorité nationale pour les TLPT. C'est de mémoire, à vérifier.

## 4. Ce que l'outil ne couvre pas
- Le détail du règlement délégué sur les TLPT : référence de l'acte, phases (menace, red team, clôture), exigences de l'équipe de contrôle. Je ne cite pas le numéro faute de certitude, à vérifier.
- Les modalités précises de reconnaissance mutuelle entre États membres et de coopération transfrontalière. À vérifier.
- La liste exacte des critères d'identification des entités, et l'article de rattachement de l'exclusion des microentreprises. À vérifier.

Ce n'est pas un avis juridique.

## Appels d'outils réalisés
1. `npx tsx --tsconfig tsconfig.json scripts/acra-tool.ts read_resilience_tests '{}'`

Je n'ai fait aucun autre appel et n'ai ouvert aucun autre fichier.