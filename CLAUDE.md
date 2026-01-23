## Context

This is a full-stack web application that is currently in the progress of being developed.
It is currently running in docker containers on the hosts computer.
You do not need to write any tests. However you can test your code by interacting with the running containers.
Do not keep any deprecated or legacy code, if you decide to remove code, make sure to update all usages.

## Stack

- **Backend**: Django 5.2 + DRF 3.16, PostgreSQL, Redis, Celery
- **Frontend**: Nuxt 4 SPA, Vue 3, TypeScript, Pinia, TanStack Query, Tailwind, @nuxt/ui

## File Locations

**Backend** (`api/app/core/`): models.py, serializers.py, viewsets.py, permissions.py, tasks.py

**Frontend** (`ui/app/app/`): components/, stores/, plugins/, locales/

 ## Guardrails (Important)

- Do not introduce new architectural patterns, libraries, or frameworks without asking the user for confirmation.
- If we do introduce a new pattern, framework or helper/abstraction, document its usage in the CLAUDE.md file with a short description and example.
- Before editing any file, always check its current size (roughly: line count). Keep it under ~400 lines. If your change would push it beyond that, refactor it into multiple files.
- If you are unsure about a library/framework detail, check the official docs on the internet (Django, DRF, Nuxt, Vue, Pinia, Tailwind, etc.).
- Do not create new top-level folders without checking existing structure.
- Do not duplicate existing abstractions or helpers (e.g. HTTP clients, stores, auth logic).
- Prefer extending existing modules over creating parallel ones.

## Project-Specific Patterns

**Permissions** - define constants in `permissions.py`:
```python
class Groups:
    EDITOR = "editor"

class Perms:
    VIEW_BOOK = "core.view_book"
```

**Object-level permissions** - use django-guardian:
```python
from guardian.shortcuts import assign_perm, get_objects_for_user
```

**API calls** - use `$api` from nuxt-open-fetch (not axios/fetch):
```typescript
const { $api } = useNuxtApp();
const response = await $api('/api/v1/books/', { method: 'GET' });
```

**Server state** - use Vue Query (not raw $api in components):
```typescript
const query = useQuery({
  queryKey: ['books'],
  queryFn: async () => (await $api('/api/v1/books/')).results,
});
```

**Pinia stores** - composition API style with `defineStore(() => {})`

**UI** - use @nuxt/ui components: `UButton`, `UCard`, `UBadge`, `UInput`, etc.

**i18n** - use `const { t } = useI18n()` for all user-facing strings

## Auth

Session-based with CSRF (auto-handled by `open-fetch-auth.client.ts`).
Endpoints: `/api/v1/auth/login/`, `/api/v1/auth/logout/`, `/api/v1/auth/user/`
