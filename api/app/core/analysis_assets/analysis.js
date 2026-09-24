'use strict';
const data = JSON.parse(document.getElementById('analysis-data').textContent);
data.questions.forEach((question, index) => { question.number = index + 1; });
const provider = document.getElementById('provider');
const scope = document.getElementById('scope');
const charts = document.getElementById('charts');
const providers = document.getElementById('providers');
const exportLink = document.getElementById('export');
const exportUrl = exportLink.href;
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
function questionChart(q, rows) {
  const card = node('article', undefined, 'card');
  card.append(node('h2', `Q${q.number}. ${q.label}`));
  const asked = rows.filter(r => r.answers[q.id] !== null);
  const answered = asked.filter(r => r.answers[q.id]?.trim());
  card.append(node('p', `${answered.length} answered · ${asked.length - answered.length} unanswered · ${rows.length - asked.length} not asked`, 'coverage'));
  if (q.kind === 'text') {
    card.append(node('p', 'Free-text response coverage. Read the full answers in Provider answers.', 'muted'));
    addChart(card, new Map([
      ['Answer provided', answered], ['Unanswered', asked.filter(r => !r.answers[q.id]?.trim())],
    ]), asked.length);
  } else if (q.kind === 'capabilities' || q.kind === 'costs') {
    const extra = new Map();
    const matched = new Set();
    for (const label of q.options || []) {
      card.append(node('h3', label));
      const groups = new Map(q.kind === 'capabilities' ? [['Yes', []], ['No', []], ['Not answered', []]] : []);
      for (const r of asked) {
        const line = (r.answers[q.id] || '').split('\n').find(l => l.startsWith(label + ': '));
        if (line) matched.add(`${r.id}:${line}`);
        const value = line ? line.slice(label.length + 2) : 'Not answered';
        const category = q.kind === 'capabilities' ? value.split(';')[0] : value;
        addGroup(groups, category, r);
      }
      addChart(card, groups, asked.length);
    }
    for (const r of answered) for (const line of r.answers[q.id].split('\n')) {
      if (line.trim() && !matched.has(`${r.id}:${line}`)) addGroup(extra, line, r);
    }
    if (extra.size) {
      card.append(node('h3', 'Other / historical answers'));
      addChart(card, extra, asked.length);
    }
  } else {
    const groups = new Map((q.options || []).map(label => [label, []]));
    const optionsByLength = [...(q.options || [])].sort((a, b) => b.length - a.length);
    for (const r of answered) {
      if (q.kind === 'single') {
        const text = r.answers[q.id].trim();
        const option = optionsByLength.find(label => text === label || text.startsWith(label + ': '));
        addGroup(groups, option || `Other / historical answer: ${text}`, r);
        continue;
      }
      // Follow-up descriptions can span lines. Only option boundaries count as votes.
      const lines = r.answers[q.id].split('\n');
      let hasMatch = false;
      for (const line of lines) {
        const option = optionsByLength.find(label => line === label || line.startsWith(label + ': '));
        if (option) { addGroup(groups, option, r); hasMatch = true; }
        else if (!hasMatch && line.trim()) addGroup(groups, `Other / historical answer: ${line}`, r);
        if (q.kind === 'single' && hasMatch) break;
      }
    }
    if (q.kind === 'single') addPie(card, groups);
    else addChart(card, groups, asked.length);
  }
  return card;
}
function render() {
  const rows = data.responses.filter(r => (!provider.value || r.provider === provider.value) && (!scope.value || r.scopes.includes(scope.value)));
  document.getElementById('summary').textContent = `${rows.length} submissions from ${new Set(rows.map(r => r.provider)).size} providers`;
  const url = new URL(exportUrl);
  if (provider.value) url.searchParams.set('provider', provider.value);
  if (scope.value) url.searchParams.set('scope', scope.value);
  exportLink.href = url.href;
  charts.replaceChildren(); providers.replaceChildren();
  if (!rows.length) {
    charts.append(node('p', 'No responses match these filters.', 'empty'));
    providers.append(node('p', 'No responses match these filters.', 'empty'));
    return;
  }
  for (const q of data.questions) charts.append(questionChart(q, rows));
  for (const r of rows) {
    const card = node('details', undefined, 'card');
    card.append(node('summary', `${r.provider}${r.solution ? ' / ' + r.solution : ''} — response #${r.id}`));
    card.append(node('p', `${r.email} · ${new Date(r.submitted).toLocaleString()} · Scope: ${r.scopes.join(', ')}`, 'muted'));
    const list = node('dl');
    for (const q of data.questions) {
      list.append(node('dt', `Q${q.number}. ${q.label}`), node('dd', r.answers[q.id] === null ? 'Not asked' : r.answers[q.id] || 'Unanswered'));
    }
    card.append(list); providers.append(card);
  }
}
provider.addEventListener('change', render); scope.addEventListener('change', render);
for (const id of ['charts', 'providers']) document.getElementById(`${id}-tab`).addEventListener('click', () => {
  charts.hidden = id !== 'charts'; providers.hidden = id !== 'providers';
  for (const name of ['charts', 'providers']) document.getElementById(`${name}-tab`).setAttribute('aria-pressed', String(name === id));
});
render();
