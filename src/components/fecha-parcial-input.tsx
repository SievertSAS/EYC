"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { componerFechaParcial, parseFechaParcial, type PartesFecha } from "@/lib/fecha-parcial";

// ============================================================
//  Fecha con precisión variable: solo año, año y mes, o completa.
//  Emite `onChange` solo con valores válidos ("" = vacío); mientras el año
//  está a medio tipear, o el día no existe en ese mes, no emite nada.
// ============================================================

const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const DIAS = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0"));

const campoClass =
  "w-full min-w-0 rounded-lg border border-slate-200 bg-transparent px-2.5 font-medium text-sm outline-none focus:border-primary disabled:opacity-50 disabled:bg-slate-50";

export function FechaParcialInput({
  value,
  onChange,
  disabled = false,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  /** Clases para cada control (ej. altura "h-9" / "h-11"). */
  className?: string;
}) {
  const [partes, setPartes] = useState<PartesFecha>(() => parseFechaParcial(value));
  const [prevValue, setPrevValue] = useState(value);

  // Resincronizar cuando el valor externo cambia (guardado remoto, sync).
  if (value !== prevValue) {
    setPrevValue(value);
    setPartes(parseFechaParcial(value));
  }

  const invalida = partes.anio !== "" && componerFechaParcial(partes) === null;

  function actualizar(cambios: Partial<PartesFecha>) {
    const next = { ...partes, ...cambios };
    if (next.mes === "") next.dia = "";
    setPartes(next);
    const compuesto = componerFechaParcial(next);
    if (compuesto !== null && compuesto !== value) onChange(compuesto);
  }

  return (
    <div className="grid grid-cols-[5rem_1fr_4.5rem] gap-2">
      <input
        aria-label="Año"
        inputMode="numeric"
        placeholder="AAAA"
        maxLength={4}
        disabled={disabled}
        aria-invalid={invalida || undefined}
        className={cn(campoClass, invalida && "border-red-400", className)}
        value={partes.anio}
        onChange={(e) => actualizar({ anio: e.target.value.replace(/\D/g, "").slice(0, 4) })}
      />
      <select
        aria-label="Mes"
        disabled={disabled || partes.anio === ""}
        className={cn(campoClass, className)}
        value={partes.mes}
        onChange={(e) => actualizar({ mes: e.target.value })}
      >
        <option value="">Mes —</option>
        {MESES.map((nombre, i) => {
          const v = String(i + 1).padStart(2, "0");
          return (
            <option key={v} value={v}>
              {nombre}
            </option>
          );
        })}
      </select>
      <select
        aria-label="Día"
        disabled={disabled || partes.mes === ""}
        className={cn(campoClass, className)}
        value={partes.dia}
        onChange={(e) => actualizar({ dia: e.target.value })}
      >
        <option value="">Día —</option>
        {DIAS.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
    </div>
  );
}
