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
  dispatch(name) { return Promise.all((this.listeners.get(name) || []).map(listener => listener({ preventDefault() {} }))); }
  click() { return this.dispatch('click'); }
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
function run(data, fetch) {
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
  const context = { document, URL, console, fetch, localStorage: { getItem: () => null, setItem() {} } };
  vm.runInNewContext(script + '\nglobalThis.searchVendorsForTest = searchVendors;', context, { filename: 'analysis.js' });
  elements.searchVendors = context.searchVendorsForTest;
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
function descendants(element, predicate) {
  return element.children.flatMap(child => [...(predicate(child) ? [child] : []), ...descendants(child, predicate)]);
}
const invitation = { id: 1, provider: 'CISTEC', category: 'cis', match_name: 'Previous spelling', linked_names: [], invitation_sent: true };
const linkingFixture = { ...fixture, invitations: [invitation] };
const requests = [];
const linkedPage = run(linkingFixture, async (_, options) => {
  const payload = JSON.parse(options.body); requests.push(payload);
  const vendor = payload.action === 'create_from_submission'
    ? { id: 2, provider: 'Example provider', linked_names: ['Example provider'] }
    : { ...invitation, linked_names: payload.action === 'unlink' ? [] : ['Example provider'] };
  return { ok: true, json: async () => ({ vendor }) };
});
const outreach = linkedPage.get('outreach');
const buttons = () => descendants(outreach, element => element.tagName === 'BUTTON');
const button = title => {
  const match = buttons().find(element => element.textContent === title);
  assert.ok(match, `Button exists: ${title}`); return match;
};
const search = descendants(outreach, element => element.placeholder === 'Type an organization name')[0];
assert.ok(search, 'Unmatched notice contains an inline search field');
assert.equal(button('Link to selected vendor').disabled, true, 'No automatic linking without selection');
search.value = 'cistek'; await search.dispatch('input');
await button('CISTEC').click();
assert.equal(button('Link to selected vendor').disabled, false);
await button('Link to selected vendor').click();
assert.deepEqual(requests[0], { action: 'link', response_id: 1, id: 1 });
assert.ok(!outreach.textContent.includes('need linking'), 'Linked organization disappears from unmatched notice');
assert.ok(outreach.textContent.includes('3 response(s)'), 'All organization responses are linked together');
assert.ok(descendants(outreach, element => element.className === 'summary-metric').some(element => element.textContent.startsWith('1 heard back')), 'Vendor participation counts update after linking');
assert.ok(descendants(linkedPage.get('presentation'), element => element.tagName === 'TR').some(element => element.textContent.startsWith('Participated 1 / 1')), 'Presentation participation counts update too');
assert.ok(outreach.textContent.includes('Linked questionnaire organizations'));
await button('Remove manual link').click();
assert.ok(outreach.textContent.includes('need linking'), 'Removing a link makes the organization available again');
assert.ok(descendants(linkedPage.get('presentation'), element => element.tagName === 'TR').some(element => element.textContent.startsWith('Participated 0 / 1')), 'Removing a link updates participation');
await button('Add vendor as new entry').click();
assert.equal(requests[2].action, 'create_from_submission');
assert.ok(!outreach.textContent.includes('need linking'), 'New vendor is linked immediately');
const searched = linkedPage.searchVendors('cisték', [invitation]);
assert.equal(searched[0].id, 1, 'Search handles close spelling and accents');
assert.equal(linkedPage.searchVendors('previous', [invitation])[0].id, 1, 'Search includes alternate questionnaire names');
assert.equal(linkedPage.searchVendors('hospital systems', [{ ...invitation, linked_names: ['Cistec Hospital Systems'] }])[0].id, 1, 'Search includes saved links');
assert.equal(linkedPage.searchVendors('zzzzzzzzzzzz', [invitation]).length, 0, 'Unrelated names are not suggested');
const failedPage = run(linkingFixture, async () => ({ ok: false, json: async () => ({ error: 'Organization already linked' }) }));
const failedButton = descendants(failedPage.get('outreach'), element => element.textContent === 'Add vendor as new entry' && element.tagName === 'BUTTON')[0];
await failedButton.click();
assert.equal(failedButton.disabled, false, 'A failed save can be retried');
assert.ok(failedPage.get('outreach').textContent.includes('Organization already linked'));
assert.ok(failedPage.get('outreach').textContent.includes('need linking'), 'Failed saves keep the unmatched questionnaire');
if (process.argv[2]) {
  const html = readFileSync(process.argv[2], 'utf8');
  const data = JSON.parse(html.match(/<script id="analysis-data" type="application\/json">(.*?)<\/script>/s)[1]);
  run(data);
  console.log(`Local dashboard rendered all ${data.submissions.length} saved submissions and all six tabs`);
}
console.log('Full dashboard rendering passed: current, historical and empty submissions');
console.log('Inline vendor search, link, unlink, create and failed-save handling passed');
