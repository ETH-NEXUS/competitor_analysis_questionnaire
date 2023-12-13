<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from 'src/boot/axios';
import { Book } from 'src/components/models'

const books = ref<Book[]>([])
onMounted(async () => {
  try {
    books.value = (await api.get('books')).data.results
  } catch (err) {
    console.error(err)
  }
})
</script>

<template>
<ul>
<li v-for="book in books" :key="book.id">{{ book.title }}</li>
</ul>
</template>
