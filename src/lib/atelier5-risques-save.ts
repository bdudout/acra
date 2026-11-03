// ─── Sauvegarde des risques de l'atelier 5 : ids stables ───
/**
 * Issue #279 : la sauvegarde de l'atelier 5 supprimait puis recréait tous les risques
 * sans leur id → chaque sauvegarde générait de nouveaux ids et rendait orphelins les
 * `Mesure.risqueId`, les dérogations (SetNull) et les liens de plan d'action.
 *
 * Désormais : un risque déjà présent dans l'analyse est MIS À JOUR (id conservé), un
 * nouveau risque est créé avec l'id client (stable entre deux autosaves) ; seul un id
 * absent, invalide, dupliqué ou appartenant à une AUTRE analyse est régénéré, et les
 * mesures suivent ce remappage.
 */

const ID_VALIDE = /^[A-Za-z0-9_-]{1,64}$/

export interface RisqueIdsConnus {
  /** Ids des risques de CETTE analyse. */
  owned: ReadonlySet<string>
  /** Ids présents dans le payload mais appartenant à une autre analyse. */
  foreign: ReadonlySet<string>
}

export interface PlanRisquesA5<D> {
  toUpdate: { id: string; data: D }[]
  toCreate: (D & { id: string })[]
  /** id client → id régénéré. */
  idMap: Map<string, string>
  /** Ids finaux des risques après sauvegarde (les autres risques de l'analyse sont supprimés). */
  keptIds: string[]
}

/** Retire les champs que le client ne doit pas écrire (relation, dates, libellés UI). */
function champsPersistables(r: Record<string, unknown>) {
  const {
    id: _id, analyseId: _aid, analyse: _rel,
    createdAt: _ca, updatedAt: _ua, scenarioOpNom: _son,
    ...rest
  } = r
  return rest
}

export function planRisquesA5<R extends Record<string, unknown>>(
  risques: R[],
  connus: RisqueIdsConnus,
  newId: () => string,
): PlanRisquesA5<Record<string, unknown>> {
  const plan: PlanRisquesA5<Record<string, unknown>> = { toUpdate: [], toCreate: [], idMap: new Map(), keptIds: [] }
  const vus = new Set<string>()
  for (const r of risques) {
    const data = champsPersistables(r)
    const brut = typeof r.id === 'string' ? r.id : ''
    const reutilisable = ID_VALIDE.test(brut) && !vus.has(brut) && !connus.foreign.has(brut)
    const id = reutilisable ? brut : newId()
    if (!reutilisable && brut && !plan.idMap.has(brut) && !vus.has(brut)) plan.idMap.set(brut, id)
    vus.add(id)
    if (brut) vus.add(brut)
    plan.keptIds.push(id)
    if (reutilisable && connus.owned.has(id)) plan.toUpdate.push({ id, data })
    else plan.toCreate.push({ ...data, id })
  }
  return plan
}

/** risqueId d'une mesure après sauvegarde : suit le remappage, vide si le risque n'existe plus. */
export function remapRisqueIdMesure(
  risqueId: unknown,
  plan: Pick<PlanRisquesA5<unknown>, 'idMap' | 'keptIds'>,
): string | undefined {
  if (risqueId == null || risqueId === '') return undefined
  const id = plan.idMap.get(String(risqueId)) ?? String(risqueId)
  return plan.keptIds.includes(id) ? id : undefined
}
