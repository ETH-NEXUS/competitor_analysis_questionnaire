export default defineNuxtPlugin((nuxtApp) => {
  const csrfToken = useState<string | null>('csrfToken', () => null)
  const authErrorStatus = useState<number | null>('authErrorStatus', () => null)

  const runtimeConfig = useRuntimeConfig()
  const apiBaseURL = runtimeConfig.public?.openFetch?.api?.baseURL ?? '/api/v1'

  const csrfUrl = `${String(apiBaseURL).replace(/\/$/, '')}/auth/csrf/`

  let csrfPromise: Promise<string> | null = null

  const ensureCsrfToken = async (): Promise<string> => {
    if (csrfToken.value) return csrfToken.value

    if (!csrfPromise) {
      csrfPromise = $fetch<{ csrfToken: string }>(csrfUrl, {
        method: 'GET',
        credentials: 'include',
      })
        .then((res) => {
          csrfToken.value = res.csrfToken
          return res.csrfToken
        })
        .finally(() => {
          csrfPromise = null
        })
    }

    return csrfPromise
  }

  const isUnsafeMethod = (method?: string) => {
    const m = (method || 'GET').toUpperCase()
    return m === 'POST' || m === 'PUT' || m === 'PATCH' || m === 'DELETE'
  }

  nuxtApp.hooks.hook('openFetch:onRequest', async (ctx) => {
    ctx.options.credentials = 'include'

    if (!ctx.options.headers || !(ctx.options.headers instanceof Headers)) {
      ctx.options.headers = new Headers(ctx.options.headers as HeadersInit)
    }

    if (!isUnsafeMethod(ctx.options.method)) return

    const token = await ensureCsrfToken()
    if (!ctx.options.headers.has('X-CSRFToken')) {
      ctx.options.headers.set('X-CSRFToken', token)
    }
  })

  nuxtApp.hooks.hook('openFetch:onResponseError', (ctx) => {
    const status = ctx.response?.status

    if (status === 401 || status === 403) {
      authErrorStatus.value = status
    }

    if (status === 403 && isUnsafeMethod(ctx.options.method)) {
      csrfToken.value = null
    }
  })
})
