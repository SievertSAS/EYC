"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db, noBorrado } from "@/lib/db";
import { useDb } from "@/components/db-provider";
import { useRole } from "@/components/role-provider";
import { Card, CardContent } from "@/components/ui/card";
import {
  Activity,
  ClipboardCheck,
  Radio,
  BadgeCheck,
  ShieldCheck,
  ArrowRight,
  FileText,
  Loader2,
} from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  const { isReady } = useDb();
  const { role, hasPermission } = useRole();

  const kpis = useLiveQuery(async () => {
    if (!isReady || !role) return null;

    const allVisitas = (await db.visitas.toArray()).filter(noBorrado);

    const asignadas = allVisitas.filter((v) => v.estado_visita === "asignada").length;
    const enProgreso = allVisitas.filter((v) => v.estado_visita === "en_progreso").length;
    const pendientesRevision = allVisitas.filter((v) => v.estado_visita === "en_revision").length;
    const aprobadas = allVisitas.filter((v) => v.estado_visita === "aprobada").length;

    const informesCount = await db.informes.count();

    return { asignadas, enProgreso, pendientesRevision, aprobadas, informesCount };
  }, [isReady, role]);

  if (!isReady || kpis === undefined || kpis === null) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-slate-500 font-bold">Cargando dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header de página */}
      <div>
        <h2 className="text-2xl font-semibold text-slate-900 tracking-tight">Dashboard</h2>
        <p className="text-slate-500 font-medium text-sm md:text-lg mt-1">
          Resumen general de operaciones
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5 lg:gap-6">
        <KpiCard
          label="Servicios Asignados"
          labelShort="Asignados"
          value={String(kpis.asignadas)}
          icon={<ClipboardCheck className="text-primary w-5 h-5 md:w-7 md:h-7" />}
        />
        <KpiCard
          label="En Progreso"
          labelShort="Progreso"
          value={String(kpis.enProgreso)}
          icon={<Activity className="text-primary w-5 h-5 md:w-7 md:h-7" />}
        />
        {hasPermission("revision") ? (
          <KpiCard
            label="Pendientes Revisión"
            labelShort="Revisión"
            value={String(kpis.pendientesRevision)}
            icon={<ShieldCheck className="text-primary w-5 h-5 md:w-7 md:h-7" />}
          />
        ) : (
          <KpiCard
            label="Informes Generados"
            labelShort="Informes"
            value={String(kpis.informesCount)}
            icon={<FileText className="text-primary w-5 h-5 md:w-7 md:h-7" />}
          />
        )}
        <KpiCard
          label="Aprobadas"
          labelShort="Aprobadas"
          value={String(kpis.aprobadas)}
          icon={<BadgeCheck className="text-primary w-5 h-5 md:w-7 md:h-7" />}
        />
      </div>

      {/* Acciones rápidas */}
      <div className="space-y-4">
        <h3 className="text-base md:text-xl font-semibold text-slate-800 tracking-tight">
          Acciones rápidas
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-5">
          <ActionCard
            title="Visitas"
            description="Ver servicios asignados"
            href="/dashboard/visitas"
            icon={<ClipboardCheck className="text-primary w-4 h-4 sm:w-5 sm:h-5" />}
          />
          {hasPermission("revision") && (
            <ActionCard
              title="Revisión"
              description={`${kpis.pendientesRevision} pendiente${kpis.pendientesRevision !== 1 ? "s" : ""}`}
              href="/dashboard/revision"
              icon={<ShieldCheck className="text-primary w-4 h-4 sm:w-5 sm:h-5" />}
            />
          )}
          <ActionCard
            title="Informes"
            description="Informes técnicos emitidos"
            href="/dashboard/informes"
            icon={<FileText className="text-primary w-4 h-4 sm:w-5 sm:h-5" />}
          />
          <ActionCard
            title="Sincronización"
            description="Estado de datos offline"
            href="/dashboard/sync"
            icon={<Radio className="text-primary w-4 h-4 sm:w-5 sm:h-5" />}
          />
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  labelShort,
  value,
  icon,
}: {
  label: string;
  labelShort: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <Card className="border border-slate-200 shadow-none hover:border-slate-300 transition-all rounded-lg bg-white group cursor-default overflow-hidden">
      <CardContent className="p-4 sm:p-5 md:p-8">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs sm:text-xs font-medium text-slate-400 mb-1">
              <span className="sm:hidden">{labelShort}</span>
              <span className="hidden sm:inline">{label}</span>
            </p>
            <h3 className="text-base sm:text-xl md:text-2xl font-semibold text-slate-900 tracking-tight">
              {value}
            </h3>
          </div>
          <div className="bg-primary/10 p-2.5 sm:p-3 md:p-4 rounded-lg group-hover:scale-110 transition-transform duration-300 flex-shrink-0">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ActionCard({
  title,
  description,
  href,
  icon,
}: {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
}) {
  return (
    <Link href={href}>
      <Card className="border border-slate-200 shadow-none hover:border-slate-300 transition-all duration-300 rounded-lg bg-white group cursor-pointer overflow-hidden">
        <CardContent className="p-4 sm:p-5 md:p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="bg-primary/10 p-2 sm:p-2.5 rounded-lg flex-shrink-0">{icon}</div>
              <div className="min-w-0">
                <p className="font-medium text-slate-900 text-sm sm:text-base truncate">{title}</p>
                <p className="text-[11px] text-slate-400 font-medium">{description}</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-300 flex-shrink-0 group-hover:text-primary transition-colors" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
