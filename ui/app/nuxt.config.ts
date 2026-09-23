import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

const appDir = fileURLToPath(new URL('./app', import.meta.url))

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  ssr: false,
  css: ['./app/assets/css/main.css'],
  nitro: {
    static: true,
    devProxy: {
      '/api/v1': `http://api:${process.env.DJANGO_PORT || '5000'}/api/v1`,
      '/swagger': `http://api:${process.env.DJANGO_PORT || '5000'}/api/v1/schema/swagger-ui`,
      '/admin': `http://api:${process.env.DJANGO_PORT || '5000'}/admin`,
      '/media': `http://api:${process.env.DJANGO_PORT || '5000'}/media`,
      '/static': `http://api:${process.env.DJANGO_PORT || '5000'}/static`,
    },
  },
  runtimeConfig: {
    public: {
      baseURL: process.env.NUXT_PUBLIC_API_URL || '',
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
  devtools: { enabled: true },
  modules: ['@nuxt/ui', '@nuxt/eslint', '@pinia/nuxt'],
  devServer: {
    host: '0.0.0.0',
    port: parseInt(process.env.UI_PORT || '8077', 10),
  },
  alias: {
    components: `${appDir}/components`,
    stores: `${appDir}/stores`,
    types: `${appDir}/types`,
    utils: `${appDir}/utils`,
    api: `${appDir}/api`,
    assets: `${appDir}/assets`,
  },
})
