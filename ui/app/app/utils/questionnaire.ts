import coreQuestions from './questionnaire-core.json'
import specificQuestions from './questionnaire-specific.json'

export type Scope = 'A' | 'B' | 'C' | 'D' | 'E'
export type QuestionKind = 'single' | 'multi' | 'text' | 'costs' | 'capabilities'
export interface Question {
  id: string
  number: number
  kind: QuestionKind
  label: string
  choices: string[]
  details?: number[]
  detailLabels?: Record<string, string>
  exclusive?: number[]
  when?: { question: string; selected: string[] }
}
export interface QuestionSection {
  id: string
  title: string
  stage: number
  scopes?: Scope[]
  questions: Question[]
}
export interface Answer {
  selected: string[]
  text: string
  details: Record<string, string>
  rows: Record<string, Record<string, string>>
}
export const scopes: Scope[] = ['A', 'B', 'C', 'D', 'E']
const sectionDefinitions: (Omit<QuestionSection, 'questions' | 'title'> & {
  questions: Omit<Question, 'label' | 'choices' | 'number'>[]
})[] = [
  {
    id: 'interoperability',
    stage: 1,
    questions: [
      { id: 'apiAccess', kind: 'single', details: [4] },
      { id: 'apiTypes', kind: 'multi', details: [3], exclusive: [4] },
      { id: 'standards', kind: 'multi', details: [0, 1, 5, 6] },
      { id: 'deployment', kind: 'multi', details: [5] },
    ],
  },
  {
    id: 'ownership',
    stage: 1,
    questions: [
      { id: 'structure', kind: 'single' },
      { id: 'coding', kind: 'multi', details: [6], exclusive: [7] },
      { id: 'archive', kind: 'single', details: [4] },
      { id: 'export', kind: 'single', details: [4] },
      { id: 'exportDetails', kind: 'text', when: { question: 'export', selected: ['2', '3', '4'] } },
      { id: 'security', kind: 'multi', details: [9] },
      { id: 'switzerland', kind: 'single' },
    ],
  },
  {
    id: 'governance',
    stage: 1,
    questions: [
      { id: 'roadmap', kind: 'multi', details: [6] },
      { id: 'configuration', kind: 'single', details: [3] },
      { id: 'transition', kind: 'multi', details: [6], exclusive: [5] },
      { id: 'rights', kind: 'single', details: [6] },
    ],
  },
  {
    id: 'business',
    stage: 1,
    questions: [
      { id: 'pricing', kind: 'multi', details: [7] },
      { id: 'costs', kind: 'costs' },
      { id: 'term', kind: 'single', details: [4] },
      { id: 'exitCosts', kind: 'multi', details: [5] },
    ],
  },
  {
    id: 'analytics',
    stage: 1,
    questions: [
      { id: 'reporting', kind: 'multi', details: [6], exclusive: [0] },
      { id: 'research', kind: 'multi', details: [6], exclusive: [7] },
      { id: 'secondary', kind: 'multi', details: [4], exclusive: [5] },
    ],
  },
  {
    id: 'clinical',
    stage: 2,
    scopes: ['A', 'B', 'C'],
    questions: [
      { id: 'clinicalCapabilities', kind: 'capabilities' },
      { id: 'specialties', kind: 'capabilities', details: [10] },
      { id: 'documentation', kind: 'multi', details: [6] },
    ],
  },
  {
    id: 'data',
    stage: 2,
    scopes: ['D'],
    questions: [
      { id: 'dataCapabilities', kind: 'multi', details: [12] },
      { id: 'architecture', kind: 'text' },
      { id: 'dataIndependent', kind: 'single', details: [2] },
    ],
  },
  {
    id: 'patient',
    stage: 2,
    scopes: ['E'],
    questions: [
      { id: 'patientFunctions', kind: 'multi', details: [9] },
      { id: 'languages', kind: 'multi', details: [4] },
      { id: 'aggregation', kind: 'single' },
      { id: 'writeBack', kind: 'single' },
      { id: 'patientIndependent', kind: 'single', details: [2] },
    ],
  },
  { id: 'implementation', stage: 2, questions: [{ id: 'parties', kind: 'multi', details: [5] }] },
  {
    id: 'rollout',
    stage: 2,
    scopes: ['A'],
    questions: [
      { id: 'rollout', kind: 'multi', details: [3] },
      { id: 'migration', kind: 'single', details: [4] },
      { id: 'goLive', kind: 'multi', details: [8] },
    ],
  },
  {
    id: 'integration',
    stage: 2,
    scopes: ['C', 'D', 'E'],
    questions: [{ id: 'requirements', kind: 'multi', details: [10] }],
  },
]

const questionText: Record<string, { label: string; options?: string[]; detailLabels?: Record<string, string> }> = {
  ...coreQuestions,
  ...specificQuestions,
}
const sectionTitles: Record<string, string> = {
  interoperability: '1.1 Interoperability & Openness',
  ownership: '1.2 Data ownership',
  governance: '1.3 Governance',
  business: '1.4 Cost & Business Model',
  analytics: '1.5 Analytics & Secondary Use',
  clinical: '2.1 HCP-facing solutions',
  data: '2.1 Data / interoperability',
  patient: '2.1 Patient-facing solutions',
  implementation: '2.3 Implementation & Migration',
  rollout: '2.3 Hospital-wide rollout & migration',
  integration: '2.3 Integration requirements',
}
export const scopeLabels = [
  'Hospital-wide clinical information system',
  'Patient administration / hospital management system',
  'Specialized clinical solution / modules',
  'Data / interoperability solution',
  'Patient-facing solution',
]
export const scopeDescriptions = [
  'The primary system for clinical documentation and workflows across multiple clinical areas.',
  'Administrative hospital processes, such as patient administration, ADT and billing.',
  'A specific clinical area, specialty or workflow.',
  'Data storage, integration, exchange or interoperability capabilities.',
  'Functionality directly available to patients through a portal or app.',
]
export const costOptions = [
  'Included',
  'One-time additional cost',
  'Recurring additional cost',
  'Depends on scope / contract',
]
export const sourceOptions = ['Native — developed by your company', 'Partner — third-party product']
export const sections: QuestionSection[] = sectionDefinitions.map((section) => ({
  ...section,
  title: sectionTitles[section.id]!,
  questions: section.questions.map((question) => ({
    ...question,
    number: sectionDefinitions.flatMap((item) => item.questions).findIndex((item) => item.id === question.id) + 1,
    label: questionText[question.id]!.label,
    choices: questionText[question.id]!.options || [],
    detailLabels: questionText[question.id]!.detailLabels,
  })),
}))

export function emptyAnswer(): Answer {
  return { selected: [], text: '', details: {}, rows: {} }
}

export function isAnswered(question: Question, answer: Answer): boolean {
  if (question.kind === 'text') return Boolean(answer.text.trim())
  if (question.kind === 'costs') {
    return Array.from({ length: question.choices.length }, (_, i) => answer.rows[i]?.cost).every(Boolean)
  }
  if (question.kind === 'capabilities') {
    return Array.from({ length: question.choices.length }, (_, i) => {
      const row = answer.rows[i]
      if (row?.provided !== 'yes') return true
      if (question.id === 'specialties') {
        return row?.provided === 'no' || (row?.provided === 'yes' && Boolean(row.description?.trim()))
      }
      return (
        row?.provided === 'no' ||
        (row?.provided === 'yes' &&
          row.name?.trim() &&
          row.description?.trim() &&
          (row.source === '0' || row.source === '1') &&
          (row.source === '1' || row.standalone))
      )
    }).every(Boolean)
  }
  return (
    answer.selected.length > 0 &&
    (question.details || []).every(
      (index) => !answer.selected.includes(String(index)) || Boolean(answer.details[index]?.trim()),
    )
  )
}

// Only applicable answers and selected option details belong in a response export.
export function activeAnswer(question: Question, answer: Answer): Answer {
  return {
    selected: [...answer.selected],
    text: answer.text,
    details: Object.fromEntries(Object.entries(answer.details).filter(([key]) => answer.selected.includes(key))),
    rows: Object.fromEntries(
      (question.kind === 'capabilities'
        ? question.choices.map((_, index): [string, Record<string, string>] => [
            String(index),
            answer.rows[index] || {},
          ])
        : Object.entries(answer.rows)
      ).map(([key, row]) => [
        key,
        question.kind === 'capabilities'
          ? row.provided !== 'yes'
            ? { provided: 'no' }
            : question.id === 'specialties'
              ? { provided: row.provided, description: row.description || '' }
              : Object.fromEntries(
                  Object.entries(row).filter(([field]) => field !== 'standalone' || row.source === '0'),
                )
          : { ...row },
      ]),
    ),
  }
}

export function answerLines(question: Question, answer: Answer): string[] {
  if (question.kind === 'text') return answer.text.trim() ? [answer.text] : []
  const options = question.choices
  if (question.kind === 'costs' || question.kind === 'capabilities') {
    const yesNo = ['Yes', 'No']
    return options.map((label, index) => {
      const row = answer.rows[index] || {}
      const missing = 'Not answered'
      if (question.kind === 'costs') return `${label}: ${costOptions[Number(row.cost)] || missing}`
      if (row.provided !== 'yes') return `${label}: No`
      if (question.id === 'specialties') return `${label}: Yes; Description: ${row.description || missing}`
      const standalone =
        row.source === '0'
          ? `; Can be purchased and operated independently: ${row.standalone ? yesNo[row.standalone === 'yes' ? 0 : 1] : missing}`
          : ''
      return `${label}: Yes; Product / module name: ${row.name || missing}; Brief description: ${row.description || missing}; Native / partner: ${sourceOptions[Number(row.source)] || missing}${standalone}`
    })
  }
  return answer.selected.map(
    (index) => `${options[Number(index)]}${answer.details[index] ? `: ${answer.details[index]}` : ''}`,
  )
}
