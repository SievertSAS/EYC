"use client";

import { useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from "@/components/ui/combobox";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { normalizar, type OpcionFiltro } from "@/lib/listas/comun";

// ============================================================
//  Barra de filtros combinables de un listado.
//  Escritorio: controles en línea. Móvil: botón "Filtros" que abre
//  un Sheet inferior con los mismos controles. Los chips de filtros
//  activos se ven en ambos tamaños y cada uno se puede quitar.
// ============================================================

export type CampoFiltro =
  | {
      tipo: "multiple";
      id: string;
      label: string;
      opciones: OpcionFiltro[];
      valores: string[];
      onChange: (valores: string[]) => void;
    }
  | {
      tipo: "fechas";
      id: string;
      label: string;
      desde: string | null;
      hasta: string | null;
      onChange: (desde: string | null, hasta: string | null) => void;
    }
  | {
      tipo: "opcion";
      id: string;
      label: string;
      opciones: OpcionFiltro[];
      valor: string;
      valorPorDefecto: string;
      onChange: (valor: string) => void;
    };

interface Chip {
  key: string;
  texto: string;
  quitar: () => void;
}

function chipsDe(campos: CampoFiltro[]): Chip[] {
  return campos.flatMap((c): Chip[] => {
    if (c.tipo === "multiple") {
      return c.valores.map((v) => ({
        key: `${c.id}:${v}`,
        texto: `${c.label}: ${c.opciones.find((o) => o.value === v)?.label ?? v}`,
        quitar: () => c.onChange(c.valores.filter((x) => x !== v)),
      }));
    }
    if (c.tipo === "fechas") {
      if (!c.desde && !c.hasta) return [];
      const rango =
        c.desde && c.hasta
          ? `${c.desde} – ${c.hasta}`
          : c.desde
            ? `desde ${c.desde}`
            : `hasta ${c.hasta}`;
      return [{ key: c.id, texto: `${c.label}: ${rango}`, quitar: () => c.onChange(null, null) }];
    }
    if (c.valor === c.valorPorDefecto) return [];
    return [
      {
        key: c.id,
        texto: `${c.label}: ${c.opciones.find((o) => o.value === c.valor)?.label ?? c.valor}`,
        quitar: () => c.onChange(c.valorPorDefecto),
      },
    ];
  });
}

export function FiltrosBar({
  campos,
  activos,
  onLimpiar,
}: {
  campos: CampoFiltro[];
  /** Cantidad de campos con filtro activo. */
  activos: number;
  onLimpiar: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const chips = chipsDe(campos);

  return (
    <div className="space-y-2">
      {/* Escritorio */}
      <div className="hidden md:flex flex-wrap items-center gap-2">
        {campos.map((c) => (
          <ControlFiltro key={c.id} campo={c} />
        ))}
        {activos > 0 && (
          <Button variant="ghost" className="h-9 text-slate-500" onClick={onLimpiar}>
            Limpiar filtros
          </Button>
        )}
      </div>

      {/* Móvil */}
      <div className="md:hidden">
        <Button
          variant="outline"
          className="h-11 rounded-lg border-slate-200"
          onClick={() => setAbierto(true)}
          aria-label={activos > 0 ? `Filtros (${activos} activos)` : "Filtros"}
        >
          <SlidersHorizontal className="size-4" aria-hidden />
          Filtros
          {activos > 0 && (
            <span className="rounded-full bg-primary px-1.5 text-xs text-white">{activos}</span>
          )}
        </Button>
        <Sheet open={abierto} onOpenChange={setAbierto}>
          <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Filtros</SheetTitle>
              <SheetDescription>Se combinan entre sí.</SheetDescription>
            </SheetHeader>
            <div className="flex flex-col gap-3 px-4">
              {campos.map((c) => (
                <div key={c.id} className="space-y-1">
                  <p className="text-xs font-medium text-slate-500">{c.label}</p>
                  <ControlFiltro campo={c} completo />
                </div>
              ))}
            </div>
            <SheetFooter className="flex-row">
              <Button
                variant="outline"
                className="h-11 flex-1"
                onClick={onLimpiar}
                disabled={activos === 0}
              >
                Limpiar filtros
              </Button>
              <Button className="h-11 flex-1" onClick={() => setAbierto(false)}>
                Ver resultados
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      {/* Chips de filtros activos */}
      {chips.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Filtros activos">
          {chips.map((chip) => (
            <li
              key={chip.key}
              className="flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 py-0.5 pr-1 pl-2.5 text-xs font-medium text-primary"
            >
              <span>{chip.texto}</span>
              <button
                type="button"
                onClick={chip.quitar}
                aria-label={`Quitar filtro ${chip.texto}`}
                className="rounded-full p-0.5 hover:bg-primary/20"
              >
                <X className="size-3" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ControlFiltro({ campo, completo = false }: { campo: CampoFiltro; completo?: boolean }) {
  if (campo.tipo === "multiple") return <FiltroMultiple campo={campo} completo={completo} />;
  if (campo.tipo === "fechas") {
    return (
      <div className="flex items-center gap-1.5 text-sm text-slate-500">
        {!completo && <span className="whitespace-nowrap">{campo.label}</span>}
        <input
          type="date"
          aria-label={`${campo.label} desde`}
          value={campo.desde ?? ""}
          max={campo.hasta ?? undefined}
          onChange={(e) => campo.onChange(e.target.value || null, campo.hasta)}
          className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700"
        />
        <span aria-hidden>–</span>
        <input
          type="date"
          aria-label={`${campo.label} hasta`}
          value={campo.hasta ?? ""}
          min={campo.desde ?? undefined}
          onChange={(e) => campo.onChange(campo.desde, e.target.value || null)}
          className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700"
        />
      </div>
    );
  }
  return (
    <div
      role="radiogroup"
      aria-label={campo.label}
      className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5"
    >
      {!completo && <span className="px-2 text-sm text-slate-500">{campo.label}</span>}
      {campo.opciones.map((o) => {
        const activo = campo.valor === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={activo}
            onClick={() => !activo && campo.onChange(o.value)}
            className={`min-h-8 rounded-md px-3 text-sm font-medium transition-colors ${
              activo ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function FiltroMultiple({
  campo,
  completo,
}: {
  campo: Extract<CampoFiltro, { tipo: "multiple" }>;
  completo: boolean;
}) {
  const etiquetas = new Map(campo.opciones.map((o) => [o.value, o.label]));
  const etiqueta = (v: string) => etiquetas.get(v) ?? v;
  // Valores seleccionados que ya no están en los datos siguen visibles para poder quitarlos.
  const items = [
    ...campo.opciones.map((o) => o.value),
    ...campo.valores.filter((v) => !etiquetas.has(v)),
  ];
  const n = campo.valores.length;

  return (
    <Combobox
      multiple
      items={items}
      value={campo.valores}
      onValueChange={(v) => campo.onChange(v as string[])}
      itemToStringLabel={etiqueta}
      filter={(v: string, q: string) => normalizar(etiqueta(v)).includes(normalizar(q.trim()))}
    >
      <ComboboxTrigger
        aria-label={n > 0 ? `${campo.label} (${n} seleccionados)` : campo.label}
        disabled={items.length === 0}
        className={`h-9 rounded-lg border-slate-200 bg-white ${completo ? "w-full" : "w-auto min-w-32"} ${
          n > 0 ? "border-primary/40 text-primary" : "text-slate-600"
        }`}
      >
        {campo.label}
        {n > 0 && (
          <span className="ml-1.5 rounded-full bg-primary px-1.5 text-xs text-white">{n}</span>
        )}
      </ComboboxTrigger>
      <ComboboxContent className="min-w-56">
        <ComboboxInput placeholder={`Buscar ${campo.label.toLowerCase()}...`} />
        <ComboboxEmpty>Sin resultados.</ComboboxEmpty>
        <ComboboxList>
          {(v: string) => (
            <ComboboxItem key={v} value={v}>
              {etiqueta(v)}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
