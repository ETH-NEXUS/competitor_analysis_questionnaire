<script setup lang="ts">
import type { ApiResponse } from '#open-fetch';

const coreStore = useCoreStore();

const isDark = computed({
  get: () => coreStore.isDark,
  set: (value) => coreStore.toggleDarkMode(value),
});

const books = ref<ApiResponse<'books_list'>['results']>([]);
const { $api } = useNuxtApp();

onMounted(async () => {
  coreStore.initColorMode();

  try {
    const response = await $api('/api/v1/books/', { method: 'GET' });
    books.value = response?.results || [];
    console.log(books.value);
  } catch (error) {
    console.error(error);
  }
});
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
            <UCard class="w-full">
              <template #header>
                <h3 class="text-base font-semibold">{{ $t('app.title') }}</h3>
              </template>
              <p class="m-0">
                {{ $t('app.lorem_ipsum') }}
              </p>
            </UCard>
            <div class="flex items-center gap-2">
              <span>{{ isDark ? $t('common.dark_mode') : $t('common.light_mode') }}</span>
              <USwitch v-model="isDark" />
            </div>
          </div>
        </template>
      </UDashboardPanel>

      <UDashboardPanel id="right-panel" class="flex">
        <template #body>
          <div class="flex h-full flex-col items-center justify-center gap-4 p-2 lg:p-4">
            <div class="flex w-full items-center justify-between lg:hidden">
              <h3 class="text-base font-semibold">{{ $t('app.title') }}</h3>
              <div class="flex items-center gap-2">
                <span class="text-xs">{{ isDark ? $t('common.dark_mode') : $t('common.light_mode') }}</span>
                <USwitch v-model="isDark" />
              </div>
            </div>

            <MessageBox class="w-full lg:w-[80%]" />
          </div>
        </template>
      </UDashboardPanel>
    </UDashboardGroup>
  </UApp>
</template>
