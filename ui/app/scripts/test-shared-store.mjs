import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes, createRequire } from 'node:module'
import test from 'node:test'

const require = createRequire(import.meta.url)
const vue = require('vue')
const pinia = require('pinia')
globalThis.__draftStoreVue = vue
globalThis.__draftStorePinia = pinia
const clone = value => JSON.parse(JSON.stringify(value))
const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source, { mode: 'transform' })).toString('base64')}`
const read = name => readFile(new URL('../app/' + name, import.meta.url), 'utf8')
const questionnaire = moduleUrl((await read('utils/questionnaire.ts'))
  .replace(/import coreQuestions from '[^']+'/, 'const coreQuestions = ' + await read('utils/questionnaire-core.json'))
  .replace(/import specificQuestions from '[^']+'/, 'const specificQuestions = ' + await read('utils/questionnaire-specific.json')))
const migrations = moduleUrl(await read('utils/draft-option-migration.ts'))
const shared = moduleUrl((await read('utils/shared-draft.ts'))
  .replace(/import \{ customFetch \} from '[^']+'/, 'const customFetch = (...args) => globalThis.__draftStoreFetch(...args)'))
const storeSource = (await read('stores/questionnaire.ts'))
  .replace(/import \{ questionnaireResponsesCreate \} from '[^']+'/, 'const questionnaireResponsesCreate = () => { throw new Error("Unexpected standalone submission") }')
  .replaceAll("'~/utils/questionnaire'", JSON.stringify(questionnaire))
  .replaceAll("'~/utils/draft-option-migration'", JSON.stringify(migrations))
  .replaceAll("'~/utils/shared-draft'", JSON.stringify(shared))
  .replaceAll('import.meta.client', 'true')
const globals = 'const {ref,computed,watch,onScopeDispose}=globalThis.__draftStoreVue; const {defineStore}=globalThis.__draftStorePinia;\n'
const { useQuestionnaireStore } = await import(moduleUrl(globals + storeSource))
const { emptyAnswer } = await import(questionnaire)

function setup(t, { token = '', storage = new Map(), data } = {}) {
  const url = new URL('https://questionnaire.example/' + (token ? '#draft=' + token : ''))
  globalThis.window = { location: url, history: { replaceState: (_a, _b, path) => { url.href = new URL(path, url).href } } }
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) }
  let record = data ? { data: clone(data), revision: 1, submitted: false, response_id: null, updated_at: '2026-10-13T12:00:00Z', expires_at: '2027-01-11T12:00:00Z' } : null
  let savedResponse
  globalThis.__draftStoreFetch = async (path, options) => {
    const body = options.body ? JSON.parse(options.body) : null
    if (options.method === 'GET') return clone(record)
    if (path.endsWith('/submit/')) { savedResponse = body.response; record.data = body.data; record.submitted = true; record.response_id = 9; record.revision++; return clone(record) }
    if (!record) record = { data: body.data, revision: 1, submitted: false, response_id: null, updated_at: '2026-10-13T12:00:00Z', expires_at: '2027-01-11T12:00:00Z' }
    else { record.data = body.data; record.revision++ }
    return { ...clone(record), token: token || 'new-private-token' }
  }
  const active = pinia.createPinia()
  pinia.setActivePinia(active)
  const store = useQuestionnaireStore()
  t.after(() => pinia.disposePinia(active))
  return { store, storage, get record() { return clone(record) }, get submitted() { return savedResponse }, url }
}
const data = () => ({ version: 14, scopes: ['C'], identity: { respondentName: '', respondentEmail: 'vendor@example.com', providerName: 'Vendor', solutionName: 'Suite' }, answers: { apiAccess: { ...emptyAnswer(), selected: ['0'] } } })

test('opening a colleague link loads its answers without replacing an unrelated browser draft', async t => {
  const key = 'hospital-it-questionnaire-v14'
  const old = { ...data(), identity: { ...data().identity, providerName: 'Unrelated company' } }
  const storage = new Map([[key, JSON.stringify(old)]])
  const context = setup(t, { token: 'colleague-token', storage, data: data() })
  assert.equal(await context.store.initializeDraft(), 'shared')
  assert.equal(context.store.identity.providerName, 'Vendor')
  assert.deepEqual(context.store.answers.apiAccess.selected, ['0'])
  assert.equal(context.store.stage, 3)
  assert.equal(storage.get(key), JSON.stringify(old))
  assert.ok(storage.has(key + ':shared:colleague-token'))
  assert.match(context.store.sharedLink, /#draft=colleague-token$/)
})

test('ordinary local drafts still restore and sharing retains inactive answers', async t => {
  const original = { ...data(), stage: 1, answers: { ...data().answers, thirdPartyIntegration: { ...emptyAnswer(), selected: ['0'] } } }
  const context = setup(t, { storage: new Map([['hospital-it-questionnaire-v14', JSON.stringify(original)]]) })
  assert.equal(await context.store.initializeDraft(), 'restored')
  await context.store.shareDraft()
  assert.deepEqual(context.record.data.answers.thirdPartyIntegration.selected, ['0'])
  assert.equal(context.store.sharedState, 'saved')
  assert.match(context.url.hash, /^#draft=/)
})

test('edits autosave through the real store watcher and shared submission shows a receipt', async t => {
  const context = setup(t, { token: 'colleague-token', data: data() })
  await context.store.initializeDraft()
  context.store.identity.respondentName = 'Technical colleague'
  await new Promise(resolve => setTimeout(resolve, 850))
  assert.equal(context.record.data.identity.respondentName, 'Technical colleague')
  assert.equal(context.store.sharedState, 'saved')
  await context.store.submit()
  assert.equal(context.store.submittedId, 9)
  assert.equal(context.store.responseSubmitted, true)
  assert.equal(context.store.sharedBlocked, true)
  assert.equal(context.submitted.respondent_name, 'Technical colleague')
  assert.deepEqual(context.submitted.answers.apiAccess.selected, ['0'])
  context.store.resetForAnotherSolution()
  assert.equal(context.store.responseSubmitted, false)
  assert.equal(context.store.sharedToken, '')
  assert.equal(context.store.identity.solutionName, '')
  assert.equal(context.url.hash, '')
})

test('refresh restores and saves an unfinished offline edit without discarding it', async t => {
  const cached = { ...data(), identity: { ...data().identity, respondentName: 'Offline colleague' }, sharedRevision: 1, sharedDirty: true }
  const storage = new Map([['hospital-it-questionnaire-v14:shared:colleague-token', JSON.stringify(cached)]])
  const context = setup(t, { token: 'colleague-token', storage, data: data() })
  await context.store.initializeDraft()
  assert.equal(context.store.identity.respondentName, 'Offline colleague')
  await new Promise(resolve => setTimeout(resolve, 850))
  assert.equal(context.record.data.identity.respondentName, 'Offline colleague')
  assert.equal(context.store.sharedState, 'saved')
  assert.equal(JSON.parse(storage.get('hospital-it-questionnaire-v14:shared:colleague-token')).sharedDirty, false)
})
