import { decideRequest, fetchRequests, getSession, signIn, signOut } from './supabase-client.js';
import {
  buildDecision,
  canDecide,
  confidenceLabel,
  conversationEntries,
  formatDate,
  formatDateTime,
  sortNewestFirst,
  statusInfo,
  typeLabel,
  verdictLabel,
} from './dashboard-view.js';

const loginView = document.getElementById('login-view');
const loginForm = document.getElementById('login-form');
const boardView = document.getElementById('board-view');
const sessionBar = document.getElementById('session-bar');
const listMessage = document.getElementById('list-message');
const tableBody = document.getElementById('requests-body');
const details = document.getElementById('details');
const decisionTemplate = document.getElementById('decision-template');

let requests = [];
let selectedId = null;

// Small DOM helper. Text always goes in through textContent, never as HTML,
// because conversation text comes from customers.
function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) {
    if (child) node.append(child);
  }
  return node;
}

// Sign in and out

function showLogin() {
  boardView.hidden = true;
  sessionBar.hidden = true;
  loginView.hidden = false;
  loginForm.elements.email.focus();
}

async function showBoard() {
  loginView.hidden = true;
  sessionBar.hidden = false;
  boardView.hidden = false;
  await loadRequests();
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const error = loginForm.querySelector('.form-error');
  const button = loginForm.querySelector('button');
  const email = loginForm.elements.email.value.trim();
  const password = loginForm.elements.password.value;
  if (!email || !password) {
    error.textContent = 'Enter your email and password.';
    return;
  }
  error.textContent = '';
  button.disabled = true;
  try {
    await signIn(email, password);
    loginForm.reset();
    await showBoard();
  } catch {
    error.textContent = 'The email or password is not correct.';
  } finally {
    button.disabled = false;
  }
});

document.getElementById('sign-out').addEventListener('click', async () => {
  await signOut();
  requests = [];
  selectedId = null;
  tableBody.replaceChildren();
  renderEmptyDetails();
  showLogin();
});

document.getElementById('refresh').addEventListener('click', loadRequests);

// The list

async function loadRequests() {
  listMessage.textContent = 'Loading…';
  try {
    requests = sortNewestFirst(await fetchRequests());
    listMessage.textContent = requests.length ? '' : 'No requests yet.';
  } catch (error) {
    if (!(await getSession())) {
      showLogin();
      return;
    }
    listMessage.textContent = `Could not load requests: ${error.message}`;
    requests = [];
  }
  renderTable();
  const selected = requests.find((request) => request.id === selectedId);
  if (selected) renderDetails(selected);
  else renderEmptyDetails();
}

function renderTable() {
  tableBody.replaceChildren(
    ...requests.map((request) => {
      const status = statusInfo(request);
      const open = el('button', {
        type: 'button',
        text: formatDate(request.created_at),
        'aria-label': `Open the request from ${request.customer_email}, ${formatDate(request.created_at)}`,
      });
      const row = el('tr', { 'data-id': request.id }, [
        el('td', {}, open),
        el('td', { class: 'customer-cell', text: request.customer_email }),
        el('td', { text: typeLabel(request) }),
        el('td', {}, el('span', { class: `status status-${status.tone}`, text: status.label })),
      ]);
      if (request.id === selectedId) row.setAttribute('aria-current', 'true');
      row.addEventListener('click', () => select(request.id));
      return row;
    }),
  );
}

function select(id) {
  selectedId = id;
  for (const row of tableBody.rows) {
    if (row.dataset.id === id) row.setAttribute('aria-current', 'true');
    else row.removeAttribute('aria-current');
  }
  renderDetails(requests.find((request) => request.id === id));
}

// The selected request

function renderEmptyDetails() {
  details.replaceChildren(
    el('h2', { id: 'details-title', text: 'Selected request' }),
    el('p', { class: 'panel-message', text: 'Choose a request from the list.' }),
  );
}

function facts(pairs) {
  return el('dl', { class: 'facts' }, pairs.flatMap(([term, value]) => [
    el('dt', { text: term }),
    el('dd', { text: value ?? '—' }),
  ]));
}

function block(title, children) {
  return el('div', { class: 'block' }, [el('h3', { text: title }), ...children]);
}

function fitCheckSection(request) {
  const extracted = request.extracted_fields && typeof request.extracted_fields === 'object'
    ? Object.entries(request.extracted_fields).map(([key, value]) => [key, String(value)])
    : [];
  return [
    block('Verdict', [facts([
      ['Answer', verdictLabel(request.verdict)],
      ['Decided by', request.verdict_field_key],
      ['Wants to order', request.wants_order ? 'Yes' : 'No'],
    ])]),
    extracted.length ? block('Details from the customer', [facts(extracted)]) : null,
  ];
}

function serviceSection(request) {
  const fault = request.fault;
  const diagnosis = fault
    ? facts([
      ['Fault', fault.symptom],
      ['Likely cause', fault.likely_cause],
      ['Confidence', confidenceLabel(request.fault_match_confidence)],
      ['Self-fixable', fault.self_fixable ? 'Yes' : 'No'],
    ])
    : facts([['Fault', 'Not identified'], ['Confidence', confidenceLabel(request.fault_match_confidence)]]);

  const recommendation = fault
    ? el('p', { text: fault.fix_instructions })
    : el('p', { text: 'The advisor could not match the problem to a known fault. Read the conversation before deciding.' });

  const sections = [block('Advisor diagnosis', [diagnosis]), block('Advisor recommendation', [recommendation])];

  if (request.status === 'approved' || request.status === 'rejected') {
    sections.push(block('Your decision', [facts([
      ['Status', statusInfo(request).label],
      ['Note', request.owner_decision_note],
      ['Updated', formatDateTime(request.updated_at)],
    ])]));
  }
  return sections;
}

function conversationSection(request) {
  const entries = conversationEntries(request.conversation_log);
  if (!entries.length) return block('Conversation', [el('p', { class: 'panel-message', text: 'No messages saved.' })]);
  return block('Conversation', [el('div', { class: 'conversation' }, entries.map((entry) => el(
    'div',
    { class: `message message-${entry.role}` },
    [
      el('span', { class: 'visually-hidden', text: entry.role === 'customer' ? 'Customer: ' : 'Advisor: ' }),
      document.createTextNode(entry.text),
      entry.at ? el('time', { datetime: entry.at, text: formatDateTime(entry.at) }) : null,
    ],
  )))]);
}

function decisionSection(request) {
  const form = decisionTemplate.content.firstElementChild.cloneNode(true);
  const error = form.querySelector('.form-error');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const action = event.submitter?.value;
    const result = buildDecision(action, form.elements.decision.value, form.elements.note.value);
    if (result.error) {
      error.textContent = result.error;
      return;
    }
    error.textContent = '';
    const buttons = form.querySelectorAll('button');
    buttons.forEach((button) => { button.disabled = true; });
    try {
      const updated = await decideRequest(request.id, result.update);
      requests = requests.map((item) => (item.id === updated.id ? updated : item));
      renderTable();
      renderDetails(updated);
    } catch (failure) {
      error.textContent = `Could not save the decision: ${failure.message}`;
      buttons.forEach((button) => { button.disabled = false; });
    }
  });
  return block('Decision', [form]);
}

function renderDetails(request) {
  if (!request) {
    renderEmptyDetails();
    return;
  }
  const status = statusInfo(request);
  const parts = [
    el('h2', { id: 'details-title', text: 'Selected request' }),
    facts([
      ['Customer', request.customer_email],
      ['Type', typeLabel(request)],
      ['Date', formatDateTime(request.created_at)],
      ['Status', status.label],
    ]),
    ...(request.request_type === 'service' ? serviceSection(request) : fitCheckSection(request)),
    canDecide(request) ? decisionSection(request) : null,
    conversationSection(request),
  ];
  details.replaceChildren(...parts.filter(Boolean));
}

// Start

if (await getSession()) await showBoard();
else showLogin();
