import { defineConfig } from 'orval'

export default defineConfig({
  api: {
    input: {
      target: './openapi/api/openapi.json',
    },
    output: {
      mode: 'tags',
      target: './app/api/generated',
      schemas: './app/api/generated/model',
      client: 'vue-query',
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
