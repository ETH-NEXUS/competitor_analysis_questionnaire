import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const script = readFileSync('api/app/core/analysis_assets/analysis.js', 'utf8');
const schema = JSON.parse(readFileSync('api/app/core/analysis_schema.json', 'utf8'));
const questions = Object.entries(schema).map(([id, definition], index) => ({
  id, number: index + 1, introduced: 1, legacy: false, ...definition,
}));
const relevant = script.slice(script.indexOf('const scopedQuestions ='), script.indexOf('function coverageFor'));
const figures = script.slice(script.indexOf('const figureChoice ='), script.indexOf('function renderSubmissions()'));
const sandbox = {
  data: { questions }, scope: { value: '' }, provider: { value: '' }, mode: { value: 'latest_product' },
  normalizeOther: value => String(value).trim().replace(/\s+/g, ' ').toLowerCase(),
};
const filters = script.slice(script.indexOf('function filteredRows()'), script.indexOf('function addSummaryMetric'));
vm.runInNewContext(relevant + '\n' + filters + '\n' + figures + '\n' +
  'globalThis.productsFor = rows => productGroups(rows); globalThis.filtered = (rows, selectedScope = "") => { data.responses = rows; scope.value = selectedScope; return filteredRows(); }; globalThis.measure = (key, rows) => figureResult(figureSpecs[key], productGroups(rows)); globalThis.matchVendor = (vendor, rows) => matchedVendorGroups(vendor, vendorGroups(rows));', sandbox);

let nextId = 1;
function response(provider, scopes, selections = {}, offerings = [], solution = provider + ' Suite') {
  const answers = {};
  const answer_data = {};
  for (const [id, selected] of Object.entries(selections)) {
    answer_data[id] = { selected: selected.map(String) };
    answers[id] = selected.length ? 'Answered' : '';
  }
  if (offerings.length) {
    answer_data.clinicalCapabilities = { selected: [], offerings };
    answers.clinicalCapabilities = 'Reported offerings';
  }
  return { id: nextId++, provider, solution, scopes, version: 14, answers, answer_data };
}
const rows = [
  response('Alpha', ['A', 'D'], {
    apiTypes: [0], thirdPartyIntegration: [0],
    developerIndependence: [0], dataCapabilities: [1], certifications: [8],
    documentationMethods: [5],
  }, [{ kind: 'core', functions: ['Clinical documentation'], other_functions: [] }]),
  response(' Alpha ', ['D'], { apiTypes: [4], standards: [0] }, [], 'Alpha Portal'),
  response('Beta', ['A', 'C'], {
    apiTypes: [], thirdPartyIntegration: [0],
    developerIndependence: [2], documentationMethods: [5], certifications: [3],
  }, [{ kind: 'function', functions: ['Clinical documentation'], other_functions: [] }]),
  response('Gamma', ['C'], { dataCapabilities: [1], certifications: [7] }),
];
const measure = key => sandbox.measure(key, rows);
assert.equal(measure('documentedApis').matched.length, 1, 'only one Alpha product reports documented APIs');
assert.equal(measure('documentedApis').answered.length, 2);
assert.equal(measure('documentedApis').missing.length, 2, 'blank and omitted core answers are missing, not No');
assert.equal(measure('independentDevelopment').answered.length, 2, 'CIS screening is respected');
assert.equal(measure('independentDevelopment').matched.length, 1);
assert.equal(measure('automaticReuse').answered.length, 1, 'specialist function is not core CIS');
assert.equal(measure('integrationEngine').matched.length, 1, 'building block counts eligible products');
assert.equal(measure('medicalConformity').answered.length, 2, 'Not applicable is excluded');
assert.equal(measure('medicalConformity').matched.length, 1);
assert.equal(sandbox.matchVendor({ provider: 'Different display name', match_name: 'Alpha' }, rows).length, 1, 'alternate questionnaire name links a vendor');
assert.equal(sandbox.matchVendor({ provider: 'Alpha', match_name: '' }, rows)[0].rows.length, 2, 'multiple submissions remain visible under one vendor');
const names = sandbox.productsFor(rows);
assert.equal(names.length, 4, 'two products from Alpha are separate');
assert.equal(sandbox.measure('patientVendors', rows).matched.length, 2);
const latest = response(' alpha ', ['A'], { apiTypes: [4] }, [], ' alpha suite ');
assert.equal(sandbox.productsFor([...rows, latest]).length, 4, 'repeat product submissions are deduplicated');
assert.equal(sandbox.measure('documentedApis', [...rows, latest]).matched.length, 0, 'latest negative answer replaces the old positive');
const sameName = response('Other Vendor', ['A'], { apiTypes: [0] }, [], 'Alpha Suite');
assert.equal(sandbox.productsFor([...rows, sameName]).length, 5, 'same product name from another vendor remains separate');
const unnamed = [response('Alpha', ['C'], {}, [], ''), response('Alpha', ['C'], {}, [], '')];
assert.equal(sandbox.productsFor(unnamed).length, 2, 'unnamed historical products are not merged');
const moved = response('Alpha', ['D'], { apiTypes: [4] });
assert.equal(sandbox.filtered([...rows, moved], 'A').some(row => row.provider === 'Alpha'), false, 'scope filters cannot resurrect an older response');
assert.equal(sandbox.matchVendor({ provider: 'Alpha', match_name: '' }, [...rows, latest]).length, 1, 'outreach still counts one vendor');
console.log('Product figures, latest-product filters and vendor outreach calculations passed');
