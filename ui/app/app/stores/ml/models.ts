import { defineStore } from 'pinia'
import type { ModelItem } from 'types/ml'
import { mlModelsRetrieve } from '~/app/api/generated/ml'

const NO_MODEL: ModelItem = { label: '(No model)', value: null }

export interface State {
  models: ModelItem[]
  selectedModel: string | null
}

export const useMlModelsStore = defineStore('mlModelsStore', {
  state: (): State => ({
    models: [NO_MODEL],
    selectedModel: null,
  }),

  getters: {
    selectedModelItem(state): ModelItem {
      return state.models.find((model) => model.value === state.selectedModel) ?? state.models[0]!
    },
  },

  actions: {
    async loadModels() {
      try {
        const response = await mlModelsRetrieve()
        const remoteModels = response?.models || []

        if (!remoteModels.length) {
          this.models = [NO_MODEL]
          this.selectedModel = null
          return
        }

        this.models = [
          NO_MODEL,
          ...remoteModels.map((m) => ({ label: m, value: m, icon: 'i-simple-icons-ollama' }) satisfies ModelItem),
        ]

        if (this.selectedModel == null || !remoteModels.includes(this.selectedModel)) {
          this.selectedModel = remoteModels[0]!
        }
      } catch {
        this.models = [NO_MODEL]
        this.selectedModel = null
      }
    },
  },
})
