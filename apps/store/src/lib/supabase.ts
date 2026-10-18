import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || "https://placeholder-project.supabase.co";
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY || "placeholder-anon-key";

if (
  !import.meta.env.VITE_SUPABASE_URL ||
  !import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_URL.includes("your-project-id")
) {
  console.warn(
    "[Urbanrat Store] Running in demo mode with local mock catalog. To connect live backend, configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your Vercel project settings."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
