import { questionnaireResponsesCreate } from '~/api/generated/questionnaire-responses'
import { remapV11Selection, retiredV11Option, v11SourceIndex } from '~/utils/draft-option-migration'
import {
  activeAnswer,
  answerLines,
  costOptions,
  emptyAnswer,
  emptyOffering,
  emptyClinicalWorkflow,
  emptyProduct,
  emptyTestingEvent,
  isAnswered,
  legacyClinicalOfferings,
  otherIndex,
  scopes,
  sections,
  type Answer,
  type ClinicalOffering,
  type Product,
  type Scope,
  type TestingEvent,
} from '~/utils/questionnaire'

const draftKey = 'hospital-it-questionnaire-v14'
const previousDraftKeys = [
  'hospital-it-questionnaire-v13',
  'hospital-it-questionnaire-v12',
  'hospital-it-questionnaire-v11',
  'hospital-it-questionnaire-v10',
  'hospital-it-questionnaire-v9',
  'hospital-it-questionnaire-v8',
  'hospital-it-questionnaire-v7',
  'hospital-it-questionnaire-v6',
  'hospital-it-questionnaire-v5',
  'hospital-it-questionnaire-v4',
  'hospital-it-questionnaire-v3',
  'hospital-it-questionnaire-v2',
  'hospital-it-questionnaire-v1',
]

export const useQuestionnaireStore = defineStore('questionnaire', () => {
  const selectedScopes = ref<Scope[]>([])
  const answers = ref<Record<string, Answer>>({})
  const stage = ref(0)
  const identity = ref({ respondentName: '', respondentEmail: '', providerName: '', solutionName: '' })
  const submissionId = ref('')
  const submittedId = ref<number | null>(null)
  const isSubmitting = ref(false)
  const draftStorageError = ref(false)
  let autosaveStarted = false
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
    solutionName:
      identity.value.solutionName.trim().length > 0 && identity.value.solutionName.trim().length <= 200
        ? undefined
        : 'Enter one solution / product name (up to 200 characters).',
  }))
  const identityValid = computed(() => !Object.values(identityErrors.value).some(Boolean))
  const documentationKinds = computed(
    () =>
      new Set(
        answerForDisplay('clinicalCapabilities')
          .offerings.filter((offering) =>
            [...offering.functions, ...offering.other_functions].some(
              (item) => item.trim().toLowerCase() === 'clinical documentation',
            ),
          )
          .map((offering) => offering.kind),
      ),
  )
  const applicableSections = computed(() =>
    sections
      .filter((section) => !section.scopes || section.scopes.some((scope) => selectedScopes.value.includes(scope)))
      .map((section) => ({
        ...section,
        questions: section.questions
          .filter(
            (question) =>
              (!question.scopes || question.scopes.some((scope) => selectedScopes.value.includes(scope))) &&
              (question.id !== 'documentationMethods' ||
                documentationKinds.value.has('core') ||
                documentationKinds.value.has('function')) &&
              (!question.when ||
                answerFor(question.when.question).selected.some((value) => question.when!.selected.includes(value))),
          )
          .map((question) =>
            question.id === 'documentationMethods'
              ? {
                  ...question,
                  label: documentationKinds.value.has('core')
                    ? documentationKinds.value.has('function')
                      ? 'Which capabilities in your core CIS and specialized functions reduce documentation burden?'
                      : 'Which capabilities in your core CIS reduce documentation burden?'
                    : 'Which capabilities in your specialized functions reduce documentation burden?',
                }
              : question.id === 'clinicalCapabilities'
                ? {
                    ...question,
                    label: selectedScopes.value.includes('A')
                      ? selectedScopes.value.includes('B')
                        ? question.label
                        : 'Describe your core CIS coverage and external integrations.'
                      : 'Describe your specialized functions and the areas they cover.',
                  }
                : question,
          ),
      }))
      .filter((section) => section.questions.length > 0),
  )
  const questions = computed(() => applicableSections.value.flatMap((section) => section.questions))
  const completed = computed(
    () => questions.value.filter((question) => isAnswered(question, answerForDisplay(question.id))).length,
  )
  const total = computed(() => questions.value.length + 2)
  const done = computed(() => completed.value + Number(selectedScopes.value.length > 0) + Number(identityValid.value))

  function answerFor(id: string): Answer {
    return answers.value[id] || emptyAnswer()
  }
  function answerForDisplay(id: string): Answer {
    const answer = answerFor(id)
    if (id !== 'clinicalCapabilities') return answer
    return {
      ...answer,
      offerings: answer.offerings
        .filter((offering) =>
          offering.kind === 'function'
            ? selectedScopes.value.includes('B') || selectedScopes.value.includes('A')
            : selectedScopes.value.includes('A'),
        )
        .map((offering) => ({
          ...offering,
          category_b: offering.kind === 'function' && selectedScopes.value.includes('B'),
        })),
    }
  }
  function toggleScope(scope: Scope, checked: boolean) {
    selectedScopes.value = checked
      ? [...new Set([...selectedScopes.value, scope])]
      : selectedScopes.value.filter((item) => item !== scope)
  }
  function saveDraft() {
    try {
      localStorage.setItem(
        draftKey,
        JSON.stringify({
          version: 14,
          scopes: selectedScopes.value,
          answers: answers.value,
          identity: identity.value,
          stage: stage.value,
          submissionId: submissionId.value,
          submittedId: submittedId.value,
        }),
      )
      previousDraftKeys.forEach((key) => localStorage.removeItem(key))
      draftStorageError.value = false
    } catch {
      draftStorageError.value = true
    }
  }
  function restoreDraft(): boolean {
    const raw =
      localStorage.getItem(draftKey) || previousDraftKeys.map((key) => localStorage.getItem(key)).find(Boolean)
    if (!raw) return false
    const draft = JSON.parse(raw)
    if (
      ![1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].includes(draft.version) ||
      !Array.isArray(draft.scopes) ||
      !draft.answers ||
      typeof draft.answers !== 'object'
    ) {
      throw new Error('Invalid questionnaire draft')
    }
    const restored: Record<string, Answer> = {}
    for (const question of sections.flatMap((section) => section.questions)) {
      const value = draft.answers[question.id]
      if (!value) continue
      if (!Array.isArray(value.selected) || typeof value.text !== 'string' || !value.details || !value.rows)
        throw new Error('Invalid answer')
      const answer = emptyAnswer()
      if (question.kind === 'offerings') {
        answer.offerings = Array.isArray(value.offerings)
          ? value.offerings
              .slice(0, 100)
              .filter((item: unknown) => item && typeof item === 'object')
              .map((item: Partial<ClinicalOffering>) => ({
                ...emptyOffering(
                  item.kind === 'core'
                    ? 'core'
                    : item.kind === 'integration' || item.source === 'partner'
                      ? 'integration'
                      : 'function',
                ),
                name: typeof item.name === 'string' ? item.name : '',
                description: typeof item.description === 'string' ? item.description : '',
                purposes: Array.isArray(item.purposes)
                  ? item.purposes.filter((purpose): purpose is string => typeof purpose === 'string')
                  : [],
                purpose_other: typeof item.purpose_other === 'string' ? item.purpose_other : '',
                source: item.kind === 'integration' || item.source === 'partner' ? 'partner' : 'native',
                developer: typeof item.developer === 'string' ? item.developer : '',
                functions: Array.isArray(item.functions)
                  ? item.functions.filter((tag): tag is string => typeof tag === 'string')
                  : [],
                specialties: Array.isArray(item.specialties)
                  ? item.specialties.filter((tag): tag is string => typeof tag === 'string')
                  : [],
                other_functions: Array.isArray(item.other_functions)
                  ? item.other_functions.filter((tag): tag is string => typeof tag === 'string')
                  : [],
                other_specialties: Array.isArray(item.other_specialties)
                  ? item.other_specialties.filter((tag): tag is string => typeof tag === 'string')
                  : [],
                all_specialties: item.all_specialties === true,
                standalone: item.standalone === true,
                category_b: item.category_b === true,
                cis_relationship:
                  draft.version < 14 && item.cis_integration === 'no'
                    ? 'none'
                    : draft.version < 14 && item.cis_relationship === 'independent'
                      ? 'either'
                      : typeof item.cis_relationship === 'string'
                        ? item.cis_relationship
                        : '',
                cis_relationship_other:
                  typeof item.cis_relationship_other === 'string' ? item.cis_relationship_other : '',
                cis_integration: '',
                workflow: {
                  ...emptyClinicalWorkflow(),
                  reused_data: Array.isArray(item.workflow?.reused_data)
                    ? item.workflow.reused_data.filter((value): value is string => typeof value === 'string')
                    : [],
                  other_reused_data:
                    typeof item.workflow?.other_reused_data === 'string' ? item.workflow.other_reused_data : '',
                  write_back: typeof item.workflow?.write_back === 'string' ? item.workflow.write_back : '',
                  separate_app: typeof item.workflow?.separate_app === 'string' ? item.workflow.separate_app : '',
                  patient_context:
                    typeof item.workflow?.patient_context === 'string' ? item.workflow.patient_context : '',
                  manual_steps: typeof item.workflow?.manual_steps === 'string' ? item.workflow.manual_steps : '',
                },
              }))
          : legacyClinicalOfferings(draft.answers)
      }
      const migratedSelected = value.selected.map((item: unknown) => {
        if (typeof item !== 'string') return item
        if (draft.version < 12 && question.id === 'dataCapabilities' && item === '12') return '13'
        if (draft.version < 10) {
          if (question.id === 'configuration') return item === '2' ? '3' : item === '3' ? '4' : item
          if (question.id === 'patientFunctions') return item === '9' ? '14' : item
          if (question.id === 'writeBack') return item === '0' ? '' : item === '1' ? '2' : item === '2' ? '4' : item
          if (question.id === 'patientIndependent') return item === '1' ? '' : item === '2' ? '3' : item
        }
        if (draft.version < 8) {
          if (question.id === 'thirdPartyIntegration') return item === '8' ? '9' : item === '9' ? '8' : item
          if (question.id === 'thirdPartyApproval') return item === '5' ? '' : item === '6' ? '5' : item
        }
        return draft.version < 11 ? remapV11Selection(question.id, item) : item
      })
      answer.selected = [
        ...new Set<string>(migratedSelected.filter((item: unknown) => typeof item === 'string')),
      ].filter((item) => /^\d+$/.test(item) && Number(item) < question.choices.length)
      if (draft.version < 13 && question.id === 'patientIndependent') {
        const old = value.selected[0]
        answer.selected = old === '0' ? ['0'] : old === '1' || old === '2' ? ['1'] : old === '3' ? ['2'] : []
        if (old === '1' || old === '2')
          answer.details.legacy = `Previous answer: ${old === '1' ? 'Requires the vendor’s CIS' : 'Requires another specific CIS/platform'}. Please specify the required CIS.`
      }
      if (draft.version < 12 && question.id === 'dataRetention') {
        const oldSelected = value.selected as string[]
        const retained = [
          oldSelected.includes('0') ? 'documents' : '',
          oldSelected.includes('1') ? 'record' : '',
          oldSelected.includes('2') ? 'other' : '',
        ].filter(Boolean)
        answer.selected =
          oldSelected.includes('1') || oldSelected.includes('2')
            ? ['0']
            : oldSelected.includes('0')
              ? ['1']
              : oldSelected.includes('3')
                ? ['2']
                : oldSelected.includes('4')
                  ? ['3']
                  : []
        if (answer.selected[0] === '1') answer.details['1'] = 'Individual clinical documents or diagnostic images'
        answer.followups.retained = retained
      }
      if (draft.version < 12 && question.id === 'requirements') {
        const oldSelected = value.selected as string[]
        answer.selected = oldSelected.some((item) => item !== '0') ? ['1'] : oldSelected.includes('0') ? ['0'] : []
        answer.followups['1'] = oldSelected
          .filter((item) => /^\d+$/.test(item) && Number(item) >= 1 && Number(item) <= 10)
          .map((item) => String(Number(item) - 1))
      }
      if (question.kind === 'single') answer.selected = answer.selected.slice(0, 1)
      answer.text = value.text
      if (draft.version < 10 && question.id === 'writeBack' && value.selected.includes('0'))
        answer.details.legacy = 'Previous answer: Yes. Please choose whether this is automatic or follows review.'
      if (draft.version < 10 && question.id === 'patientIndependent' && value.selected.includes('1'))
        answer.details.legacy = 'Previous answer: No. Please choose which CIS or platform is required.'
      for (let i = 0; i < question.choices.length; i++) {
        let sourceIndex = i
        if (draft.version < 10) {
          if (question.id === 'configuration' && i === 4) sourceIndex = 3
          if (question.id === 'patientFunctions' && i === 14) sourceIndex = 9
          if (question.id === 'patientIndependent' && i === 3) sourceIndex = 2
        }
        if (draft.version < 11) sourceIndex = v11SourceIndex(question.id, i)
        if (draft.version < 12 && question.id === 'dataCapabilities' && i === 13) sourceIndex = 12
        if (draft.version < 8) {
          if (question.id === 'costs' && i >= 1) sourceIndex = i + 1
          if (question.id === 'thirdPartyIntegration' && i === 8) sourceIndex = 9
          if (question.id === 'thirdPartyIntegration' && i === 9) sourceIndex = 8
          if (question.id === 'thirdPartyApproval' && i === 5) sourceIndex = 6
        }
        if (typeof value.details[sourceIndex] === 'string') answer.details[i] = value.details[sourceIndex]
        const oldRow = value.rows[sourceIndex]
        if (oldRow && typeof oldRow === 'object') {
          const restoredRow: Record<string, string> = {}
          for (const field of ['cost', 'billing_unit', 'provided', 'name', 'description', 'source', 'standalone']) {
            if (typeof oldRow[field] === 'string') restoredRow[field] = oldRow[field]
          }
          if (question.kind === 'costs' && !costOptions[Number(restoredRow.cost)]) {
            delete restoredRow.cost
            delete restoredRow.billing_unit
          }
          answer.rows[i] = restoredRow
        }
        const savedProducts = value.products?.[i]
        if (Array.isArray(savedProducts)) {
          answer.products[i] = savedProducts.slice(0, 100).map(
            (item: Record<string, unknown>): Product => ({
              name: typeof item?.name === 'string' ? item.name : '',
              description: typeof item?.description === 'string' ? item.description : '',
              source: item?.source === '0' || item?.source === '1' ? item.source : '',
              standalone: item?.standalone === true,
            }),
          )
        } else if (question.kind === 'capabilities' && oldRow && (oldRow.name || oldRow.description || oldRow.source)) {
          answer.products[i] = [
            {
              ...emptyProduct(),
              name: oldRow.name || '',
              description: oldRow.description || '',
              source: oldRow.source === '0' || oldRow.source === '1' ? oldRow.source : '',
              standalone: oldRow.standalone === 'yes',
            },
          ]
        }
      }
      for (const key of ['fhir_other', 'hl7v2_other', 'requirements_other']) {
        if (typeof value.details[key] === 'string') answer.details[key] = value.details[key]
      }
      if (draft.version < 12 && question.id === 'requirements' && typeof value.details['10'] === 'string')
        answer.details.requirements_other = value.details['10']
      if (draft.version < 12 && question.id === 'dataRetention' && answer.selected[0] === '1')
        answer.details['1'] = 'Individual clinical documents or diagnostic images'
      if (Array.isArray(value.other_items)) {
        answer.other_items = value.other_items.filter((item: unknown) => typeof item === 'string').slice(0, 100)
      } else {
        const index = otherIndex(question)
        const legacyOther =
          index >= 0 && question.kind === 'capabilities' ? answer.rows[index]?.description : answer.details[index]
        if (legacyOther) answer.other_items = [legacyOther]
      }
      if (draft.version < 11) {
        for (const oldIndex of value.selected) {
          const label = retiredV11Option(question.id, oldIndex)
          if (label && question.kind === 'single') answer.other_items = [label]
          else if (label && !answer.other_items.includes(label)) answer.other_items.push(label)
        }
      }
      if (question.kind === 'single') answer.other_items = answer.other_items.slice(0, 1)
      if (question.id === 'standards') {
        const saved = value.followups?.['0']
        if (Array.isArray(saved))
          answer.followups['0'] = [
            ...new Set(
              saved.filter(
                (item: unknown) => typeof item === 'string' && ['R2', 'R3', 'R4', 'R4B', 'R5', 'Other'].includes(item),
              ),
            ),
          ]
        else if (answer.details['0']?.trim()) {
          const legacy = answer.details['0'].trim()
          answer.followups['0'] = ['R2', 'R3', 'R4', 'R4B', 'R5'].includes(legacy) ? [legacy] : ['Other']
          if (answer.followups['0'].includes('Other')) answer.details.fhir_other = legacy
        }
        const savedV2 = value.followups?.['1']
        if (Array.isArray(savedV2))
          answer.followups['1'] = [...new Set(savedV2.filter((item: unknown) => typeof item === 'string'))]
        else if (answer.details['1']?.trim()) {
          const legacy = answer.details['1'].trim()
          const known = ['ADT', 'ORM', 'ORU', 'OML', 'MDM', 'SIU', 'DFT', 'BAR', 'RDE', 'RAS', 'VXU']
          const matched = known.filter((item) => new RegExp(`\\b${item}\\b`, 'i').test(legacy))
          answer.followups['1'] = matched.length ? matched : ['Other']
          if (!matched.length) answer.details.hl7v2_other = legacy
        }
      }
      if (question.id === 'requirements' && draft.version >= 12 && Array.isArray(value.followups?.['1']))
        answer.followups['1'] = value.followups['1'].filter((item: unknown) => /^\d$/.test(String(item)))
      if (
        question.id === 'certifications' &&
        value.certification_details &&
        typeof value.certification_details === 'object'
      ) {
        for (const [index, entry] of Object.entries(
          value.certification_details as Record<string, Record<string, unknown>>,
        )) {
          if (!/^[0-6]$/.test(index) || !entry || typeof entry !== 'object') continue
          answer.certification_details[index] = {
            name: typeof entry.name === 'string' ? entry.name : '',
            scopes: Array.isArray(entry.scopes)
              ? entry.scopes.filter((item): item is string =>
                  ['organization', 'solution', 'other'].includes(String(item)),
                )
              : [],
            scope_other: typeof entry.scope_other === 'string' ? entry.scope_other : '',
            valid_until: typeof entry.valid_until === 'string' ? entry.valid_until : '',
          }
        }
      }
      if (question.id === 'interoperabilityTesting' && answer.selected.includes('0')) {
        answer.testing_events = Array.isArray(value.testing_events)
          ? value.testing_events.slice(0, 30).map((item: Partial<TestingEvent>) => ({
              ...emptyTestingEvent(),
              ...Object.fromEntries(
                Object.keys(emptyTestingEvent()).map((field) => [
                  field,
                  typeof item?.[field as keyof TestingEvent] === 'string' ? item[field as keyof TestingEvent] : '',
                ]),
              ),
            }))
          : [emptyTestingEvent()]
        if (!Array.isArray(value.testing_events) && answer.details['0'])
          answer.details.legacy = `Previous testing details: ${answer.details['0']}`
      }
      restored[question.id] = answer
    }
    for (const id of ['structure', 'coding', 'reporting', 'documentation', 'aggregation', 'parties', 'specialties']) {
      const legacy = draft.answers[id]
      if (legacy && typeof legacy === 'object') restored[id] = legacy as Answer
    }
    if (draft.version < 6) {
      const hasAnswer = (id: string) => {
        const question = sections.flatMap((section) => section.questions).find((item) => item.id === id)
        return Boolean(question && restored[id] && isAnswered(question, restored[id]))
      }
      const retained = [
        hasAnswer('archive') ? 'documents' : '',
        hasAnswer('export') || hasAnswer('exportDetails') ? 'record' : '',
        hasAnswer('switzerland') ? 'other' : '',
      ].filter(Boolean)
      if (retained.length)
        restored.dataRetention = {
          ...emptyAnswer(),
          selected: ['0'],
          followups: { retained },
        }
    }
    const savedScopes =
      draft.version < 12
        ? draft.scopes
            .map((scope: string) => (({ A: 'A', C: 'B', D: 'C', E: 'D' }) as Record<string, Scope>)[scope])
            .filter(Boolean)
        : draft.scopes
    selectedScopes.value = scopes.filter((scope) => savedScopes.includes(scope))
    answers.value = restored
    for (const field of Object.keys(identity.value) as (keyof typeof identity.value)[]) {
      if (typeof draft.identity?.[field] === 'string') identity.value[field] = draft.identity[field]
    }
    if (Number.isInteger(draft.stage) && draft.stage >= 0 && draft.stage <= 3)
      stage.value = identityValid.value ? draft.stage : 0
    if (typeof draft.submissionId === 'string' && /^[0-9a-f-]{36}$/i.test(draft.submissionId))
      submissionId.value = draft.submissionId
    if (Number.isSafeInteger(draft.submittedId) && draft.submittedId > 0) submittedId.value = draft.submittedId
    return true
  }
  function startAutosave() {
    if (autosaveStarted) return
    autosaveStarted = true
    saveDraft()
    watch([selectedScopes, answers, identity, stage, submissionId, submittedId], saveDraft, {
      deep: true,
      flush: 'sync',
    })
  }
  function resetForAnotherSolution() {
    if (submittedId.value === null) return
    selectedScopes.value = []
    answers.value = {}
    identity.value = { ...identity.value, solutionName: '' }
    stage.value = 0
    submissionId.value = ''
    submittedId.value = null
    saveDraft()
  }
  async function submit() {
    if (isSubmitting.value || submittedId.value !== null) return
    if (!identityValid.value || !selectedScopes.value.length) throw new Error('Missing respondent details or scope')
    isSubmitting.value = true
    try {
      submissionId.value ||= crypto.randomUUID()
      const response = await questionnaireResponsesCreate({
        submission_id: submissionId.value,
        respondent_name: identity.value.respondentName.trim(),
        respondent_email: identity.value.respondentEmail.trim(),
        provider_name: identity.value.providerName.trim(),
        solution_name: identity.value.solutionName.trim(),
        hospital_wide_cis: selectedScopes.value.includes('A'),
        specialized_clinical: selectedScopes.value.includes('B'),
        data_interoperability: selectedScopes.value.includes('C'),
        patient_facing: selectedScopes.value.includes('D'),
        answers: Object.fromEntries(
          questions.value.map((question) => [
            question.id,
            {
              ...activeAnswer(question, answerForDisplay(question.id)),
              question: question.label,
              readable_answer: answerLines(question, answerForDisplay(question.id)),
            },
          ]),
        ),
      })
      submittedId.value = response.id
    } finally {
      isSubmitting.value = false
    }
  }
  return {
    selectedScopes,
    identity,
    identityValid,
    identityErrors,
    submissionId,
    submittedId,
    isSubmitting,
    draftStorageError,
    submit,
    resetForAnotherSolution,
    answers,
    stage,
    applicableSections,
    questions,
    completed,
    total,
    done,
    answerFor,
    answerForDisplay,
    toggleScope,
    restoreDraft,
    startAutosave,
  }
})
