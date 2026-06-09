import { authUserRetrieve, authLoginCreate, authLogoutCreate } from '~/app/api/generated/auth'
import type { UserDetails } from '~/app/api/generated/model'

export const useAuthStore = defineStore('authStore', () => {
  const user = ref<UserDetails | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const isAuthenticated = computed(() => user.value != null)

  const clearError = () => {
    error.value = null
  }

  const loadUser = async () => {
    isLoading.value = true
    error.value = null

    try {
      user.value = await authUserRetrieve()
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
      await authLoginCreate({ username, password })
      await loadUser()
      return true
    } catch (err) {
      user.value = null
      error.value = err instanceof Error ? err.message : 'Login failed'
      return false
    } finally {
      isLoading.value = false
    }
  }

  const logout = async () => {
    isLoading.value = true

    try {
      await authLogoutCreate()
    } finally {
      user.value = null
      isLoading.value = false
    }
  }

  return { user, isAuthenticated, isLoading, error, clearError, loadUser, login, logout }
})
