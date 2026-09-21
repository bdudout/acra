# SBOM — Nomenclature logicielle (Software Bill of Materials)

ACRA produit un **SBOM à chaque release** (workflow `.github/workflows/release.yml`).
Objectif : inventaire vérifiable des composants livrés, pour la gestion des
vulnérabilités et la traçabilité de la chaîne d'approvisionnement, en cohérence
avec les bonnes pratiques ANSSI (maîtrise de la chaîne logicielle) et en
anticipation des obligations du **Cyber Resilience Act** (SBOM machine-lisible).

## Ce qui est produit à chaque release

| Artefact | Format | Périmètre | Où |
|---|---|---|---|
| `sbom.cdx.json` | **CycloneDX** JSON | Dépendances applicatives (npm) **+ couches image** (Alpine, binaires système) | **Asset** de la GitHub Release |
| Attestation SBOM | **SPDX** (in-toto) | Image conteneur complète | Attachée à l'image dans **ghcr.io** (buildkit `sbom: true`) |
| Attestation de provenance | **SLSA** `mode=max` | Construction de l'image (source, arguments, environnement) | Attachée à l'image dans **ghcr.io** |
| `release.json` | JSON | Version, révision, digest image, hash migrations, **SHA256 du SBOM** | Asset de la Release |
| `sbom.cdx.json.sig` | signature cosign | Signature détachée du SBOM (si clé configurée) | Asset de la Release |

Le SBOM CycloneDX est généré par **Syft** (`anchore/sbom-action`) sur l'image
**poussée**, référencée par son **digest exact** — il décrit donc précisément
l'artefact livré, pas seulement l'arbre de sources.

## Intégrité et signature

- **Intégrité** : le SHA256 de `sbom.cdx.json` est inscrit dans `release.json`
  (`sbom.sha256`). Toute altération du SBOM est détectable.
- **Signature (souveraine)** : si les secrets `COSIGN_PRIVATE_KEY` (+ éventuel
  `COSIGN_PASSWORD`) sont configurés sur l'environnement `release`, le SBOM est
  signé avec **cosign** en `--tlog-upload=false` — **aucune écriture dans un
  journal de transparence public** (Rekor). La clé reste privée et sous contrôle
  de l'exploitant. Sans clé configurée, l'étape est sautée (le SBOM reste archivé
  et hashé).

### Provisionner la signature (exploitant)

```bash
cosign generate-key-pair                 # produit cosign.key (privée) + cosign.pub (publique)
# → déposer cosign.key dans le secret GitHub COSIGN_PRIVATE_KEY (environnement "release")
# → conserver cosign.pub pour la vérification (à distribuer aux consommateurs)
```

## Consommer / vérifier un SBOM

```bash
# 1. Récupérer les assets de la release
gh release download vX.Y.Z --pattern 'sbom.cdx.json*' --pattern 'release.json'

# 2. Vérifier l'intégrité (SHA256 attendu dans release.json)
jq -r '.sbom.sha256' release.json
sha256sum sbom.cdx.json

# 3. Vérifier la signature (si présente), avec la clé publique de l'exploitant
cosign verify-blob --key cosign.pub --insecure-ignore-tlog \
  --signature sbom.cdx.json.sig sbom.cdx.json

# 4. Analyser les vulnérabilités à partir du SBOM (hors ligne possible)
grype sbom:sbom.cdx.json          # ou : trivy sbom sbom.cdx.json

# 5. Inspecter les attestations attachées à l'image (SBOM SPDX + provenance SLSA)
docker buildx imagetools inspect ghcr.io/bdudout/acra@<digest> \
  --format '{{ json .SBOM }}'
docker buildx imagetools inspect ghcr.io/bdudout/acra@<digest> \
  --format '{{ json .Provenance }}'
```

## Alignement ANSSI / CRA

- **Inventaire exhaustif** des composants tiers (dépendances directes et
  transitives + couches système) → base de la veille CVE.
- **Traçabilité** : SBOM lié au digest immuable de l'image et à la révision Git ;
  provenance SLSA de la construction.
- **Intégrité vérifiable** (SHA256) et **authenticité** (signature souveraine).
- **Format standard et machine-lisible** (CycloneDX / SPDX), exploitable par les
  outils de gestion de vulnérabilités (grype, trivy, dependency-track).

Voir aussi : `docs/runbook-exploitation.md` (exploitation) et
`docs/RELEASE-CHECKLIST.md` (recette de release).
