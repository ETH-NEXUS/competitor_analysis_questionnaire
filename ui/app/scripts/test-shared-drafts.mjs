import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'
import test from 'node:test'

// Run the production sync controller with an injected transport, without Nuxt or a browser.
const source = (await readFile(new URL('../app/utils/shared-draft.ts', import.meta.url), 'utf8'))
  .replace(/import \{ customFetch \} from '[^']+'/, 'const customFetch = () => { throw new Error("Unexpected real network call") }')
const compiled = stripTypeScriptTypes(source, { mode: 'transform' })
const { SharedDraftSession } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
const clone = value => JSON.parse(JSON.stringify(value))
const initial = () => ({ version: 14, scopes: ['C'], identity: { respondentName: '', respondentEmail: 'vendor@example.com', providerName: 'Vendor', solutionName: 'Suite' }, answers: {} })
const error = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }

function server() {
  let record
  let token = 'original-token'
  let submissions = 0
  let patches = 0
  const request = async (path, method, incomingToken, body) => {
    if (path === '' && method === 'POST') {
      record = { data: clone(body.data), revision: 1, updated_at: '2026-10-13T12:00:00Z', expires_at: '2027-01-11T12:00:00Z', submitted: false, response_id: null }
      return { ...clone(record), token }
    }
    if (incomingToken !== token) throw error(404, {})
    if (method === 'GET') return clone(record)
    if (path.endsWith('submit/') && record.submitted) return clone(record)
    if (record.submitted || body.revision !== record.revision) throw error(409, { draft: clone(record) })
    if (path.endsWith('rotate/')) token = body.new_token || 'replacement-token'
    else if (path.endsWith('submit/')) { record.submitted = true; record.response_id = ++submissions; record.data = clone(body.data) }
    else { record.data = clone(body.data); patches++ }
    record.revision++
    return { ...clone(record), ...(path.endsWith('rotate/') ? { token } : {}) }
  }
  return { request, get record() { return clone(record) }, get submissions() { return submissions }, get patches() { return patches } }
}
function client(t, api, request = api.request) {
  let data = initial()
  const session = new SharedDraftSession(() => data, record => { data = clone(record.data) }, () => {}, request)
  t.after(() => session.dispose())
  return { session, get data() { return data } }
}

test('a second browser receives all existing answers and can continue the draft', async t => {
  const api = server()
  const alice = client(t, api)
  alice.data.answers.apiAccess = { selected: ['0'], text: '', details: {}, rows: {} }
  await alice.session.create()
  const bob = client(t, api)
  await bob.session.load(alice.session.token)
  assert.deepEqual(bob.data, alice.data)
  bob.data.identity.respondentName = 'Technical colleague'
  await bob.session.saveNow()
  await alice.session.poll()
  assert.equal(alice.data.identity.respondentName, 'Technical colleague')
  assert.equal(alice.session.state, 'saved')
})

test('a stale browser cannot silently overwrite a colleague and retains its own edits', async t => {
  const api = server()
  const alice = client(t, api)
  await alice.session.create()
  const bob = client(t, api)
  await bob.session.load(alice.session.token)
  alice.data.identity.respondentName = 'Alice'
  await alice.session.saveNow()
  bob.data.identity.respondentName = 'Bob'
  await assert.rejects(bob.session.saveNow())
  assert.equal(bob.session.state, 'conflict')
  assert.equal(bob.data.identity.respondentName, 'Bob')
  assert.equal(api.record.data.identity.respondentName, 'Alice')
  await bob.session.load(bob.session.token)
  assert.equal(bob.data.identity.respondentName, 'Alice')
})

test('typing during an in-flight save is saved next, with no parallel writes', async t => {
  const api = server()
  const wait = deferred()
  const started = deferred()
  let active = 0
  let maxActive = 0
  let calls = 0
  const request = async (...args) => {
    if (args[1] !== 'PATCH') return api.request(...args)
    maxActive = Math.max(maxActive, ++active)
    if (++calls === 1) { started.resolve(); await wait.promise }
    try { return await api.request(...args) } finally { active-- }
  }
  const alice = client(t, api, request)
  await alice.session.create()
  alice.data.identity.respondentName = 'First edit'
  const saving = alice.session.saveNow()
  await started.promise
  alice.data.identity.respondentName = 'Second edit'
  const secondSave = alice.session.saveNow()
  wait.resolve()
  await Promise.all([saving, secondSave])
  assert.equal(maxActive, 1)
  assert.equal(api.record.data.identity.respondentName, 'Second edit')
  assert.equal(alice.session.state, 'saved')
})

test('a lost save response can be retried even after more typing', async t => {
  const api = server()
  let loseResponse = true
  const request = async (...args) => {
    const result = await api.request(...args)
    if (args[1] === 'PATCH' && loseResponse) { loseResponse = false; throw new Error('Connection interrupted') }
    return result
  }
  const alice = client(t, api, request)
  await alice.session.create()
  alice.data.identity.respondentName = 'First edit'
  await assert.rejects(alice.session.saveNow())
  assert.equal(alice.session.state, 'error')
  alice.data.identity.respondentName = 'Latest edit'
  await alice.session.saveNow()
  assert.equal(api.record.data.identity.respondentName, 'Latest edit')
  assert.equal(alice.session.state, 'saved')
})

test('polling does not replace changes made while a newer draft was loading', async t => {
  const api = server()
  const wait = deferred()
  const started = deferred()
  let blockGet = false
  const request = async (...args) => {
    if (args[1] === 'GET' && blockGet) { started.resolve(); await wait.promise }
    return api.request(...args)
  }
  const alice = client(t, api, request)
  await alice.session.create()
  const bob = client(t, api)
  await bob.session.load(alice.session.token)
  bob.data.identity.respondentName = 'Bob'
  await bob.session.saveNow()
  blockGet = true
  const polling = alice.session.poll()
  await started.promise
  alice.data.identity.respondentName = 'Alice'
  wait.resolve()
  await polling
  assert.equal(alice.session.state, 'conflict')
  assert.equal(alice.data.identity.respondentName, 'Alice')
})

test('submission locks the shared draft and lets colleagues view the same receipt', async t => {
  const api = server()
  const alice = client(t, api)
  await alice.session.create()
  const bob = client(t, api)
  await bob.session.load(alice.session.token)
  await alice.session.submit({})
  assert.equal(alice.session.state, 'submitted')
  await bob.session.poll()
  assert.equal(bob.session.state, 'submitted')
  assert.equal(bob.session.record.response_id, 1)
  assert.equal(api.submissions, 1)
  await assert.rejects(bob.session.saveNow())
})

test('replacing the link blocks an old recipient without deleting their local answers', async t => {
  const api = server()
  const alice = client(t, api)
  await alice.session.create()
  const bob = client(t, api)
  await bob.session.load(alice.session.token)
  await alice.session.rotate()
  await assert.rejects(bob.session.poll())
  assert.equal(bob.session.state, 'unavailable')
  assert.equal(bob.data.identity.providerName, 'Vendor')
  assert.match(alice.session.token, /^[A-Za-z0-9_-]{43}$/)
})

test('starting another response allows sharing again without reusing a submitted draft', async t => {
  const api = server()
  const alice = client(t, api)
  await alice.session.create()
  await alice.session.submit({})
  alice.session.reset()
  alice.data.identity.solutionName = 'Second product'
  await alice.session.create()
  assert.equal(alice.session.state, 'saved')
  assert.equal(api.record.submitted, false)
  assert.equal(api.record.data.identity.solutionName, 'Second product')
})

test('database JSON key ordering does not make an unchanged draft look unsaved', async t => {
  const api = server()
  const alice = client(t, api)
  await alice.session.create()
  const request = async (...args) => {
    const record = await api.request(...args)
    record.data = Object.fromEntries(Object.entries(record.data).reverse())
    record.data.identity = Object.fromEntries(Object.entries(record.data.identity).reverse())
    return record
  }
  const bob = client(t, api, request)
  await bob.session.load(alice.session.token)
  assert.equal(bob.session.state, 'saved')
  await bob.session.saveNow()
  assert.equal(api.patches, 0)
})

test('refresh preserves offline edits when the shared revision has not changed', async t => {
  const api = server()
  const alice = client(t, api)
  await alice.session.create()
  const refreshed = client(t, api)
  refreshed.data.identity.respondentName = 'Offline edit before refresh'
  await refreshed.session.load(alice.session.token, 1)
  assert.equal(refreshed.data.identity.respondentName, 'Offline edit before refresh')
  await refreshed.session.saveNow()
  assert.equal(api.record.data.identity.respondentName, 'Offline edit before refresh')
})

test('refresh keeps unsaved answers and warns if a colleague changed the draft', async t => {
  const api = server()
  const alice = client(t, api)
  await alice.session.create()
  alice.data.identity.respondentName = 'Colleague edit'
  await alice.session.saveNow()
  const refreshed = client(t, api)
  refreshed.data.identity.respondentName = 'My offline edit'
  await refreshed.session.load(alice.session.token, 1)
  assert.equal(refreshed.session.state, 'conflict')
  assert.equal(refreshed.data.identity.respondentName, 'My offline edit')
  assert.equal(api.record.data.identity.respondentName, 'Colleague edit')
})

test('a replaced link can be recovered when the server response was lost, including after refresh', async t => {
  const api = server()
  const request = async (...args) => {
    const result = await api.request(...args)
    if (args[0].endsWith('rotate/')) throw new Error('Connection interrupted after replacement')
    return result
  }
  const alice = client(t, api, request)
  await alice.session.create()
  const oldToken = alice.session.token
  await assert.rejects(alice.session.rotate())
  const candidate = alice.session.pendingToken
  assert.match(candidate, /^[A-Za-z0-9_-]{43}$/)
  const refreshed = client(t, api)
  refreshed.data.identity.respondentName = 'Unsaved after replacement'
  await refreshed.session.load(oldToken, 1, candidate)
  assert.equal(refreshed.session.token, candidate)
  assert.equal(refreshed.session.pendingToken, '')
  assert.equal(refreshed.data.identity.respondentName, 'Unsaved after replacement')
  await refreshed.session.saveNow()
  assert.equal(api.record.data.identity.respondentName, 'Unsaved after replacement')
})

test('submission uses answers from a colleague update that was already loading', async t => {
  const api = server()
  const wait = deferred()
  const started = deferred()
  let blockGet = false
  let submittedResponse
  const request = async (...args) => {
    if (args[1] === 'GET' && blockGet) { started.resolve(); await wait.promise }
    if (args[0].endsWith('submit/')) submittedResponse = args[3].response
    return api.request(...args)
  }
  const alice = client(t, api, request)
  await alice.session.create()
  const bob = client(t, api)
  await bob.session.load(alice.session.token)
  bob.data.identity.respondentName = 'Latest colleague'
  await bob.session.saveNow()
  blockGet = true
  const poll = alice.session.poll()
  await started.promise
  const submit = alice.session.submit(() => ({ respondentName: alice.data.identity.respondentName }))
  wait.resolve()
  await Promise.all([poll, submit])
  assert.equal(submittedResponse.respondentName, 'Latest colleague')
  assert.equal(api.record.data.identity.respondentName, 'Latest colleague')
})
