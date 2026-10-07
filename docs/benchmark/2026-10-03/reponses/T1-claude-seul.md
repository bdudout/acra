Réponse de mémoire, sans consultation de source. Tout ce qui est marqué « à vérifier » doit être confronté au texte officiel sur EUR-Lex avant d'être repris dans le produit. Ma confiance est élevée sur les délais et le destinataire. Elle est moyenne sur le canal ACPR. Elle est faible sur la numérotation fine des champs.

## 1. Échéances (incident détecté lundi 5/10/2026 à 12h30, classé majeur à 14h00)

Sources :
- Règlement (UE) 2022/2554 (DORA), art. 19, §4.
- Règlement délégué (UE) 2025/301 (RTS sur le contenu et les délais des notifications), art. 6. J'ai cité 2025/301 de mémoire ; l'ancien numéro de projet était 2024/1772, qui est un autre RTS (classification). À vérifier.
- Règlement d'exécution (UE) 2025/302 (ITS sur les formulaires et modèles).

Fuseau : Paris en heure d'été (CEST) jusqu'au 25/10/2026, puis CET. Tous les horaires ci-dessous sont en heure de Paris.

| Déclaration | Règle de calcul (texte d'origine) | Échéance |
|---|---|---|
| Notification initiale | DORA art. 19(4)(a) : « au plus tard 4 heures après la classification de l'incident comme majeur, et au plus tard 24 heures après le moment où l'entité financière a pris connaissance de l'incident ». Les deux bornes s'appliquent et la plus proche prévaut. | 4 h après classification = lundi 5/10 à 18h00. 24 h après connaissance = mardi 6/10 à 12h30. **Échéance = lundi 5/10/2026 à 18h00.** |
| Rapport intermédiaire | Art. 19(4)(b) : « dans les 72 heures suivant la soumission de la notification initiale, même si le statut ou la gestion n'ont pas changé ». Des mises à jour sont aussi dues à chaque évolution pertinente et sur demande de l'autorité. L'art. 6 du RTS précise que, si l'activité est rétablie, un rapport doit être déposé sans attendre. | 72 h après le dépôt effectif de la notification initiale. Au plus tard, si dépôt à 18h00 : **jeudi 8/10/2026 à 18h00**. Si dépôt plus tôt, l'échéance avance d'autant. |
| Rapport final | Art. 19(4)(c) : « au plus tard un mois après la soumission du rapport intermédiaire ». Je crois que le RTS précise « le dernier rapport intermédiaire mis à jour » (formulation à vérifier). Le rapport final est aussi dû quand l'analyse des causes profondes est terminée. | Un mois après le dernier rapport intermédiaire. Si celui-ci est déposé le 8/10 à 18h00 : **dimanche 8/11/2026 à 18h00**. Le texte ne prévoit pas de report au jour ouvré suivant. Par prudence, déposer avant, soit vendredi 6/11. |

Remarques :
- Le point de départ « prise de connaissance » est la détection (12h30), pas la classification.
- Le §2 de l'art. 6 du RTS prévoit un report au jour ouvré suivant à midi pour un incident classé un week-end ou un jour férié. Il ne s'applique pas ici : lundi est ouvré, et je crois que les établissements de crédit sont de toute façon exclus de cette dérogation (à vérifier).
- Si l'incident impacte les intérêts financiers de clients, l'art. 19(3) impose de les informer « sans retard injustifié ». Ce n'est pas une déclaration à l'autorité.

## 2. Destinataire et canal en France

- Destinataire : l'**ACPR**, autorité compétente pour cet établissement. Il est non significatif, donc sous supervision directe ACPR et non BCE. Pour un établissement significatif, la déclaration irait aussi à la BCE, en tant que supervision prudentielle (art. 46 DORA).
- Le dépôt unique passe par l'ACPR. L'ACPR relaie ensuite aux autres autorités concernées (AEMF/ABE, CSIRT, etc.), conformément à l'art. 19(7).
- Canal : portail de télédéclaration ACPR dédié DORA (famille OneGate / Extranet ACPR), avec les modèles ITS ESAs. Format exact (formulaire web, XBRL-CSV ou Excel) : **à vérifier** sur le site acpr.banque-france.fr. Une réception par courriel ou téléphone n'est pas le canal nominal.
- ANSSI/CERT-FR : pas de dépôt obligatoire au titre de DORA. DORA est lex specialis par rapport à NIS2, donc l'établissement ne fait pas de double déclaration NIS2. Un signalement volontaire reste possible. Le dépôt CNIL pour violation de données personnelles est un régime distinct (RGPD art. 33), à traiter à part s'il y a atteinte aux données.
- Les incidents de paiement majeurs au titre de la DSP2 sont désormais intégrés à DORA (art. 23). Aucune notification DSP2 séparée n'est requise.

## 3. Champs de la notification initiale (ITS 2025/302, Annexe I = glossaire de données ; la notification initiale figure dans les tableaux de l'Annexe II)

Avertissement : la numérotation et les intitulés ci-dessous sont reconstitués de mémoire. **Tous les numéros et libellés sont à vérifier** contre le texte officiel EUR-Lex avant de les graver dans l'outil. Je suis plus sûr du contenu que des numéros exacts. Je ne suis pas certain que la liste soit complète, notamment dans la zone 2.6 à 2.9.

**Bloc 1 : identification de l'entité déclarante et de l'entité affectée** (communs à toutes les phases)

| N° | Intitulé (à vérifier) | Statut |
|---|---|---|
| 1.1 | Type of submission | Obligatoire |
| 1.2 | Name of the entity submitting the report | Obligatoire |
| 1.3 | Identification code of the entity submitting the report | Obligatoire (LEI, ou autre code si pas de LEI) |
| 1.4 | Type of the affected financial entity | Obligatoire |
| 1.5 | Name of the financial entity affected | Obligatoire |
| 1.6 | LEI of the financial entity affected | Obligatoire |
| 1.7 | Primary contact person name | Obligatoire |
| 1.8 | Primary contact person email | Obligatoire |
| 1.9 | Primary contact person telephone | Obligatoire |
| 1.10 | Second contact person name | Facultatif, « si disponible » |
| 1.11 | Second contact person email | Facultatif |
| 1.12 | Second contact person telephone | Facultatif |
| 1.13 | Name of the ultimate parent undertaking | Conditionnel (si l'entité appartient à un groupe) |
| 1.14 | LEI of the ultimate parent undertaking | Conditionnel |

Les champs 1.1 à 1.9 doivent être renseignés dans toute notification. Le statut précis de 1.2 et 1.3 quand le déclarant est l'entité elle-même est à vérifier.

**Bloc 2 : contenu spécifique de la notification initiale**

| N° | Intitulé (à vérifier) | Statut |
|---|---|---|
| 2.1 | Incident reference code provided by the financial entity | Obligatoire |
| 2.2 | Date and time of detection of the incident | Obligatoire (ici 5/10/2026 12:30) |
| 2.3 | Date and time of classification of the incident as major | Obligatoire (ici 5/10/2026 14:00) |
| 2.4 | Description of the incident | Obligatoire |
| 2.5 | Classification criteria that triggered the incident report | Obligatoire |
| 2.6 | Member States impacted by the incident | Obligatoire si applicable (dimension transfrontalière) |
| 2.7 | Materiality thresholds for the classification criterion 'Geographical spread' | Conditionnel, lié au critère « étendue géographique » |
| 2.8 | Discovery of the incident | Obligatoire |
| 2.9 | Indication whether the incident originates from a third-party provider or another financial entity | Obligatoire |
| 2.10 | Activation of business continuity plan, if activated | Obligatoire si applicable |
| 2.11 | Other information | Facultatif |

Je ne suis pas sûr de l'ordre, ni de la présence exacte de 2.6 et 2.7. Je crois que les champs « Member States impacted » et « Geographical spread » ne se recouvrent pas dans l'annexe. Le total exact (de l'ordre de 25 champs) est à vérifier.

À noter : la notification initiale est volontairement légère. Les champs détaillés suivants relèvent du rapport intermédiaire et du rapport final, pas de la notification initiale :
- date et heure de survenance, date de rétablissement ;
- seuils chiffrés (clients, montants, durée) ;
- causes profondes, mesures correctives, coûts ;
- impact par pays.

## Points à faire valider
1. Texte exact de l'art. 6 du RTS 2025/301 (formulation du point de départ du rapport final).
2. Annexe II de l'ITS 2025/302 : numéros, intitulés officiels et statut obligatoire/conditionnel de chaque champ.
3. Canal technique ACPR actuel.

Conformément à la règle du projet, les intitulés doivent être repris de EUR-Lex et non traduits à la main dans les 5 langues, avec citation de la version du texte.