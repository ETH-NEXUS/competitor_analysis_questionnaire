import { customFetch } from '~/api/mutator/custom-fetch'
/* eslint-disable no-unused-vars -- The base JS rule treats TS type parameters and constructor parameter properties as unused. */
import type { Answer, Scope } from '~/utils/questionnaire'

export interface SharedDraftData {
  version: number
  scopes: Scope[]
  identity: { respondentName: string; respondentEmail: string; providerName: string; solutionName: string }
  answers: Record<string, Answer>
}
export interface SharedDraftRecord {
  data: SharedDraftData
  revision: number
  updated_at: string
  expires_at: string
  submitted: boolean
  response_id: number | null
  token?: string
}
export type SharedDraftState =
  | 'local'
  | 'loading'
  | 'creating'
  | 'unsaved'
  | 'saving'
  | 'saved'
  | 'error'
  | 'conflict'
  | 'unavailable'
  | 'submitted'
type Transport = (path: string, method: string, token: string, body?: unknown) => Promise<SharedDraftRecord>
const endpoint = '/api/v1/questionnaire-drafts/'
const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, canonical(child)]),
    )
  return value
}
const signatureOf = (data: SharedDraftData) => JSON.stringify(canonical(data))
const newPrivateToken = () =>
  btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')

const transport: Transport = (path, method, token, body) =>
  customFetch(endpoint + path, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })

/** Serializes saves and checks revisions before applying another person's changes. */
export class SharedDraftSession {
  token = ''
  record: SharedDraftRecord | null = null
  state: SharedDraftState = 'local'
  message = ''
  pendingToken = ''
  private savedSignature = ''
  private uncertainSignature = ''
  private busy: Promise<unknown> | null = null
  private timer: ReturnType<typeof setTimeout> | undefined
  private disposed = false

  constructor(
    private getData: () => SharedDraftData,
    private apply: (record: SharedDraftRecord) => void,
    private changed: () => void,
    private request: Transport = transport,
  ) {}

  private signature() {
    return signatureOf(this.getData())
  }
  get hasUnsavedChanges() {
    return this.signature() !== this.savedSignature
  }
  private setState(state: SharedDraftState, message = '') {
    this.state = state
    this.message = message
    this.changed()
  }
  private accept(record: SharedDraftRecord, apply = false) {
    this.record = record
    this.savedSignature = signatureOf(record.data)
    this.uncertainSignature = ''
    if (apply) this.apply(record)
    this.setState(record.submitted ? 'submitted' : this.signature() === this.savedSignature ? 'saved' : 'unsaved')
  }
  private async failure(error: unknown, attemptedSignature = '') {
    if (error instanceof Response) {
      const body = await error.json().catch(() => ({}))
      if (error.status === 409 && body.draft) {
        const remote = body.draft as SharedDraftRecord
        const signature = signatureOf(remote.data)
        if (!remote.submitted && (signature === attemptedSignature || signature === this.uncertainSignature)) {
          // The previous save may have succeeded while its response was lost.
          this.accept(remote)
          return
        }
        this.setState(
          'conflict',
          remote.submitted
            ? 'A colleague has submitted this response. Your unsaved changes are still here; view the submitted copy to continue.'
            : 'A colleague saved newer changes. Your unsaved changes are still here. Download your copy, then load the latest draft before continuing.',
        )
        return
      }
      if (error.status === 404) {
        this.setState(
          'unavailable',
          'This draft link has expired or been replaced. Your local answers are still available to download.',
        )
        return
      }
      if (error.status === 400 && typeof body.error === 'string') {
        this.setState('error', body.error)
        return
      }
    }
    if (attemptedSignature) this.uncertainSignature = attemptedSignature
    this.setState(
      'error',
      'The shared draft could not be saved or loaded. Your local answers are kept in this browser. Check your connection and retry.',
    )
  }

  async create() {
    while (this.busy) await this.busy
    if (this.token) {
      await this.saveNow()
      return
    }
    this.setState('creating')
    const data = JSON.parse(this.signature()) as SharedDraftData
    const operation = this.request('', 'POST', '', { data })
    this.busy = operation
    try {
      const record = await operation
      this.token = record.token!
      this.pendingToken = ''
      this.accept(record)
    } catch (error) {
      await this.failure(error)
      throw error
    } finally {
      this.busy = null
    }
    this.scheduleSave()
  }

  async load(token: string, preserveLocalRevision?: number, pendingToken = this.pendingToken) {
    clearTimeout(this.timer)
    while (this.busy) await this.busy.catch(() => {})
    if (token !== this.token) {
      this.record = null
      this.savedSignature = this.signature()
      this.uncertainSignature = ''
    }
    this.token = token
    this.pendingToken = pendingToken
    this.setState('loading')
    const operation = this.loadRecord(token, pendingToken)
    this.busy = operation
    try {
      const record = await operation
      if (preserveLocalRevision !== undefined && this.signature() !== signatureOf(record.data)) {
        if (
          !record.submitted &&
          (record.revision === preserveLocalRevision ||
            (pendingToken && this.token === pendingToken && record.revision === preserveLocalRevision + 1))
        )
          this.accept(record)
        else {
          this.record = record
          this.savedSignature = signatureOf(record.data)
          this.setState(
            'conflict',
            'Your browser has unsaved answers, and a colleague has updated or submitted this draft. Download your copy, then load the latest shared copy.',
          )
        }
      } else this.accept(record, true)
    } catch (error) {
      await this.failure(error)
      throw error
    } finally {
      this.busy = null
    }
  }

  private async loadRecord(token: string, pendingToken: string) {
    if (pendingToken) {
      try {
        const record = await this.request('current/', 'GET', pendingToken)
        this.token = pendingToken
        this.pendingToken = ''
        return record
      } catch (error) {
        if (!(error instanceof Response) || error.status !== 404) throw error
        this.pendingToken = ''
      }
    }
    return this.request('current/', 'GET', token)
  }

  scheduleSave() {
    if (this.pendingToken) return
    if (
      !this.token ||
      !this.record ||
      this.disposed ||
      ['loading', 'conflict', 'unavailable', 'submitted'].includes(this.state)
    )
      return
    if (this.signature() === this.savedSignature) return
    if (this.state !== 'saving') this.setState('unsaved')
    clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      void this.saveNow().catch(() => {})
    }, 750)
  }

  async saveNow() {
    clearTimeout(this.timer)
    while (this.busy) await this.busy
    if (!this.token || this.disposed) return
    if (!this.record) throw new Error('Load the shared draft before saving.')
    if (this.pendingToken) throw new Error('Retry the link replacement before saving.')
    if (['conflict', 'unavailable', 'submitted'].includes(this.state))
      throw new Error(this.message || 'This draft cannot be edited.')
    const operation = this.saveChanges()
    this.busy = operation
    try {
      await operation
    } finally {
      if (this.busy === operation) this.busy = null
    }
  }

  private async saveChanges() {
    while (this.signature() !== this.savedSignature) {
      const signature = this.signature()
      this.setState('saving')
      try {
        const record = await this.request('current/', 'PATCH', this.token, {
          revision: this.record!.revision,
          data: JSON.parse(signature),
        })
        this.accept(record)
      } catch (error) {
        await this.failure(error, signature)
        if (!['saved', 'unsaved'].includes(this.state)) throw error
      }
    }
  }

  async poll() {
    if (!this.record || this.pendingToken) return
    if (
      !this.token ||
      this.disposed ||
      this.busy ||
      ['loading', 'conflict', 'unavailable', 'submitted'].includes(this.state)
    )
      return
    if (this.signature() !== this.savedSignature) {
      await this.saveNow()
      return
    }
    const operation = this.request('current/', 'GET', this.token)
    this.busy = operation
    try {
      const record = await operation
      if (record.revision !== this.record?.revision || record.submitted) {
        if (this.signature() !== this.savedSignature) {
          this.setState(
            'conflict',
            'A colleague updated this response while you were editing. Your unsaved changes are still here. Download your copy, then load the latest draft.',
          )
        } else this.accept(record, true)
      } else this.setState(this.signature() === this.savedSignature ? 'saved' : 'unsaved')
    } catch (error) {
      await this.failure(error)
      throw error
    } finally {
      this.busy = null
    }
  }

  async rotate() {
    await this.saveNow()
    this.pendingToken = newPrivateToken()
    const operation = this.request('current/rotate/', 'POST', this.token, {
      revision: this.record!.revision,
      new_token: this.pendingToken,
    })
    this.busy = operation
    this.setState('saving')
    try {
      const record = await operation
      this.token = record.token!
      this.pendingToken = ''
      this.accept(record)
    } catch (error) {
      if (error instanceof Response && error.status < 500) this.pendingToken = ''
      await this.failure(error)
      throw error
    } finally {
      this.busy = null
    }
  }

  async submit(response: unknown) {
    await this.saveNow()
    const operation = this.request('current/submit/', 'POST', this.token, {
      revision: this.record!.revision,
      data: JSON.parse(this.signature()),
      response: typeof response === 'function' ? response() : response,
    })
    this.busy = operation
    this.setState('saving')
    try {
      this.accept(await operation, true)
    } catch (error) {
      await this.failure(error)
      throw error
    } finally {
      this.busy = null
    }
  }

  dispose() {
    this.disposed = true
    clearTimeout(this.timer)
  }
  reset() {
    clearTimeout(this.timer)
    this.disposed = false
    this.token = ''
    this.pendingToken = ''
    this.record = null
    this.savedSignature = ''
    this.uncertainSignature = ''
    this.setState('local')
  }
}
