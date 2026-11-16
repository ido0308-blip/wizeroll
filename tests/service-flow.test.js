// Run from the project root: node --test tests/

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  FALLBACK_CLARIFYING_QUESTION,
  buildServiceRequest,
  clarifyingQuestion,
  decideServiceStep,
  fixMessage,
  saysNotSolved,
  saysSolved,
} from '../js/service-flow.js';

const WOBBLE = { id: '11111111-1111-4111-8111-111111111111', symptom: 'The seat wobbles from side to side', fix_instructions: 'Tighten the four seat plate screws.', self_fixable: true };
const CRACK = { id: '22222222-2222-4222-8222-222222222222', symptom: 'The base has a visible crack', fix_instructions: 'Stop using the stool and open a service request.', self_fixable: false };
const FAULTS = [WOBBLE, CRACK];

const classified = (fault, confidence) => ({ matched_fault_id: fault?.id ?? null, confidence, clarifying_question: null });

test('high confidence on a self-fixable fault shows the fix', () => {
  const decision = decideServiceStep(classified(WOBBLE, 'high'), FAULTS, { clarified: false });
  assert.equal(decision.step, 'fix');
  assert.equal(decision.fault, WOBBLE);
  assert.equal(decision.isGuess, false);
});

test('high confidence on a fault that is not self-fixable escalates', () => {
  const decision = decideServiceStep(classified(CRACK, 'high'), FAULTS, { clarified: false });
  assert.equal(decision.step, 'escalate');
  assert.equal(decision.confidence, 'high');
});

test('low confidence asks one clarifying question first', () => {
  assert.equal(decideServiceStep(classified(WOBBLE, 'low'), FAULTS, { clarified: false }).step, 'clarify');
});

test('low confidence after the clarifying question shows the guess', () => {
  const decision = decideServiceStep(classified(WOBBLE, 'low'), FAULTS, { clarified: true });
  assert.equal(decision.step, 'fix');
  assert.equal(decision.isGuess, true);
  assert.equal(decision.confidence, 'low');
});

test('not identified asks once, then opens a service request', () => {
  assert.equal(decideServiceStep(classified(null, 'not_identified'), FAULTS, { clarified: false }).step, 'clarify');
  const decision = decideServiceStep(classified(null, 'not_identified'), FAULTS, { clarified: true });
  assert.equal(decision.step, 'open_request');
  assert.equal(decision.fault, null);
});

test('an id that is not in the table counts as not identified', () => {
  const unknown = { matched_fault_id: '33333333-3333-4333-8333-333333333333', confidence: 'high' };
  const decision = decideServiceStep(unknown, FAULTS, { clarified: true });
  assert.equal(decision.step, 'open_request');
  assert.equal(decision.confidence, 'not_identified');
});

test('the clarifying question falls back to a fixed one', () => {
  assert.equal(clarifyingQuestion({ clarifying_question: 'Does it wobble or squeak?' }), 'Does it wobble or squeak?');
  assert.equal(clarifyingQuestion({ clarifying_question: null }), FALLBACK_CLARIFYING_QUESTION);
});

test('the fix message quotes the table and marks a guess', () => {
  assert.equal(fixMessage({ fault: WOBBLE, isGuess: false }), 'This looks like: the seat wobbles from side to side. Tighten the four seat plate screws.');
  assert.match(fixMessage({ fault: WOBBLE, isGuess: true }), /^It sounds like this could be/);
  const squeak = { symptom: 'The stool squeaks when I move', fix_instructions: 'Wipe the joint.' };
  assert.match(fixMessage({ fault: squeak, isGuess: false }), /when I move\./);
});

test('solved and not solved answers are read', () => {
  assert.equal(saysSolved('Yes, that fixed it'), true);
  assert.equal(saysSolved('No, it still wobbles'), false);
  assert.equal(saysSolved('it did not work'), false);
  assert.equal(saysNotSolved('No, it still wobbles'), true);
  assert.equal(saysNotSolved('yes thanks'), false);
});

test('the saved row matches the outcome', () => {
  const decision = decideServiceStep(classified(WOBBLE, 'high'), FAULTS, { clarified: false });
  assert.deepEqual(buildServiceRequest({ email: 'a@example.com', conversation: [], decision, solved: true }), {
    request_type: 'service',
    customer_email: 'a@example.com',
    conversation_log: [],
    matched_fault_id: WOBBLE.id,
    fault_match_confidence: 'high',
    status: 'resolved',
  });
  const unmatched = decideServiceStep(classified(null, 'not_identified'), FAULTS, { clarified: true });
  const row = buildServiceRequest({ email: 'a@example.com', conversation: [], decision: unmatched, solved: false });
  assert.equal(row.status, 'pending');
  assert.equal(row.matched_fault_id, null);
  assert.equal(row.fault_match_confidence, 'not_identified');
});
