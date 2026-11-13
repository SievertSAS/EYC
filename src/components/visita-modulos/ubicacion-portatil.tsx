"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus, X } from "lucide-react";
import {
  CATEGORIAS_UBICACION,
  CATEGORIA_UBICACION_LABELS,
  type AreaFlotante,
  type CategoriaUbicacion,
} from "@/lib/db/types";
import { Input } from "@/components/ui/input";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
} from "@/components/ui/combobox";
import {
  actualizarDescripcionArea,
  agregarArea,
  normalizarNombreUbicacion,
  quitarArea,
} from "@/lib/ubicaciones/flotantes";
import {
  crearUbicacionFlotante,
  guardarCategoriaUbicacion,
  guardarUbicacionesFlotantes,
  listarCatalogoFlotantes,
} from "@/lib/ubicaciones/catalogo-service";

/**
 * Ubicación del CONVENCIONAL portátil (#188): "Categoría de ubicación:
 * Fija / Flotante". Fija → el padre muestra los campos de la sala (como el
 * fijo). Flotante → selección múltiple de áreas del catálogo compartido, con
 * "Otra ubicación" para agregar una entrada nueva al catálogo de todos. Cada
 * área elegida lleva la descripción de su ubicación (propia de la visita).
 */
export function UbicacionPortatil({
  visitaId,
  categoria,
  areas,
  usuarioId,
}: {
  visitaId: string;
  categoria: CategoriaUbicacion | null | undefined;
  areas: AreaFlotante[];
  usuarioId: string | undefined;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-slate-600">
          Categoría de ubicación <span className="text-red-500">*</span>
        </p>
        <CategoriaUbicacionToggle
          value={categoria}
          onChange={(c) => guardarCategoriaUbicacion(visitaId, c)}
        />
        <p className="text-[11px] text-slate-400">
          Un informe es una sola sala fija o todas las áreas flotantes; nunca se mezclan.
        </p>
      </div>
      {categoria === "flotante" && (
        <AreasFlotantes visitaId={visitaId} areas={areas} usuarioId={usuarioId} />
      )}
    </div>
  );
}

function CategoriaUbicacionToggle({
  value,
  onChange,
}: {
  value: CategoriaUbicacion | null | undefined;
  onChange: (v: CategoriaUbicacion) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Categoría de ubicación"
      className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5"
    >
      {CATEGORIAS_UBICACION.map((c) => {
        const activo = value === c;
        return (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={activo}
            onClick={() => !activo && onChange(c)}
            className={`min-h-9 rounded-md px-4 text-sm font-medium transition-colors ${
              activo ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {CATEGORIA_UBICACION_LABELS[c]}
          </button>
        );
      })}
    </div>
  );
}

function AreasFlotantes({
  visitaId,
  areas,
  usuarioId,
}: {
  visitaId: string;
  areas: AreaFlotante[];
  usuarioId: string | undefined;
}) {
  const catalogo = useLiveQuery(() => listarCatalogoFlotantes(), []) ?? [];
  const [modoOtro, setModoOtro] = useState(false);
  const [otro, setOtro] = useState("");
  const [error, setError] = useState<string | null>(null);

  const elegidas = new Set(areas.map((a) => normalizarNombreUbicacion(a.nombre)));
  const disponibles = catalogo
    .map((c) => c.nombre)
    .filter((n) => !elegidas.has(normalizarNombreUbicacion(n)));
  const faltaDescripcion = areas.some((a) => !a.descripcion.trim());

  function guardar(nuevas: AreaFlotante[]) {
    if (nuevas !== areas) guardarUbicacionesFlotantes(visitaId, nuevas);
  }

  async function agregarOtro() {
    const r = await crearUbicacionFlotante(otro, usuarioId);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    guardar(agregarArea(areas, r.nombre));
    setOtro("");
    setError(null);
    setModoOtro(false);
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-slate-600">
        Áreas evaluadas (ubicaciones flotantes) <span className="text-red-500">*</span>
      </p>
      {areas.length > 0 ? (
        <ul className="space-y-2">
          {areas.map((a) => (
            <li key={a.nombre} className="space-y-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 py-1 pl-3 pr-1 text-xs font-medium text-primary">
                {a.nombre}
                <button
                  type="button"
                  aria-label={`Quitar ${a.nombre}`}
                  onClick={() => guardar(quitarArea(areas, a.nombre))}
                  className="rounded-full p-0.5 hover:bg-primary/20"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
              <DescripcionArea
                nombre={a.nombre}
                value={a.descripcion}
                onSave={(d) => guardar(actualizarDescripcionArea(areas, a.nombre, d))}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-amber-600">Elige al menos un área.</p>
      )}
      {faltaDescripcion && (
        <p className="text-xs text-amber-600">Describe la ubicación de cada área.</p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="sm:w-72">
          <Combobox
            items={disponibles}
            value={null}
            onValueChange={(v: string | null) => v && guardar(agregarArea(areas, v))}
          >
            <ComboboxTrigger className="w-full rounded-lg border border-slate-200 h-9 text-sm font-medium px-3 bg-white data-[placeholder]:text-slate-400">
              <ComboboxValue placeholder="Agregar área del catálogo…" />
            </ComboboxTrigger>
            <ComboboxContent>
              <ComboboxInput placeholder="Buscar área..." />
              <ComboboxEmpty>Sin resultados.</ComboboxEmpty>
              <ComboboxList>
                {(item: string) => (
                  <ComboboxItem key={item} value={item}>
                    {item}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </div>
        {!modoOtro && (
          <button
            type="button"
            onClick={() => setModoOtro(true)}
            className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-primary"
          >
            <Plus className="w-4 h-4" />
            Otra ubicación
          </button>
        )}
      </div>

      {modoOtro && (
        <div className="space-y-1">
          <div className="flex gap-2">
            <Input
              className="rounded-lg h-9 text-sm border-slate-200 sm:w-72"
              placeholder="Nombre de la ubicación"
              value={otro}
              autoFocus
              onChange={(e) => setOtro(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  agregarOtro();
                }
              }}
            />
            <button
              type="button"
              onClick={agregarOtro}
              className="rounded-lg bg-primary px-3 text-sm font-medium text-white hover:bg-primary/90"
            >
              Agregar
            </button>
          </div>
          <p className="text-[11px] text-slate-400">
            Se agrega al catálogo para todos. Si ya existe, se usa la del catálogo.
          </p>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}

/**
 * Descripción de la ubicación de un área flotante. Guarda al salir del campo
 * (blur), no por tecla, igual que los textos de la sala en Información General.
 */
function DescripcionArea({
  nombre,
  value,
  onSave,
}: {
  nombre: string;
  value: string;
  onSave: (v: string) => void;
}) {
  const [local, setLocal] = useState(value);
  const [prevValue, setPrevValue] = useState(value);

  // Sincronizar `local` cuando el valor externo cambia (sync entre
  // dispositivos): ajuste de estado en render, no en efecto.
  if (value !== prevValue) {
    setPrevValue(value);
    setLocal(value);
  }

  return (
    <textarea
      aria-label={`Descripción de ${nombre}`}
      className={`w-full rounded-lg border p-2.5 text-sm font-medium resize-none h-16 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary ${
        value.trim() ? "border-slate-200" : "border-amber-300"
      }`}
      value={local}
      placeholder="Describe la ubicación (piso, cama, puntos de referencia…)"
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => local !== value && onSave(local)}
    />
  );
}
