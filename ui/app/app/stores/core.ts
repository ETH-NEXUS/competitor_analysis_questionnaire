export const useCoreStore = defineStore('coreStore', {
  state: () => ({
    colorMode: null as ReturnType<typeof useColorMode> | null,
  }),
  getters: {
    isDark(): boolean {
      return this.colorMode?.value === 'dark'
    },
  },
  actions: {
    initColorMode() {
      if (import.meta.client) {
        this.colorMode = useColorMode()
      }
    },
    toggleDarkMode(value: boolean) {
      if (this.colorMode) {
        this.colorMode.preference = value ? 'dark' : 'light'
      }
    },
    initFavicon() {
      if (import.meta.client) {
        // set favicon to match dark mode of the system (browser UI)
        // this is independent of the dark mode of the application
        const isSystemDark = usePreferredDark()
        const favicon = computed(() =>
          isSystemDark.value ? '/favicon/nexus_logo_dark_mode.png' : '/favicon/nexus_logo.png',
        )
        useFavicon(favicon, {
          rel: 'icon',
        })
      }
    },
  },
})
