# Entorno local (Supabase en Docker)

Base de datos, autenticación y storage locales con datos de prueba, para trabajar sin tocar producción.

## Requisitos

- Docker Desktop en ejecución.
- Supabase CLI (`brew install supabase/tap/supabase`).
- `jq` (opcional, para los comandos de verificación).

El proyecto local se llama `eyc` y usa los puertos **553xx** para no chocar con otros proyectos Supabase de la máquina:

| Servicio      | URL                                                     |
| ------------- | ------------------------------------------------------- |
| API / Auth    | http://127.0.0.1:55321                                  |
| Postgres      | postgresql://postgres:postgres@127.0.0.1:55322/postgres |
| Studio        | http://127.0.0.1:55323                                  |
| Correo (test) | http://127.0.0.1:55324                                  |

> Solo se trabaja contra el stack local. No usar `supabase link`, `db push` ni `--linked`.

## 1. Levantar el stack

```bash
supabase start
```

La primera vez aplica todas las migraciones de `supabase/migrations/` y carga `supabase/seed.sql`.

## 2. Variables de entorno de la app

`.env.local` apunta a producción y no se modifica. En desarrollo, Next.js da prioridad a `.env.development.local`, así que basta con crear ese archivo (ya está cubierto por `.gitignore`):

```bash
supabase status -o env
```

Copiar los valores en `.env.development.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:55321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY>
SUPABASE_JWT_SECRET=<JWT_SECRET>
```

Luego `npm run dev`.

## 3. Usuarios de prueba

Contraseña para todos: `eyc-local-123`

| Correo                  | Cargo         | Notas                                  |
| ----------------------- | ------------- | -------------------------------------- |
| `coordinador@eyc.local` | `coordinador` | Admin, tiene `titulo_firma`            |
| `tecnico@eyc.local`     | `tecnico`     | Técnico asignado a la visita de prueba |
| `programador@eyc.local` | `programador` | Admin                                  |

## 4. Datos de prueba

Todos los datos son ficticios. El seed crea:

- Un cliente con una sede en Medellín y una sala de RX convencional (sistema CR "Digitalizado"). `ubicacion_fisica` es una oración completa terminada en punto (caso del #197).
- Un equipo `CONVENCIONAL` con valores base del año anterior.
- Una solicitud en `ejecucion` y una visita `en_progreso` asignada a `tecnico@eyc.local`, con datos capturados en las 21 pruebas (2.1 a 2.21) y las 21 secciones del pre-informe incluidas. Se puede generar el pre-informe directamente.
- Valores con decimales para probar el formato de números (#199): colimación 9.0/8.5 y 7.0/6.5, técnicas de 2.5 mAs / 12.5 mA / 0.125 s, sala de 3.45 m, factor de uso 0.25 y cargas CAE alrededor de 0.25 mAs.

Los catálogos (`rol_permisos`, `prueba_definiciones`, `grupo_pruebas`) no se cargan en el servidor: la app los crea en IndexedDB al iniciar (`src/lib/db/seed.ts`).

## 5. Volver a un estado limpio

```bash
supabase db reset
```

Borra la base local, reaplica las migraciones y vuelve a cargar el seed. Las modificaciones hechas desde la app se pierden.

## 6. Firmas del coordinador y del Director Técnico (opcional)

`usuarios.firma_url` guarda un path del bucket `evidencias`, y el archivo no se puede crear desde SQL, así que el seed la deja vacía. Para probar la firma en el informe, subir cualquier PNG y enlazarlo (repetir después de cada `db reset`):

```bash
SRK=$(supabase status -o env | rg '^SERVICE_ROLE_KEY=' | sd '^SERVICE_ROLE_KEY="?([^"]*)"?$' '$1')
curl -s -X POST "http://127.0.0.1:55321/storage/v1/object/evidencias/firmas/coordinador-local.png" \
  -H "Authorization: Bearer $SRK" -H "apikey: $SRK" -H "Content-Type: image/png" -H "x-upsert: true" \
  --data-binary @ruta/a/firma.png
docker exec supabase_db_eyc psql -U postgres \
  -c "update usuarios set firma_url='firmas/coordinador-local.png' where email='coordinador@eyc.local'"
```

El Director Técnico no es un usuario: sus datos viven en la fila única de `configuracion_informe` (el seed pone un nombre y título ficticios). Su firma se puede cargar desde la app (Configuración → Informe, como coordinador) o con el mismo procedimiento, subiendo a `firmas/director-local.png` y enlazándola así:

```bash
docker exec supabase_db_eyc psql -U postgres \
  -c "update configuracion_informe set director_firma_url='firmas/director-local.png' where id='global'"
```

## 7. Importante: IndexedDB y producción

La app es offline-first y guarda los datos en IndexedDB del navegador. Si ese navegador ya sincronizó contra producción, al apuntar al entorno local mezclaría datos de ambos y podría intentar subir registros de producción a la base local (o al revés si se vuelve a cambiar).

Antes de usar el entorno local:

- Usar un **perfil de navegador separado** (recomendado) o una ventana privada, o
- Borrar los datos del sitio `localhost:3000` (DevTools → Application → Storage → _Clear site data_), lo que incluye IndexedDB y el service worker.

Hacer lo mismo al volver a producción.

## 8. Verificación rápida

```bash
ANON=$(supabase status -o env | rg '^ANON_KEY=' | sd '^ANON_KEY="?([^"]*)"?$' '$1')
curl -s -X POST "http://127.0.0.1:55321/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d '{"email":"coordinador@eyc.local","password":"eyc-local-123"}' | jq '.user.email'
```

## Notas técnicas

- La migración `003_seed_tecnicos.sql` solo inserta los técnicos si su usuario existe en `auth.users`; en una base nueva no existen y se omite.
- Las imágenes recientes de Supabase ya no otorgan permisos del Data API a `anon`/`authenticated` sobre tablas nuevas. El seed otorga esos `GRANT` en local (se asume que producción, al ser un proyecto anterior, ya los tiene; no está verificado). RLS sigue aplicando igual.
