// Types partagés de l'interface des questionnaires (forme des réponses d'API).
import type { Question, Reponse } from '@/lib/questionnaire'
import type { Preuve } from '@/lib/preuves'
export type { Question, Reponse, Preuve }

export type ReponseRow = {
  id: string; statut: 'A_REPONDRE' | 'SOUMISE' | 'A_COMPLETER' | 'REVUE'; repondantId: string; repondant?: string
  reponses: Reponse[]; soumiseLe: string | null; revueLe: string | null
}

/** Lit des fichiers en data URL (même stockage que les preuves d'exécution de contrôle). */
export function lirePreuves(files: FileList | null, max: number): Promise<Preuve[]> {
  if (!files) return Promise.resolve([])
  return Promise.all(Array.from(files).slice(0, max).map(f => new Promise<Preuve>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve({ nom: f.name, mime: f.type, taille: f.size, dataUrl: String(reader.result) })
    reader.onerror = reject
    reader.readAsDataURL(f)
  })))
}
