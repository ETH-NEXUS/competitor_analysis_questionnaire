<script setup lang="ts">
import type { ApiResponse } from '#open-fetch'

const coreStore = useCoreStore()

const isDark = computed({
  get: () => coreStore.isDark,
  set: (value) => coreStore.toggleDarkMode(value),
})

const books = ref<ApiResponse<'books_list'>['results']>([])
const { $api } = useNuxtApp()

onMounted(async () => {
  coreStore.initColorMode()

  try {
    const response = await $api('/api/v1/books/', { method: 'GET' })
    books.value = response?.results || []
    console.log(books.value)
  } catch (error) {
    console.error(error)
  }
})
</script>

<template>
  <UApp>
    <NuxtRouteAnnouncer />
    <UDashboardGroup storage="cookie" storage-key="app-dashboard">
      <UDashboardPanel
        id="left-panel"
        class="hidden lg:flex"
        resizable
        :min-size="15"
        :default-size="25"
        :max-size="40"
      >
        <template #body>
          <div class="flex flex-col items-center gap-5">
            <div class="flex w-full items-center justify-between gap-2">
              <h3 class="text-base font-semibold">{{ $t('app.title') }}</h3>
              <UButton
                :icon="isDark ? 'i-lucide-moon' : 'i-lucide-sun'"
                variant="ghost"
                color="neutral"
                square
                class="cursor-pointer"
                :ui="{ base: 'rounded-none' }"
                aria-label="Toggle theme"
                @click="isDark = !isDark"
              />
            </div>
          </div>
        </template>
      </UDashboardPanel>

      <UDashboardPanel id="right-panel" class="flex">
        <template #body>
          <div class="flex h-full flex-col items-center justify-center gap-4 p-2 lg:p-4">
            <div class="flex w-full items-center justify-between lg:hidden">
              <div class="flex w-full items-center justify-between gap-2">
                <h3 class="text-base font-semibold">{{ $t('app.title') }}</h3>
                <UButton
                  :icon="isDark ? 'i-lucide-moon' : 'i-lucide-sun'"
                  variant="ghost"
                  color="neutral"
                  square
                  class="cursor-pointer"
                  :ui="{ base: 'rounded-none' }"
                  aria-label="Toggle theme"
                  @click="isDark = !isDark"
                />
              </div>
            </div>

            <MessageBox class="w-full lg:w-[80%]" />

            <LibraryExamples class="w-full lg:w-[80%]" />
          </div>
        </template>
      </UDashboardPanel>
    </UDashboardGroup>
  </UApp>
</template>
