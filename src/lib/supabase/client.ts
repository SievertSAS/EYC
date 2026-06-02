import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";
import { clientEnv } from "@/lib/env";

// ============================================================
//  Cliente Supabase para el navegador (Client Components)
//  Usa las variables NEXT_PUBLIC_* accesibles desde el browser
// ============================================================

export function createClient() {
  return createBrowserClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
