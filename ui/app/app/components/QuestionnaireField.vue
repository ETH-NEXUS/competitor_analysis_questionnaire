<script setup lang="ts">
import {
  costOptions,
  certificationScopeOptions,
  emptyCertificationDetail,
  emptyProduct,
  emptyTestingEvent,
  fhirReleases,
  hl7v2MessageTypes,
  implementationRequirementOptions,
  otherIndex,
  otherIsSelected,
  productsFor,
  sourceOptions,
  testingEventOptions,
  testingOutcomeOptions,
  type Answer,
  type CertificationDetail,
  type Product,
  type Question,
  type TestingEvent,
} from '~/utils/questionnaire'

const props = defineProps<{
  question: Question
  answer: Answer
  isCis?: boolean
  isSpecialist?: boolean
  canIntegrate?: boolean
  solutionName?: string
}>()
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
const hints = {
  single: '',
  multi: 'Select all that apply',
  text: 'Free text',
  costs: 'Choose one cost classification for each row',
  capabilities: '',
  offerings: '',
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
function selectSingle(value: string) {
  emit('update', {
    ...props.answer,
    selected: [value],
    testing_events:
      props.question.id === 'interoperabilityTesting' && value === '0' && !props.answer.testing_events.length
        ? [emptyTestingEvent()]
        : props.answer.testing_events,
  })
}
function detail(key: string, value: string) {
  emit('update', { ...props.answer, details: { ...props.answer.details, [key]: value } })
}
function updateFhirRelease(release: string, checked: boolean) {
  const current = props.answer.followups['0'] || []
  const selected = checked ? [...new Set([...current, release])] : current.filter((item) => item !== release)
  emit('update', { ...props.answer, followups: { ...props.answer.followups, '0': selected } })
}
function updateFollowup(key: string, value: string, checked: boolean, exclusive: string[] = []) {
  const current = props.answer.followups[key] || []
  const selected = checked
    ? exclusive.includes(value)
      ? [value]
      : [...new Set([...current.filter((item) => !exclusive.includes(item)), value])]
    : current.filter((item) => item !== value)
  emit('update', { ...props.answer, followups: { ...props.answer.followups, [key]: selected } })
}
function certificationEntry(index: number): CertificationDetail {
  return props.answer.certification_details[String(index)] || emptyCertificationDetail()
}
function updateCertification(index: number, patch: Partial<CertificationDetail>) {
  emit('update', {
    ...props.answer,
    certification_details: {
      ...props.answer.certification_details,
      [index]: { ...certificationEntry(index), ...patch },
    },
  })
}
function toggleCertificationScope(index: number, scope: string, checked: boolean) {
  const current = certificationEntry(index).scopes
  updateCertification(index, {
    scopes: checked ? [...new Set([...current, scope])] : current.filter((item) => item !== scope),
  })
}
function updateTestingEvent(index: number, field: keyof TestingEvent, value: string) {
  const testing_events = [...props.answer.testing_events]
  testing_events[index] = { ...testing_events[index]!, [field]: value }
  emit('update', { ...props.answer, testing_events })
}
function addTestingEvent() {
  emit('update', { ...props.answer, testing_events: [...props.answer.testing_events, emptyTestingEvent()] })
}
function removeTestingEvent(index: number) {
  emit('update', { ...props.answer, testing_events: props.answer.testing_events.filter((_, item) => item !== index) })
}
function updateOther(index: number, value: string) {
  const other_items = [...props.answer.other_items]
  other_items[index] = value
  emit('update', { ...props.answer, other_items })
}
function removeOther(index: number) {
  emit('update', { ...props.answer, other_items: props.answer.other_items.filter((_, item) => item !== index) })
}
function addOther() {
  emit('update', {
    ...props.answer,
    other_items: [...(props.answer.other_items.length ? props.answer.other_items : ['']), ''],
  })
}
async function onOtherEnter(event: KeyboardEvent) {
  if (props.question.kind === 'single' || props.answer.other_items.length >= 100) return
  const list = (event.target as HTMLElement).closest('[data-other-list]')
  addOther()
  await nextTick()
  const inputs = list?.querySelectorAll<HTMLInputElement>('input')
  inputs?.item(inputs.length - 1)?.focus()
}
function row(key: string, field: string, value: string) {
  const updatedRow = { ...props.answer.rows[key], [field]: value }
  if (field === 'cost' && !['1', '2'].includes(value)) delete updatedRow.billing_unit
  emit('update', {
    ...props.answer,
    rows: { ...props.answer.rows, [key]: updatedRow },
  })
}
function displayProducts(key: string): Product[] {
  const products = productsFor(props.answer, Number(key))
  return products.length ? products : [emptyProduct()]
}
function updateProduct(key: string, index: number, field: keyof Product, value: string | boolean) {
  const products = [...displayProducts(key)]
  const updated: Product = { ...products[index]! }
  if (field === 'source') {
    updated.source = value === '0' || value === '1' ? value : ''
    if (updated.source !== '0') updated.standalone = false
  } else if (field === 'standalone') updated.standalone = value === true
  else updated[field] = String(value)
  products[index] = updated
  emit('update', { ...props.answer, products: { ...props.answer.products, [key]: products } })
}
function addProduct(key: string) {
  emit('update', {
    ...props.answer,
    products: { ...props.answer.products, [key]: [...displayProducts(key), emptyProduct()] },
  })
}
function removeProduct(key: string, index: number) {
  emit('update', {
    ...props.answer,
    products: { ...props.answer.products, [key]: displayProducts(key).filter((_, item) => item !== index) },
  })
}
</script>

<template>
  <fieldset class="question-field" tabindex="-1">
    <legend class="question-label">Q{{ question.number }}. {{ question.label }}</legend>
    <p v-if="question.help" class="text-muted mb-4 text-sm leading-relaxed">{{ question.help }}</p>
    <p v-if="hints[question.kind]" class="text-muted mb-5 text-sm">{{ hints[question.kind] }}</p>
    <QuestionnaireOfferings
      v-if="question.kind === 'offerings'"
      :answer="answer"
      :is-cis="isCis === true"
      :is-specialist="isSpecialist === true"
      :can-integrate="canIntegrate === true"
      :solution-name="solutionName || ''"
      @update="emit('update', $event)"
    />
    <URadioGroup
      v-else-if="question.kind === 'single'"
      :model-value="answer.selected[0]"
      :items="options"
      :aria-label="question.label"
      @update:model-value="selectSingle(String($event))"
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
        <UFormField
          v-if="question.kind === 'costs' && ['1', '2'].includes(answer.rows[option.value]?.cost || '')"
          label="Charged per (optional)"
          description="For example, per interface, site, user or year."
          class="mt-4"
        >
          <UInput
            :model-value="answer.rows[option.value]?.billing_unit || ''"
            :maxlength="200"
            class="w-full"
            @update:model-value="row(option.value, 'billing_unit', String($event))"
          />
        </UFormField>
        <div
          v-if="question.kind === 'capabilities' && answer.rows[option.value]?.provided === 'yes'"
          class="mt-5 space-y-4"
        >
          <div
            v-for="(product, index) in displayProducts(option.value)"
            :key="index"
            class="border-default grid gap-4 rounded-lg border p-4 sm:grid-cols-2"
          >
            <div class="flex items-center justify-between sm:col-span-2">
              <span class="text-sm font-medium">Product / module {{ index + 1 }}</span>
              <UButton
                v-if="displayProducts(option.value).length > 1"
                type="button"
                color="neutral"
                variant="ghost"
                icon="i-heroicons-trash"
                :aria-label="`Remove product ${index + 1} for ${option.label}`"
                @click="removeProduct(option.value, index)"
              />
            </div>
            <UFormField label="Product / module name">
              <UInput
                :model-value="product.name"
                :maxlength="2000"
                class="w-full"
                @update:model-value="updateProduct(option.value, index, 'name', String($event))"
              />
            </UFormField>
            <UFormField
              label="Who develops the product / module?"
              description="Native means developed by your company. Partner means a third-party product supplied or integrated through a partner."
            >
              <USelect
                :model-value="product.source"
                :items="selectItems(sourceOptions)"
                class="w-full"
                placeholder="Select an answer"
                @update:model-value="updateProduct(option.value, index, 'source', String($event))"
              />
            </UFormField>
            <UFormField label="Brief description" class="sm:col-span-2">
              <UTextarea
                :model-value="product.description"
                :maxlength="20000"
                class="w-full"
                @update:model-value="updateProduct(option.value, index, 'description', String($event))"
              />
            </UFormField>
            <UCheckbox
              v-if="product.source === '0'"
              :label="
                question.id === 'clinicalCapabilities'
                  ? 'Can be purchased and operated as a standalone solution alongside a third-party CIS'
                  : 'Can be purchased and operated independently'
              "
              :model-value="product.standalone"
              class="sm:col-span-2"
              @update:model-value="updateProduct(option.value, index, 'standalone', $event === true)"
            />
          </div>
          <UButton
            v-if="displayProducts(option.value).length < 100"
            type="button"
            color="neutral"
            variant="outline"
            icon="i-heroicons-plus"
            @click="addProduct(option.value)"
          >
            Add another product / module
          </UButton>
        </div>
      </div>
    </div>
    <p v-if="answer.details.legacy && !answer.selected.length" class="text-warning mt-4 text-sm">
      {{ answer.details.legacy }}
    </p>
    <UFormField v-if="question.optionalTextLabel" :label="question.optionalTextLabel" class="mt-5">
      <UTextarea
        :model-value="answer.text"
        :rows="3"
        class="w-full"
        :aria-label="question.optionalTextLabel"
        @update:model-value="emit('update', { ...answer, text: String($event) })"
      />
    </UFormField>
    <template v-if="question.kind === 'single' || question.kind === 'multi'">
      <UFormField
        v-for="index in (question.details || []).filter(
          (i) => i !== otherIndex(question) && answer.selected.includes(String(i)),
        )"
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
    <div
      v-if="question.id === 'standards' && answer.selected.includes('0')"
      class="border-default mt-5 space-y-3 rounded-xl border p-4"
    >
      <p class="text-sm font-semibold">Primary FHIR release used in production:</p>
      <div class="flex flex-wrap gap-x-6 gap-y-3">
        <UCheckbox
          v-for="release in fhirReleases"
          :key="release"
          :label="release"
          :model-value="(answer.followups['0'] || []).includes(release)"
          @update:model-value="updateFhirRelease(release, $event === true)"
        />
      </div>
      <UFormField v-if="answer.followups['0']?.includes('Other')" label="Other FHIR release">
        <UInput
          :model-value="answer.details.fhir_other || ''"
          :maxlength="200"
          class="w-full"
          @update:model-value="detail('fhir_other', String($event))"
        />
      </UFormField>
    </div>
    <div
      v-if="question.id === 'standards' && answer.selected.includes('1')"
      class="border-default mt-5 space-y-3 rounded-xl border p-4"
    >
      <p class="text-sm font-semibold">HL7 v2 – Which message types does your solution support?</p>
      <p class="text-muted text-sm">Select all that apply.</p>
      <div class="grid gap-2 sm:grid-cols-2">
        <UCheckbox
          v-for="item in hl7v2MessageTypes"
          :key="item.value"
          :label="item.label"
          :model-value="(answer.followups['1'] || []).includes(item.value)"
          @update:model-value="updateFollowup('1', item.value, $event === true, ['Not sure'])"
        />
      </div>
      <UFormField v-if="answer.followups['1']?.includes('Other')" label="Other HL7 v2 message type">
        <UInput
          :model-value="answer.details.hl7v2_other || ''"
          :maxlength="200"
          class="w-full"
          @update:model-value="detail('hl7v2_other', String($event))"
        />
      </UFormField>
    </div>
    <div
      v-if="question.id === 'certifications' && answer.selected.some((item) => Number(item) < 7)"
      class="mt-5 space-y-4"
    >
      <h4 class="text-sm font-semibold">Certification / assessment details</h4>
      <div
        v-for="index in answer.selected.filter((item) => Number(item) < 7)"
        :key="index"
        class="border-default space-y-3 rounded-xl border p-4"
      >
        <p class="font-medium">{{ question.choices[Number(index)] }}</p>
        <UFormField v-if="Number(index) >= 5" label="Certificate / assessment name">
          <UInput
            :model-value="certificationEntry(Number(index)).name"
            :maxlength="200"
            class="w-full"
            @update:model-value="updateCertification(Number(index), { name: String($event) })"
          />
        </UFormField>
        <fieldset>
          <legend class="mb-2 text-sm font-medium">Scope</legend>
          <div class="flex flex-wrap gap-x-5 gap-y-2">
            <UCheckbox
              v-for="scopeOption in certificationScopeOptions"
              :key="scopeOption.value"
              :label="scopeOption.label"
              :model-value="certificationEntry(Number(index)).scopes.includes(scopeOption.value)"
              @update:model-value="toggleCertificationScope(Number(index), scopeOption.value, $event === true)"
            />
          </div>
        </fieldset>
        <UFormField v-if="certificationEntry(Number(index)).scopes.includes('other')" label="Other scope">
          <UInput
            :model-value="certificationEntry(Number(index)).scope_other"
            :maxlength="200"
            class="w-full"
            @update:model-value="updateCertification(Number(index), { scope_other: String($event) })"
          />
        </UFormField>
        <UFormField label="Valid until (year, if applicable)">
          <UInput
            :model-value="certificationEntry(Number(index)).valid_until"
            type="number"
            min="1900"
            max="2100"
            placeholder="YYYY"
            class="w-full"
            @update:model-value="updateCertification(Number(index), { valid_until: String($event) })"
          />
        </UFormField>
      </div>
    </div>
    <div
      v-if="question.id === 'requirements' && answer.selected.includes('1')"
      class="border-default mt-5 space-y-3 rounded-xl border p-4"
    >
      <p class="text-sm font-semibold">What is typically required?</p>
      <p class="text-muted text-sm">Select all that apply.</p>
      <div class="grid gap-2 sm:grid-cols-2">
        <UCheckbox
          v-for="(item, index) in implementationRequirementOptions"
          :key="item"
          :label="item"
          :model-value="(answer.followups['1'] || []).includes(String(index))"
          @update:model-value="updateFollowup('1', String(index), $event === true)"
        />
      </div>
      <UFormField v-if="answer.followups['1']?.includes('9')" label="Other requirement">
        <UInput
          :model-value="answer.details.requirements_other || ''"
          :maxlength="2000"
          class="w-full"
          @update:model-value="detail('requirements_other', String($event))"
        />
      </UFormField>
    </div>
    <div v-if="question.id === 'interoperabilityTesting' && answer.selected.includes('0')" class="mt-5 space-y-4">
      <p v-if="answer.details.legacy" class="text-warning text-sm">{{ answer.details.legacy }}</p>
      <div v-for="(event, index) in answer.testing_events" :key="index" class="border-default rounded-xl border p-4">
        <div class="mb-4 flex items-center justify-between gap-3">
          <h4 class="font-semibold">Testing event {{ index + 1 }}</h4>
          <UButton
            type="button"
            color="neutral"
            variant="ghost"
            icon="i-heroicons-trash"
            :aria-label="`Remove testing event ${index + 1}`"
            @click="removeTestingEvent(index)"
          />
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField label="Event">
            <USelect
              :model-value="event.event"
              :items="testingEventOptions.map((item) => ({ label: item, value: item }))"
              placeholder="Select an event"
              class="w-full"
              @update:model-value="updateTestingEvent(index, 'event', String($event))"
            />
          </UFormField>
          <UFormField label="Year">
            <UInput
              :model-value="event.year"
              type="number"
              min="1900"
              :max="new Date().getFullYear() + 1"
              placeholder="YYYY"
              class="w-full"
              @update:model-value="updateTestingEvent(index, 'year', String($event))"
            />
          </UFormField>
          <UFormField v-if="event.event === 'Other'" label="Other event" class="sm:col-span-2">
            <UInput
              :model-value="event.event_other"
              :maxlength="200"
              class="w-full"
              @update:model-value="updateTestingEvent(index, 'event_other', String($event))"
            />
          </UFormField>
          <UFormField label="Tested profiles / use cases" class="sm:col-span-2">
            <UTextarea
              :model-value="event.profiles"
              :maxlength="2000"
              :rows="2"
              class="w-full"
              @update:model-value="updateTestingEvent(index, 'profiles', String($event))"
            />
          </UFormField>
          <UFormField label="Outcome / result">
            <USelect
              :model-value="event.outcome"
              :items="testingOutcomeOptions.map((item) => ({ label: item, value: item }))"
              placeholder="Select a result"
              class="w-full"
              @update:model-value="updateTestingEvent(index, 'outcome', String($event))"
            />
          </UFormField>
          <UFormField v-if="event.outcome === 'Other'" label="Other outcome">
            <UInput
              :model-value="event.outcome_other"
              :maxlength="200"
              class="w-full"
              @update:model-value="updateTestingEvent(index, 'outcome_other', String($event))"
            />
          </UFormField>
        </div>
      </div>
      <UButton
        v-if="answer.testing_events.length < 30"
        type="button"
        color="neutral"
        variant="outline"
        icon="i-heroicons-plus"
        @click="addTestingEvent"
        >Add another event</UButton
      >
    </div>
    <div v-if="otherIsSelected(question, answer)" data-other-list class="mt-5 space-y-3">
      <p class="text-sm font-medium">Other answers</p>
      <div
        v-for="index in question.kind === 'single' ? 1 : Math.max(1, answer.other_items.length)"
        :key="index"
        class="flex items-center gap-2"
      >
        <UInput
          :model-value="answer.other_items[index - 1] || ''"
          :aria-label="`Other answer ${index} for question ${question.number}`"
          :maxlength="2000"
          class="w-full"
          @update:model-value="updateOther(index - 1, String($event))"
          @keydown.enter.prevent="onOtherEnter"
        />
        <UButton
          v-if="question.kind !== 'single' && answer.other_items.length > 1"
          type="button"
          color="neutral"
          variant="ghost"
          icon="i-heroicons-trash"
          :aria-label="`Remove other answer ${index}`"
          @click="removeOther(index - 1)"
        />
      </div>
      <UButton
        v-if="question.kind !== 'single' && answer.other_items.length < 100"
        type="button"
        color="neutral"
        variant="outline"
        icon="i-heroicons-plus"
        @click="addOther"
      >
        Add another answer
      </UButton>
    </div>
  </fieldset>
</template>
