# Notes de version

Un fichier par version : `docs/releases/vX.Y.Z.md`. Il est **obligatoire pour une
stable** : `release.yml` refuse de construire sans lui. Le workflow y ajoute
automatiquement la liste des commits depuis la version précédente et les
artefacts (image, manifeste, SBOM) ; la fiche de recette (`docs/RELEASE-CHECKLIST.md`)
est jointe en fichier `fiche-recette.md`, jamais comme corps de la release.

## Contenu attendu

```markdown
## ACRA vX.Y.Z — <titre court>

### <Thème 1 : ce qui change pour l'utilisateur>
- <fonctionnalité / correctif, formulé côté utilisateur, avec l'issue #n>

### Mettre à jour
<commandes si une action est requise (migration, variable, première mise à jour) ;
sinon « Aucune action particulière » — `scripts/update.sh stable` ou le bouton>

### Vérifications
- CI du commit exact : <tests (nombre), TypeScript, build + E2E, audit, CodeQL>
- <recette effectuée / non effectuée — ne jamais cocher ce qui n'a pas été fait>
```

Règles : français, orienté utilisateur (pas de nom de fichier interne sauf
commandes), terminologie réglementaire officielle avec version citée, migration de
base signalée explicitement, rien d'affirmé qui n'ait été vérifié.
