import { type SupabaseClient, createClient } from "@supabase/supabase-js";

// NEXT_PUBLIC_* must be referenced literally so Next inlines them at build time.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** True when Supabase Auth is configured; otherwise the app uses the demo localStorage sign-in. */
export const supabaseEnabled = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = supabaseEnabled
	? createClient(url as string, anonKey as string, {
			auth: { persistSession: true, autoRefreshToken: true },
		})
	: null;
