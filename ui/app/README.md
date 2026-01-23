# UI (Nuxt)

For the recommended Docker-based workflow, follow the root `README.md`.

## Local development (without Docker)

From `ui/app`:

```bash
pnpm install
pnpm dev
```

The dev script also runs `scripts/watch-openapi.mjs` to keep `openapi/api/openapi.json` up to date.

## Environment

- `NUXT_PUBLIC_API_URL`:
  - if set, the UI will talk to `${NUXT_PUBLIC_API_URL}/api/v1`
  - if empty, it will default to `/api/v1` (intended for the Docker dev proxy)
