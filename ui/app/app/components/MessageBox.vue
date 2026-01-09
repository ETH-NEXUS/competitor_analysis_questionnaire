<script setup lang="ts">
const message = ref('');
</script>

<template>
  <div class="relative flex h-full w-full items-center justify-center p-3">
    <MessageList />
    <div
      class="absolute bottom-0 flex h-32 w-full items-center justify-center gap-4 border-t border-dashed border-gray-700 bg-gray-100 p-3 dark:bg-gray-900"
    >
      <UTextarea v-model="message" :rows="4" placeholder="Write your question here ..." class="h-full w-full" />
      <UButton label="Send" trailing-icon="i-heroicons-paper-airplane-solid" class="flex h-8 grow-0" />
    </div>
  </div>
</template>
