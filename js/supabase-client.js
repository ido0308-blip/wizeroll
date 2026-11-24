const SUPABASE_URL = 'https://mmtfwmerqmkgliqlvyto.supabase.co';
const SUPABASE_PUBLIC_KEY = 'sb_publishable_50l0mjBPEBJ6acutZAtO5A_sgHcPWUX';

// Customer pages always act as the anonymous role, even in a browser where the
// owner is signed in. Otherwise the owner's session would be sent with the
// insert, and the owner role has no insert permission on requests.
const customerDb = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, storageKey: 'wizeroll-customer' },
});

// The owner client keeps the session token in the browser.
const ownerDb = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY);

export async function fetchProductSpecs() {
  const { data, error } = await customerDb.from('product_specs').select('*');
  if (error) throw new Error(error.message);
  return data;
}

export async function fetchFaults() {
  const { data, error } = await customerDb.from('faults').select('id, symptom, fix_instructions, self_fixable');
  if (error) throw new Error(error.message);
  return data;
}

// Anonymous customers can insert but not read, so the row is not returned.
export async function saveRequest(request) {
  const { error } = await customerDb.from('requests').insert(request);
  if (error) throw new Error(error.message);
}

// Owner side.

export async function getSession() {
  const { data } = await ownerDb.auth.getSession();
  return data.session;
}

export async function signIn(email, password) {
  const { data, error } = await ownerDb.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  return data.session;
}

export async function signOut() {
  await ownerDb.auth.signOut();
}

export async function fetchRequests() {
  const { data, error } = await ownerDb
    .from('requests')
    .select('*, fault:faults(symptom, likely_cause, fix_instructions, self_fixable)')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

// The update policy only matches a pending service request, so an empty result
// means the request was already decided.
export async function decideRequest(id, update) {
  const { data, error } = await ownerDb
    .from('requests')
    .update(update)
    .eq('id', id)
    .select('*, fault:faults(symptom, likely_cause, fix_instructions, self_fixable)');
  if (error) throw new Error(error.message);
  if (!data.length) throw new Error('This request was already decided.');
  return data[0];
}
