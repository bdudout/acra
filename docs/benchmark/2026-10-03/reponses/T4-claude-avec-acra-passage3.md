## Cadrage

Mutuelle santé (Livre II du Code de la mutualité), 400 salariés. Les risques dominants sont : le pilotage prudentiel et la gouvernance (Solvabilité II transposée), l'exactitude des prestations et des cotisations, la protection des données de santé (catégorie particulière RGPD), la sous-traitance à des gestionnaires délégataires, le devoir de conseil, la LCB-FT, et la résilience numérique (DORA, applicable aux organismes d'assurance, mutuelles incluses). Le plan équilibre ces 12 domaines avec une majorité de contrôles détectifs, 1 préventif et 1 correctif. Ossature issue de l'outil ACRA (profil MUTUELLE_SANTE), complétée et corrigée par mon jugement. Pas de correctif ni de volet périodicité en tests de bout en bout dans l'outil : à qualifier par la mutuelle.

## Les 12 fiches

1. **Revue des fonctions clés** (risques, conformité, audit interne, actuariat) : indépendance et rapports annuels. Annuel, détectif. Risque : gouvernance défaillante, fonctions non indépendantes ou rapports non exploités. Réf. : Directive 2009/138/CE (Solvabilité II), art. 44 à 48.

2. **Suivi de la couverture du SCR et des fonds propres éligibles.** Trimestriel, détectif. Risque : insuffisance de solvabilité non détectée à temps. Réf. : Directive 2009/138/CE (Solvabilité II) ; à préciser par le texte de transposition (Code de la mutualité, art. L.211-11 et suivants, à vérifier).

3. **Contrôle par échantillon des prestations** santé et prévoyance (droits ouverts, tiers payant). Mensuel, détectif. Risque : erreurs ou fraudes de remboursement. Réf. : Code de la mutualité (dispositions sur les garanties et prestations, articles précis à identifier avec la fonction conformité).

4. **Revue des accès aux données de santé** (habilitations, motifs de consultation, traçabilité). Mensuel, détectif. Risque : accès indus, fuite de données de santé. Réf. : Règlement (UE) 2016/679 (RGPD), art. 9 et 32.

5. **Contrôle de l'appel des cotisations et du suivi des impayés.** Mensuel, détectif. Risque : perte de recettes, résiliations irrégulières. Réf. : Code de la mutualité (cotisations ; procédure de non-paiement).

6. **Contrôle par échantillon du devoir de conseil** (recueil des exigences et besoins). Trimestriel, détectif. Risque : vente inadaptée, mauvaise information. Réf. : Directive (UE) 2016/97 (DDA).

7. **Revue du traitement des réclamations.** Trimestriel, détectif. Risque : réclamations non traitées dans les délais, sanction. Réf. : Recommandation ACPR 2022-R-01 du 9 mai 2022.

8. **Contrôle des gestionnaires délégataires** (sinistres, tiers payant, administration). Trimestriel, détectif. Risque : défaillance ou non-conformité d'un sous-traitant. Réf. : Directive 2009/138/CE, art. 49 (sous-traitance) ; DORA, chap. V pour les prestataires TIC.

9. **Contrôle de compétence et d'honorabilité** des dirigeants effectifs et responsables de fonctions clés. Annuel, préventif. Risque : dirigeants inaptes. Réf. : Directive 2009/138/CE, art. 42.

10. **Contrôle du dispositif LCB-FT** (classification des risques, opérations atypiques, déclarations de soupçon). Trimestriel, détectif. Risque : blanchiment, manquement déclaratif. Réf. : Code monétaire et financier, livre V, titre VI. Remarque : l'outil ne chiffre pas le niveau de risque LCB-FT propre à une mutuelle santé (faible, mais l'obligation s'applique) ; proportionner.

11. **Suivi du programme de tests de résilience numérique** et des remédiations. Trimestriel, détectif. Risque : indisponibilité ou intrusion non éprouvées. Réf. : Règlement (UE) 2022/2554 (DORA), chap. IV.

12. **Test du PCA/PRA sur les services critiques** (gestion des adhérents, prestations, tiers payant). Annuel, détectif. Risque : arrêt prolongé des services critiques. Réf. : Règlement (UE) 2022/2554 (DORA), art. 11 et 12.

## Ce que l'outil ne couvre pas / réserves

- Aucun contrôle de type **correctif** n'est fourni par l'outil : je recommande d'ajouter le suivi des plans d'action issus des incidents, des audits et des réclamations (remédiations avec échéances). Un plan à 12 contrôles pourrait remplacer le n°11 par ce suivi correctif.
- Le régime de **notification d'incidents** (read_notification_regimes) renvoie 0 résultat pour ce profil : à vérifier à la main (DORA art. 17 à 19, notification RGPD art. 33, ACPR). Aucune supposition de ma part.
- Le contrôle **hébergement de données de santé (HDS)** (Code de la santé publique, art. L.1111-8) n'est pas dans le plan type ; à envisager si la mutuelle héberge ou fait héberger des données de santé.
- Les numéros d'articles du Code de la mutualité sont à confirmer par la fonction conformité (non fournis précisément par l'outil). Contenu à relire par un expert.

---OUTILS---
1. recommend_control_plan {"sector":"MUTUELLE","size":12} → plan type MUTUELLE_SANTE, 12 contrôles
2. read_notification_regimes {"sector":"MUTUELLE"} → erreur (argument inconnu ; valides : code, locale)
3. read_notification_regimes {"code":"MUTUELLE_SANTE"} → 0 régime