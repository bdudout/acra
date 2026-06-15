/**
 * POST /api/admin/users/bulk — Création d'utilisateurs en masse depuis un CSV
 * (format nom,prenom,email,role ; rôle par défaut ANALYSTE). ADMIN uniquement.
 *
 * Chaque compte créé reçoit un mot de passe temporaire conforme à la politique,
 * à changer à la première connexion. Les mots de passe sont renvoyés UNE fois
 * pour communication par l'administrateur. Les lignes invalides ou déjà
 * existantes sont ignorées et rapportées.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canAdmin } from '@/lib/permissions'
import { UserRole as PrismaUserRole } from '@prisma/client'
import { auditLog, getClientIp } from '@/lib/logger'
import bcrypt from 'bcryptjs'
import { generateCompliantPassword, DEFAULT_POLICY, type PasswordPolicyShape } from '@/lib/password-policy'
import { parseUsersCsv } from '@/lib/users-csv'

const MAX_ROWS = 500

async function loadPasswordPolicy(): Promise<PasswordPolicyShape> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = await (prisma as any).passwordPolicy.findUnique({ where: { id: 'global' } })
    if (p) return {
      minLength: p.minLength, requireUppercase: p.requireUppercase, requireLowercase: p.requireLowercase,
      requireNumbers: p.requireNumbers, requireSpecial: p.requireSpecial, maxAgeDays: p.maxAgeDays,
    }
  } catch { /* table absente */ }
  return DEFAULT_POLICY
}

interface RowResult {
  line: number
  email: string
  name: string
  role: string
  status: 'created' | 'exists' | 'invalid'
  tempPassword?: string
  reason?: string
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const currentUserId = (session.user as any).id
  const userRole = (session.user as any).role ?? 'ANALYSTE'
  if (!canAdmin({ id: currentUserId, role: userRole })) {
    return NextResponse.json({ error: 'Accès réservé aux administrateurs' }, { status: 403 })
  }

  let body: { csv?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Corps invalide' }, { status: 400 }) }
  if (typeof body.csv !== 'string' || !body.csv.trim()) {
    return NextResponse.json({ error: 'CSV manquant' }, { status: 400 })
  }

  const rows = parseUsersCsv(body.csv)
  if (rows.length === 0) return NextResponse.json({ error: 'Aucune ligne exploitable' }, { status: 400 })
  if (rows.length > MAX_ROWS) {
    return NextResponse.json({ error: `Trop de lignes (max ${MAX_ROWS})` }, { status: 400 })
  }

  const policy = await loadPasswordPolicy()
  const results: RowResult[] = []

  for (const row of rows) {
    if (!row.valid) {
      results.push({ line: row.line, email: row.email, name: row.name, role: row.role, status: 'invalid', reason: row.error })
      continue
    }
    const existing = await prisma.user.findUnique({ where: { email: row.email }, select: { id: true } })
    if (existing) {
      results.push({ line: row.line, email: row.email, name: row.name, role: row.role, status: 'exists' })
      continue
    }
    const tempPassword = generateCompliantPassword(policy)
    const passwordHash = await bcrypt.hash(tempPassword, 12)
    const user = await prisma.user.create({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: {
        name: row.name || row.email,
        email: row.email,
        passwordHash,
        role: row.role as PrismaUserRole,
        mustChangePassword: true,
      } as any,
      select: { id: true },
    })
    results.push({ line: row.line, email: row.email, name: row.name, role: row.role, status: 'created', tempPassword })
    await auditLog('USER_CREATED', {
      userId: currentUserId, userRole, targetId: user.id, targetType: 'user',
      ip: getClientIp(req), details: { targetEmail: row.email, role: row.role, source: 'bulk_csv' },
    })
  }

  const summary = {
    total: results.length,
    created: results.filter(r => r.status === 'created').length,
    exists: results.filter(r => r.status === 'exists').length,
    invalid: results.filter(r => r.status === 'invalid').length,
  }

  await auditLog('USERS_BULK_IMPORTED', {
    userId: currentUserId, userRole, ip: getClientIp(req), details: summary,
  })

  return NextResponse.json({ summary, results })
}
