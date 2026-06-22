/**
 * users-csv.ts — Parsing d'un CSV de création d'utilisateurs en masse.
 * Format attendu : nom,prenom,email,role  (séparateur , ou ;)
 * - Ligne d'en-tête détectée et ignorée automatiquement.
 * - Rôle par défaut : ANALYSTE (si vide ou non reconnu).
 * - E-mail invalide ou en doublon (dans le fichier) → ligne marquée non valide.
 * Pur (aucun I/O) → testable et réutilisable client/serveur.
 */
import type { UserRole } from '@/lib/permissions'

export interface ParsedUserRow {
  line: number
  nom: string
  prenom: string
  email: string
  role: UserRole
  /** Nom complet combiné « Prénom Nom ». */
  name: string
  valid: boolean
  error?: 'email_invalid' | 'duplicate'
}

const VALID_ROLES: readonly string[] = ['LECTEUR', 'ANALYSTE', 'RISK_MANAGER', 'RSSI', 'ADMIN']
const ROLE_ALIASES: Record<string, UserRole> = {
  'lecteur': 'LECTEUR', 'reader': 'LECTEUR', 'viewer': 'LECTEUR', 'lecture seule': 'LECTEUR',
  'analyste': 'ANALYSTE', 'analyst': 'ANALYSTE',
  'risk manager': 'RISK_MANAGER', 'riskmanager': 'RISK_MANAGER', 'gestionnaire de risque': 'RISK_MANAGER',
  'rssi': 'RSSI', 'ciso': 'RSSI',
  'admin': 'ADMIN', 'administrateur': 'ADMIN', 'administrator': 'ADMIN',
}
// Regex linéaire (anti-ReDoS) : chaque classe exclut son délimiteur (@ et .) pour
// éviter tout retour-arrière polynomial (js/polynomial-redos). Domaine = labels
// séparés par des points, sans ambiguïté entre le quantificateur et le « . ».
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/
// Longueur maximale d'une adresse e-mail (RFC 5321) — garde-fou défensif amont.
const EMAIL_MAX_LEN = 254

function normalizeRole(raw: string): UserRole {
  const trimmed = raw.trim()
  if (!trimmed) return 'ANALYSTE'
  const up = trimmed.toUpperCase().replace(/[\s-]+/g, '_')
  if (VALID_ROLES.includes(up)) return up as UserRole
  const key = trimmed.toLowerCase().replace(/[\s_-]+/g, ' ')
  return ROLE_ALIASES[key] ?? 'ANALYSTE'
}

function isHeader(fields: string[]): boolean {
  const joined = fields.join(',').toLowerCase()
  return /\b(e-?mail|courriel)\b/.test(joined) && /\b(nom|name|pr[ée]nom|r[oô]le|role)\b/.test(joined)
}

function detectDelimiter(line: string): string {
  return line.split(';').length > line.split(',').length ? ';' : ','
}

export function parseUsersCsv(csv: string): ParsedUserRow[] {
  const lines = csv.replace(/^﻿/, '').split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (lines.length === 0) return []
  const delim = detectDelimiter(lines[0])
  const out: ParsedUserRow[] = []
  const seen = new Set<string>()

  lines.forEach((line, i) => {
    const fields = line.split(delim).map(f => f.trim())
    if (i === 0 && isHeader(fields)) return

    const [nom = '', prenom = '', emailRaw = '', roleRaw = ''] = fields
    const email = emailRaw.toLowerCase()
    const role = normalizeRole(roleRaw)
    const name = `${prenom} ${nom}`.trim()

    let valid = true
    let error: ParsedUserRow['error']
    if (email.length > EMAIL_MAX_LEN || !EMAIL_RE.test(email)) { valid = false; error = 'email_invalid' }
    else if (seen.has(email)) { valid = false; error = 'duplicate' }
    else seen.add(email)

    out.push({ line: i + 1, nom, prenom, email, role, name, valid, error })
  })

  return out
}
