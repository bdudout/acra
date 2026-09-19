# Évaluation de couverture GRC cyber — démo du 23 septembre 2026

> Mise à jour du 18 septembre : cette évaluation décrit la couverture du produit,
> pas son autorisation de mise en ligne. Voir l'[audit cyber/conformité](AUDIT-CYBER-CONFORMITE-2026-09-18.md)
> pour les défauts vérifiés, les réserves de recette et le périmètre sans GRC retenu.
> La note ci-dessous ne constitue pas un feu vert de publication.

## Décision de cadrage

La présentation doit vendre **ACRA comme plateforme de gestion du risque cyber**,
pas comme une suite de risque opérationnel généraliste. Le périmètre de démo est
donc : EBIOS RM, gouvernance, traitement et acceptation des risques, conformité
cyber, écosystème/tiers, pilotage et production de preuves. Les campagnes RCSA,
pertes LDC, incidents opérationnels, contrôle permanent non cyber et audit interne
restent disponibles mais **hors narration**.

Cette évaluation est une revue de couverture du produit au 17 septembre 2026,
fondée sur le code, les parcours et les documents du dépôt. Elle ne constitue ni
une certification ISO, ni une labellisation ANSSI, ni une validation réglementaire.

## Référentiel d'état de l'art retenu

| Référence | Attente utile pour la démo | Position ACRA |
|---|---|---|
| [EBIOS RM v1.5 (ANSSI, 2024)](https://cyber.gouv.fr/sites/default/files/document/20240901_Guide-EBIOS-RM-V1.5.pdf) et [cahier du label v3.1](https://cyber.gouv.fr/sites/default/files/document/Cahier-des-Charges-Label-EBIOS-RM-v3.1.pdf) | Analyse traçable de bout en bout, cinq ateliers, scénarios, risques résiduels et traitement. | Axe principal et différenciant. |
| [NIST CSF 2.0](https://www.nist.gov/publications/nist-cybersecurity-framework-csf-20) | Gouverner, identifier, protéger, détecter, répondre, rétablir ; profils et communication vers la direction. | Très bon socle de gouvernance/identification/protection ; boucle détection-réponse-rétablissement à ne pas sur-vendre. |
| ISO/IEC 27001:2022 | Risques, plan de traitement, contrôles, déclaration d'applicabilité, preuves et amélioration. | Couverture forte via référentiels, socle, mesures, dérogations, SoA et plans d'action. |
| [NIS2 — guide ENISA](https://www.enisa.europa.eu/news/supporting-nis2-implementation-through-actionable-guidance) | Politique, gestion des risques, incidents, continuité, chaîne fournisseurs, efficacité des mesures. | Très bon support de démonstration de la gouvernance et des tiers ; continuité/test de résilience partiel. |
| [DORA](https://eur-lex.europa.eu/eli/reg/2022/2554/oj/fre) | Cadre de risque TIC documenté, tiers TIC, incidents, tests et amélioration continue. | Crédible sur gouvernance, tiers TIC et enregistrement/reporting d'incidents ; pas à présenter comme une conformité DORA exhaustive. |

Le [NIST CSF 2.0](https://www.nist.gov/cyberframework/faqs) ajoute explicitement
la fonction **Govern** et structure le programme en six fonctions continues. C'est
un bon langage de vente pour relier EBIOS RM à la direction sans prétendre remplacer
la méthode ANSSI.

## Résultat de couverture — focus cyber

Échelle : **fort** = parcours utilisable et preuves exportables ; **partiel** =
capacité présente mais pas le centre de gravité de la démo ; **hors promesse** =
à ne pas revendiquer comme automatisé.

| Capacité attendue | Couverture | Éléments observés | Décision pour le 23/09 |
|---|---:|---|---|
| Cadrage métier, actifs, DICT et périmètre | Fort | Atelier 1, valeurs métier, biens supports, socle et échelles configurables. | **Montrer** : point de départ métier, pas une liste technique. |
| Analyse de menace et scénarios | Fort | Ateliers 2 à 4, couples SR/OV, écosystème, dangerosité des tiers, MITRE ATT&CK, vraisemblance. | **Montrer** : scénarios stratégiques puis opérationnels, avec un seul scénario mémorable. |
| Cotation et risque résiduel | Fort | Matrices initiale/résiduelle, trois méthodes de vraisemblance, justification et cartographies. | **Montrer** : bascule avant/après traitement. |
| Traitement et responsabilisation | Fort | Mesures, porteur, échéance, priorité, plan d'action, acceptation métier et workflow d'approbation. | **Montrer** : une mesure prioritaire et une acceptation explicitement gouvernée. |
| Gouvernance et séparation des rôles | Fort | RBAC 12 rôles, multi-organisation, quatre-yeux, piste d'audit, partage par analyse. | **Montrer** : changement de point de vue analyste → RSSI/direction, sans détailler l'administration. |
| Référentiels et conformité cyber | Fort | ISO 27001:2022, NIST CSF 2.0, CIS, ANSSI, DORA, contrôles personnalisés, socle, couverture dérivée, SoA. | **Montrer** : mesure EBIOS liée à une exigence et SoA/preuve ; éviter l'inventaire des 14 cadres. |
| Gestion des exceptions | Fort | Dérogations justifiées, compensées, limitées, alertées et clôturées avec preuves. | **Montrer** : seulement si elle sert le scénario ; c'est une excellente réponse à « que faites-vous quand un contrôle n'est pas applicable ? ». |
| Tiers et chaîne d'approvisionnement | Fort | Écosystème, tiers critiques, questionnaire TIC, registre d'information TIC et liens d'arrangements. | **Montrer** : un fournisseur critique dans le radar et son impact sur le scénario. |
| Pilotage direction et preuves | Fort | Dashboard, cartographies, packs comité, PDF/Excel/JSON/CSV, historique de versions. | **Montrer** : synthèse exécutive puis export PDF, jamais un export brut seul. |
| Profil de cybersécurité actuel vs cible (CSF 2.0) | Partiel | Référentiel et couverture existent, mais pas de profil CSF natif « current/target », ni trajectoire de maturité explicitement modélisée. | **Ne pas promettre** un moteur de maturité CSF ; présenter la couverture comme une base de décision. |
| Détection continue, vulnérabilités et exposition technique | Partiel | Connecteurs SIEM/webhooks et journalisation existent ; pas de CMDB/ASM, scanner de vulnérabilités ou corrélation SOC natifs démontrés. | **Ne pas montrer** comme une plate-forme SOC ou VM. |
| Réponse, continuité et rétablissement testés | Partiel | Incidents TIC, échéances DORA, RTO/RPO de processus et sauvegarde applicative ; pas de gestion complète de playbooks, exercices ni validation de PRA/PCA cyber. | **Ne pas revendiquer** la couverture complète Detect–Respond–Recover. |
| Quantification financière cyber (FAIR/Monte Carlo) | Hors promesse | Cotation qualitative EBIOS et coûts de mesures, pas de modèle FAIR natif. | Répondre clairement : « analyse qualitative et gouvernée ; quantification financière à intégrer selon le besoin ». |

### Verdict

**Prêt pour une démo cyber de niveau expert : 8/10.**

ACRA est particulièrement solide là où une démonstration cyber doit convaincre :
la chaîne de raisonnement EBIOS RM, l'appropriation métier, le traitement traçable,
les tiers, la conformité et la restitution pour la décision. Il serait contre-
productif de le positionner le 23 septembre comme un SOC, un scanner de
vulnérabilités, un outil de PRA ou un moteur de quantification financière.

## Narration recommandée (20 minutes)

| Temps | Séquence | Preuve à afficher | Message à faire retenir |
|---:|---|---|---|
| 0–2 min | Problème métier et périmètre | Tableau de bord ciblé cyber. | « Nous transformons une analyse complexe en décision actionnable. » |
| 2–6 min | Cadrage puis actifs critiques | Atelier 1 : valeur métier, bien support, DICT, socle. | « Le risque part du métier, pas d'une check-list. » |
| 6–10 min | Menace et écosystème | Atelier 2/3 : source de risque, tiers critique, radar, scénario stratégique. | « Le risque cyber inclut les dépendances. » |
| 10–13 min | Scénario concret | Atelier 4 : chemin d'attaque/MITRE et vraisemblance. | « Le scénario est explicable et discutable. » |
| 13–16 min | Décision de traitement | Atelier 5 : risque résiduel, mesure, responsable, date et référentiel associé. | « Une analyse devient un plan financé et piloté. » |
| 16–18 min | Gouvernance | Approbation RSSI et/ou acceptation par la direction, piste d'audit. | « La responsabilité est explicite, pas implicite. » |
| 18–20 min | Pilotage | Cartographie/packs comité puis PDF. | « Une même donnée sert l'analyste, le RSSI et la direction. » |

**Fil rouge conseillé :** compromission par rançongiciel d'un fournisseur critique
affectant un service métier. Il mobilise naturellement DICT, tiers, scénario,
mesures de résilience, ISO 27001/NIST CSF et arbitrage de risque, sans dériver
vers le risque opérationnel.

## À préparer avant la présentation

### Indispensable (P0)

1. Créer ou vérifier **une seule analyse fil rouge**, complète et cohérente sur
   les cinq ateliers ; aucune donnée incomplète ou générique ne doit apparaître.
2. Préparer trois comptes ou vues : **analyste**, **RSSI/Risk Manager** et
   **direction métier**. Le compte de démonstration doit être isolé du compte
   d'administration.
3. Vérifier le chemin complet : modification → soumission → approbation →
   acceptation → export PDF ; prévoir le PDF déjà généré en secours.
4. Épingler les écrans utiles et fermer les modules hors récit : incidents/pertes,
   campagnes RCSA, audit, contrôle permanent et pages d'administration.
5. Répéter en condition réseau réelle avec une sauvegarde locale de la démo,
   les navigateurs nettoyés et une résolution adaptée à la salle.

### Améliorations courtes, à forte valeur (P1)

- Ajouter une **vue de synthèse CSF 2.0** limitée au scénario : six fonctions,
  couverture actuelle, cible et trois écarts prioritaires. Cela répond au langage
  des directions sans créer un nouveau module de maturité.
- Ajouter une page ou une annexe « **limites et responsabilités** » : ACRA guide
  et trace la décision ; les sources techniques, le SOC, le PRA et les tests
  restent des systèmes/processus complémentaires.
- Vérifier qu'aucune donnée de démo n'affiche des pertes LDC, campagnes RCSA ou
  vocabulaire de risque opérationnel dans les widgets visibles du dashboard.

### Hors périmètre de la démo, mais backlog stratégique (P2)

- Profils CSF 2.0 natifs actuel/cible, tiers de maturité et trajectoire datée ;
- connecteurs de preuves techniques (vulnérabilités, EDR/SIEM, CMDB) avec
  provenance et fraîcheur ;
- playbooks de réponse, exercices et preuve de test PCA/PRA ;
- quantification financière cyber optionnelle, si le marché la réclame.

## Formulations commerciales sûres

Dire : « ACRA structure l'analyse de risque cyber EBIOS RM, relie les scénarios
aux mesures et aux référentiels, puis rend la décision et son suivi auditables. »

Ne pas dire : « ACRA rend l'organisation conforme ISO/NIS2/DORA », « ACRA détecte
les attaques » ou « ACRA remplace le SOC/PRA ». Les référentiels sont des cadres
de couverture et de preuve ; la conformité résulte de la mise en œuvre,
l'efficacité et des obligations propres à l'organisation.

## Preuves de dépôt consultées

- [`README.md`](../README.md) : parcours EBIOS, référentiels, gouvernance,
  interopérabilité et exports ;
- [`conformite-label-ebios-rm.md`](conformite-label-ebios-rm.md) : auto-évaluation
  méthodologique EBIOS RM et réserves de labellisation ;
- [`ARCHITECTURE.md`](ARCHITECTURE.md) : modules, routes et invariants ;
- [`prisma/schema.prisma`](../prisma/schema.prisma) : objets de risque, contrôle,
  tiers, incident, référentiel, dérogation et organisation.
