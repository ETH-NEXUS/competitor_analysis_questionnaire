# Instructions for Claude (Coding Agent)

Use these instructions when making changes in this repository. Follow them exactly. If something is unclear or conflicts with existing code patterns, ask the user before proceeding.

## Context

This is a full-stack web application currently in progress. It runs in Docker containers on the host computer. Assume all commands, services, and runtime behavior occur inside Docker (e.g. via `docker compose`). Do not assume host-installed services.

## Stack

- **Backend**: Django 5.2 + DRF 3.16, PostgreSQL, Redis, Celery
- **Frontend**: Nuxt 4 SPA, Vue 3, TypeScript, Pinia, TanStack Query, Tailwind, @nuxt/ui

## File Locations

**Backend** (`api/app/core/`): models.py, serializers.py, viewsets.py, permissions.py, tasks.py

**Frontend** (`ui/app/app/`): components/, stores/, plugins/, locales/

## Guardrails

- Do not introduce new architectural patterns, libraries, or frameworks without asking the user for confirmation.
- Do not create new top-level folders without checking existing structure.
- Do not duplicate existing abstractions/helpers (e.g. HTTP clients, stores, auth logic). Prefer extending existing modules.
- If unsure about a library/framework detail, consult the official documentation before implementing assumptions.
- Do not keep deprecated/legacy code. If you remove or replace code, update all usages. Do not preserve backward compatibility unless explicitly required.
- Do not write tests unless explicitly asked to.

## File Size Rule

Before editing any file, check its approximate size (line count). Keep files under ~400 lines. If a change pushes a file beyond ~400 lines, refactor into multiple files instead of extending it.

## Documentation Rule

If a new pattern/framework/helper is introduced, document its usage with a short description and a minimal example:

- If it fits an existing `.agent/*.md` file, add it there.
- If it doesn't fit any existing file, create a new `.agent/<topic>.md` file and add a link to it under "Detailed conventions" in **both** `CLAUDE.md` and `AGENTS.md`.

## Workflow Requirements (Strict)

Follow this workflow for every task.

### 1. Plan First

Before making any changes, provide a clear implementation plan. Break it into explicit steps, prioritize the minimal viable and safe solution first, and avoid unnecessary complexity.

### 2. Step-by-Step Execution With Review Gates

After presenting the plan, execute it one step at a time. For each step:

- Perform only the changes required for that step.
- Stop and ask the user to review the changes and commit them.
- Do not proceed until the user confirms they reviewed *and* committed the changes.

### 3. Minimal Solution First, Improvements Second

Implement the minimal viable, safe, best-practice solution first. Only after that, propose optional improvements as follow-ups — never mixed into the core implementation.

## Output Expectations

- Prefer small, safe, incremental changes.
- Do not rewrite unrelated code or perform cleanup refactors unless explicitly requested.
- Match existing style and conventions in the codebase.
- Avoid speculative changes. If uncertain, stop and ask.

## Detailed conventions

Project-specific patterns and reference material live in `.agent/`. Read the relevant file when working on that area:

- [Project-specific patterns](.agent/patterns.md) — permissions, frontend data fetching, Pinia, UI/i18n
- [API code generation & auth](.agent/api-and-auth.md) — session/CSRF auth, Orval codegen
