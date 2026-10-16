import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Exercise the complete dashboard script, including render() and tab listeners.
// Calculation-only tests cannot catch names shadowed inside the page renderer.
class Element {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase(); this.children = []; this.listeners = new Map();
    this.dataset = {}; this.style = {}; this.attributes = {}; this.value = ''; this.hidden = false;
    this.classList = { add() {}, remove() {}, toggle() {} };
  }
  set textContent(value) { this.text = String(value); this.children = []; }
  get textContent() { return (this.text || '') + this.children.map(child => child.textContent).join(' '); }
  get options() { return this.children.filter(child => child.tagName === 'OPTION'); }
  append(...children) { for (const child of children) { child.parentElement = this; this.children.push(child); } }
  replaceChildren(...children) { this.text = ''; this.children = []; this.append(...children); }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name]; }
  addEventListener(name, listener) {
    if (!this.listeners.has(name)) this.listeners.set(name, []);
    this.listeners.get(name).push(listener);
  }
  click() { for (const listener of this.listeners.get('click') || []) listener({ preventDefault() {} }); }
}
const template = readFileSync('api/app/core/templates/core/analysis.html', 'utf8');
const script = readFileSync('api/app/core/analysis_assets/analysis.js', 'utf8');
const schema = JSON.parse(readFileSync('api/app/core/analysis_schema.json', 'utf8'));
const questions = Object.entries(schema).map(([id, definition]) => ({
  id, introduced: 1, legacy: false, title: `1.1 ${id}`, label: id, ...definition,
}));
function response(id, solution, version = 14) {
  return { id, provider: 'Example provider', solution, version, scopes: ['A'],
    email: 'test@example.com', submitted: `2026-10-${String(id).padStart(2, '0')}T12:00:00Z`,
    answers: {}, answer_data: {}, imported_pdf: false };
}
function run(data) {
  const elements = new Map([...template.matchAll(/\bid="([^"]+)"/g)].map(([, id]) => [id, new Element()]));
  elements.set('analysis-data', new Element('script'));
  elements.get('analysis-data').textContent = JSON.stringify(data);
  elements.get('mode').value = 'latest_product';
  elements.get('export').href = 'http://localhost/admin/analysis/export/';
  const document = {
    getElementById: id => { assert.ok(elements.has(id), `Unknown element ${id}`); return elements.get(id); },
    querySelector: selector => { assert.equal(selector, '#grouping-security input[name=csrfmiddlewaretoken]'); return { value: 'csrf-test' }; },
    createElement: tag => new Element(tag), createElementNS: (_, tag) => new Element(tag),
  };
  vm.runInNewContext(script, { document, URL, console, localStorage: { getItem: () => null, setItem() {} } }, { filename: 'analysis.js' });
  for (const tab of ['presentation', 'outreach', 'products', 'charts', 'providers', 'submissions']) {
    elements.get(`${tab}-tab`).click();
    assert.equal(elements.get(tab).hidden, false, `${tab} opens`);
    assert.equal(elements.get(`${tab}-tab`).getAttribute('aria-pressed'), 'true');
    assert.ok(elements.get(tab).children.length, `${tab} has rendered content`);
  }
  for (const row of data.submissions) {
    assert.ok(elements.get('submissions').textContent.includes(`${row.provider} · #${row.id}`), `Submission #${row.id} is displayed`);
  }
  assert.ok(elements.get('summary').textContent.includes('products'));
  return elements;
}
const rows = [response(1, 'Suite'), response(2, 'Suite'), response(3, 'Portal')];
const fixture = { questions, responses: rows, submissions: rows, viewer_id: 1, current_version: 14,
  scopes: { A: 'Hospital-wide CIS', B: 'Platform', C: 'Specialty', D: 'Patient-facing' },
  other_groupings: [], invitations: [], vendor_categories: [], clinical_specialties: [] };
assert.ok(run(fixture).get('summary').textContent.startsWith('2 products'), 'latest submissions count per product');
run({ ...fixture, responses: [], submissions: [response(4, 'Earlier suite', 1)] });
run({ ...fixture, responses: [], submissions: [] });
if (process.argv[2]) {
  const html = readFileSync(process.argv[2], 'utf8');
  const data = JSON.parse(html.match(/<script id="analysis-data" type="application\/json">(.*?)<\/script>/s)[1]);
  run(data);
  console.log(`Local dashboard rendered all ${data.submissions.length} saved submissions and all six tabs`);
}
console.log('Full dashboard rendering passed: current, historical and empty submissions');
