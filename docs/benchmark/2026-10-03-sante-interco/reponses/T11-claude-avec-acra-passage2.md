# T11 — Claude (Opus 5.5) avec ACRA, passage 2

**Laboratoire de biologie médicale de 12 sites : analyse EBIOS RM, ateliers 3 à 5**

**Atelier 3 : 4 parties prenantes cotées**

L'exposition est le produit dépendance × pénétration ; la fiabilité est le produit maturité × confiance.

| Partie prenante | Dépendance | Pénétration | Maturité | Confiance | Exposition | Fiabilité | Zone |
|---|---|---|---|---|---|---|---|
| Éditeur du SGL et du middleware (télémaintenance, mises à jour, interfaces) | 4 | 4 | 3 | 3 | 16 | 9 | Danger |
| Fabricants d'automates (télémaintenance, comptes par défaut, systèmes d'exploitation anciens) | 4 | 3 | 2 | 3 | 12 | 6 | Danger |
| Hébergeur HDS et éditeur du serveur de résultats patients | 4 | 3 | 3 | 3 | 12 | 9 | Danger |
| Établissements et médecins prescripteurs (prescription électronique entrante, MSSanté) | 3 | 3 | 2 | 3 | 9 | 6 | Contrôle |

**Scénarios stratégiques**

| # | Scénario | Chemin | Gravité | Vraisemblance |
|---|---|---|---|---|
| SS1 (D) | Un groupe de rançongiciel entre par la télémaintenance de l'éditeur ou d'un fabricant. Le chiffrement du SGL et du middleware arrête la validation et la transmission des résultats, y compris urgents, sur les 12 sites. | Rançongiciel → éditeur ou fabricant → accès distant → SGL → liaisons entre sites | 4 | 3 |
| SS2 (I) | Un attaquant, ou une erreur d'interface, modifie des résultats ou des identifications d'échantillons entre l'automate, le middleware et le SGL, ou modifie les règles d'autovalidation. Les résultats faux sont publiés et transmis. | Attaquant → poste d'un site → réseau analytique non cloisonné → base du middleware | 4 | 2 |
| SS3 (C) | Moissonnage du serveur de résultats patients (codes d'accès faibles ou identifiants prévisibles) ou bourrage d'identifiants. Exfiltration de résultats sensibles (VIH, grossesse, génétique) suivie d'extorsion. | Cybercriminel → serveur de résultats exposé → API | 4 | 3 |

**Atelier 4 : scénarios opérationnels**

SO1, qui décline SS1 :
1. Reconnaissance des accès distants exposés : solutions de prise en main, VPN des fabricants (T1595, T1133).
2. Compromission du compte de télémaintenance de l'éditeur, par identifiants issus d'un voleur d'informations ou réutilisés (T1199, T1078).
3. Connexion au serveur du SGL et extraction d'identifiants (T1003).
4. Mouvement latéral par des liaisons entre sites non filtrées vers le middleware et les serveurs des sites (T1021.001, T1021.002).
5. Suppression ou chiffrement des sauvegardes accessibles (T1490), exfiltration (T1567.002).
6. Chiffrement simultané (T1486) : les automates ne remontent plus rien, les résultats sont rendus sur papier et par téléphone.

SO2, qui décline SS2 :
1. Hameçonnage d'une secrétaire ou d'un technicien d'un site (T1566.001).
2. Vol des identifiants VPN entre sites stockés dans le navigateur (T1555).
3. Accès au réseau analytique, non séparé de la bureautique (T1021).
4. Connexion à la base du middleware avec un compte par défaut du fabricant (T1078.001).
5. Modification des règles d'autovalidation ou des valeurs dans les messages HL7 ou ASTM entre l'automate et le SGL (T1565.001, T1565.002).
6. Les résultats faux sont validés automatiquement, publiés sur le serveur de résultats et envoyés aux prescripteurs par MSSanté.

**Atelier 5 : 10 mesures**

| # | Mesure | Type | Priorité | Risque couvert | Référence |
|---|---|---|---|---|---|
| 1 | Télémaintenance de l'éditeur et des fabricants via un bastion : ouverte à la demande, nominative, double facteur, sessions enregistrées. Clauses contractuelles de sécurité, de notification et d'audit. | Technique et contractuelle | P1 | SS1 | ISO/IEC 27001:2022, A.5.19, A.5.20 et A.8.5 |
| 2 | Cloisonnement du réseau analytique (automates et middleware) par rapport à la bureautique, liaisons entre sites filtrées au strict besoin | Technique | P1 | SS1, SS2 | ISO/IEC 27001:2022, A.8.22 |
| 3 | Sauvegardes hors ligne ou immuables du SGL avec restauration chronométrée. Mode dégradé exercé : rendu papier et téléphoné des résultats critiques, priorisation des urgences. | Technique et organisationnelle | P1 | SS1 | ISO/IEC 27001:2022, A.8.13 et A.5.30 |
| 4 | Comptes par défaut des automates et du middleware supprimés ou changés. Gestion des vulnérabilités avec les fabricants. Isolement des équipements qui ne peuvent pas être corrigés. | Technique | P1 | SS1, SS2 | Règlement (UE) 2017/746 (DMDIV) ; ISO/IEC 27001:2022, A.8.8 |
| 5 | Gestion des changements des règles d'autovalidation (double validation par un biologiste, traçabilité). Rapprochement par échantillon entre les valeurs brutes de l'automate et le SGL. Contrôles de qualité internes et externes. | Organisationnelle, détective | P1 | SS2 | NF EN ISO 15189 (accréditation COFRAC, version à vérifier) |
| 6 | Identitovigilance : INS qualifiée dès l'enregistrement de la prescription, étiquetage et contrôle de l'identité des échantillons | Organisationnelle | P1 | SS2 (mauvais patient) | CSP art. L. 1111-8-1 |
| 7 | Empreinte de chaque compte rendu publié et contrôle de concordance entre le SGL et le serveur de résultats : une divergence bloque la publication | Technique | P2 | SS2 | ISO/IEC 27001:2022, A.8.24 |
| 8 | Serveur de résultats : authentification forte du patient (code à usage unique ou FranceConnect, pas d'accès par simple date de naissance), identifiants opaques, autorisation objet par objet, limitation de débit, liens à durée limitée | Technique | P1 | SS3 | OWASP API Security Top 10 — 2023, API1 et API4 ; ISO/IEC 27001:2022, A.8.5 |
| 9 | Transmission aux prescripteurs exclusivement par MSSanté, accès des professionnels au serveur par Pro Santé Connect, interdiction de la messagerie grand public | Organisationnelle | P2 | SS3 | PGSSI-S |
| 10 | Détection : EDR sur les serveurs et les postes, journalisation centralisée et alertes sur les exports massifs, les modifications de règles et les connexions de télémaintenance hors fenêtre. Procédure de signalement à l'ARS et au CERT Santé, et à la CNIL sous 72 h. | Détective | P2 | SS1, SS2, SS3 | ISO/IEC 27001:2022, A.8.15 et A.8.16 ; RGPD art. 33 ; CSP art. L. 1111-8-2 (à vérifier) |
