import { useEffect, useState } from "react";
import { resolverImagenSrc } from "@/lib/supabase/storage";

/**
 * URL mostrable de una imagen de evidencia. Prioriza el blob local
 * (offline, instantáneo); si no hay, resuelve una signed URL del path en
 * `url_storage` (#67). Revoca el object-URL del blob al desmontar.
 */
export function useImagenSrc(imagen: {
  blob_local?: Blob | null;
  url_storage?: string | null;
}): string | null {
  const [src, setSrc] = useState<string | null>(null);
  const blob = imagen.blob_local ?? null;
  const path = imagen.url_storage ?? null;

  useEffect(() => {
    let vivo = true;
    let objectUrl: string | null = null;

    resolverImagenSrc({ blob_local: blob, url_storage: path }).then((resolved) => {
      if (!vivo) return;
      if (blob && resolved?.startsWith("blob:")) objectUrl = resolved;
      setSrc(resolved);
    });

    return () => {
      vivo = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [blob, path]);

  return src;
}
