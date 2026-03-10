import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

const DEFAULT_API = process.env.NUXT_PUBLIC_API_URL || 'http://api:5000'
const SCHEMA_URL = process.env.SCHEMA_URL || `${DEFAULT_API.replace(/\/$/, '')}/api/v1/schema/`
// Orval reads schemas from ./openapi/[client]/openapi.json
const OUTPUT_SCHEMA = process.env.OUTPUT_SCHEMA || 'openapi/api/openapi.json'
const INTERVAL_MS = Number(process.env.SCHEMA_POLL_INTERVAL_MS || 5000)
const FETCH_TIMEOUT_MS = Number(process.env.SCHEMA_FETCH_TIMEOUT_MS || 30000)

let lastHash = ''

async function fetchWithTimeout(url, options = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timeoutId)
  }
}

async function fetchSchemaJson(baseUrl) {
  const candidates = [
    baseUrl, // as-is (should return JSON with Accept header)
  ]
  const accept = 'application/vnd.oai.openapi+json, application/json;q=0.9, */*;q=0.1'

  for (const url of candidates) {
    try {
      const res = await fetchWithTimeout(url, { headers: { Accept: accept } })
      const text = await res.text()

      if (!res.ok) {
        console.debug(`[openapi] HTTP ${res.status} from ${url}: ${text.slice(0, 200)}`)
        continue
      }

      if (text.trim().startsWith('{')) {
        return { text, url }
      }

      console.debug(`[openapi] Response is not JSON from ${url}: ${text.slice(0, 200)}`)
    } catch (e) {
      if (e.name === 'AbortError') {
        console.debug(`[openapi] Fetch timeout (>${FETCH_TIMEOUT_MS}ms) for ${url}`)
      } else {
        console.debug(`[openapi] Fetch error for ${url}:`, e?.message || e)
      }
    }
  }
  throw new Error('Could not fetch OpenAPI JSON. Ensure the schema endpoint supports JSON (try format=json).')
}

function sha256(str) {
  return createHash('sha256').update(str).digest('hex')
}
async function tick() {
  try {
    const { text } = await fetchSchemaJson(SCHEMA_URL)
    const hash = sha256(text)
    if (hash !== lastHash) {
      lastHash = hash
      // persist schema to disk for IDE tooling and deterministic generation
      mkdirSync(dirname(OUTPUT_SCHEMA), { recursive: true })
      writeFileSync(OUTPUT_SCHEMA, text)
      console.log(`[openapi] Schema written to ${OUTPUT_SCHEMA} (hash=${hash.slice(0, 8)}...)`)
      execFile('npx', ['orval'], (err, stdout, stderr) => {
        if (err) {
          console.error(`[orval] Generation failed:`, stderr || err.message)
        } else {
          console.log(`[orval] API layer regenerated`)
        }
      })
    }
  } catch (e) {
    console.error(`[openapi] Failed to fetch schema from ${SCHEMA_URL}:`, e?.message || e)
    console.error(`[openapi] NOTE: This is expected if the API is still starting up.`)
    console.error(`[openapi] INFO: Using cached schema at ${OUTPUT_SCHEMA}`)
  }
}

console.log(`[openapi] Watching schema at ${SCHEMA_URL} every ${INTERVAL_MS}ms`)
setInterval(tick, INTERVAL_MS)
// initial run
tick().catch(() => {})
