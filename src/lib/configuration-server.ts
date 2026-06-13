/**
 * configuration-server.ts — Récupération server-only de l'échelle commune.
 *
 * Isolé de `risk-scale.ts` (pur, importable côté client) car ce module dépend de
 * Prisma et ne doit jamais être embarqué dans un bundle client.
 *
 * L'échelle/seuils sont un singleton global (`Configuration` id="global") défini
 * par l'ADMIN et partagé par toutes les analyses. À défaut, valeurs par défaut.
 */

import { prisma } from '@/lib/prisma'
import { resolveScaleConfig, type ScaleConfig } from '@/lib/risk-scale'

export async function getEffectiveScaleConfig(): Promise<ScaleConfig> {
  const config = await prisma.configuration.findUnique({ where: { id: 'global' } })
  return resolveScaleConfig(config as unknown as Partial<ScaleConfig> | null)
}
