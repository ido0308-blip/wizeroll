const SUPABASE_URL = 'https://mmtfwmerqmkgliqlvyto.supabase.co';
const SUPABASE_PUBLIC_KEY = 'sb_publishable_50l0mjBPEBJ6acutZAtO5A_sgHcPWUX';

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY);

export async function fetchProductSpecs() {
  const { data, error } = await db.from('product_specs').select('*');
  if (error) throw new Error(error.message);
  return data;
}

export async function fetchFaults() {
  const { data, error } = await db.from('faults').select('id, symptom, fix_instructions, self_fixable');
  if (error) throw new Error(error.message);
  return data;
}

// Anonymous customers can insert but not read, so the row is not returned.
export async function saveRequest(request) {
  const { error } = await db.from('requests').insert(request);
  if (error) throw new Error(error.message);
}

// Owner side. supabase-js keeps the session token in the browser.

export async function getSession() {
  const { data } = await db.auth.getSession();
  return data.session;
}

export async function signIn(email, password) {
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  return data.session;
}

export async function signOut() {
  await db.auth.signOut();
}

export async function fetchRequests() {
  const { data, error } = await db
    .from('requests')
    .select('*, fault:faults(symptom, likely_cause, fix_instructions, self_fixable)')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

// The update policy only matches a pending service request, so an empty result
// means the request was already decided.
export async function decideRequest(id, update) {
  const { data, error } = await db
    .from('requests')
    .update(update)
    .eq('id', id)
    .select('*, fault:faults(symptom, likely_cause, fix_instructions, self_fixable)');
  if (error) throw new Error(error.message);
  if (!data.length) throw new Error('This request was already decided.');
  return data[0];
}
