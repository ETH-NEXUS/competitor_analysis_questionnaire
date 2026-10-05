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
| `ui/app/app/stores/questionnaire.ts` | Answers, automatic browser recovery, conditional visibility and submission state. |
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

- Choice indices are stable submitted values. Do not reorder existing choices without
  reviewing how existing answers are interpreted.
- Scope selections A–E determine the relevant solution-specific question groups.
  Three questions in Core identify whether the solution supports external
  integration, manages clinical information, and retains clinical records or
  patient data. Their answers reveal only the relevant detailed questions.
  The CIS third-party ecosystem questions appear for A when the core external-integration
  answer confirms support; the developer and approval follow-ups then depend on the
  third-party integration answer.
- Clinical record export is asked only when the solution retains a longitudinal
  record. Its follow-up appears for Partial export, Vendor-specific migration
  or Other. Hidden answers are excluded from submissions.
- Each selected Other option accepts separate additional entries, except single-choice
  questions, which accept one. These are stored as structured answer data alongside
  the readable question columns. Answers are saved automatically in this browser and
  restored after a refresh, including drafts made with the earlier form version.
- Scope A opens a core CIS platform entry and, when external integration is supported, lets respondents add
  external integrations with the third-party company, product and purpose. Scope C opens a
  specialized function entry and lets respondents add more functions. Each entry
  can be tagged with functional areas and specialties. The documentation-burden
  question appears directly
  below when an entry covers Clinical documentation. Earlier clinical drafts are
  migrated into this structure when restored.
- Each scope C function and scope A external integration also records actual workflow integration with the CIS:
  existing patient, medication and laboratory data reused; write-back; application
  switching; patient-context transfer; and manual steps.
  This is separate from Q1, which asks whether the solution exposes documented APIs.
- The core form asks about Swiss interoperability testing, security certifications and
  related conformity assessments. Certificate names, scope and validity are optional.
- The patient-information retention question still appears when clinical-information
  management is No, because a solution can retain patient files or
  other patient data without managing an ongoing clinical record. The cost question distinguishes
  one-time and recurring charges and can record a charging basis per item.
- On the review screen, each question links to its field and briefly highlights it.
- In analysis, Q1 appears as a best-to-worst access scale. Administrators can
  place Other answers into one of its five ranked categories. Grouped Other counts
  represent answer entries, and free-text questions show the provider with each answer.
- The analysis compares offerings by functional area, specialty and workflow,
  shows which CIS providers integrate third-party products, and lets staff group
  product names and additional category tags without changing submitted answers.
  The Presentation figures tab maps the assessment slide placeholders to distinct
  vendor counts, answered denominators, missing answers and source questions.
  It uses all current-version responses regardless of the detailed-analysis filters.
  Use the Vendor outreach tab to add vendors and tick invitation sent, reminder
  sent and explicit declines. Current-version submissions appear automatically
  when the submitted organization name matches the vendor or an alternate name
  entered in its details. Unmatched submissions are listed for manual linking.
  The initial roster contains 38 vendors in five editable categories, with all
  outreach flags unset.
  Participation figures use vendors marked as invited; no invitation names are
  inferred from the sample presentation.
  A latest-submission-per-provider filter applies to the dashboard and CSV export;
  chart coverage separates answered, unanswered and inapplicable responses.
  Multi-answer questions show one provider row per submission, grouped by scope,
  with feature columns and answer counts. Analysis and CSV show current-version
  submissions; the dashboard Submissions tab lists every version and lets staff
  select and delete rows after confirmation.
- Email, provider, solution name and at least one scope are required. Each response covers one solution; the same solution can have multiple categories. Solution names from older responses remain as submitted. Incomplete
  questionnaire answers are allowed with a warning on the review screen.
- `POST /api/v1/questionnaire-responses/` saves a response and returns its ID and date.
- The review and receipt screens can download a styled PDF copy. `POST
  /api/v1/questionnaire-pdf/` generates it from the current answers without saving
  another response. JSON download remains available for machine-readable export.
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

Nuxt proxies `/api/v1`, `/static` and related paths to the API container. Django
serves the administrator dashboard directly at `http://localhost:4000/admin/analysis/`.
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

Visit `http://localhost:4000/admin/analysis/` (also linked from the admin home). Only authenticated,
active superusers can view responses or download `/admin/analysis/export.csv`.
The analysis page also serves its CSS and JavaScript from protected `/admin/analysis/`
URLs, so the production proxy does not need a separate static-file rule for
this page.
The dashboard includes question charts with provider names on hover/focus/tap,
provider response details, and provider/scope filters shared with CSV export.
Counts are per submission. Free-text questions show response coverage; multiple-answer
questions show provider-by-feature tables. Null answers mean not asked; empty answers mean
unanswered. CSV keeps one row per submission and escapes spreadsheet formulas.
Additional Other answers appear below a divider for each relevant question. A
superuser can assign different wording to the same group name on the analysis page;
single-choice questions show a pie chart with one Other slice for ungrouped answers
and a separate slice for each assigned group. Each submission contributes one vote
to its group. Original wording is
preserved. Older responses with an Other detail can also be grouped when its text
can be identified in the stored readable answer.

After editing question wording/options/types, refresh the analysis schema from
the repository root with `python3 scripts/update_analysis_schema.py` and deploy
both frontend and backend. Existing text answers with old labels remain visible
as historical answers. The dashboard uses stored answer text; historical free-text
responses cannot be reconstructed into choices with certainty.
