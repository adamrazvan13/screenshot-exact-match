// Supabase client configuration. The URL and the anon/publishable key are PUBLIC by design;
// real secrets (AI key) live only in Supabase Edge Function secrets.
export interface SupabaseConfig {
  url: string;
  key: string;
}

export function supabaseConfig(): SupabaseConfig | null {
  const env = import.meta.env as Record<string, string | undefined>;
  const url = env["VITE_SUPABASE_URL"]?.trim();
  const key = env["VITE_SUPABASE_ANON_KEY"]?.trim();
  return url && key ? { url: url.replace(/\/+$/, ""), key } : null;
}
