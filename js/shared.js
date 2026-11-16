const IS_LOCAL = ['localhost', '127.0.0.1'].includes(window.location.hostname);
const API_URL = IS_LOCAL ? '/api/advise' : 'https://wizeroll.vercel.app/api/advise';

export const DRAFT_KEY = 'wizeroll_first_message';

export async function callAdvisor(task, payload) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task, ...payload }),
  });
  const data = await response.json();
  if (!response.ok || data.ok !== true) throw new Error(data.error || 'Request failed');
  return data;
}

// sessionStorage can throw in private windows. The draft is only a convenience.
export function saveDraft(text) {
  try {
    sessionStorage.setItem(DRAFT_KEY, text);
  } catch {
    // The customer can type the message again.
  }
}

export function takeDraft() {
  try {
    const text = sessionStorage.getItem(DRAFT_KEY);
    sessionStorage.removeItem(DRAFT_KEY);
    return text;
  } catch {
    return null;
  }
}
