<script setup lang="ts">
const items = ref(Array.from({ length: 100000 }).map((_, i) => `Item #${i}`));
</script>

<template>
  <div class="h-full w-full pb-32">
    <VirtualScroller
      :items="items"
      :itemSize="192"
      class="h-full w-full rounded border border-surface-200 dark:border-surface-700"
    >
      <template v-slot:item="{ item, options }">
        <div :class="['flex h-48 w-full items-center p-2', { 'bg-surface-100 dark:bg-surface-700': options.odd }]">
          {{ item }}
        </div>
      </template>
    </VirtualScroller>
  </div>
</template>
