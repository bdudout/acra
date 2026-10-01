// Lecture de prisma/schema.prisma pour les tests de schéma : depuis Prisma 7, le DMMF exposé à
// l'exécution (Prisma.dmmf) ne dit plus si un champ est obligatoire (isRequired disparu).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const schema = readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf8')

function blocModele(model: string): string | undefined {
  return schema.match(new RegExp(`^model ${model} \\{([\\s\\S]*?)^\\}`, 'm'))?.[1]
}

/** Type déclaré d'un champ (ex. « String? »), ou undefined si le modèle ou le champ n'existe pas. */
export function typeChamp(model: string, champ: string): string | undefined {
  return blocModele(model)?.match(new RegExp(`^\\s*${champ}\\s+(\\S+)`, 'm'))?.[1]
}

/** true si le champ est facultatif (type suffixé par « ? »), false s'il est obligatoire. */
export function estFacultatif(model: string, champ: string): boolean | undefined {
  const type = typeChamp(model, champ)
  return type === undefined ? undefined : type.endsWith('?')
}

/** true si une contrainte @@unique du modèle porte (au moins) sur tous ces champs. */
export function aUnique(model: string, champs: string[]): boolean {
  const groupes = [...(blocModele(model) ?? '').matchAll(/@@unique\(\[([^\]]*)\]/g)].map(m => m[1].split(',').map(c => c.trim()))
  return groupes.some(g => champs.every(c => g.includes(c)))
}
