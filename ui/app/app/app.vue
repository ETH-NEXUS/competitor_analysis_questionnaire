<script setup lang="ts">
const coreStore = useCoreStore()
const authStore = useAuthStore()

const isDark = computed({
  get: () => coreStore.isDark,
  set: (value) => coreStore.toggleDarkMode(value),
})

const loginOpen = ref(false)
const loginUsername = ref('')
const loginPassword = ref('')

const loginDisabled = computed(() => authStore.isLoading || !loginUsername.value || !loginPassword.value)

const openLogin = () => {
  authStore.clearError()
  loginOpen.value = true
}

const onLogin = async () => {
  authStore.clearError()
  const ok = await authStore.login(loginUsername.value, loginPassword.value)
  if (ok) {
    loginOpen.value = false
    loginPassword.value = ''
  }
}

const userMenuItems = computed(() => [
  {
    type: 'label',
    label: authStore.user?.username ? `Signed in as ${authStore.user.username}` : 'Signed in',
  },
  {
    label: 'Refresh user',
    icon: 'i-heroicons-arrow-path',
    onSelect: () => authStore.loadUser(),
  },
  {
    type: 'separator',
  },
  {
    label: 'Logout',
    icon: 'i-heroicons-arrow-right-on-rectangle',
    color: 'red',
    onSelect: () => authStore.logout(),
  },
])

onMounted(async () => {
  coreStore.initColorMode()

  await authStore.loadUser()
})
</script>

<template>
  <UApp>
    <NuxtRouteAnnouncer />
    <UDashboardGroup storage="cookie" storage-key="app-dashboard" class="flex-col">
      <UDashboardNavbar :title="$t('app.title')" :toggle="false">
        <template #right>
          <div class="flex items-center gap-3">
            <div class="flex items-center gap-2">
              <span class="text-xs">{{ isDark ? $t('common.dark_mode') : $t('common.light_mode') }}</span>
              <USwitch v-model="isDark" />
            </div>

            <UDropdownMenu v-if="authStore.isAuthenticated" :items="userMenuItems">
              <UButton size="sm" variant="ghost" icon="i-heroicons-user-circle">
                {{ authStore.user?.username || 'Account' }}
              </UButton>
            </UDropdownMenu>

            <UButton v-else size="sm" variant="soft" @click="openLogin">Login</UButton>
          </div>
        </template>
      </UDashboardNavbar>

      <UModal v-model:open="loginOpen" title="Login">
        <template #body>
          <form class="flex flex-col gap-3" @submit.prevent="onLogin">
            <UInput v-model="loginUsername" placeholder="Username" autocomplete="username" />
            <UInput v-model="loginPassword" type="password" placeholder="Password" autocomplete="current-password" />

            <div class="flex items-center gap-2">
              <UButton type="submit" size="sm" variant="soft" :loading="authStore.isLoading" :disabled="loginDisabled">
                Login
              </UButton>
              <UButton type="button" size="sm" variant="ghost" @click="loginOpen = false">Cancel</UButton>
            </div>

            <UBadge v-if="authStore.error" color="red" variant="soft">{{ authStore.error }}</UBadge>
          </form>
        </template>
      </UModal>

      <div class="flex min-h-0 flex-1 overflow-hidden">
        <UDashboardPanel
          id="left-panel"
          class="hidden !min-h-0 lg:flex"
          resizable
          :min-size="15"
          :default-size="25"
          :max-size="40"
        >
          <template #body>
            <div class="flex h-full min-h-0 flex-col items-center gap-5 overflow-y-auto">
              <UCard class="w-full">
                <template #header>
                  <h3 class="text-base font-semibold">{{ $t('app.title') }}</h3>
                </template>
                <p class="m-0">
                  {{ $t('app.lorem_ipsum') }}
                </p>
              </UCard>

              <LibraryExamples class="w-full" />
            </div>
          </template>
        </UDashboardPanel>

        <UDashboardPanel id="right-panel" class="flex !min-h-0">
          <template #body>
            <div class="flex w-full flex-col items-center gap-4">
              <MessageBox class="w-full lg:w-[80%]" />
            </div>
          </template>
        </UDashboardPanel>
      </div>
    </UDashboardGroup>
  </UApp>
</template>
