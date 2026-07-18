import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getEnv, requireEnv } from "@/lib/env";

let adminClient: SupabaseClient | null = null;

export function hasSupabaseConfig() {
  return Boolean(getEnv("NEXT_PUBLIC_SUPABASE_URL") && getEnv("SUPABASE_SERVICE_ROLE_KEY"));
}

export function getSupabaseAdmin() {
  if (!adminClient) {
    adminClient = createClient(
      requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
        global: {
          headers: { "X-Client-Info": "stockrobber-agent" },
        },
      },
    );
  }

  return adminClient;
}
