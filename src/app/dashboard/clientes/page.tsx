"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { useDb } from "@/components/db-provider";
import { useRole } from "@/components/role-provider";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Building2,
  Search,
  Plus,
  MapPin,
  ArrowRight,
  Loader2,
  Radio,
} from "lucide-react";
import Link from "next/link";
import { ClienteFormDialog } from "@/components/cliente-form-dialog";

// ============================================================
//  Lista de clientes con búsqueda
// ============================================================

export default function ClientesPage() {
  const { isReady } = useDb();
  const { isAdmin } = useRole();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const data = useLiveQuery(async () => {
    if (!isReady) return undefined;

    const clientes = await db.clientes.toArray();

    // Enriquecer con conteo de sedes y equipos
    const enriched = await Promise.all(
      clientes.map(async (cliente) => {
        const sedes = await db.sedes
          .where("cliente_id")
          .equals(cliente.id!)
          .count();

        // Contar equipos: sedes → ubicaciones → equipos
        const sedesList = await db.sedes
          .where("cliente_id")
          .equals(cliente.id!)
          .toArray();
        const sedeIds = sedesList.map((s) => s.id!);
        let equiposCount = 0;
        for (const sedeId of sedeIds) {
          const ubis = await db.ubicaciones_rx
            .where("sede_id")
            .equals(sedeId)
            .toArray();
          for (const ubi of ubis) {
            const eqCount = await db.equipos
              .where("ubicacion_id")
              .equals(ubi.id!)
              .count();
            equiposCount += eqCount;
          }
        }

        return { cliente, sedes, equipos: equiposCount };
      })
    );

    return enriched;
  }, [isReady]);

  if (!isReady || data === undefined) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-slate-500 font-bold">Cargando clientes...</p>
      </div>
    );
  }

  // Filtrar por búsqueda
  const filtered = search.trim()
    ? data.filter(
        ({ cliente }) =>
          cliente.nombre_cliente
            .toLowerCase()
            .includes(search.toLowerCase()) ||
          cliente.nit.includes(search)
      )
    : data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 tracking-tighter">
            Clientes
          </h2>
          <p className="text-slate-500 font-medium text-sm md:text-lg mt-1">
            {data.length} cliente{data.length !== 1 ? "s" : ""} registrado
            {data.length !== 1 ? "s" : ""}
          </p>
        </div>
        {isAdmin && (
          <Button
            className="rounded-xl font-black bg-primary hover:bg-primary/90 text-white h-11 px-5"
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Nuevo Cliente</span>
            <span className="sm:hidden">Nuevo</span>
          </Button>
        )}
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          className="rounded-xl border-slate-200 focus:border-primary font-medium h-11 pl-10"
          placeholder="Buscar por nombre o NIT..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="bg-primary/10 p-6 rounded-3xl">
            <Building2 className="w-10 h-10 text-primary" />
          </div>
          <p className="text-slate-500 font-bold text-lg">
            {search ? "Sin resultados" : "No hay clientes"}
          </p>
          <p className="text-slate-400 text-sm">
            {search
              ? "Intenta con otro término de búsqueda."
              : "Crea tu primer cliente para comenzar."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(({ cliente, sedes, equipos }) => (
            <Link
              key={cliente.id}
              href={`/dashboard/clientes/${cliente.id}`}
            >
              <Card className="border-none shadow-sm hover:shadow-lg transition-all duration-300 rounded-2xl md:rounded-3xl bg-white group cursor-pointer overflow-hidden mb-3">
                <CardContent className="p-4 sm:p-5 md:p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="bg-primary/10 p-2.5 rounded-xl flex-shrink-0 mt-0.5">
                        <Building2 className="text-primary w-5 h-5" />
                      </div>
                      <div className="min-w-0 space-y-1.5">
                        <p className="font-black text-slate-900 text-sm sm:text-base truncate">
                          {cliente.nombre_cliente}
                        </p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] sm:text-xs text-slate-500 font-medium">
                          <span>NIT: {cliente.nit}</span>
                          {cliente.naturaleza && (
                            <span className="capitalize">
                              {cliente.naturaleza}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 pt-0.5">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-500 border border-slate-200 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {sedes} sede{sedes !== 1 ? "s" : ""}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
                            <Radio className="w-3 h-3" />
                            {equipos} equipo{equipos !== 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-slate-300 flex-shrink-0 mt-2 group-hover:text-primary transition-colors" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Dialog crear cliente */}
      <ClienteFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
