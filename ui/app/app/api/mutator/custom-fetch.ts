let csrfToken: string | null = null
let csrfPromise: Promise<string> | null = null

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

const fetchCsrfToken = async (): Promise<string> => {
  if (!csrfPromise) {
    csrfPromise = fetch('/api/v1/auth/csrf/', { credentials: 'include' })
      .then((res) => res.json())
      .then((data: { csrfToken: string }) => {
        csrfToken = data.csrfToken
        return csrfToken
      })
      .finally(() => {
        csrfPromise = null
      })
  }
  return csrfPromise
}

export const customFetch = async <T>(url: string, options: RequestInit): Promise<T> => {
  const method = (options.method ?? 'GET').toUpperCase()
  const headers = new Headers(options.headers)

  if (UNSAFE_METHODS.has(method)) {
    if (!csrfToken) await fetchCsrfToken()
    headers.set('X-CSRFToken', csrfToken!)
  }

  const response = await fetch(url, { ...options, credentials: 'include', headers })

  // Auto-retry once on CSRF failure (e.g. after login/logout changed the session)
  if (response.status === 403 && UNSAFE_METHODS.has(method) && csrfToken) {
    csrfToken = null
    return customFetch<T>(url, options)
  }

  if (!response.ok) throw response
  if (response.status === 204) return undefined as T
  return response.json()
}

export default customFetch
