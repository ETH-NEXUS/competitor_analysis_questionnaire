## Project context

This repository is a full-stack web application currently in progress. It runs in Docker containers on the host computer.

## Tech stack

- Backend: Django 5.2 + DRF 3.16, PostgreSQL, Redis, Celery
- Frontend: Nuxt 4 SPA, Vue 3, TypeScript, Pinia, TanStack Query, Tailwind, @nuxt/ui

## Key locations

- Backend: `api/app/core/` (e.g. `models.py`, `serializers.py`, `viewsets.py`, `permissions.py`, `tasks.py`)
- Frontend: `ui/app/app/` (e.g. `components/`, `stores/`, `plugins/`, `locales/`)

## Guardrails

- Do not introduce new architectural patterns, libraries, or frameworks without asking for confirmation.
- If a new pattern/framework/helper is introduced, document its usage in `CLAUDE.md` with a short description and a minimal example.
- Before editing any file, check its size (roughly: line count). Keep it under ~400 lines. If your change would push it beyond that, refactor it into multiple files.
- If unsure about a library/framework detail, consult the official docs.
- Do not create new top-level folders without checking existing structure.
- Do not duplicate existing abstractions/helpers (e.g. HTTP clients, stores, auth logic). Prefer extending existing modules.

## Change policy

- Do not keep deprecated/legacy code. If you remove/replace code, update all usages (do not preserve backward compatibility).

## Project-specific patterns

### Backend permissions

- Define permission/group constants in `api/app/core/permissions.py`.

```python
class Groups:
    EDITOR = "editor"

class Perms:
    VIEW_BOOK = "core.view_book"
```

- Use django-guardian for object-level permissions.

```python
from guardian.shortcuts import assign_perm, get_objects_for_user
```

### Frontend API calls

- Use `$api` from nuxt-open-fetch (not axios/fetch).

```typescript
const { $api } = useNuxtApp();
const response = await $api('/api/v1/books/', { method: 'GET' });
```

- For server state, use Vue Query (avoid raw `$api` calls in components).

```typescript
const query = useQuery({
  queryKey: ['books'],
  queryFn: async () => (await $api('/api/v1/books/')).results,
});
```

- Pinia stores: composition API style with `defineStore(() => {})`.

### UI/i18n

- Use @nuxt/ui components (e.g. `UButton`, `UCard`, `UBadge`, `UInput`).
- Use `const { t } = useI18n()` for all user-facing strings.

## Auth

Session-based with CSRF (auto-handled by `open-fetch-auth.client.ts`).

Endpoints:
- `/api/v1/auth/login/`
- `/api/v1/auth/logout/`
- `/api/v1/auth/user/`
