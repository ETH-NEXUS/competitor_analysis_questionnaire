<script setup lang="ts">
import { costOptions, sourceOptions, type Answer, type Question } from '~/utils/questionnaire'

const props = defineProps<{ question: Question; answer: Answer }>()
const emit = defineEmits<{ update: [answer: Answer] }>()
const options = computed(() =>
  props.question.choices.map((label, index) => ({
    label,
    value: String(index),
  })),
)
const selectItems = (labels: string[]) =>
  labels.map((label, index) => ({
    label,
    value: String(index),
  }))
const yesNo = [
  { label: 'Yes', value: 'yes' },
  { label: 'No', value: 'no' },
]
const hints = {
  single: '',
  multi: 'Select all that apply',
  text: 'Free text',
  costs: 'Choose one cost classification for each row',
  capabilities: '',
}
function select(value: string, checked: boolean) {
  const exclusive = (props.question.exclusive || []).map(String)
  const selected = checked
    ? exclusive.includes(value)
      ? [value]
      : [...props.answer.selected.filter((item) => !exclusive.includes(item)), value]
    : props.answer.selected.filter((item) => item !== value)
  emit('update', { ...props.answer, selected })
}
function detail(key: string, value: string) {
  emit('update', { ...props.answer, details: { ...props.answer.details, [key]: value } })
}
function row(key: string, field: string, value: string) {
  const updatedRow = { ...props.answer.rows[key], [field]: value }
  if (field === 'source' && value !== '0') delete updatedRow.standalone
  emit('update', {
    ...props.answer,
    rows: { ...props.answer.rows, [key]: updatedRow },
  })
}
</script>

<template>
  <fieldset class="question-field">
    <legend class="question-label">Q{{ question.number }}. {{ question.label }}</legend>
    <p v-if="hints[question.kind]" class="text-muted mb-5 text-sm">{{ hints[question.kind] }}</p>
    <URadioGroup
      v-if="question.kind === 'single'"
      :model-value="answer.selected[0]"
      :items="options"
      :aria-label="question.label"
      @update:model-value="emit('update', { ...answer, selected: [String($event)] })"
    />
    <div v-else-if="question.kind === 'multi'" class="space-y-3">
      <UCheckbox
        v-for="option in options"
        :key="option.value"
        :label="option.label"
        :model-value="answer.selected.includes(option.value)"
        @update:model-value="select(option.value, $event === true)"
      />
    </div>
    <UTextarea
      v-else-if="question.kind === 'text'"
      :model-value="answer.text"
      :rows="4"
      class="w-full"
      :aria-label="question.label"
      @update:model-value="emit('update', { ...answer, text: String($event) })"
    />
    <div v-else class="space-y-3">
      <div v-for="option in options" :key="option.value" class="border-default rounded-xl border p-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <span v-if="question.kind === 'costs'" class="text-sm font-medium">{{ option.label }}</span>
          <USelect
            v-if="question.kind === 'costs'"
            :items="selectItems(costOptions)"
            :model-value="answer.rows[option.value]?.cost"
            placeholder="Select an answer"
            :aria-label="option.label"
            class="w-full sm:w-64"
            @update:model-value="row(option.value, 'cost', String($event))"
          />
          <UCheckbox
            v-else
            :label="option.label"
            :model-value="answer.rows[option.value]?.provided === 'yes'"
            @update:model-value="row(option.value, 'provided', $event === true ? 'yes' : 'no')"
          />
        </div>
        <div
          v-if="question.kind === 'capabilities' && answer.rows[option.value]?.provided === 'yes'"
          class="mt-5 grid gap-4 sm:grid-cols-2"
        >
          <UFormField v-if="question.id !== 'specialties'" label="Product / module name">
            <UInput
              :model-value="answer.rows[option.value]?.name"
              class="w-full"
              @update:model-value="row(option.value, 'name', String($event))"
            />
          </UFormField>
          <UFormField
            v-if="question.id !== 'specialties'"
            label="Who develops the product / module?"
            description="Native means developed by your company. Partner means a third-party product supplied or integrated through a partner."
          >
            <USelect
              :model-value="answer.rows[option.value]?.source"
              :items="selectItems(sourceOptions)"
              class="w-full"
              placeholder="Select an answer"
              @update:model-value="row(option.value, 'source', String($event))"
            />
          </UFormField>
          <UFormField
            :label="question.id === 'specialties' ? 'Please describe the specialty module(s)' : 'Brief description'"
            class="sm:col-span-2"
          >
            <UTextarea
              :model-value="answer.rows[option.value]?.description"
              class="w-full"
              @update:model-value="row(option.value, 'description', String($event))"
            />
          </UFormField>
          <UFormField
            v-if="question.id !== 'specialties' && answer.rows[option.value]?.source === '0'"
            :label="
              question.id === 'clinicalCapabilities'
                ? 'Can be purchased and operated as a standalone solution alongside a third-party CIS'
                : 'Can be purchased and operated independently'
            "
            class="sm:col-span-2"
          >
            <USelect
              :items="yesNo"
              :model-value="answer.rows[option.value]?.standalone"
              placeholder="Select an answer"
              class="w-40"
              @update:model-value="row(option.value, 'standalone', String($event))"
            />
          </UFormField>
        </div>
      </div>
    </div>
    <template v-if="question.kind === 'single' || question.kind === 'multi'">
      <UFormField
        v-for="index in (question.details || []).filter((i) => answer.selected.includes(String(i)))"
        :key="index"
        :label="question.detailLabels?.[index] || `${options[index]?.label}: Please specify`"
        class="mt-4"
      >
        <UInput
          :model-value="answer.details[index] || ''"
          class="w-full"
          @update:model-value="detail(String(index), String($event))"
        />
      </UFormField>
    </template>
  </fieldset>
</template>
