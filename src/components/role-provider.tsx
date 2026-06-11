"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { useDb } from "@/components/db-provider";
import { createClient } from "@/lib/supabase/client";
import type { RolUsuario, RolPermiso, AccionPermiso, ModuloApp } from "@/lib/db/types";
import { resolverPermiso } from "@/lib/db/types";

export interface ActiveRole {
  usuarioId: number;
  nombre: string;
  cargo: RolUsuario;
}

interface RoleContextValue {
  role: ActiveRole | null;
  isAdmin: boolean;
  isReady: boolean;
  /** Permiso del rol activo sobre un módulo. Sin acción = "ver". */
  hasPermission: (modulo: string, accion?: AccionPermiso) => boolean;
}

const RoleContext = createContext<RoleContextValue>({
  role: null,
  isAdmin: false,
  isReady: false,
  hasPermission: () => false,
});

export function useRole() {
  return useContext(RoleContext);
}

export function RoleProvider({ children }: { children: ReactNode }) {
  const { isReady: dbReady } = useDb();
  const [authChecked, setAuthChecked] = useState(false);
  const [authUid, setAuthUid] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState<string | null>(null);

  const usuarios = useLiveQuery(
    async () => {
      if (!dbReady) return [];
      return db.usuarios.filter((u) => u.activo).toArray();
    },
    [dbReady],
    []
  );

  const permisos = useLiveQuery(
    async () => {
      if (!dbReady) return [];
      return db.rol_permisos.toArray();
    },
    [dbReady],
    []
  );

  useEffect(() => {
    const supabase = createClient();

    supabase.auth
      .getUser()
      .then(({ data: { user } }) => {
        if (user) {
          setAuthUid(user.id);
          setAuthEmail(user.email ?? null);
        }
        setAuthChecked(true);
      })
      .catch(() => {
        setAuthChecked(true);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setAuthUid(session.user.id);
        setAuthEmail(session.user.email ?? null);
      } else if (navigator.onLine) {
        setAuthUid(null);
        setAuthEmail(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // El rol activo es estado derivado: usuario de Dexie que coincide
  // con la sesión de Supabase (por auth_uid, o por email como fallback)
  const role = useMemo<ActiveRole | null>(() => {
    if (!authUid || usuarios.length === 0) return null;

    const byUid = usuarios.find((u) => u.auth_uid === authUid);
    if (byUid) {
      return { usuarioId: byUid.id!, nombre: byUid.nombre, cargo: byUid.cargo };
    }

    if (authEmail) {
      const byEmail = usuarios.find((u) => u.email?.toLowerCase() === authEmail.toLowerCase());
      if (byEmail) {
        return { usuarioId: byEmail.id!, nombre: byEmail.nombre, cargo: byEmail.cargo };
      }
    }

    console.warn("[Role] No se encontró usuario por auth_uid ni email");
    return null;
  }, [usuarios, authUid, authEmail]);

  const providerReady = dbReady && authChecked && usuarios.length > 0;

  const hasPermission = useCallback(
    (modulo: string, accion: AccionPermiso = "ver"): boolean => {
      if (!role) return false;
      const permiso = permisos.find((p: RolPermiso) => p.rol === role.cargo && p.modulo === modulo);
      return resolverPermiso(permiso, role.cargo, modulo as ModuloApp, accion);
    },
    [role, permisos]
  );

  const isAdmin = role?.cargo === "coordinador";

  return (
    <RoleContext.Provider
      value={{
        role,
        isAdmin,
        isReady: providerReady,
        hasPermission,
      }}
    >
      {children}
    </RoleContext.Provider>
  );
}
