#!/usr/bin/env bash
# Sur la stable antérieure, l'image ne porte pas encore l'identité de révision.
# La surcouche CI injecte cette identité à l'exécution du conteneur seulement.
set -euo pipefail
sha="${1:-}"
[[ "$sha" =~ ^[0-9a-f]{40}$ ]] || { echo 'SHA stable invalide' >&2; exit 2; }
printf 'services:\n  app:\n    environment:\n      ACRA_VERSION: ${ACRA_VERSION:-v1.0.4}\n      ACRA_REVISION: ${ACRA_REVISION:-%s}\n' "$sha"
