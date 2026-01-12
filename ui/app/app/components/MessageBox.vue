<script setup lang="ts">
type ChatStatus = 'submitted' | 'streaming' | 'ready' | 'error';
type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  parts: Array<{ type: 'text'; text: string }>;
  metadata?: unknown;
};

const models = [
  { label: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro', icon: 'i-simple-icons-googlegemini' },
  { label: 'GPT-4o', value: 'gpt-4o', icon: 'i-simple-icons-openai' },
  { label: 'Claude 3.5 Sonnet', value: 'claude-3.5-sonnet', icon: 'i-simple-icons-anthropic' },
  { label: 'Llama 4', value: 'llama-4', icon: 'i-simple-icons-ollama' },
];

const selectedModel = ref<(typeof models)[number]['value']>(models[1]?.value ?? models[0]!.value);
const input = ref('');
const status = ref<ChatStatus>('ready');
const selectedModelItem = computed(() => models.find((m) => m.value === selectedModel.value) ?? models[0]!);

const messages = ref<ChatMessage[]>([
  { id: 'msg-1', role: 'assistant', parts: [{ type: 'text', text: 'Hey! I can help you find the right book.' }] },
  { id: 'msg-2', role: 'user', parts: [{ type: 'text', text: 'Any sci-fi recommendations with political themes?' }] },
  { id: 'msg-3', role: 'assistant', parts: [{ type: 'text', text: 'Try The Dispossessed or Ancillary Justice.' }] },
  { id: 'msg-4', role: 'user', parts: [{ type: 'text', text: 'Nice, add them to my list please.' }] },
]);

const onSubmit = () => {
  const content = input.value.trim();
  if (!content) return;

  status.value = 'submitted';
  messages.value.push({
    id: `msg-${Date.now()}`,
    role: 'user',
    parts: [{ type: 'text', text: content }],
    metadata: { model: selectedModel.value },
  });

  input.value = '';
  status.value = 'ready';
};
</script>

<template>
  <div class="flex h-full w-full flex-col gap-2 p-2 sm:gap-3 sm:p-3">
    <div class="min-h-0 flex-1">
      <MessageList :messages="messages" :status="status" />
    </div>

    <UChatPrompt
      v-model="input"
      variant="soft"
      placeholder="Write your question here ..."
      class="w-full text-sm sm:text-base"
      :ui="{ base: 'max-h-16 sm:max-h-20' }"
      @submit="onSubmit"
    >
      <UChatPromptSubmit :status="status" class="rounded-full" />

      <template #footer>
        <USelect
          v-model="selectedModel"
          :items="models"
          :icon="selectedModelItem.icon"
          placeholder="Select a model"
          variant="ghost"
          size="sm"
        />
      </template>
    </UChatPrompt>
  </div>
</template>
