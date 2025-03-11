<script setup lang="ts">
const coreStore = useCoreStore();
const isDarkMode = useCookie('darkMode', { default: () => 'false' });

await callOnce(async () => {
  // set favicon to match dark mode of the system
  // this is independent of the dark mode of the application
  const isSystemDark = usePreferredDark();
  const favicon = computed(() => (isSystemDark.value ? '/favicon/nexus_logo_dark_mode.png' : '/favicon/nexus_logo.png'));
  useFavicon(favicon, {
    rel: 'icon',
  });

  coreStore.setDarkMode(isDarkMode.value === 'true');
});

const updateDarkMode = () => {
  isDarkMode.value = coreStore.isDarkMode ? 'true' : 'false';
  coreStore.setDarkMode(coreStore.isDarkMode);
};

const fetchData = async () => {
  const response = await useAPI('books/', { method: 'GET' });
  console.log(response.data._value);
  return response;
};

onMounted(() => {
  fetchData();
});
</script>

<template>
  <div>
    <div class="absolute left-0 top-0 flex h-full w-full items-center justify-center gap-8">
      <NuxtRouteAnnouncer />

      <Splitter class="h-full w-full border-none">
        <SplitterPanel class="flex flex-col items-center gap-5 p-5" :size="20" :min-size="18">
          <Fieldset legend="My cool title" :toggleable="true" class="w-full">
            <p class="m-0">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et
              dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex
              ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu
              fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt
              mollit anim id est laborum.
            </p>
          </Fieldset>
          <ToggleSwitch v-model="coreStore.isDarkMode" @change="updateDarkMode" />
        </SplitterPanel>
        <SplitterPanel class="flex items-center justify-center" :size="80" :min-size="50">
          <MessageBox />
        </SplitterPanel>
      </Splitter>
    </div>
  </div>
</template>
