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
  data: { questions },
  normalizeOther: value => String(value).trim().replace(/\s+/g, ' ').toLowerCase(),
};
vm.runInNewContext(relevant + '\n' + figures + '\n' +
  'globalThis.measure = (key, rows) => figureResult(figureSpecs[key], vendorGroups(rows)); globalThis.matchVendor = (vendor, rows) => matchedVendorGroups(vendor, vendorGroups(rows));', sandbox);

let nextId = 1;
function response(provider, scopes, selections = {}, offerings = []) {
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
  return { id: nextId++, provider, scopes, version: 10, answers, answer_data };
}
const rows = [
  response('Alpha', ['A', 'D'], {
    apiTypes: [0], externalIntegration: [0], thirdPartyIntegration: [0],
    developerIndependence: [0], dataCapabilities: [1], certifications: [8],
    documentationMethods: [0],
  }, [{ kind: 'core', functions: ['Clinical documentation'], other_functions: [] }]),
  response(' Alpha ', ['E'], { apiTypes: [4], standards: [0] }),
  response('Beta', ['A', 'C'], {
    apiTypes: [], externalIntegration: [0], thirdPartyIntegration: [0],
    developerIndependence: [3], documentationMethods: [0], certifications: [3],
  }, [{ kind: 'function', functions: ['Clinical documentation'], other_functions: [] }]),
  response('Gamma', ['D'], { dataCapabilities: [1], certifications: [7] }),
];
const measure = key => sandbox.measure(key, rows);
assert.equal(measure('documentedApis').matched.length, 1, 'two Alpha submissions count once');
assert.equal(measure('documentedApis').answered.length, 1);
assert.equal(measure('documentedApis').missing.length, 2, 'blank and omitted core answers are missing, not No');
assert.equal(measure('independentDevelopment').answered.length, 2, 'CIS screening is respected');
assert.equal(measure('independentDevelopment').matched.length, 1);
assert.equal(measure('prepopulation').answered.length, 1, 'specialist function is not core CIS');
assert.equal(measure('integrationEngine').matched.length, 2, 'building block counts vendors');
assert.equal(measure('medicalConformity').answered.length, 2, 'Not applicable is excluded');
assert.equal(measure('medicalConformity').matched.length, 1);
assert.equal(sandbox.matchVendor({ provider: 'Different display name', match_name: 'Alpha' }, rows).length, 1, 'alternate questionnaire name links a vendor');
assert.equal(sandbox.matchVendor({ provider: 'Alpha', match_name: '' }, rows)[0].rows.length, 2, 'multiple submissions remain visible under one vendor');
console.log('Presentation figure calculations passed');
