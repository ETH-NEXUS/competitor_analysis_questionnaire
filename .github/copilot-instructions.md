## Instructions for GitHub Copilot (Coding Agent)

Use these instructions when making changes in this repository.

You must follow these rules exactly. If something is unclear or conflicts with existing code patterns, ask the user before proceeding.

---

## Context

This is a full-stack web application currently in progress. It runs in Docker containers on the host computer.

All development and execution should assume the application is running inside Docker.

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

## Hard Constraints (Must Follow)

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
- If a change pushes a file beyond ~400 lines, refactor into multiple files instead of extending the file.

---

## Documentation Rule

If a new pattern/framework/helper is introduced:

- Document its usage in `AGENTS.md`
- Include:
  - A short description
  - A minimal example

---

## Workflow Requirements (Strict)

You must follow this workflow for every task.

### Step 1: Plan First

Before making any changes, provide an implementation plan.

The plan must:

- Be broken into explicit steps
- Prioritize the minimal viable and safe solution first
- Avoid unnecessary complexity

### Step 2: Execute One Step at a Time (With Review Gates)

After presenting the plan, execute it one step at a time.

For each step:

- Perform only the changes required for that step.
- Stop and ask the user to review the changes and commit them.
- Do not proceed until the user confirms:
  - they reviewed the changes
  - they committed the changes

Only after the commit is confirmed may you proceed to the next step.

### Step 3: Minimal Solution First, Improvements Second

You must always:

1. Implement the minimal viable, safe, best-practice solution first.
2. Only after that, propose optional improvements.

Optional improvements must be presented as follow-up suggestions, not mixed into the core implementation.

---

## Output Expectations (Copilot-Specific)

- Prefer small, safe, incremental changes.
- Do not rewrite unrelated code.
- Do not perform cleanup refactors unless explicitly requested.
- Match existing style and conventions in the codebase.
- Avoid speculative changes. If uncertain, stop and ask.

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

Pinia stores must use composition API style:

```typescript
export const useExampleStore = defineStore('example', () => {
  return {};
});
```

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