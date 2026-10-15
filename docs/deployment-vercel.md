# Despliegue del frontend MAIA 2.0 en Vercel

## Arquitectura

- Frontend: React + TypeScript + Vite, publicado como SPA estática en Vercel.
- Backend: Spring Boot en Render, fuera de este repositorio.
- Base de datos: PostgreSQL administrado por el backend.
- Autenticación: JWT emitido y validado por el backend. Las comprobaciones de rol del frontend solo controlan navegación y presentación; el backend debe autorizar cada endpoint.

## Preparación local

```powershell
node --version
npm --version
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Node debe ser 22.x. Para desarrollo local se puede omitir `VITE_API_BASE_URL`: Vite usa el proxy `/api` hacia `http://localhost:8080`. También puede definirse una URL explícita en `.env.local`.

## Verificación antes del despliegue

```powershell
npm run lint
npx tsc -b
npm test
$env:VITE_API_BASE_URL = "https://backend-real.onrender.com"
npm run build
npm run preview
```

Reemplace el ejemplo por la URL real de Render. El build falla deliberadamente si la variable falta, usa HTTP o apunta a localhost. La salida esperada es `build/`.

## Configuración del proyecto en Vercel

Al importar el repositorio conectado a GitHub, use:

| Ajuste | Valor |
|---|---|
| Framework Preset | Vite |
| Root Directory | `MAIA-PdG-Frontend-main` (la raíz Git actual está un nivel arriba) |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | `build` |
| Node.js Version | `22.x` |

Los comandos y la salida también están fijados en `vercel.json`; `package.json` fija Node 22.x. El fallback SPA excluye `/api`, por lo que una llamada relativa equivocada al frontend no termina recibiendo `index.html`.

### Variables de Production y Preview

En **Project Settings → Environment Variables**, agregue:

```text
VITE_API_BASE_URL=https://nombre-real-del-backend.onrender.com
```

- Production: use el backend productivo de Render.
- Preview: use un backend de pruebas si existe. Si se usa el backend productivo, su CORS debe permitir los dominios Preview correspondientes y se debe aceptar conscientemente que previews consuman datos reales.
- Development en Vercel: configure la variable solo si usa `vercel dev`; para `npm run dev` puede usarse el proxy local.

Cambiar una variable no modifica despliegues anteriores. Después de actualizarla, genere un nuevo deployment.

## Dominio final y CORS en Render

Después del primer deployment, Vercel muestra el dominio estable del proyecto en **Settings → Domains**, por ejemplo `https://maia-frontend.vercel.app`. Configure ese origen exacto en el backend:

```text
CORS_ALLOWED_ORIGINS=https://maia-frontend.vercel.app
```

Si existe dominio propio, agréguelo también. Use orígenes completos separados según el formato esperado por el backend y no incluya rutas. El backend debe permitir al menos `Authorization` y `Content-Type`, y los métodos REST realmente usados. No use `*` junto con credenciales.

Los deployments Preview reciben dominios variables. La opción más segura es autorizar un dominio de preview controlado o un backend de staging. Si el backend implementa patrones de origen, limítelos al proyecto/equipo de Vercel; no abra CORS a todos los orígenes.

## Enrutamiento SPA

`vercel.json` reescribe rutas de React Router a `/index.html`, salvo `/api` y sus descendientes. Esto permite abrir o refrescar directamente `/login`, `/dashboard`, `/library`, `/collections`, `/profile`, `/analytics` y las demás rutas del cliente. Los archivos existentes se resuelven antes del fallback y `/assets` se sirve con caché inmutable.

## Lista de verificación de integración

Estado local significa que la estructura/configuración fue verificada sin un backend público. Los escenarios de integración permanecen pendientes hasta disponer de las URLs y cuentas reales.

| Verificación | Estado antes del deployment |
|---|---|
| Vercel sirve el frontend y los assets | Pendiente: requiere deployment |
| Rutas públicas `/login` y `/register` | Implementado localmente; pendiente en Vercel |
| Refresh de rutas SPA sin 404 | Configurado; pendiente en Vercel |
| Requests usan el backend Render correcto | Configurado por variable; pendiente URL real |
| Comunicación HTTPS | Exigida por build; pendiente backend real |
| CORS acepta el dominio final | Pendiente configuración del backend |
| Login y logout | Cubiertos localmente; pendiente cuenta real |
| Persistencia y expiración de JWT | Cubierto localmente; pendiente token real |
| Roles y rutas protegidas | Cubierto localmente; autorización final corresponde al backend |
| Biblioteca AIAS | Pendiente backend real |
| Favoritos y colecciones | Pendiente backend real |
| Chatbot e historial | Pendiente backend/servicio de IA real |
| Solicitudes de apoyo | Pendiente backend real |
| Notificaciones y encuestas | Pendiente backend real |
| Analítica y administración | Pendiente backend y usuarios autorizados |
| Errores de API se muestran sin detalles internos | Implementado localmente; pendiente fallo real |
| Ninguna llamada productiva usa localhost | Validado por configuración/build |
| No hay secretos en el bundle | Revisado en fuente; repetir inspección del deployment |

## Solución de problemas

### El build indica que falta `VITE_API_BASE_URL`

Defina la variable para el ambiente que está desplegando y vuelva a desplegar. No agregue una URL fija al código.

### Aparece `/api/api` en Network

Use el origen (`https://host`) como variable. Aunque el frontend elimina un `/api` final por compatibilidad, no incluya rutas adicionales.

### Un refresh devuelve 404

Confirme que Vercel tomó `vercel.json`, que Root Directory apunta a esta carpeta y que `build/index.html` existe en el artefacto.

### El navegador muestra un error CORS

Confirme el origen exacto en la barra de direcciones, agréguelo a `CORS_ALLOWED_ORIGINS` del backend y reinicie/republique el servicio Render. CORS se corrige en el backend, no con encabezados enviados por React.

### Login expira o redirige a `/login`

Revise en Network el estado del endpoint `/api/users/me`. Un 401 elimina el token y la sesión local; un rol desconocido o ausente también se rechaza. Verifique reloj, expiración y roles emitidos por el backend.

### Render tarda o la solicitud agota el tiempo

El cliente cancela solicitudes después de 15 segundos y muestra un mensaje genérico. Revise logs y estado del servicio Render; los planes con suspensión pueden requerir calentamiento.

### Cypress no puede iniciar

La suite E2E requiere el binario de Cypress, frontend y backend activos y credenciales definidas a partir de `cypress.env.json.example`. En CI, inicie ambos servicios o apunte de forma explícita a un ambiente de pruebas.
