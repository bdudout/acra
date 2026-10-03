# T12 — Claude (Opus 5.5) seul

Note pour l'appelant : ma réponse précédente a été interrompue par un filtre de sécurité pendant la rédaction de T11, au milieu du second scénario opérationnel. Le livrable T11 est donc incomplet. La partie déjà transmise couvre l'atelier 3 (4 parties prenantes cotées, 3 scénarios stratégiques) et le premier scénario opérationnel. Le second scénario opérationnel et les 10 mesures n'ont pas été produits et ne seront pas régénérés ici. T12 est livré en entier ci-dessous.

=== T12 ===

**Mutuelle, gestion déléguée des contrats collectifs à un courtier gestionnaire**

Cadre :
- La gestion déléguée relève de l'externalisation au sens de Solvabilité II, art. 49 de la directive 2009/138/CE, et du règlement délégué (UE) 2015/35, art. 274 (à vérifier).
- Si la délégation repose sur des services TIC, DORA s'applique : règlement (UE) 2022/2554, art. 28 à 30, dont le registre d'information de l'art. 28(3).
- RGPD : le courtier est un sous-traitant (art. 28) ou un responsable de traitement conjoint (art. 26), à qualifier au contrat (à vérifier).

**Échelles** :
- Gravité : 1 = mineure, 4 = critique.
- Vraisemblance : 1 = peu vraisemblable, 4 = quasi certaine.

### Registre de 8 risques

| # | Risque | Cause | Conséquence | Gravité | Vraisemblance |
|---|---|---|---|---|---|
| R1 | Sortie de salarié non transmise ou transmise tardivement | Entreprise qui omet le mouvement, retard du courtier, désynchronisation avec la DSN | Prestations payées à des personnes non couvertes (hors portabilité, art. L.911-8 du Code de la sécurité sociale, à vérifier), indus difficiles à récupérer | 2 | 4 |
| R2 | Affiliation ou ayant droit fictif | Fraude interne (entreprise, salarié du courtier) ou externe, absence de pièces justificatives | Prestations indues, fraude organisée | 3 | 2 |
| R3 | Erreur de calcul des cotisations par le courtier | Mauvais paramétrage des taux, tranches ou options, changement de garanties non répercuté | Perte de primes, déséquilibre technique du contrat, litiges clients | 3 | 3 |
| R4 | Altération ou détournement des fichiers transmis, dont les coordonnées bancaires | Canal non sécurisé, compte compromis chez le courtier, fraude au changement de RIB | Paiement des prestations sur un compte frauduleux, données de base corrompues | 4 | 2 |
| R5 | Violation de données personnelles chez le courtier | Cyberattaque, erreur d'envoi, droits d'accès excessifs (NIR, ayants droit, voire données de santé liées aux prestations) | Notification CNIL sous 72 h (art. 33 RGPD), sanctions, atteinte à l'image | 3 | 3 |
| R6 | Indisponibilité ou défaillance du courtier | Rançongiciel, défaillance financière, rupture de contrat sans plan de réversibilité | Arrêt des flux d'adhésion, droits non ouverts (tiers payant rejeté), impossibilité de payer les prestations | 3 | 2 |
| R7 | Écarts de rapprochement non traités | Absence de réconciliation entre effectifs, cotisations appelées, encaissements et prestations | Cotisations non recouvrées, provisions erronées, comptes inexacts | 2 | 3 |
| R8 | Défaut de pilotage de la délégation | Convention de délégation sans clauses d'audit, de reporting, de sous-traitance en cascade ni de sortie ; absence de notification à l'ACPR (à vérifier) | Non-conformité Solvabilité II et DORA, sanction ACPR, perte de maîtrise | 3 | 2 |

### 8 contrôles permanents

| # | Contrôle | Périodicité | Type | Risque couvert | Référence |
|---|---|---|---|---|---|
| C1 | Contrôle automatique d'intégrité et de complétude de chaque fichier hebdomadaire (format, signature ou empreinte, nombre d'enregistrements, totaux de contrôle) avec rejet des fichiers non conformes | À chaque réception (hebdomadaire) | Préventif, automatique, 1er niveau | R4, R3 | DORA art. 9 (à vérifier) ; Solvabilité II art. 46 (contrôle interne) |
| C2 | Rapprochement des effectifs entre fichier du courtier, données issues de la DSN ou déclarations de l'entreprise, avec suivi des écarts | Mensuelle | Détectif, manuel, 1er niveau | R1, R2 | Solvabilité II art. 46 |
| C3 | Recalcul par échantillonnage des cotisations calculées par le courtier (taux et assiettes contractuels) | Mensuelle ou trimestrielle | Détectif, manuel, 2e niveau | R3, R7 | Convention de délégation ; Solvabilité II art. 49 |
| C4 | Contrôle des modifications de RIB : double validation, contre-appel sur des coordonnées connues, délai de carence avant le premier paiement | À chaque modification | Préventif, manuel, 1er niveau | R4 | Dispositif de lutte contre la fraude interne (référence précise à vérifier) |
| C5 | Contrôle des pièces justificatives des ayants droit et détection des anomalies (doublons de NIR, ayants droit hors limite d'âge, adresses ou IBAN partagés) | Mensuelle, sur échantillon et par requêtes automatiques | Détectif, mixte, 1er et 2e niveau | R2, R1 | Code de la mutualité (référence précise à vérifier) |
| C6 | Rapprochement entre cotisations appelées et encaissements bancaires, avec relance des impayés | Mensuelle | Détectif, manuel, 1er niveau | R7, R3 | Solvabilité II art. 46 |
| C7 | Revue de la délégation : reporting SLA et incidents, audit sur pièces ou sur place, revue des habilitations et de la sécurité du courtier (PAS, tests de réversibilité) | Trimestrielle (reporting), annuelle (audit) | Détectif, manuel, 2e niveau | R5, R6, R8 | Solvabilité II art. 49 ; règlement délégué 2015/35 art. 274 ; DORA art. 28 à 30 ; RGPD art. 28 |
| C8 | Tenue à jour du registre d'information DORA et de la cartographie des données échangées ; test du plan de continuité et de sortie du courtier | Annuelle | Préventif, manuel, 2e niveau | R6, R8, R5 | DORA art. 28(3) et 28(8) (à vérifier) ; Solvabilité II art. 49 |

### 5 KRI

| # | KRI | Unité | Sens (le risque augmente quand…) | Périodicité |
|---|---|---|---|---|
| K1 | Taux d'écart d'effectifs entre fichier du courtier et référentiel de l'entreprise | % des assurés | … le taux augmente | Mensuelle |
| K2 | Montant des prestations indues détectées (après une sortie, ou pour un ayant droit non éligible) | € | … le montant augmente | Mensuelle |
| K3 | Délai moyen d'intégration des mouvements (entre l'événement et sa prise en compte) | Jours | … le délai augmente | Mensuelle |
| K4 | Taux de fichiers hebdomadaires rejetés ou reçus en retard | % des fichiers | … le taux augmente | Mensuelle |
| K5 | Écart entre cotisations appelées et cotisations encaissées | % du montant appelé (ou €) | … l'écart augmente | Mensuelle |
