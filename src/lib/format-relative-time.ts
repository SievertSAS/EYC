/**
 * Formatea una fecha ISO como tiempo relativo corto en español
 * ("hace 2 min", "hace 1 h", "hace 3 d"). Sin dependencias externas —
 * alcanza con minutos/horas/días para el caso de uso (timestamp de la
 * última sincronización exitosa, mostrado en `SyncStatusBar`).
 */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  const diffMs = now.getTime() - then;

  if (!Number.isFinite(diffMs) || diffMs < 0) {
    return "hace unos segundos";
  }

  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) {
    return "hace unos segundos";
  }

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return `hace ${diffMin} min`;
  }

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) {
    return `hace ${diffHours} h`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `hace ${diffDays} d`;
}
