import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  globalIgnores([".next/**", "out/**", "build/**", "coverage/**", "next-env.d.ts"]),
  {
    // Deuda técnica conocida y rastreada — NO es una exención permanente.
    //
    // `react-hooks/set-state-in-effect` marca 14 llamadas a setState dentro
    // de useEffect (hooks base + src/components/visita-modulos/*). Varias son
    // reales (doble render) y otras son "sincronizar estado derivado al
    // montar", que la regla no distingue. Arreglarlas ahora, sin tests que
    // cubran esos componentes de 1000+ líneas, es riesgoso.
    //
    // Baja a "warn" para que el CI pueda exigir 0 errores desde ya. Cada
    // módulo afectado re-escala la regla a "error" en su ruta (o corrige la
    // violación con test) como criterio de salida de su tier:
    //   - src/hooks/**            -> Tier 1
    //   - src/components/visita-modulos/**, manual-drawer -> Tier 6 ✅ (abajo)
    //   - src/app/dashboard/**    -> Tier 7
    rules: {
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  {
    // Tier 6 — ruta certificada. Las violaciones de `set-state-in-effect` en
    // los módulos de captura de visita y en el manual-drawer se corrigieron
    // (useBlobPreviewUrl para las previsualizaciones; ajuste de estado en
    // render para la sincronización de props) y quedan cubiertas por
    // smoke-tests. La única excepción justificada inline es la orquestación
    // de animación de `manual-drawer`. La regla vuelve a "error" acá.
    files: ["src/components/visita-modulos/**/*.{ts,tsx}", "src/components/manual-drawer.tsx"],
    rules: {
      "react-hooks/set-state-in-effect": "error",
    },
  },
  {
    // Un argumento/variable con prefijo `_` es "sin usar a propósito"
    // (firmas de callback, destructuring parcial). Convención estándar.
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
]);

export default eslintConfig;
