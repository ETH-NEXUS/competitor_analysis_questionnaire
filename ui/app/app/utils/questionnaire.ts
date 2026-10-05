import coreQuestions from './questionnaire-core.json'
import specificQuestions from './questionnaire-specific.json'

export type Scope = 'A' | 'B' | 'C' | 'D' | 'E'
export type QuestionKind = 'single' | 'multi' | 'text' | 'costs' | 'capabilities' | 'offerings'
export interface Question {
  id: string
  number: number
  kind: QuestionKind
  label: string
  help?: string
  optionalTextLabel?: string
  choices: string[]
  scopes?: Scope[]
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
  other_items: string[]
  products: Record<string, Product[]>
  offerings: ClinicalOffering[]
}
export interface ClinicalOffering {
  kind: 'core' | 'integration' | 'function'
  name: string
  description: string
  source: 'native' | 'partner'
  developer: string
  functions: string[]
  specialties: string[]
  other_functions: string[]
  other_specialties: string[]
  all_specialties: boolean
  standalone: boolean
  workflow: ClinicalWorkflow
}
export interface ClinicalWorkflow {
  reused_data: string[]
  write_back: string
  separate_app: string
  patient_context: string
  manual_steps: string
}
export interface Product {
  name: string
  description: string
  source: '' | '0' | '1'
  standalone: boolean
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
      { id: 'standards', kind: 'multi', details: [0, 1, 5], exclusive: [6] },
      { id: 'deployment', kind: 'multi', details: [5] },
      { id: 'interoperabilityTesting', kind: 'single', details: [0] },
    ],
  },
  {
    id: 'profile',
    stage: 1,
    questions: [{ id: 'dataRetention', kind: 'multi', exclusive: [3, 4] }],
  },
  {
    id: 'security',
    stage: 1,
    questions: [
      { id: 'security', kind: 'multi', details: [9] },
      { id: 'certifications', kind: 'multi', exclusive: [7, 8] },
    ],
  },
  {
    id: 'governance',
    stage: 1,
    questions: [
      { id: 'roadmap', kind: 'multi', details: [6] },
      { id: 'configuration', kind: 'single', details: [4] },
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
    id: 'cisEcosystem',
    stage: 2,
    scopes: ['A'],
    questions: [
      { id: 'thirdPartyIntegration', kind: 'multi', details: [8], exclusive: [9] },
      {
        id: 'developerIndependence',
        kind: 'single',
        details: [3],
        when: { question: 'thirdPartyIntegration', selected: ['0', '1', '2', '3', '4', '5', '6', '7', '8'] },
      },
      {
        id: 'developerResources',
        kind: 'multi',
        details: [9],
        exclusive: [8],
        when: { question: 'thirdPartyIntegration', selected: ['0', '1', '2', '3', '4', '5', '6', '7', '8'] },
      },
      {
        id: 'thirdPartyApproval',
        kind: 'multi',
        details: [5],
        when: { question: 'thirdPartyIntegration', selected: ['0', '1', '2', '3', '4', '5', '6', '7', '8'] },
      },
    ],
  },
  {
    id: 'appIntegration',
    stage: 2,
    questions: [
      {
        id: 'appIntegrationStandards',
        kind: 'multi',
        scopes: ['A', 'C', 'D', 'E'],
        details: [4],
        exclusive: [5],
      },
    ],
  },
  {
    id: 'clinicalData',
    stage: 2,
    questions: [
      {
        id: 'structuredTypes',
        kind: 'multi',
        scopes: ['A', 'C', 'D', 'E'],
        details: [10],
        exclusive: [11],
      },
      {
        id: 'terminologies',
        kind: 'multi',
        scopes: ['A', 'C', 'D', 'E'],
        details: [6],
        exclusive: [5, 7],
      },
      {
        id: 'clinicalModels',
        kind: 'multi',
        scopes: ['A', 'C', 'D', 'E'],
        details: [4],
        exclusive: [5],
      },
      {
        id: 'reportingMethods',
        kind: 'multi',
        details: [6],
        exclusive: [7],
      },
      {
        id: 'research',
        kind: 'multi',
        details: [6],
        exclusive: [7],
      },
      {
        id: 'secondary',
        kind: 'multi',
        details: [4],
        exclusive: [5],
      },
    ],
  },
  {
    id: 'recordRetention',
    stage: 2,
    questions: [
      { id: 'archive', kind: 'single', details: [4], when: { question: 'dataRetention', selected: ['0', '1'] } },
      { id: 'export', kind: 'single', details: [4], when: { question: 'dataRetention', selected: ['1'] } },
      { id: 'exportDetails', kind: 'text', when: { question: 'export', selected: ['2', '3', '4'] } },
      { id: 'switzerland', kind: 'single', when: { question: 'dataRetention', selected: ['0', '1', '2'] } },
    ],
  },
  {
    id: 'clinical',
    stage: 2,
    scopes: ['A', 'C'],
    questions: [
      { id: 'clinicalCapabilities', kind: 'offerings' },
      { id: 'documentationMethods', kind: 'multi', details: [7], exclusive: [8] },
    ],
  },
  {
    id: 'data',
    stage: 2,
    scopes: ['D'],
    questions: [
      { id: 'dataCapabilities', kind: 'multi', details: [12] },
      { id: 'dataExchangeHandling', kind: 'multi', details: [8], exclusive: [0] },
      { id: 'architecture', kind: 'text' },
      { id: 'dataIndependent', kind: 'single', details: [2] },
    ],
  },
  {
    id: 'patient',
    stage: 2,
    scopes: ['E'],
    questions: [
      { id: 'patientFunctions', kind: 'multi', details: [14] },
      { id: 'languages', kind: 'multi', details: [4] },
      { id: 'aggregationMethods', kind: 'multi', details: [5], exclusive: [4] },
      { id: 'writeBack', kind: 'single' },
      { id: 'patientIndependent', kind: 'single', details: [3] },
      { id: 'patientExchange', kind: 'multi', details: [5] },
    ],
  },
  { id: 'implementation', stage: 2, questions: [{ id: 'implementationInvolvement', kind: 'single', details: [6] }] },
  {
    id: 'rollout',
    stage: 2,
    scopes: ['A'],
    questions: [
      { id: 'rollout', kind: 'multi', details: [3] },
      { id: 'migration', kind: 'multi', details: [4] },
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

const questionText: Record<
  string,
  {
    label: string
    help?: string
    optionalTextLabel?: string
    options?: string[]
    detailLabels?: Record<string, string>
  }
> = {
  ...coreQuestions,
  ...specificQuestions,
}
const sectionTitles: Record<string, string> = {
  interoperability: '1.1 Interoperability & Openness',
  profile: '1.2 Solution capabilities',
  security: '1.3 Security',
  governance: '1.4 Governance',
  business: '1.5 Cost & Business Model',
  cisEcosystem: '2.1 CIS third-party ecosystem',
  appIntegration: '2.2 External application integration',
  clinicalData: '2.3 Clinical data capabilities and use',
  recordRetention: '2.4 Clinical records and patient data',
  clinical: '2.5 HCP-facing solutions',
  data: '2.6 Data / interoperability',
  patient: '2.7 Patient-facing solutions',
  implementation: '2.8 Implementation & Migration',
  rollout: '2.9 Hospital-wide rollout & migration',
  integration: '2.10 Integration requirements',
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
  'A specific clinical area, specialty or workflow, including dedicated modules within a hospital-wide CIS.',
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
export const clinicalFunctionOptions = specificQuestions.clinicalCapabilities.options
export const clinicalSpecialtyOptions = specificQuestions.specialties.options.filter(
  (option) => !option.startsWith('Other'),
)
export const workflowReuseOptions = [
  { label: 'Patient details', value: 'patient' },
  { label: 'Medication data', value: 'medication' },
  { label: 'Laboratory results', value: 'lab' },
  { label: 'None of these', value: 'none' },
  { label: 'Not sure', value: 'unknown' },
]
export const workflowChoiceOptions = {
  write_back: [
    { label: 'Automatically', value: 'automatic' },
    { label: 'Only after a user action', value: 'user_action' },
    { label: 'Manual transfer or duplicate entry', value: 'manual' },
    { label: 'No information is written back', value: 'none' },
    { label: 'Not sure / not applicable', value: 'unknown' },
  ],
  separate_app: [
    { label: 'No, it is embedded in the CIS', value: 'embedded' },
    { label: 'Yes, with single sign-on', value: 'sso' },
    { label: 'Yes, with a separate sign-in', value: 'separate_login' },
    { label: 'Not sure', value: 'unknown' },
  ],
  patient_context: [
    { label: 'Automatically transferred', value: 'automatic' },
    { label: 'User must select the patient again', value: 'manual' },
    { label: 'No patient context is transferred', value: 'none' },
    { label: 'Not sure / not applicable', value: 'unknown' },
  ],
} as const
export const sections: QuestionSection[] = sectionDefinitions.map((section) => ({
  ...section,
  title: sectionTitles[section.id]!,
  questions: section.questions.map((question) => ({
    ...question,
    number: sectionDefinitions.flatMap((item) => item.questions).findIndex((item) => item.id === question.id) + 1,
    label: questionText[question.id]!.label,
    help: questionText[question.id]!.help,
    optionalTextLabel: questionText[question.id]!.optionalTextLabel,
    choices: questionText[question.id]!.options || [],
    detailLabels: questionText[question.id]!.detailLabels,
  })),
}))

export function emptyAnswer(): Answer {
  return { selected: [], text: '', details: {}, rows: {}, other_items: [], products: {}, offerings: [] }
}

export function emptyOffering(kind: ClinicalOffering['kind'] = 'function', name = ''): ClinicalOffering {
  return {
    kind,
    name,
    description: '',
    source: kind === 'integration' ? 'partner' : 'native',
    developer: '',
    functions: [],
    specialties: [],
    other_functions: [],
    other_specialties: [],
    all_specialties: false,
    standalone: false,
    workflow: emptyClinicalWorkflow(),
  }
}

export function emptyClinicalWorkflow(): ClinicalWorkflow {
  return {
    reused_data: [],
    write_back: '',
    separate_app: '',
    patient_context: '',
    manual_steps: '',
  }
}

export function legacyClinicalOfferings(saved: Record<string, unknown>): ClinicalOffering[] {
  const merged = new Map<string, ClinicalOffering>()
  for (const [id, labels, field] of [
    ['clinicalCapabilities', clinicalFunctionOptions, 'functions'],
    ['specialties', specificQuestions.specialties.options, 'specialties'],
  ] as const) {
    const answer = saved[id] as Partial<Answer> | undefined
    if (!answer?.rows) continue
    for (let index = 0; index < labels.length; index++) {
      const row = answer.rows[index]
      if (row?.provided !== 'yes') continue
      const products =
        answer.products?.[index] ||
        (row.name || row.description
          ? [
              {
                name: row.name || '',
                description: row.description || '',
                source: row.source === '1' ? '1' : '0',
                standalone: row.standalone === 'yes',
              } as Product,
            ]
          : [])
      for (const product of products) {
        const name = product.name || labels[index]!
        const source = product.source === '1' ? 'partner' : 'native'
        const key = `${source}:${name.trim().toLowerCase()}`
        if (!merged.has(key))
          merged.set(key, {
            ...emptyOffering(source === 'partner' ? 'integration' : 'function', name),
            description: product.description || '',
            source,
            standalone: source === 'native' && product.standalone,
          })
        const offering = merged.get(key)!
        const label = labels[index]!
        if (label.startsWith('Other')) {
          const custom = answer.other_items?.filter((item) => item.trim()) || []
          for (const value of custom) {
            if (!offering.other_specialties.includes(value)) offering.other_specialties.push(value)
          }
        } else if (!offering[field].includes(label)) offering[field].push(label)
      }
    }
  }
  return [...merged.values()]
}

export function emptyProduct(): Product {
  return { name: '', description: '', source: '', standalone: false }
}

export function productsFor(answer: Answer, index: number): Product[] {
  if (Array.isArray(answer.products[index])) return answer.products[index]
  const old = answer.rows[index]
  if (!old?.name && !old?.description && !old?.source) return []
  return [
    {
      name: old.name || '',
      description: old.description || '',
      source: old.source === '0' || old.source === '1' ? old.source : '',
      standalone: old.standalone === 'yes',
    },
  ]
}

export function otherIndex(question: Question): number {
  if (question.id === 'certifications') return -1
  return question.choices.findIndex((choice) => /^Other(?:\b|\s*\()/i.test(choice))
}

export function otherIsSelected(question: Question, answer: Answer): boolean {
  const index = otherIndex(question)
  return (
    index >= 0 &&
    (question.kind === 'capabilities'
      ? answer.rows[index]?.provided === 'yes'
      : answer.selected.includes(String(index)))
  )
}

export function isAnswered(question: Question, answer: Answer): boolean {
  if (question.kind === 'offerings') {
    return (
      answer.offerings.length > 0 &&
      answer.offerings.every((offering) =>
        Boolean(
          offering.name.trim() &&
          (offering.kind === 'core' || offering.description.trim()) &&
          (offering.source === 'native' || offering.developer.trim()) &&
          (offering.functions.length ||
            offering.other_functions.some((item) => item.trim()) ||
            offering.specialties.length ||
            offering.other_specialties.some((item) => item.trim()) ||
            offering.all_specialties) &&
          (offering.kind === 'core' ||
            (offering.workflow.reused_data.length &&
              offering.workflow.write_back &&
              offering.workflow.separate_app &&
              offering.workflow.patient_context &&
              offering.workflow.manual_steps.trim())),
        ),
      )
    )
  }
  const otherItems = question.kind === 'single' ? answer.other_items.slice(0, 1) : answer.other_items
  const otherComplete =
    !otherIsSelected(question, answer) || (otherItems.length > 0 && otherItems.every((item) => Boolean(item.trim())))
  if (question.kind === 'text') return Boolean(answer.text.trim())
  if (question.kind === 'costs') {
    return Array.from({ length: question.choices.length }, (_, i) => answer.rows[i]?.cost).every(Boolean)
  }
  if (question.kind === 'capabilities') {
    return Array.from({ length: question.choices.length }, (_, i) => {
      const row = answer.rows[i]
      if (row?.provided !== 'yes') return true
      const products = productsFor(answer, i)
      return (
        (i !== otherIndex(question) || otherComplete) &&
        products.length > 0 &&
        products.every((product) =>
          Boolean(product.name.trim() && product.description.trim() && ['0', '1'].includes(product.source)),
        )
      )
    }).every(Boolean)
  }
  return (
    answer.selected.length > 0 &&
    (question.details || []).every(
      (index) =>
        index === otherIndex(question) ||
        !answer.selected.includes(String(index)) ||
        Boolean(answer.details[index]?.trim()),
    ) &&
    otherComplete
  )
}

// Only applicable answers and selected option details belong in a response export.
export function activeAnswer(question: Question, answer: Answer): Answer {
  const otherItems = question.kind === 'single' ? answer.other_items.slice(0, 1) : answer.other_items
  return {
    selected: [...answer.selected],
    text: answer.text,
    details: Object.fromEntries(
      Object.entries(answer.details).filter(
        ([key]) => answer.selected.includes(key) && Number(key) !== otherIndex(question),
      ),
    ),
    other_items: otherIsSelected(question, answer) ? otherItems.map((item) => item.trim()).filter(Boolean) : [],
    offerings:
      question.kind === 'offerings'
        ? answer.offerings.map((offering) => ({
            ...offering,
            name: offering.name.trim(),
            description: offering.description.trim(),
            source: offering.kind === 'integration' ? 'partner' : 'native',
            developer: offering.kind === 'integration' ? offering.developer.trim() : '',
            functions: [...new Set(offering.functions)],
            specialties: [...new Set(offering.specialties)],
            other_functions: offering.other_functions.map((item) => item.trim()).filter(Boolean),
            other_specialties: offering.other_specialties.map((item) => item.trim()).filter(Boolean),
            standalone: offering.kind === 'function' && offering.standalone,
            workflow: offering.kind === 'core' ? emptyClinicalWorkflow() : offering.workflow,
          }))
        : [],
    rows: Object.fromEntries(
      (question.kind === 'capabilities'
        ? question.choices.map((_, index): [string, Record<string, string>] => [
            String(index),
            answer.rows[index] || {},
          ])
        : Object.entries(answer.rows)
      ).map(([key, row]) => [
        key,
        question.kind === 'capabilities' ? { provided: row.provided === 'yes' ? 'yes' : 'no' } : { ...row },
      ]),
    ),
    products:
      question.kind === 'capabilities'
        ? Object.fromEntries(
            question.choices.flatMap((_, index) =>
              answer.rows[index]?.provided === 'yes'
                ? [
                    [
                      String(index),
                      productsFor(answer, index).map((product) => ({
                        ...product,
                        name: product.name.trim(),
                        description: product.description.trim(),
                        standalone: product.source === '0' && product.standalone,
                      })),
                    ],
                  ]
                : [],
            ),
          )
        : {},
  }
}

export function answerLines(question: Question, answer: Answer): string[] {
  if (question.kind === 'offerings')
    return answer.offerings.map((offering) => {
      const tags = [
        ...offering.functions,
        ...offering.other_functions,
        ...offering.specialties,
        ...offering.other_specialties,
        ...(offering.all_specialties ? ['Across specialties'] : []),
      ].filter(Boolean)
      const title =
        offering.kind === 'core'
          ? 'Core CIS platform'
          : offering.kind === 'integration'
            ? 'External integration'
            : 'Specialized function'
      const workflow = offering.workflow
      const workflowText =
        offering.kind !== 'core'
          ? `; CIS data reused: ${workflow.reused_data.map((value) => workflowReuseOptions.find((item) => item.value === value)?.label || value).join(', ') || 'Not answered'}; CIS write-back: ${workflowChoiceOptions.write_back.find((item) => item.value === workflow.write_back)?.label || 'Not answered'}; Separate application: ${workflowChoiceOptions.separate_app.find((item) => item.value === workflow.separate_app)?.label || 'Not answered'}; Patient context: ${workflowChoiceOptions.patient_context.find((item) => item.value === workflow.patient_context)?.label || 'Not answered'}; Manual workflow steps: ${workflow.manual_steps || 'Not answered'}`
          : ''
      return `${title}: ${offering.name || 'Not answered'}; ${offering.source === 'partner' ? `Third-party company: ${offering.developer || 'Not answered'}` : 'Developed by your company'}${offering.kind === 'core' ? '' : `; What it does: ${offering.description || 'Not answered'}`}; Areas: ${tags.join(', ') || 'Not answered'}${offering.kind === 'function' ? `; Standalone purchase: ${offering.standalone ? 'Yes' : 'No'}` : ''}${workflowText}`
    })
  if (question.kind === 'text') return answer.text.trim() ? [answer.text] : []
  const options = question.choices
  if (question.kind === 'costs' || question.kind === 'capabilities') {
    return options.flatMap((label, index) => {
      const row = answer.rows[index] || {}
      const missing = 'Not answered'
      if (question.kind === 'costs') {
        const classification =
          row.cost === undefined || row.cost === '' ? missing : costOptions[Number(row.cost)] || missing
        return [
          `${label}: ${classification}${row.billing_unit && ['1', '2'].includes(row.cost) ? `; Charged per: ${row.billing_unit}` : ''}`,
        ]
      }
      if (index === otherIndex(question) && row.provided !== 'yes') return []
      if (row.provided !== 'yes') return [`${label}: No`]
      const products = productsFor(answer, index)
      const prefix = index === otherIndex(question) ? 'Other module' : label
      const lines = products.length
        ? products.map(
            (product) =>
              `${prefix}: Yes; Product / module name: ${product.name || missing}; Brief description: ${product.description || missing}; Native / partner: ${product.source === '0' || product.source === '1' ? sourceOptions[Number(product.source)] : missing}${product.source === '0' ? `; Can be purchased and operated independently: ${product.standalone ? 'Yes' : 'No'}` : ''}`,
          )
        : [`${prefix}: Yes; Product / module: ${missing}`]
      return index === otherIndex(question)
        ? [
            ...(answer.other_items.length
              ? answer.other_items.filter(Boolean).map((item) => `Other: ${item}`)
              : ['Other: Not answered']),
            ...lines,
          ]
        : lines
    })
  }
  const otherItems = question.kind === 'single' ? answer.other_items.slice(0, 1) : answer.other_items
  const selectedLines = answer.selected.flatMap((index) =>
    Number(index) === otherIndex(question)
      ? otherItems.length
        ? otherItems.filter(Boolean).map((item) => `${options[Number(index)]}: ${item}`)
        : [options[Number(index)]!]
      : [`${options[Number(index)]}${answer.details[index] ? `: ${answer.details[index]}` : ''}`],
  )
  return question.optionalTextLabel && answer.text.trim()
    ? [...selectedLines, `${question.optionalTextLabel} ${answer.text.trim()}`]
    : selectedLines
}
