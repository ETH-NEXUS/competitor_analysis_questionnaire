import { questionnaireResponsesCreate } from '~/api/generated/questionnaire-responses'
import {
  activeAnswer,
  answerLines,
  emptyAnswer,
  isAnswered,
  scopes,
  sections,
  type Answer,
  type Scope,
} from '~/utils/questionnaire'

const draftKey = 'hospital-it-questionnaire-v1'

export const useQuestionnaireStore = defineStore('questionnaire', () => {
  const selectedScopes = ref<Scope[]>([])
  const answers = ref<Record<string, Answer>>({})
  const stage = ref(0)
  const identity = ref({ respondentName: '', respondentEmail: '', providerName: '', solutionName: '' })
  const submissionId = ref('')
  const submittedId = ref<number | null>(null)
  const isSubmitting = ref(false)
  const identityErrors = computed(() => ({
    respondentEmail:
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identity.value.respondentEmail.trim()) &&
      identity.value.respondentEmail.trim().length <= 254
        ? undefined
        : 'Enter a valid email address.',
    providerName:
      identity.value.providerName.trim().length > 0 && identity.value.providerName.trim().length <= 200
        ? undefined
        : 'Enter a company / provider name (up to 200 characters).',
  }))
  const identityValid = computed(() => !Object.values(identityErrors.value).some(Boolean))
  const applicableSections = computed(() =>
    sections
      .filter((section) => !section.scopes || section.scopes.some((scope) => selectedScopes.value.includes(scope)))
      .map((section) => ({
        ...section,
        questions: section.questions.filter(
          (question) =>
            !question.when ||
            answerFor(question.when.question).selected.some((value) => question.when!.selected.includes(value)),
        ),
      })),
  )
  const questions = computed(() => applicableSections.value.flatMap((section) => section.questions))
  const completed = computed(
    () => questions.value.filter((question) => isAnswered(question, answerFor(question.id))).length,
  )
  const total = computed(() => questions.value.length + 2)
  const done = computed(() => completed.value + Number(selectedScopes.value.length > 0) + Number(identityValid.value))

  function answerFor(id: string): Answer {
    return answers.value[id] || emptyAnswer()
  }
  function toggleScope(scope: Scope, checked: boolean) {
    selectedScopes.value = checked
      ? [...new Set([...selectedScopes.value, scope])]
      : selectedScopes.value.filter((item) => item !== scope)
  }
  function save() {
    localStorage.setItem(
      draftKey,
      JSON.stringify({
        version: 1,
        scopes: selectedScopes.value,
        answers: answers.value,
        identity: identity.value,
        submissionId: submissionId.value,
        submittedId: submittedId.value,
      }),
    )
  }
  async function submit() {
    if (isSubmitting.value || submittedId.value !== null) return
    if (!identityValid.value || !selectedScopes.value.length) throw new Error('Missing respondent details or scope')
    isSubmitting.value = true
    try {
      submissionId.value ||= crypto.randomUUID()
      try {
        save()
      } catch {
        /* Submission still works when browser storage is unavailable. */
      }
      const response = await questionnaireResponsesCreate({
        submission_id: submissionId.value,
        respondent_name: identity.value.respondentName.trim(),
        respondent_email: identity.value.respondentEmail.trim(),
        provider_name: identity.value.providerName.trim(),
        solution_name: identity.value.solutionName.trim(),
        hospital_wide_cis: selectedScopes.value.includes('A'),
        patient_administration: selectedScopes.value.includes('B'),
        specialized_clinical: selectedScopes.value.includes('C'),
        data_interoperability: selectedScopes.value.includes('D'),
        patient_facing: selectedScopes.value.includes('E'),
        answers: Object.fromEntries(
          questions.value.map((question) => [
            question.id,
            {
              ...activeAnswer(question, answerFor(question.id)),
              question: question.label,
              readable_answer: answerLines(question, answerFor(question.id)),
            },
          ]),
        ),
      })
      submittedId.value = response.id
      try {
        save()
      } catch {
        /* The backend receipt remains available for this session. */
      }
    } finally {
      isSubmitting.value = false
    }
  }
  function restore(): boolean {
    const raw = localStorage.getItem(draftKey)
    if (!raw) return false
    const draft = JSON.parse(raw)
    if (draft.version !== 1 || !Array.isArray(draft.scopes) || !draft.answers || typeof draft.answers !== 'object') {
      throw new Error('Invalid questionnaire draft')
    }
    const restored: Record<string, Answer> = {}
    for (const question of sections.flatMap((section) => section.questions)) {
      const value = draft.answers[question.id]
      if (!value) continue
      if (
        !Array.isArray(value.selected) ||
        !value.selected.every((item: unknown) => typeof item === 'string') ||
        typeof value.text !== 'string' ||
        !value.details ||
        !value.rows
      )
        throw new Error('Invalid answer')
      const answer = emptyAnswer()
      answer.selected = [...new Set<string>(value.selected)].filter(
        (item) => /^\d+$/.test(item) && Number(item) < question.choices.length,
      )
      if (question.kind === 'single') answer.selected = answer.selected.slice(0, 1)
      answer.text = value.text
      for (let i = 0; i < question.choices.length; i++) {
        if (typeof value.details[i] === 'string') answer.details[i] = value.details[i]
        const row = value.rows[i]
        if (!row || typeof row !== 'object') continue
        answer.rows[i] = {}
        for (const field of ['cost', 'provided', 'name', 'description', 'source', 'standalone']) {
          if (typeof row[field] === 'string') answer.rows[i][field] = row[field]
        }
      }
      restored[question.id] = answer
    }
    selectedScopes.value = scopes.filter((scope) => draft.scopes.includes(scope))
    answers.value = restored
    for (const field of Object.keys(identity.value) as (keyof typeof identity.value)[]) {
      if (typeof draft.identity?.[field] === 'string') identity.value[field] = draft.identity[field]
    }
    if (typeof draft.submissionId === 'string' && /^[0-9a-f-]{36}$/i.test(draft.submissionId))
      submissionId.value = draft.submissionId
    if (Number.isSafeInteger(draft.submittedId) && draft.submittedId > 0) submittedId.value = draft.submittedId
    return true
  }

  return {
    selectedScopes,
    identity,
    identityValid,
    identityErrors,
    submissionId,
    submittedId,
    isSubmitting,
    submit,
    answers,
    stage,
    applicableSections,
    questions,
    completed,
    total,
    done,
    answerFor,
    toggleScope,
    save,
    restore,
  }
})
