"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { resetAndReopen } from "@/lib/db/recovery";
import {
  RefreshCw,
  Wifi,
  WifiOff,
  CloudUpload,
  CloudDownload,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Clock,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Trash2,
  ShieldAlert,
} from "lucide-react";
import {
  fullSync,
  checkSyncStatus,
  getErrorRecords,
  getPendingRecords,
  retryErrorRecords,
  retryRecord,
  type SyncResult,
  type ErrorRecord,
  type SyncRecordPreview,
} from "@/lib/supabase/sync-engine";

/** Fila de un registro pendiente o con error — reusada en ambas listas. */
function SyncRecordRow({
  rec,
  theme,
  online,
  retryingRecordId,
  onRetry,
}: {
  rec: SyncRecordPreview;
  theme: "red" | "amber";
  online: boolean;
  retryingRecordId: string | null;
  onRetry: (rec: SyncRecordPreview) => void;
}) {
  const recordKey = `${rec.table}-${rec.id}`;
  const border = theme === "red" ? "border-red-200" : "border-amber-200";
  const textStrong = theme === "red" ? "text-red-700" : "text-amber-700";
  const textSoft = theme === "red" ? "text-red-500" : "text-amber-600";
  const textMuted = theme === "red" ? "text-red-400" : "text-amber-500";
  const iconColor = theme === "red" ? "text-red-400" : "text-amber-500";

  return (
    <div
      key={recordKey}
      className={`p-3 bg-white border ${border} rounded-xl text-sm font-medium flex items-center gap-3`}
    >
      <AlertCircle className={`w-4 h-4 ${iconColor} flex-shrink-0`} />
      <div className="min-w-0 flex-1">
        <div>
          <span className={`${textStrong} font-black`}>{rec.tableLabel}</span>
          <span className={`${textSoft} ml-2 truncate`}>{rec.preview}</span>
          {rec.status === "failed" && (
            <span className="ml-2 text-[10px] font-black uppercase tracking-widest text-red-400">
              Fallido
            </span>
          )}
        </div>
        {typeof rec.attempts === "number" && (
          <p className={`text-[11px] ${textMuted} font-mono mt-0.5`}>
            {rec.attempts} intento{rec.attempts !== 1 ? "s" : ""}
            {rec.nextAttemptAt &&
              ` — próximo: ${new Date(rec.nextAttemptAt).toLocaleString("es-CO")}`}
          </p>
        )}
      </div>
      <span
        className={`text-[10px] ${theme === "red" ? "text-red-300" : "text-amber-300"} font-mono flex-shrink-0`}
      >
        #{rec.id}
      </span>
      {rec.status === "failed" && (
        <Button
          variant="ghost"
          size="sm"
          className="rounded-lg font-black text-red-700 hover:bg-red-100 h-8 px-3 flex-shrink-0"
          disabled={retryingRecordId === recordKey || !online}
          onClick={() => onRetry(rec)}
        >
          {retryingRecordId === recordKey ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RotateCcw className="w-3.5 h-3.5" />
          )}
        </Button>
      )}
    </div>
  );
}

export default function SyncPage() {
  const [status, setStatus] = useState<{
    online: boolean;
    authenticated: boolean;
    pendingCount: number;
    errorCount: number;
  } | null>(null);

  const [syncing, setSyncing] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);
  const [errorRecords, setErrorRecords] = useState<ErrorRecord[]>([]);
  const [errorsExpanded, setErrorsExpanded] = useState(false);
  const [pendingRecords, setPendingRecords] = useState<SyncRecordPreview[]>([]);
  const [pendingExpanded, setPendingExpanded] = useState(false);
  const [retryingRecordId, setRetryingRecordId] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetAck, setResetAck] = useState(false);
  const [resetting, setResetting] = useState(false);

  const refreshStatus = useCallback(async () => {
    const s = await checkSyncStatus();
    setStatus(s);
    setErrorRecords(s.errorCount > 0 ? await getErrorRecords() : []);
    setPendingRecords(s.pendingCount > 0 ? await getPendingRecords() : []);
  }, []);

  useEffect(() => {
    refreshStatus();

    const handleOnline = () => refreshStatus();
    const handleOffline = () => refreshStatus();

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [refreshStatus]);

  async function handleSync() {
    setSyncing(true);
    try {
      const result = await fullSync();
      setLastResult(result);
      await refreshStatus();
    } catch (err) {
      console.error("[Sync] Error:", err);
    } finally {
      setSyncing(false);
    }
  }

  async function handleRetry() {
    setRetrying(true);
    try {
      await retryErrorRecords();
      const result = await fullSync();
      setLastResult(result);
      await refreshStatus();
    } finally {
      setRetrying(false);
    }
  }

  /**
   * Reintento manual de un registro puntual con sync_status="failed" —
   * terminal, no lo toca `retryErrorRecords()` (solo mueve "error" a
   * "pending"). El técnico de campo puede forzarlo libremente, sin
   * gate de rol (ver retryRecord en sync-engine.ts).
   */
  async function handleRetryRecord(rec: ErrorRecord) {
    setRetryingRecordId(`${rec.table}-${rec.id}`);
    try {
      await retryRecord(rec.table, rec.id);
      await refreshStatus();
    } finally {
      setRetryingRecordId(null);
    }
  }

  /**
   * Borra TODO el IndexedDB de este dispositivo y lo reabre vacío. NO toca el
   * servidor: los datos ya sincronizados se vuelven a bajar en el próximo
   * `fullSync`. Los registros pendientes / con error (que aún no subieron) se
   * pierden. Sin gate de rol — cualquiera en un dispositivo compartido puede
   * necesitarlo; el riesgo lo cubre el modal de confirmación.
   */
  async function handleResetLocal() {
    setResetting(true);
    try {
      await resetAndReopen();
    } finally {
      window.location.reload();
    }
  }

  const hayDatosSinSubir = (status?.pendingCount ?? 0) > 0 || (status?.errorCount ?? 0) > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 tracking-tighter">
          Sincronización
        </h2>
        <p className="text-slate-500 font-medium text-sm md:text-lg mt-1">
          Estado de datos offline y conexión con el servidor
        </p>
      </div>

      {/* Estado de conexión */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-5">
        {/* Online */}
        <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
          <CardContent className="p-4 sm:p-5 md:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[9px] sm:text-xs font-black text-slate-400 uppercase tracking-widest mb-1">
                  Conexión
                </p>
                <h3 className="text-base sm:text-xl font-black text-slate-900 tracking-tight">
                  {status?.online ? "En línea" : "Sin conexión"}
                </h3>
              </div>
              <div className={`p-3 rounded-xl ${status?.online ? "bg-emerald-100" : "bg-red-100"}`}>
                {status?.online ? (
                  <Wifi className="w-5 h-5 text-emerald-600" />
                ) : (
                  <WifiOff className="w-5 h-5 text-red-500" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Autenticación */}
        <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
          <CardContent className="p-4 sm:p-5 md:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[9px] sm:text-xs font-black text-slate-400 uppercase tracking-widest mb-1">
                  Sesión
                </p>
                <h3 className="text-base sm:text-xl font-black text-slate-900 tracking-tight">
                  {status?.authenticated ? "Activa" : "No conectada"}
                </h3>
              </div>
              <div
                className={`p-3 rounded-xl ${
                  status?.authenticated ? "bg-emerald-100" : "bg-amber-100"
                }`}
              >
                {status?.authenticated ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pendientes */}
        <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
          <CardContent className="p-4 sm:p-5 md:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[9px] sm:text-xs font-black text-slate-400 uppercase tracking-widest mb-1">
                  Pendientes
                </p>
                <h3 className="text-base sm:text-xl font-black text-slate-900 tracking-tight">
                  {status?.pendingCount ?? 0}
                </h3>
              </div>
              <div
                className={`p-3 rounded-xl ${
                  (status?.pendingCount ?? 0) > 0 ? "bg-amber-100" : "bg-slate-100"
                }`}
              >
                <CloudUpload
                  className={`w-5 h-5 ${
                    (status?.pendingCount ?? 0) > 0 ? "text-amber-600" : "text-slate-400"
                  }`}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Con error */}
        <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
          <CardContent className="p-4 sm:p-5 md:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[9px] sm:text-xs font-black text-slate-400 uppercase tracking-widest mb-1">
                  Con error
                </p>
                <h3 className="text-base sm:text-xl font-black text-slate-900 tracking-tight">
                  {status?.errorCount ?? 0}
                </h3>
              </div>
              <div
                className={`p-3 rounded-xl ${
                  (status?.errorCount ?? 0) > 0 ? "bg-red-100" : "bg-slate-100"
                }`}
              >
                <AlertTriangle
                  className={`w-5 h-5 ${
                    (status?.errorCount ?? 0) > 0 ? "text-red-500" : "text-slate-400"
                  }`}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Registros con error — detalle expandible */}
      {errorRecords.length > 0 && (
        <Card className="border-2 border-red-200 shadow-none rounded-2xl bg-red-50 overflow-hidden">
          <CardContent className="p-5 sm:p-6 space-y-4">
            <button
              className="w-full flex items-center justify-between"
              onClick={() => setErrorsExpanded(!errorsExpanded)}
            >
              <h3 className="text-base font-black text-red-700 tracking-tight flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                {errorRecords.length} registro{errorRecords.length !== 1 ? "s" : ""} no se{" "}
                {errorRecords.length !== 1 ? "pudieron" : "pudo"} sincronizar
              </h3>
              {errorsExpanded ? (
                <ChevronUp className="w-5 h-5 text-red-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-red-400" />
              )}
            </button>

            {errorsExpanded && (
              <div className="space-y-2">
                {errorRecords.map((rec) => (
                  <SyncRecordRow
                    key={`${rec.table}-${rec.id}`}
                    rec={rec}
                    theme="red"
                    online={!!status?.online}
                    retryingRecordId={retryingRecordId}
                    onRetry={handleRetryRecord}
                  />
                ))}
              </div>
            )}

            <Button
              variant="ghost"
              className="rounded-xl font-black text-red-700 hover:bg-red-100 h-10 px-4"
              disabled={retrying || syncing || !status?.online}
              onClick={handleRetry}
            >
              {retrying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Reintentando...
                </>
              ) : (
                <>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Reintentar todos
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Registros pendientes — detalle expandible */}
      {pendingRecords.length > 0 && (
        <Card className="border-2 border-amber-200 shadow-none rounded-2xl bg-amber-50 overflow-hidden">
          <CardContent className="p-5 sm:p-6 space-y-4">
            <button
              className="w-full flex items-center justify-between"
              onClick={() => setPendingExpanded(!pendingExpanded)}
            >
              <h3 className="text-base font-black text-amber-700 tracking-tight flex items-center gap-2">
                <CloudUpload className="w-5 h-5" />
                {pendingRecords.length} registro{pendingRecords.length !== 1 ? "s" : ""} sin subir
                todavía
              </h3>
              {pendingExpanded ? (
                <ChevronUp className="w-5 h-5 text-amber-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-amber-400" />
              )}
            </button>

            {pendingExpanded && (
              <div className="space-y-2">
                {pendingRecords.map((rec) => (
                  <SyncRecordRow
                    key={`${rec.table}-${rec.id}`}
                    rec={rec}
                    theme="amber"
                    online={!!status?.online}
                    retryingRecordId={retryingRecordId}
                    onRetry={handleRetryRecord}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Botón de sincronización */}
      <Card className="border-2 border-dashed border-primary/30 shadow-none rounded-2xl bg-primary/5 overflow-hidden">
        <CardContent className="p-5 sm:p-6 flex flex-col sm:flex-row items-center gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-black text-slate-800 tracking-tight flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-primary" />
              Sincronizar ahora
            </h3>
            <p className="text-sm text-slate-500 font-medium mt-1">
              Enviar cambios locales al servidor y descargar actualizaciones.
            </p>
          </div>
          <Button
            className="rounded-xl font-black bg-primary hover:bg-primary/90 text-white h-11 px-6 flex-shrink-0"
            disabled={syncing || !status?.online}
            onClick={handleSync}
          >
            {syncing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Sincronizando...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Sincronizar
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Resultado de la última sync */}
      {lastResult && (
        <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
          <CardContent className="p-5 space-y-4">
            <h3 className="text-base font-black text-slate-800 tracking-tight flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              Última sincronización
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <CloudUpload className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-black text-emerald-700 uppercase tracking-wider">
                    Enviados
                  </span>
                </div>
                <p className="text-xl font-black text-emerald-700">{lastResult.pushed}</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <CloudDownload className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-black text-blue-700 uppercase tracking-wider">
                    Recibidos
                  </span>
                </div>
                <p className="text-xl font-black text-blue-700">{lastResult.pulled}</p>
              </div>
            </div>

            {lastResult.errors.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-black text-red-600 uppercase tracking-wider">
                  Errores ({lastResult.errors.length})
                </p>
                {lastResult.errors.map((err, i) => (
                  <div
                    key={i}
                    className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 font-medium space-y-1"
                  >
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{err.error}</span>
                    </div>
                    {err.detail && (
                      <p className="text-[11px] text-red-400 font-mono ml-6">{err.detail}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {lastResult.errors.length === 0 && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700 font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Sincronización completada sin errores
              </div>
            )}

            <p className="text-[11px] text-slate-400 font-medium">
              {new Date(lastResult.timestamp).toLocaleString("es-CO")}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Info de modo offline */}
      {!status?.online && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700 font-medium flex items-start gap-2">
          <WifiOff className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Trabajando sin conexión</p>
            <p className="text-xs mt-1">
              Todos los cambios se guardan localmente. Se sincronizarán cuando recuperes la
              conexión.
            </p>
          </div>
        </div>
      )}

      {/* Zona de riesgo — resetear datos locales */}
      <Card className="border-2 border-dashed border-red-200 shadow-none rounded-2xl bg-red-50/40 overflow-hidden">
        <CardContent className="p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-black text-red-700 tracking-tight flex items-center gap-2">
              <ShieldAlert className="w-5 h-5" />
              Resetear datos locales
            </h3>
            <p className="text-sm text-slate-500 font-medium mt-1">
              Borra todo lo guardado en <strong>este dispositivo</strong> y lo vuelve a descargar
              del servidor. Útil si los datos locales quedaron inconsistentes o vas a prestar el
              equipo. No toca el servidor.
            </p>
          </div>
          <Button
            variant="ghost"
            className="rounded-xl font-black text-red-700 hover:bg-red-100 h-11 px-5 flex-shrink-0"
            onClick={() => {
              setResetAck(false);
              setResetOpen(true);
            }}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Resetear
          </Button>
        </CardContent>
      </Card>

      <Dialog open={resetOpen} onOpenChange={(o) => !resetting && setResetOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-black flex items-center gap-2 text-red-700">
              <ShieldAlert className="w-5 h-5" /> Resetear datos locales
            </DialogTitle>
            <DialogDescription>
              Se van a borrar <strong>todos los datos guardados en este dispositivo</strong>{" "}
              (IndexedDB) y la app se va a recargar.
            </DialogDescription>
          </DialogHeader>

          <ul className="text-sm text-slate-600 font-medium space-y-2 list-disc pl-5">
            <li>
              <strong>No</strong> toca el servidor: lo que ya está sincronizado se vuelve a bajar
              solo tras el próximo <code className="text-xs">fullSync</code>.
            </li>
            <li>
              Hay que <strong>volver a iniciar sesión</strong> si la sesión no persiste, y esperar
              la sincronización inicial.
            </li>
          </ul>

          {hayDatosSinSubir && (
            <div className="flex gap-2 p-3 bg-red-50 rounded-xl border border-red-200 text-xs text-red-700 font-bold">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                Tenés {status?.pendingCount ?? 0} pendiente
                {(status?.pendingCount ?? 0) !== 1 ? "s" : ""} y {status?.errorCount ?? 0} con error
                sin subir. <strong>Se van a perder.</strong> Sincronizá primero si tenés conexión.
              </span>
            </div>
          )}

          <label className="flex items-start gap-2 text-sm text-slate-700 font-medium cursor-pointer">
            <input
              type="checkbox"
              className="mt-1 accent-red-600"
              checked={resetAck}
              onChange={(e) => setResetAck(e.target.checked)}
            />
            Entiendo que se borran los datos locales de este dispositivo.
          </label>

          <DialogFooter>
            <Button
              variant="ghost"
              className="rounded-xl font-bold"
              onClick={() => setResetOpen(false)}
              disabled={resetting}
            >
              Cancelar
            </Button>
            <Button
              className="rounded-xl font-black bg-red-600 hover:bg-red-700 text-white"
              onClick={handleResetLocal}
              disabled={!resetAck || resetting}
            >
              {resetting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Borrar y recargar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
