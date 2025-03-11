// https://nuxt.com/docs/api/configuration/nuxt-config
import Aura from '@primevue/themes/aura';

export default defineNuxtConfig({
  compatibilityDate: '2024-04-03',
  ssr: false,
  nitro: {
    static: true,
    devProxy: {
      '/api/v1': 'http://api:5000/api/v1',
      '/swagger': 'http://api:5000/api/v1/swagger',
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
  modules: [
    '@nuxtjs/tailwindcss',
    '@primevue/nuxt-module',
    '@nuxt/eslint',
    '@nuxt/icon',
    '@pinia/nuxt',
    '@vueuse/nuxt',
  ],
  devServer: {
    port: 8077,
  },
  tailwindcss: {
    // Options
  },
  primevue: {
    options: {
      theme: {
        preset: Aura,
        options: {
          darkModeSelector: '.dark',
        },
      },
    },
  },
  alias: {
    pinia: '/node_modules/@pinia/nuxt/node_modules/pinia/dist/pinia.mjs',
  },
});