import {createHash} from 'node:crypto';
import {mkdirSync, writeFileSync} from 'node:fs';
import {dirname} from 'node:path';

const DEFAULT_API = process.env.API_URL || 'http://api:5000';
const SCHEMA_URL = process.env.SCHEMA_URL || `${DEFAULT_API.replace(/\/$/, '')}/api/v1/schema/`;
// nuxt-open-fetch expects schemas in ./openapi/[client]/openapi.json (or .yaml)
const OUTPUT_SCHEMA = process.env.OUTPUT_SCHEMA || 'openapi/api/openapi.json';
const INTERVAL_MS = Number(process.env.SCHEMA_POLL_INTERVAL_MS || 5000);

let lastHash = '';

async function fetchSchemaJson(baseUrl) {
    const hasQuery = baseUrl.includes('?');
    const candidates = [
        baseUrl, // as-is (should return JSON with Accept header)
    ];
    const accept = 'application/vnd.oai.openapi+json, application/json;q=0.9, */*;q=0.1';

    for (const url of candidates) {
      try {
        const res = await fetch(url, { headers: { Accept: accept } });
        if (!res.ok) continue;
        const text = await res.text();
        if (text.trim().startsWith('{')) {
          return { text, url };
        }
      } catch (_) {
        // try next candidate
      }
  }
  throw new Error('Could not fetch OpenAPI JSON. Ensure the schema endpoint supports JSON (try format=json).');
}

function sha256(str) {
    return createHash('sha256').update(str).digest('hex');
}
async function tick() {
    try {
        const {text} = await fetchSchemaJson(SCHEMA_URL);
        const hash = sha256(text);
        if (hash !== lastHash) {
            lastHash = hash;
            // persist schema to disk for IDE tooling and deterministic generation
            mkdirSync(dirname(OUTPUT_SCHEMA), {recursive: true});
            writeFileSync(OUTPUT_SCHEMA, text);
            console.log(`[openapi] Schema written to ${OUTPUT_SCHEMA} (hash=${hash.slice(0, 8)}...)`);
        }
    } catch (e) {
        console.error(`[openapi] Failed to fetch schema from ${SCHEMA_URL}:`, e?.message || e);
    }
}

console.log(`[openapi] Watching schema at ${SCHEMA_URL} every ${INTERVAL_MS}ms`);
setInterval(tick, INTERVAL_MS);
// initial run
tick().catch(() => {
});
