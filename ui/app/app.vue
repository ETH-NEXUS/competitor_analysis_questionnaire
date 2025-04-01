<script setup lang="ts">
const coreStore = useCoreStore();

const fetchData = async () => {
  const response = await useAPI('books/', { method: 'GET' });
  console.log(response.data._value);
  return response;
};

onMounted(() => {
  coreStore.initDarkMode();
  fetchData();
});
</script>

<template>
  <div>
    <div class="absolute left-0 top-0 flex h-full w-full items-center justify-center gap-8">
      <NuxtRouteAnnouncer />

      <Splitter class="h-full w-full border-none">
        <SplitterPanel class="flex flex-col items-center gap-5 p-5" :size="20" :min-size="18">
          <Fieldset :legend="$t('app.title')" :toggleable="true" class="w-full">
            <p class="m-0">
              {{ $t('app.lorem_ipsum') }}
            </p>
          </Fieldset>
          <div class="flex items-center gap-2">
            <span>{{ coreStore.isDarkMode ? $t('common.dark_mode') : $t('common.light_mode') }}</span>
            <ToggleSwitch v-model="coreStore.isDarkMode" @change="coreStore.toggleDarkMode" />
          </div>
        </SplitterPanel>
        <SplitterPanel class="flex items-center justify-center" :size="80" :min-size="50">
          <MessageBox />
        </SplitterPanel>
      </Splitter>
    </div>
  </div>
</template>
