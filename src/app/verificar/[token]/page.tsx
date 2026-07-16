import { createAdminClient } from "@/lib/supabase/admin";
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  CheckCircle2,
  XCircle,
  FileText,
  Download,
} from "lucide-react";

// ============================================================
//  Página pública de verificación de informes (escaneada vía QR)
//  Server Component — fuera de /dashboard, no requiere sesión.
//  Usa el cliente service_role (no depende de RLS anónimo).
// ============================================================

interface InformeRow {
  id: string;
  equipo_id: string;
  numero_informe: string;
  version_actual: number;
  concepto_general: string | null;
  fecha_emision: string;
  fecha_vencimiento: string;
  estado: string;
}

interface VersionRow {
  numero_version: number;
  pdf_url: string | null;
}

interface EquipoRow {
  gen_marca: string | null;
  gen_modelo: string | null;
  tipo_equipo: string | null;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center">
          <p className="text-[10px] font-black text-primary uppercase tracking-widest">
            Sievert Protección Radiológica
          </p>
          <h1 className="text-lg font-black text-slate-900 tracking-tight">
            Verificación de Informe
          </h1>
        </div>
        {children}
      </div>
    </main>
  );
}

export default async function VerificarPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = createAdminClient();

  const { data: informe } = await supabase
    .from("informes")
    .select(
      "id, equipo_id, numero_informe, version_actual, concepto_general, fecha_emision, fecha_vencimiento, estado"
    )
    .eq("qr_token", token)
    .maybeSingle<InformeRow>();

  if (!informe) {
    return (
      <Shell>
        <div className="bg-white rounded-2xl shadow-sm p-6 text-center space-y-3">
          <ShieldX className="w-10 h-10 text-red-500 mx-auto" />
          <p className="font-black text-slate-800">Informe no encontrado</p>
          <p className="text-sm text-slate-500">
            El código escaneado no corresponde a ningún informe registrado.
          </p>
        </div>
      </Shell>
    );
  }

  const [{ data: version }, { data: equipo }] = await Promise.all([
    supabase
      .from("informe_versiones")
      .select("numero_version, pdf_url")
      .eq("informe_id", informe.id)
      .eq("numero_version", informe.version_actual)
      .maybeSingle<VersionRow>(),
    supabase
      .from("equipos")
      .select("gen_marca, gen_modelo, tipo_equipo")
      .eq("id", informe.equipo_id)
      .maybeSingle<EquipoRow>(),
  ]);

  let pdfUrl: string | null = null;
  if (version?.pdf_url) {
    const { data: signed } = await supabase.storage
      .from("informes")
      .createSignedUrl(version.pdf_url, 3600);
    pdfUrl = signed?.signedUrl ?? null;
  }

  const hoy = new Date().toISOString().split("T")[0];
  const vencido = informe.fecha_vencimiento < hoy;
  const enCorreccion = informe.estado === "correccion_cliente";
  const favorable = informe.concepto_general === "FAVORABLE";

  const estadoBadge = vencido
    ? { label: "Vencido", icon: ShieldX, className: "bg-red-100 text-red-700 border-red-200" }
    : enCorreccion
      ? {
          label: "En corrección",
          icon: ShieldAlert,
          className: "bg-amber-100 text-amber-700 border-amber-200",
        }
      : {
          label: "Vigente",
          icon: ShieldCheck,
          className: "bg-emerald-100 text-emerald-700 border-emerald-200",
        };
  const EstadoIcon = estadoBadge.icon;

  return (
    <Shell>
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                {informe.numero_informe}
              </h2>
              <p className="text-sm text-slate-500 font-medium">
                {equipo?.gen_marca} {equipo?.gen_modelo}
                {equipo?.tipo_equipo ? ` — ${equipo.tipo_equipo.replace(/_/g, " ")}` : ""}
              </p>
            </div>
            <span
              className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                favorable
                  ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                  : "bg-red-100 text-red-600 border-red-200"
              }`}
            >
              {favorable ? (
                <CheckCircle2 className="w-3 h-3 inline mr-1" />
              ) : (
                <XCircle className="w-3 h-3 inline mr-1" />
              )}
              {informe.concepto_general ?? "—"}
            </span>
          </div>

          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-black ${estadoBadge.className}`}
          >
            <EstadoIcon className="w-4 h-4" />
            {estadoBadge.label}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                Fecha de emisión
              </p>
              <p className="text-sm font-bold text-slate-700">{informe.fecha_emision}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                Fecha de vencimiento
              </p>
              <p className="text-sm font-bold text-slate-700">{informe.fecha_vencimiento}</p>
            </div>
          </div>

          {informe.version_actual > 1 && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3 font-medium">
              Este informe ha tenido correcciones — estás viendo la versión vigente (v
              {informe.version_actual}). Una copia impresa anterior puede estar desactualizada.
            </p>
          )}

          {pdfUrl ? (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full rounded-xl font-black bg-primary hover:bg-primary/90 text-white h-11 px-6 transition-colors"
            >
              <Download className="w-4 h-4" />
              Ver PDF oficial
            </a>
          ) : (
            <div className="flex items-center gap-2 justify-center text-xs text-slate-500 font-bold py-3 bg-slate-50 rounded-xl border border-slate-100">
              <FileText className="w-4 h-4" />
              Documento oficial aún no publicado
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}
