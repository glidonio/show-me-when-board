import { fetchIncidents, ack } from './api.js';

const list = document.querySelector('[data-testid="incident-list"]');
const loader = document.querySelector('[data-testid="loader"]');
const empty = document.querySelector('[data-testid="empty"]');

// Incidents seen so far, by id. Refreshes merge into this, so new rows add to the list.
const seen = new Map();
const acked = new Set();

// Viewer's own locale. EU regions get day-before-month (dd/mm).
function localTime(iso) {
  const lang = navigator.language || 'en-US';
  const region = new Intl.Locale(lang).maximize().region;
  const locale = EU_REGIONS.has(region) ? 'en-GB' : lang;
  return new Date(iso).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' });
}
const EU_REGIONS = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE',
  'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
]);

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function rowHtml(i) {
  const done = acked.has(i.id)
    ? '<span data-testid="acked" class="acked">acked</span>'
    : '<button data-testid="ack" type="button">Ack</button>';
  return `<li data-testid="incident-row" data-id="${esc(i.id)}" class="row ${esc(i.severity)}">
    <span class="id">${esc(i.id)}</span>
    <span class="sev">${esc(i.severity)}</span>
    <span class="what">${esc(i.service)} · ${esc(i.region)} · ${esc(i.summary)}</span>
    <time datetime="${esc(i.openedAt)}">${esc(localTime(i.openedAt))}</time>
    ${done}
  </li>`;
}

function render() {
  const rows = [...seen.values()].sort((a, b) => new Date(b.openedAt) - new Date(a.openedAt));
  list.innerHTML = rows.map(rowHtml).join('');
  empty.hidden = rows.length > 0;
}

list.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-testid="ack"]');
  if (!btn) return;
  const id = btn.closest('[data-testid="incident-row"]').dataset.id;
  btn.disabled = true;
  try {
    await ack(id);
    acked.add(id);
    render();
  } catch (err) {
    btn.disabled = false;
    console.error(err);
  }
});

async function load() {
  const page = await fetchIncidents();
  for (const i of page.incidents) seen.set(i.id, i);
  loader.remove();
  render();
}

// Refresh every 2 seconds while open. Waits for each run to finish before scheduling the next.
async function tick() {
  try {
    await load();
  } catch (err) {
    console.error(err);
  } finally {
    setTimeout(tick, 2000);
  }
}
tick();
