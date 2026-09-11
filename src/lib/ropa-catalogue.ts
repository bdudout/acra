// ─── Socle RoPA par défaut (registre RGPD art. 30) ───────────────────────────
// Traitements « habituels » que réalise toute entreprise, inspirés du registre
// type de la CNIL (simplifié). Les cas d'usage trop spécifiques à la CNIL sont
// remplacés par un traitement « métier » PLACEHOLDER laissé volontairement
// incomplet (mis en avant comme « à compléter » par champsManquantsArt30).
// Contenu FR, point de départ éditable. Pur → testable, importé via l'API.

import type { Traitement } from './ropa'

/** Nom du traitement placeholder « métier » à compléter par l'organisation. */
export const ROPA_PLACEHOLDER_NOM = 'Traitement métier spécifique (à compléter)'

const SECU_BASE = ['Contrôle d’accès (habilitations)', 'Journalisation des accès', 'Sauvegardes chiffrées']

export function buildRopaDefaut(): Traitement[] {
  const t = (o: Partial<Traitement> & { nom: string; finalite: string; baseLegale: Traitement['baseLegale'] }): Traitement => ({
    nom: o.nom,
    finalite: o.finalite,
    baseLegale: o.baseLegale,
    categoriesPersonnes: o.categoriesPersonnes ?? [],
    categoriesDonnees: o.categoriesDonnees ?? [],
    destinataires: o.destinataires ?? [],
    transfertHorsUE: o.transfertHorsUE ?? false,
    paysTransfert: o.paysTransfert,
    garantiesTransfert: o.garantiesTransfert,
    dureeConservation: o.dureeConservation ?? '',
    mesuresSecurite: o.mesuresSecurite ?? SECU_BASE,
    grandeEchelle: o.grandeEchelle ?? false,
    surveillanceSystematique: o.surveillanceSystematique ?? false,
  })

  return [
    t({
      nom: 'Gestion de la paie',
      finalite: 'Établissement des bulletins de paie et versement des rémunérations, déclarations sociales.',
      baseLegale: 'obligation_legale',
      categoriesPersonnes: ['Salariés'],
      categoriesDonnees: ['Identité', 'Coordonnées', 'Situation familiale', 'RIB', 'Rémunération', 'Numéro de sécurité sociale'],
      destinataires: ['Service paie', 'Organismes sociaux (URSSAF, retraite)', 'Administration fiscale'],
      dureeConservation: 'Bulletins : 5 ans (durée légale, 50 ans recommandée pour le double) ; données de paie : 5 ans.',
    }),
    t({
      nom: 'Gestion administrative du personnel',
      finalite: 'Gestion des dossiers du personnel, contrats, absences, congés et carrières.',
      baseLegale: 'contrat',
      categoriesPersonnes: ['Salariés', 'Stagiaires'],
      categoriesDonnees: ['Identité', 'Coordonnées', 'Contrat', 'Diplômes', 'Absences et congés'],
      destinataires: ['Ressources humaines', 'Encadrement'],
      dureeConservation: 'Durée du contrat + 5 ans après le départ.',
    }),
    t({
      nom: 'Recrutement',
      finalite: 'Gestion des candidatures et des campagnes de recrutement.',
      baseLegale: 'interet_legitime',
      categoriesPersonnes: ['Candidats'],
      categoriesDonnees: ['Identité', 'Coordonnées', 'CV et parcours', 'Diplômes'],
      destinataires: ['Ressources humaines', 'Managers recruteurs'],
      dureeConservation: '2 ans après le dernier contact, sauf consentement pour un vivier.',
    }),
    t({
      nom: 'Gestion des clients et des commandes',
      finalite: 'Gestion de la relation client : contrats, commandes, livraisons, facturation et service après-vente.',
      baseLegale: 'contrat',
      categoriesPersonnes: ['Clients', 'Contacts clients'],
      categoriesDonnees: ['Identité', 'Coordonnées', 'Données de commande', 'Historique de facturation'],
      destinataires: ['Service commercial', 'Comptabilité', 'Logistique'],
      dureeConservation: 'Relation commerciale + 3 ans à des fins de prospection ; pièces comptables 10 ans.',
    }),
    t({
      nom: 'Prospection commerciale',
      finalite: 'Envoi de sollicitations commerciales et gestion des prospects.',
      baseLegale: 'interet_legitime',
      categoriesPersonnes: ['Prospects'],
      categoriesDonnees: ['Identité', 'Coordonnées', 'Centres d’intérêt'],
      destinataires: ['Service marketing', 'Service commercial'],
      dureeConservation: '3 ans à compter du dernier contact du prospect.',
    }),
    t({
      nom: 'Gestion des fournisseurs et sous-traitants',
      finalite: 'Gestion des achats, contrats et paiements des fournisseurs et prestataires.',
      baseLegale: 'contrat',
      categoriesPersonnes: ['Contacts fournisseurs'],
      categoriesDonnees: ['Identité', 'Coordonnées professionnelles', 'Coordonnées bancaires', 'Données contractuelles'],
      destinataires: ['Service achats', 'Comptabilité'],
      dureeConservation: 'Durée de la relation + 10 ans (obligations comptables).',
    }),
    t({
      nom: 'Comptabilité et gestion financière',
      finalite: 'Tenue de la comptabilité, établissement des états financiers et pièces justificatives.',
      baseLegale: 'obligation_legale',
      categoriesPersonnes: ['Clients', 'Fournisseurs', 'Salariés'],
      categoriesDonnees: ['Identité', 'Données de facturation', 'Coordonnées bancaires'],
      destinataires: ['Comptabilité', 'Commissaire aux comptes', 'Administration fiscale'],
      dureeConservation: '10 ans (livres et pièces comptables).',
    }),
    t({
      nom: 'Contrôle d’accès aux locaux',
      finalite: 'Gestion des badges et contrôle des accès physiques aux locaux.',
      baseLegale: 'interet_legitime',
      categoriesPersonnes: ['Salariés', 'Visiteurs', 'Prestataires'],
      categoriesDonnees: ['Identité', 'Horodatage des accès', 'Numéro de badge'],
      destinataires: ['Sécurité / services généraux'],
      dureeConservation: 'Logs d’accès : 3 mois ; habilitations : durée de présence.',
    }),
    t({
      nom: 'Vidéosurveillance',
      finalite: 'Sécurité des biens et des personnes par vidéoprotection des locaux.',
      baseLegale: 'interet_legitime',
      categoriesPersonnes: ['Salariés', 'Visiteurs', 'Public'],
      categoriesDonnees: ['Images'],
      destinataires: ['Personnes habilitées à la sécurité', 'Forces de l’ordre sur réquisition'],
      dureeConservation: '30 jours maximum.',
      surveillanceSystematique: true,
    }),
    t({
      nom: 'Gestion des accès informatiques et journalisation',
      finalite: 'Gestion des comptes et habilitations informatiques et journalisation à des fins de sécurité.',
      baseLegale: 'interet_legitime',
      categoriesPersonnes: ['Salariés', 'Prestataires'],
      categoriesDonnees: ['Identité', 'Identifiants', 'Journaux de connexion et d’activité'],
      destinataires: ['DSI', 'RSSI'],
      dureeConservation: 'Journaux : 6 mois à 1 an ; comptes : durée de présence.',
    }),
    t({
      nom: 'Annuaire interne et messagerie',
      finalite: 'Mise à disposition d’un annuaire du personnel et gestion de la messagerie professionnelle.',
      baseLegale: 'interet_legitime',
      categoriesPersonnes: ['Salariés'],
      categoriesDonnees: ['Identité', 'Coordonnées professionnelles', 'Fonction', 'Service'],
      destinataires: ['Personnel', 'DSI'],
      dureeConservation: 'Durée de présence dans l’organisation.',
    }),
    // Placeholder « métier » volontairement incomplet → mis en avant « à compléter ».
    {
      nom: ROPA_PLACEHOLDER_NOM,
      finalite: 'À compléter : décrire un traitement spécifique à votre activité (ex. gestion d’un service métier propre).',
      baseLegale: '',
      categoriesPersonnes: [],
      categoriesDonnees: [],
      destinataires: [],
      transfertHorsUE: false,
      dureeConservation: '',
      mesuresSecurite: [],
      grandeEchelle: false,
      surveillanceSystematique: false,
    },
  ]
}
