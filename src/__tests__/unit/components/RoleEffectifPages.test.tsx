// Recette n° 37 (A01/CWE-863) : les droits d'action calculés par les pages doivent reposer sur le
// rôle EFFECTIF dans l'organisation, comme les API (`withAccess`, `loadIncidentInScope`) —
// sinon bouton affiché puis 403, ou absent alors que l'API l'autorise.
import { readFileSync } from 'node:fs'
import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const ctx = vi.hoisted(() => ({ instance: 'ANALYSTE', effectif: 'RISK_MANAGER', secondeLigneActive: true, props: null as null | Record<string, unknown> }))
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => ({ user: { id: 'u1', role: ctx.instance } })) }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('next/navigation', () => ({ redirect: vi.fn(() => { throw new Error('redirect') }) }))
vi.mock('@/components/Navbar', () => ({ default: () => null }))
vi.mock('@/lib/org-context.server', () => ({ getAnalyseScope: vi.fn(async () => ({ activeOrgId: 'o1', role: ctx.effectif, scope: {} })) }))
vi.mock('@/lib/org-config.server', () => ({ getOrgConfig: vi.fn(async () => ({ incidentsActive: true, secondeLigneActive: ctx.secondeLigneActive, reglementaireActive: false })) }))
vi.mock('@/components/IncidentsManager', () => ({ default: (p: Record<string, unknown>) => { ctx.props = p; return null } }))

import IncidentsPage from '@/app/incidents/page'

const canQualify = async () => { ctx.props = null; render(await IncidentsPage()); return ctx.props!.canQualify }

describe('/incidents — canQualify sur le rôle effectif dans l’organisation active (n° 37)', () => {
  beforeEach(() => { ctx.secondeLigneActive = true })
  it('ANALYSTE d’instance, RISK_MANAGER dans l’organisation → peut qualifier', async () => {
    ctx.instance = 'ANALYSTE'; ctx.effectif = 'RISK_MANAGER'
    expect(await canQualify()).toBe(true)
  })
  it('RISK_MANAGER d’instance, LECTEUR dans l’organisation → ne peut pas qualifier', async () => {
    ctx.instance = 'RISK_MANAGER'; ctx.effectif = 'LECTEUR'
    expect(await canQualify()).toBe(false)
  })
  it('ligne unique : LECTEUR dans l’organisation exclu même si ADMIN d’instance', async () => {
    ctx.secondeLigneActive = false; ctx.instance = 'ADMIN'; ctx.effectif = 'LECTEUR'
    expect(await canQualify()).toBe(false)
  })
})

describe('acceptation des risques résiduels — rôle du workflow, pas le rôle d’instance (n° 37)', () => {
  for (const f of ['src/app/analyses/[id]/page.tsx', 'src/lib/projet-vue.server.ts']) {
    it(f, () => {
      const src = readFileSync(f, 'utf8')
      expect(src).not.toMatch(/canAcceptResidualRisks\(sessionUser/)
      expect(src).toMatch(/canAcceptResidualRisks\(userWorkflow,/)
    })
  }
})
