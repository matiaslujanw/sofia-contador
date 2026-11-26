# Circuito mensual solicitado

Alcance: contabilidad de varias empresas argentinas, con operaciones en Tucumán y obligación municipal TEM cuando corresponda. El municipio, régimen y vigencia se verifican por empresa. El destino de registración definitiva es Xubio.

## Entrega: Control mensual

La sección **Control mensual** conserva la empresa y el mes seleccionados. Reúne nueve etapas, muestra los controles existentes y permite agregar cada control faltante al checklist mediante el flujo autorizado de tareas. No altera tareas previas ni agrega controles automáticamente a meses cerrados. Una persona con permiso de consulta puede revisar y exportar; agregar requiere empresa activa y período abierto. Los estados se editan desde **Cierre mensual** y se heredan según el circuito existente.

Detecta comprobantes sin aprobar, sin cuenta, compras ARS sin IVA computable definido y registros sin marcar en Xubio. Estas cantidades no representan saldos contables ni prueban una importación en Xubio.

El papel preliminar de IVA distingue IVA informado, débito de ventas aprobadas y crédito computable explícito de compras aprobadas. Un crédito nulo significa pendiente; cero es una decisión explícita. Los cálculos usan centavos enteros y conservan signos de notas de crédito. Solo suma ARS: otras monedas requieren conversión fiscal y revisión. La diferencia es un subtotal parcial, sin saldos anteriores, retenciones, percepciones, ajustes ni IVA bancario que no se haya documentado. No determina DDJJ ni obligación de pago.

Se descargan checklist, detalle y resumen IVA en CSV UTF-8 con BOM, separador punto y coma, decimales con punto y celdas entre comillas. Los textos que puedan ejecutarse como fórmulas se neutralizan. El detalle conserva identificador, moneda, cotización, componentes e inclusión o exclusión de cada comprobante. Son formatos propios para revisión; todavía no son importadores validados de Xubio.

## Requisitos de los módulos siguientes

| Etapa | Comportamiento requerido | Estado y dependencia |
| --- | --- | --- |
| Vencimientos | Consultar fuente oficial por CUIT, impuesto, régimen, jurisdicción y período; conservar fuente y fecha de consulta. Distinguir período fiscal de mes de vencimiento y presentación de pago. | Calendario manual existente. Automatización ARCA pendiente de mecanismo autorizado y fuente verificada. IIBB corresponde a DGR y TEM al municipio. |
| Cuentas corrientes | Clientes/proveedores, saldos de apertura, débitos/créditos, vencimientos, anticipos, imputaciones parciales, notas de crédito y saldo final por moneda. Carga manual e importación sin duplicar desde Xubio. | Pendiente. Solicitar exportaciones sanitizadas y definir claves estables. |
| Documentación fiscal | Compras ARCA y manuales ausentes en origen, ventas y extractos. Separar comisiones, intereses, IVA, retenciones y percepciones de IVA/IIBB; controlar crédito computable y duplicación de cargos facturados. | Importación de compras/ventas con mapeo existente. Alta manual de comprobantes, movimientos bancarios y papeles completos pendientes. |
| Clasificación y asientos | Condición contado/crédito independiente de cancelación; cobros/pagos con importe, fecha, cuenta y respaldo. Registrar transferencias propias, socios, préstamos, gastos y otros movimientos. Generar propuestas balanceadas con trazabilidad y bloqueo de duplicados. | Clasificación y estados de seguimiento existentes. Movimientos monetarios y asientos pendientes. |
| Devengamientos | IVA, IIBB, TEM, sueldos y cargas sociales por mes; registrar deuda y luego pago como eventos distintos. Revisar que la liquidación IVA cancele cuentas fiscales y reconozca saldo a pagar/a favor, sin tratarlo automáticamente como gasto. | Calendario registra presentación/pago manual. Devengamientos, obligaciones vinculadas y asientos pendientes. |
| Conciliación | Cuenta, moneda, saldo inicial/final, movimientos del libro y extracto; coincidencias uno a uno y agrupadas, partidas pendientes arrastradas, reversos, rechazos y meses sin movimientos. | Pendiente de extractos sanitizados y módulo de bancos. |
| Bienes de uso | Costo, componentes activables, fecha de puesta en uso, vida útil, residual, método, bajas y amortización acumulada. Calcular cuota mensual exacta con ajuste de redondeo, sin exceder base amortizable. | Pendiente del registro de activos y asientos. No asumir vida útil por categoría. |
| Informes | Flujo de fondos real separado del resultado devengado; indicadores por empresa/moneda y mes. Barras de ingresos/egresos, distribución de gastos en torta y tabla accesible. Incorporar sueldos, impuestos y amortización para rentabilidad. | Informes parciales de comprobantes existentes. Resultados completos dependen del libro y conciliación. |
| Cierre y Xubio | Checklist final, Debe = Haber, sin duplicados, respaldos, conciliación, cuentas corrientes, liquidaciones y control posterior de importación. | Checklist operativo ampliable desde Control mensual. Exportación específica pendiente de plantilla oficial y prueba real. |

## Validación necesaria para Xubio

Recibir ejemplos sin datos sensibles de plan de cuentas, cuentas corrientes y plantilla vigente de importación de asientos, con un caso aceptado. Verificar códigos, fechas, moneda, cotización, cuentas analíticas, contrapartes, centros de costo, signos y agrupación por asiento. Una vez implementado el adaptador, comparar cantidades, saldos y totales antes y después de importar en una empresa de prueba. Mantener un identificador de lote para evitar registraciones repetidas.

No se solicitan claves fiscales en el chat ni se simulan consultas a ARCA. La integración automática deberá mantener secretos en el servidor y verificar representación y servicios disponibles.

## Implementación del libro operativo · 26/11/2026

La tabla anterior conserva las dependencias del alcance original. Ahora existe una implementación inicial de aperturas y cuentas corrientes acumuladas, cobros/pagos y anticipos, asientos de comprobantes y manuales, devengamientos con saldo pendiente, conciliación uno a uno y saldos por cuenta, registro de activos y cuotas lineales, tablas y gráficos de resultado/flujo. Las altas manuales de comprobantes reutilizan la importación validada. Se incorporó importación de aperturas y extractos con columnas y respaldo, y exportación XLS basada en el modelo oficial de Xubio. Todos los registros operativos de producción requieren la migración `20261126000100`.

Siguen pendientes: conexión automática autenticada con ARCA; investigación automática y actualización de fechas según régimen/prórroga; municipio y reglas de TEM; liquidaciones fiscales completas con saldos previos, ajustes y DDJJ; cálculo de nómina; conciliaciones agrupadas/parciales; conversiones monetarias; aplicaciones de notas de crédito y reintegros en cuentas corrientes; control de lotes realmente aceptados por Xubio; prueba de aceptación del XLS en Xubio y validación con exportaciones reales sanitizadas. La integración Supabase no estaba conectada al preparar esta entrega; las pruebas de datos realizadas son locales, con Auth/Storage simulados.

## Continuación del circuito solicitado

Después de los archivos fiscales: distinguir condición contado/crédito de cancelación real; registrar medio efectivo, cuenta, fecha y pagos/cobros parciales; incorporar movimientos bancarios no fiscales y generar asientos sin duplicación. Devengar IVA, IIBB, TEM, sueldos y cargas por mes con obligación y asiento separado del pago; conciliar por cuenta y mes. Mantener cartera y ficha individual de cada cliente/proveedor.

La cartera ahora permite filtrar clientes/proveedores y abrir su detalle acumulado de aperturas, comprobantes, notas de crédito y cancelaciones, con el medio informado en cada pago/cobro. Los registros anteriores conservan medio «Sin informar»; no se infiere del nombre de la cuenta. Efectivo/transferencia/tarjeta/cheque/otro son medios efectivos; crédito no es un pago.

Se implementó la elección mensual/anual por bien y el mes de registración anual (inicialmente se propone el cierre de ejercicio). La cuota anual acumula meses de uso desde el último mes anual, con prorrateo desde la puesta en uso y exclusión del mes de baja. El control mensual muestra las cuotas del mes pendientes. Los acumulados históricos previos al inicio del libro requieren el asiento de apertura revisado. La activación de la base operativa y el lector PDF Comafi permanecen pendientes.

## Primer circuito con muestras (26/11/2026)

Se adaptó el lector a un plan de Xubio y a Mis Comprobantes Recibidos de ARCA. Ver formatos y límites en IMPORT_FORMATS.md. La empresa de la muestra aún no tiene ventas: usar «Este mes no hubo ventas» en cada período correspondiente, en vez de subir archivos vacíos; no se extrapola a meses futuros. Se confirmó la lectura Comafi con tres cuentas sin movimientos, conservando monedas separadas y sin registrar rechazos como débitos. La lectura transitoria no carga saldos al libro ni liquida impuestos. Sigue pendiente un PDF con cargos reales para validar la clasificación fiscal; Supabase operativo y DDJJ completas mantienen sus dependencias anteriores.


## Septiembre con actividad bancaria

Se validó el PDF Comafi recibido de septiembre: 22 movimientos, tres cuentas y saldos coherentes. En Preparar mes → Banco, Analizar PDF muestra saldos, categorías y cada renglón con origen; permite corregir categorías y descargar el papel. Tras verificar empresa/mes, Guardar PDF y papel bancario archiva ambos respaldos. Las cuentas sin actividad se conservan con su moneda y saldos, sin crear pagos ficticios. Los impuestos a los débitos/créditos y sellos quedan separados de IVA, y las transferencias requieren identificar su contraparte. Esta etapa prepara documentación; la incorporación al libro, el cruce con comprobantes, el crédito fiscal computable y los asientos requieren revisión posterior y la activación del módulo operativo existente.
