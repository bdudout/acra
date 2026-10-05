#!/usr/bin/env bash
# =============================================================================
# ACRA — Backup PostgreSQL automatisé
# =============================================================================
#
# Usage : ./scripts/backup.sh
#   ou via docker compose : docker compose run --rm backup
#
# Variables d'environnement attendues :
#   POSTGRES_USER      login PostgreSQL
#   POSTGRES_PASSWORD  mot de passe PostgreSQL
#   POSTGRES_DB        nom de la base
#   POSTGRES_HOST      hôte (default: db)
#   BACKUP_DIR         répertoire de destination (default: /backups)
#   BACKUP_KEEP        nombre de dumps à conserver (default: 7) — prioritaire
#   BACKUP_RETENTION   ancienne règle (jours) : utilisée seulement si BACKUP_KEEP n'est pas défini
#
# Sortie :
#   /backups/ebios_YYYY-MM-DD_HH-MM-SS.sql.gz  → dump compressé
#   Seuls les BACKUP_KEEP dumps les plus récents sont conservés (ou, à défaut, ceux de moins de BACKUP_RETENTION jours).
# =============================================================================
set -euo pipefail

# --- Configuration -----------------------------------------------------------
POSTGRES_HOST="${POSTGRES_HOST:-db}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
# Rétention par NOMBRE (défaut 7). L'ancienne règle par âge ne s'applique que si BACKUP_RETENTION est défini SANS BACKUP_KEEP valide.
BACKUP_RETENTION="${BACKUP_RETENTION:-}"
BACKUP_KEEP="${BACKUP_KEEP:-}"
case "${BACKUP_KEEP}" in 0|*[!0-9]*) BACKUP_KEEP="" ;; esac
TIMESTAMP="$(date +%Y-%m-%d_%H-%M-%S)"
FILENAME="${BACKUP_DIR}/ebios_${TIMESTAMP}.sql.gz"

# --- Validation --------------------------------------------------------------
: "${POSTGRES_USER:?Variable POSTGRES_USER non définie}"
: "${POSTGRES_PASSWORD:?Variable POSTGRES_PASSWORD non définie}"
: "${POSTGRES_DB:?Variable POSTGRES_DB non définie}"

# --- Création du répertoire de sauvegarde -----------------------------------
mkdir -p "${BACKUP_DIR}"

echo "[backup] Démarrage du backup — $(date '+%Y-%m-%d %H:%M:%S')"
echo "[backup] Base    : ${POSTGRES_DB} sur ${POSTGRES_HOST}:${POSTGRES_PORT}"
echo "[backup] Fichier : ${FILENAME}"

# --- Attente disponibilité de PostgreSQL ------------------------------------
max_attempts=30
attempt=0
until PGPASSWORD="${POSTGRES_PASSWORD}" pg_isready \
  -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" \
  -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -q; do
  attempt=$((attempt + 1))
  if [ "${attempt}" -ge "${max_attempts}" ]; then
    echo "[backup] ERREUR : PostgreSQL non disponible après ${max_attempts} tentatives."
    exit 1
  fi
  echo "[backup] En attente de PostgreSQL... (${attempt}/${max_attempts})"
  sleep 2
done

# --- Dump + compression ------------------------------------------------------
PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump \
  -h "${POSTGRES_HOST}" \
  -p "${POSTGRES_PORT}" \
  -U "${POSTGRES_USER}" \
  --no-password \
  --format=plain \
  --clean \
  --if-exists \
  "${POSTGRES_DB}" \
  | gzip -9 > "${FILENAME}"

SIZE="$(du -sh "${FILENAME}" | cut -f1)"
echo "[backup] Backup terminé — taille : ${SIZE}"

# --- Rotation ----------------------------------------------------------------
if [ -z "${BACKUP_KEEP}" ] && [ -n "${BACKUP_RETENTION}" ]; then
  echo "[backup] Rotation (ancienne règle) : suppression des backups de plus de ${BACKUP_RETENTION} jours"
  find "${BACKUP_DIR}" -maxdepth 1 -name "ebios_*.sql.gz" \
    -mtime "+${BACKUP_RETENTION}" -print -delete
else
  KEEP="${BACKUP_KEEP:-7}"
  echo "[backup] Rotation : conservation des ${KEEP} backups les plus récents"
  ls -1 "${BACKUP_DIR}" | grep '^ebios_.*\.sql\.gz$' | sort -r | tail -n "+$((KEEP + 1))" | while read -r old; do
    rm -f "${BACKUP_DIR}/${old}" && echo "${BACKUP_DIR}/${old}"
  done
fi

REMAINING="$(find "${BACKUP_DIR}" -maxdepth 1 -name "ebios_*.sql.gz" | wc -l | tr -d ' ')"
echo "[backup] Backups conservés : ${REMAINING}"

# --- Copie hors-site (optionnelle) ------------------------------------------
# Si BACKUP_OFFSITE_CMD est défini, il est exécuté avec le chemin du dump en
# argument → permet de pousser le backup vers un stockage distant (OVH S3/Swift,
# rsync, scp…). Exemples :
#   BACKUP_OFFSITE_CMD="rclone copy"          → rclone copy "<fichier>" (config rclone requise)
#   BACKUP_OFFSITE_CMD="aws s3 cp - s3://acra-backups/"   (adapter)
# L'échec de la copie hors-site N'INVALIDE PAS le backup local (log d'alerte).
if [ -n "${BACKUP_OFFSITE_CMD:-}" ]; then
  echo "[backup] Copie hors-site : ${BACKUP_OFFSITE_CMD} ${FILENAME}"
  if sh -c "${BACKUP_OFFSITE_CMD} \"${FILENAME}\""; then
    echo "[backup] Copie hors-site OK."
  else
    echo "[backup] ⚠ Copie hors-site ÉCHOUÉE — le backup local est conservé."
  fi
fi

echo "[backup] Terminé — $(date '+%Y-%m-%d %H:%M:%S')"
