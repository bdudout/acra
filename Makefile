# =============================================================================
# ACRA — Makefile
# Commandes de développement et de déploiement
# Usage : make <cible>
# =============================================================================

.PHONY: help setup up down logs restart build test db-reset db-migrate

# Affiche l'aide par défaut
help:
	@echo ""
	@echo "  ACRA — Commandes disponibles"
	@echo "  ─────────────────────────────────────────────────────"
	@echo "  make setup      Configurer l'environnement (génère .env)"
	@echo "  make up         Démarrer l'application"
	@echo "  make down       Arrêter l'application"
	@echo "  make restart    Redémarrer l'application"
	@echo "  make logs       Afficher les logs en temps réel"
	@echo "  make build      Reconstruire les images Docker"
	@echo "  make test       Lancer les tests unitaires"
	@echo "  make db-migrate Appliquer les migrations Prisma"
	@echo "  make db-reset   Réinitialiser la base de données (DANGER)"
	@echo "  ─────────────────────────────────────────────────────"
	@echo ""

# ── Premier démarrage ─────────────────────────────────────────────────────────
setup:
	@bash scripts/setup.sh

# ── Docker Compose ─────────────────────────────────────────────────────────────
up: check-env
	docker compose up -d
	@echo ""
	@echo "  ✓ ACRA démarré sur $$(grep NEXTAUTH_URL .env | cut -d= -f2)"
	@echo "  → Logs : make logs"

down:
	docker compose down

restart:
	docker compose restart app

logs:
	docker compose logs -f app

build:
	docker compose build --no-cache app

# ── Base de données ───────────────────────────────────────────────────────────
db-migrate:
	docker compose exec app node node_modules/prisma/build/index.js migrate deploy

db-reset:
	@echo "ATTENTION : Cette commande supprime toutes les données !"
	@read -p "Confirmer ? (oui/non) : " confirm && [ "$$confirm" = "oui" ] || exit 1
	docker compose down -v
	docker compose up -d db
	@sleep 3
	docker compose up -d app

# ── Tests ─────────────────────────────────────────────────────────────────────
test:
	npm --prefix . test

# ── Vérification .env ─────────────────────────────────────────────────────────
check-env:
	@if [ ! -f .env ]; then \
		echo ""; \
		echo "  ✗ Fichier .env introuvable."; \
		echo "  → Lancez d'abord : make setup"; \
		echo ""; \
		exit 1; \
	fi
	@if grep -q "changeme\|CHANGEZ_MOI\|ebios_secret_changeme" .env 2>/dev/null; then \
		echo ""; \
		echo "  ✗ Le fichier .env contient des valeurs par défaut non modifiées."; \
		echo "  → Lancez : make setup  pour régénérer les secrets."; \
		echo ""; \
		exit 1; \
	fi
	@echo "  ✓ .env vérifié"
