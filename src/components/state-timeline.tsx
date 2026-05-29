"use client";

import { cn } from "@/lib/utils";
import {
  ESTADO_ORDER,
  ESTADO_CONFIG,
} from "@/lib/workflow/visit-state-machine";
import type { EstadoVisita } from "@/lib/db/types";

// ============================================================
//  Timeline horizontal del ciclo de vida de la visita
//  Muestra los 6 estados con el paso actual resaltado
// ============================================================

interface StateTimelineProps {
  currentState: EstadoVisita;
  className?: string;
}

export function StateTimeline({ currentState, className }: StateTimelineProps) {
  const currentIndex = ESTADO_ORDER.indexOf(currentState);

  return (
    <div className={cn("flex items-center gap-1 overflow-x-auto pb-1", className)}>
      {ESTADO_ORDER.map((estado, index) => {
        const config = ESTADO_CONFIG[estado];
        const isPast = index < currentIndex;
        const isCurrent = index === currentIndex;

        return (
          <div key={estado} className="flex items-center gap-1 flex-shrink-0">
            {/* Dot */}
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "w-2.5 h-2.5 rounded-full border-2 transition-all",
                  isCurrent &&
                    "w-3.5 h-3.5 bg-primary border-primary ring-4 ring-primary/20",
                  isPast && "bg-primary/60 border-primary/60",
                  !isPast && !isCurrent && "bg-slate-200 border-slate-300"
                )}
              />
              <span
                className={cn(
                  "text-[8px] sm:text-[9px] font-black uppercase tracking-wider whitespace-nowrap",
                  isCurrent && "text-primary",
                  isPast && "text-slate-400",
                  !isPast && !isCurrent && "text-slate-300"
                )}
              >
                <span className="hidden sm:inline">{config.label}</span>
                <span className="sm:hidden">
                  {config.label.split(" ")[0]}
                </span>
              </span>
            </div>

            {/* Connector line */}
            {index < ESTADO_ORDER.length - 1 && (
              <div
                className={cn(
                  "w-4 sm:w-6 md:w-8 h-0.5 rounded-full mt-[-14px] sm:mt-[-16px]",
                  index < currentIndex ? "bg-primary/40" : "bg-slate-200"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
