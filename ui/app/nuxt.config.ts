import { fileURLToPath } from 'node:url'

const appDir = fileURLToPath(new URL('./app', import.meta.url))

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  ssr: false,
  css: ['~/assets/css/main.css'],
  nitro: {
    static: true,
    devProxy: {
      '/api/v1': 'http://api:5000/api/v1',
      // drf-spectacular swagger UI
      '/swagger': 'http://api:5000/api/v1/schema/swagger-ui',
      '/admin': 'http://api:5000/admin',
      '/media': 'http://api:5000/media',
      '/static': 'http://api:5000/static',
    },
  },
  runtimeConfig: {
    public: {
      baseURL: process.env.API_URL || '',
    },
  },
  devtools: { enabled: true },
  modules: ['@nuxt/ui', '@nuxt/eslint', '@pinia/nuxt', '@vueuse/nuxt', '@nuxtjs/i18n', 'nuxt-open-fetch'],
  openFetch: {
    clients: {
      api: {
        // Prefer same-origin proxy in dev; allow override via env in prod
        baseURL: process.env.API_URL ? `${process.env.API_URL}/api/v1` : '/api/v1',
        // Local schema file kept up-to-date by scripts/watch-openapi.mjs
        schema: './openapi/api/openapi.json',
      },
    },
  },
  i18n: {
    restructureDir: '',
    strategy: 'prefix_except_default',
    defaultLocale: 'en',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_redirected',
      redirectOn: 'root',
    },
    locales: [
      {
        code: 'en',
        name: 'English',
        file: 'en.json',
      },
    ],
    langDir: 'app/locales',
  },
  devServer: {
    port: 8077,
  },
  alias: {
    components: `${appDir}/components`,
    stores: `${appDir}/stores`,
    types: `${appDir}/types`,
    utils: `${appDir}/utils`,
    errors: `${appDir}/utils/errors`,
  },
})
