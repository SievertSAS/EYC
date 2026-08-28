// Archivo de setup global de Vitest — se ejecuta una vez antes de cada
// archivo de test (referenciado en vitest.config.ts -> test.setupFiles).
//
// Qué hace:
//  1. Enchufa @testing-library/jest-dom para habilitar matchers legibles
//     sobre el DOM: toBeInTheDocument(), toBeDisabled(), toHaveValue(),
//     toHaveTextContent(), etc. Sin esto, los tests caen en aserciones
//     crudas tipo `expect(el.disabled).toBe(true)`.
//  2. Corre cleanup() de @testing-library/react después de cada test para
//     desmontar los componentes montados y evitar que el DOM de un test
//     se filtre al siguiente (happy-dom no aísla entre tests por sí solo).
//
// fake-indexeddb/auto se sigue cargando aparte, primero en la lista de
// setupFiles, para que el polyfill de IndexedDB esté disponible antes de
// que cualquier import toque Dexie.

import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});
