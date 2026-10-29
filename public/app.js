'use strict';

const HISTORY_KEY = 'insightsql.queryHistory.v1';
const MAX_HISTORY = 20;
const questionInput = document.querySelector('#question-input');
const askButton = document.querySelector('#ask-button');
const responseArea = document.querySelector('#response-area');
const welcomeState = document.querySelector('#welcome-state');
const loadingState = document.querySelector('#loading-state');
const errorCard = document.querySelector('#error-card');
const resultView = document.querySelector('#result-view');
const schemaPanel = document.querySelector('#schema-panel');
const historyList = document.querySelector('#history-list');
const toast = document.querySelector('#toast');
let historyItems = readHistory();
let latestSql = '';
let toastTimer;

function readHistory() {
  try {
    const saved = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    return Array.isArray(saved) ? saved.filter((item) => item && typeof item.question === 'string' && item.result).slice(0, MAX_HISTORY) : [];
  } catch {
    return [];
  }
}

function saveHistory() {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(historyItems.slice(0, MAX_HISTORY)));
  } catch {
    showToast('History could not be saved in this browser.');
  }
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 2200);
}

function makeIcon(name) {
  const paths = {
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/>',
    employee: '<circle cx="12" cy="8" r="3.3"/><path d="M5 20a7 7 0 0 1 14 0"/>',
    project: '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M8 9h8m-8 4h5"/>',
    department: '<path d="M4 20V8l8-4 8 4v12M8 20v-5h8v5M8 10h.01M12 10h.01M16 10h.01"/>',
    query: '<path d="M5 5h14M5 12h10M5 19h14"/>'
  };
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = paths[name] || paths.query;
  return svg;
}

function renderHistory() {
  historyList.replaceChildren();
  if (!historyItems.length) {
    const empty = document.createElement('p');
    empty.className = 'history-empty';
    empty.textContent = 'Your recent questions will appear here.';
    historyList.append(empty);
    return;
  }
  for (const item of historyItems) {
    const button = document.createElement('button');
    button.className = 'history-item';
    button.type = 'button';
    button.title = item.question;
    button.append(makeIcon('clock'));
    const label = document.createElement('span');
    label.textContent = item.question;
    button.append(label);
    button.addEventListener('click', () => {
      questionInput.value = item.question;
      displayResult(item.result);
      welcomeState.classList.add('hidden');
      errorCard.classList.add('hidden');
      resultView.classList.remove('hidden');
    });
    historyList.append(button);
  }
}

function resetResponse() {
  welcomeState.classList.add('hidden');
  errorCard.classList.add('hidden');
  resultView.classList.add('hidden');
  loadingState.classList.remove('hidden');
  responseArea.setAttribute('aria-busy', 'true');
}

function showError(message, title = 'Could not answer that') {
  loadingState.classList.add('hidden');
  resultView.classList.add('hidden');
  welcomeState.classList.add('hidden');
  document.querySelector('#error-title').textContent = title;
  document.querySelector('#error-message').textContent = message;
  errorCard.classList.remove('hidden');
  responseArea.setAttribute('aria-busy', 'false');
}

function formatCell(value, column) {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'number' && /salary|budget|average_salary/i.test(column)) {
    return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value);
  }
  if (typeof value === 'number' && /allocation_pct/i.test(column)) return `${value}%`;
  return String(value);
}

function renderRows(result) {
  const tableScroll = document.querySelector('#table-scroll');
  const emptyResult = document.querySelector('#empty-result');
  const caption = document.querySelector('#table-caption');
  const columns = Array.isArray(result.columns) ? result.columns : [];
  const rows = Array.isArray(result.rows) ? result.rows : [];
  caption.textContent = `${result.rowCount} ${result.rowCount === 1 ? 'row' : 'rows'} returned`;
  tableScroll.replaceChildren();
  emptyResult.classList.toggle('hidden', rows.length > 0);
  tableScroll.classList.toggle('hidden', rows.length === 0);

  if (!rows.length) return;
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  for (const column of columns) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = column.replaceAll('_', ' ');
    headerRow.append(th);
  }
  thead.append(headerRow);
  table.append(thead);
  const tbody = document.createElement('tbody');
  for (const row of rows) {
    const tr = document.createElement('tr');
    for (const column of columns) {
      const td = document.createElement('td');
      td.textContent = formatCell(row[column], column);
      if (row[column] === null) td.className = 'null-cell';
      tr.append(td);
    }
    tbody.append(tr);
  }
  table.append(tbody);
  tableScroll.append(table);
}

function displayResult(result) {
  latestSql = result.sql;
  loadingState.classList.add('hidden');
  errorCard.classList.add('hidden');
  welcomeState.classList.add('hidden');
  resultView.classList.remove('hidden');
  responseArea.setAttribute('aria-busy', 'false');
  document.querySelector('#result-title').textContent = result.rowCount === 1 ? 'Here’s what I found' : 'Here’s what I found';
  document.querySelector('#result-description').textContent = result.explanation || 'Your question has been answered from the connected database.';
  document.querySelector('#result-count').textContent = `${result.rowCount} ${result.rowCount === 1 ? 'row' : 'rows'}`;
  document.querySelector('#result-duration').textContent = `${Number(result.durationMs || 0).toFixed(1)} ms`;
  document.querySelector('#sql-output').textContent = result.sql;
  const parameterLine = document.querySelector('#parameter-line');
  const parameterOutput = document.querySelector('#parameter-output');
  if (result.parameters?.length) {
    parameterOutput.textContent = JSON.stringify(result.parameters);
    parameterLine.classList.remove('hidden');
  } else {
    parameterLine.classList.add('hidden');
  }
  document.querySelector('#result-footnote').classList.toggle('hidden', !result.truncated);
  renderRows(result);
}

async function submitQuestion(value = questionInput.value) {
  const question = value.trim();
  if (!question) {
    questionInput.focus();
    showError('Type a question first. You can choose an example below to get started.', 'Your question is empty');
    return;
  }
  resetResponse();
  askButton.disabled = true;
  try {
    const response = await fetch('/api/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ question })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error?.message || 'The query could not be completed.');
    const result = payload.data;
    displayResult(result);
    historyItems = [{ question: result.question, result }, ...historyItems.filter((item) => item.question !== result.question)].slice(0, MAX_HISTORY);
    saveHistory();
    renderHistory();
  } catch (error) {
    showError(error.message || 'Check that InsightSQL is running, then try again.', 'Could not run your question');
  } finally {
    askButton.disabled = false;
  }
}

askButton.addEventListener('click', () => submitQuestion());
questionInput.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault();
    submitQuestion();
  }
});

for (const chip of document.querySelectorAll('.suggestion-chip')) {
  chip.addEventListener('click', () => {
    questionInput.value = chip.dataset.question || '';
    submitQuestion();
  });
}

document.querySelector('#schema-toggle').addEventListener('click', (event) => {
  const isHidden = schemaPanel.classList.toggle('hidden');
  event.currentTarget.setAttribute('aria-expanded', String(!isHidden));
  if (!isHidden) schemaPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});

document.querySelector('#clear-history').addEventListener('click', () => {
  historyItems = [];
  saveHistory();
  renderHistory();
  showToast('Recent questions cleared from this browser.');
});

document.querySelector('#copy-sql').addEventListener('click', async () => {
  if (!latestSql) return;
  try {
    await navigator.clipboard.writeText(latestSql);
    showToast('SQL copied to clipboard.');
  } catch {
    showToast('Clipboard access is unavailable in this browser.');
  }
});

renderHistory();
