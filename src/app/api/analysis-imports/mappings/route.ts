import { NextRequest, NextResponse } from 'next/server'
import { optionsStructure } from '@/lib/org-config.server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { HISTORIC_SHEET_TYPES } from '@/lib/historic-import'
import { authOptions } from '@/lib/auth'
import { canCreateAnalyse, type UserRole } from '@/lib/permissions'
import { getAnalyseScope, getEffectiveRoleForOrg } from '@/lib/org-context.server'
import { prisma } from '@/lib/prisma'

const sheetType = z.enum(HISTORIC_SHEET_TYPES)
const valueTransform = z.object({ mode: z.enum(['LINES', 'SEMICOLON', 'PIPE']).optional(), carryForward: z.boolean().optional() }).refine(value => Boolean(value.mode || value.carryForward))
const mappingRecord = z.record(z.string(), z.record(z.string(), z.string().optional()))
const scoreMappings = z.record(z.string(), z.record(z.string(), z.record(z.string(), z.enum(['1', '2', '3', '4']))))
const refAliasesSchema = z.record(z.string(), z.record(z.string().max(12), z.string().max(12)))
const schema = z.object({ name: z.string().trim().min(1).max(100), organizationId: z.string().trim().min(1).max(191).optional(), mappings: mappingRecord, sheetTypes: z.record(z.string(), sheetType).default({}), transforms: z.record(z.string(), z.record(z.string(), valueTransform.optional())).default({}), statusMappings: z.record(z.string(), z.record(z.string(), z.enum(['A_FAIRE', 'EN_COURS', 'REALISE', 'REPORTE']))).default({}), scoreMappings: scoreMappings.default({}), refAliases: refAliasesSchema.optional() })
type SavedMapping = { mappings: z.infer<typeof mappingRecord>; sheetTypes: Record<string, z.infer<typeof sheetType>>; transforms: Record<string, Record<string, { mode?: 'LINES' | 'SEMICOLON' | 'PIPE'; carryForward?: boolean } | undefined>>; statusMappings: Record<string, Record<string, 'A_FAIRE' | 'EN_COURS' | 'REALISE' | 'REPORTE'>>; scoreMappings: z.infer<typeof scoreMappings>; refAliases?: z.infer<typeof refAliasesSchema> }
function normalizeMapping(value: unknown): SavedMapping {
  const parsed = z.object({ version: z.literal(2), mappings: mappingRecord, sheetTypes: z.record(z.string(), sheetType).default({}), transforms: z.record(z.string(), z.record(z.string(), valueTransform.optional())).default({}), statusMappings: z.record(z.string(), z.record(z.string(), z.enum(['A_FAIRE', 'EN_COURS', 'REALISE', 'REPORTE']))).default({}), scoreMappings: scoreMappings.default({}), refAliases: refAliasesSchema.optional() }).safeParse(value)
  if (parsed.success) return parsed.data
  return { mappings: mappingRecord.parse(value), sheetTypes: {}, transforms: {}, statusMappings: {}, scoreMappings: {} }
}
async function context(targetOrganizationId?: string) {
  const session = await getServerSession(authOptions); if (!session?.user) return null
  const userId = (session.user as { id: string }).id; const role = ((session.user as { role?: UserRole }).role ?? 'LECTEUR') as UserRole
  const scope = await getAnalyseScope(userId, role)
  const organizationId = targetOrganizationId ?? scope.activeOrgId
  const effectiveRole = organizationId ? await getEffectiveRoleForOrg(userId, role, organizationId) : null
  return organizationId && effectiveRole && canCreateAnalyse({ id: userId, role: effectiveRole }, await optionsStructure(organizationId)) ? { userId, organizationId } : null
}
export async function GET(req: NextRequest) { const ctx = await context(req.nextUrl.searchParams.get('organizationId') ?? undefined); if (!ctx) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 }); const mappings = await prisma.analysisImportMapping.findMany({ where: { OR: [{ organizationId: ctx.organizationId }, { organizationId: null }] }, select: { id: true, name: true, organizationId: true, mappings: true, updatedAt: true }, orderBy: { name: 'asc' } }); return NextResponse.json({ mappings: mappings.map(({ organizationId, ...mapping }) => ({ ...mapping, builtin: organizationId === null, ...normalizeMapping(mapping.mappings) })) }) }
export async function POST(req: NextRequest) { try { const data = schema.parse(await req.json()); const ctx = await context(data.organizationId); if (!ctx) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 }); const stored = { version: 2 as const, mappings: data.mappings, sheetTypes: data.sheetTypes, transforms: data.transforms, statusMappings: data.statusMappings, scoreMappings: data.scoreMappings, ...(data.refAliases && Object.keys(data.refAliases).length ? { refAliases: data.refAliases } : {}) }; const mapping = await prisma.analysisImportMapping.upsert({ where: { organizationId_name: { organizationId: ctx.organizationId, name: data.name } }, create: { organizationId: ctx.organizationId, name: data.name, mappings: stored, createdById: ctx.userId }, update: { mappings: stored, createdById: ctx.userId }, select: { id: true, name: true, mappings: true, updatedAt: true } }); return NextResponse.json({ mapping: { ...mapping, ...normalizeMapping(mapping.mappings) } }, { status: 201 }) } catch { return NextResponse.json({ error: 'mapping_invalide' }, { status: 400 }) } }
