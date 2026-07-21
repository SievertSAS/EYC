"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";

/** Redirige URLs viejas (bookmarks/accesos directos PWA) al workspace unificado */
export default function GrupoCRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  useEffect(() => {
    router.replace(`/dashboard/visitas/${id}?modulo=grupo-c`);
  }, [id, router]);

  return null;
}
