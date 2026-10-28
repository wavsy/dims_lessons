import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseEnv } from "./server";

export function createAdminClient() {
  const { url } = supabaseEnv();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Supabase service role key is not set.");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
