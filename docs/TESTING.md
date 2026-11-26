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

## Libro operativo (26/11/2026)

54 pruebas unitarias aprobadas, incluyendo saldos con notas de crédito y pagos parciales, sobrepagos, alcance, signos conciliatorios, transferencias entre dos cuentas, amortización y residual, flujo frente a devengado, IVA no computable, modelo Xubio BIFF8, aperturas importadas y saldos por cuenta bancaria. Se ejecutaron las migraciones y las pruebas anteriores de RLS más `operating-book.sql` en un PostgreSQL local embebido con Auth/Storage simulados. Se verificaron rechazo de cuentas cruzadas, duplicados, fechas fuera del mes, sobrepagos, escritura viewer, lectura de terceros, asientos desbalanceados, cuotas repetidas y cambios en meses cerrados.

Pasaron 10 recorridos únicos en Chromium: cuatro del libro (alta manual, TEM/pago parcial/conciliación/exportación, amortización en iPad e importación de apertura con original) más seis de regresión del workspace y calendario. Revisión visual de demo a 820 px. ESLint, TypeScript, Next.js y demo portable se verifican antes de publicar. Supabase real y aceptación del XLS dentro de Xubio requieren comprobación posterior.

## Inicio por empresas

Dos recorridos nuevos comprueban el inicio sin indicadores ni herramientas globales, la entrada por empresa, el enlace directo a una pestaña contable, el cambio de empresa, la recarga y las pantallas de 820/390 px. Los recorridos del workspace y del tutorial se adaptaron a la portada de Empresas. Al persistir pestañas en la URL, los tests esperan la pestaña seleccionada y el paso visible antes de continuar. Se verificaron los 21 recorridos únicos en Chromium (los nueve de navegación/libro/tutorial pasaron en la repetición posterior a esos ajustes), junto con 54 pruebas unitarias, tipos, lint y builds. Esta entrega modifica navegación y presentación; no cambia el esquema de Supabase.

## Adaptadores nativos y PDF Comafi

63 pruebas unitarias aprobadas. Se agregaron casos sintéticos de Xubio con códigos ausentes y subtipo bancario, ARCA con título/CUIT/IVA, y Comafi sin movimientos, saldos incoherentes, duplicados, movimientos y avisos rechazados. Siete recorridos únicos de navegador aprobados: preparación, dos importadores existentes, importación nativa con rechazo de CUIT ajeno y confirmación válida, PDF en tablet, PDF portable sin red y tutorial portable. Se corrigió un selector de alert ambiguo en el test de tablet; los dos recorridos PDF pasaron tras el ajuste. Se verificaron lint, tipos, build de producción y demo portable; el empaquetado IIFE informa advertencias import.meta de la dependencia PDF en rutas opcionales, y el PDF de texto fue probado sin conexión.

Validación privada de muestras de noviembre de 2026: plan Xubio 155 filas/0 errores, ARCA recibidos tres filas de octubre/0 errores, Comafi tres cuentas sin movimientos con saldos iguales. Las muestras no se conservaron en el repositorio ni se cargaron en la base publicada. No se verificó aceptación de archivos dentro de Xubio ni extracción de renglones bancarios con cargos efectivos. No cambió SQL.
