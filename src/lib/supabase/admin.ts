import { createClient } from "@supabase/supabase-js";
import { clientEnv, getServerEnv } from "@/lib/env";

// ============================================================
//  Cliente Supabase con service_role — solo server-side
//  Salta RLS; usar únicamente en Server Components / Route Handlers
//  que necesiten leer datos sin depender de una sesión de usuario
//  (ej. la página pública de verificación por QR).
//
//  Sin el genérico <Database>: igual que el resto de tablas conv_* y
//  el sync-engine, los tipos generados no siempre están al día con
//  columnas nuevas (ej. pdf_hash) hasta que se regeneran manualmente.
// ============================================================

// Lazy init — el cliente admin solo se crea al recibir un request, no al cargar el módulo
export function createAdminClient() {
  return createClient(clientEnv.NEXT_PUBLIC_SUPABASE_URL, getServerEnv().SUPABASE_SERVICE_ROLE_KEY);
}
