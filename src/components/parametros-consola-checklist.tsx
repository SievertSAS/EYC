"use client";

import {
  PARAMETROS_CONSOLA,
  PARAMETRO_CONSOLA_LABELS,
  type ParametroConsola,
} from "@/lib/db/types";
import { toggleParametro } from "@/lib/equipos/parametros-consola";

/**
 * Checklist "Parámetros nominales que muestra la consola" del CONVENCIONAL
 * (#189). Selección múltiple: cada botón es un toggle (`aria-pressed`). El
 * resultado siempre sale en el orden canónico (kV, mA, Tiempo, mAs).
 */
export function ParametrosConsolaChecklist({
  value,
  onChange,
  disabled,
}: {
  /** `null`/`undefined` = sin definir (equipos existentes). */
  value: readonly ParametroConsola[] | null | undefined;
  onChange: (v: ParametroConsola[]) => void;
  disabled?: boolean;
}) {
  const seleccion = value ?? [];
  return (
    <div
      role="group"
      aria-label="Parámetros nominales que muestra la consola"
      className="inline-flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50 p-0.5"
    >
      {PARAMETROS_CONSOLA.map((p) => {
        const activo = seleccion.includes(p);
        return (
          <button
            key={p}
            type="button"
            aria-pressed={activo}
            disabled={disabled}
            onClick={() => onChange(toggleParametro(seleccion, p))}
            className={`min-h-9 rounded-md px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              activo ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {PARAMETRO_CONSOLA_LABELS[p]}
          </button>
        );
      })}
    </div>
  );
}
