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
        lines: 12,
        statements: 12,
        functions: 9,
        branches: 12,
        "src/lib/equipos/engine.ts": { lines: 83, functions: 85, branches: 77 },
        "src/lib/supabase/sync-retry.ts": { lines: 94, functions: 100, branches: 86 },
        "src/lib/supabase/sync-lock.ts": { lines: 65, functions: 66, branches: 60 },
        "src/lib/supabase/sync-engine.ts": { lines: 70, functions: 86, branches: 60 },
        "src/proxy.ts": { lines: 72, functions: 40, branches: 54 },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
