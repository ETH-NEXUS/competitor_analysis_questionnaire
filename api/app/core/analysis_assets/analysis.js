'use strict';
const data = JSON.parse(document.getElementById('analysis-data').textContent);
data.questions.filter(question => !question.legacy).forEach((question, index) => { question.number = index + 1; });
const provider = document.getElementById('provider');
const scope = document.getElementById('scope');
const mode = document.getElementById('mode');
const presentation = document.getElementById('presentation');
const outreach = document.getElementById('outreach');
const products = document.getElementById('products');
const charts = document.getElementById('charts');
const providers = document.getElementById('providers');
const submissions = document.getElementById('submissions');
const submissionsTab = document.getElementById('submissions-tab');
const submissionsBadge = document.getElementById('submissions-badge');
const submissionsSeenKey = `questionnaire-analysis-seen-submissions-v1:${data.viewer_id}`;
const newestSubmissionId = () => data.submissions.reduce((latest, row) => Math.max(latest, row.id), 0);
let lastSeenSubmissionId = newestSubmissionId();
try {
  const stored = localStorage.getItem(submissionsSeenKey);
  if (stored !== null && /^\d+$/.test(stored) && Number.isSafeInteger(Number(stored))) lastSeenSubmissionId = Number(stored);
  else localStorage.setItem(submissionsSeenKey, String(lastSeenSubmissionId));
} catch { /* Browser storage may be unavailable. The dashboard still works. */ }
function updateSubmissionBadge() {
  const count = data.submissions.filter(row => row.id > lastSeenSubmissionId).length;
  submissionsBadge.hidden = count === 0;
  submissionsBadge.textContent = count > 99 ? '99+' : String(count);
  submissionsBadge.setAttribute('aria-label', `${count} new ${count === 1 ? 'submission' : 'submissions'}`);
  submissionsTab.title = count ? `${count} new since you last opened Submissions in this browser` : 'No new submissions since you last opened this tab in this browser';
}
function markSubmissionsSeen() {
  lastSeenSubmissionId = Math.max(lastSeenSubmissionId, newestSubmissionId());
  try { localStorage.setItem(submissionsSeenKey, String(lastSeenSubmissionId)); } catch { /* Keep the count for this page. */ }
  updateSubmissionBadge();
}
const exportLink = document.getElementById('export');
const exportUrl = exportLink.href;
const groupingUrl = document.getElementById('grouping-url').dataset.url;
const deleteUrl = document.getElementById('delete-url').dataset.url;
const vendorUrl = document.getElementById('vendor-url').dataset.url;
const csrfToken = document.querySelector('#grouping-security input[name=csrfmiddlewaretoken]').value;
const productFilters = { function: '', specialty: '', source: '' };
const openEditors = new Set();
let activeTab = 'presentation';
const selectedSubmissionIds = new Set();
let outreachSearch = '';
let outreachFilter = 'all';
let outreachCategory = 'all';
const node = (tag, text, className) => {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (className) el.className = className;
  return el;
};
for (const name of [...new Set(data.responses.map(r => r.provider))].sort()) {
  const option = node('option', name); option.value = name; provider.append(option);
}
for (const [key, label] of Object.entries(data.scopes)) {
  const option = node('option', label); option.value = key; scope.append(option);
}
function addChart(parent, groups, denominator) {
  for (const [label, voters] of groups) {
    const row = node('div', undefined, 'bar-row');
    const button = node('button', undefined, 'bar');
    const fill = node('span', undefined, 'bar-fill');
    fill.style.width = `${denominator ? voters.length / denominator * 100 : 0}%`;
    const count = node('span', `${voters.length} (${denominator ? Math.round(voters.length / denominator * 100) : 0}%)`, 'bar-count');
    const names = voters.map(r => `${r.provider}${r.solution ? ' / ' + r.solution : ''} (response #${r.id})`).join('\n');
    const heading = node('span', undefined, 'bar-heading');
    heading.append(node('span', label, 'bar-label'), count);
    const track = node('span', undefined, 'bar-track');
    track.append(fill);
    button.append(heading, track);
    button.setAttribute('aria-label', `${label}: ${voters.length} responses. ${names || 'No respondents'}`);
    button.addEventListener('click', () => row.classList.toggle('open'));
    row.append(button, node('div', names || 'No respondents', 'voters'));
    parent.append(row);
  }
}
function addPie(parent, groups) {
  const total = [...groups.values()].reduce((sum, voters) => sum + voters.length, 0);
  if (!total) { parent.append(node('p', 'No answers yet.', 'empty')); return; }
  const colors = ['#007d76', '#dc8b28', '#526ac7', '#b05280', '#72943b', '#9263b3', '#387d9d', '#a75a3b'];
  const layout = node('div', undefined, 'pie-layout');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 240 240');
  svg.setAttribute('class', 'pie');
  svg.setAttribute('role', 'group');
  svg.setAttribute('aria-label', 'Single-choice answer distribution');
  const legend = node('div', undefined, 'pie-legend');
  const tooltip = node('div', 'Hover, focus or tap a slice to see providers.', 'pie-tooltip');
  tooltip.setAttribute('aria-live', 'polite');
  let angle = -Math.PI / 2;
  let index = 0;
  for (const [label, voters] of groups) {
    const color = colors[index++ % colors.length];
    const percent = voters.length / total * 100;
    const caption = `${label}: ${voters.length} (${percent.toFixed(1)}%)`;
    const names = voters.map(r => `${r.provider}${r.solution ? ' / ' + r.solution : ''} (response #${r.id})`).join('\n');
    const show = () => { tooltip.textContent = `${caption}\n${names || 'No respondents'}`; };
    const button = node('button', undefined, 'pie-key');
    const swatch = node('span', undefined, 'pie-swatch'); swatch.style.backgroundColor = color;
    button.append(swatch, node('span', caption));
    for (const event of ['mouseenter', 'focus', 'click']) button.addEventListener(event, show);
    legend.append(button);
    if (!voters.length) continue;
    const end = angle + voters.length / total * Math.PI * 2;
    const shape = document.createElementNS('http://www.w3.org/2000/svg', voters.length === total ? 'circle' : 'path');
    if (voters.length === total) {
      shape.setAttribute('cx', '120'); shape.setAttribute('cy', '120'); shape.setAttribute('r', '110');
    } else {
      shape.setAttribute('d', `M120 120 L${120 + 110 * Math.cos(angle)} ${120 + 110 * Math.sin(angle)} A110 110 0 ${end - angle > Math.PI ? 1 : 0} 1 ${120 + 110 * Math.cos(end)} ${120 + 110 * Math.sin(end)} Z`);
    }
    shape.setAttribute('fill', color); shape.setAttribute('stroke', 'white'); shape.setAttribute('stroke-width', '2');
    shape.setAttribute('tabindex', '0'); shape.setAttribute('role', 'button'); shape.setAttribute('aria-label', caption);
    for (const event of ['mouseenter', 'focus', 'click']) shape.addEventListener(event, show);
    shape.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); show(); } });
    svg.append(shape); angle = end;
  }
  layout.append(svg, legend); parent.append(layout, tooltip);
  parent.append(node('p', 'Percentages are among answered submissions; unanswered and not-asked responses are excluded.', 'muted'));
}
function addGroup(groups, label, response) {
  if (!groups.has(label)) groups.set(label, []);
  if (!groups.get(label).some(r => r.id === response.id)) groups.get(label).push(response);
}
const normalizeOther = value => value.trim().replace(/\s+/g, ' ').toLowerCase();
const otherOption = q => q.id === 'certifications' ? undefined : (q.options || []).find(label => /^Other(?:\b|\s*\()/i.test(label));
const groupingMap = id => new Map(data.other_groupings.filter(item => item.question_id === id).map(item => [item.answer, item.group]));
const hasWorkflow = workflow => Boolean(workflow && ((workflow.reused_data || []).length || workflow.write_back || workflow.separate_app || workflow.patient_context || workflow.manual_steps));
function otherItems(q, response) {
  const structured = response.answer_data?.[q.id];
  if (structured && Array.isArray(structured.other_items)) {
    const items = structured.other_items.map(item => String(item).trim()).filter(Boolean);
    if (items.length) return items;
  }
  const label = otherOption(q);
  if (!label) return [];
  return (response.answers[q.id] || '').split('\n').flatMap(line => {
    if (line.startsWith(label + ': ')) {
      const value = line.slice(label.length + 2).replace(/^Yes; Description: /, '').trim();
      return value && value !== 'Not answered' ? [value] : [];
    }
    // New specialty answers use a shorter Other prefix in the readable column.
    if (q.kind === 'capabilities' && line.startsWith('Other: ')) return [line.slice(7).trim()];
    return [];
  }).filter(Boolean);
}
async function saveGrouping(q, answer, input, status) {
  const group = input.value.trim();
  status.textContent = 'Saving…';
  try {
    const response = await fetch(groupingUrl, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
      body: JSON.stringify({ question_id: q.id, answer, group }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const saved = await response.json();
    data.other_groupings = data.other_groupings.filter(item => !(item.question_id === q.id && item.answer === saved.answer));
    if (saved.group) data.other_groupings.push(saved);
    render();
  } catch {
    status.textContent = 'Could not save the grouping. Please try again.';
  }
}
function addOtherAnswers(card, q, rows, denominator) {
  if (!otherOption(q)) return;
  const variants = new Map();
  const mappings = new Map(data.other_groupings.filter(item => item.question_id === q.id).map(item => [item.answer, item.group]));
  for (const response of rows) for (const item of otherItems(q, response)) {
    const key = normalizeOther(item);
    if (!variants.has(key)) variants.set(key, { label: item, voters: [] });
    variants.get(key).voters.push(response);
  }
  if (!variants.size && q.kind === 'single') return;
  card.append(node('hr', undefined, 'other-divider'), node('h3', q.kind === 'single' ? 'Group Other answers' : 'Additional answers (Other)'));
  if (!variants.size) { card.append(node('p', 'No additional answers yet.', 'muted')); return; }
  const groups = new Map();
  for (const [key, variant] of variants) {
    const label = mappings.get(key) || variant.label;
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(...variant.voters);
  }
  if (q.kind !== 'single') addChart(card, groups, [...variants.values()].reduce((total, variant) => total + variant.voters.length, 0));
  const heading = node('h4', 'Original answers and grouping');
  card.append(heading);
  const suggestions = node('datalist');
  suggestions.id = `groups-${q.id}`;
  for (const label of [...new Set(mappings.values())].sort()) {
    const option = node('option'); option.value = label; suggestions.append(option);
  }
  card.append(suggestions);
  for (const [key, variant] of variants) {
    const row = node('div', undefined, 'grouping-row');
    const label = node('span', `${variant.label} · ${variant.voters.length} ${variant.voters.length === 1 ? 'answer' : 'answers'}`);
    const input = q.id === 'apiAccess' ? node('select') : node('input');
    if (q.id === 'apiAccess') {
      for (const [value, caption] of [['', 'Place on scale…'], ...(q.options || []).filter(option => option !== otherOption(q)).map(option => [option, option])]) {
        const option = node('option', caption); option.value = value; input.append(option);
      }
    } else {
      input.type = 'text'; input.maxLength = 200;
      input.placeholder = 'Group name (optional)'; input.setAttribute('list', suggestions.id);
    }
    input.value = mappings.get(key) || '';
    input.setAttribute('aria-label', `Group for ${variant.label}`);
    const button = node('button', 'Save grouping');
    const status = node('span', '', 'muted'); status.setAttribute('role', 'status');
    button.addEventListener('click', () => saveGrouping(q, variant.label, input, status));
    row.append(label, input, button, status); card.append(row);
  }
  card.append(node('p', q.id === 'apiAccess' ? 'Place each Other answer on the access scale. Each answer contributes one count.' : 'Use the same group name for answers that mean the same thing. Leave it blank and save to remove a grouping. Counts represent answers.', 'muted'));
}
function clinicalRecords(rows) {
  const records = [];
  const functional = data.questions.find(q => q.id === 'clinicalCapabilities')?.options || [];
  const specialties = data.questions.find(q => q.id === 'specialties')?.options || [];
  const functionGroups = groupingMap('clinicalFunction');
  const specialtyGroups = groupingMap('clinicalSpecialty');
  for (const response of rows) {
    const answer = response.answer_data?.clinicalCapabilities || {};
    if (Array.isArray(answer.offerings)) {
      for (const entry of answer.offerings) {
        if (!entry || !String(entry.name || '').trim()) continue;
        records.push({
          response, name: String(entry.name).trim(),
          developer: entry.source === 'partner' ? String(entry.developer || 'Developer not specified').trim() : response.provider,
          source: entry.source, kind: entry.kind,
          description: String(entry.description || '').trim(),
          purposes: (entry.purposes || []).map(value => value === 'Other' ? `Other: ${entry.purpose_other || 'not specified'}` : value),
          cisRelationship: String(entry.cis_relationship || ''),
          cisRelationshipOther: String(entry.cis_relationship_other || ''),
          cisIntegration: String(entry.cis_integration || ''),
          categoryB: entry.category_b === true,
          workflow: entry.kind === 'core' || (entry.kind === 'function' && entry.category_b && entry.cis_integration === 'no') || (entry.kind === 'integration' && response.version < 7 && !hasWorkflow(entry.workflow)) ? null : entry.workflow || null,
          functions: [...new Set([...(entry.functions || []), ...(entry.other_functions || []).map(value => functionGroups.get(normalizeOther(value)) || value)].filter(Boolean))],
          specialties: [...new Set([...(entry.specialties || []), ...(entry.other_specialties || []).map(value => specialtyGroups.get(normalizeOther(value)) || value), ...(entry.all_specialties ? ['Across specialties'] : [])].filter(Boolean))],
          otherFunctions: (entry.other_functions || []).filter(Boolean),
          otherSpecialties: (entry.other_specialties || []).filter(Boolean),
        });
      }
      continue;
    }
    // Earlier questionnaires stored a product separately under each functional area and specialty.
    const legacy = new Map();
    for (const [questionId, labels, tag] of [['clinicalCapabilities', functional, 'functions'], ['specialties', specialties, 'specialties']]) {
      const old = response.answer_data?.[questionId];
      if (!old?.rows) continue;
      for (const [index, label] of labels.entries()) {
        if (old.rows[index]?.provided !== 'yes') continue;
        const row = old.rows[index];
        const products = old.products?.[index] || (row.name ? [row] : []);
        for (const product of products) {
          if (!String(product.name || '').trim()) continue;
          const source = product.source === '1' ? 'partner' : 'native';
          const key = `${source}:${normalizeOther(product.name)}`;
          if (!legacy.has(key)) legacy.set(key, { response, name: product.name, developer: source === 'native' ? response.provider : 'Developer not specified', source, kind: source === 'partner' ? 'integration' : 'function', description: product.description || '', functions: [], specialties: [], otherFunctions: [], otherSpecialties: [], workflow: null });
          const record = legacy.get(key);
          if (!record[tag].includes(label)) record[tag].push(label);
        }
      }
    }
    records.push(...legacy.values());
  }
  return records;
}
function addClinicalCatalog(card, rows) {
  const records = clinicalRecords(rows);
  if (!records.length) { card.append(node('p', 'No products or modules reported yet.', 'empty')); return; }
  const mappings = new Map(data.other_groupings.filter(item => item.question_id === 'clinicalProduct').map(item => [item.answer, item.group]));
  const groups = new Map();
  const variants = new Map();
  for (const record of records) {
    const raw = `${record.developer} — ${record.name}`;
    const key = normalizeOther(raw);
    if (!variants.has(key)) variants.set(key, raw);
    const label = mappings.get(key) || raw;
    if (!groups.has(label)) groups.set(label, { label, descriptions: new Set(), functions: new Set(), specialties: new Set(), purposes: new Set(), relationships: new Set(), integrationStatuses: new Set(), integrators: new Set(), offeredBy: new Set(), suppliedBy: new Set(), coreBy: new Set(), workflowReports: [] });
    const group = groups.get(label);
    if (record.description) group.descriptions.add(record.description);
    record.functions.forEach(value => group.functions.add(value));
    record.specialties.forEach(value => group.specialties.add(value));
    (record.purposes || []).forEach(value => group.purposes.add(value));
    if (record.categoryB) {
      group.relationships.add(record.cisRelationship === 'other' ? `Other: ${record.cisRelationshipOther || 'not specified'}` : cisRelationshipLabels[record.cisRelationship] || 'Not answered');
      group.integrationStatuses.add(cisIntegrationLabels[record.cisIntegration] || 'Not answered');
    }
    if (record.workflow) group.workflowReports.push({ response: record.response, workflow: record.workflow });
    if (record.kind === 'core') group.coreBy.add(record.response.provider);
    if (record.source === 'partner') {
      if (record.response.scopes.includes('A')) group.integrators.add(record.response.provider);
      else group.suppliedBy.add(record.response.provider);
    } else group.offeredBy.add(record.response.provider);
  }
  const detailsFor = group => {
    const entry = node('div', undefined, 'catalog-product');
    entry.append(node('h4', group.label));
    for (const description of group.descriptions) entry.append(node('p', description, 'catalog-description'));
    if (group.coreBy.size) entry.append(node('p', `Core CIS coverage: ${[...group.coreBy].sort().join(', ')}`, 'muted'));
    if (group.offeredBy.size) entry.append(node('p', `Developed / offered by: ${[...group.offeredBy].sort().join(', ')}`, 'muted'));
    if (group.integrators.size) entry.append(node('p', `Integrated by CIS providers: ${[...group.integrators].sort().join(', ')}`, 'muted'));
    if (group.suppliedBy.size) entry.append(node('p', `Supplied by: ${[...group.suppliedBy].sort().join(', ')}`, 'muted'));
    if (group.purposes.size) entry.append(node('p', `Integration type / purpose: ${[...group.purposes].sort().join(', ')}`, 'muted'));
    if (group.relationships.size) entry.append(node('p', `CIS relationship: ${[...group.relationships].sort().join(', ')}`, 'muted'));
    if (group.integrationStatuses.size) entry.append(node('p', `Typically integrated with CIS: ${[...group.integrationStatuses].sort().join(', ')}`, 'muted'));
    if (group.workflowReports.length) {
      const report = node('details', undefined, 'catalog-workflow');
      report.append(node('summary', `Connected CIS workflow integration · ${group.workflowReports.length} ${group.workflowReports.length === 1 ? 'report' : 'reports'}`));
      const labels = {
        reused_data: { patient: 'Patient details', medication: 'Medication data', lab: 'Laboratory results', none: 'None of these', unknown: 'Not sure' },
        write_back: { automatic: 'Automatically', user_action: 'After user action', manual: 'Manual transfer', none: 'No write-back', unknown: 'Not sure / not applicable' },
        separate_app: { embedded: 'Embedded in CIS', sso: 'Separate app with single sign-on', separate_login: 'Separate sign-in', unknown: 'Not sure' },
        patient_context: { automatic: 'Automatically transferred', manual: 'Patient selected again', none: 'No transfer', unknown: 'Not sure / not applicable' },
      };
      for (const item of group.workflowReports) {
        report.append(node('h5', `${item.response.provider} · response #${item.response.id}`));
        const list = node('dl');
        for (const [key, title] of [['reused_data', 'Connected CIS data reused'], ['write_back', 'Write-back'], ['separate_app', 'Separate application'], ['patient_context', 'Patient context'], ['manual_steps', 'Manual steps']]) {
          const value = item.workflow[key];
          const readable = key === 'manual_steps' ? value : key === 'reused_data' ? (value || []).map(code => code === 'other' ? `Other: ${item.workflow.other_reused_data || 'not specified'}` : labels.reused_data[code] || code).join(', ') : labels[key][value];
          list.append(node('dt', title), node('dd', readable || 'Not answered'));
        }
        report.append(list);
      }
      entry.append(report);
    }
    return entry;
  };
  for (const [heading, field] of [['By specialty', 'specialties'], ['By functional area', 'functions']]) {
    card.append(node('h3', heading));
    const categories = new Map();
    for (const group of groups.values()) for (const tag of group[field]) {
      if (!categories.has(tag)) categories.set(tag, []);
      categories.get(tag).push(group);
    }
    if (!categories.size) card.append(node('p', 'No categories reported yet.', 'muted'));
    for (const [tag, products] of [...categories].sort((a, b) => a[0].localeCompare(b[0]))) {
      const section = node('section', undefined, 'catalog-category');
      section.append(node('h4', tag));
      for (const product of products.sort((a, b) => a.label.localeCompare(b.label))) section.append(detailsFor(product));
      card.append(section);
    }
  }
  const untagged = [...groups.values()].filter(group => !group.functions.size && !group.specialties.size);
  if (untagged.length) {
    card.append(node('h3', 'Products without a category'));
    untagged.forEach(group => card.append(detailsFor(group)));
  }
  const editor = node('details', undefined, 'catalog-editor');
  editor.append(node('summary', 'Merge names for the same product'));
  editor.append(node('p', 'Enter the same “Developer — Product” group name for entries that refer to the same product. The original answers remain unchanged.', 'muted'));
  const suggestions = node('datalist'); suggestions.id = 'clinical-product-groups';
  for (const label of [...groups.keys()].sort()) { const option = node('option'); option.value = label; suggestions.append(option); }
  editor.append(suggestions);
  for (const [key, label] of [...variants].sort((a, b) => a[1].localeCompare(b[1]))) {
    const row = node('div', undefined, 'grouping-row');
    const input = node('input'); input.type = 'text'; input.maxLength = 200; input.value = mappings.get(key) || '';
    input.placeholder = 'Developer — Product'; input.setAttribute('list', suggestions.id);
    input.setAttribute('aria-label', `Product group for ${label}`);
    const button = node('button', 'Save grouping'); button.type = 'button';
    const status = node('span', '', 'muted'); status.setAttribute('role', 'status');
    button.addEventListener('click', () => saveGrouping({ id: 'clinicalProduct' }, label, input, status));
    row.append(node('span', label), input, button, status); editor.append(row);
  }
  card.append(editor);
}
const workflowLabels = {
  reused_data: { patient: 'Patient details', medication: 'Medication data', lab: 'Laboratory results', none: 'None', unknown: 'Not sure' },
  write_back: { automatic: 'Automatic', user_action: 'After user action', manual: 'Manual transfer', none: 'None', unknown: 'Not sure' },
  separate_app: { embedded: 'Embedded in CIS', sso: 'Separate app with SSO', separate_login: 'Separate sign-in', unknown: 'Not sure' },
  patient_context: { automatic: 'Automatic', manual: 'Patient selected again', none: 'None', unknown: 'Not sure' },
};
const cisRelationshipLabels = {
  independent: 'Can operate independently of a specific hospital-wide CIS',
  integration: 'Requires integration with a hospital-wide CIS but is not tied to a specific CIS vendor',
  specific: 'Requires a specific CIS/platform',
  either: 'Can be used either independently or integrated with a hospital-wide CIS',
};
const cisIntegrationLabels = { yes: 'Yes', optional: 'Optional / depends on implementation', no: 'No' };
function workflowCell(record, field) {
  if (record.kind === 'core') return '—';
  if (record.kind === 'function' && record.categoryB && record.cisIntegration === 'no') return 'Not applicable';
  if (!record.workflow) return record.kind === 'integration' && record.response.version < 7 ? 'Not collected in this form version' : 'Not reported';
  const value = record.workflow[field];
  if (field === 'manual_steps') return String(value || '').trim() || 'Not answered';
  if (field === 'reused_data') return (value || []).map(code => code === 'other' ? `Other: ${record.workflow.other_reused_data || 'not specified'}` : workflowLabels.reused_data[code] || code).join(', ') || 'Not answered';
  return workflowLabels[field][value] || 'Not answered';
}
function addCanonicalEditor(parent, id, title, variants, suggestions) {
  if (!variants.size) return;
  const editor = node('details', undefined, 'catalog-editor');
  if (id === 'clinicalProduct') editor.id = 'product-match-editor';
  editor.open = openEditors.has(id);
  editor.addEventListener('toggle', () => editor.open ? openEditors.add(id) : openEditors.delete(id));
  editor.append(node('summary', title));
  editor.append(node('p', 'Give differently worded answers the same group name. You can use an existing category name; the original answers remain unchanged.', 'muted'));
  const mappings = groupingMap(id);
  const choices = node('datalist'); choices.id = `canonical-${id}`;
  for (const label of [...new Set([...suggestions, ...mappings.values()])].sort()) {
    const option = node('option'); option.value = label; choices.append(option);
  }
  editor.append(choices);
  for (const [key, variant] of [...variants].sort((a, b) => a[1].label.localeCompare(b[1].label))) {
    const row = node('div', undefined, 'grouping-row');
    row.dataset.variant = key;
    const input = node('input'); input.type = 'text'; input.maxLength = 200;
    input.value = mappings.get(key) || ''; input.setAttribute('list', choices.id);
    input.placeholder = 'Group name (optional)'; input.setAttribute('aria-label', `Group for ${variant.label}`);
    const button = node('button', 'Save grouping'); button.type = 'button';
    const status = node('span', '', 'muted'); status.setAttribute('role', 'status');
    button.addEventListener('click', () => { openEditors.add(id); saveGrouping({ id }, variant.label, input, status); });
    row.append(node('span', `${variant.label} · ${variant.count} ${variant.count === 1 ? 'entry' : 'entries'}`), input, button, status);
    editor.append(row);
  }
  parent.append(editor);
}
function variantsFor(records, field) {
  const variants = new Map();
  for (const record of records) for (const value of record[field]) {
    const key = normalizeOther(value);
    if (!variants.has(key)) variants.set(key, { label: value, count: 0 });
    variants.get(key).count += 1;
  }
  return variants;
}
function renderProductComparison(rows) {
  products.replaceChildren();
  const card = node('article', undefined, 'card');
  card.append(node('h2', 'Products and modules by specialty and function'));
  const records = clinicalRecords(rows);
  if (!records.length) {
    card.append(node('p', 'No products or modules reported for these filters.', 'empty'));
    products.append(card);
    return;
  }
  card.append(node('p', 'Products match automatically when the reported company and product names differ only in capitalization or spacing. Use Edit match to join names that refer to the same product; original answers stay unchanged.', 'muted'));
  const productGroups = groupingMap('clinicalProduct');
  const productName = record => {
    const raw = `${record.developer} — ${record.name}`;
    return productGroups.get(normalizeOther(raw)) || raw;
  };
  const integrators = new Map();
  for (const record of records) if (record.kind === 'integration' && record.response.scopes.includes('A')) {
    const key = productName(record);
    if (!integrators.has(key)) integrators.set(key, new Set());
    integrators.get(key).add(record.response.provider);
  }
  const filters = node('div', undefined, 'matrix-filters');
  const addFilter = (key, caption, values) => {
    const label = node('label', caption);
    const select = node('select');
    const all = node('option', 'All'); all.value = ''; select.append(all);
    for (const [value, text] of values) { const option = node('option', text); option.value = value; select.append(option); }
    if (![...select.options].some(option => option.value === productFilters[key])) productFilters[key] = '';
    select.value = productFilters[key];
    select.addEventListener('change', () => { productFilters[key] = select.value; renderProductComparison(rows); });
    label.append(select); filters.append(label);
  };
  addFilter('function', 'Functional area', [...new Set(records.flatMap(record => record.functions))].sort().map(value => [value, value]));
  addFilter('specialty', 'Specialty', [...new Set(records.flatMap(record => record.specialties))].sort().map(value => [value, value]));
  addFilter('source', 'Offering type', [['core', 'Core CIS'], ['integration', 'Third-party integration'], ['function', 'Specialized function']]);
  card.append(filters);
  const visible = records.filter(record =>
    (!productFilters.function || record.functions.includes(productFilters.function)) &&
    (!productFilters.specialty || record.specialties.includes(productFilters.specialty)) &&
    (!productFilters.source || record.kind === productFilters.source)
  );
  card.append(node('p', `${visible.length} of ${records.length} reported offerings shown`, 'coverage'));
  if (!visible.length) card.append(node('p', 'No offerings match these product filters.', 'empty'));
  else {
    const scroll = node('div', undefined, 'matrix-scroll');
    const table = node('table', undefined, 'product-matrix');
    const header = node('tr');
    for (const title of ['Product', 'Reporting provider', 'Type', 'Integration type / purpose', 'CIS relationship', 'Typically integrated with CIS', 'Functional areas', 'Specialties', 'Integrated by CIS providers', 'Connected CIS data reused', 'Write-back', 'Application', 'Patient context', 'Manual steps']) header.append(node('th', title));
    const head = node('thead'); head.append(header); table.append(head);
    const body = node('tbody');
    for (const record of visible.sort((a, b) => productName(a).localeCompare(productName(b)) || a.response.provider.localeCompare(b.response.provider))) {
      const row = node('tr');
      const product = node('td'); product.append(node('strong', productName(record)));
      const raw = `${record.developer} — ${record.name}`;
      if (productName(record) !== raw) product.append(node('small', `Reported as ${raw}`));
      if (record.description) product.append(node('small', record.description));
      const matchButton = node('button', 'Edit match', 'product-match-button');
      matchButton.type = 'button';
      matchButton.setAttribute('aria-label', `Edit product match for ${raw}`);
      matchButton.addEventListener('click', () => {
        const editor = document.getElementById('product-match-editor');
        if (!editor) return;
        editor.open = true;
        openEditors.add('clinicalProduct');
        const target = [...editor.querySelectorAll('[data-variant]')].find(item => item.dataset.variant === normalizeOther(raw));
        (target || editor).scrollIntoView({ behavior: 'smooth', block: 'center' });
        target?.querySelector('input')?.focus({ preventScroll: true });
      });
      product.append(matchButton);
      const type = record.kind === 'core' ? 'Core CIS' : record.kind === 'integration' ? 'Third-party integration' : 'Specialized function';
      row.append(
        product,
        node('td', `${record.response.provider}\nResponse #${record.response.id}`),
        node('td', type),
        node('td', (record.purposes || []).join(', ') || '—'),
        node('td', record.categoryB ? record.cisRelationship === 'other' ? `Other: ${record.cisRelationshipOther || 'not specified'}` : cisRelationshipLabels[record.cisRelationship] || 'Not answered' : '—'),
        node('td', record.categoryB ? cisIntegrationLabels[record.cisIntegration] || 'Not answered' : '—'),
        node('td', record.functions.join(', ') || 'Not specified'),
        node('td', record.specialties.join(', ') || 'Not specified'),
        node('td', [...(integrators.get(productName(record)) || [])].sort().join(', ') || '—'),
        node('td', workflowCell(record, 'reused_data')),
        node('td', workflowCell(record, 'write_back')),
        node('td', workflowCell(record, 'separate_app')),
        node('td', workflowCell(record, 'patient_context')),
        node('td', workflowCell(record, 'manual_steps')),
      );
      body.append(row);
    }
    table.append(body); scroll.append(table); card.append(scroll);
  }
  const functionOptions = data.questions.find(q => q.id === 'clinicalCapabilities')?.options || [];
  const specialtyOptions = data.clinical_specialties || [];
  addCanonicalEditor(card, 'clinicalFunction', 'Group additional functional areas', variantsFor(records, 'otherFunctions'), functionOptions);
  addCanonicalEditor(card, 'clinicalSpecialty', 'Group additional specialties', variantsFor(records, 'otherSpecialties'), specialtyOptions.filter(value => !value.startsWith('Other')));
  addCanonicalEditor(card, 'clinicalProduct', 'Merge names for the same product', variantsFor(records.map(record => ({ raw: [`${record.developer} — ${record.name}`] })), 'raw'), []);
  products.append(card);
}
const scopedQuestions = {
  thirdPartyIntegration: ['A'], developerIndependence: ['A'], developerResources: ['A'], thirdPartyApproval: ['A'],
  appIntegrationStandards: ['A', 'B', 'C', 'D'], structuredTypes: ['A', 'B', 'C', 'D'],
  terminologies: ['A', 'B', 'C', 'D'], clinicalModels: ['A', 'B', 'C', 'D'],
  clinicalCapabilities: ['A', 'B'], documentationMethods: ['A', 'B'],
  dataCapabilities: ['C'], dataExchangeHandling: ['C'], dataIndependent: ['C'],
  patientFunctions: ['D'], languages: ['D'], aggregationMethods: ['D'], writeBack: ['D'], patientIndependent: ['D'], patientExchange: ['D'],
  rollout: ['A'], migration: ['A'], goLive: ['A'], requirements: ['B', 'C', 'D'],
};
const cisIntegrationOptions = ['0', '1', '2', '3', '4', '5', '6', '7', '8'];
function answerSelection(response, id) { return response.answer_data?.[id]?.selected || []; }
function screeningStatus(response, id, allowed, introduced = 6) {
  if (response.version < introduced) return 'earlierRouting';
  const selected = answerSelection(response, id);
  if (!selected.length) return 'screenUnanswered';
  return selected.some(value => allowed.includes(value)) ? 'eligible' : 'notApplicable';
}
const missingAfterScreen = status => status === 'eligible' ? 'notRecorded' : status;
function answerStatus(q, response) {
  const text = response.answers[q.id];
  if (text !== null) return text?.trim() ? 'answered' : 'unanswered';
  if (response.version < q.introduced) return 'earlierForm';
  if (q.legacy) return response.version >= 5 ? 'retiredForm' : 'notRecorded';
  const scopes = scopedQuestions[q.id];
  if (scopes && !scopes.some(value => response.scopes.includes(value))) return 'notApplicable';
  if (['developerIndependence', 'developerResources', 'thirdPartyApproval'].includes(q.id))
    return missingAfterScreen(screeningStatus(response, 'thirdPartyIntegration', cisIntegrationOptions, 5));
  if (['structuredTypes', 'clinicalModels', 'reportingMethods', 'research', 'secondary', 'switzerland', 'archive'].includes(q.id))
    return missingAfterScreen(screeningStatus(response, 'dataRetention', ['0', '1'], 13));
  if (q.id === 'export')
    return missingAfterScreen(screeningStatus(response, 'dataRetention', ['0'], 13));
  if (q.id === 'exportDetails') {
    const status = answerStatus(questionById.get('export'), response);
    if (status !== 'answered' && status !== 'unanswered' && status !== 'notRecorded') return status;
    return missingAfterScreen(screeningStatus(response, 'export', ['2', '3', '4'], 1));
  }
  if (q.id === 'documentationMethods') {
    const offerings = response.answer_data?.clinicalCapabilities?.offerings;
    if (!Array.isArray(offerings)) return response.version < 5 ? 'earlierForm' : 'screenUnanswered';
    return offerings.some(offering => ['core', 'function'].includes(offering.kind) && [...(offering.functions || []), ...(offering.other_functions || [])].some(value => String(value).trim().toLowerCase() === 'clinical documentation')) ? 'notRecorded' : 'notApplicable';
  }
  return 'notRecorded';
}
function coverageFor(q, rows) {
  const groups = { answered: [], unanswered: [], notApplicable: [], screenUnanswered: [], earlierForm: [], earlierRouting: [], retiredForm: [], notRecorded: [] };
  for (const response of rows) groups[answerStatus(q, response)].push(response);
  return groups;
}
const scopeOrder = Object.keys(data.scopes);
function sortedVendors(rows) {
  const primaryScope = response => Math.min(...response.scopes.map(code => scopeOrder.indexOf(code)).filter(index => index >= 0), scopeOrder.length);
  return [...rows].sort((a, b) => primaryScope(a) - primaryScope(b) || a.provider.localeCompare(b.provider) || a.id - b.id);
}
function vendorTable(card, columns, rows, cellFor, { totals = false, additionalStart = -1, statusFor = null } = {}) {
  const scroll = node('div', undefined, 'matrix-scroll');
  const table = node('table', undefined, 'answer-matrix');
  const head = node('thead');
  const headings = node('tr');
  headings.append(node('th', 'Provider / submission'));
  if (statusFor) headings.append(node('th', 'Response'));
  columns.forEach((label, index) => {
    const heading = node('th', label);
    if (index === additionalStart) heading.classList.add('additional-column');
    headings.append(heading);
  });
  head.append(headings); table.append(head);
  const body = node('tbody');
  let previousScope = null;
  for (const response of sortedVendors(rows)) {
    const first = scopeOrder.find(code => response.scopes.includes(code)) || 'Other';
    if (first !== previousScope) {
      const group = node('tr', undefined, 'vendor-group');
      const label = node('th', first === 'Other' ? 'Scope not specified' : `${first} · ${data.scopes[first]}`);
      label.colSpan = columns.length + 1 + (statusFor ? 1 : 0); group.append(label); body.append(group);
      previousScope = first;
    }
    const row = node('tr');
    const vendor = node('th', undefined, 'vendor-name');
    vendor.scope = 'row';
    vendor.append(node('strong', response.provider || 'Unnamed provider'));
    vendor.append(node('small', `${response.solution ? `${response.solution} · ` : ''}#${response.id} · ${response.scopes.join(', ') || 'No scope'}`));
    row.append(vendor);
    if (statusFor) row.append(node('td', statusFor(response) === 'answered' ? 'Answered' : 'Unanswered', 'answer-status'));
    columns.forEach((label, index) => {
      const value = cellFor(response, label);
      const cell = node('td', value === 1 ? '✓' : value || '—', value ? 'matrix-yes' : 'matrix-no');
      if (index === additionalStart) cell.classList.add('additional-column');
      cell.setAttribute('aria-label', `${response.provider}: ${label}: ${value === 1 ? 'Yes' : value || 'No'}`);
      row.append(cell);
    });
    body.append(row);
  }
  table.append(body);
  if (totals) {
    const foot = node('tfoot'); const row = node('tr'); row.append(node('th', 'Answer count'));
    if (statusFor) row.append(node('td', ''));
    columns.forEach((label, index) => {
      const total = rows.reduce((sum, response) => sum + (cellFor(response, label) || 0), 0);
      const cell = node('td', String(total));
      if (index === additionalStart) cell.classList.add('additional-column');
      row.append(cell);
    });
    foot.append(row); table.append(foot);
  }
  scroll.append(table); card.append(scroll);
}
function addMultiMatrix(card, q, eligible) {
  const predefined = (q.options || []).filter(label => label !== otherOption(q));
  const grouped = groupingMap(q.id);
  const perResponse = new Map();
  const additions = new Set();
  let hasUngrouped = false;
  for (const response of eligible) {
    const values = new Map();
    const increment = label => values.set(label, (values.get(label) || 0) + 1);
    const selected = answerSelection(response, q.id);
    if (selected.length) {
      for (const index of selected) {
        const label = q.options?.[Number(index)];
        if (label && label !== otherOption(q)) increment(label);
      }
    } else {
      const lines = (response.answers[q.id] || '').split('\n');
      for (const label of predefined) if (lines.some(line => line === label || line.startsWith(label + ': '))) increment(label);
    }
    for (const item of otherItems(q, response)) {
      const group = grouped.get(normalizeOther(item));
      if (group) {
        increment(group);
        if (!predefined.includes(group)) additions.add(group);
      } else { increment('Other (ungrouped)'); hasUngrouped = true; }
    }
    perResponse.set(response.id, values);
  }
  const columns = [...predefined, ...[...additions].sort(), ...(otherOption(q) || hasUngrouped ? ['Other (ungrouped)'] : [])];
  card.append(node('p', 'A tick means the provider selected the feature. A number means several additional answers were grouped into the same feature. The last row counts answers.', 'muted'));
  vendorTable(card, columns, eligible, (response, label) => perResponse.get(response.id)?.get(label) || 0, { totals: true, additionalStart: columns.length > predefined.length ? predefined.length : -1, statusFor: response => answerStatus(q, response) });
}
function addFhirReleaseMatrix(card, rows) {
  const fhirRows = rows.filter(response => answerSelection(response, 'standards').includes('0') || (response.answers.standards || '').split('\n').includes('HL7 FHIR'));
  if (!fhirRows.length) return;
  const releases = ['R2', 'R3', 'R4', 'R4B', 'R5', 'Other'];
  const selectedFor = response => {
    const answer = response.answer_data?.standards || {};
    if (Array.isArray(answer.followups?.['0'])) return answer.followups['0'];
    const legacy = String(answer.details?.['0'] || '').trim();
    return legacy ? [releases.includes(legacy) ? legacy : 'Other'] : [];
  };
  card.append(node('h3', 'Primary FHIR release used in production'));
  vendorTable(card, releases, fhirRows, (response, label) => selectedFor(response).includes(label) ? 1 : 0, { totals: true });
  const other = fhirRows.filter(response => selectedFor(response).includes('Other'));
  if (other.length) {
    const list = node('dl', undefined, 'open-answers');
    for (const response of sortedVendors(other)) {
      list.append(node('dt', `${response.provider} · response #${response.id}`));
      list.append(node('dd', response.answer_data?.standards?.details?.fhir_other || response.answer_data?.standards?.details?.['0'] || 'Other release not specified'));
    }
    card.append(node('h4', 'Other FHIR releases'), list);
  }
}
function addHl7v2Matrix(card, rows) {
  const v2Rows = rows.filter(response => answerSelection(response, 'standards').includes('1'));
  if (!v2Rows.length) return;
  const types = ['ADT', 'ORM', 'ORU', 'OML', 'MDM', 'SIU', 'DFT', 'BAR', 'RDE', 'RAS', 'VXU', 'Other', 'Not sure'];
  card.append(node('h3', 'HL7 v2 message types supported'));
  vendorTable(card, types, v2Rows, (response, label) => (response.answer_data?.standards?.followups?.['1'] || []).includes(label) ? 1 : 0, { totals: true });
  const other = v2Rows.filter(response => (response.answer_data?.standards?.followups?.['1'] || []).includes('Other'));
  if (other.length) {
    const list = node('dl', undefined, 'open-answers');
    for (const response of sortedVendors(other)) {
      list.append(node('dt', `${response.provider} · response #${response.id}`));
      list.append(node('dd', response.answer_data?.standards?.details?.hl7v2_other || 'Not specified'));
    }
    card.append(node('h4', 'Other HL7 v2 message types'), list);
  }
}
function addCertificationsTable(card, rows, q) {
  card.append(node('h3', 'Certification / assessment details'));
  const entries = sortedVendors(rows).flatMap(response => Object.entries(response.answer_data?.certifications?.certification_details || {}).map(([index, detail]) => ({ response, label: q.options?.[Number(index)] || `Selection ${index}`, detail })));
  if (!entries.length) { card.append(node('p', 'No certification details reported.', 'muted')); return; }
  const scroll = node('div', undefined, 'matrix-scroll');
  const table = node('table', undefined, 'answer-matrix');
  const head = node('thead'); const header = node('tr');
  ['Provider / submission', 'Certification / assessment', 'Name', 'Scope', 'Valid until'].forEach(label => header.append(node('th', label)));
  head.append(header); table.append(head);
  const body = node('tbody');
  for (const { response, label, detail } of entries) {
    const row = node('tr');
    row.append(node('th', `${response.provider} · #${response.id}`), node('td', label), node('td', detail.name || '—'), node('td', (detail.scopes || []).map(value => value === 'other' ? `Other: ${detail.scope_other || 'not specified'}` : value === 'solution' ? 'Solution or product' : 'Organization').join(', ') || '—'), node('td', detail.valid_until || 'Not specified'));
    body.append(row);
  }
  table.append(body); scroll.append(table); card.append(scroll);
}
function addImplementationRequirements(card, rows) {
  const noRows = rows.filter(response => answerSelection(response, 'requirements').includes('1'));
  if (!noRows.length) return;
  const options = ['Integration with CIS/HIS', 'Integration with patient administration/ADT', 'Identity/SSO integration', 'Other clinical-system integrations', 'Data migration/import', 'Hospital-specific interface development', 'Vendor-specific customization/development', 'Local infrastructure/components', 'Clinical workflow/process configuration', 'Other'];
  card.append(node('h3', 'What is typically required if standard configuration is insufficient?'));
  vendorTable(card, options, noRows, (response, label) => (response.answer_data?.requirements?.followups?.['1'] || []).includes(String(options.indexOf(label))) ? 1 : 0, { totals: true });
  const other = noRows.filter(response => (response.answer_data?.requirements?.followups?.['1'] || []).includes('9'));
  if (other.length) {
    const list = node('dl', undefined, 'open-answers');
    for (const response of sortedVendors(other)) list.append(node('dt', `${response.provider} · #${response.id}`), node('dd', response.answer_data?.requirements?.details?.requirements_other || 'Not specified'));
    card.append(node('h4', 'Other requirements'), list);
  }
}
function addTestingEventTable(card, rows) {
  const reported = rows.filter(response => answerSelection(response, 'interoperabilityTesting').includes('0') || String(response.answers.interoperabilityTesting || '').startsWith('Yes – please specify'));
  if (!reported.length) return;
  card.append(node('h3', 'Interoperability testing events'));
  const scroll = node('div', undefined, 'matrix-scroll');
  const table = node('table', undefined, 'answer-matrix');
  const head = node('thead'); const heading = node('tr');
  for (const label of ['Provider / submission', 'Event', 'Year', 'Tested profiles / use cases', 'Outcome / result']) heading.append(node('th', label));
  head.append(heading); table.append(head);
  const body = node('tbody');
  for (const response of sortedVendors(reported)) {
    const events = response.answer_data?.interoperabilityTesting?.testing_events || [];
    for (const event of events.length ? events : [null]) {
      const row = node('tr');
      const legacy = response.answer_data?.interoperabilityTesting?.details?.['0'] || '';
      row.append(
        node('th', `${response.provider} / ${response.solution || 'Unnamed solution'} · #${response.id}`),
        node('td', event ? event.event === 'Other' ? event.event_other : event.event || '—' : legacy || 'Earlier free-text answer'),
        node('td', event?.year || '—'),
        node('td', event?.profiles || '—'),
        node('td', event ? event.outcome === 'Other' ? event.outcome_other : event.outcome || '—' : 'Not collected separately'),
      );
      body.append(row);
    }
  }
  table.append(body); scroll.append(table); card.append(scroll);
}
function addRowMatrix(card, q, eligible) {
  const columns = (q.options || []).filter(label => label !== otherOption(q));
  card.append(node('p', q.kind === 'costs' ? 'Each cell shows the cost classification reported for that item.' : 'Each cell shows the answer reported for that item.', 'muted'));
  vendorTable(card, columns, eligible, (response, label) => {
    const line = (response.answers[q.id] || '').split('\n').find(value => value.startsWith(label + ': '));
    return line ? line.slice(label.length + 2) : '';
  }, { statusFor: response => answerStatus(q, response) });
}
function addOfferingMatrices(card, q, eligible) {
  const records = clinicalRecords(eligible);
  for (const [heading, field, predefined] of [
    ['Functional areas by provider', 'functions', (q.options || []).filter(label => label !== otherOption(q))],
    ['Specialties by provider', 'specialties', (data.clinical_specialties || []).filter(label => !/^Other\b/i.test(label))],
  ]) {
    const observed = new Set(records.flatMap(record => record[field]));
    const additional = [...observed].filter(label => !predefined.includes(label)).sort();
    const columns = [...predefined, ...additional];
    card.append(node('h3', heading));
    card.append(node('p', 'A tick means this provider reported at least one offering in the area. The total counts providers.', 'muted'));
    vendorTable(card, columns, eligible, (response, label) => records.some(record => record.response.id === response.id && record[field].includes(label)) ? 1 : 0, {
      totals: true,
      additionalStart: additional.length ? predefined.length : -1,
      statusFor: response => answerStatus(q, response),
    });
  }
}
function questionChart(q, rows) {
  const card = node('article', undefined, 'card');
  card.id = 'analysis-question-' + q.id;
  card.append(node('h2', q.legacy ? `Earlier version. ${q.label}` : `Q${q.number}. ${q.label}`));
  const coverage = coverageFor(q, rows);
  const answered = coverage.answered;
  const asked = [...answered, ...coverage.unanswered];
  const eligible = [...asked, ...coverage.notRecorded];
  const labels = [
    `${eligible.length} eligible / shown`, `${answered.length} answered`, `${coverage.unanswered.length} unanswered`,
    `${coverage.notApplicable.length} not applicable`, `${coverage.screenUnanswered.length} screening unanswered`,
    `${coverage.earlierForm.length} earlier form`, `${coverage.earlierRouting.length} earlier routing`, `${coverage.retiredForm.length} retired question`,
    `${coverage.notRecorded.length} not recorded`,
  ];
  card.append(node('p', labels.filter((label, index) => index < 3 || !label.startsWith('0 ')).join(' · '), 'coverage'));
  card.append(node('p', `Answered by: ${answered.length ? sortedVendors(answered).map(response => `${response.provider} (#${response.id})`).join(', ') : 'No providers yet'}`, 'respondents'));
  if (q.kind === 'offerings') {
    addOfferingMatrices(card, q, eligible);
    card.append(node('h3', 'Reported products and modules'));
    addClinicalCatalog(card, rows);
  } else if (q.id === 'apiAccess') {
    const ranked = (q.options || []).filter(option => option !== otherOption(q));
    const groups = new Map(ranked.map(label => [label, []]));
    const mappings = new Map(data.other_groupings.filter(item => item.question_id === q.id).map(item => [item.answer, item.group]));
    const unplaced = [];
    for (const response of answered) {
      const saved = response.answer_data?.apiAccess?.selected?.[0];
      const selected = /^\d+$/.test(String(saved)) ? Number(saved) : (q.options || []).findIndex(label => response.answers.apiAccess === label || response.answers.apiAccess?.startsWith(label + ': '));
      const chosen = (q.options || [])[selected];
      if (chosen && groups.has(chosen)) addGroup(groups, chosen, response);
      else {
        const raw = otherItems(q, response)[0];
        const assigned = raw ? mappings.get(normalizeOther(raw)) : undefined;
        if (assigned && groups.has(assigned)) addGroup(groups, assigned, response);
        else unplaced.push(response);
      }
    }
    card.append(node('p', 'Broad documented access or exchange is at the top; no documented interfaces/APIs is at the bottom. Administrators place Other answers on this scale.', 'muted'));
    const spectrum = node('div', undefined, 'access-spectrum');
    addChart(spectrum, groups, answered.length); card.append(spectrum);
    if (unplaced.length) card.append(node('p', `${unplaced.length} Other ${unplaced.length === 1 ? 'answer awaits' : 'answers await'} placement on the scale.`, 'muted'));
  } else if (q.kind === 'text') {
    addChart(card, new Map([
      ['Answer provided', answered], ['Unanswered', asked.filter(r => !r.answers[q.id]?.trim())],
    ]), asked.length);
    if (answered.length) {
      card.append(node('h3', 'Answers by provider'));
      const list = node('dl', undefined, 'open-answers');
      for (const response of answered) {
        list.append(node('dt', `${response.provider}${response.solution ? ' / ' + response.solution : ''} · response #${response.id}`));
        list.append(node('dd', response.answers[q.id]));
      }
      card.append(list);
    }
  } else if (q.kind === 'capabilities' || q.kind === 'costs') {
    addRowMatrix(card, q, eligible);
  } else if (q.kind === 'multi') {
    addMultiMatrix(card, q, eligible);
    if (q.id === 'standards') { addFhirReleaseMatrix(card, answered); addHl7v2Matrix(card, answered); }
    if (q.id === 'certifications') addCertificationsTable(card, answered, q);
  } else {
    const groups = new Map((q.options || []).filter(label => label !== otherOption(q)).map(label => [label, []]));
    const optionsByLength = [...(q.options || [])].sort((a, b) => b.length - a.length);
    const mappings = new Map(data.other_groupings.filter(item => item.question_id === q.id).map(item => [item.answer, item.group]));
    for (const r of answered) {
      if (q.kind === 'single') {
        const text = r.answers[q.id].trim();
        const selected = answerSelection(r, q.id)[0];
        const firstLine = text.split('\n')[0];
        const option = /^\d+$/.test(String(selected)) ? q.options?.[Number(selected)] : optionsByLength.find(label => firstLine === label || firstLine.startsWith(label + ': '));
        if (option === otherOption(q)) {
          const raw = otherItems(q, r)[0];
          if (!raw) addGroup(groups, 'Other', r);
          else {
            const key = normalizeOther(raw);
            const group = mappings.get(key);
            addGroup(groups, group ? `Other: ${group}` : 'Other', r);
          }
        } else addGroup(groups, option || `Historical answer: ${text}`, r);
        continue;
      }
      // Follow-up descriptions can span lines. Only option boundaries count as votes.
      const lines = r.answers[q.id].split('\n');
      let hasMatch = false;
      for (const line of lines) {
        const option = optionsByLength.find(label => line === label || line.startsWith(label + ': '));
        if (option) { if (option !== otherOption(q)) addGroup(groups, option, r); hasMatch = true; }
        else if (!hasMatch && line.trim()) addGroup(groups, `Historical answer: ${line}`, r);
        if (q.kind === 'single' && hasMatch) break;
      }
    }
    addPie(card, groups);
    if (q.id === 'interoperabilityTesting') addTestingEventTable(card, answered);
    if (q.id === 'requirements') addImplementationRequirements(card, answered);
  }
  if (q.kind !== 'offerings') addOtherAnswers(card, q, answered, asked.length);
  return card;
}
const sectionNames = {
  '1.1': 'Interoperability and openness', '1.2': 'Solution capabilities', '1.3': 'Security',
  '1.4': 'Governance', '1.5': 'Cost and business model', '2.1': 'CIS third-party ecosystem',
  '2.2': 'External application integration', '2.3': 'Clinical data capabilities and use',
  '2.4': 'Clinical records and patient data', '2.5': 'HCP-facing solutions',
  '2.6': 'Data and interoperability', '2.7': 'Patient-facing solutions',
  '2.8': 'Implementation and migration', '2.9': 'Hospital-wide rollout and migration',
  '2.10': 'Integration requirements',
};
const openSections = new Set(['1.1']);
function filteredRows() {
  const filtered = data.responses.filter(r => (!provider.value || r.provider === provider.value) && (!scope.value || r.scopes.includes(scope.value)));
  if (mode.value !== 'latest_provider') return filtered;
  const seen = new Set();
  return filtered.filter(row => {
    const key = normalizeOther(row.provider) || `response:${row.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function addSummaryMetric(parent, value, title, detail) {
  const metric = node('div', undefined, 'summary-metric');
  metric.append(node('strong', String(value)), node('span', title));
  if (detail) metric.append(node('small', detail));
  parent.append(metric);
}
const figureChoice = (id, ...labels) => ({ id, labels });
const figureSpecs = {
  documentedApis: { label: 'Documented APIs', terms: [figureChoice('apiTypes', 'Standards-based REST APIs (e.g. HL7 FHIR)', 'openEHR API', 'Proprietary REST APIs', 'Other documented APIs')] },
  fhirStandard: { label: 'HL7 FHIR', terms: [figureChoice('standards', 'HL7 FHIR')] },
  independentDevelopment: { label: 'Independent third-party development', scope: 'A', terms: [figureChoice('developerIndependence', 'Yes, independently', 'Yes, after registration/approval by the vendor')] },
  sandbox: { label: 'Sandbox / test environment', scope: 'A', terms: [figureChoice('developerResources', 'Sandbox/test environment')] },
  apiWriteBack: { label: 'Write-back via documented APIs', scope: 'A', terms: [figureChoice('thirdPartyIntegration', 'Write-back through documented APIs')] },
  smart: { label: 'SMART on FHIR', terms: [figureChoice('appIntegrationStandards', 'SMART on FHIR')] },
  cloud: { label: 'At least one cloud deployment option', terms: [figureChoice('deployment', 'Private cloud', 'Public cloud', 'Vendor-hosted/SaaS', 'Hybrid deployment')] },
  swissResidency: { label: 'All patient data can remain in Switzerland', terms: [figureChoice('switzerland', 'Yes', 'Yes, but subject to specific deployment/hosting model')] },
  onPremise: { label: 'Customer on-premise', terms: [figureChoice('deployment', 'Customer on-premise')] },
  privateCloud: { label: 'Private cloud', terms: [figureChoice('deployment', 'Private cloud')] },
  publicCloud: { label: 'Public cloud', terms: [figureChoice('deployment', 'Public cloud')] },
  saas: { label: 'Vendor-hosted / SaaS', terms: [figureChoice('deployment', 'Vendor-hosted/SaaS')] },
  hybrid: { label: 'Hybrid', terms: [figureChoice('deployment', 'Hybrid deployment')] },
  exitProcess: { label: 'Contractually defined exit / transition process', terms: [figureChoice('transition', 'Contractually defined exit/transition process')] },
  recordExport: { label: 'Complete structured / vendor-neutral patient-record export', terms: [figureChoice('export', 'Yes, complete export in standardized/vendor-neutral formats')] },
  reusableContent: { label: 'Customer can independently reuse configurations / content', terms: [figureChoice('rights', 'Customer retains rights and can export/reuse them independently of the solution')] },
  vendorMigration: { label: 'Migration requires vendor-specific conversion / services', terms: [figureChoice('migration', 'Migration generally requires substantial custom development / conversion'), figureChoice('export', 'Export requires vendor-specific migration/conversion services')] },
  fhirModel: { label: 'FHIR resources / profiles', terms: [figureChoice('clinicalModels', 'HL7 FHIR resources/profiles')] },
  snomed: { label: 'SNOMED CT', terms: [figureChoice('terminologies', 'SNOMED CT')] },
  loinc: { label: 'LOINC', terms: [figureChoice('terminologies', 'LOINC')] },
  openEhr: { label: 'openEHR archetypes / templates', terms: [figureChoice('clinicalModels', 'openEHR archetypes/templates')] },
  omop: { label: 'OMOP Common Data Model', terms: [figureChoice('clinicalModels', 'OMOP Common Data Model')] },
  researchApi: { label: 'Research APIs / data extraction', terms: [figureChoice('research', 'Research APIs/data extraction')] },
  deidentification: { label: 'De-identification / pseudonymisation', terms: [figureChoice('research', 'De-identification/pseudonymisation tools')] },
  secondaryGovernance: { label: 'Secondary-use governance', terms: [figureChoice('secondary', 'Patient consent management', 'Purpose/data-use restrictions', 'Role/project-based data access', 'Audit trail of secondary data use')] },
  clinicalDocumentation: { label: 'Clinical documentation', scope: 'A', kind: 'coreFunction', coreFunction: 'Clinical documentation', terms: [figureChoice('clinicalCapabilities')] },
  medicationManagement: { label: 'Medication management', scope: 'A', kind: 'coreFunction', coreFunction: 'Medication management', terms: [figureChoice('clinicalCapabilities')] },
  nursingWorkflows: { label: 'Nursing workflows', scope: 'A', kind: 'coreFunction', coreFunction: 'Nursing documentation / workflows', terms: [figureChoice('clinicalCapabilities')] },
  scheduling: { label: 'Scheduling / resources', scope: 'A', kind: 'coreFunction', coreFunction: 'Scheduling / resource planning', terms: [figureChoice('clinicalCapabilities')] },
  wardManagement: { label: 'Ward management', scope: 'A', kind: 'coreFunction', coreFunction: 'Ward management', terms: [figureChoice('clinicalCapabilities')] },
  decisionSupport: { label: 'Clinical decision support', scope: 'A', kind: 'coreFunction', coreFunction: 'Clinical decision support', terms: [figureChoice('clinicalCapabilities')] },
  automaticReuse: { label: 'Automatic reuse / pre-population within the CIS', scope: 'A', coreDocumentation: true, terms: [figureChoice('documentationMethods', 'Automatic reuse/pre-population of information entered elsewhere in the CIS')] },
  specialtyWorkflows: { label: 'Specialty-specific workflows', scope: 'A', coreDocumentation: true, terms: [figureChoice('documentationMethods', 'Specialty-specific documentation templates/workflows')] },
  speechToText: { label: 'Speech-to-text', scope: 'A', coreDocumentation: true, terms: [figureChoice('documentationMethods', 'Speech-to-text')] },
  ambientAi: { label: 'Ambient AI documentation', scope: 'A', coreDocumentation: true, terms: [figureChoice('documentationMethods', 'Ambient AI documentation')] },
  automatedLetters: { label: 'Automated letters / reports', scope: 'A', coreDocumentation: true, terms: [figureChoice('documentationMethods', 'Automatic generation of letters/reports')] },
  shortcuts: { label: 'Shortcuts / macros', scope: 'A', coreDocumentation: true, terms: [figureChoice('documentationMethods', 'Configurable shortcuts/macros/favourites')] },
  coreVendors: { label: 'Core CIS', scope: 'A', kind: 'scopeCount', terms: [] },
  specialistVendors: { label: 'Specialized clinical', scope: 'B', kind: 'scopeCount', terms: [] },
  patientVendors: { label: 'Patient-facing', scope: 'D', kind: 'scopeCount', terms: [] },
  integrationEngine: { label: 'Integration engine', scope: 'C', kind: 'count', terms: [figureChoice('dataCapabilities', 'Integration engine')] },
  apiManagement: { label: 'API management', scope: 'C', kind: 'count', terms: [figureChoice('dataCapabilities', 'API management / gateway')] },
  orchestration: { label: 'Workflow / orchestration', scope: 'C', kind: 'count', terms: [figureChoice('dataCapabilities', 'Workflow / orchestration')] },
  clinicalRepository: { label: 'Clinical data repository', scope: 'C', kind: 'count', terms: [figureChoice('dataCapabilities', 'Clinical data repository / longitudinal health record')] },
  fhirServer: { label: 'FHIR server', scope: 'C', kind: 'count', terms: [figureChoice('dataCapabilities', 'FHIR server')] },
  mpi: { label: 'MPI / identity', scope: 'C', kind: 'count', terms: [figureChoice('dataCapabilities', 'Master patient index / identity management')] },
  terminologyService: { label: 'Terminology service', scope: 'C', kind: 'count', terms: [figureChoice('dataCapabilities', 'Terminology service')] },
  analyticsWarehouse: { label: 'Analytics / warehouse', scope: 'C', kind: 'count', terms: [figureChoice('dataCapabilities', 'Data warehouse / analytics platform')] },
  vendorNeutralArchive: { label: 'Vendor-neutral archive', scope: 'C', kind: 'count', terms: [figureChoice('dataCapabilities', 'Vendor-neutral archive')] },
  researchSecondary: { label: 'Research / secondary use', scope: 'C', kind: 'count', terms: [figureChoice('research', 'Research APIs/data extraction', 'De-identification/pseudonymisation tools'), figureChoice('secondary', 'Patient consent management', 'Purpose/data-use restrictions', 'Role/project-based data access', 'Audit trail of secondary data use')] },
  iso27001: { label: 'ISO/IEC 27001', terms: [figureChoice('certifications', 'ISO/IEC 27001')] },
  medicalConformity: { label: 'Medical device conformity where applicable', excludeNotApplicable: true, terms: [figureChoice('certifications', 'Medical device conformity under Swiss MedDO / EU MDR, where applicable')] },
  eprConformity: { label: 'EPR/EPD-related conformity where applicable', excludeNotApplicable: true, terms: [figureChoice('certifications', 'EPR/EPD-related certification or conformity assessment, where applicable')] },
  testing: { label: 'Relevant interoperability testing reported', terms: [figureChoice('interoperabilityTesting', 'Yes – please specify')] },
  anyCertification: { label: 'Any relevant certification / attestation', terms: [figureChoice('certifications', 'ISO/IEC 27001', 'ISO 9001', 'ISO 13485', 'Medical device conformity under Swiss MedDO / EU MDR, where applicable', 'EPR/EPD-related certification or conformity assessment, where applicable', 'Other healthcare-specific certification/conformity assessment', 'Other information-security certification/attestation')] },
};
const presentationSections = [
  { slide: 3, title: 'Interoperability and openness', keys: ['documentedApis', 'fhirStandard', 'independentDevelopment', 'sandbox', 'apiWriteBack', 'smart'] },
  { slide: 4, title: 'Deployment and Swiss data residency', keys: ['cloud', 'swissResidency', 'onPremise', 'privateCloud', 'publicCloud', 'saas', 'hybrid'], note: 'Swiss residency is asked only when a solution retains patient information. Conditional Yes answers count as capable under the stated hosting model.' },
  { slide: 5, title: 'Data portability and vendor independence', keys: ['exitProcess', 'recordExport', 'reusableContent', 'vendorMigration'], note: 'Record export is asked when Q6 reports persistent clinical-data storage without limiting it to specific data or documents. Migration dependence includes either a vendor-specific record export or a CIS migration approach requiring substantial custom conversion.' },
  { slide: 6, title: 'Structured and reusable clinical data', keys: ['fhirModel', 'snomed', 'loinc', 'openEhr', 'omop', 'researchApi', 'deidentification', 'secondaryGovernance'], note: 'These questions are available to the relevant solution categories. Explicit None or Not applicable answers remain separate from missing answers.' },
  { slide: 7, title: 'HCP-facing solutions', keys: ['clinicalDocumentation', 'medicationManagement', 'nursingWorkflows', 'scheduling', 'wardManagement', 'decisionSupport', 'automaticReuse', 'specialtyWorkflows', 'speechToText', 'ambientAi', 'automatedLetters', 'shortcuts'], note: 'Functional coverage counts core CIS offerings. Documentation methods are reported at submission level; for vendors selecting both A and B, the answer may also describe specialized functions.' },
  { slide: 8, title: 'Existing ecosystem building blocks', keys: ['coreVendors', 'specialistVendors', 'patientVendors', 'integrationEngine', 'apiManagement', 'orchestration', 'clinicalRepository', 'fhirServer', 'mpi', 'terminologyService', 'analyticsWarehouse', 'vendorNeutralArchive', 'researchSecondary'], note: 'These are distinct vendor counts. A vendor may appear in several building blocks. Data capabilities come from category C; research/secondary use is shown when Q6 reports persistent clinical data storage. Unanswered capability questions are not treated as a negative response.' },
  { slide: 9, title: 'Security, certification and Swiss readiness', keys: ['iso27001', 'medicalConformity', 'eprConformity', 'testing'], note: 'Medical device and EPR/EPD rows exclude vendors who selected Not applicable. Certificate scope and validity remain in the detailed answers.' },
  { slide: 10, title: 'Overall findings', keys: ['fhirStandard', 'documentedApis', 'independentDevelopment', 'sandbox', 'cloud', 'swissResidency', 'recordExport', 'exitProcess', 'clinicalDocumentation', 'automaticReuse', 'anyCertification', 'testing'] },
];
const questionById = new Map(data.questions.map(question => [question.id, question]));
function vendorGroups(rows) {
  const groups = new Map();
  for (const response of rows) {
    const key = normalizeOther(response.provider) || 'response:' + response.id;
    if (!groups.has(key)) groups.set(key, { key, name: response.provider || 'Unnamed provider', rows: [] });
    groups.get(key).rows.push(response);
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
}
function choiceSelected(response, term) {
  const question = questionById.get(term.id);
  if (!question) return false;
  return term.labels.some(label => {
    const index = (question.options || []).indexOf(label);
    return index >= 0 && answerSelection(response, term.id).includes(String(index));
  });
}
function coreFunctionSelected(response, functionName) {
  const offerings = response.answer_data?.clinicalCapabilities?.offerings || [];
  return offerings.some(offering => offering.kind === 'core' &&
    [...(offering.functions || []), ...(offering.other_functions || [])]
      .some(value => normalizeOther(String(value)) === normalizeOther(functionName)));
}
function figureMatches(spec, response) {
  if (spec.kind === 'coreFunction') return coreFunctionSelected(response, spec.coreFunction);
  return spec.terms.some(term => choiceSelected(response, term));
}
function figureResult(spec, groups) {
  const matched = [];
  const answered = [];
  const missing = [];
  const routingUnknown = [];
  for (const vendor of groups) {
    let candidates = vendor.rows.filter(response =>
      (!spec.scope || response.scopes.includes(spec.scope)) &&
      (!spec.coreDocumentation || coreFunctionSelected(response, 'Clinical documentation'))
    );
    if (!candidates.length) continue;
    if (spec.kind === 'scopeCount') { matched.push(vendor.name); continue; }
    if (spec.kind === 'count') {
      const statuses = candidates.flatMap(response => spec.terms.map(term => answerStatus(questionById.get(term.id), response)));
      if (statuses.includes('answered')) answered.push(vendor.name);
      else if (statuses.some(status => ['unanswered', 'notRecorded'].includes(status))) missing.push(vendor.name);
      else if (statuses.includes('screenUnanswered')) routingUnknown.push(vendor.name);
      if (candidates.some(response => figureMatches(spec, response))) matched.push(vendor.name);
      continue;
    }
    if (spec.excludeNotApplicable)
      candidates = candidates.filter(response => !choiceSelected(response, figureChoice('certifications', 'Not applicable')));
    if (!candidates.length) continue;
    const statuses = candidates.flatMap(response => spec.terms.map(term => answerStatus(questionById.get(term.id), response)));
    if (!statuses.some(status => ['answered', 'unanswered', 'notRecorded'].includes(status))) {
      if (statuses.includes('screenUnanswered')) routingUnknown.push(vendor.name);
      continue;
    }
    if (statuses.includes('answered')) {
      answered.push(vendor.name);
      if (candidates.some(response => figureMatches(spec, response))) matched.push(vendor.name);
    } else missing.push(vendor.name);
  }
  return { matched, answered, missing, routingUnknown, eligible: answered.length + missing.length };
}
function showQuestion(questionId) {
  setActiveTab('charts');
  const card = document.getElementById('analysis-question-' + questionId);
  if (!card) return;
  const section = card.closest('details');
  if (section) section.open = true;
  card.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function figureRow(key, groups) {
  const spec = figureSpecs[key];
  const result = figureResult(spec, groups);
  const row = node('tr');
  row.append(node('td', spec.label));
  const value = node('td', undefined, 'figure-value');
  if (spec.kind === 'count' || spec.kind === 'scopeCount') {
    value.append(node('span', (spec.kind === 'count' ? result.answered.length : groups.length) ? result.matched.length + ' vendors' : '—'));
  } else if (result.answered.length) {
    value.append(node('span', result.matched.length + ' / ' + result.eligible));
    value.append(node('small', Math.round(result.matched.length / result.eligible * 100) + '% of eligible vendors reporting this'));
  } else value.append(node('span', '—'));
  row.append(value);
  const coverage = node('td', undefined, 'figure-coverage');
  if (spec.kind === 'count' || spec.kind === 'scopeCount') {
    coverage.append(node('span', spec.kind === 'scopeCount' ? 'Distinct providers' : result.answered.length + ' answered · ' + result.missing.length + ' missing' + (result.routingUnknown.length ? ' · ' + result.routingUnknown.length + ' routing unknown' : '')));
  } else {
    coverage.append(node('span', result.answered.length + ' answered · ' + result.missing.length + ' missing of ' + result.eligible + ' eligible' + (result.routingUnknown.length ? ' · ' + result.routingUnknown.length + ' routing unknown' : '')));
  }
  const vendorDetails = node('details', undefined, 'figure-vendors');
  vendorDetails.append(node('summary', 'Show vendors'));
  vendorDetails.append(node('p', 'Counted: ' + (result.matched.join(', ') || 'None')));
  if (spec.kind !== 'scopeCount')
    vendorDetails.append(node('p', 'Answer missing: ' + (result.missing.join(', ') || 'None')));
  if (result.routingUnknown.length)
    vendorDetails.append(node('p', 'Screening answer missing: ' + result.routingUnknown.join(', ')));
  coverage.append(vendorDetails);
  row.append(coverage);
  const source = node('td', undefined, 'figure-source');
  if (spec.terms.length) {
    for (const term of spec.terms) {
      const question = questionById.get(term.id);
      if (!question) continue;
      const button = node('button', 'Q' + question.number);
      button.type = 'button';
      button.setAttribute('aria-label', 'Open question ' + question.number + ': ' + question.label);
      button.addEventListener('click', () => showQuestion(term.id));
      source.append(button, node('span', ' '));
    }
  } else source.append(node('span', 'Solution category'));
  row.append(source);
  return row;
}
function figureTable(rows) {
  const table = node('table', undefined, 'figure-table');
  const head = node('thead');
  const headings = node('tr');
  for (const label of ['Measure', 'Figure', 'Response coverage', 'Source']) headings.append(node('th', label));
  head.append(headings); table.append(head);
  const body = node('tbody');
  rows.forEach(row => body.append(row));
  table.append(body);
  return table;
}
function matchedVendorGroups(vendor, groups) {
  const names = new Set([vendor.provider, vendor.match_name].filter(Boolean).map(normalizeOther));
  return groups.filter(group => names.has(group.key));
}
async function saveVendor(payload) {
  const response = await fetch(vendorUrl, {
    method: 'POST', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => ({ error: 'Could not save vendor. Refresh the page and try again.' }));
  if (!response.ok) throw new Error(result.error || 'Could not save vendor.');
  if (payload.action === 'delete') {
    data.invitations = data.invitations.filter(item => item.id !== result.deleted_id);
    return result;
  }
  const index = data.invitations.findIndex(item => item.id === result.vendor.id);
  if (index < 0) data.invitations.push(result.vendor);
  else data.invitations[index] = result.vendor;
  return result.vendor;
}
function renderOutreach() {
  outreach.replaceChildren();
  const card = node('article', undefined, 'card');
  card.append(node('h2', 'Vendor outreach'));
  card.append(node('p', 'Tick each step as it happens. Current-version questionnaire responses are linked by organization name; refresh this page to see new submissions. If a vendor used a different name, enter it in Edit details.', 'muted'));
  const groups = vendorGroups(data.submissions.filter(row => row.version === data.current_version));
  const categories = [{ value: '', label: 'Uncategorized' }, ...data.vendor_categories];
  const categoryLabels = new Map(categories.map(item => [item.value, item.label]));
  const categoryRank = new Map(categories.map((item, index) => [item.value, index]));
  const vendors = [...data.invitations].sort((a, b) =>
    (categoryRank.get(a.category) ?? 0) - (categoryRank.get(b.category) ?? 0) || a.provider.localeCompare(b.provider));
  const linked = new Set(vendors.flatMap(item => matchedVendorGroups(item, groups).map(group => group.key)));
  const unmatched = groups.filter(group => !linked.has(group.key));
  const summary = node('div', undefined, 'summary-grid');
  addSummaryMetric(summary, vendors.length, 'vendors listed', 'Add prospects below');
  addSummaryMetric(summary, vendors.filter(item => item.invitation_sent).length, 'invitations sent', 'Manually ticked');
  addSummaryMetric(summary, vendors.filter(item => matchedVendorGroups(item, groups).length || item.declined).length, 'heard back', 'Answered or declined');
  card.append(summary);
  const error = node('p', '', 'vendor-save-error'); error.setAttribute('role', 'alert');
  card.append(error);
  const filters = node('div', undefined, 'outreach-filters');
  const searchLabel = node('label', 'Find vendor'); const search = node('input'); search.type = 'search'; search.placeholder = 'Search names or notes'; search.value = outreachSearch; searchLabel.append(search);
  const filterLabel = node('label', 'Show'); const filter = node('select');
  for (const [value, label] of [['all', 'All vendors'], ['not_invited', 'Invitation not sent'], ['waiting', 'Awaiting response'], ['reminded', 'Reminder sent'], ['declined', 'Declined'], ['answered', 'Answered questionnaire']]) {
    const option = node('option', label); option.value = value; filter.append(option);
  }
  filter.value = outreachFilter; filterLabel.append(filter);
  const categoryFilterLabel = node('label', 'Category'); const categoryFilter = node('select');
  const allCategory = node('option', 'All categories'); allCategory.value = 'all'; categoryFilter.append(allCategory);
  for (const item of categories) { const option = node('option', item.label); option.value = item.value; categoryFilter.append(option); }
  categoryFilter.value = outreachCategory; categoryFilterLabel.append(categoryFilter);
  filters.append(searchLabel, filterLabel, categoryFilterLabel); card.append(filters);
  const scroll = node('div', undefined, 'matrix-scroll');
  const table = node('table', undefined, 'outreach-table');
  const head = node('thead'); const heading = node('tr');
  ['Vendor', 'Invitation sent', 'Reminder sent', 'Declined', 'Questionnaire', 'Heard back', 'Details'].forEach(label => heading.append(node('th', label)));
  head.append(heading); table.append(head);
  const body = node('tbody');
  const visibleRows = [];
  const groupHeaders = new Map();
  let lastCategory = null;
  for (const vendor of vendors) {
    if (vendor.category !== lastCategory) {
      lastCategory = vendor.category;
      const groupRow = node('tr', undefined, 'outreach-group');
      const title = node('th', categoryLabels.get(vendor.category) || 'Uncategorized'); title.colSpan = 7;
      groupRow.append(title); body.append(groupRow); groupHeaders.set(vendor.category, groupRow);
    }
    const matches = matchedVendorGroups(vendor, groups);
    const answered = matches.length > 0;
    const row = node('tr');
    visibleRows.push({ row, vendor, answered });
    row.append(node('td', vendor.provider, 'outreach-vendor-name'));
    for (const field of ['invitation_sent', 'reminder_sent', 'declined']) {
      const cell = node('td');
      const checkbox = node('input'); checkbox.type = 'checkbox'; checkbox.checked = Boolean(vendor[field]);
      checkbox.setAttribute('aria-label', `${vendor.provider}: ${field.replaceAll('_', ' ')}`);
      checkbox.addEventListener('change', async () => {
        checkbox.disabled = true; error.textContent = '';
        try {
          await saveVendor({ action: 'update', id: vendor.id, [field]: checkbox.checked });
          renderOutreach(); renderPresentation(data.responses);
        } catch (failure) {
          checkbox.checked = !checkbox.checked;
          error.textContent = failure.message;
          checkbox.disabled = false;
        }
      });
      cell.append(checkbox); row.append(cell);
    }
    const responseCell = node('td');
    responseCell.append(node('strong', answered ? `${matches.reduce((count, group) => count + group.rows.length, 0)} response(s)` : '—'));
    if (answered) for (const item of matches.flatMap(group => group.rows)) {
      const link = node('a', `${item.solution || 'Unnamed solution'} · ${new Date(item.submitted).toLocaleDateString()}`);
      link.href = `/admin/core/questionnaireresponse/${item.id}/change/`;
      const line = node('small'); line.append(link); responseCell.append(line);
    }
    row.append(responseCell);
    row.append(node('td', answered || vendor.declined ? '✓ Yes' : '—'));
    const detailsCell = node('td'); const details = node('details');
    details.append(node('summary', 'Edit details'));
    const form = node('form', undefined, 'outreach-details');
    const nameLabel = node('label', 'Vendor name'); const nameInput = node('input'); nameInput.value = vendor.provider; nameInput.maxLength = 200; nameInput.required = true; nameLabel.append(nameInput);
    const matchLabel = node('label', 'Name used in questionnaire'); const matchInput = node('input'); matchInput.value = vendor.match_name || ''; matchInput.maxLength = 200; matchInput.placeholder = 'Only if different'; matchLabel.append(matchInput);
    const categoryLabel = node('label', 'Category'); const categoryInput = node('select');
    for (const item of categories) { const option = node('option', item.label); option.value = item.value; categoryInput.append(option); }
    categoryInput.value = vendor.category || ''; categoryLabel.append(categoryInput);
    const notesLabel = node('label', 'Notes'); const notesInput = node('textarea'); notesInput.value = vendor.notes || ''; notesInput.maxLength = 3000; notesLabel.append(notesInput);
    const save = node('button', 'Save details'); save.type = 'submit';
    const remove = node('button', 'Delete vendor', 'vendor-delete-button'); remove.type = 'button';
    remove.addEventListener('click', async () => {
      if (!window.confirm(`Delete ${vendor.provider} from the outreach list? Questionnaire submissions will remain saved.`)) return;
      remove.disabled = true; error.textContent = '';
      try {
        await saveVendor({ action: 'delete', id: vendor.id });
        renderOutreach(); renderPresentation(data.responses);
      } catch (failure) { error.textContent = failure.message; remove.disabled = false; }
    });
    const actions = node('div', undefined, 'outreach-detail-actions'); actions.append(save, remove);
    form.append(nameLabel, categoryLabel, matchLabel, notesLabel, actions);
    form.addEventListener('submit', async event => {
      event.preventDefault(); save.disabled = true; error.textContent = '';
      try {
        await saveVendor({ action: 'update', id: vendor.id, provider: nameInput.value, category: categoryInput.value, match_name: matchInput.value, notes: notesInput.value });
        renderOutreach(); renderPresentation(data.responses);
      } catch (failure) { error.textContent = failure.message; save.disabled = false; }
    });
    details.append(form); detailsCell.append(details); row.append(detailsCell);
    body.append(row);
  }
  table.append(body); scroll.append(table); card.append(scroll);
  const applyFilters = () => {
    outreachSearch = search.value.trim().toLowerCase(); outreachFilter = filter.value; outreachCategory = categoryFilter.value;
    let count = 0;
    for (const { row, vendor, answered } of visibleRows) {
      const searchMatch = `${vendor.provider} ${vendor.match_name || ''} ${vendor.notes || ''}`.toLowerCase().includes(outreachSearch);
      const statusMatch = outreachFilter === 'all' ||
        (outreachFilter === 'not_invited' && !vendor.invitation_sent) ||
        (outreachFilter === 'waiting' && vendor.invitation_sent && !vendor.declined && !answered) ||
        (outreachFilter === 'reminded' && vendor.reminder_sent) ||
        (outreachFilter === 'declined' && vendor.declined) ||
        (outreachFilter === 'answered' && answered);
      row.hidden = !(searchMatch && statusMatch && (outreachCategory === 'all' || vendor.category === outreachCategory));
      if (!row.hidden) count++;
    }
    for (const [category, groupRow] of groupHeaders) groupRow.hidden = !visibleRows.some(item => item.vendor.category === category && !item.row.hidden);
    filterCount.textContent = `${count} of ${vendors.length} vendors shown`;
  };
  const filterCount = node('p', '', 'muted'); card.append(filterCount);
  search.addEventListener('input', applyFilters); filter.addEventListener('change', applyFilters); categoryFilter.addEventListener('change', applyFilters); applyFilters();
  if (!vendors.length) card.append(node('p', 'No vendors have been added yet.', 'empty'));
  const addForm = node('form', undefined, 'outreach-add');
  addForm.append(node('h3', 'Add vendor'));
  const addNameLabel = node('label', 'Vendor name'); const addName = node('input'); addName.required = true; addName.maxLength = 200; addName.placeholder = 'Organization name'; addNameLabel.append(addName);
  const addCategoryLabel = node('label', 'Category'); const addCategory = node('select');
  for (const item of categories) { const option = node('option', item.label); option.value = item.value; addCategory.append(option); }
  addCategory.value = outreachCategory === 'all' ? '' : outreachCategory; addCategoryLabel.append(addCategory);
  const addMatchLabel = node('label', 'Name used in questionnaire (if different)'); const addMatch = node('input'); addMatch.maxLength = 200; addMatchLabel.append(addMatch);
  const addButton = node('button', 'Add vendor'); addButton.type = 'submit';
  addForm.append(addNameLabel, addCategoryLabel, addMatchLabel, addButton);
  addForm.addEventListener('submit', async event => {
    event.preventDefault(); addButton.disabled = true; error.textContent = '';
    try {
      await saveVendor({ action: 'create', provider: addName.value, category: addCategory.value, match_name: addMatch.value });
      renderOutreach(); renderPresentation(data.responses);
    } catch (failure) { error.textContent = failure.message; addButton.disabled = false; }
  });
  card.append(addForm);
  if (unmatched.length) {
    const notice = node('div', undefined, 'outreach-unmatched');
    notice.append(node('h3', `${unmatched.length} questionnaire vendor(s) need linking`));
    notice.append(node('p', unmatched.map(group => `${group.name} (${group.rows.length})`).join(', ') + '. Add each vendor above or enter its submitted organization name in an existing row’s details.', 'muted'));
    card.append(notice);
  }
  outreach.append(card);
}
function participationSection(groups) {
  const section = node('section', undefined, 'presentation-section');
  section.append(node('h2', 'Slide 2 · Vendor participation'));
  const invitations = data.invitations || [];
  const invited = invitations.filter(item => item.invitation_sent);
  const hasRoster = invited.length > 0;
  const participated = [];
  const declined = [];
  const noResponse = [];
  for (const invitation of invited) {
    if (matchedVendorGroups(invitation, groups).length) participated.push(invitation.provider);
    else (invitation.declined ? declined : noResponse).push(invitation.provider);
  }
  const unlisted = groups.filter(group => !invitations.some(item => matchedVendorGroups(item, [group]).length)).map(group => group.name);
  const rows = [
    ['Participated', hasRoster ? participated.length + ' / ' + invited.length : groups.length + ' / —', hasRoster ? participated : groups.map(group => group.name)],
    ['Declined participation', hasRoster ? String(declined.length) : '—', declined],
    ['No response received', hasRoster ? String(noResponse.length) : '—', noResponse],
  ];
  const tableRows = rows.map(([label, value, names]) => {
    const row = node('tr');
    row.append(node('td', label), node('td', value, 'figure-value'));
    const details = node('td', undefined, 'figure-coverage');
    details.append(node('span', names.length ? names.join(', ') : hasRoster ? 'None' : 'Invitation list not entered'));
    row.append(details);
    row.append(node('td', 'Vendor outreach tracker', 'figure-source'));
    return row;
  });
  section.append(figureTable(tableRows));
  const note = node('p', undefined, 'muted');
  const link = node('a', 'Manage vendor outreach');
  link.href = '#outreach';
  link.addEventListener('click', event => { event.preventDefault(); setActiveTab('outreach'); });
  note.append(link);
  note.append(node('span', '. Participation counts vendors with Invitation sent ticked; questionnaire answers match the vendor name or linked questionnaire name.'));
  section.append(note);
  if (!hasRoster) section.append(node('p', 'Tick Invitation sent in the vendor outreach tracker to establish the invited total.', 'muted'));
  if (unlisted.length) section.append(node('p', unlisted.length + ' responding vendor(s) need to be linked in the tracker: ' + unlisted.join(', ') + '.', 'muted'));
  const withoutSentFlag = invitations.filter(item => !item.invitation_sent && matchedVendorGroups(item, groups).length).map(item => item.provider);
  if (withoutSentFlag.length) section.append(node('p', 'These vendors answered but are not marked as invited: ' + withoutSentFlag.join(', ') + '. Check their invitation status in the tracker.', 'muted'));
  return section;
}
function renderPresentation(rows) {
  presentation.replaceChildren();
  const groups = vendorGroups(rows);
  const intro = node('div', undefined, 'presentation-intro');
  intro.append(node('h2', 'Figures for the vendor assessment presentation'));
  intro.append(node('p', 'Slide numbers match the assessment deck. A vendor is counted once per measure, even if it submitted several solutions. Percentages show the share of eligible vendors reporting a capability. Missing answers remain visible and are not interpreted as No.'));
  intro.append(node('p', 'These figures always use all current-version submissions. Filters in the detailed analysis tabs do not change them.'));
  if (!groups.length) intro.append(node('p', 'No current-version submissions are available yet. Figures will appear as vendors respond.'));
  presentation.append(intro, participationSection(groups));
  for (const definition of presentationSections) {
    const section = node('section', undefined, 'presentation-section');
    section.append(node('h2', 'Slide ' + definition.slide + ' · ' + definition.title));
    if (definition.note) section.append(node('p', definition.note, 'muted'));
    section.append(figureTable(definition.keys.map(key => figureRow(key, groups))));
    presentation.append(section);
  }
}
function renderSubmissions() {
  submissions.replaceChildren();
  const card = node('article', undefined, 'card');
  card.append(node('h2', 'Saved submissions'));
  card.append(node('p', 'Includes every questionnaire version. Select rows to delete them from the database.', 'muted'));
  const rows = [...data.submissions].sort((a, b) => b.id - a.id);
  if (!rows.length) {
    card.append(node('p', 'No submissions are saved.', 'empty'));
    submissions.append(card); return;
  }
  const controls = node('div', undefined, 'submission-controls');
  const selectAll = node('input'); selectAll.type = 'checkbox'; selectAll.setAttribute('aria-label', 'Select all submissions');
  const selectAllLabel = node('label', undefined, 'select-all'); selectAllLabel.append(selectAll, node('span', 'Select all'));
  const deleteButton = node('button', undefined, 'danger-button'); deleteButton.type = 'button';
  const updateControls = () => {
    const count = rows.filter(row => selectedSubmissionIds.has(row.id)).length;
    deleteButton.textContent = `Delete ${count} selected`;
    deleteButton.disabled = !count;
    selectAll.checked = count === rows.length;
    selectAll.indeterminate = count > 0 && count < rows.length;
  };
  selectAll.addEventListener('change', () => {
    for (const row of rows) selectAll.checked ? selectedSubmissionIds.add(row.id) : selectedSubmissionIds.delete(row.id);
    for (const checkbox of card.querySelectorAll('tbody input[type=checkbox]')) checkbox.checked = selectedSubmissionIds.has(Number(checkbox.value));
    updateControls();
  });
  deleteButton.addEventListener('click', () => {
    const chosen = rows.filter(row => selectedSubmissionIds.has(row.id));
    if (!chosen.length) return;
    document.getElementById('delete-summary').textContent = chosen.map(row => `${row.provider || 'Unnamed provider'} (#${row.id}, version ${row.version})`).join(', ');
    document.getElementById('delete-error').textContent = '';
    document.getElementById('delete-confirmation').showModal();
  });
  controls.append(selectAllLabel, deleteButton); card.append(controls);
  const scroll = node('div', undefined, 'matrix-scroll');
  const table = node('table', undefined, 'submission-table');
  const head = node('thead'); const header = node('tr');
  for (const label of ['Select', 'Provider', 'Solution', 'Scope', 'Form version', 'Submitted', 'Respondent']) header.append(node('th', label));
  head.append(header); table.append(head);
  const body = node('tbody');
  for (const response of rows) {
    const row = node('tr');
    const checkbox = node('input'); checkbox.type = 'checkbox'; checkbox.value = response.id; checkbox.checked = selectedSubmissionIds.has(response.id);
    checkbox.setAttribute('aria-label', `Select ${response.provider || 'unnamed provider'} response #${response.id}`);
    checkbox.addEventListener('change', () => { if (checkbox.checked) selectedSubmissionIds.add(response.id); else selectedSubmissionIds.delete(response.id); updateControls(); });
    const selectCell = node('td'); selectCell.append(checkbox);
    row.append(selectCell, node('td', `${response.provider || 'Unnamed provider'} · #${response.id}`), node('td', response.solution || '—'), node('td', response.scopes.join(', ') || '—'), node('td', String(response.version)), node('td', new Date(response.submitted).toLocaleString()), node('td', response.email));
    body.append(row);
  }
  table.append(body); scroll.append(table); card.append(scroll); submissions.append(card); updateControls();
}
function render() {
  const rows = filteredRows();
  const records = clinicalRecords(rows);
  const productGroups = groupingMap('clinicalProduct');
  const productNames = new Set(records.map(record => {
    const raw = `${record.developer} — ${record.name}`;
    return productGroups.get(normalizeOther(raw)) || raw;
  }));
  const summary = document.getElementById('summary');
  summary.replaceChildren();
  addSummaryMetric(summary, rows.length, mode.value === 'latest_provider' ? 'latest provider submissions' : 'submissions', 'Current filters');
  addSummaryMetric(summary, new Set(rows.map(row => normalizeOther(row.provider))).size, 'providers', 'Names grouped by case and spacing');
  addSummaryMetric(summary, records.length, 'reported offerings', `${productNames.size} grouped product names`);
  const url = new URL(exportUrl);
  if (provider.value) url.searchParams.set('provider', provider.value);
  if (scope.value) url.searchParams.set('scope', scope.value);
  if (mode.value === 'latest_provider') url.searchParams.set('mode', 'latest_provider');
  exportLink.href = url.href;
  products.replaceChildren(); charts.replaceChildren(); providers.replaceChildren();
  renderPresentation(data.responses);
  renderOutreach();
  renderSubmissions();
  updateSubmissionBadge();
  if (!rows.length) {
    const message = data.responses.length ? 'No responses match these filters.' : 'No submissions use the current questionnaire version yet. Earlier test submissions are available in the Submissions tab.';
    products.append(node('p', message, 'empty'));
    charts.append(node('p', message, 'empty'));
    providers.append(node('p', message, 'empty'));
    return;
  }
  renderProductComparison(rows);
  const sections = new Map();
  for (const q of data.questions) {
    if (q.legacy && !rows.some(r => r.answers[q.id] !== null)) continue;
    const key = q.legacy ? 'Earlier versions' : q.title.match(/^\d+\.\d+/)?.[0] || 'Other';
    if (!sections.has(key)) sections.set(key, []);
    sections.get(key).push(q);
  }
  let currentBlock = '';
  for (const [key, questions] of sections) {
    const block = key.startsWith('1.') ? 'core' : key.startsWith('2.') ? 'specific' : 'earlier';
    if (block !== currentBlock) {
      const divider = node('div', undefined, 'analysis-block-divider');
      divider.append(node('h2', block === 'core' ? 'Core questions · all vendors' : block === 'specific' ? 'Solution-specific questions' : 'Earlier questionnaire versions'));
      divider.append(node('p', block === 'specific' ? 'These questions were shown according to each provider’s solution scope and screening answers. Each question lists the providers who answered it.' : block === 'core' ? 'These questions are shared across solution scopes.' : 'Questions from older forms are shown separately.', 'muted'));
      charts.append(divider); currentBlock = block;
    }
    const section = node('details', undefined, 'section-group');
    section.open = openSections.has(key);
    section.addEventListener('toggle', () => section.open ? openSections.add(key) : openSections.delete(key));
    section.append(node('summary', `${key === 'Earlier versions' ? key : `${key} ${sectionNames[key] || ''}`} · ${questions.length} ${questions.length === 1 ? 'question' : 'questions'}`));
    for (const q of questions) section.append(questionChart(q, rows));
    charts.append(section);
  }
  for (const r of rows) {
    const card = node('details', undefined, 'card');
    card.append(node('summary', `${r.provider}${r.solution ? ' / ' + r.solution : ''} — response #${r.id}`));
    card.append(node('p', `${r.email} · ${new Date(r.submitted).toLocaleString()} · Scope: ${r.scopes.join(', ')} · Form version ${r.version}`, 'muted'));
    const list = node('dl');
    for (const q of data.questions) {
      if (q.legacy && r.answers[q.id] === null) continue;
      const missing = {
        notApplicable: 'Not applicable to this submission', screenUnanswered: 'Not shown: screening question unanswered',
        earlierForm: 'Not available in this form version', earlierRouting: 'Not recorded under earlier routing',
        retiredForm: 'Retired question', notRecorded: 'Not recorded',
      };
      list.append(node('dt', q.legacy ? `Earlier version. ${q.label}` : `Q${q.number}. ${q.label}`), node('dd', r.answers[q.id] === null ? missing[answerStatus(q, r)] || 'Not recorded' : r.answers[q.id] || 'Unanswered'));
    }
    card.append(list); providers.append(card);
  }
}
provider.addEventListener('change', render); scope.addEventListener('change', render); mode.addEventListener('change', render);
function setActiveTab(id) {
  activeTab = id;
  document.getElementById('detail-controls').hidden = id === 'presentation' || id === 'outreach';
  for (const name of ['presentation', 'outreach', 'products', 'charts', 'providers', 'submissions']) {
    document.getElementById(name).hidden = name !== activeTab;
    document.getElementById(`${name}-tab`).setAttribute('aria-pressed', String(name === activeTab));
  }
  if (id === 'submissions') markSubmissionsSeen();
}
for (const id of ['presentation', 'outreach', 'products', 'charts', 'providers', 'submissions'])
  document.getElementById(`${id}-tab`).addEventListener('click', () => setActiveTab(id));
document.getElementById('cancel-delete').addEventListener('click', () => document.getElementById('delete-confirmation').close());
document.getElementById('confirm-delete').addEventListener('click', async () => {
  const button = document.getElementById('confirm-delete');
  const ids = [...selectedSubmissionIds];
  if (!ids.length) return;
  button.disabled = true;
  document.getElementById('delete-error').textContent = '';
  try {
    const response = await fetch(deleteUrl, {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
      body: JSON.stringify({ ids }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const deleted = new Set((await response.json()).deleted_ids);
    data.submissions = data.submissions.filter(row => !deleted.has(row.id));
    data.responses = data.responses.filter(row => !deleted.has(row.id));
    deleted.forEach(id => selectedSubmissionIds.delete(id));
    if (!data.responses.some(row => row.provider === provider.value)) provider.value = '';
    document.getElementById('delete-confirmation').close();
    render();
  } catch {
    document.getElementById('delete-error').textContent = 'Deletion failed. No rows were removed from this view. Refresh and try again.';
  } finally { button.disabled = false; }
});
render();
