/* Lazy Supabase client singleton.
   createClient() only ever runs inside supabase(), never at module load,
   so a build/run with no env configured never throws — guest mode must
   keep working with zero Supabase setup (non-negotiable #4). Every call
   site guards with: const sb = supabase(); if (!sb) return; */
import { createClient } from "@supabase/supabase-js";

const URL = import.meta.env.PUBLIC_SUPABASE_URL;
const KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = () => Boolean(URL && KEY);

let _client = null;

export function supabase() {
  if (!isSupabaseConfigured()) return null;
  if (!_client) _client = createClient(URL, KEY);
  return _client;
}
