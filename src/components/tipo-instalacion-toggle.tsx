"use client";

import { TIPOS_INSTALACION, TIPO_INSTALACION_LABELS, type TipoInstalacion } from "@/lib/db/types";

/**
 * Selector "Tipo de instalación: Fijo / Portátil" del CONVENCIONAL (#187).
 * Segmentado (radiogroup) en vez de lista: son solo dos opciones.
 */
export function TipoInstalacionToggle({
  value,
  onChange,
  disabled,
}: {
  /** Sin valor = fijo (default de la base). */
  value: TipoInstalacion | undefined;
  onChange: (v: TipoInstalacion) => void;
  disabled?: boolean;
}) {
  const actual = value ?? "fijo";
  return (
    <div
      role="radiogroup"
      aria-label="Tipo de instalación"
      className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5"
    >
      {TIPOS_INSTALACION.map((tipo) => {
        const activo = actual === tipo;
        return (
          <button
            key={tipo}
            type="button"
            role="radio"
            aria-checked={activo}
            disabled={disabled}
            onClick={() => !activo && onChange(tipo)}
            className={`min-h-9 rounded-md px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              activo ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {TIPO_INSTALACION_LABELS[tipo]}
          </button>
        );
      })}
    </div>
  );
}
