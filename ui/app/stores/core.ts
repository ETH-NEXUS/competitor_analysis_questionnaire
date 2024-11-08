export const useCoreStore = defineStore('coreStore', {
  state: () => ({
    isDarkMode: false,
  }),
  actions: {
    setDarkMode(isDarkMode: boolean) {
      this.isDarkMode = isDarkMode;
      document.documentElement.classList.toggle('dark', isDarkMode);
    },
  },
});
