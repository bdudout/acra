#!/usr/bin/env bash
# ─── Étapes de mise à jour exécutées depuis la version CIBLE — docs/specs/sauvegarde-rollback-spec.md, lot 2 ───
# Lancé par scripts/update.sh (passage de main, ADR-004) après FETCH, depuis une COPIE temporaire de ce fichier :
# MIGRATE → START → HEALTH → SMOKE → FINALIZE, et retour arrière (code + base + documents) en cas d'échec.
# Contrat versionné : le lanceur refuse une valeur de ACRA_UPDATE_STEPS_API qu'il ne connaît pas.
# Usage : update-steps.sh <chemin de .acra-update/run/current.json>   (variables : ACRA_STATUS_FILE, ACRA_COMPOSE_FILES, …)
ACRA_UPDATE_STEPS_API=1
set -euo pipefail
umask 077
cd "${ACRA_ROOT:-$(dirname "$0")/..}"
JOURNAL="${1:?journal manquant}"
STATUS="${ACRA_STATUS_FILE:-}"
# shellcheck disable=SC1091
. scripts/update-lib.sh
load_journal "$JOURNAL"
run_steps
