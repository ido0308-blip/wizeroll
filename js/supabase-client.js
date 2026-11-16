const SUPABASE_URL = 'https://mmtfwmerqmkgliqlvyto.supabase.co';
const SUPABASE_PUBLIC_KEY = 'sb_publishable_50l0mjBPEBJ6acutZAtO5A_sgHcPWUX';

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY);

export async function fetchProductSpecs() {
  const { data, error } = await db.from('product_specs').select('*');
  if (error) throw new Error(error.message);
  return data;
}

// Anonymous customers can insert but not read, so the row is not returned.
export async function saveRequest(request) {
  const { error } = await db.from('requests').insert(request);
  if (error) throw new Error(error.message);
}
