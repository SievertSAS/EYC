"use client";

import { RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Ícono mínimo que aparece en el campo de la técnica (mA / t / mAs) que quedó
 * desactualizado frente a los otros dos. Recalcula solo al tocarlo: nunca se
 * pisa un valor leído de la consola sin que el técnico lo pida.
 */
export function BotonRecalcular({
  onClick,
  className,
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      title="No cuadra con mA × t = mAs. Tocar para recalcular"
      aria-label="Recalcular con mA × t = mAs"
      // mousedown evita que el blur del input dispare antes que el click.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "inline-flex items-center justify-center rounded text-amber-500 hover:text-amber-600 hover:bg-amber-50 p-0.5",
        className
      )}
    >
      <RotateCw className="w-3 h-3" />
    </button>
  );
}

/** Envuelve un input de tabla y superpone `BotonRecalcular` a su derecha cuando `mostrar`. */
export function ConRecalcular({
  mostrar,
  onRecalcular,
  children,
}: {
  mostrar: boolean;
  onRecalcular: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative inline-block">
      {children}
      {mostrar && (
        <BotonRecalcular
          onClick={onRecalcular}
          className="absolute right-0.5 top-1/2 -translate-y-1/2 bg-white"
        />
      )}
    </div>
  );
}
