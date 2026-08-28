import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "happy-dom",
    // Orden importa: el polyfill de IndexedDB primero, después nuestro setup
    // (jest-dom + cleanup de React). Ver src/test/setup.ts.
    setupFiles: ["fake-indexeddb/auto", "./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      // Solo medimos código de producción bajo src/. Se excluye lo que no
      // tiene sentido cubrir con tests unitarios: definiciones de tipos,
      // el propio andamiaje de test, componentes shadcn sin lógica propia,
      // y las rutas/layouts de Next (se cubren a nivel integración en Tier 7).
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/**/*.d.ts",
        "src/test/**",
        "src/components/ui/**",
        "src/app/**/layout.tsx",
        "src/app/**/loading.tsx",
        "src/lib/supabase/types.ts",
      ],
      // Umbrales de "trinquete": son el piso de cobertura actual, redondeado
      // un par de puntos hacia abajo para tolerar el ruido entre corridas.
      // Nunca deben bajar. A medida que se certifica cada módulo (ver plan),
      // se sube el número de sus archivos aquí.
      //
      // El umbral global es bajísimo a propósito: hoy la mayor parte del
      // árbol (páginas, PDF, visita-modulos) no tiene tests. Aun así atrapa
      // el caso de que alguien borre una suite entera. Los globs por archivo
      // son los que ajustan fino sobre lo que YA está testeado en serio.
      thresholds: {
        lines: 13,
        statements: 13,
        functions: 9,
        branches: 12,
        "src/lib/equipos/engine.ts": { lines: 85, functions: 85, branches: 77 },
        "src/lib/equipos/registry.ts": { lines: 90, functions: 85 },
        "src/lib/equipos/convencional/evaluacion.ts": { lines: 70, functions: 78, branches: 58 },
        "src/lib/equipos/convencional/raysafe-parser.ts": { lines: 95, functions: 95, branches: 88 },
        "src/lib/equipos/convencional/grupos.ts": { lines: 95 },
        "src/lib/supabase/sync-retry.ts": { lines: 94, functions: 100, branches: 86 },
        "src/lib/supabase/sync-lock.ts": { lines: 65, functions: 66, branches: 60 },
        "src/lib/supabase/sync-engine.ts": { lines: 70, functions: 86, branches: 60 },
        "src/proxy.ts": { lines: 85, functions: 30, branches: 90 },
        "src/lib/auth/session.ts": { lines: 90, functions: 100, branches: 88 },
        // Tier 1 — Módulo 1 (db). types.ts (motor de permisos) no lo mide v8
        // pero está cubierto de forma exhaustiva por permisos.test.ts +
        // permisos-matriz.test.ts (144 celdas).
        "src/lib/workflow/**": { lines: 68, functions: 68, branches: 52 },
        "src/lib/db/recovery.ts": { lines: 95, functions: 100, branches: 80 },
        "src/lib/db/seed.ts": { lines: 65, functions: 55, branches: 58 },
        "src/lib/db/index.ts": { lines: 63 },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
