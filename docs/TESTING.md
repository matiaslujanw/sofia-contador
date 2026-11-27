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

## Comafi con movimientos

66 pruebas unitarias y cuatro recorridos Chromium aprobados. Se cubren columnas geométricas, referencias/importes en segundo renglón, categorías, créditos/reversos, saldos intermedios y finales, fechas, ausencia de columnas/montos, CSV seguro, mes distinto, corrección de categoría que invalida revisión, hash del PDF, guardado del original y papel, contenido CSV conservado tras recarga y separación de empresas. La demo portable se recompila y lee PDF de texto sin red. El recorrido de preparación previo también pasa. Lint, tipos y build Next.js aprobados; sin cambios SQL.

Validación privada adicional: septiembre con 22 movimientos y octubre sin actividad. Un segundo lector (Poppler) recuperó los mismos 22 importes y totales de débitos/créditos. No hay documentos reales en fixtures, demos ni Git. Todavía no se probó guardado con una sesión Supabase de producción, PDF escaneado, compatibilidad universal con otras variantes Comafi, retenciones/IIBB reales o aceptación de asientos en Xubio. El papel no contabiliza ni determina crédito fiscal.

## Persistencia al regresar al inicio

71 pruebas unitarias y siete recorridos Chromium aprobados. Las acciones Supabase se prueban con dobles de acceso/Storage/RPC para verificar que una subida/importación/cambio exitoso invalida /[section] antes de devolver éxito y un fallo no lo hace. No reemplaza una prueba con sesión y datos de Supabase de producción. El recorrido de compras confirma, vuelve al inicio, reabre Preparación, recarga y verifica el comprobante y su original en el historial. El bancario guarda, sale al inicio, reabre el original privado, recupera la clasificación revisada, corrige, guarda otra revisión y la recupera tras recarga sin duplicar el PDF. También se verifican separación de empresas y descarga de papeles. Los tests de recuperación rechazan CUIT, hash o importes distintos del PDF.

Build Next.js, lint y tipos aprobados; la prueba portable recompila la demo y verifica lectura sin red. No cambió SQL. Los fixtures son sintéticos. No se consultaron registros reales de la persona usuaria ni se certificó su recuperación; se corrigieron la invalidación de vistas y la reanudación del trabajo guardado.

## Plan único por empresa

72 pruebas unitarias y diez recorridos únicos en Chromium aprobados. El caso nuevo de tablet importa el plan desde la sección propia con un mes no iniciado en la URL, consulta otro mes, modifica el nombre de una cuenta, recarga, abre el circuito mensual que empieza por compras, reintenta el mismo archivo y verifica que no duplica cuenta/original ni sobreescribe la edición. Comprueba aislamiento por empresa. El primer selector también encontraba la vista previa; se restringió a Plan permanente y el caso pasó. Los nueve de regresión de inicio, preparación, ARCA, Xubio y PDF también pasaron. El contrato de acción conectada comprueba deduplicación por company_id/SHA en lugar de period_id, sin otra subida o RPC si el archivo ya existe.

Tipos, lint, build Next.js y demo portable verificados. Sin cambios SQL; no se ejecutó un reinicio ni se inspeccionaron registros reales de VigIA. El plan existente no se borra y los nombres/códigos/referencias originales se conservan. Se documentó el requisito heredado de un período abierto para archivar originales de importaciones; la administración individual de cuentas es por empresa.

## Auditoría mensual de Xubio

82 pruebas unitarias aprobadas: listado manual incompleto, Mayor con saldo inicial y rango amplio, Sumas y Saldos con créditos negativos, aritmética y filtros inconsistentes, nombres/códigos ambiguos, Diario balanceado, coincidencias por fecha/vector, multiplicidad, agrupaciones bancarias/de comprobantes, otra imputación de una misma salida, propuestas de comprobante/IVA/proveedor con organización y restricciones fiscales, alcance de cuentas/moneda, exclusión de IDs exportados, revisiones con huella de fuentes, límites de filas, manifiesto/hash/XLS determinista y consulta de documentos de otra empresa rechazada. Se reutilizan fixtures sintéticos; no hay archivos reales en Git o demos.

Nueve recorridos únicos web pasaron en Chromium: dos de la auditoría, dos de portada por empresa, dos bancarios web, preparación mensual y dos importadores previos. La auditoría completa se repitió a 820 px con carga de tres XLSX, controles, revisión persistida, selección, generación y lectura del XLS según modelo, guardado de lote/control y reapertura sin proponer reenvío. El listado manual sin líneas no habilita exportación. ESLint, tipos y builds Next.js/portable aprobados.

El décimo recorrido intentado (HTML portable offline) fue bloqueado por la política del navegador administrado al abrir file://, ERR_BLOCKED_BY_ADMINISTRATOR; la prueba no alcanzó el código de la app y no se evadió la restricción. Se admite PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH para usar el ejecutable disponible, conservando sus políticas. No se probó guardado con sesión Supabase de producción ni aceptación/importación dentro de Xubio; no se certificó una auditoría real con los archivos incompletos. Leer XUBIO_AUDIT.md para evidencia, alcance y límites.

## Diario nativo con múltiples meses

84 pruebas unitarias aprobadas, con dos casos nuevos de N°/Fecha/Documento/Concepto/Año/Mes: fechas Excel y cabeceras parciales conservadas; meses separados para el cruce; número repetido sin repetir concepto; detección de desbalance, cambio de fecha sin referencia y número con documento incompatible. El recorrido de exportación ahora usa un XLSX nativo sintético de tres meses y comprueba que el conteo y el cruce seleccionen solo un mes, con guardado/reapertura, XLS y exclusión del lote ya generado. Pasaron los dos recorridos de auditoría en Chromium (tablet a 820 px), lint y tipos/build. Se leyó el XLSX real en privado: ocho asientos, 32 líneas, cero errores, todos balanceados; cinco asientos y 23 líneas de septiembre. No hubo cruce integral con otras muestras ausentes del entorno ni exportación real de faltantes. Sin datos reales en Git/fixtures.

## Plan de trabajo mensual e identidad del estudio

92 pruebas unitarias aprobadas: ocho del diagnóstico cubren documentos ausentes frente a ausencia de actividad declarada, contradicciones, alcance estudio/empresa/mes, guardado de reportes, saldo inicial, comparación/proyección exacta sin confirmar importación, moneda extranjera separada, límites del libro operativo, cuota mensual/anual, personal y CSV. Cinco recorridos únicos de Chromium aprobados: portada con la nueva identidad y navegación, responsive 820/390 px, auditoría con persistencia/CSV/lote, rechazo del listado sin detalle y PDF Comafi → tabla bancaria con diferencia y USD separado a 820 px. Se revisó una captura de los controles/tablet; la tabla bancaria conserva desplazamiento horizontal. Lint, TypeScript, build Next.js y build portable aprobados; este último mantiene los avisos import.meta de unpdf. No se repitió el flujo offline bloqueado por la política del navegador, ni se afirma validación de producción/Supabase o importación en Xubio.

## Sin actividad y vencimientos habituales

98 pruebas unitarias: cinco nuevas sobre proyecciones de calendario (mes corto/bisiesto/cambio de año, fecha en mes siguiente, regla frente a excepción/baja, datos mensuales no heredados, aislamiento, historia/cierres, notas y límites) y una de servidor para validar comprobantes antes de aceptar ausencia. La prueba del servidor detectó y permitió corregir el rechazo incorrecto de una consulta vacía; pasó al repetir.

Siete recorridos únicos Chromium aprobados, incluidos dos nuevos para declaración/deshacer desde comprobantes y recurrencia completa con febrero, excepción, baja, pago histórico y aislamiento; regresiones de preparación, inicio/responsive y administración. La recurrencia pasó tras ajustar un selector de prueba que exigía una etiqueta exacta en el select de estado. Se inspeccionaron capturas del inicio rosa/lila y calendario a 820 px. No se modificó SQL ni se verificaron escrituras con una sesión de producción. Lint, tipos y builds Next.js/portable aprobados; los avisos de empaquetado PDF existentes permanecen.
