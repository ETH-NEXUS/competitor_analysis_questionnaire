<script setup lang="ts">
import faviconUrl from '../assets/favicon/favicon.svg?url'
import nexusLogoUrl from '../assets/logokombi-nexus.png'
import {
  activeAnswer,
  answerLines,
  isAnswered,
  scopes,
  scopeLabels,
  scopeDescriptions,
  type QuestionSection,
} from '~/utils/questionnaire'

const store = useQuestionnaireStore()
const status = ref('')
const scopeError = ref(false)
const heading = ref<HTMLElement>()
const stages = ['About you & solution scope', 'Core questions', 'Solution-specific questions', 'Review & submit']
const visibleSections = computed(() => store.applicableSections.filter((section) => section.stage === store.stage))
const complete = computed(() => store.done === store.total)
const percentage = computed(() => Math.round((store.done / store.total) * 100))

function sectionReason(section: QuestionSection): string {
  if (!section.scopes) return ''
  const selected = section.scopes
    .filter((scope) => store.selectedScopes.includes(scope))
    .map((scope) => scopeLabels[scopes.indexOf(scope)]!.toLowerCase())
  return `These questions apply because you indicated that you offer: ${new Intl.ListFormat('en', { type: 'conjunction' }).format(selected)}.`
}

useHead({
  title: 'Hospital IT Vendor Questionnaire',
  htmlAttrs: { lang: 'en' },
  link: [{ rel: 'icon', type: 'image/svg+xml', href: faviconUrl }],
})

async function goTo(stage: number) {
  if (store.isSubmitting || store.submittedId !== null) return
  if (stage > 0 && (!store.selectedScopes.length || !store.identityValid)) {
    store.stage = 0
    scopeError.value = true
    return
  }
  scopeError.value = false
  store.stage = stage
  await nextTick()
  heading.value?.focus()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
async function submit() {
  if (!store.identityValid || !store.selectedScopes.length) {
    await goTo(1)
    return
  }
  status.value = ''
  try {
    await store.submit()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } catch {
    status.value =
      'Your response could not be submitted. Your answers are still here. Please check your connection and try again.'
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}
function save() {
  try {
    store.save()
    status.value = 'Draft saved in this browser.'
  } catch {
    status.value = 'Your draft could not be saved in this browser. Download your answers to keep a copy.'
  }
}
function download() {
  try {
    const response = {
      questionnaire: 'Hospital IT Vendor Questionnaire',
      version: 1,
      exportedAt: new Date().toISOString(),
      complete: complete.value,
      respondent: { ...store.identity },
      scopes: store.selectedScopes.map((scope) => ({ id: scope, label: scopeLabels[scopes.indexOf(scope)] })),
      sections: store.applicableSections.map((section) => ({
        id: section.id,
        title: section.title,
        questions: section.questions.map((question) => ({
          id: question.id,
          question: question.label,
          complete: isAnswered(question, store.answerFor(question.id)),
          answer: activeAnswer(question, store.answerFor(question.id)),
          readableAnswer: answerLines(question, store.answerFor(question.id)),
        })),
      })),
    }
    const url = URL.createObjectURL(new Blob([JSON.stringify(response, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'hospital-it-questionnaire.json'
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    status.value = 'Your response file has been downloaded.'
  } catch {
    status.value = 'The download could not be created. Please try again.'
  }
}
onMounted(() => {
  try {
    if (store.restore()) status.value = 'Your saved draft has been restored.'
  } catch {
    status.value = 'The saved draft could not be restored. You can start a new response.'
  }
})
</script>

<template>
  <UApp>
    <NuxtRouteAnnouncer />
    <div class="questionnaire-shell">
      <header class="border-default bg-default border-b">
        <div
          class="grid grid-cols-[minmax(0,1fr)_100px] items-center gap-3 py-2 pr-3 pl-[max(1.25rem,calc((100%-80rem)/2+1.25rem))] sm:grid-cols-[minmax(0,1fr)_160px] sm:gap-6 lg:pr-5 lg:pl-[max(2.5rem,calc((100%-80rem)/2+2.5rem))]"
        >
          <div class="flex min-w-0 flex-col items-start gap-3 py-3 text-left">
            <span class="text-xl leading-tight font-semibold tracking-tight sm:text-3xl lg:text-4xl">
              Hospital IT Vendor Questionnaire
            </span>
            <UButton
              v-if="store.submittedId === null"
              color="neutral"
              variant="outline"
              icon="i-heroicons-bookmark"
              :disabled="store.isSubmitting"
              @click="save"
              >Save draft</UButton
            >
          </div>
          <img
            :src="nexusLogoUrl"
            alt="ETH Zürich — nexus Personalized Health"
            width="776"
            height="567"
            class="h-auto w-full self-start bg-white"
          />
        </div>
      </header>

      <div class="mx-auto grid max-w-7xl gap-8 px-5 py-8 lg:grid-cols-[250px_minmax(0,1fr)] lg:px-10 lg:py-12">
        <aside>
          <div class="lg:sticky lg:top-8">
            <nav aria-label="Questionnaire sections" class="grid grid-cols-2 gap-2 lg:grid-cols-1">
              <button
                v-for="(label, index) in stages"
                :key="index"
                type="button"
                :disabled="store.isSubmitting || store.submittedId !== null"
                class="step-button"
                :class="{ 'step-active': store.stage === index }"
                :aria-current="store.stage === index ? 'step' : undefined"
                @click="goTo(index)"
              >
                <span class="step-number">{{ index }}</span
                ><span>{{ label }}</span>
              </button>
            </nav>
            <div class="border-default mt-8 border-t pt-6">
              <div class="text-muted mb-3 flex items-center justify-between gap-2 text-xs">
                <span>{{ store.done }} of {{ store.total }} questions complete</span>
                <span>{{ percentage }}%</span>
              </div>
              <progress
                :value="store.done"
                :max="store.total"
                aria-label="Questionnaire progress"
                class="questionnaire-progress"
              />
              <p class="text-muted mt-4 text-xs leading-relaxed">
                Drafts stay in this browser. When you submit, your contact details and answers are saved for the
                questionnaire administrators.
              </p>
            </div>
          </div>
        </aside>

        <main class="min-w-0">
          <p v-if="status" role="status" class="border-default bg-default mb-5 rounded-xl border p-4 text-sm">
            {{ status }}
          </p>
          <div class="mb-8">
            <h1 ref="heading" tabindex="-1" class="text-3xl font-semibold tracking-tight outline-none sm:text-4xl">
              {{
                store.stage === 0
                  ? 'About you and your solution'
                  : store.stage === 3
                    ? 'Review your response'
                    : stages[store.stage]
              }}
            </h1>
            <p v-if="store.stage === 3 && store.submittedId === null" class="text-muted mt-4 max-w-2xl leading-relaxed">
              Check your details and answers, then submit your response. You can return to any section to make changes.
            </p>
          </div>

          <UCard v-if="store.submittedId !== null">
            <UAlert
              color="success"
              icon="i-heroicons-check-circle"
              title="Thank you. Your response has been submitted."
              :description="`Your answers have been saved. Response reference: ${store.submittedId}.`"
            />
            <UButton class="mt-5" color="neutral" variant="outline" icon="i-heroicons-arrow-down-tray" @click="download"
              >Download answers</UButton
            >
          </UCard>
          <form v-else @submit.prevent="store.stage === 3 ? submit() : goTo(Math.min(store.stage + 1, 3))">
            <fieldset :disabled="store.isSubmitting" class="min-w-0">
              <div v-if="store.stage === 0">
                <QuestionnaireIdentity :show-errors="scopeError" />
                <UCard>
                  <fieldset>
                    <legend class="text-muted mb-6 text-sm">Please select every category that applies.</legend>
                    <div class="space-y-3">
                      <UCheckbox
                        v-for="(scope, index) in scopes"
                        :key="scope"
                        :model-value="store.selectedScopes.includes(scope)"
                        :label="`${scope}. ${scopeLabels[index]}`"
                        :description="scopeDescriptions[index]"
                        variant="card"
                        class="w-full p-5"
                        @update:model-value="store.toggleScope(scope, $event === true)"
                      />
                    </div>
                    <p v-if="scopeError && !store.selectedScopes.length" role="alert" class="text-error mt-4 text-sm">
                      Select at least one solution category to continue.
                    </p>
                  </fieldset>
                </UCard>
              </div>

              <div v-else-if="store.stage < 3" class="space-y-6">
                <UCard v-for="section in visibleSections" :key="section.id">
                  <template #header>
                    <h2 class="text-lg font-semibold">{{ section.title }}</h2>
                    <p v-if="section.stage === 2 && section.scopes" class="text-muted mt-2 text-sm">
                      {{ sectionReason(section) }}
                    </p>
                  </template>
                  <QuestionnaireField
                    v-for="question in section.questions"
                    :key="question.id"
                    :question="question"
                    :answer="store.answerFor(question.id)"
                    @update="store.answers[question.id] = $event"
                  />
                </UCard>
              </div>

              <div v-else class="space-y-6">
                <QuestionnaireIdentity readonly />
                <UAlert
                  :color="complete ? 'success' : 'warning'"
                  :title="
                    complete
                      ? 'All applicable questions are complete. Your response is ready to submit.'
                      : 'Some answers are incomplete. You can return to fill them in, or submit your current response with those questions unanswered.'
                  "
                />
                <UCard>
                  <template #header
                    ><h2 class="font-semibold">{{ stages[0] }}</h2></template
                  >
                  <p v-for="scope in store.selectedScopes" :key="scope" class="mb-2 text-sm">
                    {{ scope }}. {{ scopeLabels[scopes.indexOf(scope)] }}
                  </p>
                  <UButton variant="link" class="mt-3 p-0" @click="goTo(0)">Edit section</UButton>
                </UCard>
                <UCard v-for="section in store.applicableSections" :key="section.id">
                  <template #header>
                    <div class="flex flex-wrap items-center justify-between gap-3">
                      <h2 class="font-semibold">{{ section.title }}</h2>
                      <UButton variant="link" @click="goTo(section.stage)">Edit section</UButton>
                    </div>
                  </template>
                  <div v-for="question in section.questions" :key="question.id" class="question-field">
                    <h3 class="text-sm font-medium">{{ question.label }}</h3>
                    <p v-if="!isAnswered(question, store.answerFor(question.id))" class="text-warning mt-2 text-xs">
                      Incomplete answer
                    </p>
                    <ul class="text-muted mt-3 space-y-2 text-sm leading-relaxed">
                      <li
                        v-for="(line, index) in answerLines(question, store.answerFor(question.id))"
                        :key="index"
                        class="whitespace-pre-wrap"
                      >
                        {{ line }}
                      </li>
                      <li v-if="!answerLines(question, store.answerFor(question.id)).length">Not answered</li>
                    </ul>
                  </div>
                </UCard>
              </div>

              <footer class="border-default mt-8 flex items-center justify-between gap-3 border-t pt-6">
                <UButton
                  color="neutral"
                  variant="ghost"
                  :disabled="store.stage === 0"
                  icon="i-heroicons-arrow-left"
                  @click="goTo(store.stage - 1)"
                  >Back</UButton
                >
                <UButton v-if="store.stage < 3" type="submit" size="lg" trailing-icon="i-heroicons-arrow-right">{{
                  store.stage === 2 ? 'Review answers' : 'Continue'
                }}</UButton>
                <div v-else class="flex flex-wrap justify-end gap-3">
                  <UButton
                    color="neutral"
                    variant="outline"
                    icon="i-heroicons-arrow-down-tray"
                    :disabled="store.isSubmitting"
                    @click="download"
                    >{{ complete ? 'Download answers' : 'Download incomplete draft' }}</UButton
                  >
                  <UButton type="submit" size="lg" icon="i-heroicons-paper-airplane" :loading="store.isSubmitting"
                    >Submit response</UButton
                  >
                </div>
              </footer>
            </fieldset>
          </form>
        </main>
      </div>
    </div>
  </UApp>
</template>
