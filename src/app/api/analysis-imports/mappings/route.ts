import { NextResponse } from 'next/server'
import { optionsStructure } from '@/lib/org-config.server'
import { z } from 'zod'
import { HISTORIC_SHEET_TYPES } from '@/lib/historic-import'
import { canCreateAnalyse } from '@/lib/permissions'
import { type SessionUser } from '@/lib/route-guard.server'
import { withAccess } from '@/lib/with-access.server'
import { getAnalyseScope, getEffectiveRoleForOrg } from '@/lib/org-context.server'
import { normaliserMappingEnregistre } from '@/lib/import-v2-profil'
import { prisma } from '@/lib/prisma'

const sheetType = z.enum(HISTORIC_SHEET_TYPES)
const valueTransform = z.object({ mode: z.enum(['LINES', 'SEMICOLON', 'PIPE']).optional(), carryForward: z.boolean().optional() }).refine(value => Boolean(value.mode || value.carryForward))
const mappingRecord = z.record(z.string(), z.record(z.string(), z.string().optional()))
const scoreMappings = z.record(z.string(), z.record(z.string(), z.record(z.string(), z.enum(['1', '2', '3', '4']))))
const refAliasesSchema = z.record(z.string(), z.record(z.string().max(12), z.string().max(12)))
const schema = z.object({ name: z.string().trim().min(1).max(100), organizationId: z.string().trim().min(1).max(191).optional(), mappings: mappingRecord, sheetTypes: z.record(z.string(), sheetType).default({}), transforms: z.record(z.string(), z.record(z.string(), valueTransform.optional())).default({}), statusMappings: z.record(z.string(), z.record(z.string(), z.enum(['A_FAIRE', 'EN_COURS', 'REALISE', 'REPORTE']))).default({}), scoreMappings: scoreMappings.default({}), refAliases: refAliasesSchema.optional() })
// Organisation cible : celle du corps/de la requête, sinon l'organisation active ; droit de création
// d'analyse évalué sur le rôle EFFECTIF dans cette organisation (d'où `org: 'none'`).
async function context(user: SessionUser, targetOrganizationId?: string) {
  const userId = user.id; const role = user.role
  const scope = await getAnalyseScope(userId, role)
  const organizationId = targetOrganizationId ?? scope.activeOrgId
  const effectiveRole = organizationId ? await getEffectiveRoleForOrg(userId, role, organizationId) : null
  return organizationId && effectiveRole && canCreateAnalyse({ id: userId, role: effectiveRole }, await optionsStructure(organizationId)) ? { userId, organizationId } : null
}
export const GET = withAccess({ org: 'none' }, async (req, { user }) => { const ctx = await context(user, req.nextUrl.searchParams.get('organizationId') ?? undefined); if (!ctx) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 }); const mappings = await prisma.analysisImportMapping.findMany({ where: { OR: [{ organizationId: ctx.organizationId }, { organizationId: null }] }, select: { id: true, name: true, organizationId: true, mappings: true, updatedAt: true }, orderBy: { name: 'asc' } }); return NextResponse.json({ mappings: mappings.map(({ organizationId, ...mapping }) => ({ ...mapping, builtin: organizationId === null, ...normaliserMappingEnregistre(mapping.mappings) })) }) })
export const POST = withAccess({ org: 'none', rateLimit: { bucket: 'analysis-import-mappings' } }, async (req, { user }) => { try { const data = schema.parse(await req.json()); const ctx = await context(user, data.organizationId); if (!ctx) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 }); const stored = { version: 2 as const, mappings: data.mappings, sheetTypes: data.sheetTypes, transforms: data.transforms, statusMappings: data.statusMappings, scoreMappings: data.scoreMappings, ...(data.refAliases && Object.keys(data.refAliases).length ? { refAliases: data.refAliases } : {}) }; const mapping = await prisma.analysisImportMapping.upsert({ where: { organizationId_name: { organizationId: ctx.organizationId, name: data.name } }, create: { organizationId: ctx.organizationId, name: data.name, mappings: stored, createdById: ctx.userId }, update: { mappings: stored, createdById: ctx.userId }, select: { id: true, name: true, mappings: true, updatedAt: true } }); return NextResponse.json({ mapping: { ...mapping, ...normaliserMappingEnregistre(mapping.mappings) } }, { status: 201 }) } catch { return NextResponse.json({ error: 'mapping_invalide' }, { status: 400 }) } })
