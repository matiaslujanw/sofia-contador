# Tracker del MVP

## Entrega inicial

| Prioridad | Fase | Estado | Entregable |
| --- | --- | --- | --- |
| P0 | Fundamentos | Implementado | Next.js, TypeScript, Tailwind, marca SVG, sistema visual oscuro, navegación y selección global |
| P0 | Fundamentos | Implementado, validación externa pendiente | Acceso privado, recuperación, organizaciones, gestión de miembros, RLS y bitácora |
| P0 | Fundamentos | Implementado | Empresas, archivo y reactivación, períodos e historial |
| P0 | Operativo | Implementado | Dashboard del estudio, checklist, tareas por período y herencia de definiciones, cierre y reapertura con registro |
| P0 | Operativo | Implementado, validación externa pendiente | Documentos privados por período, descargas firmadas y vínculos a checklist, comprobantes y obligaciones |
| P0 | Operativo | Implementado con plantillas propias | CSV/XLS/XLSX, mapeo, vista previa, deduplicación y conservación del original para compras, ventas y cuentas |
| P0 | Operativo | Bloqueado por muestras | Validar versiones reales de ARCA y del plan de cuentas Xubio |
| P0 | Operativo | Implementado | Revisión de compras y ventas, registros manuales de pago/cobro y Xubio, sugerencias por contraparte |
| P0 | Operativo | Implementado | Plan por empresa con carga manual, importación, jerarquía y clasificación básica |
| P1 | Control | Implementado parcialmente | Calendario manual, primeros indicadores, alertas determinísticas básicas y consulta de actividad |
| P1 | Publicación | Implementado parcialmente | Diseño adaptable, manifiesto e íconos. Falta validar iPad físico y flujo instalable en destino |

## Diseño y recorrido de demostración

| Prioridad | Estado | Entregable |
| --- | --- | --- |
| P0 | Verificado | Inicio centrado en el avance del mes, pendientes y acceso a los cierres de cada empresa |
| P0 | Verificado | Menú con tareas frecuentes visibles, herramientas secundarias desplegables y navegación adaptable |
| P0 | Verificado | Recorrido de cuatro pasos reanudable y ejercitado sobre los registros de la demo |
| P0 | Verificado | Guía en la aplicación autenticada con próximos pasos según los datos del estudio y explicación de todas las secciones |
| P0 | Verificado | HTML de prueba sin conexión, con archivo de muestra y persistencia durante la sesión |

El ingreso conectado acepta nombre de usuario para cuentas con alias interno y correo para cuentas con buzón real. Los alias se verifican con Supabase Auth y la recuperación por correo requiere un buzón real.

## Trabajo pendiente

| Prioridad | Fase | Estado | Entregable y dependencia |
| --- | --- | --- | --- |
| P0 | Publicación | Pendiente de acceso | Crear proyecto Supabase, configurar Auth/SMTP, aplicar migraciones y verificar dos estudios aislados |
| P0 | Publicación | Pendiente de acceso | GitHub, proyecto en Vercel, variables, HTTPS y verificación del despliegue |
| P1 | Automatización | Pendiente | Cuentas bancarias, saldos, extractos, movimientos manuales y conciliación por cuenta, fecha y moneda |
| P1 | Automatización | Bloqueado por muestras | Adaptador Banco Comafi con extractos PDF de texto, casos sin movimientos y reversos |
| P1 | Automatización | Pendiente | Socios y tipos de financiamiento, respaldos y propuestas de asientos |
| P1 | Automatización | Pendiente | Asientos, líneas, estados, aprobación, prevención de registraciones duplicadas y exportación CSV/XLSX |
| P1 | Automatización | Bloqueado por muestras | Balance, Libro Mayor, listados de asientos y adaptador de exportación Xubio |
| P1 | Control | Pendiente | Papeles de trabajo, reglas por vigencia y jurisdicción, crédito/débito computable, liquidaciones preliminares y Excel |
| P1 | Control | Pendiente | Saldos, flujo de fondos, gastos, costos, créditos, deudas, rentabilidad y alertas adicionales con resolución |
| P2 | Publicación | Pendiente | Auditoría de seguridad integral con el ambiente real, evaluación de rendimiento e instalación en iPad |
| P2 | Futuro | Pendiente | Asistente opcional, permisos de uso de datos y automatización de vencimientos |

## Pruebas y decisiones

- Corrió la prueba de las migraciones y RLS en PostgreSQL 17 con esquemas simulados para los servicios de Supabase. Se verificaron contratos en un PostgREST local.
- Pasaron ESLint, TypeScript, 32 pruebas Vitest y el build de producción. El build sirvió el manifiesto y mantuvo el acceso privado con la demo deshabilitada.
- Pasaron los 10 recorridos Playwright en cada motor, Chromium y WebKit. Se verificó la interfaz en medidas de escritorio, tablet y teléfono. Se corrigió un fallo de WebKit al guardar archivos en IndexedDB y se repitieron la carga, la importación y la descarga.
- El registro de decisiones está en [Decisiones](docs/DECISIONS.md). Pendientes de verificación externa en [Pruebas](docs/TESTING.md).

- En el rediseño pasaron los builds de Next.js y de la demo portable, 32 pruebas unitarias y 13 recorridos Playwright tanto en Chromium como en WebKit. Se revisaron el inicio y el tutorial en anchos de escritorio, tablet y teléfono.

- La guía autenticada pasó las pruebas de progreso, permisos y secciones. Se verificó en navegador con una cuenta conectada, teclado y pantalla móvil.

## Circuito mensual ampliado · noviembre 2026

- Implementada la sección Control mensual con nueve etapas, indicadores de revisión y agregado individual de controles faltantes al checklist existente. Incluye TEM Tucumán con municipio pendiente, sueldos, devengamientos, amortización y verificación Xubio.
- Implementado papel preliminar de IVA ARS y exportación CSV de detalle, resumen y checklist. No constituye liquidación definitiva ni exportador Xubio.
- Requisitos y dependencias de los nueve puntos: [Circuito mensual](docs/MONTHLY_WORKFLOW.md). Los módulos contables del roadmap siguen pendientes; esta entrega organiza y controla el trabajo disponible.
- Validación de esta entrega: ESLint, TypeScript, 42 pruebas unitarias, build de producción y build de demo portable aprobados. Pasaron seis recorridos Playwright en Chromium (dos nuevos y cuatro de regresión). Revisión visual de la demo en escritorio y móvil de 390 px sin desbordamiento horizontal. No se modificó SQL ni se ejecutaron pruebas de integración contra servicios reales.
- Publicación bloqueada: push HTTPS y creación de árbol mediante la conexión GitHub rechazados con 403; la API informa «Resource not accessible by integration». Cambios conservados en la rama local `codex/control-mensual-iva-tem`. No se creó PR ni se modificó la aplicación publicada.

## Identidad rosa pastel

- Reemplazados los acentos morados por rosa pastel `#F5B8D0`: navegación, acciones, inicio, guías, formularios de acceso, gráficos e íconos SVG/PNG (incluido el acceso de iPad).
- Se conserva la estructura oscura y la distinción de estados verde, ámbar y rojo.
- Verificado con ESLint, TypeScript, 42 pruebas unitarias, build Next.js y demo portable. Revisión visual en escritorio y anchos de 820/390 px sin desbordamientos; contraste de texto principal en acciones y selección superior a 9:1. Publicación remota pendiente de resolver el permiso de escritura documentado.

## Libro operativo · 26/11/2026

- Implementado en código: módulo Contabilidad con aperturas únicas y saldos acumulados de clientes/proveedores, cobros y pagos parciales, anticipos y otros movimientos clasificados, devengamientos IVA/IIBB/TEM/sueldos/cargas con obligaciones derivadas en calendario, conciliación individual y control de saldos bancarios, activos y amortización lineal, asientos de comprobantes y manuales, informes de resultado/flujo con gráficos y tabla exacta.
- Implementados comprobantes manuales, importación de aperturas y extractos con mapeo y respaldo, controles de duplicados, anulación auditada y exportación XLS según modelo oficial de Xubio. Falta prueba real de aceptación en Xubio.
- Migración preparada `20261126000100_operating_book.sql`: RPC con bloqueo por empresa, alcance, balance y saldo, RLS y auditoría. Aplicación en Supabase de producción pendiente de acceso; el módulo detecta esa situación sin interrumpir funcionalidades previas.
- Verificación: 54 pruebas unitarias, pruebas SQL de migraciones/RLS/libro y 10 recorridos únicos Playwright en Chromium aprobados. Conexión real ARCA, DDJJ completas, conciliación agrupada y conversiones de moneda siguen pendientes. Ver [circuito](docs/MONTHLY_WORKFLOW.md), [formatos](docs/IMPORT_FORMATS.md) y [pruebas](docs/TESTING.md).
- Los cambios de control mensual y rosa pastel previos ya fueron subidos a main y desplegados en Vercel. El bloqueo de GitHub informado en entradas históricas quedó resuelto al autorizar la integración.

## Inicio por empresa · 26/11/2026

- Inicio simplificado a tarjetas de empresas activas y acción Nueva empresa. Los selectores de mes y los accesos operativos aparecen al entrar en una empresa. La guía inicial automática se conserva dentro del espacio de trabajo; la ayuda sigue disponible desde el encabezado.
- Nueva portada de empresa con accesos a cada tarea, carga y consulta solicitada. Las pestañas de Contabilidad se conservan en la URL y al cambiar de empresa/mes o recargar. Se adaptó el tutorial a la nueva portada.
- Verificado: ESLint, TypeScript, 54 pruebas unitarias, build Next.js y demo portable. Se verificaron 21 recorridos únicos de navegador en Chromium; dos esperas de navegación se ajustaron y los nueve recorridos afectados pasaron al repetirlos. Revisadas las portadas en iPad (820 px) y teléfono (390 px), y el mantenimiento de empresa/mes/pestaña al navegar y recargar.

## Preparación del mes · circuito priorizado

- Nuevo recorrido dentro de cada empresa: plan de cuentas → compras → ventas → PDF Comafi → papel impositivo. Incluye importación en contexto con tipo bloqueado, comprobantes manuales, confirmación persistente de «sin compras/ventas» y guardado directo del PDF como extracto.
- El indicador de compras distingue cero confirmado de documentación pendiente y no presume cero si existen comprobantes de otras monedas.
- Pendientes que requieren muestras: exportación real del plan Xubio, archivos ARCA y resumen PDF de texto Comafi. Falta desarrollar/validar la extracción bancaria y completar el papel fiscal con saldos previos, retenciones, percepciones y ajustes para determinar pagar/a favor. Se conserva el aviso explícito en el recorrido.
- Validado con ESLint, TypeScript, build de producción, 55 pruebas unitarias y tres recorridos de navegador de preparación/importación. Se comprobó además la persistencia del PDF respaldatorio al recargar.

## Cartera individual y medios efectivos

- Cartera con filtros Clientes/Proveedores y detalle acumulado por CUIT; muestra facturas, notas de crédito, aperturas, cancelaciones y saldo. Medio explícito en nuevos cobros/pagos: efectivo, transferencia, tarjeta, cheque u otro. Se conserva «Sin informar» en historia sin ese dato.
- Requisitos incorporados al circuito: obligación y pago separados, movimientos bancarios no fiscales, conciliación mensual y elección futura de amortización anual con control de pendientes. Se agregó registración mensual/anual, mes anual configurable, prorrateo de meses de uso y aviso de cuotas pendientes en Control mensual. Requiere la migración adicional `20261126000200_asset_frequency.sql`.
- Verificación de esta ampliación: 58 pruebas unitarias; pruebas PostgreSQL de mensual/anual, prorrateo y rechazo de cuota fuera del mes; recorridos de cartera, pagos, conciliación, importación y amortización anual en Chromium. Se mantienen pendientes la activación Supabase y las muestras Comafi/ARCA/Xubio para completar el primer circuito fiscal.

## Adaptadores con muestras reales · 26/11/2026

- Validado el diseño del plan Xubio (155 cuentas, 66 sin código) y Mis Comprobantes Recibidos de ARCA (tres compras de octubre): título previo, CUIT propietario, tipos numéricos, moneda e IVA. Se preservan nombres y códigos originales; los faltantes reciben identificador interno estable con advertencia. El rubro deriva de Categoría, no del subtipo bancario Tipo de Cuenta. El servidor y la demo rechazan CUIT de otra empresa al confirmar.
- La empresa todavía no tiene ventas: el recorrido conserva la confirmación explícita por mes. No se generan ventas ni se presume cero por ausencia de archivos.
- Agregado análisis PDF Comafi transitorio con saldos por cuenta/moneda y aviso de mes distinto. Validado el diseño SIN MOVIMIENTOS de tres cuentas (ARS/ARS/USD); las adhesiones y débitos rechazados fuera del detalle se ignoran. Se rechazan saldos incoherentes, duplicados y movimientos efectivos no validados. No se generan asientos ni se completa IVA desde esa lectura. Pendiente muestra con movimientos reales para extracción fiscal.
- Validación: 63 pruebas unitarias, siete recorridos únicos en Chromium (importación nativa con control CUIT, PDF en tablet/portable sin red, preparación con sin actividad y respaldo, dos importadores previos y recorrido portable), ESLint, tipos, build Next.js y demo portable aprobados. La selección ambigua del alert en un recorrido se resolvió acotándolo al main; el resultado final pasó. Sin cambios SQL ni documentos reales en Git, demos o fixtures. Datos reales no importados a producción; activación del libro Supabase sigue pendiente.

## Comafi septiembre con movimientos · 26/11/2026

- Validado un PDF real de septiembre: tres cuentas, 22 movimientos en una ARS y dos cuentas sin actividad. Lectura por coordenadas Débitos/Créditos/Saldo, continuación de referencias e importes, páginas/renglones, fechas y moneda separadas. Saldo inicial + créditos − débitos = cierre y todos los saldos intermedios coinciden. Se contrastaron también los 22 importes mediante Poppler, independientemente del lector unpdf; débitos/créditos coinciden. Regresión privada con octubre: tres cuentas sin movimientos y hash verificado.
- Clasificación sugerida editable: comisiones, intereses, IVA general/reducido, percepción IVA, débitos/créditos, sellos y transferencias pendientes de contraparte. Reglas de retenciones/IIBB cubiertas con datos sintéticos; aún requieren muestras reales. Rechazos y avisos fuera del detalle no se consideran pagos. No se infiere venta ni aplicación a proveedor desde una transferencia.
- Papel bancario CSV con empresa/mes, hash del original, saldos, importes exactos, clasificación y trazabilidad. Descarga y guardado conjunto de PDF y papel mediante Documentación existente; requiere revisión explícita, mes correcto y período abierto, con reinicio de revisión al corregir categoría o cambiar archivo. No genera asientos ni crédito fiscal automáticamente y no requiere nuevas migraciones. La activación del libro Supabase sigue pendiente.
- Verificación: ESLint, TypeScript, 66 pruebas unitarias, build Next.js y demo portable; cuatro recorridos Playwright: lectura en tablet y rechazo de formato ambiguo; archivo portable sin red; guardado/descarga/persistencia con separación de empresas; preparación del mes. Se usan exclusivamente fixtures sintéticos en pruebas y repositorio. El PDF real no se cargó a producción.

## Guardado y recuperación al navegar · 26/11/2026

- Reporte: compras y documentos confirmados aparentaban desaparecer al volver al inicio. Las acciones conectadas no invalidaban las otras rutas del workspace; se agregó revalidatePath sobre /[section] tras escrituras/importaciones exitosas. También se aplica al reintento de importación ya registrada. No se anuncia éxito ni se invalida una escritura fallida.
- Preparación muestra el historial de cargas confirmadas y los originales, con acceso a datos guardados. Plan de cuentas por empresa entre meses, comprobantes por período. La vista previa se identifica como pendiente hasta su confirmación.
- Banco lista los extractos guardados y permite reabrir el análisis desde el original privado, sin pedir volver a subirlo. Recupera las clasificaciones y la revisión desde el último CSV compatible, validando empresa, período, SHA, identificadores, importes y filas contra una lectura nueva del PDF. Un CSV incompatible nunca sustituye importes originales. Reabrir/corregir guarda una nueva revisión sin duplicar el PDF. Las vistas previas no confirmadas siguen siendo transitorias.
- Verificado: 71 pruebas unitarias, incluidos contratos de invalidación en acciones conectadas y rechazo de papeles de otra empresa/PDF/importes. Siete recorridos Chromium cubren compras confirmadas → inicio → regreso → recarga, reapertura bancaria, recuperación y nueva revisión de categorías, persistencia y separación entre empresas, importadores y demo portable. Lint, tipos y build de producción aprobados. Sin cambios SQL, documentos reales ni acceso a registros de producción; no se afirma recuperación de registros reales no consultados.

## Plan de cuentas permanente por empresa · 27/11/2026

- Quitado Plan de cuentas del recorrido mensual; Preparar mes comienza con Compras → Ventas → Banco → Papel impositivo. La sección Plan de cuentas tiene acceso propio y no muestra selector de mes. Portada de empresa separa Datos permanentes de Revisar lo cargado del mes y ofrece acceso a controles pendientes.
- Cuentas ya estaba modelado por empresa, sin period_id; se conserva ese modelo y su integridad. Alta, consulta, edición e inactivación siguen disponibles entre meses. Importar se abre expresamente desde el plan, agrega códigos nuevos y no sobreescribe cuentas existentes. Historial por empresa entre meses; controles de identificadores internos SIN-CODIGO visibles.
- La importación del plan usa el período abierto más reciente solo para conservar original e historial en el esquema actual, independientemente del mes consultado (incluso no iniciado o cerrado). Sin períodos abiertos se informa el requisito del respaldo y se mantiene la edición individual; no se abre/reabre un período automáticamente. El mismo archivo se reconoce por empresa/SHA, sin volver a guardar original ni filas por cambiar de mes. No se borraron ni revisaron registros reales de VigIA; se preparó la revisión sin reinicio destructivo.
- Verificación: 72 pruebas unitarias, incluido alcance empresa/SHA en acción conectada; diez recorridos únicos en Chromium (nueve de regresión y uno nuevo de plan permanente). El nuevo comprueba importación sin período seleccionado existente, uso en otro mes, edición y recarga, cuatro pasos mensuales sin plan, reimportación idempotente que conserva edición y separación de empresas. Se acotó el selector de filas del test a la tabla permanente para distinguirla de la vista previa y pasó al repetir. Lint, tipos, build Next.js y demo portable aprobados. No hay cambios SQL ni muestras reales en pruebas/Git.

## Auditoría mensual de Xubio y lotes de faltantes · 27/11/2026

- Nuevo apartado por empresa/mes, carga y recuperación de Diario/asientos, Mayor y Sumas y Saldos, revisión de alcance y comparación con comprobantes, asientos preparados y Comafi guardados. Reutiliza el plan permanente. Reportes y revisiones se conservan en Documentación privada existente; sin migración nueva.
- Relevamiento inicial de muestras: listado de dos asientos sin líneas, Mayor de una cuenta con rango septiembre/octubre y Sumas y Saldos de catorce cuentas con créditos negativos. Se distingue listado de Diario completo; normaliza el signo solo en Sumas y Saldos y verifica saldos, detalle balanceado y totales entre reportes. Falta un Diario detallado real y prueba de aceptación en Xubio. Los originales temporales dejaron de estar disponibles al reemplazarse el entorno; validación posterior con fixtures sintéticos, no repetición integral de los archivos reales.
- Hallazgos por operación: coincidencia contable revisable, duda por fecha/multiplicidad/agrupación/imputación, posible faltante, preparación pendiente o lote generado. No infiere transferencias como ventas/pagos ni IVA computable desde banco. Bloquea propuestas incompletas, IVA parcial/no definido, tributos sin discriminar, centros de costo no soportados, cuentas ambiguas/ajenas/inactivas y monedas no ARS. Compara amortizaciones/devengamientos preparados en el libro, no obligaciones o documentación ausentes.
- Exportación tras alcance y revisión individual: XLS BIFF8 del modelo oficial, con cuentas/contrapartes e importes exactos, más manifiesto CSV. Consulta fresca de documentos e historial, copia de revisión previa, huella del XLS y exclusión de IDs ya incluidos; recuperación y descarga de lote sin regenerarlo. Reintento idéntico para lotes parciales; operadores concurrentes deben coordinarse, no se afirma bloqueo atómico distribuido. Archivo generado no confirma importación externa; se verifica con Diario actualizado. Informe CSV disponible aun con alcance incompleto.
- Verificado con lint, tipos, build Next.js, build portable y 82 pruebas unitarias. Nueve recorridos únicos Chromium web aprobados, incluidos dos de la auditoría: carga XLSX, alcance, propuesta, guardado/reapertura, archivo XLS/manifest, bloqueo de reenvío y rechazo de listado manual; circuito completo también a 820 px sin desbordamiento. La prueba offline portable adicional quedó bloqueada por la política del Chromium administrado (ERR_BLOCKED_BY_ADMINISTRATOR en file://); no se eludió esa política. No se ejecutó SQL ni se cargaron documentos reales a producción. Detalle en docs/XUBIO_AUDIT.md.

## Libro Diario real con cabeceras por asiento · 27/11/2026

- Validado el nuevo XLSX real: una hoja, ocho asientos/32 renglones, todos balanceados; junio uno/dos, septiembre cinco/23, octubre dos/siete. Cero errores de lectura con el parser final y conceptos conservados en todos los renglones. El original permanece fuera de Git, fixtures y demos.
- Soporte explícito de Documento/Concepto junto a N°, herencia de cabecera y circuito en continuaciones, identidad estable por número/fecha/circuito y referencia legible completa. Se detectan fechas/circuitos nuevos sin identificador, números repetidos con documentos incompatibles y asientos desbalanceados antes del cruce con cuentas.
- Vista de auditoría con conteos por mes y del mes seleccionado. El Diario de varios meses se filtra durante el cruce; no se pide recargar el plan ni recortar el libro. No se confundió balance con completitud ni se generaron faltantes reales sin Mayor/Sumas y Saldos/respaldos disponibles del mismo período.
- Verificado con lint, tipos/build Next.js, 84 pruebas unitarias y dos recorridos de auditoría en Chromium; XLSX sintético nativo de tres meses, fechas Excel, continuación sin cabecera, número repetido válido y casos inválidos, conteo por mes y aislamiento del cruce, reapertura y lote sin reenvío. Sin cambios SQL ni cargas reales a producción.

## Diagnóstico mensual y portada del estudio · 27/11/2026

- Inicio general «Contabilidad - Sofía Luján Contadora Pública», empresas como acceso al trabajo y explicación del recorrido mensual. Identidad compartida en navegación, ingreso, metadatos, manifiesto y demo portable.
- Auditoría con diagnóstico, conteos, próximas tareas enlazadas y detalle de controles: reportes archivados, ausencia explícita de compras/ventas, crédito fiscal, cobertura bancaria, operaciones incompletas/ambiguas/faltantes, lotes generados pendientes de comprobación, impuestos, personal, pagos/deudas, bienes/amortizaciones mensual/anual, conciliación, cuentas corrientes, DDJJ y validación final. Se distinguen comparaciones, declaraciones manuales y límites de alcance. Se señalan declaraciones contradictorias; completar el checklist no oculta diferencias automáticas.
- Comparación exacta de saldos inicial/final Comafi con Sumas y Saldos por cuenta vinculada, moneda extranjera separada y proyección de posibles faltantes ARS seleccionados. Una proyección en cero no confirma registración ni fuerza un ajuste. Exportación de lotes revisados conserva su circuito sin exigir que los demás controles del cierre estén completados.
- Plan CSV descargable y copia privada mensual junto a la revisión/antes del lote. Al reabrir se recalcula con fuentes y datos recuperados; el plan guardado es una instantánea. No se modificaron datos reales ni esquema Supabase.
- Verificado: 92 pruebas unitarias, lint, tipos, build Next.js y build portable (advertencias import.meta existentes de la dependencia PDF). Cinco recorridos únicos Chromium: dos de portada/empresa y responsive 820/390 px; carga/guardado/reapertura/lote Xubio; listado sin detalle bloqueado; PDF Comafi guardado → auditoría bancaria, diferencias y USD separado en iPad. Se corrigieron dos selectores de pruebas (CSV entrecomillado y cuenta bancaria enmascarada) y sus recorridos pasaron al repetir. Inspección visual de tabla/controles en 820 px. No se ejecutó SQL, importación real en Xubio ni auditoría sobre registros de producción.

## Inicio pastel, declaración sin actividad y vencimientos habituales · 27/11/2026

- Retirado el cuadro explicativo del inicio. Tarjetas alternan rosa pastel/lila con texto oscuro y contraste legible; botones, navegación e iconos combinan la paleta conservando estados semánticos.
- Control compartido en Compras y ventas y Preparar mes para confirmar/deshacer meses sin compras o ventas, con persistencia en la tarea existente, historial y alcance empresa/período/dirección. Los filtros no permiten declarar ausencia cuando existen comprobantes. Guardado conectado consulta nuevamente las filas existentes. Se corrigió el tratamiento de una consulta vacía para no rechazar una ausencia válida.
- Calendario con configuración permanente de fechas habituales y previsiones mensuales derivadas de una regla versionada. Conserva día, soporta mes siguiente y meses cortos, sin copiar importes, pagos, presentaciones o documentos. Registrar/ajustar materializa solo el mes seleccionado; excepciones puntuales, actualización del día habitual y desactivación futura conservan historia y cierres. Obligaciones anteriores siguen siendo puntuales hasta activar repetición. Fechas oficiales requieren verificación; una previsión no es obligación de importe conocido ni un pago registrado.
- Persistencia sobre notas estructuradas/versionadas de obligaciones existentes con esquema Zod y límite total 4.000, serialización compartida servidor/demo y permisos/bitácora vigentes. No exige migración, no altera datos reales y no crea períodos al consultar. Otros indicadores conservan su alcance de obligaciones efectivamente registradas. Sin exclusión atómica entre operadores simultáneos.
- Verificación: 98 pruebas unitarias aprobadas entre suite y repetición del caso de servidor corregido. Siete recorridos únicos Chromium aprobados (seis iniciales y repetición del caso de recurrencia tras ajustar la etiqueta de selector): inicio/empresa, 820/390 px, administración, vencimiento puntual, preparación sin actividad, declaración/deshacer desde comprobantes con filtros y persistencia, fecha habitual pagada → febrero corto → excepción → marzo → desactivación → historia/separación entre empresas. Capturas del inicio pastel y calendario revisadas a 820 px. Lint, tipos y builds aprobados; portable mantiene avisos import.meta de unpdf. No SQL, acceso fiscal autenticado ni operación sobre datos de producción.

## Etapa 1 — núcleo contable VIG.IA SAS · 27/11/2026

- Auditoría previa del checkout activo, tecnología, entidades, módulos y brechas; 98 pruebas iniciales aprobadas. Diagnóstico/plan conservados en docs/etapa-1/DIAGNOSTICO.md. El checkout antiguo no se modifica. La usuaria confirma banco para aporte y pago administrativo de las pruebas, y no sabe acceder a Supabase.
- Migración adicional transaccionada, diez tablas, UUID/referencias/RLS/auditoría; sin borrar ni migrar registros anteriores. Plan permanente extendido por perfil 1:1 y equivalencia, jerarquía/nivel derivados. Maestro único cliente/proveedor por CUIT evita duplicación; bancos y vínculos preparados, sin presentar sus futuras interfaces como terminadas.
- Confirmación RPC central, líneas exactas y balanceadas, período/ejercicio abierto, cuenta imputable/propia/activa, numeración serializada, origen único, SHA-256 canónico, duplicado revisable y excepción registrada. Confirmados inmutables; reversión con motivo y vínculo al original. Constraint diferido detecta cabeceras incompletas incluso en mantenimiento. No se exige aplicar el libro JSON anterior para usar el nuevo núcleo.
- Dashboard, Diario, Mayor y sumas/saldos funcionales, lectura única de líneas confirmadas con índices por cuenta/asiento, arrastre del mismo ejercicio y naturaleza, mes/trimestre calendario/ejercicio, CSV, respaldos y configuración del plan. Menú solicitado convive con herramientas existentes; integraciones bancarias/impositivas/estados muestran pendiente. Ninguna incorporación automática de compras, ventas, eventos anteriores, ni integración nueva de Auditoría Xubio en esta etapa.
- Pruebas: 107 unitarias; PostgreSQL nativo 17.12 con siete migraciones, pruebas previas/nuevas, cinco operaciones, RLS/roles/cierres/reversión/inmutabilidad/rollback y dos conexiones concurrentes; nueve recorridos Chromium únicos nuevos/regresión, incluido respaldo vinculado y tamaños 1440/820/390 px. Detalle y valores en docs/etapa-1/ENTREGA.md y docs/TESTING.md. Se mantienen importes/documentos reales fuera de fixtures/Git y producción.
- Activación de Supabase y aceptación con sesión/PostgREST/Storage reales pendientes: no hay conexión administrativa en esta sesión. Se entrega migración revisable/descargable e instrucciones de identificación del proyecto. Un despliegue Vercel no activa SQL. No se afirma que el núcleo esté habilitado para datos reales ni que la contabilidad de VIG.IA haya sido auditada. Próxima etapa no iniciada.
