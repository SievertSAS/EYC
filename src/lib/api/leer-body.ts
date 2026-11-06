import type { NextRequest } from "next/server";

/**
 * Lee el body como JSON normal, o como `multipart/form-data` cuando trae un
 * archivo (p. ej. una firma, #109) — un archivo no cabe en JSON. En el
 * FormData el archivo llega en `campoArchivo` y los demás campos como strings
 * sueltas; normalizarlos (booleans, etc.) queda a cargo de cada ruta.
 */
export async function leerBodyConArchivo(
  request: NextRequest,
  campoArchivo: string
): Promise<{ campos: Record<string, unknown>; archivo: File | null }> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return { campos: await request.json(), archivo: null };
  }

  const form = await request.formData();
  const campos: Record<string, unknown> = {};
  let archivo: File | null = null;
  for (const [key, value] of form.entries()) {
    if (key === campoArchivo && value instanceof File) {
      archivo = value;
      continue;
    }
    campos[key] = value;
  }
  return { campos, archivo };
}
