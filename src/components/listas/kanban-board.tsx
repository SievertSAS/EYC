"use client";

import type { MouseEvent, ReactNode } from "react";

/**
 * Tarjeta del tablero como enlace real (`href` para abrir en otra pestaña o
 * leer con lector de pantalla); el clic normal delega en `onAbrir` para
 * navegar igual que la fila de la tabla.
 */
export function KanbanCardLink({
  href,
  onAbrir,
  ariaLabel,
  children,
}: {
  href: string;
  onAbrir: () => void;
  ariaLabel: string;
  children: ReactNode;
}) {
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onAbrir();
  };
  return (
    <a
      href={href}
      onClick={onClick}
      aria-label={ariaLabel}
      className="block rounded-lg border border-slate-200 bg-white p-3 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {children}
    </a>
  );
}

export interface ColumnaKanban<T> {
  id: string;
  titulo: string;
  /** Clases del badge del encabezado (colores del estado). */
  badgeClassName: string;
  items: T[];
}

/**
 * Tablero kanban de solo lectura: una columna por estado. En móvil se
 * desplaza horizontalmente con snap por columna; cada columna desplaza su
 * contenido verticalmente.
 */
export function KanbanBoard<T>({
  columnas,
  getKey,
  renderItem,
  ariaLabel,
  textoVacio = "Sin elementos",
}: {
  columnas: ColumnaKanban<T>[];
  getKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  ariaLabel: string;
  textoVacio?: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 md:snap-none"
    >
      {columnas.map((col) => {
        return (
          <section
            key={col.id}
            aria-label={`${col.titulo} (${col.items.length})`}
            className="flex max-h-[calc(100dvh-14rem)] min-h-40 shrink-0 basis-[85%] snap-start flex-col rounded-lg border border-slate-200 bg-slate-50 sm:basis-72"
          >
            <h3
              aria-hidden
              className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2.5"
            >
              <span
                className={`rounded-full border px-2.5 py-1 text-xs font-medium ${col.badgeClassName}`}
              >
                {col.titulo}
              </span>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-500 border border-slate-200">
                {col.items.length}
              </span>
            </h3>
            {col.items.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-slate-400">{textoVacio}</p>
            ) : (
              <ul className="flex-1 space-y-2 overflow-y-auto p-2">
                {col.items.map((item) => (
                  <li key={getKey(item)}>{renderItem(item)}</li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
