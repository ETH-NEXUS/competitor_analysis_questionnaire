<script setup lang="ts">
const value3 = ref('');
</script>

<template>
  <div class="relative flex h-full w-full items-center justify-center p-3">
    <Messages />
    <div
      class="absolute bottom-0 flex h-32 w-full items-center justify-center gap-4 border-t border-dashed border-gray-700 p-3"
    >
      <FloatLabel variant="on" class="flex h-full flex-grow">
        <Textarea
          id="over_label"
          v-model="value3"
          variant="filled"
          rows="5"
          cols="30"
          style="resize: none"
          class="h-full w-full p-2"
        />
        <label for="on_label">Write your question here ...</label>
      </FloatLabel>
      <Button label="Send" icon-pos="right" class="flex h-8 grow-0 flex-row-reverse">
        <template #icon>
          <Icon name="heroicons:paper-airplane-solid" style="color: black" />
        </template>
      </Button>
    </div>
  </div>
</template>
