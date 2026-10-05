// ─── Légende des échelles : impacts par type et par niveau de gravité (PUR) ───
// Aide à coter sans connaître la méthode : pour chaque niveau de gravité, ce que cela représente en impact
// opérationnel, financier, juridique et d'image. Repère indicatif commun (les libellés et descriptions des niveaux
// restent ceux de l'échelle de l'organisation). Échelle à 4 niveaux ; le 5ᵉ ajoute un effet au-delà de l'organisation.
// Testé : echelle-legende.test.ts.

import type { Locale } from '@/lib/i18n'

type Tr = readonly [string, string, string, string, string]
const L = (fr: string, en: string, de: string, es: string, it: string): Tr => [fr, en, de, es, it]
const IDX: Record<Locale, number> = { fr: 0, en: 1, de: 2, es: 3, it: 4 }

export const IMPACT_TYPES = ['operationnel', 'financier', 'juridique', 'image'] as const
export type ImpactType = (typeof IMPACT_TYPES)[number]
type Ligne = Record<ImpactType, Tr>

const GRILLE: Ligne[] = [
  {
    operationnel: L('Gêne ponctuelle, sans interruption', 'Occasional inconvenience, no interruption', 'Gelegentliche Störung, keine Unterbrechung', 'Molestia puntual, sin interrupción', 'Disagio occasionale, senza interruzioni'),
    financier: L('Perte négligeable', 'Negligible loss', 'Vernachlässigbarer Verlust', 'Pérdida insignificante', 'Perdita trascurabile'),
    juridique: L('Aucune suite', 'No consequence', 'Keine Folgen', 'Sin consecuencias', 'Nessuna conseguenza'),
    image: L('Pas d’écho à l’extérieur', 'No external echo', 'Keine Außenwirkung', 'Sin eco externo', 'Nessuna eco all’esterno'),
  },
  {
    operationnel: L('Mode dégradé de courte durée', 'Short degraded operation', 'Kurzzeitiger Notbetrieb', 'Funcionamiento degradado breve', 'Funzionamento degradato di breve durata'),
    financier: L('Perte limitée, absorbée par le budget', 'Limited loss, absorbed by the budget', 'Begrenzter Verlust, im Budget aufgefangen', 'Pérdida limitada, absorbida por el presupuesto', 'Perdita limitata, assorbita dal budget'),
    juridique: L('Réclamation ou mise en demeure', 'Complaint or formal notice', 'Beschwerde oder Abmahnung', 'Reclamación o requerimiento', 'Reclamo o diffida'),
    image: L('Mécontentement de quelques clients ou partenaires', 'Some customers or partners dissatisfied', 'Unzufriedenheit einiger Kunden oder Partner', 'Descontento de algunos clientes o socios', 'Malcontento di alcuni clienti o partner'),
  },
  {
    operationnel: L('Interruption de plusieurs jours', 'Interruption of several days', 'Unterbrechung über mehrere Tage', 'Interrupción de varios días', 'Interruzione di più giorni'),
    financier: L('Perte significative, effet sur le résultat', 'Significant loss, impact on results', 'Erheblicher Verlust, Auswirkung auf das Ergebnis', 'Pérdida significativa, efecto en el resultado', 'Perdita significativa, effetto sul risultato'),
    juridique: L('Sanction ou contentieux probable', 'Likely sanction or litigation', 'Wahrscheinliche Sanktion oder Rechtsstreit', 'Sanción o litigio probable', 'Sanzione o contenzioso probabile'),
    image: L('Couverture médiatique locale ou sectorielle', 'Local or sector media coverage', 'Lokale oder branchenweite Berichterstattung', 'Cobertura mediática local o sectorial', 'Copertura mediatica locale o di settore'),
  },
  {
    operationnel: L('Arrêt durable d’activités essentielles', 'Lasting stoppage of essential activities', 'Dauerhafter Ausfall wesentlicher Tätigkeiten', 'Parada duradera de actividades esenciales', 'Arresto duraturo di attività essenziali'),
    financier: L('Perte majeure, survie financière menacée', 'Major loss, financial survival at stake', 'Schwerer Verlust, finanzielles Überleben gefährdet', 'Pérdida grave, supervivencia financiera amenazada', 'Perdita grave, sopravvivenza finanziaria a rischio'),
    juridique: L('Sanctions lourdes, responsabilité des dirigeants', 'Heavy sanctions, management liability', 'Hohe Sanktionen, Haftung der Geschäftsleitung', 'Sanciones graves, responsabilidad de los directivos', 'Sanzioni pesanti, responsabilità dei dirigenti'),
    image: L('Atteinte durable à la réputation, médias nationaux', 'Lasting reputational damage, national media', 'Dauerhafter Reputationsschaden, landesweite Medien', 'Daño duradero a la reputación, medios nacionales', 'Danno duraturo alla reputazione, media nazionali'),
  },
  {
    operationnel: L('Effets au-delà de l’organisation (secteur, population)', 'Effects beyond the organisation (sector, population)', 'Auswirkungen über die Organisation hinaus (Branche, Bevölkerung)', 'Efectos más allá de la organización (sector, población)', 'Effetti oltre l’organizzazione (settore, popolazione)'),
    financier: L('Pertes en chaîne pour d’autres organisations', 'Knock-on losses for other organisations', 'Kettenverluste für andere Organisationen', 'Pérdidas en cadena para otras organizaciones', 'Perdite a catena per altre organizzazioni'),
    juridique: L('Mise en cause par les autorités au plus haut niveau', 'Called to account by the highest authorities', 'Zur Verantwortung gezogen durch höchste Behörden', 'Cuestionamiento por las autoridades al más alto nivel', 'Chiamata in causa dalle autorità al massimo livello'),
    image: L('Crise de confiance publique', 'Public crisis of confidence', 'Öffentliche Vertrauenskrise', 'Crisis de confianza pública', 'Crisi di fiducia pubblica'),
  },
]

/** Impacts indicatifs pour chaque niveau d'une échelle de gravité à 4 ou 5 niveaux, dans la langue. */
export function impactsGravite(nbNiveaux: number, locale: Locale): Record<ImpactType, string>[] {
  const i = IDX[locale] ?? 0
  return GRILLE.slice(0, nbNiveaux >= 5 ? 5 : 4).map(l => Object.fromEntries(IMPACT_TYPES.map(k => [k, l[k][i]])) as Record<ImpactType, string>)
}
