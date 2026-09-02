#!/bin/sh
# ─── Réconciliation P3009 (sûre) puis migrate deploy ─────────────────────────
# Point d'entrée du service `migrator`. Objectif : ne pas bloquer un déploiement
# quand une migration Prisma est enregistrée « failed » (P3009) ALORS QUE le schéma
# réel de la base est déjà correct — cas typique d'une base dont des migrations ont
# été appliquées hors Prisma, ou d'un échec transitoire ayant tout de même créé les
# objets.
#
# SÛRETÉ : la réconciliation (marquer des migrations « appliquées » sans rejouer le
# DDL) n'est déclenchée QUE si `migrate diff` prouve que la base ne manque d'aucun
# objet (aucun CREATE/ADD). Dès qu'une vraie différence de schéma existe, le script
# NE touche à rien et laisse `migrate deploy` s'exécuter (et échouer bruyamment si
# besoin) → intervention manuelle documentée dans docs/runbook-exploitation.md §2.
#
# S'exécute depuis le WORKDIR de l'image applicative (node_modules + prisma/ présents).
set -eu

PRISMA="node node_modules/prisma/build/index.js"

STATUS="$($PRISMA migrate status 2>&1 || true)"

if echo "$STATUS" | grep -q "Database schema is up to date"; then
  echo "[migrate-recover] Migrations à jour."
else
  if echo "$STATUS" | grep -qiE "failed|not yet been applied|P3009"; then
    echo "[migrate-recover] Migrations non résolues détectées — diagnostic du schéma…"
    DIFF="$($PRISMA migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script 2>/dev/null || echo '__DIFF_ERROR__')"
    if echo "$DIFF" | grep -qiE "CREATE TABLE|ADD COLUMN|CREATE TYPE|ADD CONSTRAINT|CREATE INDEX|__DIFF_ERROR__"; then
      echo "[migrate-recover] ⚠ La base présente de VRAIES différences avec le schéma (objets manquants) ou le diff est indisponible."
      echo "[migrate-recover] Réconciliation automatique REFUSÉE — 'migrate deploy' va s'exécuter (échec probable → récupération manuelle, runbook §2)."
    else
      echo "[migrate-recover] Schéma déjà conforme (aucun objet manquant) — réconciliation du journal des migrations…"
      # Marque comme appliquées les migrations en échec ET non appliquées, SANS
      # rejouer leur DDL. Les seuls identifiants présents dans la sortie de
      # `migrate status` sont des noms de migration (la migration en échec + celles
      # « not yet applied »).
      for m in $($PRISMA migrate status 2>&1 | grep -oE '[0-9]{14}_[A-Za-z0-9_]+' | sort -u); do
        if $PRISMA migrate resolve --applied "$m" >/dev/null 2>&1; then
          echo "  ✓ résolue : $m"
        fi
      done
      echo "[migrate-recover] Réconciliation terminée."
    fi
  fi
fi

echo "[migrate-recover] prisma migrate deploy…"
exec $PRISMA migrate deploy
