# ETHZ - NEXUS - Full Stack Template

## Core tech

<img src="https://img.shields.io/badge/Python-FFD43B?style=for-the-badge&logo=python&logoColor=blue"/><img src="https://img.shields.io/badge/Django-092E20?style=for-the-badge&logo=django&logoColor=green"/><img src="https://img.shields.io/badge/django%20rest-ff1709?style=for-the-badge&logo=django&logoColor=white"/><img src="https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white"/>

<img src="https://img.shields.io/badge/nuxt%20js-00C58E?style=for-the-badge&logo=nuxtdotjs&logoColor=white" /><img src="https://img.shields.io/badge/Vue%20js-35495E?style=for-the-badge&logo=vuedotjs&logoColor=4FC08D" /><img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white"/><img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white"/>

<img src="https://img.shields.io/badge/Docker-2CA5E0?style=for-the-badge&logo=docker&logoColor=white"/><img src="https://img.shields.io/badge/Markdown-000000?style=for-the-badge&logo=markdown&logoColor=white"/>

## Quickstart (Docker)

1. Copy `.env.TEMPLATE` to `.env`.
2. Start the stack:

```bash
docker compose up -d

# With MkDocs documentation server (optional)
docker compose --profile dev --profile docs up -d
```


## Development

**IMPORTANT: UI dependencies are installed by Docker and written into `ui/app/node_modules` so your IDE (VS Code / JetBrains) can index them.
Never run `npm install` or `pnpm install` on your host.**

If you change UI dependencies, rebuild/restart the Docker UI service instead (e.g. `docker compose up -d --build ui`).

The default profile is `dev` via `COMPOSE_PROFILES=dev` in `.env`.

## Environment variables

The main knobs are in `.env.TEMPLATE`:

- `APP_ENV`: build-time env for the API image (default `dev`)
- `NUXT_PUBLIC_API_URL`: optional external API base URL for the UI
  - empty means "use same-origin" and rely on the Nuxt dev proxy to reach the API in Docker

Ports are env-driven:

- `UI_PORT` (default `8077`)
- `DJANGO_BACKEND_PORT` (default `5077`)
- `POSTGRES_HOST_PORT` (default `54377`)
- `REDIS_HOST_PORT` (default `6379`)
- `MKDOCS_PORT` (default `8078`)
- `SMNRP_HTTP_PORT` (default `8088`)
- `SMNRP_HTTPS_PORT` (default `443`)

## Health endpoint

The API exposes `GET /api/v1/health/` (used by Docker Compose healthchecks).

## Authentication (session + CSRF)

The API is secured by default and uses cookie-based session authentication (no JWT) via `dj-rest-auth`.

Auth endpoints:

- `GET /api/v1/auth/csrf/` - returns a CSRF token for SPA usage
- `POST /api/v1/auth/login/` - creates a session (cookie)
- `POST /api/v1/auth/logout/` - destroys the session
- `GET /api/v1/auth/user/` - returns the current user

The Nuxt app uses `nuxt-open-fetch` (`$api`) with:

- `credentials: 'include'` for all requests (so cookies are sent)
- automatic `X-CSRFToken` injection for `POST`/`PUT`/`PATCH`/`DELETE` (see `ui/app/app/plugins/open-fetch-auth.client.ts`)

In dev, this works best with same-origin requests via the Nuxt dev proxy (default). If you use a separate origin, make sure `DJANGO_CORS_ALLOWED_ORIGINS` and `DJANGO_CSRF_TRUSTED_ORIGINS` match your UI URL.

## Access control examples

Example endpoints under `/api/v1/access/...`:

- `GET /api/v1/access/public/` - no auth required
- `GET /api/v1/access/authenticated/` - logged-in users only
- `GET /api/v1/access/admin/` - admin users only
- `GET /api/v1/access/editor/` - users in the `editor` group
- `GET /api/v1/access/editor-books/` - books the editor has object-level permission for (django-guardian)
- `POST /api/v1/access/editor-books/<id>/grant/` - admin grants `view_book` on a book to a user (`{"user": "alice"}`) or group (`{"group": "editor"}`)

## Celery

Celery is included for background tasks and scheduled jobs. The API can dispatch tasks, but workers only run when enabled:

```bash
# Start Celery worker + beat scheduler
docker compose --profile celery up -d

# Or use make
make celery
```

Example task in `core/tasks.py`:

```python
from celery import shared_task

@shared_task
def example_task(message: str) -> str:
    return f"Processed: {message}"

# Dispatch from anywhere (views, management commands, etc.)
example_task.delay("hello")
```

Celery uses Redis as the broker and stores results in the database (django-celery-results). Scheduled tasks can be configured via Django admin (django-celery-beat).

## SQL query logging (dev)

To enable SQL query logging in the API, set:

- `DJANGO_LOG_SQL=True`

When enabled, queries from `django.db.backends` are logged to the console and pretty-printed (via `sqlparse`).

## Pre-commit

Pre-commit runs:

- Ruff (API)
- Prettier (UI)

Install once:

```bash
pre-commit install
```

## URLs

With the default `.env` ports:

- Frontend: `http://localhost:8077`
- Admin panel: `http://localhost:8077/admin`
- API (direct): `http://localhost:5077/api/v1/`
- API docs (dev): `http://localhost:8077/swagger`
- Docs: `http://localhost:8078` (requires `--profile docs`)

## Deploy

TODO