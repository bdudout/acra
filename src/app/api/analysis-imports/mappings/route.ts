import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { canCreateAnalyse, type UserRole } from '@/lib/permissions'
import { getAnalyseScope } from '@/lib/org-context.server'
import { prisma } from '@/lib/prisma'

const schema = z.object({ name: z.string().trim().min(1).max(100), mappings: z.record(z.string(), z.record(z.string(), z.string().optional())) })
async function context() {
  const session = await getServerSession(authOptions); if (!session?.user) return null
  const userId = (session.user as { id: string }).id; const role = ((session.user as { role?: UserRole }).role ?? 'LECTEUR') as UserRole
  const scope = await getAnalyseScope(userId, role)
  return scope.activeOrgId && canCreateAnalyse({ id: userId, role: scope.role }) ? { userId, organizationId: scope.activeOrgId } : null
}
export async function GET() { const ctx = await context(); if (!ctx) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 }); return NextResponse.json({ mappings: await prisma.analysisImportMapping.findMany({ where: { organizationId: ctx.organizationId }, select: { id: true, name: true, mappings: true, updatedAt: true }, orderBy: { name: 'asc' } }) }) }
export async function POST(req: NextRequest) { const ctx = await context(); if (!ctx) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 }); try { const data = schema.parse(await req.json()); const mapping = await prisma.analysisImportMapping.upsert({ where: { organizationId_name: { organizationId: ctx.organizationId, name: data.name } }, create: { organizationId: ctx.organizationId, name: data.name, mappings: data.mappings, createdById: ctx.userId }, update: { mappings: data.mappings, createdById: ctx.userId }, select: { id: true, name: true, mappings: true, updatedAt: true } }); return NextResponse.json({ mapping }, { status: 201 }) } catch { return NextResponse.json({ error: 'mapping_invalide' }, { status: 400 }) } }
