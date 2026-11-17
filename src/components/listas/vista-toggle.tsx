"use client";

import { SquareKanban, Table2 } from "lucide-react";
import type { VistaLista } from "@/lib/listas/comun";

const VISTAS: { id: VistaLista; label: string; Icon: typeof Table2 }[] = [
  { id: "tabla", label: "Tabla", Icon: Table2 },
  { id: "kanban", label: "Kanban", Icon: SquareKanban },
];

/** Selector segmentado Tabla | Kanban de un listado. */
export function VistaToggle({
  value,
  onChange,
}: {
  value: VistaLista;
  onChange: (v: VistaLista) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Vista del listado"
      className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5"
    >
      {VISTAS.map(({ id, label, Icon }) => {
        const activo = value === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={activo}
            onClick={() => !activo && onChange(id)}
            className={`flex min-h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors ${
              activo ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Icon className="size-4" aria-hidden />
            {/* En móvil solo el ícono (el nombre accesible se mantiene). */}
            <span className="sr-only sm:not-sr-only">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
