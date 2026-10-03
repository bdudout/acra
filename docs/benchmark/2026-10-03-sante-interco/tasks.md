# Tâches du comparatif santé / assurance santé / interconnexions (identiques pour les deux conditions)

Protocole : `docs/specs/benchmark-acra-vs-claude.md` (condition A : Opus 5.5 seul, sans outil ni
fichier ni web ; condition B : Opus 5.5 contraint par ACRA, via `scripts/acra-tool.ts` seulement).
Énoncés et faits de référence écrits **avant** l'enrichissement du contenu et avant les réponses.
T10 est une tâche **témoin** : aucun contenu ACRA n'est écrit spécifiquement pour elle.

Consigne commune : réponds en français, de façon structurée et précise, au niveau d'un expert du
domaine. Ne rien inventer : si tu n'es pas sûr d'un fait (article, délai, intitulé), écris « à
vérifier ». Livre uniquement la réponse demandée.

## T6 — Portail d'accès aux données de santé (EBIOS RM, ateliers 1 à 5)
Un groupement hospitalier ouvre un portail web et mobile permettant aux patients de consulter
leurs comptes rendus, résultats de biologie et images, de prendre rendez-vous et d'échanger avec
les services ; les médecins de ville y accèdent aux documents de leurs patients. Le portail est
hébergé chez un hébergeur certifié HDS et interconnecté au dossier patient informatisé de
l'établissement.
Produis : 5 valeurs métier, 6 biens supports, 4 événements redoutés (gravité 1-4), 3 sources de
risque, 3 scénarios stratégiques (gravité et vraisemblance 1-4), 2 scénarios opérationnels (suite
d'actions élémentaires), et un plan de traitement de 8 mesures (type, priorité, risque couvert).

## T7 — Interconnexion avec un prestataire qui livre des données
Une mutuelle santé reçoit chaque nuit d'un prestataire de tiers payant des fichiers de décomptes
(SFTP) et interroge en journée son API pour les accords de prise en charge. Les données servent
directement au calcul et au paiement des remboursements.
Produis un registre de 10 risques (intitulé, cause, conséquence, gravité 1-4, vraisemblance 1-4)
et un plan d'action de 10 actions (intitulé, type préventif/détectif/correctif, responsable type,
échéance relative, risque(s) traité(s)), plus 4 indicateurs de risque (KRI) pertinents.

## T8 — Interconnexion d'échange de données métier entre deux SI
Un assureur santé et un délégataire de gestion échangent dans les deux sens, par API REST et
fichiers, les adhésions, cotisations, prestations et pièces justificatives (dont données de santé).
Produis : la cartographie des parties prenantes (exposition / fiabilité), 3 scénarios
stratégiques, 2 scénarios opérationnels, et 10 mesures de sécurité de l'interconnexion
(techniques et contractuelles), en citant les textes applicables (sans en reproduire le contenu).

## T9 — Contrôles et KRI d'un hébergeur / plateforme e-santé
Une plateforme de téléconsultation hébergeant des données de santé pour des professionnels
demande 10 contrôles permanents (intitulé, périodicité, type, risque couvert, référence précise)
et 6 KRI (unité, sens de dégradation, périodicité).

## T10 — Télésurveillance médicale (tâche témoin)
Un opérateur de télésurveillance médicale suit à distance des patients insuffisants cardiaques
équipés de dispositifs connectés ; les données transitent par la plateforme du fabricant puis sont
intégrées dans le logiciel de l'opérateur, qui alerte les infirmiers et les cardiologues.
Produis 8 risques (gravité et vraisemblance 1-4) et 8 mesures de traitement prioritaires.

---

## Faits de référence (grille, 1 point par élément présent et correct)

### T6 (15 + qualité)
Usurpation de compte patient (identifiants faibles, absence de double facteur) · divulgation de
données de santé (RGPD art. 9) · accès d'un médecin de ville hors relation de soins
(habilitations, traçabilité) · erreur d'identitovigilance / document attribué au mauvais patient
(INS) · indisponibilité du portail / dépendance à l'hébergeur HDS · interconnexion DPI ↔ portail
comme vecteur vers le SI hospitalier (segmentation, flux sortants seulement) · vulnérabilités
applicatives web/mobile (OWASP, API) · moissonnage/énumération par API (IDOR) · messagerie avec les
services (pièces jointes malveillantes) · intégrité des résultats/images diffusés · journalisation
et détection des accès anormaux · fédération d'identité (FranceConnect / Pro Santé Connect / e-CPS)
· sous-traitant HDS et clauses (art. 28 RGPD, certification HDS) · scénario opérationnel cohérent
(actions élémentaires ordonnées) · mesures typées et reliées aux risques.
Qualité : cotations présentes et cohérentes, spécificité, **−1 par référence inventée**.

### T7 (12 + qualité)
Fichier corrompu/incomplet/rejoué → paiements erronés ou doublons · fichier falsifié (intégrité,
signature) · compromission du compte SFTP / des clés · indisponibilité du prestataire ou du flux
(retard de paiement) · fuite de données de santé dans le flux · dérive de format / changement non
annoncé · secret d'API exposé / jeton à longue durée · injection via données reçues (validation)
· réversibilité / dépendance (fin de contrat) · absence de rapprochement et de contrôle de
complétude (comptes, totaux de contrôle) · contrôles prestataire (DORA prestataire TIC si
applicable, clauses d'audit) · KRI pertinents (taux de rejet, retard de livraison, écarts de
rapprochement, incidents prestataire).

### T8 (12 + qualité)
Parties prenantes : délégataire, éditeur/hébergeur, courtier/apporteur, assuré, ACPR, CNIL ·
exposition / fiabilité motivées · scénario « compromission du délégataire → rebond vers
l'assureur » · « exfiltration de données de santé via l'API » · « altération des prestations /
fraude » · mesures : authentification mutuelle (mTLS / OAuth2 client credentials), moindre
privilège par flux, chiffrement en transit, validation de schéma, journalisation corrélée, contrat
de délégation avec clauses sécurité/audit/notification, convention d'interconnexion · textes :
RGPD art. 9, 28, 32 ; DORA (prestataires TIC, art. 28-30) ; Code des assurances délégation de
gestion / externalisation (Solvabilité II art. 49) · **−1 par référence inventée**.

### T9 (10 + qualité)
Certification HDS (référentiel HDS) · revue des habilitations et accès aux données de santé ·
journalisation et revue des accès · sauvegarde et test de restauration · gestion des
vulnérabilités / correctifs · test de continuité · chiffrement et gestion des clés · gestion des
incidents et notification (RGPD art. 33, violation de données) · contrôle des sous-traitants ·
identité des professionnels (e-CPS / Pro Santé Connect) · KRI cohérents (unité, sens).

### T10 (10 + qualité, tâche témoin)
Alerte non reçue / perdue → retard de prise en charge (sécurité du patient) · dépendance à la
plateforme du fabricant · intégrité des mesures (fausse alerte / alerte masquée) · interconnexion
fabricant ↔ opérateur · dispositif médical connecté vulnérable (règlement (UE) 2017/745) ·
données de santé (RGPD art. 9, HDS) · identitovigilance (mesure attribuée au mauvais patient) ·
astreinte / organisation des alertes · supervision de la chaîne de bout en bout · mesures de
continuité (mode dégradé) et tests.
