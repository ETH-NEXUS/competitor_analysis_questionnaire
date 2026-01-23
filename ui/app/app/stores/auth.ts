type AuthUser = {
  pk?: number
  id?: number
  username?: string
  email?: string
  first_name?: string
  last_name?: string
  [key: string]: unknown
}

export const useAuthStore = defineStore('authStore', () => {
  const user = ref<AuthUser | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const isAuthenticated = computed(() => user.value != null)

  const authErrorStatus = useState<number | null>('authErrorStatus', () => null)
  const csrfToken = useState<string | null>('csrfToken', () => null)

  const { $api } = useNuxtApp()
  const api = $api as unknown as (url: string, options?: Record<string, any>) => Promise<any>

  const clearError = () => {
    error.value = null
  }

  const loadUser = async () => {
    isLoading.value = true
    error.value = null

    try {
      const data = await api('/api/v1/auth/user/', { method: 'GET' })
      user.value = data as AuthUser
      authErrorStatus.value = null
      return user.value
    } catch {
      user.value = null
      return null
    } finally {
      isLoading.value = false
    }
  }

  const login = async (username: string, password: string) => {
    isLoading.value = true
    error.value = null

    try {
      await api('/api/v1/auth/login/', {
        method: 'POST',
        body: {
          username,
          password,
        },
      })

      csrfToken.value = null
      authErrorStatus.value = null

      await loadUser()
      return true
    } catch (err) {
      user.value = null

      if (err instanceof Error) {
        error.value = err.message
      } else {
        error.value = 'Login failed'
      }

      return false
    } finally {
      isLoading.value = false
    }
  }

  const logout = async () => {
    isLoading.value = true
    error.value = null

    try {
      await api('/api/v1/auth/logout/', {
        method: 'POST',
      })
    } finally {
      user.value = null
      csrfToken.value = null
      authErrorStatus.value = null
      isLoading.value = false
    }
  }

  watch(authErrorStatus, (status) => {
    if (status === 401 || status === 403) {
      user.value = null
    }
  })

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    clearError,
    loadUser,
    login,
    logout,
  }
})
