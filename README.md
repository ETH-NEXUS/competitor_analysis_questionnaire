# Hospital IT Solution Vendor Questionnaire

An English-only questionnaire built with Nuxt, Vue, TypeScript, Pinia and Nuxt UI,
with a Django REST Framework API and PostgreSQL storage.

Respondents enter their email and company, select their solution scope,
then answer core and scope-specific questions. Submitted responses appear in Django
admin as one row per respondent and solution, with Company, Solution scope and one
column per question. The table supports scope, company, solution, date and answer filters.

## Start locally

Run from the repository root:

```bash
cp .env.TEMPLATE .env  # Only for initial setup; keep an existing .env.
docker compose up -d
```

Host ports are configured in `.env`. With the development settings used here:

- Questionnaire: http://localhost:4080/
- Response table: http://localhost:4000/admin/core/questionnaireresponse/
- Django admin: http://localhost:4000/admin/
- API: http://localhost:4000/api/v1/
- API documentation: http://localhost:4000/api/v1/schema/swagger-ui/

Admin credentials come from `DJANGO_SU_NAME`, `DJANGO_SU_EMAIL` and
`DJANGO_SU_PASSWORD` in `.env`. Public respondents do not sign in. Django admin has
its own staff login; no frontend login component is needed.

## Application code

| Location | Purpose |
| --- | --- |
| `ui/app/app/app.vue` | Questionnaire navigation, review, download and submission UI. |
| `ui/app/app/components/QuestionnaireIdentity.vue` | Email and company fields. |
| `ui/app/app/components/QuestionnaireField.vue` | Choice, text, cost and capability inputs. |
| `ui/app/app/stores/questionnaire.ts` | Answers, browser drafts, conditional visibility and submission state. |
| `ui/app/app/utils/questionnaire.ts` | Section/scope definitions, conditions and answer formatting. |
| `ui/app/app/utils/questionnaire-core.json` | English core-question wording and choices. |
| `ui/app/app/utils/questionnaire-specific.json` | English solution-specific wording and choices. |
| `ui/app/app/api/mutator/custom-fetch.ts` | HTTP requests with session cookies and CSRF handling. |
| `ui/app/orval.config.ts` | Generates only the questionnaire client and the models it uses. |
| `api/app/core/models.py` | Response table with a separate text column for each question. |
| `api/app/core/serializers.py` | Validates submissions and converts answers to database columns. |
| `api/app/core/viewsets.py` | API endpoints. |
| `api/app/core/questionnaire.py` | Maps question IDs to database columns and comparison labels. |
| `api/app/core/admin.py`, `questionnaire_admin.py` | Response comparison table and filters. |
| `api/app/core/migrations/` | Database schema and data migration history. |

See [the frontend guide](ui/app/README.md) for a file-by-file explanation of the
generated API models, removed demo files, and why the admin login is separate.

The backend retains the original book/author and access-control demo endpoints.
They are not used or generated as frontend clients for this questionnaire. No
backend demo data or authentication configuration was deleted during frontend cleanup.

## Answers and submissions

- Choice indices are stable saved values. Do not reorder existing choices without
  migrating browser drafts or updating the draft version/key.
- Scope selections A–E determine the relevant question groups.
- The export follow-up appears only for Partial export, Vendor-specific migration
  or Other. Hidden draft answers are retained locally but excluded from submissions.
- Email, provider and at least one scope are required. Solution names from older responses are retained but optional. Incomplete
  questionnaire answers are allowed with a warning on the review screen.
- `POST /api/v1/questionnaire-responses/` saves a response and returns its ID and date.
- A client-generated submission UUID prevents duplicate rows when a request is retried.
- The public endpoint does not list, retrieve, edit or delete saved responses.
- In question columns, SQL NULL means not asked; an empty string means unanswered.
  Multi-select and matrix details are stored as readable lines.

## Development commands

Run application commands inside Docker:

```bash
docker compose exec ui pnpm generate:api
docker compose exec ui pnpm run lint
docker compose exec ui pnpm run build
docker compose exec api python manage.py check
docker compose exec api python manage.py makemigrations
docker compose exec api python manage.py migrate
docker compose exec api python manage.py createsuperuser
```

Nuxt proxies `/api/v1`, `/admin`, `/static` and related paths to the API container.
The development schema watcher refreshes `ui/app/openapi/api/openapi.json` and runs
Orval when the backend schema changes. Generated files are overwritten automatically.
Both API and UI source directories are mounted for hot reload. Apply migrations
when changing models before reviewing affected pages.

Python formatting/lint configuration is in `api/pyproject.toml`; frontend formatting
and lint configuration is in `ui/app/.prettierrc` and `eslint.config.mjs`.

## Docker services

| Service | Profile | Purpose |
| --- | --- | --- |
| `ui` | dev | Nuxt development server. |
| `api` | default | Django API and admin. |
| `db` | default | PostgreSQL. |
| `redis` | default | Sessions, cache and task broker. |
| `celery-worker`, `celery-beat` | celery | Optional background processing and schedules. |
| `mkdocs` | docs | Optional project documentation server. |
| `ui-build`, `ws` | prod | Static frontend build and production reverse proxy. |

```bash
docker compose --profile celery up -d
docker compose --profile docs up -d
docker compose --profile prod up -d
```

The production proxy serves the built SPA, Django static/media files and API routes.
Configure domains, upstreams, certificates and routing using the `SMNRP_*` settings
in `.env.TEMPLATE`. Set the appropriate Django debug, host, CSRF, CORS and cookie
settings for the deployment. Production API processes run through Gunicorn.

Celery uses Redis as broker, database-backed results and the database scheduler.
Periodic tasks can be managed through Django admin when the workers are enabled.

## Database maintenance and other commands

The Makefile contains the existing operational shortcuts:

```bash
make up
make down
make logs
make logs-api
make ps
make shell
make dbshell
make db-backup
make db-restore FILE=backup.psql
make migrate
make makemigrations
make lint
make format
make typecheck
make doctor
```

Backups are stored in `api/backups/`. Restore operations overwrite database data;
use the intended backup and environment. `make clean` removes containers and volumes.

## Environment

Use `.env.TEMPLATE` as the complete configuration reference:

- `APP_ENV`, `COMPOSE_PROFILES`: environment and optional services.
- `DJANGO_DEBUG`, `DJANGO_SECRET_KEY`, `DJANGO_ALLOWED_HOSTS`: Django runtime settings.
- `DJANGO_CORS_ALLOWED_ORIGINS`, `DJANGO_CSRF_TRUSTED_ORIGINS`: allowed origins.
- `DJANGO_LOG_LEVEL`, `DJANGO_LOG_SQL`: logging.
- `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`: database.
- `REDIS_HOST`, `REDIS_PORT`: Redis.
- `DJANGO_SU_NAME`, `DJANGO_SU_EMAIL`, `DJANGO_SU_PASSWORD`: initial administrator.
- `UI_PORT`, `DJANGO_PORT` and other `*_PORT` variables: internal container ports.
- `UI_HOST_PORT`, `DJANGO_HOST_PORT` and other `*_HOST_PORT` variables: host-facing ports.
- `SCHEMA_URL` or `NUXT_PUBLIC_API_URL`: backend URL used by the development schema watcher.
- `SMNRP_*`: production reverse-proxy configuration.

### Superuser analysis

Visit `/admin/analysis/` (also linked from the admin home). Only authenticated,
active superusers can view responses or download `/admin/analysis/export.csv`.
The dashboard includes question charts with provider names on hover/focus/tap,
provider response details, and provider/scope filters shared with CSV export.
Counts are per submission. Free-text questions show response coverage; matrix
questions show a chart per row. Null answers mean not asked; empty answers mean
unanswered. CSV keeps one row per submission and escapes spreadsheet formulas.

After editing question wording/options/types, refresh the analysis schema from
the repository root with `python3 scripts/update_analysis_schema.py` and deploy
both frontend and backend. Existing text answers with old labels remain visible
as historical answers. The dashboard uses stored answer text; historical free-text
responses cannot be reconstructed into choices with certainty.
