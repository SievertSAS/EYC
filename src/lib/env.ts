import { z } from "zod/v4";

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

function validateEnv<T>(schema: z.ZodType<T>, source: Record<string, unknown>, label: string): T {
  const result = schema.safeParse(source);
  if (!result.success) {
    const missing = result.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(
      `[env] Variables de entorno inválidas (${label}): ${missing}\n` +
        `Verifica tu archivo .env.local. Consulta .env.example para referencia.`
    );
  }
  return result.data;
}

export const clientEnv = validateEnv(
  clientSchema,
  {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
  "client"
);

export function getServerEnv() {
  return validateEnv(
    serverSchema,
    { SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY },
    "server"
  );
}
