# T12 — Claude (Opus 5.5) avec ACRA, passage 2

**Mutuelle : affiliations des entreprises clientes transmises par un courtier gestionnaire**

Les entreprises envoient leurs mouvements au courtier. Le courtier transmet chaque semaine à la mutuelle les fichiers d'adhésions et les cotisations calculées. La mutuelle paie les prestations sur cette base.

**Registre de 8 risques**

| # | Risque | Cause | Conséquence | G | V |
|---|---|---|---|---|---|
| R1 | Mouvements d'affiliation tardifs ou absents, en particulier les sorties | Entreprises transmettant en retard, intégration seulement hebdomadaire, rétroactivité mal gérée | Prestations payées à des personnes non couvertes (hors portabilité), cotisations non appelées, indus difficiles à récupérer | 3 | 3 |
| R2 | Ayants droit ou bénéficiaires fictifs ou non éligibles (enfant au-delà de la limite d'âge, conjoint non éligible) | Pièces non vérifiées par le courtier, fraude d'un salarié ou complicité | Prestations indues, fraude | 3 | 3 |
| R3 | Cotisations mal calculées (assiette, taux, structure de cotisation, paramétrage des garanties) ou non reversées à temps par le courtier qui les encaisse | Paramétrage non recetté, défaillance ou détournement chez le courtier | Perte financière, déséquilibre du résultat technique, données fausses pour les provisions | 3 | 2 |
| R4 | Divergence durable des référentiels (contrats, garanties, effectifs) entre la mutuelle et le courtier | Pas de rapprochement périodique, changements de garanties non synchronisés | Garanties appliquées à tort, réclamations, contentieux | 3 | 3 |
| R5 | Compromission du courtier (hameçonnage, rançongiciel) | Maturité cyber faible d'un intermédiaire, accès larges aux données | Fuite de NIR, d'IBAN et de situations familiales (parfois des données de santé), interruption des flux | 3 | 3 |
| R6 | IBAN d'assurés modifiés par le fichier d'adhésion (complicité chez le courtier, ou entreprise cliente compromise) | Pas de confirmation de l'assuré ni de double validation | Détournement des remboursements | 3 | 3 |
| R7 | Délégation mal pilotée : convention incomplète, sans reporting ni droit d'audit, obligations légales non vérifiées (portabilité, maintien des garanties, RGPD) | Externalisation sans dispositif de contrôle | Non-conformité (Solvabilité II, ACPR, CNIL), responsabilité de la mutuelle, qui reste pleinement responsable | 3 | 3 |
| R8 | Défaillance ou cessation du courtier sans réversibilité | Dépendance unique, données détenues dans un format propriétaire | Impossibilité de gérer les contrats collectifs, arrêt des prestations | 4 | 2 |

**8 contrôles permanents**

| # | Contrôle | Périodicité | Type | Risque couvert | Référence |
|---|---|---|---|---|---|
| C1 | Contrôle de complétude et d'intégrité de chaque fichier reçu (comptages, totaux de contrôle, séquence, rejeux), revue des rejets et des lots en quarantaine | Hebdomadaire | Détectif | R1, R6 | ISO/IEC 27001:2022, A.8.28 ; Solvabilité II, art. 82 (qualité des données) |
| C2 | Rapprochement des cotisations attendues (effectifs × taux) avec les cotisations calculées et encaissées par contrat, suivi des impayés et des reversements du courtier | Mensuelle | Détectif | R3 | Code de la mutualité |
| C3 | Contrôle par échantillon des prestations versées : droits ouverts à la date des soins (affiliation, ayant droit, limite d'âge, sortie ou portabilité) | Mensuelle | Détectif | R1, R2 | Code de la mutualité ; Code de la sécurité sociale, art. L. 911-8 (portabilité, à vérifier) |
| C4 | Contrôle par échantillon des changements d'IBAN et des créations d'ayants droit atypiques reçus par fichier (confirmation de l'assuré, délai de sécurité, double validation) | Mensuelle | Détectif | R6, R2 | Contrôle interne : séparation des tâches |
| C5 | Rapprochement du référentiel des contrats et des garanties paramétrés chez le courtier et à la mutuelle. Recette contradictoire signée pour tout changement de garanties. | Trimestrielle | Détectif | R4, R3 | Solvabilité II, art. 49 |
| C6 | Contrôle du gestionnaire délégataire : revue du reporting et des SLA, contrôles sur pièces, audit sur place au moins annuel | Trimestrielle, audit annuel | Détectif | R7 | Directive 2009/138/CE (Solvabilité II), art. 49 ; Règlement délégué (UE) 2015/35, art. 274 |
| C7 | Revue des rapports de sécurité et d'incidents du courtier, et vérification de la sécurité des échanges (SFTP ou TLS mutuel, rotation des clés, minimisation des données) | Trimestrielle | Détectif | R5 | RGPD art. 28 et 32 ; DORA — Règlement (UE) 2022/2554, art. 28 à 30 (si la mutuelle relève de Solvabilité II, à vérifier) |
| C8 | Test du plan de sortie et de réversibilité : restitution complète des données dans un format exploitable, délai mesuré, reprise par la mutuelle ou un autre gestionnaire | Annuelle | Détectif | R8 | DORA, art. 28 (stratégie de sortie) |

**5 KRI**

| KRI | Unité | La situation se dégrade quand | Périodicité |
|---|---|---|---|
| Taux de rejet ou d'anomalie des fichiers d'affiliation | % des lignes | il augmente | hebdomadaire |
| Délai moyen entre la date d'effet d'un mouvement et son intégration à la mutuelle | jours | il augmente | mensuelle |
| Écart entre cotisations attendues et cotisations encaissées ou reversées | % et montant en € | il augmente | mensuelle |
| Prestations versées sans droit ouvert à la date des soins (indus détectés) | nombre et montant en € | ils augmentent | mensuelle |
| Changements d'IBAN reçus par les fichiers du courtier | nombre (comparé à la moyenne) | il augmente anormalement | mensuelle |

Les entreprises clientes déclarent généralement leurs affiliations par la DSN. Si la mutuelle y a accès, un rapprochement avec ces données renforcerait C1 et C3 (modalités à vérifier).
