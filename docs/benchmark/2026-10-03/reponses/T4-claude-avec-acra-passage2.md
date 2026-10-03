# Plan de 12 contrôles permanents pour une mutuelle santé de 400 salariés (livre II du Code de la mutualité)

## 1. Cadrage

La mutuelle est un organisme assureur de santé et de prévoyance. Elle est soumise à la directive Solvabilité II (directive 2009/138/CE) pour sa gouvernance et sa solvabilité. Pour sa taille, elle relève très probablement de DORA (règlement (UE) 2022/2554), l'ACPR étant l'autorité compétente. Les seuils d'exclusion de Solvabilité II sont à vérifier. Elle traite des données de santé à grande échelle, ce qui est le premier enjeu du RGPD pour ce métier. Elle fait aussi un usage intensif de délégataires de gestion (tiers payant, plateformes, réseaux de soins).

Les contrôles sont répartis sur cinq domaines :
- sécurité et résilience numérique ;
- protection des données de santé ;
- prestations et délégataires ;
- conduite et protection de la clientèle ;
- solvabilité et gouvernance.

Les références sont citées sans reproduire leur contenu. Les numéros d'articles du Code de la mutualité et du Code de la sécurité sociale doivent être revérifiés avant publication du plan, et sont signalés « à vérifier » quand le doute est réel.

## 2. Synthèse

| # | Contrôle | Périodicité | Type | Domaine |
|---|---|---|---|---|
| 1 | Revue des droits d'accès au SI et aux comptes à privilèges | Trimestrielle | Détectif | Sécurité |
| 2 | Test de restauration des sauvegardes | Semestrielle | Détectif | Résilience |
| 3 | Suivi des vulnérabilités et correctifs en retard | Mensuelle | Détectif | Sécurité |
| 4 | Exercice de classification et de déclaration d'un incident TIC | Semestrielle | Préventif | Résilience |
| 5 | Revue du registre des prestataires TIC et de leurs niveaux de service | Trimestrielle | Détectif | Tiers |
| 6 | Revue des accès et de la traçabilité sur les données de santé | Mensuelle | Détectif | Données |
| 7 | Revue du registre des violations de données et des délais de notification | Trimestrielle | Correctif | Données |
| 8 | Contrôle par échantillon des prestations versées | Mensuelle | Détectif | Prestations |
| 9 | Contrôle des délégataires de gestion (tiers payant, gestion déléguée) | Trimestrielle | Détectif | Tiers / prestations |
| 10 | Revue des réclamations et des délais de traitement | Trimestrielle | Détectif | Clientèle |
| 11 | Contrôle par échantillon du devoir de conseil et de la gouvernance des produits | Trimestrielle | Détectif | Clientèle |
| 12 | Suivi de la couverture de solvabilité et des limites d'appétence | Trimestrielle | Détectif | Solvabilité |

## 3. Fiches détaillées

**1. Revue des droits d'accès au SI et aux comptes à privilèges**
- Périodicité et type : trimestrielle, détectif. Complément mensuel recommandé : rapprochement avec la liste des départs RH.
- Risque couvert : accès excessif ou persistant (collaborateurs partis, cumul de droits incompatibles), compromission de comptes à privilèges.
- Référence : DORA art. 9 § 4 (gestion des accès). ISO/IEC 27001:2022, mesure A.5.18, à vérifier pour la numérotation.

**2. Test de restauration des sauvegardes**
- Périodicité et type : semestrielle, détectif. Restauration réelle d'un échantillon d'applications critiques (gestion des adhérents, prestations).
- Risque couvert : indisponibilité ou perte de données après rançongiciel ou panne, sauvegardes inexploitables.
- Référence : DORA art. 11 (continuité) et art. 12 (politiques de sauvegarde, procédures de restauration).

**3. Suivi des vulnérabilités et correctifs en retard**
- Périodicité et type : mensuelle, détectif. Indicateur : nombre de correctifs critiques au-delà du délai interne.
- Risque couvert : exploitation de failles connues sur les applications exposées (portail adhérent, extranet des professionnels de santé).
- Référence : DORA art. 9 § 4 (gestion des correctifs, à vérifier pour l'alinéa précis) et art. 8 (identification des actifs et des risques).

**4. Exercice de classification et de déclaration d'un incident TIC**
- Périodicité et type : semestrielle, préventif. Exercice sur scénario simulé, de la détection à la notification à l'ACPR.
- Risque couvert : déclaration tardive ou erronée d'un incident majeur, mauvaise qualification, désorganisation de la cellule de crise.
- Références :
  - DORA art. 17 à 19 ;
  - règlement délégué (UE) 2024/1772 (classification) ;
  - règlement délégué (UE) 2025/301 (contenu et délais) ;
  - règlement d'exécution (UE) 2025/302 (modèles de déclaration).
- Point d'attention : coordonner avec la notification RGPD du contrôle 7 pour les incidents touchant des données personnelles.

**5. Revue du registre des prestataires TIC et de leurs niveaux de service**
- Périodicité et type : trimestrielle, détectif.
- Risque couvert : dépendance critique à un hébergeur ou éditeur, contrats sans clauses obligatoires, dégradation de service non détectée.
- Références : DORA art. 28 (principes, registre d'information), art. 29 (concentration) et art. 30 (clauses contractuelles).

**6. Revue des accès et de la traçabilité sur les données de santé**
- Périodicité et type : mensuelle, détectif. Contrôle des consultations atypiques de dossiers adhérents et de la séparation entre gestion et médecin-conseil.
- Risque couvert : consultation illégitime ou fuite de données de santé, atteinte au secret médical.
- Références : RGPD art. 5 § 1 f, art. 9 (catégories particulières de données) et art. 32 (sécurité). Cadre du secret médical applicable au médecin-conseil : à vérifier. Si un hébergement de données de santé est concerné, article L. 1111-8 du Code de la santé publique (applicabilité à vérifier).

**7. Revue du registre des violations de données et des délais de notification**
- Périodicité et type : trimestrielle, correctif. Les incidents sont traités au fil de l'eau ; la revue contrôle le suivi des actions correctives et le respect des délais.
- Risque couvert : violation non notifiée à la CNIL dans les 72 heures, information tardive des personnes, récidive faute d'action corrective.
- Référence : RGPD art. 33 (notification à l'autorité), art. 34 (communication aux personnes) et art. 5 § 2 (responsabilité).

**8. Contrôle par échantillon des prestations versées**
- Périodicité et type : mensuelle, détectif. Vérification des droits ouverts, du respect des garanties, des plafonds et de l'application du dispositif « contrats responsables » (dont le panier 100 % santé).
- Risque couvert : erreur de liquidation, paiement indu, fraude des assurés ou des professionnels, non-conformité du contrat responsable.
- Références : Code de la sécurité sociale, art. L. 871-1 et R. 871-1 et suivants (contrats responsables). Règlement délégué (UE) 2015/35 sur la gouvernance et le contrôle interne : numérotation à vérifier.

**9. Contrôle des délégataires de gestion**
- Périodicité et type : trimestrielle, détectif. Contrôle sur pièces, avec contrôle sur place annuel pour les délégataires importants.
- Risque couvert : défaillance, erreur ou fraude d'un délégataire (plateforme de tiers payant, gestionnaire délégué), perte de maîtrise des données.
- Références :
  - directive 2009/138/CE art. 49 (sous-traitance) ;
  - règlement délégué (UE) 2015/35, articles relatifs à la sous-traitance, à vérifier pour la numérotation ;
  - DORA art. 28 à 30 pour les prestations TIC.

**10. Revue des réclamations et des délais de traitement**
- Périodicité et type : trimestrielle, détectif. Analyse des causes récurrentes et du respect des délais de réponse.
- Risque couvert : traitement tardif ou insatisfaisant, risque de sanction et d'atteinte à l'image, causes systémiques non corrigées.
- Références : recommandation ACPR sur le traitement des réclamations (2022-R-01, référence à vérifier). Médiation de la consommation : Code de la consommation, art. L. 611-1 et suivants (à vérifier).

**11. Contrôle par échantillon du devoir de conseil et de la gouvernance des produits**
- Périodicité et type : trimestrielle, détectif. Revue annuelle complémentaire de la gouvernance produit (approbation, marché cible).
- Risque couvert : vente de garanties inadaptées aux besoins (surtout en collectif et en individuel), documents d'information incomplets.
- Références :
  - directive (UE) 2016/97 (distribution d'assurances), articles relatifs à l'information et au conseil ;
  - règlement délégué (UE) 2017/2358 (surveillance et gouvernance des produits) ;
  - dispositions correspondantes du Code de la mutualité, à vérifier.

**12. Suivi de la couverture de solvabilité et des limites d'appétence**
- Périodicité et type : trimestrielle, détectif, avec alerte en cas de franchissement de seuil.
- Risque couvert : insuffisance de fonds propres, dérive hors du profil de risque validé par l'organe d'administration.
- Références : directive 2009/138/CE art. 100 et 101 (capital de solvabilité requis), art. 45 (évaluation interne des risques et de la solvabilité, ORSA), art. 76 et suivants (provisions techniques).

## 4. Domaines non retenus (aller plus loin)

Ils sont à ajouter si le plan dépasse 12 contrôles :
- honorabilité et compétence des dirigeants et responsables de fonctions clés, annuelle, préventif, directive 2009/138/CE art. 42 ;
- qualité des données servant au calcul des provisions techniques ;
- appel de cotisations et suivi des impayés ;
- LCB-FT et gel des avoirs (Code monétaire et financier, art. L. 561-1 et suivants et L. 562-1 et suivants, à vérifier) : à proportionner, l'exposition d'une mutuelle santé étant faible, hors éventuelle activité d'épargne ou de prévoyance longue ;
- préparation de l'assemblée générale et respect des statuts (Code de la mutualité, articles à vérifier) ;
- programme annuel de tests de résilience (DORA art. 24 et 25).

## 5. Remarques de mise en œuvre

- Chaque contrôle doit avoir un propriétaire en première ligne et un revalidateur en deuxième ligne (contrôle permanent, fonction conformité, DPO). L'audit interne est la troisième ligne.
- Les contrôles 4, 5, 7 et 9 forment la chaîne DORA et RGPD : un incident chez un délégataire peut déclencher la notification ACPR et la notification CNIL.
- Le périmètre exact des textes applicables (seuils Solvabilité II, DORA, hébergement de données de santé) est à confirmer avec le conseil juridique.

---OUTILS---
- `scripts/acra-tool.ts` (sans argument) : liste des outils.
- `read_catalogue` avec `{"sector":"ASSURANCE","kind":"CONTROL","limit":40}` puis `{"sector":"SANTE","kind":"CONTROL","limit":40}` : contrôles-types.
- `read_catalogue` avec `{"sector":"ASSURANCE","kind":"CONTROL","limit":100}` (liste filtrée des titres, périodicités et types).
- `read_notification_regimes` avec `{}` : régimes de déclaration (DORA).