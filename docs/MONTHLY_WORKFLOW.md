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
