# Programme de tests de résilience opérationnelle numérique (DORA)

**Statut :** lot 1 livré · **Date :** 2026-09-29 · **Référence :** Règlement (UE) 2022/2554 (DORA), articles 6 § 5, 24, 25 et 26 — texte officiel EUR-Lex (FR, EN, DE, ES, IT) repris tel quel pour les libellés.

## 1. Objectif

Tenir le **programme de tests de résilience opérationnelle numérique** (art. 24), rattaché au
cadre de gestion du risque lié aux TIC (art. 6), enregistrer les tests et leurs résultats, les
relier aux **fonctions critiques ou importantes**, aux processus et au **registre des risques**,
puis compiler ces résultats dans le **rapport sur le réexamen du cadre de gestion du risque lié
aux TIC** (art. 6 § 5), présenté à l'autorité compétente à sa demande.

## 2. Données (`TestResilience`, une ligne par test)

- année du programme, intitulé, **type de test** (art. 25 § 1, libellés officiels ; + TLPT, art. 26) ;
- périmètre (systèmes / applications), **soutient une fonction critique ou importante**, processus
  métier lié, risques du registre liés ;
- testeur interne ou externe, **indépendance** (art. 24 § 4) ;
- statut (planifié, en cours, réalisé, annulé), dates prévue / de réalisation ;
- résultat (synthèse) et **constats** (description, sévérité 1–4, corrigé ou non — art. 24 § 5).

## 3. Indicateurs du programme (par année)

Réalisation (réalisés / planifiés hors annulés), répartition par type, tests réalisés sur des
systèmes soutenant des fonctions critiques ou importantes (art. 24 § 6 : au moins une fois par
an), constats ouverts / corrigés par sévérité, tests non indépendants, date du dernier TLPT et
échéance (au moins tous les trois ans, art. 26 § 1).

## 4. Rapport de réexamen (art. 6 § 5)

Document Word généré pour une année : programme et réalisation, couverture des fonctions
critiques ou importantes, constats et remédiation, incidents majeurs liés aux TIC de l'année
(module de reporting DORA), risques du registre liés aux tests, conclusions à compléter par
l'entité. Libellés dans la langue de l'utilisateur, intitulés réglementaires officiels.

## 5. Droits et activation

Module « Reporting réglementaire » (DORA) actif, sinon 404. Lecture : rôles à lecture globale
du dispositif. Écriture : ADMIN, RSSI, RISK_MANAGER (`peutEvaluerDora`). Écritures limitées en
débit et journalisées ; export journalisé.
