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
#   BACKUP_RETENTION   nombre de jours à conserver (default: 7)
#
# Sortie :
#   /backups/ebios_YYYY-MM-DD_HH-MM-SS.sql.gz  → dump compressé
#   Les fichiers de plus de BACKUP_RETENTION jours sont supprimés automatiquement.
# =============================================================================
set -euo pipefail

# --- Configuration -----------------------------------------------------------
POSTGRES_HOST="${POSTGRES_HOST:-db}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
BACKUP_RETENTION="${BACKUP_RETENTION:-7}"
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

# --- Rotation : suppression des fichiers plus anciens que BACKUP_RETENTION ---
echo "[backup] Rotation : suppression des backups de plus de ${BACKUP_RETENTION} jours"
find "${BACKUP_DIR}" -maxdepth 1 -name "ebios_*.sql.gz" \
  -mtime "+${BACKUP_RETENTION}" -print -delete

REMAINING="$(find "${BACKUP_DIR}" -maxdepth 1 -name "ebios_*.sql.gz" | wc -l | tr -d ' ')"
echo "[backup] Backups conservés : ${REMAINING}"
echo "[backup] Terminé — $(date '+%Y-%m-%d %H:%M:%S')"
