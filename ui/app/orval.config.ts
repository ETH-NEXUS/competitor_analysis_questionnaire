import { defineConfig } from 'orval'

export default defineConfig({
  api: {
    input: {
      target: './openapi/api/openapi.json',
      filters: { tags: ['questionnaire-responses'], mode: 'include' },
    },
    output: {
      mode: 'tags',
      target: './app/api/generated',
      schemas: './app/api/generated/model',
      client: 'fetch',
      clean: true,
      httpClient: 'fetch',
      override: {
        mutator: {
          path: './app/api/mutator/custom-fetch.ts',
          name: 'customFetch',
        },
        fetch: {
          includeHttpResponseReturnType: false,
        },
      },
    },
  },
})
