"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";
import {
  fullSync,
  checkSyncStatus,
  getErrorRecords,
  retryErrorRecords,
  type SyncResult,
  type ErrorRecord,
} from "@/lib/supabase/sync-engine";

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

  const refreshStatus = useCallback(async () => {
    const s = await checkSyncStatus();
    setStatus(s);
    if (s.errorCount > 0) {
      const records = await getErrorRecords();
      setErrorRecords(records);
    } else {
      setErrorRecords([]);
    }
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
                  <div
                    key={`${rec.table}-${rec.id}`}
                    className="p-3 bg-white border border-red-200 rounded-xl text-sm font-medium flex items-center gap-3"
                  >
                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <span className="text-red-700 font-black">{rec.tableLabel}</span>
                      <span className="text-red-500 ml-2 truncate">{rec.preview}</span>
                    </div>
                    <span className="text-[10px] text-red-300 font-mono flex-shrink-0">
                      #{rec.id}
                    </span>
                  </div>
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
    </div>
  );
}
