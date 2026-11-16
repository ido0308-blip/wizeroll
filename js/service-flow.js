// Service path decisions. Pure functions, tested in tests/service-flow.test.js.

export const FALLBACK_CLARIFYING_QUESTION = 'Can you tell me a bit more: what exactly happens, and when does it happen?';

// The next step after a classification:
// - fix: show the fix from the table and ask whether it solved the problem
// - escalate: show the instructions from the table, then open a service request
// - clarify: ask the one clarifying question
// - open_request: nothing matched, open a service request
export function decideServiceStep(classification, faults, { clarified }) {
  const fault = faults.find((candidate) => candidate.id === classification?.matched_fault_id) ?? null;
  const confidence = fault ? classification.confidence : 'not_identified';

  if (confidence === 'high' || (confidence === 'low' && clarified)) {
    return {
      step: fault.self_fixable ? 'fix' : 'escalate',
      fault,
      confidence,
      isGuess: confidence === 'low',
    };
  }
  if (!clarified) return { step: 'clarify', fault: null, confidence };
  return { step: 'open_request', fault: null, confidence: 'not_identified' };
}

export function clarifyingQuestion(classification) {
  return classification?.clarifying_question || FALLBACK_CLARIFYING_QUESTION;
}

// Only the first letter is lowered, so "I" inside a symptom stays a capital.
export function fixMessage({ fault, isGuess }) {
  const symptom = fault.symptom.charAt(0).toLowerCase() + fault.symptom.slice(1);
  const opening = isGuess
    ? `It sounds like this could be: ${symptom}.`
    : `This looks like: ${symptom}.`;
  return `${opening} ${fault.fix_instructions}`;
}

export function saysSolved(text) {
  if (/\b(not|no|didn'?t|doesn'?t|still)\b/i.test(text)) return false;
  return /\b(yes|yeah|yep|solved|fixed|works|worked)\b/i.test(text);
}

export function saysNotSolved(text) {
  return /\b(no|nope|not|didn'?t|doesn'?t|still)\b/i.test(text);
}

// The row the browser inserts. Status resolved only when the customer confirmed the fix.
export function buildServiceRequest({ email, conversation, decision, solved }) {
  return {
    request_type: 'service',
    customer_email: email,
    conversation_log: conversation,
    matched_fault_id: decision.fault?.id ?? null,
    fault_match_confidence: decision.confidence,
    status: solved ? 'resolved' : 'pending',
  };
}
