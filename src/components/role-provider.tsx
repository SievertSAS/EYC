"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { useDb } from "@/components/db-provider";
import { createClient } from "@/lib/supabase/client";
import type { RolUsuario, RolPermiso } from "@/lib/db/types";

export interface ActiveRole {
  usuarioId: number;
  nombre: string;
  cargo: RolUsuario;
}

interface RoleContextValue {
  role: ActiveRole | null;
  isAdmin: boolean;
  isReady: boolean;
  hasPermission: (modulo: string) => boolean;
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
  const [role, setRole] = useState<ActiveRole | null>(null);
  const [providerReady, setProviderReady] = useState(false);
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
      } else {
        setAuthUid(null);
        setAuthEmail(null);
        setRole(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!dbReady || usuarios.length === 0 || !authChecked) return;

    if (authUid) {
      const byUid = usuarios.find((u) => u.auth_uid === authUid);
      if (byUid) {
        setRole({
          usuarioId: byUid.id!,
          nombre: byUid.nombre,
          cargo: byUid.cargo,
        });
        setProviderReady(true);
        return;
      }

      if (authEmail) {
        const byEmail = usuarios.find(
          (u) => u.email?.toLowerCase() === authEmail.toLowerCase()
        );
        if (byEmail) {
          setRole({
            usuarioId: byEmail.id!,
            nombre: byEmail.nombre,
            cargo: byEmail.cargo,
          });
          setProviderReady(true);
          return;
        }
      }

      console.warn("[Role] No se encontró usuario por auth_uid ni email");
    }

    setProviderReady(true);
  }, [dbReady, usuarios, authUid, authEmail, authChecked]);

  const hasPermission = useCallback(
    (modulo: string): boolean => {
      if (!role) return false;
      const permiso = permisos.find(
        (p: RolPermiso) => p.rol === role.cargo && p.modulo === modulo
      );
      return permiso?.activo ?? false;
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
