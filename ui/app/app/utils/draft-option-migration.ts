// Indices used by drafts saved before questionnaire version 11.
const selectionMaps: Record<string, Record<string, string>> = {
  apiAccess: { '3': '4', '4': '4', '5': '3' },
  developerIndependence: { '2': '3', '3': '2', '4': '3' },
  documentationMethods: {
    '0': '7',
    '1': '7',
    '2': '0',
    '3': '7',
    '4': '1',
    '5': '2',
    '6': '3',
    '7': '4',
    '8': '5',
    '9': '6',
    '10': '7',
    '11': '8',
  },
}

const previousIndices: Record<string, number[]> = {
  apiAccess: [0, 1, 2, 5, 4],
  developerIndependence: [0, 1, 3, 4],
  documentationMethods: [2, 4, 5, 6, 7, 8, 9, 10, 11],
}

const retiredOptions: Record<string, Record<string, string>> = {
  apiAccess: { '3': 'Integrations generally require vendor-specific interfaces or development' },
  developerIndependence: { '2': 'Yes, but vendor support/involvement is normally required' },
  documentationMethods: {
    '0': 'Reuse/pre-population of existing patient data',
    '1': 'Structured documentation templates',
    '3': 'Voice dictation',
  },
}

export function remapV11Selection(questionId: string, oldIndex: string): string {
  return selectionMaps[questionId]?.[oldIndex] || oldIndex
}

export function v11SourceIndex(questionId: string, newIndex: number): number {
  return previousIndices[questionId]?.[newIndex] ?? newIndex
}

export function retiredV11Option(questionId: string, oldIndex: string): string | undefined {
  return retiredOptions[questionId]?.[oldIndex]
}
