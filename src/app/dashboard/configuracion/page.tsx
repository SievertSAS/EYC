"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { useDb } from "@/components/db-provider";
import { useRole } from "@/components/role-provider";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Settings,
  Users,
  Shield,
  Plus,
  Loader2,
  UserCheck,
  UserX,
  Pencil,
} from "lucide-react";
import type { RolUsuario, ModuloApp } from "@/lib/db/types";
import {
  ROLES_DISPONIBLES,
  ROL_LABELS,
  MODULOS_APP,
  MODULO_LABELS,
} from "@/lib/db/types";

export default function ConfiguracionPage() {
  const { isReady } = useDb();
  const { isAdmin } = useRole();

  if (!isReady) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-slate-500 font-bold">Cargando configuración...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Shield className="w-10 h-10 text-red-500" />
        <p className="text-slate-500 font-bold">Acceso restringido</p>
        <p className="text-slate-400 text-sm">
          Solo el coordinador puede acceder a configuración.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 tracking-tighter">
          Configuración
        </h2>
        <p className="text-slate-500 font-medium text-sm md:text-lg mt-1">
          Gestión de usuarios y permisos del sistema
        </p>
      </div>

      <Tabs defaultValue="usuarios">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="usuarios" className="gap-1.5">
            <Users className="w-4 h-4" />
            Usuarios
          </TabsTrigger>
          <TabsTrigger value="roles" className="gap-1.5">
            <Shield className="w-4 h-4" />
            Roles y Permisos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="usuarios">
          <UsuariosTab />
        </TabsContent>
        <TabsContent value="roles">
          <RolesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================
//  Tab: Usuarios
// ============================================================

function UsuariosTab() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const usuarios = useLiveQuery(() => db.usuarios.toArray());

  if (!usuarios) return null;

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500 font-medium">
          {usuarios.length} usuario{usuarios.length !== 1 ? "s" : ""}{" "}
          registrado{usuarios.length !== 1 ? "s" : ""}
        </p>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger
            render={
              <Button className="rounded-xl font-black bg-primary hover:bg-primary/90 text-white" />
            }
          >
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Usuario
          </DialogTrigger>
          <UsuarioFormDialog
            onClose={() => {
              setDialogOpen(false);
              setEditingId(null);
            }}
            editId={editingId}
          />
        </Dialog>
      </div>

      <div className="space-y-3">
        {usuarios.map((u) => (
          <Card
            key={u.id}
            className={`border-none shadow-sm rounded-2xl bg-white overflow-hidden ${
              !u.activo ? "opacity-60" : ""
            }`}
          >
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-black text-slate-900 text-sm truncate">
                      {u.nombre}
                    </p>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                        u.activo
                          ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                          : "bg-red-100 text-red-600 border border-red-200"
                      }`}
                    >
                      {u.activo ? "Activo" : "Inactivo"}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 text-[11px] text-slate-500 font-medium">
                    <span>{u.email ?? "Sin email"}</span>
                    <span>CC {u.cedula}</span>
                    <span className="capitalize">
                      {ROL_LABELS[u.cargo as RolUsuario] ?? u.cargo}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => {
                      setEditingId(u.id!);
                      setDialogOpen(true);
                    }}
                    className="text-slate-400 hover:text-primary"
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={async () => {
                      await db.usuarios.update(u.id!, {
                        activo: !u.activo,
                      });
                    }}
                    className={
                      u.activo
                        ? "text-slate-400 hover:text-red-500"
                        : "text-slate-400 hover:text-emerald-500"
                    }
                  >
                    {u.activo ? (
                      <UserX className="w-4 h-4" />
                    ) : (
                      <UserCheck className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ============================================================
//  Dialog: Crear / Editar usuario
// ============================================================

function UsuarioFormDialog({
  onClose,
  editId,
}: {
  onClose: () => void;
  editId: number | null;
}) {
  const existingUser = useLiveQuery(
    () => (editId ? db.usuarios.get(editId) : undefined),
    [editId]
  );

  const [nombre, setNombre] = useState("");
  const [cedula, setCedula] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [cargo, setCargo] = useState<RolUsuario>("tecnico");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [initialized, setInitialized] = useState(false);

  if (editId && existingUser && !initialized) {
    setNombre(existingUser.nombre);
    setCedula(existingUser.cedula);
    setEmail(existingUser.email ?? "");
    setTelefono(existingUser.telefono ?? "");
    setCargo(existingUser.cargo as RolUsuario);
    setInitialized(true);
  }

  if (!editId && !initialized) {
    setInitialized(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (editId) {
        await db.usuarios.update(editId, {
          nombre,
          cedula,
          cargo,
          telefono: telefono || undefined,
        });
        onClose();
      } else {
        const res = await fetch("/api/usuarios", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            password,
            nombre,
            cedula,
            cargo,
            telefono,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Error al crear usuario");
          return;
        }
        if (data.usuario) {
          await db.usuarios.put(data.usuario);
        }
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle className="font-black">
          {editId ? "Editar Usuario" : "Nuevo Usuario"}
        </DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="nombre" className="font-bold text-xs text-slate-600">
            Nombre completo
          </Label>
          <Input
            id="nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            className="rounded-xl"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label
              htmlFor="cedula"
              className="font-bold text-xs text-slate-600"
            >
              Cédula
            </Label>
            <Input
              id="cedula"
              value={cedula}
              onChange={(e) => setCedula(e.target.value)}
              required
              className="rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label
              htmlFor="cargo"
              className="font-bold text-xs text-slate-600"
            >
              Rol
            </Label>
            <select
              id="cargo"
              value={cargo}
              onChange={(e) => setCargo(e.target.value as RolUsuario)}
              className="w-full h-9 rounded-xl border border-slate-200 px-3 text-sm font-medium focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none bg-white"
            >
              {ROLES_DISPONIBLES.map((r) => (
                <option key={r} value={r}>
                  {ROL_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
        </div>
        {!editId && (
          <>
            <div className="space-y-2">
              <Label
                htmlFor="email"
                className="font-bold text-xs text-slate-600"
              >
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="password"
                className="font-bold text-xs text-slate-600"
              >
                Contraseña temporal
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="rounded-xl"
              />
            </div>
          </>
        )}
        <div className="space-y-2">
          <Label
            htmlFor="telefono"
            className="font-bold text-xs text-slate-600"
          >
            Teléfono (opcional)
          </Label>
          <Input
            id="telefono"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            className="rounded-xl"
          />
        </div>

        {error && (
          <p className="text-xs text-red-600 font-bold bg-red-50 p-2 rounded-lg">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button
            type="submit"
            disabled={loading}
            className="rounded-xl font-black bg-primary hover:bg-primary/90 text-white"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            {editId ? "Guardar Cambios" : "Crear Usuario"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

// ============================================================
//  Tab: Roles y Permisos
// ============================================================

function RolesTab() {
  const permisos = useLiveQuery(() => db.rol_permisos.toArray());
  const [saving, setSaving] = useState<string | null>(null);

  if (!permisos) return null;

  function isActive(rol: RolUsuario, modulo: ModuloApp): boolean {
    return (
      permisos?.some(
        (p) => p.rol === rol && p.modulo === modulo && p.activo
      ) ?? false
    );
  }

  async function togglePermiso(rol: RolUsuario, modulo: ModuloApp) {
    const key = `${rol}-${modulo}`;
    setSaving(key);
    try {
      const existing = permisos?.find(
        (p) => p.rol === rol && p.modulo === modulo
      );
      if (existing) {
        await db.rol_permisos.update(existing.id!, {
          activo: !existing.activo,
          modificado_en: new Date().toISOString(),
        });
      } else {
        await db.rol_permisos.add({
          rol,
          modulo,
          activo: true,
          modificado_en: new Date().toISOString(),
        });
      }
    } finally {
      setSaving(null);
    }
  }

  const isLocked = (rol: RolUsuario, modulo: ModuloApp) =>
    rol === "coordinador" && modulo === "configuracion";

  return (
    <div className="space-y-4 mt-4">
      <p className="text-sm text-slate-500 font-medium">
        Configura qué módulos puede ver cada rol. Los cambios se aplican
        inmediatamente.
      </p>

      <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left p-3 sm:p-4 font-black text-slate-800 text-xs uppercase tracking-wider">
                    Módulo
                  </th>
                  {ROLES_DISPONIBLES.map((rol) => (
                    <th
                      key={rol}
                      className="text-center p-3 sm:p-4 font-black text-slate-800 text-xs uppercase tracking-wider"
                    >
                      {ROL_LABELS[rol]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MODULOS_APP.map((modulo) => (
                  <tr
                    key={modulo}
                    className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="p-3 sm:p-4 font-bold text-slate-700">
                      {MODULO_LABELS[modulo]}
                    </td>
                    {ROLES_DISPONIBLES.map((rol) => {
                      const locked = isLocked(rol, modulo);
                      const active = locked || isActive(rol, modulo);
                      const key = `${rol}-${modulo}`;

                      return (
                        <td key={rol} className="text-center p-3 sm:p-4">
                          <button
                            onClick={() => !locked && togglePermiso(rol, modulo)}
                            disabled={locked || saving === key}
                            className={`w-7 h-7 rounded-lg transition-all ${
                              active
                                ? "bg-primary text-white shadow-sm"
                                : "bg-slate-100 text-slate-300 hover:bg-slate-200"
                            } ${
                              locked
                                ? "cursor-not-allowed opacity-70"
                                : "cursor-pointer"
                            } flex items-center justify-center mx-auto`}
                          >
                            {saving === key ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : active ? (
                              <svg
                                className="w-3.5 h-3.5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={3}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            ) : null}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <p className="text-[11px] text-slate-400 font-medium">
        El rol Coordinador siempre tiene acceso a Configuración y no puede ser
        desactivado.
      </p>
    </div>
  );
}
