import { z } from "zod/v4";

const CARGOS_VALIDOS = ["tecnico", "comercial", "coordinador", "programador"] as const;

export const createUsuarioSchema = z.object({
  email: z.email().max(255),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .max(72, "La contraseña no puede exceder 72 caracteres")
    .regex(/(?=.*[a-zA-Z])(?=.*\d)/, "La contraseña debe contener al menos una letra y un número"),
  nombre: z
    .string()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(150)
    .transform((v) => v.trim().replace(/\s+/g, " ")),
  cedula: z.string().regex(/^\d{5,15}$/, "Cédula inválida: debe contener entre 5 y 15 dígitos"),
  cargo: z.enum(CARGOS_VALIDOS),
  telefono: z
    .string()
    .regex(/^\+?\d{7,15}$/, "Teléfono inválido")
    .optional()
    .or(z.literal("")),
});

export type CreateUsuarioInput = z.infer<typeof createUsuarioSchema>;

/**
 * Edición de un usuario existente (#58). Todos los campos opcionales — el
 * cliente manda solo lo que cambió (incluido el toggle activo/inactivo).
 * No incluye `email` ni `password`: cambiar credenciales es otro flujo.
 */
export const patchUsuarioSchema = z
  .object({
    nombre: z
      .string()
      .min(2, "El nombre debe tener al menos 2 caracteres")
      .max(150)
      .transform((v) => v.trim().replace(/\s+/g, " "))
      .optional(),
    cedula: z
      .string()
      .regex(/^\d{5,15}$/, "Cédula inválida: debe contener entre 5 y 15 dígitos")
      .optional(),
    cargo: z.enum(CARGOS_VALIDOS).optional(),
    telefono: z
      .string()
      .regex(/^\+?\d{7,15}$/, "Teléfono inválido")
      .optional()
      .or(z.literal("")),
    activo: z.boolean().optional(),
    // Path en el bucket `evidencias` tras subir la firma (#109), o null para
    // quitarla. La subida en sí llega como archivo separado (multipart), no
    // por este campo — ver PATCH /api/usuarios/[id].
    firma_url: z.string().nullable().optional(),
    // Título/cargo libre mostrado bajo la firma (distinto de `cargo`, que
    // controla permisos) — ej. "Coordinadora de estudios y controles".
    titulo_firma: z.string().max(150).nullable().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "Nada que actualizar" });

export type PatchUsuarioInput = z.infer<typeof patchUsuarioSchema>;
