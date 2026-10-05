<script setup lang="ts">
import {
  clinicalFunctionOptions,
  clinicalSpecialtyOptions,
  emptyOffering,
  integrationPurposeOptions,
  workflowChoiceOptions,
  workflowReuseOptions,
  type Answer,
  type ClinicalOffering,
} from '~/utils/questionnaire'

const props = defineProps<{
  answer: Answer
  isCis: boolean
  isSpecialist: boolean
  canIntegrate: boolean
  solutionName: string
}>()
const emit = defineEmits<{ update: [answer: Answer] }>()
const order = { core: 0, integration: 1, function: 2 }
const visibleEntries = computed(() =>
  props.answer.offerings
    .flatMap((offering, index) =>
      (
        offering.kind === 'function'
          ? props.isSpecialist || props.isCis
          : offering.kind === 'integration'
            ? props.isCis && props.canIntegrate
            : props.isCis
      )
        ? [{ offering, index }]
        : [],
    )
    .sort((a, b) => order[a.offering.kind] - order[b.offering.kind]),
)
const lastCisIndex = computed(
  () => visibleEntries.value.filter((entry) => entry.offering.kind !== 'function').at(-1)?.index,
)
function entryNumber(index: number, kind: ClinicalOffering['kind']) {
  return props.answer.offerings.slice(0, index + 1).filter((entry) => entry.kind === kind).length
}

function ensureInitialEntries() {
  const offerings = [...props.answer.offerings]
  if (props.isCis && !offerings.some((item) => item.kind === 'core')) {
    offerings.push(emptyOffering('core', props.solutionName || 'Core CIS'))
  }
  if (props.isSpecialist && !offerings.some((item) => item.kind === 'function')) {
    offerings.push(emptyOffering('function', props.solutionName))
  }
  if (offerings.length !== props.answer.offerings.length) replace(offerings)
}
onMounted(ensureInitialEntries)
watch(() => [props.isCis, props.isSpecialist], ensureInitialEntries)

function replace(offerings: ClinicalOffering[]) {
  emit('update', { ...props.answer, offerings })
}
function add(kind: ClinicalOffering['kind']) {
  replace([...props.answer.offerings, emptyOffering(kind)])
}
function change(index: number, patch: Partial<ClinicalOffering>) {
  const offerings = [...props.answer.offerings]
  offerings[index] = { ...offerings[index]!, ...patch }
  replace(offerings)
}
function remove(index: number) {
  replace(props.answer.offerings.filter((_, position) => position !== index))
}
function toggle(index: number, field: 'functions' | 'specialties', value: string, checked: boolean) {
  const items = props.answer.offerings[index]![field]
  change(index, { [field]: checked ? [...new Set([...items, value])] : items.filter((item) => item !== value) })
}
function togglePurpose(index: number, value: string, checked: boolean) {
  const current = props.answer.offerings[index]!.purposes
  change(index, { purposes: checked ? [...new Set([...current, value])] : current.filter((item) => item !== value) })
}
function changeWorkflow(index: number, field: keyof ClinicalOffering['workflow'], value: string | string[]) {
  const offering = props.answer.offerings[index]!
  change(index, { workflow: { ...offering.workflow, [field]: value } })
}
function toggleReuse(index: number, value: string, checked: boolean) {
  const selected = props.answer.offerings[index]!.workflow.reused_data
  const exclusive = ['none', 'unknown']
  const reused = checked
    ? exclusive.includes(value)
      ? [value]
      : [...selected.filter((item) => !exclusive.includes(item)), value]
    : selected.filter((item) => item !== value)
  changeWorkflow(index, 'reused_data', reused)
}
function custom(index: number, field: 'other_functions' | 'other_specialties', position: number, value: string) {
  const items = [...props.answer.offerings[index]![field]]
  items[position] = value
  change(index, { [field]: items })
}
function addCustom(index: number, field: 'other_functions' | 'other_specialties') {
  const items = props.answer.offerings[index]![field]
  change(index, { [field]: [...(items.length ? items : ['']), ''] })
}
function removeCustom(index: number, field: 'other_functions' | 'other_specialties', position: number) {
  change(index, { [field]: props.answer.offerings[index]![field].filter((_, item) => item !== position) })
}
async function customEnter(event: KeyboardEvent, index: number, field: 'other_functions' | 'other_specialties') {
  const list = (event.target as HTMLElement).closest('[data-custom-list]')
  addCustom(index, field)
  await nextTick()
  const inputs = list?.querySelectorAll<HTMLInputElement>('input')
  inputs?.item(inputs.length - 1)?.focus()
}
</script>

<template>
  <div class="space-y-5">
    <p class="text-muted text-sm leading-relaxed">
      Use one entry for each product or function. Select the functional areas and specialties it covers.
    </p>
    <template v-for="{ offering, index } in visibleEntries" :key="index">
      <div class="border-default rounded-xl border p-5">
        <div class="mb-5 flex items-center justify-between gap-3">
          <h3 class="font-semibold">
            {{
              offering.kind === 'core'
                ? 'Core CIS platform'
                : offering.kind === 'integration'
                  ? `External integration ${entryNumber(index, 'integration')}`
                  : `Specialized function ${entryNumber(index, 'function')}`
            }}
          </h3>
          <UButton
            v-if="offering.kind !== 'core'"
            type="button"
            color="neutral"
            variant="ghost"
            icon="i-heroicons-trash"
            :aria-label="`Remove ${offering.name || `entry ${index + 1}`}`"
            @click="remove(index)"
          />
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField
            :label="
              offering.kind === 'core'
                ? 'Core CIS platform name'
                : offering.kind === 'integration'
                  ? 'Product name'
                  : 'Solution / function name'
            "
          >
            <UInput
              :model-value="offering.name"
              :maxlength="200"
              class="w-full"
              @update:model-value="change(index, { name: String($event) })"
            />
          </UFormField>
          <UFormField v-if="offering.kind === 'integration'" label="Third-party company">
            <UInput
              :model-value="offering.developer"
              :maxlength="200"
              class="w-full"
              @update:model-value="change(index, { developer: String($event) })"
            />
          </UFormField>
          <UFormField
            v-if="offering.kind !== 'core'"
            :label="
              offering.kind === 'integration'
                ? 'What is this integration used for?'
                : 'Briefly describe your solution and what it does'
            "
            class="sm:col-span-2"
          >
            <UTextarea
              :model-value="offering.description"
              :rows="2"
              :maxlength="2000"
              class="w-full"
              @update:model-value="change(index, { description: String($event) })"
            />
          </UFormField>
        </div>
        <fieldset v-if="offering.kind === 'integration'" class="border-default mt-5 space-y-3 border-t pt-5">
          <legend class="text-sm font-semibold">
            Type/purpose of integrated external solution – select all that apply
          </legend>
          <div class="grid gap-2 sm:grid-cols-2">
            <UCheckbox
              v-for="purpose in integrationPurposeOptions"
              :key="purpose"
              :label="purpose"
              :model-value="offering.purposes.includes(purpose)"
              @update:model-value="togglePurpose(index, purpose, $event === true)"
            />
          </div>
          <UFormField v-if="offering.purposes.includes('Other')" label="Other purpose">
            <UInput
              :model-value="offering.purpose_other"
              :maxlength="200"
              class="w-full"
              @update:model-value="change(index, { purpose_other: String($event) })"
            />
          </UFormField>
        </fieldset>
        <div class="mt-5 grid gap-5 lg:grid-cols-2">
          <fieldset>
            <legend class="mb-3 text-sm font-semibold">
              {{ offering.kind === 'core' ? 'Functional areas covered' : 'Specific functional areas' }}
            </legend>
            <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              <UCheckbox
                v-for="item in clinicalFunctionOptions"
                :key="item"
                :label="item"
                :model-value="offering.functions.includes(item)"
                @update:model-value="toggle(index, 'functions', item, $event === true)"
              />
            </div>
            <div data-custom-list class="mt-4 space-y-2">
              <div v-for="position in Math.max(1, offering.other_functions.length)" :key="position" class="flex gap-2">
                <UInput
                  :model-value="offering.other_functions[position - 1] || ''"
                  :aria-label="`Another function for ${offering.name || `entry ${index + 1}`}`"
                  placeholder="Another function"
                  :maxlength="200"
                  class="w-full"
                  @update:model-value="custom(index, 'other_functions', position - 1, String($event))"
                  @keydown.enter.prevent="customEnter($event, index, 'other_functions')"
                />
                <UButton
                  v-if="offering.other_functions.length > 1"
                  type="button"
                  color="neutral"
                  variant="ghost"
                  icon="i-heroicons-trash"
                  aria-label="Remove function"
                  @click="removeCustom(index, 'other_functions', position - 1)"
                />
              </div>
              <UButton
                type="button"
                color="neutral"
                variant="outline"
                icon="i-heroicons-plus"
                @click="addCustom(index, 'other_functions')"
                >Add another functional area</UButton
              >
            </div>
          </fieldset>
          <fieldset>
            <legend class="mb-3 text-sm font-semibold">
              {{ offering.kind === 'core' ? 'Specialties covered' : 'Specific specialties' }}
            </legend>
            <UCheckbox
              label="Across specialties"
              :model-value="offering.all_specialties"
              class="mb-3"
              @update:model-value="
                change(index, {
                  all_specialties: $event === true,
                  specialties: $event === true ? [] : offering.specialties,
                })
              "
            />
            <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              <UCheckbox
                v-for="item in clinicalSpecialtyOptions"
                :key="item"
                :label="item"
                :disabled="offering.all_specialties"
                :model-value="offering.specialties.includes(item)"
                @update:model-value="toggle(index, 'specialties', item, $event === true)"
              />
            </div>
            <div data-custom-list class="mt-4 space-y-2">
              <div
                v-for="position in Math.max(1, offering.other_specialties.length)"
                :key="position"
                class="flex gap-2"
              >
                <UInput
                  :model-value="offering.other_specialties[position - 1] || ''"
                  :aria-label="`Another specialty for ${offering.name || `entry ${index + 1}`}`"
                  placeholder="Another specialty"
                  :maxlength="200"
                  class="w-full"
                  @update:model-value="custom(index, 'other_specialties', position - 1, String($event))"
                  @keydown.enter.prevent="customEnter($event, index, 'other_specialties')"
                />
                <UButton
                  v-if="offering.other_specialties.length > 1"
                  type="button"
                  color="neutral"
                  variant="ghost"
                  icon="i-heroicons-trash"
                  aria-label="Remove specialty"
                  @click="removeCustom(index, 'other_specialties', position - 1)"
                />
              </div>
              <UButton
                type="button"
                color="neutral"
                variant="outline"
                icon="i-heroicons-plus"
                @click="addCustom(index, 'other_specialties')"
                >Add another specialty</UButton
              >
            </div>
          </fieldset>
        </div>
        <UCheckbox
          v-if="offering.kind === 'function'"
          class="mt-5"
          label="Can be purchased and operated independently of your hospital-wide CIS"
          :model-value="offering.standalone"
          @update:model-value="change(index, { standalone: $event === true })"
        />
        <fieldset v-if="offering.kind !== 'core'" class="border-default mt-6 space-y-5 border-t pt-5">
          <legend class="font-semibold">Workflow integration with the CIS</legend>
          <div>
            <p class="mb-2 text-sm font-medium">
              Which data already in the CIS does this
              {{ offering.kind === 'integration' ? 'integration' : 'function' }} reuse?
            </p>
            <div class="grid gap-2 sm:grid-cols-2">
              <UCheckbox
                v-for="option in workflowReuseOptions"
                :key="option.value"
                :label="option.label"
                :model-value="offering.workflow.reused_data.includes(option.value)"
                @update:model-value="toggleReuse(index, option.value, $event === true)"
              />
            </div>
            <UFormField
              v-if="offering.workflow.reused_data.includes('other')"
              label="Other CIS data reused"
              class="mt-3"
            >
              <UInput
                :model-value="offering.workflow.other_reused_data"
                :maxlength="200"
                class="w-full"
                @update:model-value="changeWorkflow(index, 'other_reused_data', String($event))"
              />
            </UFormField>
          </div>
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField label="Is information written back to the CIS?">
              <USelect
                :model-value="offering.workflow.write_back"
                :items="workflowChoiceOptions.write_back"
                placeholder="Select an answer"
                class="w-full"
                @update:model-value="changeWorkflow(index, 'write_back', String($event))"
              />
            </UFormField>
            <UFormField label="Does the user need to open a separate application?">
              <USelect
                :model-value="offering.workflow.separate_app"
                :items="workflowChoiceOptions.separate_app"
                placeholder="Select an answer"
                class="w-full"
                @update:model-value="changeWorkflow(index, 'separate_app', String($event))"
              />
            </UFormField>
            <UFormField label="Is patient context automatically transferred?">
              <USelect
                :model-value="offering.workflow.patient_context"
                :items="workflowChoiceOptions.patient_context"
                placeholder="Select an answer"
                class="w-full"
                @update:model-value="changeWorkflow(index, 'patient_context', String($event))"
              />
            </UFormField>
            <UFormField label="Which workflow steps remain manual?" class="sm:col-span-2">
              <UTextarea
                :model-value="offering.workflow.manual_steps"
                :rows="2"
                :maxlength="2000"
                placeholder="Write None if there are no manual steps."
                class="w-full"
                @update:model-value="changeWorkflow(index, 'manual_steps', String($event))"
              />
            </UFormField>
          </div>
        </fieldset>
      </div>
      <UButton
        v-if="isCis && canIntegrate && index === lastCisIndex"
        type="button"
        color="neutral"
        variant="outline"
        icon="i-heroicons-plus"
        @click="add('integration')"
        >Add external integration</UButton
      >
    </template>
    <UButton
      v-if="isSpecialist"
      type="button"
      color="neutral"
      variant="outline"
      icon="i-heroicons-plus"
      @click="add('function')"
      >Add another function</UButton
    >
  </div>
</template>
