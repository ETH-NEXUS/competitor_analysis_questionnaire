## Stack

- **Backend**: Django 5.2 + DRF 3.16, PostgreSQL, Redis, Celery
- **Frontend**: Nuxt 4 SPA, Vue 3, TypeScript, Pinia, TanStack Query, Tailwind, @nuxt/ui

## File Locations

**Backend** (`api/app/core/`): models.py, serializers.py, viewsets.py, permissions.py, tasks.py

**Frontend** (`ui/app/app/`): components/, stores/, plugins/, locales/

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
