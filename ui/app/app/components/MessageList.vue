<script setup lang="ts">
import { getTextFromMessage } from '@nuxt/ui/utils/ai';

defineProps<{
  messages: Array<{
    id: string;
    role: 'user' | 'assistant' | 'system';
    parts: Array<{ type: 'text'; text: string }>;
    content?: string;
    metadata?: unknown;
  }>;
  status?: 'submitted' | 'streaming' | 'ready' | 'error';
}>();
</script>

<template>
  <UChatMessages
    :messages="messages"
    :spacing-offset="80"
    :status="status"
    :user="{ variant: 'soft', icon: 'i-lucide-user' }"
    :assistant="{ variant: 'soft', icon: 'i-lucide-bot' }"
    compact
    class="h-full w-full"
  >
    <template #content="{ message }">
      {{ getTextFromMessage(message) }}
    </template>
  </UChatMessages>
</template>
