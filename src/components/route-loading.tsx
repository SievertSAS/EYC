import { Loader2 } from "lucide-react";

export function RouteLoading() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <Loader2 className="w-10 h-10 text-primary animate-spin" />
      <p className="text-slate-500 font-bold">Cargando...</p>
    </div>
  );
}
