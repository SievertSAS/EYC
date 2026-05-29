import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

// ============================================================
//  Cliente Supabase para el navegador (Client Components)
//  Usa las variables NEXT_PUBLIC_* accesibles desde el browser
// ============================================================

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
