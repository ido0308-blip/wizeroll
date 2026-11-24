// Run from the project root: node --test tests/

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  NOTE_MAX_LENGTH,
  buildDecision,
  canDecide,
  conversationEntries,
  sortNewestFirst,
  statusInfo,
} from '../js/dashboard-view.js';

const service = (status, extra = {}) => ({ request_type: 'service', status, ...extra });

test('only a pending service request can be decided', () => {
  assert.equal(canDecide(service('pending')), true);
  assert.equal(canDecide(service('approved')), false);
  assert.equal(canDecide(service('resolved')), false);
  assert.equal(canDecide({ request_type: 'fit_check', status: 'recorded' }), false);
});

test('approve needs one of the three decisions', () => {
  assert.ok(buildDecision('approve', '', '').error);
  assert.ok(buildDecision('approve', 'refund', '').error);
  assert.ok(buildDecision('approve', 'toString', '').error);
  assert.deepEqual(buildDecision('approve', 'credit', '  Partial credit  ').update, {
    status: 'approved',
    owner_decision: 'credit',
    owner_decision_note: 'Partial credit',
  });
});

test('reject clears the decision and keeps an empty note as null', () => {
  assert.deepEqual(buildDecision('reject', 'replacement', '   ').update, {
    status: 'rejected',
    owner_decision: null,
    owner_decision_note: null,
  });
});

test('a note over the limit is refused', () => {
  assert.ok(buildDecision('reject', null, 'x'.repeat(NOTE_MAX_LENGTH + 1)).error);
});

test('status labels follow the decision', () => {
  assert.deepEqual(statusInfo(service('pending')), { label: 'Awaiting decision', tone: 'waiting' });
  assert.equal(statusInfo(service('approved', { owner_decision: 'special_quote' })).label, 'Approved: Special quote');
  assert.equal(statusInfo(service('rejected')).label, 'Rejected');
});

test('the conversation skips broken entries', () => {
  const entries = conversationEntries([
    { role: 'customer', text: 'Hi', at: '2026-11-01T09:00:00Z' },
    null,
    { role: 'advisor' },
    { role: 'system', text: 'Odd role' },
  ]);
  assert.equal(entries.length, 2);
  assert.equal(entries[1].role, 'advisor');
  assert.deepEqual(conversationEntries('not a list'), []);
});

test('requests sort newest first', () => {
  const sorted = sortNewestFirst([
    { id: 'a', created_at: '2026-11-01T00:00:00Z' },
    { id: 'b', created_at: '2026-11-03T00:00:00Z' },
    { id: 'c', created_at: '2026-11-02T00:00:00Z' },
  ]);
  assert.deepEqual(sorted.map((r) => r.id), ['b', 'c', 'a']);
});
