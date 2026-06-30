# API code generation & auth

Detailed conventions referenced from `CLAUDE.md` and `AGENTS.md`.

## Auth

Session-based with CSRF (auto-handled by `ui/app/app/api/mutator/custom-fetch.ts`).

Endpoints:
- `/api/v1/auth/login/`
- `/api/v1/auth/logout/`
- `/api/v1/auth/user/`

## Orval (API code generation)

Orval generates typed Vue Query composables and raw fetch functions from the OpenAPI schema.

- **Config**: `ui/app/orval.config.ts`
- **Generated output**: `ui/app/app/api/generated/` (gitignored, regenerate with `pnpm generate:api`)
- **Custom fetch mutator**: `ui/app/app/api/mutator/custom-fetch.ts` — handles CSRF tokens and `credentials: 'include'`
- **OpenAPI schema**: `ui/app/openapi/api/openapi.json` (auto-updated by `watch-openapi.mjs`)

Regenerate the API layer after OpenAPI schema changes:

```bash
pnpm generate:api
```
