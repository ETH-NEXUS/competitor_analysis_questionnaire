export const useMessageStore = defineStore('messageStore', {
  state: () => ({
    messages: [] as string[],
    currentMessage: '',
  }),
  actions: {
    sendMessage(message: string) {
      this.messages.push(message);
      console.log(message);
    },
  },
});
