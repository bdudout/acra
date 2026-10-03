# Incident majeur DORA : panne du moteur de paiement (détection lundi 5 octobre 2026)

Les échéances sont calculées à partir des textes. Les sources sont les outils ACRA, qui renvoient eux-mêmes un cadrage « à confirmer auprès de l'autorité ». Ce n'est pas un avis juridique.

## 1. Échéances horodatées

Le 5 octobre 2026 est un lundi. Paris est en heure d'été (CEST, UTC+2) jusqu'au 25 octobre.

Faits de départ : connaissance et détection à 12h30, classification « majeur » à 14h00.

| Déclaration | Règle de calcul | Échéance |
|---|---|---|
| Notification initiale | 4 h après la classification « majeur », et au plus tard 24 h après la connaissance de l'incident. La règle la plus stricte s'applique. | **Lundi 5 octobre 2026, 18h00.** La borne des 24 h (mardi 6 octobre, 12h30) est moins stricte. |
| Rapport intermédiaire | Au plus tard 72 h après la remise de la notification initiale, puis à chaque mise à jour pertinente. Un rapport est aussi à remettre dès la reprise des activités habituelles. | **Jeudi 8 octobre 2026, 18h00** si la notification initiale est remise à 18h00. Le délai court depuis la remise effective : une remise plus tôt avance l'échéance. |
| Rapport final | Au plus tard un mois après le rapport intermédiaire (le dernier, s'il a été mis à jour). | **Dimanche 8 novembre 2026, 18h00** si le rapport intermédiaire est remis à l'échéance. Ce délai glisse à chaque mise à jour du rapport intermédiaire. |

- **Texte d'origine :** la base juridique est l'article 19 du règlement (UE) 2022/2554 (DORA) et l'article 5 du règlement délégué (UE) 2025/301. Je ne cite pas l'article mot à mot, car l'outil ne fournit que des paraphrases. La formulation exacte est à vérifier sur EUR-Lex (https://eur-lex.europa.eu/eli/reg_del/2025/301/oj/eng).
- **Week-ends et jours fériés :** la tolérance d'une remise avant midi le jour ouvré suivant **ne s'applique pas aux établissements de crédit**. L'échéance du dimanche 8 novembre est donc ferme.
- **Rapport intermédiaire mensuel :** au moins un rapport intermédiaire par mois est attendu jusqu'au rapport final.
- **Délai impossible à tenir :** informer l'autorité sans délai, en indiquant les raisons.
- **Point à vérifier :** « connaissance » et « détection » sont ici confondues à 12h30. Si la connaissance de l'incident est antérieure à la détection, la borne des 24 h avance d'autant.

## 2. Destinataire et canal en France

- **Destinataire :** l'ACPR. La BCE ne reçoit la déclaration que pour les établissements « importants », ce qui n'est pas le cas ici.
- **Canal :** le portail **OneGate** de l'ACPR. Le rapport s'appelle **DORA_IR**, dans le domaine **DSB** (banque). Le format est un fichier **JSON** validé par le schéma officiel, sans signature électronique.
- **Repli si OneGate est indisponible** (0h à 4h et le dimanche) : courriel de repli à l'ACPR, puis remise dès la réouverture.
- **Conséquence pour le calendrier :** le rapport final tombe un dimanche, jour où OneGate est fermé. Mieux vaut le remettre le vendredi 6 ou le samedi 7 novembre, ou prévoir le repli par courriel.
- **Point à vérifier :** l'adresse du courriel de repli, la langue de dépôt et la version du schéma JSON en vigueur. L'outil ne les fournit pas.
- **Autres régimes :** pour une entité soumise à DORA, la déclaration DORA tient lieu de déclaration NIS2 (lex specialis). Si des données personnelles sont touchées, l'article 33 du RGPD (CNIL, 72 h) reste à examiner séparément. Cela ne semble pas être le cas pour une simple panne.

## 3. Champs de la notification initiale

Le glossaire de données (règlement d'exécution (UE) 2025/302, annexe II) compte **25 champs** pour l'étape INITIAL. J'ai repris les intitulés tels que l'outil les restitue : ils sont en anglais et l'outil ne fournit pas de version française.

Légende : O = obligatoire dans tous les cas ; C = conditionnel, à renseigner seulement si la condition est remplie.

| N° | Intitulé officiel | Statut |
|---|---|---|
| 1.1 | Type of submission (ici : « initial notification ») | O |
| 1.2 | Name of the entity submitting the report | O |
| 1.3 | Identification code of the entity submitting the report (LEI) | O |
| 1.4 | Type of financial entity affected (ici : « credit institution ») | O |
| 1.5 | Name of the financial entity affected | C : si l'entité diffère de l'émetteur de la déclaration, ou en déclaration agrégée |
| 1.6 | LEI code of the financial entity affected | C : même condition que 1.5 |
| 1.7 | Primary contact person name | O |
| 1.8 | Primary contact person email | O |
| 1.9 | Primary contact person telephone | O |
| 1.10 | Second contact person name | O (à vérifier, voir réserves) |
| 1.11 | Second contact person email | O (à vérifier) |
| 1.12 | Second contact person telephone | O (à vérifier) |
| 1.13 | Name of the ultimate parent undertaking | C : si l'entité appartient à un groupe |
| 1.14 | LEI code of the ultimate parent undertaking | C : si l'entité appartient à un groupe |
| 1.15 | Reporting currency | O |
| 2.1 | Incident reference code assigned by the financial entity | O |
| 2.2 | Date and time of detection of the major ICT-related incident | O (ici : 5 octobre 2026, 12h30) |
| 2.3 | Date and time of classification of the ICT-related incident as major | O (ici : 5 octobre 2026, 14h00) |
| 2.4 | Description of the major ICT-related incident | O |
| 2.5 | Classification criteria that triggered the incident report | O |
| 2.6 | Materiality thresholds for the classification criterion « Geographical spread » | C : si le seuil « étendue géographique » est atteint (codes ISO 3166 alpha-2, pays d'origine exclu) |
| 2.7 | Discovery of the major ICT-related incident | O |
| 2.8 | Indication whether the major ICT-related incident originates from a third-party provider or another financial entity | C : si l'incident provient d'un tiers prestataire ou d'une autre entité financière |
| 2.9 | Activation of business continuity plan, if activated | O |
| 2.10 | Other relevant information | C : s'il existe des informations complémentaires, ou en cas de reclassement en « non majeur » |

**Décompte exact d'après le tableau : 18 champs obligatoires dans tous les cas** (1.1 à 1.4, 1.7 à 1.12, 1.15, 2.1 à 2.5, 2.7, 2.9) **et 7 conditionnels** (1.5, 1.6, 1.13, 1.14, 2.6, 2.8, 2.10).

Valeurs possibles :
- **2.5** : clients, contreparties financières et transactions affectés ; impact sur la réputation ; durée et indisponibilité du service ; étendue géographique ; pertes de données ; services critiques affectés ; impact économique.
- **1.4** : liste de 23 valeurs, dont « credit institution ».
- **2.7** : liste de 11 valeurs, non reproduite ici. Elle est à consulter dans l'annexe II.

Pour ce cas, les critères 2.5 probablement pertinents sont « durée et indisponibilité du service », « clients, contreparties financières et transactions affectés » et « services critiques affectés ». C'est à confirmer sur les seuils du règlement délégué (UE) 2024/1772.

**Réserves sur les champs :**
1. **Cohérence de numérotation.** La fiche du régime DORA évoque des champs « 1.3a/1.3b » qui ne doivent pas changer entre la notification initiale et le rapport final. Le glossaire renvoyé par l'outil numérote ces champs 1.3 et 1.4. À vérifier sur l'annexe II publiée sur EUR-Lex.
2. **Caractère obligatoire du second contact (1.10 à 1.12).** L'outil les marque obligatoires. C'est à vérifier dans le texte officiel.
3. **Contenu minimal.** L'outil ne détaille pas le contenu minimal de la notification initiale prévu par le règlement délégué (UE) 2025/301 (article 3). Il est à croiser avec la liste ci-dessus.
4. **Intitulés en français.** À reprendre depuis la version française officielle sur EUR-Lex plutôt que d'une traduction libre, conformément à la règle du projet.

## Ce que les outils ne couvrent pas

- Le jeu de données du rapport intermédiaire et du rapport final n'a pas été extrait, seule l'étape initiale a été demandée.
- Le calendrier des jours fériés et le calendrier d'ouverture exact d'OneGate ne sont pas fournis.
- Aucun incident type ne correspond à « panne de paiement » (recherche vide). La décision de classer l'incident comme majeur reste à l'entité.

## Appels d'outils réalisés

1. `scripts/acra-tool.ts` sans argument : liste des outils.
2. `read_notification_regimes '{}'` : régimes de déclaration. Le contenu DORA a été utilisé, la sortie était tronquée après le régime SEC 8-K.
3. `read_dora_fields '{}'` : erreur `etape_invalide` (paramètre `stage` manquant).
4. `read_dora_fields '{"stage":"INITIAL"}'` : 25 champs.
5. `read_notification_regimes '{"code":"DORA"}'` : sortie non exploitée, car redondante avec l'appel 2.
6. `read_incident_types '{"query":"panne paiement"}'` : aucun résultat.