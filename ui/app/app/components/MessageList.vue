<script setup lang="ts">
const items = ref(Array.from({ length: 100 }).map((_, i) => `Item #${i}`));
</script>

<template>
  <UPageCard class="h-full w-full">
    <UScrollArea :items="items" :virtualize="{ estimateSize: 48 }" class="h-full w-full pb-32">
      <template #default="{ item, index }">
        <div :class="['flex h-12 w-full items-center p-2', { 'bg-gray-100 dark:bg-gray-800': index % 2 === 1 }]">
          {{ item }}
        </div>
      </template>
    </UScrollArea>
  </UPageCard>
</template>
