import { createClient } from "@supabase/supabase-js";

export const DEFAULT_SUPABASE_URL = "https://mmuuqzgclrdhcvrcavgi.supabase.co";
export const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tdXVxemdjbHJkaGN2cmNhdmdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIzNTI5MjYsImV4cCI6MjEwNzkyODkyNn0.UCXXSy25CZR2FTzpi7xmyB5ippy2Qh3qJ6BdRvD6Two";

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
