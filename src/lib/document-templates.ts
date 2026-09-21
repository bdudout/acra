// ─── Modèles d'annexes contractuelles / documents socle ──────────────────────
// Trames prêtes à l'emploi des annexes les plus classiques (Plan d'Assurance
// Sécurité, DPA RGPD, réversibilité, PCA/PRA, clause de sécurité, charte SI,
// annexe DORA prestataire TIC). Chaque modèle est un contenu Markdown avec des
// sections et des marqueurs « [à compléter] » que l'utilisateur adapte. Inséré
// dans la bibliothèque documentaire comme un vrai document (.md) éditable.
// Contenu FR, pur → testable. L'API génère le fichier et crée le Document.

import type { DocumentType } from './document'

/** Modèle de document socle (PAS, annexe contractuelle…) : identité + contenu Markdown pré-rempli. */
export interface DocumentTemplate {
  id: string // kebab-case, sert aussi de base au nom de fichier
  titre: string
  type: DocumentType
  description: string
  contenu: string // Markdown
}

/** Nom de fichier .docx sûr et déterministe pour un modèle (annexe contractuelle). */
export function templateFilename(t: DocumentTemplate): string {
  return `${t.id}.docx`
}

/** Type MIME des documents .docx générés. */
export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

/** Retourne le modèle de document (PAS, annexe contractuelle…) par son identifiant, ou undefined. */
export function getDocumentTemplate(id: string): DocumentTemplate | undefined {
  return DOCUMENT_TEMPLATES.find((t) => t.id === id)
}

const PAS = `# Plan d'Assurance Sécurité (PAS)

> Annexe sécurité au contrat entre **[Client]** et **[Prestataire]** — version [x.y] du [date].

## 1. Objet et périmètre
Décrit les engagements de sécurité du prestataire pour la prestation **[nom de la prestation]** couvrant **[services / systèmes / données concernés]**.

## 2. Organisation de la sécurité
- Responsable sécurité prestataire : [nom / fonction]
- Interlocuteur sécurité client : [nom / fonction]
- Comité de suivi sécurité : [fréquence]

## 3. Gouvernance et conformité
- Référentiels applicables : [ISO 27001, DORA, NIS2, RGPD, …]
- Certifications du prestataire : [à compléter]

## 4. Mesures de sécurité
- Contrôle d'accès et gestion des habilitations : [à compléter]
- Chiffrement (au repos / en transit) : [à compléter]
- Journalisation et supervision : [à compléter]
- Gestion des vulnérabilités et des correctifs : [à compléter]
- Sauvegardes et restauration : [à compléter]

## 5. Gestion des incidents de sécurité
- Délai de notification au client : [ex. 24 h]
- Modalités de notification : [canal, contact]
- Coopération en cas d'incident : [à compléter]

## 6. Continuité et réversibilité
- Objectifs de continuité (RTO / RPO) : [à compléter]
- Modalités de réversibilité : voir annexe dédiée.

## 7. Audit et contrôle
Le client peut auditer le dispositif [fréquence / modalités]. Le prestataire fournit les preuves de contrôle sur demande.

## 8. Sous-traitance ultérieure
Liste des sous-traitants autorisés : [à compléter]. Toute nouvelle sous-traitance est soumise à accord préalable.
`

const DPA = `# Annexe RGPD — Accord de sous-traitance (art. 28 RGPD)

> Entre le **responsable de traitement [Client]** et le **sous-traitant [Prestataire]**.

## 1. Objet
Encadre le traitement de données à caractère personnel réalisé par le sous-traitant pour le compte du responsable de traitement.

## 2. Description du traitement
- Finalité(s) : [à compléter]
- Nature des opérations : [collecte, hébergement, …]
- Catégories de personnes concernées : [clients, salariés, …]
- Catégories de données : [identité, coordonnées, …]
- Durée du traitement : [durée du contrat]

## 3. Obligations du sous-traitant (art. 28.3)
- Traiter les données sur instruction documentée du responsable.
- Garantir la confidentialité (personnes autorisées / engagement).
- Mettre en œuvre les mesures de sécurité (art. 32).
- Respecter les conditions de recours à un sous-traitant ultérieur.
- Aider le responsable (droits des personnes, art. 32-36).
- Supprimer ou renvoyer les données en fin de prestation.
- Mettre à disposition les informations nécessaires aux audits.

## 4. Sous-traitants ultérieurs
Liste autorisée : [à compléter]. Information préalable de tout changement.

## 5. Transferts hors UE
[Aucun / Décrire le mécanisme : CCT, décision d'adéquation, mesures supplémentaires].

## 6. Sécurité (art. 32)
[Renvoi au PAS / mesures : chiffrement, pseudonymisation, sauvegardes, tests].

## 7. Violation de données
Notification au responsable dans les meilleurs délais et au plus tard sous [ex. 24-48 h], avec les informations de l'art. 33.

## 8. Sort des données en fin de contrat
[Restitution / suppression] sous [délai], avec attestation.
`

const REVERSIBILITE = `# Annexe de réversibilité

> Modalités de restitution et de transfert en fin de contrat entre **[Client]** et **[Prestataire]**.

## 1. Objet
Garantir la continuité d'activité du client en cas de fin de contrat (terme, résiliation, défaillance) par la restitution des données et le transfert de la prestation.

## 2. Périmètre
- Données concernées : [à compléter]
- Configurations, paramétrages, documentation : [à compléter]

## 3. Formats de restitution
- Données : [format ouvert / exploitable, ex. CSV, JSON, SQL]
- Documentation d'exploitation : [à compléter]

## 4. Plan de réversibilité
- Déclenchement : [préavis]
- Phases : préparation → transfert → vérification → suppression chez le prestataire.
- Durée de la période de réversibilité : [ex. 3 mois]
- Assistance du prestataire : [jours / homme, tarifs]

## 5. Recette de réversibilité
Critères de vérification de l'intégrité et de la complétude des données transférées : [à compléter].

## 6. Suppression finale
Suppression sécurisée des données chez le prestataire avec attestation, sous [délai].
`

const PCA = `# Plan de Continuité et de Reprise d'Activité (PCA / PRA) — trame

## 1. Objectifs
- Activités essentielles couvertes : [à compléter]
- Objectifs de continuité : RTO (DIMA) = [à compléter], RPO (PDMA) = [à compléter]

## 2. Analyse d'impact (BIA)
| Activité | Criticité | RTO | RPO | Ressources clés |
|---|---|---|---|---|
| [à compléter] | | | | |

## 3. Scénarios de sinistre
- Indisponibilité SI / cyberattaque
- Indisponibilité des locaux
- Indisponibilité d'un prestataire critique
- Indisponibilité des personnes

## 4. Stratégies de continuité
- Solutions de repli (site, cloud, mode dégradé) : [à compléter]
- Sauvegardes et restauration : [à compléter]

## 5. Dispositif de gestion de crise
- Cellule de crise : [membres / rôles]
- Procédure d'escalade et d'alerte : [à compléter]
- Communication (interne / externe / régulateur) : [à compléter]

## 6. Procédures de reprise
Étapes de bascule et de retour à la normale : [à compléter].

## 7. Tests et maintien en condition
- Fréquence des tests : [ex. annuelle]
- Dernier test réalisé le : [date] — résultats : [à compléter]
`

const CLAUSE_SECU = `# Clause de sécurité (annexe contractuelle)

## 1. Engagement de sécurité
Le prestataire met en œuvre les mesures techniques et organisationnelles appropriées pour protéger la confidentialité, l'intégrité, la disponibilité et la traçabilité des informations du client.

## 2. Exigences minimales
- Politique de sécurité formalisée et maintenue.
- Gestion des accès selon le moindre privilège.
- Chiffrement des données sensibles (au repos et en transit).
- Journalisation des accès et des actions à privilèges.
- Gestion des vulnérabilités et application des correctifs.
- Sensibilisation du personnel à la sécurité.

## 3. Notification des incidents
Notification au client sous [délai] de tout incident affectant ses données ou services, avec un point de contact dédié.

## 4. Droit d'audit
Le client peut vérifier le respect des engagements [fréquence / modalités], directement ou via un tiers.

## 5. Sanctions
Le non-respect des engagements de sécurité constitue un manquement contractuel [préciser les conséquences].
`

const CHARTE_SI = `# Charte d'usage du système d'information

## 1. Objet
Définit les règles d'utilisation des ressources informatiques mises à disposition des utilisateurs de **[organisation]**.

## 2. Champ d'application
S'applique à tout utilisateur (salarié, stagiaire, prestataire) accédant au SI.

## 3. Règles d'usage
- Usage professionnel des ressources ; usage privé toléré raisonnable.
- Confidentialité des identifiants ; verrouillage de session.
- Interdiction de contourner les dispositifs de sécurité.
- Respect de la propriété intellectuelle et de la législation.

## 4. Sécurité
- Signalement de tout incident ou comportement suspect.
- Interdiction d'installer des logiciels non autorisés.
- Règles sur la mobilité et le télétravail : [à compléter].

## 5. Données personnelles et vie privée
Traitement des journaux à des fins de sécurité, dans le respect du RGPD et après information des instances représentatives.

## 6. Contrôle et sanctions
Modalités de contrôle proportionné et sanctions en cas de manquement : [à compléter].
`

const DORA_TIC = `# Annexe DORA — Prestataire de services TIC (art. 30)

> Dispositions contractuelles pour un service TIC soutenant une fonction critique ou importante.

## 1. Description du service
- Service TIC fourni : [à compléter]
- Fonction(s) soutenue(s) : [à compléter] — critique/importante : [oui / non]
- Localisation du traitement / stockage des données : [à compléter]

## 2. Niveaux de service
- Indicateurs et cibles (SLA) : [disponibilité, délais]
- RTO / RPO applicables : [à compléter]

## 3. Sécurité et résilience
- Mesures de sécurité (renvoi PAS) : [à compléter]
- Tests de résilience opérationnelle : [à compléter]

## 4. Assistance en cas d'incident
Assistance sans coût additionnel en cas d'incident majeur ; notification et coopération : [délais].

## 5. Droits d'accès, d'inspection et d'audit
Accès complet du client et des autorités compétentes aux informations, locaux et systèmes pertinents.

## 6. Sous-traitance TIC
Conditions de sous-traitance des fonctions critiques/importantes ; information et droit d'opposition.

## 7. Stratégie de sortie
Plan de sortie documenté garantissant la transition sans interruption : [renvoi annexe réversibilité].
`

const NDA = `# Accord de confidentialité (NDA)

> Entre **[Partie A]** et **[Partie B]** — en date du [date].

## 1. Objet
Protéger les informations confidentielles échangées dans le cadre de **[objet de la relation]**.

## 2. Informations confidentielles
Toute information technique, commerciale, financière ou personnelle, écrite ou orale, communiquée par une partie à l'autre, sauf information publique ou déjà connue légitimement.

## 3. Engagements
- Utiliser les informations uniquement aux fins de la relation.
- Ne pas divulguer à un tiers sans accord écrit préalable.
- Limiter l'accès aux personnes ayant besoin d'en connaître, elles-mêmes tenues à la confidentialité.
- Protéger les informations avec au moins le même soin que ses propres informations confidentielles.

## 4. Durée
Obligation de confidentialité pendant [durée] à compter de la divulgation, y compris après la fin de la relation.

## 5. Restitution
Restitution ou destruction des informations sur demande ou en fin de relation, avec attestation.

## 6. Données personnelles
Tout traitement de données personnelles est encadré par un accord distinct (art. 28 RGPD).
`

const SLA = `# Convention de niveau de service (SLA)

> Annexe de service au contrat entre **[Client]** et **[Prestataire]**.

## 1. Services couverts
[Description des services concernés par les engagements de niveau de service.]

## 2. Indicateurs et cibles
| Indicateur | Cible | Mesure |
|---|---|---|
| Disponibilité | [ex. 99,9 %/mois] | [méthode] |
| Délai de prise en compte (incident majeur) | [ex. 1 h] | [méthode] |
| Délai de rétablissement | [ex. 4 h] | [méthode] |

## 3. Horaires de service et support
- Plage de service : [ex. 24/7 ou 8h-18h ouvrés]
- Canaux de support : [portail, téléphone, e-mail]

## 4. Gestion des incidents
- Niveaux de criticité et délais associés : [à compléter]
- Escalade : [à compléter]

## 5. Reporting
Rapport périodique [mensuel] des indicateurs et des incidents.

## 6. Pénalités
Modalités de pénalité en cas de non-atteinte des cibles : [à compléter].
`

const POL_ACCES = `# Politique de gestion des accès et des habilitations

## 1. Objet et périmètre
Définir les règles d'attribution, de revue et de retrait des accès au système d'information de **[organisation]**.

## 2. Principes
- Moindre privilège et besoin d'en connaître.
- Séparation des tâches sur les fonctions sensibles.
- Nominativité des comptes ; comptes à privilèges tracés et encadrés.

## 3. Cycle de vie des accès
- Attribution : sur demande validée par [responsable], selon un profil type.
- Modification : à chaque changement de fonction.
- Retrait : au départ ou à la fin de mission, sans délai.

## 4. Revue des habilitations
Revue périodique [semestrielle] des accès, en particulier des comptes à privilèges et des comptes dormants.

## 5. Authentification
- Politique de mot de passe conforme à [référence].
- Authentification multifacteur pour les accès sensibles et distants.

## 6. Journalisation et contrôle
Journalisation des accès et des actions à privilèges ; contrôles réguliers.
`

const PROC_INCIDENT = `# Procédure de gestion des incidents de sécurité

## 1. Objet
Organiser la détection, le traitement et le retour d'expérience des incidents de sécurité de **[organisation]**.

## 2. Détection et signalement
- Sources : supervision, alertes, signalement utilisateur.
- Point de contact : [contact / canal] — signalement sans délai.

## 3. Qualification
- Catégorisation (confidentialité / intégrité / disponibilité) et évaluation de la gravité.
- Déclenchement de la cellule de crise si gravité élevée.

## 4. Traitement
- Endiguement, éradication, rétablissement.
- Préservation des preuves (journaux, images).

## 5. Notification
- Interne : [direction, métiers concernés].
- Externe : CNIL sous 72 h en cas de violation de données personnelles ; autorités sectorielles / régulateur selon obligations (ex. DORA).

## 6. Clôture et retour d'expérience
Analyse des causes, plan d'action correctif, mise à jour des mesures et de la présente procédure.
`

const FICHE_NC = `# Fiche de non-conformité

## Identification
- Référence : [NC-AAAA-NNN]
- Date de constat : [date]
- Constatée par : [nom / fonction]
- Source : [audit, contrôle, incident, réclamation]

## Description de l'écart
[Description factuelle de la non-conformité, exigence concernée, référentiel.]

## Analyse des causes
[Causes racines identifiées.]

## Traitement immédiat (correction)
[Action de correction et date.]

## Action corrective (pour éviter la récurrence)
- Action : [à compléter]
- Responsable : [à compléter]
- Échéance : [à compléter]

## Vérification d'efficacité
- Date de vérification : [date]
- Résultat : [efficace / non efficace]
- Clôture : [date / responsable]
`

export const DOCUMENT_TEMPLATES: DocumentTemplate[] = [
  { id: 'pas', titre: 'Plan d’Assurance Sécurité (PAS)', type: 'PROCEDURE',
    description: 'Annexe sécurité type à joindre à un contrat de prestation.', contenu: PAS },
  { id: 'dpa-rgpd', titre: 'Annexe RGPD — Accord de sous-traitance (art. 28)', type: 'PROCEDURE',
    description: 'Accord de sous-traitance de données personnelles (DPA) conforme à l’art. 28 du RGPD.', contenu: DPA },
  { id: 'reversibilite', titre: 'Annexe de réversibilité', type: 'PROCEDURE',
    description: 'Modalités de restitution et de transfert en fin de contrat.', contenu: REVERSIBILITE },
  { id: 'pca-pra', titre: 'Plan de Continuité / Reprise d’Activité (PCA/PRA) — trame', type: 'PROCEDURE',
    description: 'Trame de plan de continuité et de reprise d’activité (BIA, scénarios, tests).', contenu: PCA },
  { id: 'clause-securite', titre: 'Clause de sécurité contractuelle', type: 'POLITIQUE',
    description: 'Clause de sécurité à insérer dans un contrat fournisseur.', contenu: CLAUSE_SECU },
  { id: 'charte-si', titre: 'Charte d’usage du système d’information', type: 'POLITIQUE',
    description: 'Charte informatique type pour les utilisateurs du SI.', contenu: CHARTE_SI },
  { id: 'dora-tic', titre: 'Annexe DORA — Prestataire de services TIC (art. 30)', type: 'PROCEDURE',
    description: 'Clauses contractuelles DORA pour un prestataire TIC critique (art. 30).', contenu: DORA_TIC },
  { id: 'nda', titre: 'Accord de confidentialité (NDA)', type: 'PROCEDURE',
    description: 'Accord de confidentialité type entre deux parties.', contenu: NDA },
  { id: 'sla', titre: 'Convention de niveau de service (SLA)', type: 'PROCEDURE',
    description: 'Annexe de niveaux de service (disponibilité, délais, pénalités).', contenu: SLA },
  { id: 'politique-acces', titre: 'Politique de gestion des accès et habilitations', type: 'POLITIQUE',
    description: 'Règles d’attribution, de revue et de retrait des accès au SI.', contenu: POL_ACCES },
  { id: 'procedure-incident', titre: 'Procédure de gestion des incidents de sécurité', type: 'PROCEDURE',
    description: 'Détection, traitement, notification et retour d’expérience des incidents.', contenu: PROC_INCIDENT },
  { id: 'fiche-nc', titre: 'Fiche de non-conformité', type: 'PROCEDURE',
    description: 'Formulaire de constat, analyse et suivi d’une non-conformité.', contenu: FICHE_NC },
]
