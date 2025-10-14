// https://nuxt.com/docs/api/configuration/nuxt-config
import Aura from '@primevue/themes/aura';

export default defineNuxtConfig({
    compatibilityDate: '2024-04-03',
    ssr: false,
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
    devtools: {enabled: true},
    modules: [
        '@nuxtjs/tailwindcss',
        '@primevue/nuxt-module',
        '@nuxt/eslint',
        '@nuxt/icon',
        '@pinia/nuxt',
        '@vueuse/nuxt',
        '@nuxtjs/i18n',
        'nuxt-open-fetch',
    ],
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
                file: 'en.json'
            }
        ],
        lazy: true,
        langDir: 'locales/',
    },
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