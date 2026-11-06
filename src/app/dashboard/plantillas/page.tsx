"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import { FileCog, History, Loader2, Save, Send, Shield } from "lucide-react";
import { db, noBorrado } from "@/lib/db";
import { useDb } from "@/components/db-provider";
import { useRole } from "@/components/role-provider";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TIPOS_EQUIPO, TIPO_LABELS, type TipoEquipo } from "@/lib/db/types";
import { contenidoDe, resolverPlantilla, versionesPublicadas } from "@/lib/plantillas/resolver";
import {
  CAMPOS_TEXTO_PRUEBA,
  CAMPO_TEXTO_LABELS,
  type CampoTextoPrueba,
  type ContenidoPlantilla,
  type PlantillaInforme,
} from "@/lib/plantillas/types";
import { logger } from "@/lib/logger";

// ============================================================
//  /dashboard/plantillas — plantillas de informe por tipo de equipo (#196)
//
//  El coordinador edita un borrador (precargado con los textos
//  vigentes) y lo publica como versión nueva. Las escrituras van por
//  /api/plantillas/* (server-enforced: solo coordinador); la tabla
//  llega a los demás dispositivos por el pull de maestras.
// ============================================================

function fechaLegible(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
}

/** Llama a la API y deja la fila devuelta en Dexie (igual patrón que /api/usuarios). */
async function llamarApi(
  url: string,
  method: "PUT" | "POST",
  body: unknown
): Promise<{ ok: true; plantilla: PlantillaInforme } | { ok: false; error: string }> {
  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.plantilla) {
      return { ok: false, error: data.error ?? "No se pudo completar la operación" };
    }
    await db.plantillas_informe.put(data.plantilla);
    return { ok: true, plantilla: data.plantilla };
  } catch (err) {
    logger.error("plantillas", `Error llamando ${url}`, err);
    return { ok: false, error: "Sin conexión con el servidor. Intenta de nuevo." };
  }
}

export default function PlantillasPage() {
  const { isReady } = useDb();
  const { role, hasPermission } = useRole();
  const [tipo, setTipo] = useState<TipoEquipo>("CONVENCIONAL");

  if (!isReady) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-slate-500 font-bold">Cargando plantillas...</p>
      </div>
    );
  }

  if (!hasPermission("plantillas")) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Shield className="w-10 h-10 text-red-500" />
        <p className="text-slate-500 font-bold">Acceso restringido</p>
        <p className="text-slate-400 text-sm">
          Solo el coordinador administra las plantillas de informe.
        </p>
      </div>
    );
  }

  // Solo el coordinador escribe (la API lo exige igual); otro rol al que
  // se le dé "ver" en Configuración solo consulta.
  const puedeEditar = role?.cargo === "coordinador";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900 tracking-tight">
          Plantillas de informe
        </h2>
        <p className="text-slate-500 font-medium text-sm md:text-base mt-1">
          Textos genéricos del informe por tipo de equipo. Cada publicación crea una versión nueva
          que usan todos los pre-informes e informes oficiales que se generen desde entonces.
        </p>
      </div>

      <div className="space-y-2 max-w-sm">
        <Label className="text-xs font-medium text-slate-600">Tipo de equipo</Label>
        <Select value={tipo} onValueChange={(v) => v && setTipo(v as TipoEquipo)}>
          <SelectTrigger className="w-full rounded-lg border-slate-200 h-11 data-[size=default]:h-11 font-medium">
            <SelectValue>{(v) => TIPO_LABELS[v as TipoEquipo] ?? (v as string)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {TIPOS_EQUIPO.map((t) => (
              <SelectItem key={t} value={t}>
                {TIPO_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <EditorTipo key={tipo} tipo={tipo} puedeEditar={puedeEditar} />
    </div>
  );
}

function EditorTipo({ tipo, puedeEditar }: { tipo: TipoEquipo; puedeEditar: boolean }) {
  const datos = useLiveQuery(async () => {
    const [publicadas, borrador, usuarios] = await Promise.all([
      versionesPublicadas(tipo),
      db.plantillas_informe
        .where("[tipo_equipo+estado]")
        .equals([tipo, "borrador"])
        .filter(noBorrado)
        .first(),
      db.usuarios.toArray(),
    ]);
    const nombres = new Map(usuarios.map((u) => [u.id, u.nombre]));
    return { publicadas, borrador: borrador ?? null, nombres };
  }, [tipo]);

  if (!datos) {
    return <Loader2 className="w-6 h-6 text-primary animate-spin" />;
  }

  const vigente = datos.publicadas[0];
  return (
    <div className="space-y-6">
      <Card className="border border-slate-200 shadow-none rounded-lg bg-white">
        <CardContent className="p-4 sm:p-5 space-y-1 text-sm">
          {vigente ? (
            <p className="text-slate-700">
              <span className="font-semibold">Vigente: v{vigente.version}</span> — publicada por{" "}
              {datos.nombres.get(vigente.publicada_por ?? "") ?? "—"} el{" "}
              {fechaLegible(vigente.publicada_en)}.
            </p>
          ) : (
            <p className="text-slate-700">
              Sin versiones publicadas: el informe usa los textos del sistema.
            </p>
          )}
          {datos.borrador && (
            <p className="text-amber-700 font-medium">
              Hay un borrador guardado sin publicar (última edición{" "}
              {fechaLegible(datos.borrador.last_modified)}).
            </p>
          )}
        </CardContent>
      </Card>

      {/* Remonta el formulario cuando cambia el borrador o la versión vigente
          (al guardar/publicar) para precargar exactamente lo persistido. */}
      <FormularioPlantilla
        key={`${datos.borrador?.id ?? "sin-borrador"}-${vigente?.id ?? "v0"}`}
        tipo={tipo}
        vigente={vigente}
        borrador={datos.borrador}
        puedeEditar={puedeEditar}
      />

      <HistorialVersiones publicadas={datos.publicadas} nombres={datos.nombres} />
    </div>
  );
}

function FormularioPlantilla({
  tipo,
  vigente,
  borrador,
  puedeEditar,
}: {
  tipo: TipoEquipo;
  vigente: PlantillaInforme | undefined;
  borrador: PlantillaInforme | null;
  puedeEditar: boolean;
}) {
  // Punto de partida: el borrador si existe; si no, la plantilla vigente
  // (o los textos del sistema). Siempre completo, campo por campo.
  const [inicial] = useState(() => {
    const efectiva = resolverPlantilla(tipo, borrador ?? vigente);
    return { efectiva, codigo: efectiva.codigo, contenido: contenidoDe(efectiva) };
  });
  const [codigo, setCodigo] = useState(inicial.codigo);
  const [contenido, setContenido] = useState<ContenidoPlantilla>(inicial.contenido);
  const [ocupado, setOcupado] = useState<"guardar" | "publicar" | null>(null);
  const [confirmarOpen, setConfirmarOpen] = useState(false);

  const proximaVersion = (vigente?.version ?? 0) + 1;

  function setTextoPrueba(codigoPrueba: string, campo: CampoTextoPrueba, valor: string) {
    setContenido((c) => ({
      ...c,
      pruebas: { ...c.pruebas, [codigoPrueba]: { ...c.pruebas[codigoPrueba], [campo]: valor } },
    }));
  }

  async function guardarBorrador(): Promise<boolean> {
    const r = await llamarApi("/api/plantillas/borrador", "PUT", {
      tipo_equipo: tipo,
      codigo,
      contenido,
    });
    if (!r.ok) toast.error(r.error);
    return r.ok;
  }

  async function onGuardar() {
    setOcupado("guardar");
    try {
      if (await guardarBorrador()) toast.success("Borrador guardado");
    } finally {
      setOcupado(null);
    }
  }

  async function onPublicar() {
    setOcupado("publicar");
    try {
      // Se publica exactamente lo que está en pantalla.
      if (!(await guardarBorrador())) return;
      const r = await llamarApi("/api/plantillas/publicar", "POST", { tipo_equipo: tipo });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(`Plantilla publicada como versión ${r.plantilla.version}`);
      setConfirmarOpen(false);
    } finally {
      setOcupado(null);
    }
  }

  return (
    <Card className="border border-slate-200 shadow-none rounded-lg bg-white">
      <CardContent className="p-4 sm:p-5 space-y-5">
        <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
          <div className="space-y-2">
            <Label htmlFor="plantilla-codigo" className="text-xs font-medium text-slate-600">
              Código del informe
            </Label>
            <Input
              id="plantilla-codigo"
              value={codigo}
              maxLength={40}
              disabled={!puedeEditar}
              onChange={(e) => setCodigo(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="plantilla-titulo" className="text-xs font-medium text-slate-600">
              Título de la portada
            </Label>
            <Input
              id="plantilla-titulo"
              value={contenido.tituloInforme ?? ""}
              maxLength={500}
              disabled={!puedeEditar}
              onChange={(e) => setContenido((c) => ({ ...c, tituloInforme: e.target.value }))}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="plantilla-intro" className="text-xs font-medium text-slate-600">
            Introducción
          </Label>
          <Textarea
            id="plantilla-intro"
            value={contenido.introduccion ?? ""}
            disabled={!puedeEditar}
            className="min-h-40"
            onChange={(e) => setContenido((c) => ({ ...c, introduccion: e.target.value }))}
          />
          <p className="text-[11px] text-slate-400">
            Separa los párrafos con una línea en blanco. Un campo vacío usa el texto del sistema.
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold text-slate-800">Textos por prueba</p>
          <p className="text-[11px] text-slate-400">
            Las ediciones que el ingeniero haga en el pre-informe de una visita siguen teniendo
            prioridad. Los marcadores entre corchetes (ej. [TOLERANCIA_PCT]) se reemplazan al
            generar el informe.
          </p>
          {inicial.efectiva.pruebas.map((prueba) => {
            const campos = CAMPOS_TEXTO_PRUEBA.filter((c) => c in prueba.textos);
            return (
              <details key={prueba.codigo} className="rounded-lg border border-slate-200 bg-white">
                <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium text-slate-800">
                  {prueba.codigo} — {prueba.nombre}
                </summary>
                <div className="space-y-3 px-3 pb-3">
                  {campos.map((campo) => {
                    const id = `plantilla-${prueba.codigo}-${campo}`;
                    return (
                      <div key={campo} className="space-y-1">
                        <Label htmlFor={id} className="text-xs font-medium text-slate-600">
                          {CAMPO_TEXTO_LABELS[campo]}
                        </Label>
                        <Textarea
                          id={id}
                          value={contenido.pruebas[prueba.codigo]?.[campo] ?? ""}
                          disabled={!puedeEditar}
                          onChange={(e) => setTextoPrueba(prueba.codigo, campo, e.target.value)}
                        />
                      </div>
                    );
                  })}
                </div>
              </details>
            );
          })}
        </div>

        {puedeEditar && (
          <div className="flex flex-wrap gap-2 justify-end">
            <Button variant="outline" disabled={ocupado !== null} onClick={onGuardar}>
              {ocupado === "guardar" ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Guardar borrador
            </Button>
            <Button disabled={ocupado !== null} onClick={() => setConfirmarOpen(true)}>
              <Send className="w-4 h-4 mr-2" />
              Publicar versión {proximaVersion}
            </Button>
          </div>
        )}

        <Dialog open={confirmarOpen} onOpenChange={(o) => ocupado === null && setConfirmarOpen(o)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-semibold flex items-center gap-2">
                <FileCog className="w-5 h-5 text-primary" />
                Publicar versión {proximaVersion}
              </DialogTitle>
              <DialogDescription>
                Todos los pre-informes y los informes oficiales de {TIPO_LABELS[tipo]} que se
                generen desde ahora usarán estos textos. Los informes oficiales ya publicados no
                cambian. Una versión publicada no se puede modificar.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                disabled={ocupado !== null}
                onClick={() => setConfirmarOpen(false)}
              >
                Cancelar
              </Button>
              <Button disabled={ocupado !== null} onClick={onPublicar}>
                {ocupado === "publicar" && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Publicar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function HistorialVersiones({
  publicadas,
  nombres,
}: {
  publicadas: PlantillaInforme[];
  nombres: Map<string | undefined, string>;
}) {
  return (
    <Card className="border border-slate-200 shadow-none rounded-lg bg-white overflow-hidden">
      <CardContent className="p-0">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
          <History className="w-4 h-4 text-slate-500" />
          <p className="text-sm font-semibold text-slate-800">Historial de versiones</p>
        </div>
        {publicadas.length === 0 ? (
          <p className="px-4 py-3 text-sm text-slate-500">Aún no hay versiones publicadas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                  <th className="p-3 font-medium">Versión</th>
                  <th className="p-3 font-medium">Código</th>
                  <th className="p-3 font-medium">Publicada por</th>
                  <th className="p-3 font-medium">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {publicadas.map((p) => (
                  <tr key={p.id} className="border-b border-slate-50 last:border-0">
                    <td className="p-3 font-medium text-slate-800">v{p.version}</td>
                    <td className="p-3 text-slate-600">{p.codigo}</td>
                    <td className="p-3 text-slate-600">
                      {nombres.get(p.publicada_por ?? undefined) ?? "—"}
                    </td>
                    <td className="p-3 text-slate-600">{fechaLegible(p.publicada_en)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
