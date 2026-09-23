# Questionnaire frontend

This is an English-only Nuxt SPA. Respondents do not sign in. Staff sign in to the
separate Django admin at `/admin/` to view and filter responses.

## Working on the app

Run commands inside Docker, from the repository root:

```bash
docker compose exec ui pnpm generate:api
docker compose exec ui pnpm run build
docker compose exec ui pnpm run lint
```

`scripts/watch-openapi.mjs` refreshes the OpenAPI schema during development.
`orval.config.ts` generates only operations tagged `questionnaire-responses`,
using the fetch client. Its `clean` option removes obsolete generated files.
The public form calls `/api/v1/questionnaire-responses/` through Nuxt's dev proxy;
`app/api/mutator/custom-fetch.ts` handles cookies, CSRF and HTTP errors.

Question wording and choice lists are ordinary English content in
`app/utils/questionnaire-core.json` and `questionnaire-specific.json`.
`questionnaire.ts` defines section ordering, scope rules, answer formatting and
the conditional export follow-up. UI labels are written directly in components.
There is no translation module, language routing or locale lookup.

## Generated files that remain

Generated files are TypeScript API contracts, not database models or stored data.
They are regenerated from the backend's OpenAPI schema; do not edit them manually.
Database models live in `api/app/core/models.py`.

| File | Purpose | Needed? |
| --- | --- | --- |
| `generated/questionnaire-responses.ts` | Sends the questionnaire POST request and returns the receipt. | Yes |
| `model/questionnaireResponse.ts` | Submission fields and response receipt fields. | Yes |
| `model/questionnaireResponseAnswers.ts` | Dictionary of question IDs to answer objects. | Yes |
| `model/questionnaireAnswer.ts` | One answer's selections, text, details, matrix rows and readable text. | Yes |
| `model/questionnaireAnswerDetails.ts` | Dictionary of extra details, such as an Other response. | Yes |
| `model/questionnaireAnswerRows.ts` | Nested dictionaries for costs and capability matrices. | Yes |
| `model/index.ts` | Re-exports those types so the generated client can import them. | Yes |

## Removed frontend demo files

`AuthPanel.vue` was a sample login card with signed-in/out badges, credentials,
session checks and logout controls. It was not mounted by `app.vue`, so its header
was not visible anywhere in the questionnaire. Its only caller of `stores/auth.ts`
was removed with it. The store held the current user, login status and auth errors.
The unused theme store, markdown demo helper and their dependencies were also removed.

The following generated clients were not used by the questionnaire:

| Client | Purpose |
| --- | --- |
| `access.ts` | Demo endpoints for public, authenticated, admin, editor and per-book permission checks. |
| `auth.ts` | REST login/logout, current-user details, password changes and password resets. |
| `authors.ts` | Author CRUD demo requests. |
| `books.ts` | Book CRUD demo requests. |
| `schema.ts` | Fetching the API's own OpenAPI documentation. |

The backend endpoints still exist; filtering code generation does not delete
backend data, remove Django accounts or disable the admin login.

## Removed generated model files, individually

These types were dependencies of the unused clients above. None is needed by the
questionnaire frontend, so the generator no longer creates them.

| File | What it described |
| --- | --- |
| `accessMessage.ts` | A demo permission-check response: a message and optional username. |
| `accessEditorBooksListParams.ts` | Query parameters for the editor's accessible-books endpoint. |
| `login.ts` | Login credentials sent to the REST authentication endpoint. |
| `sessionLoginToken.ts` | The login response's token-shaped schema retained by the session-auth setup. |
| `restAuthDetail.ts` | A generic authentication response containing a detail message. |
| `userDetails.ts` | Current-user account information. |
| `patchedUserDetails.ts` | Optional user fields for a partial account update. |
| `passwordChange.ts` | Password-change request fields. |
| `passwordReset.ts` | Password-reset request fields, including the email address. |
| `passwordResetConfirm.ts` | Reset confirmation, token and new-password fields. |
| `book.ts` | A book-demo record. |
| `patchedBook.ts` | Optional book fields for a partial update. |
| `booksListParams.ts` | Query parameters for listing books. |
| `paginatedBookList.ts` | A page of books with pagination metadata. |
| `nEXUSAuthor.ts` | An author-demo record. The unusual name came from the backend serializer name. |
| `patchedNEXUSAuthor.ts` | Optional author fields for a partial update. |
| `authorsListParams.ts` | Query parameters for listing authors. |
| `paginatedNEXUSAuthorList.ts` | A page of authors with pagination metadata. |
| `schemaRetrieveParams.ts` | Query parameters for fetching the OpenAPI document. |
| `schemaRetrieveFormat.ts` | Allowed OpenAPI document formats. |
| `schemaRetrieveLang.ts` | Language choices exposed by the API documentation endpoint. |
| `schemaRetrieve200One.ts` | One generated alternative of the OpenAPI document's response schema. |
| `schemaRetrieve200Two.ts` | A second generated alternative of that response schema. |
| `schemaRetrieve200Three.ts` | A third generated alternative of that response schema. |
| `schemaRetrieve200Four.ts` | A fourth generated alternative of that response schema. |
