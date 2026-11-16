// Fit decisions live here, in code that can be tested. The model never decides a verdict.

const FIELD_ORDER = [
  'desk_height_cm',
  'customer_height_cm',
  'customer_weight_kg',
  'daily_sitting_hours',
  'floor_type',
  'sitting_style',
];

const DEMO_MARK = /\s*\[demo value\]/g;

const UNITS_BY_FIELD_SUFFIX = {
  _cm: { '': 1, cm: 1, cms: 1, centimeter: 1, centimeters: 1, centimetre: 1, centimetres: 1, m: 100, meter: 100, meters: 100, metre: 100, metres: 100, in: 2.54, inch: 2.54, inches: 2.54, '"': 2.54 },
  _kg: { '': 1, kg: 1, kgs: 1, kilo: 1, kilos: 1, kilogram: 1, kilograms: 1, lb: 0.45359, lbs: 0.45359, pound: 0.45359, pounds: 0.45359 },
  _hours: { '': 1, h: 1, hr: 1, hrs: 1, hour: 1, hours: 1 },
};

const SIMPLE_NUMBER = /^(?:(?:about|around|approximately|roughly|maybe)\s+|~\s*)?(\d+(?:\.\d+)?)\s*([a-z"]*)(?:\s+(?:a|per)\s+day|\s+daily)?$/;
const FEET_AND_INCHES = /^(\d+)\s*(?:'|ft|foot|feet)\s*(?:(\d+(?:\.\d+)?)\s*(?:"|in|inch|inches)?)?$/;
const NONE_OF_THEM = /^(?:none(?: of (?:them|these|those|the above))?|neither|other|something else)$/;

function normalize(text) {
  return String(text).toLowerCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function orderSpecs(specs) {
  const rank = (spec) => {
    const index = FIELD_ORDER.indexOf(spec.field_key);
    return index === -1 ? FIELD_ORDER.length : index;
  };
  return [...specs].sort((a, b) => rank(a) - rank(b));
}

export function fillLabel(spec) {
  return spec.customer_label_template
    .replace('{min}', spec.min_value)
    .replace('{max}', spec.max_value)
    .replace('{values}', (spec.allowed_values ?? []).join(', '));
}

export function withoutDemoMark(text) {
  return text.replace(DEMO_MARK, '');
}

// Returns the table's own spelling of a categorical value, or null if it is not in the table.
export function matchAllowedValue(spec, value) {
  return (spec.allowed_values ?? []).find((allowed) => normalize(allowed) === normalize(value)) ?? null;
}

function roundToTenth(value) {
  return Math.round(value * 10) / 10;
}

function cleanAnswer(text) {
  return text.trim().toLowerCase().replace(/[’‘]/g, "'").replace(/[”“]/g, '"').replace(/[.!]+$/, '');
}

// Reads a plain answer to a question the advisor just asked, so it needs no model call.
// Returns null for anything less clear, and the model reads that answer instead.
export function parseSimpleAnswer(spec, text) {
  const answer = cleanAnswer(text);
  if (spec.value_type === 'categorical') return matchAllowedValue(spec, answer);

  const suffix = Object.keys(UNITS_BY_FIELD_SUFFIX).find((key) => spec.field_key.endsWith(key));
  if (!suffix) return null;

  const feetAndInches = suffix === '_cm' ? answer.match(FEET_AND_INCHES) : null;
  if (feetAndInches) {
    return roundToTenth(Number(feetAndInches[1]) * 30.48 + Number(feetAndInches[2] ?? 0) * 2.54);
  }

  const simple = answer.match(SIMPLE_NUMBER);
  const factor = simple ? UNITS_BY_FIELD_SUFFIX[suffix][simple[2]] : undefined;
  return factor === undefined ? null : roundToTenth(Number(simple[1]) * factor);
}

export function saysNoneOfThem(text) {
  return NONE_OF_THEM.test(cleanAnswer(text));
}

export function compareField(spec, value) {
  if (spec.value_type === 'categorical') {
    return matchAllowedValue(spec, value) === null ? 'not_covered' : 'in_range';
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'not_covered';

  const { min_value: min, max_value: max } = spec;
  if ((min !== null && value < min) || (max !== null && value > max)) return 'out_of_range';
  if (value === min || value === max) return 'at_limit';
  return 'in_range';
}

export function buildChecks(specs, values) {
  return orderSpecs(specs).map((spec) => ({
    field_key: spec.field_key,
    label: withoutDemoMark(fillLabel(spec)),
    customer_value: values[spec.field_key],
    result: compareField(spec, values[spec.field_key]),
  }));
}

export function decideVerdict(checks) {
  const outside = checks.find((check) => check.result === 'out_of_range');
  if (outside) return { verdict: 'not_fit', verdict_field_key: outside.field_key };

  const reserved = checks.find((check) => ['at_limit', 'not_covered'].includes(check.result));
  if (reserved) return { verdict: 'fit_with_reservation', verdict_field_key: reserved.field_key };

  return { verdict: 'fit', verdict_field_key: checks[0].field_key };
}

// Used when the model is unavailable, so the customer still gets a correct, reasoned answer.
export function fallbackReply({ verdict, verdict_field_key: fieldKey }, checks) {
  const check = checks.find((candidate) => candidate.field_key === fieldKey);
  const value = check.customer_value;
  if (verdict === 'fit') {
    return `The stool fits: all your details are within the product specification. For example: ${check.label}, and you said ${value}.`;
  }
  if (verdict === 'not_fit') {
    return `The stool does not fit: ${check.label}, and you said ${value}.`;
  }
  if (check.result === 'not_covered') {
    return `The stool fits with a reservation: you said ${value}, and I don't have this data. ${check.label}.`;
  }
  return `The stool fits with a reservation: ${check.label}, and you said ${value}, which is exactly at the limit.`;
}
