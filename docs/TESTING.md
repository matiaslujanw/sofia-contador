# Pruebas

- `npm run lint` verifica el código y falla ante advertencias.
- `npm run typecheck` genera tipos de rutas y valida TypeScript estricto.
- `npm test` ejecuta Vitest. Cubre exactitud monetaria, período local, indicadores, firmas de recuperación y permisos de demo, lectura de planillas, fechas, mapeo y notas de crédito.
- `npx playwright install chromium` instala el navegador de pruebas. `npm run test:e2e` arranca o reutiliza el servidor local de demo en el puerto 3107. Usá un puerto libre y evitá que otro proyecto ocupe ese puerto. Los archivos de prueba son sintéticos.
- `supabase/tests/run-postgres.sh` inicia un PostgreSQL aislado y aplica las migraciones sobre esquemas simulados de Auth y Storage. Prueba identidades, separación entre organizaciones, roles, integridad, bitácora, cierre, importación y reglas de imputación. Requiere las herramientas de PostgreSQL en el PATH.
- Para repetir los recorridos en WebKit, ejecutá `npx playwright install webkit` y `npm run test:e2e -- --browser=webkit`. La cobertura responsive usa tamaños de tablet y móvil.
- `npm run build` compila el proyecto con el flujo de producción de Next.js.

## Validación del entorno conectado

Creá dos organizaciones de prueba y miembros con diferentes roles. Comprobá acceso propio, rechazo de operaciones cruzadas, ingreso desde HTTPS, cookies renovadas, cierre de sesión, entrega del correo de recuperación y vencimiento del enlace firmado de Storage. Subí un documento sintético, verificá descarga autorizada y confirmá que otro estudio carece de acceso. Registrá el resultado en el tracker.

Para admitir archivos de ARCA, Comafi y Xubio, repetí con muestras no sensibles, contrastá totales y saldos con el sistema de origen y documentá la versión del formato. En iPad físico comprobá navegación, fecha/período, carga desde Archivos, lectura y descarga.
