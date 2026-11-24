// Owner dashboard rules. Pure functions, tested in tests/dashboard-view.test.js.

export const DECISIONS = {
  replacement: 'Replacement',
  credit: 'Credit',
  special_quote: 'Special quote',
};

const TYPE_LABELS = { fit_check: 'Fit check', service: 'Service' };

const VERDICT_LABELS = {
  fit: 'Fits',
  fit_with_reservation: 'Fits, with a reservation',
  not_fit: 'Does not fit',
};

const CONFIDENCE_LABELS = { high: 'High', low: 'Low (a guess)', not_identified: 'Not identified' };

export const NOTE_MAX_LENGTH = 500;

export function typeLabel(request) {
  return TYPE_LABELS[request.request_type] ?? request.request_type;
}

export function verdictLabel(verdict) {
  return VERDICT_LABELS[verdict] ?? '—';
}

export function confidenceLabel(confidence) {
  return CONFIDENCE_LABELS[confidence] ?? '—';
}

// tone drives the color: waiting (accent), done (green), closed (muted).
export function statusInfo(request) {
  switch (request.status) {
    case 'pending':
      return { label: 'Awaiting decision', tone: 'waiting' };
    case 'approved':
      return { label: `Approved: ${DECISIONS[request.owner_decision] ?? 'unknown'}`, tone: 'done' };
    case 'rejected':
      return { label: 'Rejected', tone: 'closed' };
    case 'resolved':
      return { label: 'Resolved', tone: 'closed' };
    case 'recorded':
      return { label: 'Recorded', tone: 'closed' };
    default:
      return { label: request.status, tone: 'closed' };
  }
}

export function canDecide(request) {
  return request.request_type === 'service' && request.status === 'pending';
}

// Returns { update } for the database, or { error } for the owner.
export function buildDecision(action, decision, note) {
  const cleanNote = (note ?? '').trim();
  if (cleanNote.length > NOTE_MAX_LENGTH) {
    return { error: `Keep the note under ${NOTE_MAX_LENGTH} characters.` };
  }
  const owner_decision_note = cleanNote || null;

  if (action === 'approve') {
    if (!Object.hasOwn(DECISIONS, decision ?? '')) {
      return { error: 'Choose replacement, credit or special quote.' };
    }
    return { update: { status: 'approved', owner_decision: decision, owner_decision_note } };
  }
  if (action === 'reject') {
    return { update: { status: 'rejected', owner_decision: null, owner_decision_note } };
  }
  return { error: 'Unknown action.' };
}

export function formatDate(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// The log is JSON written by the browser, so each entry is checked before use.
export function conversationEntries(log) {
  if (!Array.isArray(log)) return [];
  return log
    .filter((entry) => entry && typeof entry.text === 'string')
    .map((entry) => ({
      role: entry.role === 'customer' ? 'customer' : 'advisor',
      text: entry.text,
      at: entry.at ?? null,
    }));
}

// Newest first. The query already sorts, this keeps the order after an update.
export function sortNewestFirst(requests) {
  return [...requests].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}
