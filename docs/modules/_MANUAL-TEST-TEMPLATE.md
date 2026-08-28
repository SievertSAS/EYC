# Prueba manual: `<módulo>` — `<escenario ID>`

> Ejecutado por: `<nombre>` · Fecha: `<fecha>` · Build/commit: `<sha>`

## Precondiciones

- Estado semilla: `<qué seed / reset se usó>`
- Rol logueado: `<coordinador | programador | tecnico | comercial>`
- DevTools → Network: `<Online | Offline | throttle>`
- Perfil(es) de navegador: `<uno | dos perfiles para test de concurrencia>`

## Pasos y resultado esperado

| # | Paso (acción UI) | Esperado UI | Esperado Dexie (`SievertEyC`) | Esperado servidor (Supabase) |
|---|---|---|---|---|
| 1 | | | fila `<tabla>#<id>`: `<estado>` / `sync_status=<>` | fila coincide con local / n/a offline |
| 2 | | | | |

## Resultado real

| # | ¿Coincide? | Observación |
|---|---|---|
| 1 | ✅ / ❌ | |
| 2 | | |

## Veredicto

- [ ] Escenario pasa tal como se esperaba
- [ ] Pasa con desviación menor (anotar arriba)
- [ ] Falla → hallazgo `#<n>` (link al issue / test que lo reproduce)

## Notas / evidencia

`<capturas, dumps de IndexedDB, logs del logger, etc.>`
