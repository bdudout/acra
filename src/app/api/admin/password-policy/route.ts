import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { auditLog, getClientIp } from '@/lib/logger'
import { redactSecrets } from '@/lib/audit-redact'
import { encryptSecret, decryptSecret } from '@/lib/secret-crypto'

/** Déchiffre les secrets SMS d'une policy pour l'affichage admin (stockage chiffré au repos). */
function decryptPolicySecrets<T extends { smsApiKey?: unknown; smsApiSecret?: unknown }>(policy: T): T {
  return {
    ...policy,
    smsApiKey:    decryptSecret(policy.smsApiKey as string | null | undefined),
    smsApiSecret: decryptSecret(policy.smsApiSecret as string | null | undefined),
  }
}

const PolicySchema = z.object({
  minLength:                z.number().int().min(8).max(128),
  requireUppercase:         z.boolean(),
  requireLowercase:         z.boolean(),
  requireNumbers:           z.boolean(),
  requireSpecial:           z.boolean(),
  maxAgeDays:               z.number().int().min(0).max(3650),
  maxFailedAttempts:        z.number().int().min(0).max(100).default(5),
  lockoutDurationMinutes:   z.number().int().min(1).max(1440).default(15),
  requireEmailVerification: z.boolean().default(false),
  inactivityDaysLimit:      z.number().int().min(0).max(3650).default(180),
  // MFA
  mfaEnabled:     z.boolean().default(false),
  mfaMethodEmail: z.boolean().default(true),
  mfaMethodSms:   z.boolean().default(false),
  mfaScope:       z.enum(['ALL', 'ADMIN_ONLY']).default('ALL'),
  smsProvider:    z.enum(['TWILIO', 'OVH', 'CUSTOM']).default('TWILIO'),
  // [F005b corrigé] CWE-312 / CWE-532 — Secrets SMS
  // ✅ Plus journalisés en clair (redactSecrets dans le PUT).
  // ✅ Chiffrés au repos : encryptSecret au PUT (smsEnc), decryptPolicySecrets à la lecture.
  smsApiKey:      z.string().max(256).nullable().optional(),
  smsApiSecret:   z.string().max(256).nullable().optional(),
  smsSenderId:    z.string().max(64).nullable().optional(),
})

/** Fenêtre de confirmation MFA : 60 minutes */
const MFA_CONFIRMATION_WINDOW_MS = 60 * 60 * 1000

async function requireAdmin(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { error: NextResponse.json({ error: 'Non autorisé' }, { status: 401 }), session: null }
  // Politique de mot de passe = réglage d'INSTANCE → SUPER_ADMIN uniquement.
  if ((session.user as any).role !== 'SUPER_ADMIN') {
    return { error: NextResponse.json({ error: 'Réservé au super-administrateur' }, { status: 403 }), session: null }
  }
  return { error: null, session }
}

/**
 * Vérifie si la fenêtre de confirmation MFA a expiré.
 * Si oui, désactive automatiquement le MFA (vérification paresseuse).
 * Retourne la policy à jour.
 */
async function autoRevertMfaIfExpired(policy: any): Promise<any> {
  if (
    policy.mfaPendingConfirmation &&
    policy.mfaConfirmationDeadline &&
    new Date() > new Date(policy.mfaConfirmationDeadline)
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reverted = await (prisma as any).passwordPolicy.update({
      where: { id: 'global' },
      data: {
        mfaEnabled:              false,
        mfaPendingConfirmation:  false,
        mfaConfirmationDeadline: null,
      },
    })
    await auditLog('MFA_AUTO_DISABLED', {
      details: { reason: 'confirmation_timeout', deadline: policy.mfaConfirmationDeadline },
    })
    return reverted
  }
  return policy
}

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin(req)
  if (error) return error

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let policy = await (prisma as any).passwordPolicy.upsert({
    where:  { id: 'global' },
    // Politique par défaut ANSSI guide d'hygiène v2 — 12 car., complexité complète, 90j, 5 tentatives
    create: {
      id: 'global',
      minLength: 12, requireUppercase: true, requireLowercase: true, requireNumbers: true, requireSpecial: true,
      maxAgeDays: 90, maxFailedAttempts: 5, requireEmailVerification: false,
      mfaEnabled: false, mfaMethodEmail: true, mfaMethodSms: false, mfaScope: 'ALL', smsProvider: 'TWILIO',
      mfaPendingConfirmation: false, mfaConfirmationDeadline: null,
    },
    update: {},
  })

  // Vérification paresseuse : auto-désactivation si la fenêtre a expiré
  policy = await autoRevertMfaIfExpired(policy)

  // [F005] Déchiffrement des secrets SMS pour l'UI admin (stockés chiffrés au repos)
  return NextResponse.json(decryptPolicySecrets(policy))
}

export async function PUT(req: NextRequest) {
  const { error, session } = await requireAdmin(req)
  if (error) return error

  const userId   = (session!.user as any).id
  const userRole = (session!.user as any).role ?? 'ADMIN'

  const body = await req.json()
  const parsed = PolicySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 })
  }

  // Lire la politique actuelle pour détecter le changement d'état du MFA
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const current = await (prisma as any).passwordPolicy.findUnique({ where: { id: 'global' } })
  const mfaJustEnabled = parsed.data.mfaEnabled && !(current?.mfaEnabled ?? false)
  const mfaDisabled    = !parsed.data.mfaEnabled

  // Calcul des champs de confirmation
  let confirmationFields: Record<string, unknown> = {}
  if (mfaJustEnabled) {
    // Ouverture de la fenêtre de 60 min
    confirmationFields = {
      mfaPendingConfirmation:  true,
      mfaConfirmationDeadline: new Date(Date.now() + MFA_CONFIRMATION_WINDOW_MS),
    }
  } else if (mfaDisabled) {
    // MFA désactivé — on efface la fenêtre
    confirmationFields = {
      mfaPendingConfirmation:  false,
      mfaConfirmationDeadline: null,
    }
  }

  // [F005 corrigé] Chiffrement au repos des secrets SMS (AES-256-GCM) avant persistance.
  const smsEnc = {
    smsApiKey:    encryptSecret(parsed.data.smsApiKey),
    smsApiSecret: encryptSecret(parsed.data.smsApiSecret),
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const policy = await (prisma as any).passwordPolicy.upsert({
    where:  { id: 'global' },
    create: { id: 'global', ...parsed.data, ...confirmationFields, ...smsEnc },
    update: { ...parsed.data, ...confirmationFields, ...smsEnc },
  })

  // [F005b corrigé] On masque les secrets SMS avant journalisation (CWE-532) —
  // même garantie que le pattern auditData de sso-config/route.ts.
  const auditDetails = redactSecrets(
    { ...parsed.data, ...(mfaJustEnabled ? { mfaConfirmationWindow: '60min' } : {}) },
    ['smsApiKey', 'smsApiSecret']
  )
  await auditLog('PASSWORD_POLICY_UPDATED', {
    userId, userRole, ip: getClientIp(req),
    details: auditDetails,
  })

  // Renvoie les secrets en clair à l'UI (le stockage reste chiffré)
  return NextResponse.json(decryptPolicySecrets(policy))
}
