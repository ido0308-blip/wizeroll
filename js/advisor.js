import {
  buildChecks,
  decideVerdict,
  fallbackReply,
  fillLabel,
  isPlausible,
  matchAllowedValue,
  orderSpecs,
  parseSimpleAnswer,
  saysNoneOfThem,
  withNoDataNotice,
} from './fit-check.js';
import {
  buildServiceRequest,
  clarifyingQuestion,
  decideServiceStep,
  fixMessage,
  saysNotSolved,
  saysSolved,
} from './service-flow.js';
import { callAdvisor, takeDraft } from './shared.js';
import { fetchFaults, fetchProductSpecs, saveRequest } from './supabase-client.js';

const GREETING = 'Hi! I can check whether the stool fits your workstation. Tell me in your own words: how high is your desk, how tall are you, how much do you weigh, how many hours a day do you sit, what floor is under the stool, and how do you usually sit?';
const SERVICE_GREETING = 'Sorry to hear something is wrong with your stool. Tell me in your own words what happens.';
const SOLVED_QUESTION = 'Did that solve it?';
const SOLVED_REPEAT = 'Please tell me: did that solve it, yes or no?';
const NOT_IDENTIFIED = 'I couldn\'t match this to a fault I know, so I won\'t guess. I\'ll pass it to the business owner.';
const NOT_SOLVED = 'Sorry that didn\'t help. I\'ll pass it to the business owner.';
const ASK_SERVICE_EMAIL = 'Leave your email and I\'ll open a service request.';
const ASK_SOLVED_EMAIL = 'Glad it\'s solved! If you leave your email, I\'ll save this as solved. You can also skip.';
const SERVICE_PENDING = 'Your request was passed to the business owner and is waiting to be handled.';
const SERVICE_RESOLVED = 'Your request is saved as solved.';
const LOAD_ERROR = 'I can\'t reach the product data right now. Please reload the page in a moment.';
const ADVISOR_ERROR = 'Sorry, I couldn\'t process that. Your message is back in the box, please try sending it again.';
const INTENT_QUESTION = 'Is this before you buy, or after you bought the stool?';
const INTENT_REPEAT = 'I want to send you to the right place. Is this before you buy, or after you bought the stool?';

const QUESTIONS = {
  desk_height_cm: 'How high is your desk or work surface, in cm?',
  customer_height_cm: 'How tall are you, in cm?',
  customer_weight_kg: 'How much do you weigh, in kg?',
  daily_sitting_hours: 'How many hours a day do you usually sit?',
  floor_type: 'What type of floor will the stool roll on?',
  sitting_style: 'How do you usually sit while you work?',
};

const VERDICT_LABELS = {
  fit: 'Fits',
  fit_with_reservation: 'Fits with a reservation',
  not_fit: 'Does not fit',
};

const log = document.getElementById('log');
const form = document.getElementById('composer');
const input = document.getElementById('message');
const sendButton = form.querySelector('button');

const conversation = [];
const values = {};
const clarifiedFields = new Set();
const askedFields = new Set();
const rejectedValues = new Map();
let specs = [];
let faults = [];
let serviceClarified = false;
let serviceDecision = null;
let mode = 'loading';
let hasFirstMessage = false;
let pendingSpec = null;
let readUpTo = 0;

function scrollToEnd() {
  log.scrollTop = log.scrollHeight;
}

function addToConversation(role, text, kind) {
  conversation.push({ role, text, at: new Date().toISOString(), ...(kind ? { kind } : {}) });
}

function appendBubble(role, text) {
  const bubble = document.createElement('div');
  bubble.className = `bubble bubble-${role}`;
  bubble.textContent = text;
  log.append(bubble);
  scrollToEnd();
  return bubble;
}

function say(text) {
  addToConversation('advisor', text);
  appendBubble('advisor', text);
}

function showNote(text) {
  appendBubble('advisor', text);
}

function setBusy(busy) {
  input.disabled = busy;
  sendButton.disabled = busy;
  if (!busy) input.focus();
}

function showTyping() {
  const typing = appendBubble('advisor', 'Checking…');
  typing.classList.add('is-typing');
  return typing;
}

function closeComposer() {
  form.hidden = true;
}

// After a failed model call, the customer's last message goes back into the box.
function restoreLastMessage() {
  const lastEntry = conversation.at(-1);
  if (lastEntry?.role === 'customer') {
    conversation.pop();
    [...log.querySelectorAll('.bubble-customer')].at(-1)?.remove();
    input.value = lastEntry.text;
  }
  showNote(ADVISOR_ERROR);
  setBusy(false);
}

function appendChoices(options) {
  const choices = document.createElement('div');
  choices.className = 'choices';
  for (const [label, handler] of options) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'button button-secondary';
    button.textContent = label;
    button.addEventListener('click', () => {
      choices.remove();
      addToConversation('customer', label);
      appendBubble('customer', label);
      handler();
    });
    choices.append(button);
  }
  log.append(choices);
  scrollToEnd();
}

function askForIntent(text) {
  say(text);
  appendChoices([['Before I buy', chooseBeforePurchase], ['After I bought it', chooseAfterPurchase]]);
}

function chooseBeforePurchase() {
  mode = 'fit';
  if (hasFirstMessage) handleFitMessage();
  else say(GREETING);
}

function chooseAfterPurchase() {
  mode = 'service';
  if (hasFirstMessage) classifyFault();
  else say(SERVICE_GREETING);
}

function handleIntentAnswer(text) {
  document.querySelector('.choices')?.remove();
  if (/\b(before|not yet|haven'?t bought)\b/i.test(text)) return chooseBeforePurchase();
  if (/\b(after|bought|already)\b/i.test(text)) return chooseAfterPurchase();
  return askForIntent(INTENT_REPEAT);
}

// Only messages the advisor has not read yet, with the question they answer, so the model
// never re-reads an earlier answer and overwrites a value already settled.
function unreadConversationAsText() {
  return conversation
    .slice(readUpTo)
    .map((entry) => `${entry.role === 'customer' ? 'Customer' : 'Advisor'}: ${entry.text}`)
    .join('\n');
}

// An impossible number, such as a height of 1.7 cm, is asked again instead of judged.
function acceptValue(spec, value) {
  if (spec.value_type === 'numeric_range' && !isPlausible(spec.field_key, value)) {
    if (values[spec.field_key] === undefined) rejectedValues.set(spec.field_key, value);
    return;
  }
  values[spec.field_key] = spec.value_type === 'categorical'
    ? matchAllowedValue(spec, value) ?? value
    : value;
}

function mergeExtracted(extracted) {
  for (const spec of specs) {
    if (spec.field_key in extracted) acceptValue(spec, extracted[spec.field_key]);
  }
}

function categoryQuestion(spec) {
  return `I didn't find "${values[spec.field_key]}" in the product data. Which of these is closest: ${spec.allowed_values.join(', ')}? If none of them, just tell me that.`;
}

// Returns the next single question, or null when every field has a usable value.
function nextQuestion() {
  pendingSpec = null;
  for (const spec of specs) {
    const value = values[spec.field_key];
    if (value === undefined) {
      pendingSpec = spec;
      const question = QUESTIONS[spec.field_key] ?? `Please tell me about this: ${fillLabel(spec)}`;
      if (rejectedValues.has(spec.field_key)) {
        const rejected = rejectedValues.get(spec.field_key);
        rejectedValues.delete(spec.field_key);
        askedFields.add(spec.field_key);
        return `${rejected} doesn't look right for this, so I won't use it. ${question}`;
      }
      if (askedFields.has(spec.field_key)) {
        return `I can't check the fit without this, and I won't guess it. ${question}`;
      }
      askedFields.add(spec.field_key);
      return question;
    }
    const unclear = spec.value_type === 'categorical' && matchAllowedValue(spec, value) === null;
    if (unclear && !clarifiedFields.has(spec.field_key)) {
      clarifiedFields.add(spec.field_key);
      pendingSpec = spec;
      return categoryQuestion(spec);
    }
  }
  return null;
}

// Free tier quota is small, so a plain answer to the pending question skips the model.
function answerPendingQuestion(text) {
  if (!pendingSpec) return false;
  const key = pendingSpec.field_key;
  if (clarifiedFields.has(key) && saysNoneOfThem(text)) return true;

  const value = parseSimpleAnswer(pendingSpec, text);
  if (value === null) return false;
  acceptValue(pendingSpec, value);
  return true;
}

async function continueFitCheck() {
  readUpTo = conversation.length;
  const question = nextQuestion();
  if (question) {
    say(question);
    setBusy(false);
  } else {
    await giveVerdict();
  }
}

async function handleFitMessage() {
  setBusy(true);
  if (answerPendingQuestion(conversation.at(-1).text)) {
    await continueFitCheck();
    return;
  }

  const typing = showTyping();
  try {
    const { extracted } = await callAdvisor('extract', {
      text: unreadConversationAsText(),
      fields: specs.map((spec) => ({
        field_key: spec.field_key,
        label: spec.customer_label_template,
        value_type: spec.value_type,
      })),
    });
    typing.remove();
    mergeExtracted(extracted);
    await continueFitCheck();
  } catch {
    typing.remove();
    restoreLastMessage();
  }
}

async function phraseVerdict(decision, checks) {
  try {
    const { reply_text: replyText } = await callAdvisor('phrase', { ...decision, checks });
    return replyText;
  } catch {
    return fallbackReply(decision, checks);
  }
}

function appendVerdict(decision, replyText) {
  const spec = specs.find((candidate) => candidate.field_key === decision.verdict_field_key);
  const bubble = appendBubble('advisor', '');
  bubble.classList.add('bubble-verdict');

  const badge = document.createElement('strong');
  badge.className = 'verdict-badge';
  badge.textContent = VERDICT_LABELS[decision.verdict];

  const reply = document.createElement('p');
  reply.textContent = replyText;

  const field = document.createElement('p');
  field.className = 'verdict-field';
  field.textContent = `Decided by: ${fillLabel(spec)}`;

  bubble.append(badge, reply, field);
  scrollToEnd();
}

async function giveVerdict() {
  const typing = showTyping();
  const checks = buildChecks(specs, values);
  const decision = decideVerdict(checks);
  const replyText = withNoDataNotice(await phraseVerdict(decision, checks), decision, checks);
  typing.remove();

  addToConversation('advisor', replyText, 'verdict');
  appendVerdict(decision, replyText);
  mode = 'closed';
  closeComposer();
  say('Would you like this answer by email?');
  appendEmailForm(decision);
}

function appendEmailForm(decision) {
  const template = document.getElementById('email-form-template');
  const emailForm = template.content.firstElementChild.cloneNode(true);
  const error = emailForm.querySelector('.form-error');
  const submit = emailForm.querySelector('button');

  emailForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!emailForm.reportValidity()) return;
    error.textContent = '';
    submit.disabled = true;

    const data = new FormData(emailForm);
    try {
      await saveRequest({
        request_type: 'fit_check',
        customer_email: data.get('email').trim(),
        conversation_log: conversation,
        extracted_fields: values,
        verdict: decision.verdict,
        verdict_field_key: decision.verdict_field_key,
        wants_order: data.get('wants_order') === 'on',
        status: 'recorded',
      });
      emailForm.remove();
      showNote('Done. Your request is saved. If your address is on the test list, the answer is on its way to your inbox.');
    } catch {
      error.textContent = 'I couldn\'t save your request. Please try again.';
      submit.disabled = false;
    }
  });

  log.append(emailForm);
  scrollToEnd();
}

// Service path: the model only sees ids and symptoms. Fixes and self_fixable come from the table.
async function classifyFault() {
  setBusy(true);
  const typing = showTyping();
  try {
    const result = await callAdvisor('classify', {
      text: conversation
        .map((entry) => `${entry.role === 'customer' ? 'Customer' : 'Advisor'}: ${entry.text}`)
        .join('\n'),
      faults: faults.map(({ id, symptom }) => ({ id, symptom })),
    });
    typing.remove();
    handleClassification(result);
  } catch {
    typing.remove();
    restoreLastMessage();
  }
}

function handleClassification(result) {
  const decision = decideServiceStep(result, faults, { clarified: serviceClarified });
  serviceDecision = decision;

  if (decision.step === 'clarify') {
    serviceClarified = true;
    say(clarifyingQuestion(result));
    setBusy(false);
  } else if (decision.step === 'fix') {
    say(fixMessage(decision));
    askIfSolved();
  } else if (decision.step === 'escalate') {
    say(fixMessage(decision));
    openServiceRequest();
  } else {
    say(NOT_IDENTIFIED);
    openServiceRequest();
  }
}

function askIfSolved() {
  mode = 'solved_question';
  say(SOLVED_QUESTION);
  appendChoices([['Yes, it\'s solved', () => answerSolved(true)], ['No, it isn\'t', () => answerSolved(false)]]);
  setBusy(false);
}

function handleSolvedAnswer(text) {
  if (saysSolved(text)) return answerSolved(true);
  if (saysNotSolved(text)) return answerSolved(false);
  return say(SOLVED_REPEAT);
}

function answerSolved(solved) {
  document.querySelector('.choices')?.remove();
  mode = 'closed';
  closeComposer();
  if (solved) {
    say(ASK_SOLVED_EMAIL);
    appendServiceEmailForm({ solved: true });
  } else {
    say(NOT_SOLVED);
    openServiceRequest();
  }
}

function openServiceRequest() {
  mode = 'closed';
  closeComposer();
  say(ASK_SERVICE_EMAIL);
  appendServiceEmailForm({ solved: false });
}

function appendServiceEmailForm({ solved }) {
  const template = document.getElementById('service-email-form-template');
  const emailForm = template.content.firstElementChild.cloneNode(true);
  const error = emailForm.querySelector('.form-error');
  const submit = emailForm.querySelector('button[type="submit"]');
  const skip = emailForm.querySelector('.skip-button');
  const closingText = solved ? SERVICE_RESOLVED : SERVICE_PENDING;

  if (solved) {
    skip.hidden = false;
    skip.addEventListener('click', () => {
      emailForm.remove();
      showNote('No problem. Nothing was saved.');
    });
  }

  emailForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!emailForm.reportValidity()) return;
    error.textContent = '';
    submit.disabled = true;

    const closingEntry = { role: 'advisor', text: closingText, at: new Date().toISOString() };
    try {
      await saveRequest(buildServiceRequest({
        email: new FormData(emailForm).get('email').trim(),
        conversation: [...conversation, closingEntry],
        decision: serviceDecision,
        solved,
      }));
      emailForm.remove();
      conversation.push(closingEntry);
      appendBubble('advisor', closingText);
    } catch {
      error.textContent = 'I couldn\'t save your request. Please try again.';
      submit.disabled = false;
    }
  });

  log.append(emailForm);
  scrollToEnd();
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const text = input.value.trim();
  if (!text || mode === 'loading' || mode === 'closed') return;

  input.value = '';
  addToConversation('customer', text);
  appendBubble('customer', text);

  if (mode === 'intent') handleIntentAnswer(text);
  else if (mode === 'service') classifyFault();
  else if (mode === 'solved_question') handleSolvedAnswer(text);
  else handleFitMessage();
});

async function start() {
  const path = new URLSearchParams(window.location.search).get('path');

  setBusy(true);
  try {
    const [loadedSpecs, loadedFaults] = await Promise.all([fetchProductSpecs(), fetchFaults()]);
    specs = orderSpecs(loadedSpecs);
    faults = loadedFaults;
  } catch {
    showNote(LOAD_ERROR);
    return;
  }
  setBusy(false);

  const draft = takeDraft();
  if (path === 'fit') {
    mode = 'fit';
    say(GREETING);
  } else if (path === 'service') {
    mode = 'service';
    say(SERVICE_GREETING);
  } else if (draft) {
    mode = 'intent';
    hasFirstMessage = true;
    addToConversation('customer', draft);
    appendBubble('customer', draft);
    askForIntent(INTENT_QUESTION);
  } else {
    mode = 'intent';
    askForIntent(INTENT_QUESTION);
  }
}

start();
