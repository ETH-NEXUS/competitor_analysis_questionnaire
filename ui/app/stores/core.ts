export const useCoreStore = defineStore('coreStore', {
  state: () => ({
    isDarkMode: false,
  }),
  actions: {
    initDarkMode() {
      if (import.meta.client) {
        const savedTheme = localStorage.getItem('darkMode');
        const isDarkMode = savedTheme === 'true';

        this.isDarkMode = isDarkMode;
        document.documentElement.classList.toggle('dark', isDarkMode);

        // set favicon to match dark mode of the system (browser UI)
        // this is independent of the dark mode of the application
        const isSystemDark = usePreferredDark();
        const favicon = computed(() =>
          isSystemDark.value ? '/favicon/nexus_logo_dark_mode.png' : '/favicon/nexus_logo.png',
        );
        useFavicon(favicon, {
          rel: 'icon',
        });
      }
    },

    toggleDarkMode() {
      this.setDarkMode(!this.isDarkMode);
    },

    setDarkMode(isDarkMode: boolean) {
      if (import.meta.client) {
        this.isDarkMode = isDarkMode;

        document.documentElement.classList.toggle('dark', isDarkMode);

        localStorage.setItem('darkMode', String(isDarkMode));
      }
    },
  },
});
