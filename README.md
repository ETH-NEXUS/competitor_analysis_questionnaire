# NEXUS Full Stack Template

A production-ready full-stack web application template with Django REST Framework backend and Nuxt 4 frontend.

## Tech Stack

**Backend:**
<img src="https://img.shields.io/badge/Python_3.12-FFD43B?style=for-the-badge&logo=python&logoColor=blue"/><img src="https://img.shields.io/badge/Django_5.2-092E20?style=for-the-badge&logo=django&logoColor=green"/><img src="https://img.shields.io/badge/DRF-ff1709?style=for-the-badge&logo=django&logoColor=white"/><img src="https://img.shields.io/badge/Celery-37814A?style=for-the-badge&logo=celery&logoColor=white"/>

**Frontend:**
<img src="https://img.shields.io/badge/Nuxt_4-00C58E?style=for-the-badge&logo=nuxtdotjs&logoColor=white"/><img src="https://img.shields.io/badge/Vue_3-35495E?style=for-the-badge&logo=vuedotjs&logoColor=4FC08D"/><img src="https://img.shields.io/badge/Tailwind_4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white"/><img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white"/><img src="https://img.shields.io/badge/Pinia-FFD859?style=for-the-badge&logo=vue.js&logoColor=black"/>

**Infrastructure:**
<img src="https://img.shields.io/badge/Docker-2CA5E0?style=for-the-badge&logo=docker&logoColor=white"/><img src="https://img.shields.io/badge/PostgreSQL_18-316192?style=for-the-badge&logo=postgresql&logoColor=white"/><img src="https://img.shields.io/badge/Redis_8-DC382D?style=for-the-badge&logo=redis&logoColor=white"/>

## Quickstart

```bash
# 1. Copy environment template
cp .env.TEMPLATE .env

# 2. Start the stack
docker compose up -d

# 3. Access the app
# Frontend:    http://localhost:4080
# API:         http://localhost:4000/api/v1/
# Admin:       http://localhost:4080/admin
# Swagger:     http://localhost:4080/swagger
```

Default admin credentials: `admin` / `admin` (set via `DJANGO_SU_*` in `.env`)

## Architecture

**Development:**
```
┌─────────────────────────────────────────────────────────────┐
│                    Browser (localhost:4080)                  │
│                    Nuxt 4 SPA + Pinia + TailwindCSS         │
└─────────────────────────────────────────────────────────────┘
                              │
                    Nuxt Dev Proxy (/api/v1 → api:5000)
                              │
┌─────────────────────────────────────────────────────────────┐
│                    Django REST Framework                     │
│              Session Auth + CSRF + Object Permissions        │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┴─────────────────────┐
        │                                           │
┌───────────────┐                         ┌─────────────────┐
│  PostgreSQL   │                         │      Redis      │
│   (data)      │                         │ (cache/session) │
└───────────────┘                         └─────────────────┘
                                                    │
                                          ┌─────────────────┐
                                          │  Celery Worker  │
                                          │   (optional)    │
                                          └─────────────────┘
```

**Production:**
```
┌─────────────────────────────────────────────────────────────┐
│                         Browser                              │
└─────────────────────────────────────────────────────────────┘
                              │
                         HTTPS (443)
                              │
┌─────────────────────────────────────────────────────────────┐
│                    SMNRP Reverse Proxy                       │
│          (SSL termination, static files, routing)           │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
   /static, /media       /api/v1/*            /* (SPA)
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐   ┌─────────────────┐   ┌───────────────┐
│ Static Files  │   │Django + Gunicorn│   │  Nuxt Build   │
│  (volumes)    │   │      (API)      │   │ (static HTML) │
└───────────────┘   └─────────────────┘   └───────────────┘
                              │
        ┌─────────────────────┴─────────────────────┐
        │                                           │
┌───────────────┐                         ┌─────────────────┐
│  PostgreSQL   │                         │      Redis      │
└───────────────┘                         └─────────────────┘
                                                    │
                                          ┌─────────────────┐
                                          │  Celery Worker  │
                                          └─────────────────┘
```

## Backend (Django)

### Dependencies

| Package | Purpose |
|---------|---------|
| `django` | Web framework |
| `djangorestframework` | REST API toolkit |
| `dj-rest-auth` | Authentication endpoints |
| `django-cors-headers` | CORS handling |
| `django-guardian` | Object-level permissions |
| `django-filter` | Queryset filtering |
| `django-redis` | Redis cache backend |
| `django-environ` | Environment variable management |
| `django-extensions` | Extended management commands |
| `django-dbbackup` | Database backup/restore |
| `celery[redis]` | Background task queue |
| `django-celery-beat` | Periodic task scheduling |
| `django-celery-results` | Task result storage |
| `structlog` | Structured logging (JSON in prod) |
| `drf-spectacular` | OpenAPI schema generation (dev) |
| `gunicorn` | Production WSGI server |
| `psycopg` | PostgreSQL adapter |
| `langchain` | Utilities for LLMS |
| `langchain-ollama` | Utilities for interaction with OLLAMA |

### API Endpoints

| Endpoint | Method | Auth | Description        |
|----------|--------|------|--------------------|
| `/api/v1/health/` | GET | No | Health check       |
| `/api/v1/auth/csrf/` | GET | No | Get CSRF token     |
| `/api/v1/auth/login/` | POST | No | Login              |
| `/api/v1/auth/logout/` | POST | Yes | Logout             |
| `/api/v1/auth/user/` | GET | Yes | Current user       |
| `/api/v1/schema/` | GET | No | OpenAPI spec (dev) |
| `/api/v1/schema/swagger-ui/` | GET | No | Swagger UI (dev)   |
| `/api/v1/schema/redoc/` | GET | No | Redoc UI (dev)     |

### Permissions

Defined in `core/permissions.py`:

```python
class Groups:
    EDITOR = "editor"

class Perms:
    VIEW_BOOK = "core.view_book"
```

## Frontend (Nuxt)

### Dependencies

| Package | Purpose |
|---------|---------|
| `nuxt` | Vue meta-framework (SSR disabled, SPA mode) |
| `@nuxt/ui` | Component library (Tailwind + Headless UI) |
| `tailwindcss` | Utility-first CSS |
| `pinia` | State management |
| `@tanstack/vue-query` | Server state management |
| `nuxt-open-fetch` | Type-safe API client from OpenAPI |
| `@nuxtjs/i18n` | Internationalization |
| `@vueuse/nuxt` | Vue composables |

### Project Structure

```
ui/app/
├── nuxt.config.ts          # Nuxt configuration
├── app.vue                 # Root component
├── app/
│   ├── components/         # Vue components
│   │   └── AuthPanel.vue   # Login/logout UI
│   ├── stores/
│   │   └── auth.ts         # Authentication state (Pinia)
│   ├── plugins/
│   │   └── open-fetch-auth.client.ts  # CSRF handling
│   ├── assets/css/         # Tailwind styles
│   └── locales/            # i18n translations
└── openapi/
    └── api/openapi.json    # Generated API schema
```

### API Client

The `nuxt-open-fetch` module generates a type-safe API client from the OpenAPI schema:

```typescript
// Auto-generated from openapi.json
const { data } = await $api('/books/')
```

## Docker Services

| Service | Profile | Host Port | Description |
|---------|---------|-----------|-------------|
| `ui` | dev | 4080 | Nuxt dev server |
| `api` | - | 4000 | Django REST API |
| `db` | - | 4432 | PostgreSQL |
| `redis` | - | 4379 | Cache & sessions |
| `celery-worker` | celery | - | Task processor |
| `celery-beat` | celery | - | Task scheduler |
| `mkdocs` | docs | 4081 | Documentation |
| `ws` | prod | 4088/4443 | Production proxy |

### Profiles

```bash
# Development (default)
docker compose up -d

# With Celery workers
docker compose --profile celery up -d

# With documentation
docker compose --profile docs up -d

# Production
docker compose --profile prod up -d
```

## Authentication

Session-based authentication with CSRF protection (no JWT).

### Flow

1. UI fetches CSRF token from `/api/v1/auth/csrf/`
2. User submits credentials to `/api/v1/auth/login/`
3. Django creates session, sets `sessionid` cookie
4. All subsequent requests include cookies (`credentials: 'include'`)
5. Unsafe methods (POST/PUT/PATCH/DELETE) include `X-CSRFToken` header

### Security

- **SameSite cookies**: `Strict` (prevents CSRF attacks)
- **HttpOnly**: Session cookie not accessible via JavaScript
- **Secure flag**: Enabled in production (HTTPS only)
- **CORS**: Restricted to configured origins

## Access Control

Example endpoints demonstrating different permission levels:

| Endpoint | Permission |
|----------|------------|
| `/api/v1/access/public/` | `AllowAny` |
| `/api/v1/access/authenticated/` | `IsAuthenticated` |
| `/api/v1/access/admin/` | `IsAdminUser` |
| `/api/v1/access/editor/` | Custom `IsEditor` (group membership) |
| `/api/v1/access/editor-books/` | Object-level via django-guardian |

Grant object permission (admin only):
```bash
POST /api/v1/access/editor-books/<id>/grant/
{"user": "alice"}   # or {"group": "editor"}
```

## Background Tasks (Celery)

Celery is always installed but workers run only when enabled.

```bash
# Start workers
make celery

# Or with docker compose
docker compose --profile celery up -d
```

### Example Task

```python
# core/tasks.py
from celery import shared_task

@shared_task
def example_task(message: str) -> str:
    return f"Processed: {message}"

# Dispatch from anywhere
example_task.delay("hello")
```

### Configuration

- **Broker**: Redis (DB 0)
- **Results**: Database (django-celery-results)
- **Scheduler**: Database (django-celery-beat)
- **Task time limit**: 30 minutes

Scheduled tasks can be configured via Django admin.

## Database

### Migrations

```bash
make migrate           # Apply migrations
make makemigrations    # Create new migrations
```

### Backup & Restore

```bash
make db-backup                     # Create backup
make db-restore FILE=backup.psql   # Restore from file
```

Backups stored in `api/backups/`.

### Shell Access

```bash
make dbshell   # PostgreSQL shell
make shell     # Django shell_plus
```

## Redis

Used for:
- **Sessions**: Faster than database-backed sessions
- **Cache**: General-purpose caching (DB 1)
- **Celery broker**: Task queue (DB 0)

Persistence enabled via AOF (Append-Only File).

## Makefile Commands

```bash
# Docker
make up              # Start dev services
make down            # Stop all services
make build           # Build images
make logs            # Follow all logs
make logs-api        # API logs only
make ps              # List services
make clean           # Remove containers and volumes

# Django
make shell           # Django shell_plus
make migrate         # Run migrations
make makemigrations  # Create migrations
make test            # Run pytest
make createsuperuser # Create admin user

# Database
make dbshell         # PostgreSQL shell
make db-backup       # Backup database
make db-restore      # Restore (FILE=backup.psql)

# Code Quality
make lint            # Run ruff linter
make format          # Format with ruff
make typecheck       # Run mypy

# Optional Services
make celery          # Start Celery workers
make logs-celery     # Celery logs
make docs            # Start MkDocs

# Utilities
make doctor          # Check environment
```

## Environment Variables

Key variables in `.env.TEMPLATE`:

### Application
| Variable | Default | Description                          |
|----------|---------|--------------------------------------|
| `APP_ENV` | `dev` | Build environment (dev/prod)         |
| `COMPOSE_PROFILES` | `dev` | Docker profiles to enable by default |

### Django
| Variable | Default | Description |
|----------|---------|-------------|
| `DJANGO_DEBUG` | `True` | Debug mode |
| `DJANGO_SECRET_KEY` | - | Secret key |
| `DJANGO_ALLOWED_HOSTS` | - | Comma-separated hosts |
| `DJANGO_CORS_ALLOWED_ORIGINS` | - | CORS origins |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | - | CSRF origins |
| `DJANGO_LOG_LEVEL` | `INFO` | Log level |
| `DJANGO_LOG_SQL` | `False` | SQL query logging |

### Database
| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_HOST` | `db` | Database host |
| `POSTGRES_PORT` | `5432` | Database port |
| `POSTGRES_DB` | - | Database name |
| `POSTGRES_USER` | - | Database user |
| `POSTGRES_PASSWORD` | - | Database password |

### Redis
| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_HOST` | `redis` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |

### Admin User
| Variable | Default | Description |
|----------|---------|-------------|
| `DJANGO_SU_NAME` | `admin` | Superuser username |
| `DJANGO_SU_EMAIL` | - | Superuser email |
| `DJANGO_SU_PASSWORD` | `admin` | Superuser password |

### ML Features
| Variable | Default | Description |
|----------|---------|-------------|
| `AI_PROVIDER` | `ollama` | ML model provider |
| `OLLAMA_BASE_URL` | `host.docker.internal:11434` | Location of ollama (default is ollama on host) |

### Ports

Each service uses `*_PORT` for the internal container port and `*_HOST_PORT` for the port exposed to the host machine.

| Variable | Default | Description |
|----------|---------|-------------|
| `DJANGO_PORT` | `5000` | API internal port |
| `DJANGO_HOST_PORT` | `4000` | API host port |
| `UI_PORT` | `8077` | Frontend internal port |
| `UI_HOST_PORT` | `4080` | Frontend host port |
| `POSTGRES_PORT` | `5432` | PostgreSQL internal port |
| `POSTGRES_HOST_PORT` | `4432` | PostgreSQL host port |
| `REDIS_PORT` | `6379` | Redis internal port |
| `REDIS_HOST_PORT` | `4379` | Redis host port |
| `MKDOCS_PORT` | `8000` | MkDocs internal port |
| `MKDOCS_HOST_PORT` | `4081` | MkDocs host port |
| `SMNRP_HTTP_HOST_PORT` | `4088` | Reverse proxy HTTP host port |
| `SMNRP_HTTPS_HOST_PORT` | `4443` | Reverse proxy HTTPS host port |

## Code Quality

### Pre-commit Hooks

```bash
pre-commit install   # Install hooks
```

Runs automatically on commit:
- **Ruff**: Python linting & formatting
- **Prettier**: JavaScript/CSS formatting (with Tailwind sorting)

### Manual Checks

```bash
make lint       # Ruff linter
make format     # Ruff formatter
make typecheck  # Mypy type checker
make test       # Pytest
```

### Configuration

- **Ruff**: `api/pyproject.toml` (line length 88, Python 3.12)
- **Mypy**: `api/pyproject.toml` (strict mode with Django/DRF plugins)
- **Prettier**: `ui/app/.prettierrc`

## Project Structure

```
nexus-fullstack-example/
├── api/                          # Django backend
│   ├── Dockerfile
│   ├── pyproject.toml            # Dependencies & tool config
│   └── app/
│       ├── fsex/                 # Django project
│       │   ├── settings.py
│       │   ├── urls.py
│       │   └── celery.py
│       ├── core/                 # Main application
│       │   ├── models.py
│       │   ├── serializers.py
│       │   ├── viewsets.py
│       │   ├── permissions.py
│       │   └── tasks.py
│       └── entrypoint.sh         # Container startup
├── ui/                           # Nuxt frontend
│   ├── Dockerfile
│   └── app/
│       ├── package.json
│       ├── nuxt.config.ts
│       └── app/
│           ├── components/
│           ├── stores/
│           └── plugins/
├── docs/                         # MkDocs documentation
│   ├── Dockerfile
│   └── mkdocs.yml
├── compose.yml
├── Makefile
├── .env.TEMPLATE
└── .pre-commit-config.yaml
```

## Development Notes

**UI dependencies**: Installed by Docker into `ui/app/node_modules` (mounted to host for IDE indexing). __Never run `npm install` on host!__

**Hot reload**: Both API and UI support hot reload via volume mounts.

**Same-origin proxy**: In dev, Nuxt proxies `/api/v1` to the API container, avoiding CORS issues.

## Production Deployment

```bash
# Build and start production services
docker compose --profile prod up -d
```

### Production Profile

The `prod` profile runs:
- **ui-build**: Builds Nuxt to static files (outputs to shared volume)
- **ws (SMNRP)**: Reverse proxy serving the application
- **api**: Django with Gunicorn (not exposed directly)
- **db, redis**: Database and cache

### SMNRP Reverse Proxy

[SMNRP](https://github.com/ETH-NEXUS/smnrp) is a lightweight nginx-like reverse proxy that handles:
- **SSL termination**: HTTPS with automatic certificate handling
- **Static file serving**: Nuxt build, Django static/media files
- **API proxying**: Routes `/api/v1/*` to Django
- **SPA routing**: All other routes serve the Nuxt index.html

Configuration via environment variables:

| Variable | Description |
|----------|-------------|
| `SMNRP_DOMAINS` | Domain names to serve |
| `SMNRP_UPSTREAMS` | Backend services (api:5000) |
| `SMNRP_UPSTREAM_PROTOCOL` | HTTP or HTTPS |
| `SMNRP_LOCATIONS` | Custom routing rules |
| `SMNRP_HTTP_HOST_PORT` | HTTP host port (default 4088) |
| `SMNRP_HTTPS_HOST_PORT` | HTTPS host port (default 4443) |

SSL certificates can be mounted to `/etc/letsencrypt/live/<domain>/`.

### Production Behavior

- Secure cookie flags enabled (`Secure`, `SameSite=Strict`)
- JSON structured logging (structlog)
- Debug mode disabled
- Browsable API disabled
