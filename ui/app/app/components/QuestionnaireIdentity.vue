<script setup lang="ts">
defineProps<{ readonly?: boolean; showErrors?: boolean }>()
const store = useQuestionnaireStore()
const fields = {
  respondentEmail: 'Your email address',
  providerName: 'Company / provider name',
}
</script>

<template>
  <UCard class="mb-6">
    <template #header><h2 class="text-lg font-semibold">Who is completing this questionnaire?</h2></template>
    <dl v-if="readonly" class="grid gap-4 sm:grid-cols-2">
      <div v-for="(label, field) in fields" :key="field">
        <dt class="text-muted text-sm">{{ label }}</dt>
        <dd class="mt-1 break-words">{{ store.identity[field] || 'Not answered' }}</dd>
      </div>
    </dl>
    <div v-else class="grid gap-5 sm:grid-cols-2">
      <UFormField
        label="Your email address"
        required
        :error="showErrors ? store.identityErrors.respondentEmail : undefined"
      >
        <UInput
          v-model="store.identity.respondentEmail"
          name="respondent_email"
          type="email"
          autocomplete="email"
          required
          :maxlength="254"
          class="w-full"
        />
      </UFormField>
      <UFormField
        label="Company / provider name"
        required
        :error="showErrors ? store.identityErrors.providerName : undefined"
      >
        <UInput
          v-model="store.identity.providerName"
          name="provider_name"
          autocomplete="organization"
          required
          :maxlength="200"
          class="w-full"
        />
      </UFormField>
    </div>
  </UCard>
</template>
