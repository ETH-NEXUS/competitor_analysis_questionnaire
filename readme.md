# ETHZ - NEXUS - Full Stack Template

## Core tech

<img src="https://img.shields.io/badge/Python-FFD43B?style=for-the-badge&logo=python&logoColor=blue"/><img src="https://img.shields.io/badge/Django-092E20?style=for-the-badge&logo=django&logoColor=green"/><img src="https://img.shields.io/badge/django%20rest-ff1709?style=for-the-badge&logo=django&logoColor=white"/><img src="https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white"/>

<img src="https://img.shields.io/badge/nuxt%20js-00C58E?style=for-the-badge&logo=nuxtdotjs&logoColor=white" /><img src="https://img.shields.io/badge/Vue%20js-35495E?style=for-the-badge&logo=vuedotjs&logoColor=4FC08D" /><img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white"/><img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white"/>

<img src="https://img.shields.io/badge/Docker-2CA5E0?style=for-the-badge&logo=docker&logoColor=white"/><img src="https://img.shields.io/badge/Markdown-000000?style=for-the-badge&logo=markdown&logoColor=white"/>

## Quickstart (Docker)

1. Copy `.env.TEMPLATE` to `.env`.
2. Run `make doctor` for a quick check.
3. Start the stack:

```bash
docker compose up -d
```

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
- Docs: `http://localhost:8078`

## Deploy

TODO