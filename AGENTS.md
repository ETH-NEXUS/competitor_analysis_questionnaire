## Instructions for Codex (Coding Agent)

Use these instructions when making changes in this repository.

Codex reads `AGENTS.md` to understand project rules and context—follow these instructions exactly while working.

---

## Context

This is a full-stack web application currently in progress. It runs in Docker containers on the host computer.

Assume all commands, services, and runtime behavior occur inside Docker (e.g., via `docker compose`). Do not assume host-installed services.

---

## Stack

- **Backend:** Django 5.2 + DRF 3.16, PostgreSQL, Redis, Celery
- **Frontend:** Nuxt 4 SPA, Vue 3, TypeScript, Pinia, TanStack Query, Tailwind, @nuxt/ui

---

## File Locations

- **Backend:** `api/app/core/`
  Examples: `models.py`, `serializers.py`, `viewsets.py`, `permissions.py`, `tasks.py`

- **Frontend:** `ui/app/app/`
  Examples: `components/`, `stores/`, `plugins/`, `locales/`

---

## Guardrails

- Do not introduce new architectural patterns, libraries, or frameworks without explicit confirmation.
- Do not create new top-level folders without checking existing structure.
- Do not duplicate existing abstractions/helpers (e.g. HTTP clients, stores, auth logic). Prefer extending existing modules.
- If unsure about a library/framework detail, consult the official documentation before implementing assumptions.
- Do not keep deprecated/legacy code.
- If you remove or replace code, update all usages. Do not preserve backward compatibility unless explicitly required.
- Do not write tests unless explicitly asked to.

---

## File Size Rule

Before editing any file:

- Check its approximate size (line count).
- Keep files under ~400 lines.
- If a change would push a file beyond ~400 lines, refactor into multiple files instead of extending the file.

---

## Documentation Rule

If a new pattern/framework/helper is introduced:

- Document its usage in `AGENTS.md`
- Include:
  - A short description
  - A minimal example

---

## Workflow Requirements (Strict)

### 1. Plan First

Before making any changes, provide a clear implementation plan.

- Break the plan into explicit steps.
- Prioritize the minimal viable and safe solution first.
- Avoid unnecessary complexity.

### 2. Step-by-Step Execution With Review Gates

After presenting the plan, execute it one step at a time.

For each step:

- Perform only the changes required for that step.
- Stop and ask the user to review the changes and commit them.
- Do not proceed until the user confirms:
  - they reviewed the changes, and
  - they committed the changes.

Only after confirmation may you proceed to the next step.

### 3. Temporary Plan Tracking (Multi-Step Work Only)

If the plan contains more than one step:

- Create a temporary `plan.md` file containing the checklist plan.
- Mark completed items with checkboxes as progress is made.
- Keep `plan.md` updated as steps are completed.
- Delete `plan.md` once all steps are complete.

Example:

```md
- [ ] Step 1: ...
- [ ] Step 2: ...
- [ ] Step 3: ...
```

### 4. Minimal Solution First, Improvements Second

You must always:

1. Implement the minimal viable, safe, best-practice solution first.
2. Only after that, propose optional improvements.

Optional improvements must be presented as follow-ups, not mixed into the core implementation.

---

## Project-Specific Patterns

### Backend Permissions

Define permission constants in `api/app/core/permissions.py`:

```python
class Groups:
    EDITOR = "editor"

class Perms:
    VIEW_BOOK = "core.view_book"
```

Use `django-guardian` for object-level permissions:

```python
from guardian.shortcuts import assign_perm, get_objects_for_user
```

---

### Frontend Networking and State

Use `$api` from `nuxt-open-fetch` (do not use raw `axios`/`fetch`):

```typescript
const { $api } = useNuxtApp();
const response = await $api('/api/v1/books/', { method: 'GET' });
```

Use Vue Query for server state (avoid raw `$api` calls in components):

```typescript
const query = useQuery({
  queryKey: ['books'],
  queryFn: async () => (await $api('/api/v1/books/')).results,
});
```

Pinia stores: composition API style with `defineStore(() => {})`.

---

### UI / i18n

- Use @nuxt/ui components (e.g. `UButton`, `UCard`, `UBadge`, `UInput`).
- Use `const { t } = useI18n()` for all user-facing strings.

---

## Auth

Session-based with CSRF (auto-handled by `open-fetch-auth.client.ts`).

Endpoints:

- `/api/v1/auth/login/`
- `/api/v1/auth/logout/`
- `/api/v1/auth/user/`