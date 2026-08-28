// Helper para simular el rol activo en tests de componentes.
//
// El RoleProvider real hace consultas a Dexie + verificación de sesión
// contra Supabase, demasiado para un test unitario. `makeRole()` arma un
// valor de contexto válido usando la MISMA lógica de permisos que produce
// (resolverPermiso + la matriz por defecto), para que `hasPermission` se
// comporte igual que en producción.
//
// Uso típico (el vi.mock va en el archivo de test, no acá — es hoisted):
//
//   import { makeRole } from "@/test/roles";
//   const role = makeRole("tecnico");
//   vi.mock("@/components/role-provider", () => ({ useRole: () => role }));
//
// Para negar un permiso puntual:
//   makeRole("coordinador", { deny: [["clientes", "eliminar"]] })

import {
  permisoDefault,
  resolverPermiso,
  type RolUsuario,
  type RolPermiso,
  type AccionPermiso,
  type ModuloApp,
} from "@/lib/db/types";

export interface MakeRoleOptions {
  usuarioId?: string;
  nombre?: string;
  /** Pares [modulo, accion] que se fuerzan a `false` sobre el default. */
  deny?: Array<[string, AccionPermiso?]>;
  /** Pares [modulo, accion] que se fuerzan a `true` sobre el default. */
  allow?: Array<[string, AccionPermiso?]>;
}

export interface RoleContextValue {
  role: { usuarioId: string; nombre: string; cargo: RolUsuario } | null;
  isAdmin: boolean;
  isReady: boolean;
  hasPermission: (modulo: string, accion?: AccionPermiso) => boolean;
}

export function makeRole(cargo: RolUsuario, opts: MakeRoleOptions = {}): RoleContextValue {
  const { usuarioId = "user-test", nombre = "Usuario Test", deny = [], allow = [] } = opts;

  const key = (m: string, a: AccionPermiso) => `${m}:${a}`;
  const denySet = new Set(deny.map(([m, a]) => key(m, a ?? "ver")));
  const allowSet = new Set(allow.map(([m, a]) => key(m, a ?? "ver")));

  const hasPermission = (modulo: string, accion: AccionPermiso = "ver"): boolean => {
    if (denySet.has(key(modulo, accion))) return false;
    if (allowSet.has(key(modulo, accion))) return true;
    // Sintetiza la fila `rol_permisos` que `seedRolPermisos` habría escrito
    // desde la matriz. Pasar `undefined` NO sirve: accionesEfectivas lee
    // `ver` como `permiso?.activo ?? false`, así que sin fila el "ver"
    // siempre da false y ninguna acción pasa.
    const def = permisoDefault(cargo, modulo as ModuloApp);
    const permiso: RolPermiso = {
      rol: cargo,
      modulo: modulo as ModuloApp,
      activo: def.ver,
      crear: def.crear,
      editar: def.editar,
      eliminar: def.eliminar,
    };
    return resolverPermiso(permiso, cargo, modulo as ModuloApp, accion);
  };

  return {
    role: { usuarioId, nombre, cargo },
    isAdmin: cargo === "coordinador",
    isReady: true,
    hasPermission,
  };
}
