# Pruebas

- `npm run lint` verifica el código y falla ante advertencias.
- `npm run typecheck` genera tipos de rutas y valida TypeScript estricto.
- `npm test` ejecuta Vitest. Cubre exactitud monetaria, período local, indicadores, firmas de recuperación y permisos de demo, lectura de planillas, fechas, mapeo y notas de crédito.
- `npx playwright install chromium` instala el navegador de pruebas. `npm run test:e2e` arranca o reutiliza el servidor local de demo en el puerto 3107. Usá un puerto libre y evitá que otro proyecto ocupe ese puerto. Los archivos de prueba son sintéticos.
- `supabase/tests/run-postgres.sh` inicia un PostgreSQL aislado y aplica las migraciones sobre esquemas simulados de Auth y Storage. Prueba identidades, separación entre organizaciones, roles, integridad, bitácora, cierre, importación y reglas de imputación. Requiere las herramientas de PostgreSQL en el PATH.
- Los recorridos del onboarding prueban reanudación, avance real de una tarea, apertura de un comprobante y descarga e importación de un CSV. Uno genera un HTML portable independiente y completa el circuito con las solicitudes de red deshabilitadas.
- Para repetir los recorridos en WebKit, ejecutá `npx playwright install webkit` y `npm run test:e2e -- --browser=webkit`. La cobertura responsive usa tamaños de tablet y móvil.
- `npm run build` compila el proyecto con el flujo de producción de Next.js.

## Validación del entorno conectado

Creá dos organizaciones de prueba y miembros con diferentes roles. Comprobá acceso propio, rechazo de operaciones cruzadas, ingreso desde HTTPS, cookies renovadas, cierre de sesión, entrega del correo de recuperación y vencimiento del enlace firmado de Storage. Subí un documento sintético, verificá descarga autorizada y confirmá que otro estudio carece de acceso. Registrá el resultado en el tracker.

Para admitir archivos de ARCA, Comafi y Xubio, repetí con muestras no sensibles, contrastá totales y saldos con el sistema de origen y documentá la versión del formato. En iPad físico comprobá navegación, fecha/período, carga desde Archivos, lectura y descarga.

## Control mensual e IVA preliminar

Se agregaron cuatro pruebas unitarias de aislamiento por estudio/empresa/período, crédito indefinido frente a cero, notas de crédito, exclusión de otras monedas, centavos grandes y CSV con fórmulas neutralizadas. La suite completa pasa 42 pruebas. Dos recorridos nuevos en Chromium verifican agregado/persistencia de TEM, descarga IVA, consulta móvil, período cerrado y período sin iniciar; pasan junto con cuatro recorridos existentes del workspace. Builds Next.js y portable aprobados; revisión visual del portable en escritorio y 390 px. Integraciones ARCA/Xubio y entorno Supabase real quedan fuera de esta validación.
