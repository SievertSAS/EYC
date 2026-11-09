"use client";

import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import { Camera, Loader2, PenLine, Save, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { useRole } from "@/components/role-provider";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CONFIGURACION_INFORME_ID, type ConfiguracionInforme } from "@/lib/db/types";
import { compressImage, resolverImagenSrc } from "@/lib/supabase/storage";
import { logger } from "@/lib/logger";

// ============================================================
//  Ajustes → Director Técnico (#194/#195)
//  Nombre, título y firma que salen en el bloque "Responsable Sievert
//  S.A.S." de TODOS los informes (pre-informe y oficial). Configuración
//  global, no un usuario. Solo el coordinador la ve y la edita; la API
//  (/api/configuracion-informe) lo exige igual del lado del servidor.
// ============================================================

/** Guarda vía API (JSON, o multipart si trae firma) y refleja la fila en Dexie. */
async function guardarConfiguracion(
  cambios: Record<string, string | null>,
  firma: Blob | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  let res: Response;
  try {
    if (firma) {
      const form = new FormData();
      for (const [k, v] of Object.entries(cambios)) {
        if (v !== null) form.append(k, v);
      }
      form.append("firma", firma, "firma.jpg");
      res = await fetch("/api/configuracion-informe", { method: "PATCH", body: form });
    } else {
      res = await fetch("/api/configuracion-informe", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cambios),
      });
    }
  } catch (err) {
    logger.error("configuracion-informe", "Error de red guardando", err);
    return { ok: false, error: "Sin conexión con el servidor. Intenta de nuevo." };
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.configuracion) {
    return { ok: false, error: data.error ?? "No se pudo guardar la configuración" };
  }
  await db.configuracion_informe.put(data.configuracion);
  return { ok: true };
}

export function DirectorTecnicoForm() {
  const { role } = useRole();
  // null = no hay fila todavía; undefined = cargando.
  const config = useLiveQuery(
    async () => (await db.configuracion_informe.get(CONFIGURACION_INFORME_ID)) ?? null,
    []
  );

  if (role?.cargo !== "coordinador") return null;
  if (config === undefined) return <Loader2 className="w-6 h-6 text-primary animate-spin" />;

  // Remonta al cambiar la fila (tras guardar) para precargar lo persistido.
  return <Formulario key={config?.last_modified ?? "sin-config"} config={config} />;
}

function Formulario({ config }: { config: ConfiguracionInforme | null }) {
  const [nombre, setNombre] = useState(config?.director_nombre ?? "");
  const [cedula, setCedula] = useState(config?.director_cedula ?? "");
  const [titulo, setTitulo] = useState(config?.director_titulo ?? "");
  const [licencia, setLicencia] = useState(config?.director_licencia ?? "");
  const [firmaFile, setFirmaFile] = useState<Blob | null>(null);
  const [quitarFirma, setQuitarFirma] = useState(false);
  const [firmaGuardadaSrc, setFirmaGuardadaSrc] = useState<string | null>(null);
  const [firmaNuevaSrc, setFirmaNuevaSrc] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const firmaInputRef = useRef<HTMLInputElement>(null);

  const firmaUrl = config?.director_firma_url;
  useEffect(() => {
    if (!firmaUrl) return;
    let vivo = true;
    resolverImagenSrc({ url_storage: firmaUrl }).then((src) => {
      if (vivo) setFirmaGuardadaSrc(src);
    });
    return () => {
      vivo = false;
    };
  }, [firmaUrl]);

  const preview = firmaNuevaSrc ?? (quitarFirma || !firmaUrl ? null : firmaGuardadaSrc);

  async function onFirmaChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const comprimida = await compressImage(file);
    setFirmaFile(comprimida);
    setFirmaNuevaSrc(URL.createObjectURL(comprimida));
    setQuitarFirma(false);
    if (firmaInputRef.current) firmaInputRef.current.value = "";
  }

  async function onGuardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    try {
      const cambios: Record<string, string | null> = {
        director_nombre: nombre,
        director_cedula: cedula,
        director_titulo: titulo,
        director_licencia: licencia,
      };
      if (quitarFirma && !firmaFile) cambios.director_firma_url = null;
      const r = await guardarConfiguracion(cambios, firmaFile);
      if (r.ok) toast.success("Datos del Director Técnico guardados");
      else toast.error(r.error);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Card className="border border-slate-200 shadow-none rounded-lg bg-white mt-4">
      <CardContent className="p-4 sm:p-5">
        <form onSubmit={onGuardar} className="space-y-4 max-w-md">
          <div>
            <p className="text-sm font-semibold text-slate-800">Director Técnico</p>
            <p className="text-xs text-slate-500 mt-1">
              Nombre, título y firma que aparecen como &quot;Responsable Sievert S.A.S.&quot; en
              todos los informes (pre-informe y versión oficial).
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="director-nombre" className="font-bold text-xs text-slate-600">
              Nombre del Director Técnico
            </Label>
            <Input
              id="director-nombre"
              value={nombre}
              maxLength={150}
              onChange={(e) => setNombre(e.target.value)}
              className="rounded-lg"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="director-cedula" className="font-bold text-xs text-slate-600">
              Cédula
            </Label>
            <Input
              id="director-cedula"
              value={cedula}
              maxLength={30}
              inputMode="numeric"
              placeholder="Se imprime como C.C. …"
              onChange={(e) => setCedula(e.target.value)}
              className="rounded-lg"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="director-titulo" className="font-bold text-xs text-slate-600">
              Título bajo la firma
            </Label>
            <Input
              id="director-titulo"
              value={titulo}
              maxLength={150}
              placeholder="Director Técnico"
              onChange={(e) => setTitulo(e.target.value)}
              className="rounded-lg"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="director-licencia" className="font-bold text-xs text-slate-600">
              Licencia
            </Label>
            <Input
              id="director-licencia"
              value={licencia}
              maxLength={150}
              placeholder="Ej.: Licencia N.º 0000 de 2024"
              onChange={(e) => setLicencia(e.target.value)}
              className="rounded-lg"
            />
          </div>
          <div className="space-y-2">
            <Label className="font-bold text-xs text-slate-600 flex items-center gap-1.5">
              <PenLine className="w-3.5 h-3.5" />
              Firma
            </Label>
            {preview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt="Firma del Director Técnico"
                className="h-16 rounded-lg border border-slate-200 bg-white object-contain px-2"
              />
            )}
            <input
              ref={firmaInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onFirmaChange}
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-lg border-dashed border-2 border-slate-200 hover:border-primary/40 hover:bg-primary/5 flex-1 font-bold text-sm text-slate-500"
                onClick={() => firmaInputRef.current?.click()}
              >
                <Camera className="w-4 h-4 mr-2" />
                {preview ? "Cambiar firma" : "Cargar firma"}
              </Button>
              {preview && (
                <Button
                  type="button"
                  variant="outline"
                  aria-label="Quitar firma"
                  className="rounded-lg text-slate-500 hover:text-red-500"
                  onClick={() => {
                    setFirmaFile(null);
                    setFirmaNuevaSrc(null);
                    setQuitarFirma(true);
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
          <Button type="submit" disabled={guardando} className="rounded-lg font-medium">
            {guardando ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Guardar
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
