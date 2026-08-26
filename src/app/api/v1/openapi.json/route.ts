import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/v1/openapi.json — spécification OpenAPI de l'API publique v1 (lecture).
// Publique (documentation) ; les endpoints eux-mêmes exigent une clé d'API Bearer.
export async function GET() {
  const listResponse = (itemsRef: string) => ({
    '200': {
      description: 'Liste',
      content: { 'application/json': { schema: {
        type: 'object',
        properties: { data: { type: 'array', items: { $ref: itemsRef } }, count: { type: 'integer' } },
      } } },
    },
    '401': { description: 'Clé d\'API absente, invalide, révoquée ou expirée' },
    '403': { description: 'Scope insuffisant' },
  })
  const spec = {
    openapi: '3.0.3',
    info: {
      title: 'ACRA — API publique',
      version: '1.0.0',
      description: 'Accès machine en lecture au dispositif de maîtrise des risques (registre, contrôle permanent, incidents), porté par une clé d\'API à portée d\'organisation.',
    },
    servers: [{ url: '/api/v1' }],
    security: [{ apiKey: [] }],
    components: {
      securitySchemes: {
        apiKey: { type: 'http', scheme: 'bearer', bearerFormat: 'acra_<prefix>_<secret>', description: 'En-tête Authorization: Bearer acra_…' },
      },
      schemas: {
        Risk: { type: 'object', properties: {
          id: { type: 'string' }, intitule: { type: 'string' }, categorie: { type: 'string', nullable: true },
          proprietaire: { type: 'string', nullable: true }, statut: { type: 'string' },
          niveauInherent: { type: 'integer', nullable: true }, niveauResiduel: { type: 'integer', nullable: true },
        } },
        Control: { type: 'object', properties: {
          id: { type: 'string' }, intitule: { type: 'string' }, niveau: { type: 'string' },
          periodicite: { type: 'string' }, responsable: { type: 'string', nullable: true }, actif: { type: 'boolean' },
          prochaineEcheance: { type: 'string', format: 'date-time' }, etatEcheance: { type: 'string', nullable: true },
          tauxConformite: { type: 'integer', nullable: true }, efficacite: { type: 'string', nullable: true },
        } },
        Incident: { type: 'object', properties: {
          id: { type: 'string' }, intitule: { type: 'string' }, statut: { type: 'string' },
          categorie: { type: 'string', nullable: true }, entite: { type: 'string', nullable: true },
          montantBrut: { type: 'number', nullable: true }, perteNette: { type: 'number', nullable: true },
        } },
      },
    },
    paths: {
      '/risks': { get: { summary: 'Registre de risques', operationId: 'listRisks', responses: listResponse('#/components/schemas/Risk') } },
      '/controls': { get: { summary: 'Bibliothèque de contrôles', operationId: 'listControls', responses: listResponse('#/components/schemas/Control') } },
      '/incidents': { get: { summary: 'Incidents & pertes (LDC)', operationId: 'listIncidents', responses: listResponse('#/components/schemas/Incident') } },
      '/import': {
        post: {
          summary: 'Import en masse (risques, contrôles)',
          operationId: 'bulkImport',
          description: 'Nécessite le scope write. Corps { risks?: [...], controls?: [...] }. Chaque item est validé ; les invalides sont remontés par index (l\'import continue). Plafond de 500 items par ressource.',
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    risks: { type: 'array', items: { type: 'object' } },
                    controls: { type: 'array', items: { type: 'object' } },
                  },
                },
              },
            },
          },
          responses: {
            '201': { description: 'Import traité', content: { 'application/json': { schema: { type: 'object', properties: { created: { type: 'object' }, skipped: { type: 'object' }, errors: { type: 'array', items: { type: 'object', properties: { resource: { type: 'string' }, index: { type: 'integer' }, error: { type: 'string' } } } } } } } } },
            '400': { description: 'Aucun item créé (erreurs de validation ou module inactif)' },
            '401': { description: 'Authentification requise' },
            '403': { description: 'Scope write requis' },
          },
        },
      },
    },
  }
  return NextResponse.json(spec)
}
