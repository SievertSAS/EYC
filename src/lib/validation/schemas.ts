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
