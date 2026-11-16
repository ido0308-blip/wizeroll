// Run from the project root: node --test tests/

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildChecks, compareField, decideVerdict, fallbackReply, fillLabel, isPlausible, matchAllowedValue, parseSimpleAnswer, saysNoneOfThem } from '../js/fit-check.js';

const DESK = { field_key: 'desk_height_cm', value_type: 'numeric_range', min_value: 70, max_value: 95, allowed_values: null, customer_label_template: 'Fits a desk height of {min} to {max} cm [demo value]' };
const WEIGHT = { field_key: 'customer_weight_kg', value_type: 'numeric_range', min_value: 40, max_value: 130, allowed_values: null, customer_label_template: 'Supports {min} to {max} kg' };
const FLOOR = { field_key: 'floor_type', value_type: 'categorical', min_value: null, max_value: null, allowed_values: ['tile', 'low-pile carpet'], customer_label_template: 'Rolls on: {values}' };
const SPECS = [FLOOR, WEIGHT, DESK];

const HOURS = { field_key: 'daily_sitting_hours', value_type: 'numeric_range', min_value: 0, max_value: 10, allowed_values: null, customer_label_template: '' };

test('plain numeric answers are read without the model', () => {
  assert.equal(parseSimpleAnswer(DESK, '85'), 85);
  assert.equal(parseSimpleAnswer(DESK, '85 cm.'), 85);
  assert.equal(parseSimpleAnswer(DESK, '33 inches'), 83.8);
  assert.equal(parseSimpleAnswer(DESK, '1.75 m'), 175);
  assert.equal(parseSimpleAnswer(DESK, "5'10\""), 177.8);
  assert.equal(parseSimpleAnswer(DESK, '5 ft 10'), 177.8);
  assert.equal(parseSimpleAnswer(DESK, '6 feet'), 182.9);
  assert.equal(parseSimpleAnswer(WEIGHT, '70'), 70);
  assert.equal(parseSimpleAnswer(WEIGHT, '165 pounds'), 74.8);
  assert.equal(parseSimpleAnswer(HOURS, 'around 6 hours'), 6);
  assert.equal(parseSimpleAnswer(HOURS, '8 hours a day'), 8);
});

test('a length under 3 with no unit is read as meters', () => {
  assert.equal(parseSimpleAnswer(DESK, '1.70'), 170);
  assert.equal(parseSimpleAnswer(DESK, '1.7 cm'), 1.7);
});

test('impossible values are not plausible', () => {
  assert.equal(isPlausible('customer_height_cm', 1.7), false);
  assert.equal(isPlausible('customer_height_cm', 175), true);
  assert.equal(isPlausible('daily_sitting_hours', 30), false);
  assert.equal(isPlausible('floor_type', 'tile'), true);
});

test('unclear answers go to the model', () => {
  assert.equal(parseSimpleAnswer(HOURS, '6 to 8'), null);
  assert.equal(parseSimpleAnswer(HOURS, "I don't know"), null);
  assert.equal(parseSimpleAnswer(HOURS, '6 cm'), null);
  assert.equal(parseSimpleAnswer(WEIGHT, '70 cm'), null);
  assert.equal(parseSimpleAnswer(DESK, 'my desk is 85 cm'), null);
  assert.equal(parseSimpleAnswer(FLOOR, 'wood floor'), null);
});

test('plain categorical answers use the spelling in the table', () => {
  assert.equal(parseSimpleAnswer(FLOOR, 'Low-pile carpet.'), 'low-pile carpet');
});

test('none of them is recognized', () => {
  assert.equal(saysNoneOfThem('None of them.'), true);
  assert.equal(saysNoneOfThem('other'), true);
  assert.equal(saysNoneOfThem('tile'), false);
});

test('numeric values compare against the range', () => {
  assert.equal(compareField(DESK, 85), 'in_range');
  assert.equal(compareField(DESK, 70), 'at_limit');
  assert.equal(compareField(DESK, 95), 'at_limit');
  assert.equal(compareField(DESK, 69.9), 'out_of_range');
  assert.equal(compareField(DESK, 95.1), 'out_of_range');
  assert.equal(compareField(DESK, undefined), 'not_covered');
});

test('categorical values match the table, ignoring case and hyphens', () => {
  assert.equal(matchAllowedValue(FLOOR, 'Low Pile Carpet'), 'low-pile carpet');
  assert.equal(compareField(FLOOR, 'TILE'), 'in_range');
  assert.equal(compareField(FLOOR, 'concrete'), 'not_covered');
});

test('all values in range give fit, decided by the first field', () => {
  const checks = buildChecks(SPECS, { desk_height_cm: 85, customer_weight_kg: 70, floor_type: 'tile' });
  assert.deepEqual(decideVerdict(checks), { verdict: 'fit', verdict_field_key: 'desk_height_cm' });
});

test('a value at the limit gives fit with a reservation', () => {
  const checks = buildChecks(SPECS, { desk_height_cm: 85, customer_weight_kg: 130, floor_type: 'tile' });
  assert.deepEqual(decideVerdict(checks), { verdict: 'fit_with_reservation', verdict_field_key: 'customer_weight_kg' });
});

test('a value the table does not cover gives fit with a reservation', () => {
  const checks = buildChecks(SPECS, { desk_height_cm: 85, customer_weight_kg: 70, floor_type: 'concrete' });
  assert.deepEqual(decideVerdict(checks), { verdict: 'fit_with_reservation', verdict_field_key: 'floor_type' });
});

test('out of range beats a reservation, whatever the field order', () => {
  const checks = buildChecks(SPECS, { desk_height_cm: 70, customer_weight_kg: 150, floor_type: 'tile' });
  assert.deepEqual(decideVerdict(checks), { verdict: 'not_fit', verdict_field_key: 'customer_weight_kg' });
});

test('labels fill their placeholders, and checks leave out the demo mark', () => {
  assert.equal(fillLabel(DESK), 'Fits a desk height of 70 to 95 cm [demo value]');
  assert.equal(fillLabel(FLOOR), 'Rolls on: tile, low-pile carpet');
  const [desk] = buildChecks(SPECS, { desk_height_cm: 85, customer_weight_kg: 70, floor_type: 'tile' });
  assert.equal(desk.label, 'Fits a desk height of 70 to 95 cm');
});

test('the fallback reply states the verdict, the rule and the value', () => {
  const checks = buildChecks(SPECS, { desk_height_cm: 110, customer_weight_kg: 70, floor_type: 'tile' });
  const reply = fallbackReply(decideVerdict(checks), checks);
  assert.match(reply, /does not fit/);
  assert.match(reply, /70 to 95 cm/);
  assert.match(reply, /110/);
});
