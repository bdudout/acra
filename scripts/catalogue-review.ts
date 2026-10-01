// Régénère la grille de revue métier du catalogue de suggestions (cf. src/lib/catalogue-review.ts).
// Usage : npm run catalogue:review [-- <fichier>]   (défaut : docs/specs/catalogue-revue-grille.csv)
import { writeFileSync } from 'node:fs'
import { catalogueReviewCsv, buildCatalogueReviewRows } from '../src/lib/catalogue-review'

const out = process.argv[2] ?? 'docs/specs/catalogue-revue-grille.csv'
writeFileSync(out, catalogueReviewCsv())
console.log(`${buildCatalogueReviewRows().length} éléments → ${out}`)
