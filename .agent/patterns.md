# Project-specific patterns

Detailed conventions referenced from `CLAUDE.md` and `AGENTS.md`.

## Backend permissions

Define constants in `api/app/core/permissions.py`:

```python
class Groups:
    EDITOR = "editor"

class Perms:
    VIEW_BOOK = "core.view_book"
```

Use django-guardian for object-level permissions:

```python
from guardian.shortcuts import assign_perm, get_objects_for_user
```

## Frontend data fetching

Use Orval-generated functions (not raw `fetch`/`axios`). The generated composables wrap TanStack (Vue) Query, so server state is cached and refetched automatically — do not roll your own `useQuery` against raw fetch.

```typescript
// In components: use generated Vue Query composables
import { useBooksList } from '~/app/api/generated/books/books'
const { data, isFetching, refetch } = useBooksList()

// In stores: use generated raw functions for imperative calls
import { authLoginCreate } from '~/app/api/generated/auth/auth'
await authLoginCreate({ username, password })
```

Pinia stores: composition API style with `defineStore(() => {})`.

```typescript
export const useExampleStore = defineStore('example', () => {
  return {};
});
```

## UI / i18n

- Use @nuxt/ui components: `UButton`, `UCard`, `UBadge`, `UInput`, etc.
- Use `const { t } = useI18n()` for all user-facing strings.
