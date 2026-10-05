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

const fetchResponse = async (url: string, options: RequestInit, csrfRetried = false): Promise<Response> => {
  const method = (options.method ?? 'GET').toUpperCase()
  const headers = new Headers(options.headers)

  if (UNSAFE_METHODS.has(method)) {
    if (!csrfToken) await fetchCsrfToken()
    headers.set('X-CSRFToken', csrfToken!)
  }

  const response = await fetch(url, { ...options, credentials: 'include', headers })

  // Auto-retry once on CSRF failure (e.g. after login/logout changed the session)
  if (response.status === 403 && UNSAFE_METHODS.has(method) && csrfToken && !csrfRetried) {
    csrfToken = null
    return fetchResponse(url, options, true)
  }

  if (!response.ok) throw response
  return response
}

export const customFetch = async <T>(url: string, options: RequestInit): Promise<T> => {
  const response = await fetchResponse(url, options)
  if (response.status === 204) return undefined as T
  return response.json()
}

export const fetchQuestionnairePdf = async (response: unknown): Promise<Blob> => {
  const result = await fetchResponse('/api/v1/questionnaire-pdf/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(response),
  })
  return result.blob()
}

export default customFetch
