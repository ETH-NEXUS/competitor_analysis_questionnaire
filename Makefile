.PHONY: help doctor up down build logs ps restart clean \
        shell migrate makemigrations test createsuperuser \
        dbshell db-backup db-restore \
        lint format typecheck \
        ui-shell docs celery logs-celery

# Default target
help:
	@echo "Usage: make [target]"
	@echo ""
	@echo "Docker:"
	@echo "  up              Start all services (dev profile)"
	@echo "  up-prod         Start all services (prod profile)"
	@echo "  down            Stop all services"
	@echo "  build           Build all images"
	@echo "  logs            Follow logs (all services)"
	@echo "  logs-api        Follow API logs"
	@echo "  logs-ui         Follow UI logs"
	@echo "  ps              List running services"
	@echo "  restart         Restart all services"
	@echo "  clean           Stop services and remove volumes"
	@echo ""
	@echo "Django:"
	@echo "  shell           Open Django shell"
	@echo "  migrate         Run database migrations"
	@echo "  makemigrations  Create new migrations"
	@echo "  test            Run pytest"
	@echo "  createsuperuser Create Django superuser"
	@echo ""
	@echo "Database:"
	@echo "  dbshell         Open PostgreSQL shell"
	@echo "  db-backup       Backup database"
	@echo "  db-restore      Restore database (use: make db-restore FILE=backup.psql)"
	@echo ""
	@echo "Code Quality:"
	@echo "  lint            Run ruff linter"
	@echo "  format          Format code with ruff"
	@echo "  typecheck       Run mypy type checker"
	@echo ""
	@echo "Celery (optional):"
	@echo "  celery          Start Celery worker + beat"
	@echo "  logs-celery     Follow Celery logs"
	@echo ""
	@echo "Other:"
	@echo "  ui-shell        Open shell in UI container"
	@echo "  docs            Start MkDocs server"
	@echo "  doctor          Check environment setup"

# Environment check
doctor:
	@test -f .env || (echo "Missing .env (copy from .env.TEMPLATE)" && exit 1)
	@docker compose config >/dev/null
	@echo "OK"

# Docker commands
up:
	docker compose --profile dev up -d

up-prod:
	docker compose --profile prod up -d

down:
	docker compose --profile dev --profile prod --profile docs --profile celery down

build:
	docker compose --profile dev --profile prod --profile docs --profile celery build

logs:
	docker compose --profile dev --profile prod --profile docs --profile celery logs -f

logs-api:
	docker compose logs -f api

logs-ui:
	docker compose logs -f ui

ps:
	docker compose --profile dev --profile prod --profile docs --profile celery ps

restart:
	docker compose --profile dev --profile prod --profile docs --profile celery restart

clean:
	docker compose --profile dev --profile prod --profile docs --profile celery down -v

# Django commands
shell:
	docker compose exec api python manage.py shell_plus

migrate:
	docker compose exec api python manage.py migrate

makemigrations:
	docker compose exec api python manage.py makemigrations

test:
	docker compose exec api pytest

createsuperuser:
	docker compose exec api python manage.py createsuperuser

# Database commands
dbshell:
	docker compose exec db psql -U $${POSTGRES_USER:-postgres} -d $${POSTGRES_DB:-postgres}

db-backup:
	docker compose exec api python manage.py dbbackup

db-restore:
	@test -n "$(FILE)" || (echo "Usage: make db-restore FILE=backup.psql" && exit 1)
	docker compose exec api python manage.py dbrestore -i $(FILE)

# Code quality
lint:
	docker compose exec api ruff check .

format:
	docker compose exec api ruff format .

typecheck:
	docker compose exec api mypy .

# UI commands
ui-shell:
	docker compose exec ui sh

# Celery (optional)
celery:
	docker compose --profile celery up -d celery-worker celery-beat
	@echo "Celery worker and beat started"

logs-celery:
	docker compose --profile celery logs -f celery-worker celery-beat

# Documentation
docs:
	docker compose --profile docs up -d mkdocs
	@echo "MkDocs running at http://localhost:$${MKDOCS_PORT:-8078}"
