# Reglas contables

Los importes de este primer alcance surgen de comprobantes y clasificaciones registrados para una empresa y un mes. Sofía conserva el origen y deja las decisiones de imputación, registración y cierre a cargo de la persona autorizada.

## Comprobantes y moneda

- La fecha de emisión debe pertenecer al período elegido. Compras y ventas conservan su dirección, la moneda, la cotización informada y los componentes del total.
- La base neta de un comprobante es la suma de los netos gravado y no gravado y el importe exento. El total agrega a esa base el IVA y los demás tributos informados. PostgreSQL comprueba la igualdad exacta y, cuando se entrega el detalle de IVA, verifica que la suma de las alícuotas coincida con el IVA total.
- Las notas de crédito se cargan con signo negativo. La vista previa valida el signo cuando reconoce el texto del tipo. Si el tipo se informó como un código, la revisión del signo queda a cargo de quien prepara el archivo. Las notas de débito conservan su tipo y su identidad.
- En ARS la cotización es 1. Para otras monedas se conserva la cotización informada, con hasta seis decimales. Los indicadores suman comprobantes de la moneda configurada para la empresa. La pantalla identifica cuántos comprobantes de otras monedas quedaron fuera de los totales del mes.
- Los importes se almacenan con precisión decimal y se calculan y muestran a partir de centavos enteros. El gráfico usa una representación numérica para dibujar y su tabla conserva los importes exactos.

La identidad en compras combina empresa, tipo, punto de venta, número y CUIT del emisor. En ventas combina empresa, tipo, punto de venta y número, dado que la emisora es la propia empresa. Las coincidencias omiten duplicados y conservan la fila previa. Los formatos, mapeos y límites están detallados en [Formatos de importación](IMPORT_FORMATS.md).

## Imputación y aprobación

- Las cuentas se clasifican en activo, pasivo, patrimonio neto, ingresos, costos o gastos. Una compra suma a costos y gastos imputados solo cuando está aprobada y vinculada a una cuenta de costos o gastos. El equipamiento imputado a una cuenta de activo conserva su naturaleza patrimonial.
- Cambiar manualmente la clasificación interna de una cuenta requiere que sus comprobantes vinculados correspondan a períodos abiertos. El código importado permanece estable.
- Las reglas de contraparte se guardan explícitamente a partir de un comprobante aprobado con CUIT e imputación. La actualización del comprobante y su regla opcional se confirman juntas. La clave de la regla es empresa, dirección y CUIT. Su aplicación posterior propone cuenta, categoría, concepto o centro de costo para revisión.
- El estado de pago o cobro, el medio y el estado de registración en Xubio son datos de seguimiento. Los importes efectivamente cobrados o pagados se determinarán cuando estén disponibles las registraciones y la conciliación.
- El IVA computable es un dato editable en compras. Cuando se informa, su importe debe encontrarse entre cero y el IVA del comprobante, respetando el signo de las notas de crédito. El IVA total informado en compras y el crédito fiscal computable se registran por separado.

## Seguimiento del cierre

El primer mes de cada empresa inicia con 16 tareas estándar. Un mes posterior toma los títulos y el orden del período anterior más reciente y empieza con estados pendientes, observaciones vacías y sin documentos vinculados. Cada mes conserva su propio historial.

El porcentaje usa como denominador las tareas aplicables y como numerador las completadas. Si todas las tareas están marcadas como **No aplica**, el avance es 100 %. Un período sin iniciar carece de avance. El cierre con pendientes y toda reapertura requieren motivo. Los cambios quedan en la bitácora con el actor correspondiente en el entorno conectado.

## Indicadores disponibles

| Indicador | Criterio |
| --- | --- |
| Ventas netas y compras netas | Suma de las bases netas por dirección, empresa, mes y moneda de la empresa. |
| IVA de ventas e IVA de compras | Suma del IVA informado en los comprobantes de cada dirección y moneda de la empresa. Son importes del documento. |
| Costos y gastos imputados | Suma de la base neta de compras aprobadas vinculadas a cuentas de costos o gastos. |
| Comprobantes por revisar | Cantidad de comprobantes del período cuyo estado difiere de **Aprobado**, incluyendo los de otras monedas. |
| Avance del cierre | Proporción de tareas completadas sobre las aplicables. |
| Evolución de compras y ventas | Serie mensual de bases netas que llega al mes elegido y cubre seis meses. |

Cuando faltan comprobantes comparables, el tablero usa **Pendiente**. Para registrar explícitamente un mes sin ventas, marcá **No aplica** en la tarea estándar **Recepción de comprobantes emitidos**. El cero explícito corresponde a un período sin comprobantes emitidos. El margen sobre ventas se muestra como **No aplicable** cuando la base de ventas es cero.

El tablero general cuenta las empresas activas y sus cierres para el mes elegido, junto con las tareas pendientes y las marcadas como esperando documentación. Los próximos vencimientos se basan en obligaciones manuales futuras del período seleccionado con estado pendiente o presentado. Las alertas iniciales recogen tareas esperando documentación, comprobantes marcados para revisión y la hipótesis de un bien de uso vinculado a una cuenta de costos o gastos. La revisión profesional determina la resolución de cada hallazgo.

## Indicadores y flujos pendientes

| Dependencia | Indicadores o procesos que habilita |
| --- | --- |
| Extractos y conciliación por cuenta, fecha y moneda | Ingresos y egresos efectivos, disponibilidad bancaria, evolución de saldos y diferencias conciliatorias. El circuito incluye meses sin movimientos, reversos y rechazos. |
| Tesorería, pagos, cobros y cuentas corrientes | Saldo de caja, créditos por ventas, deudas con proveedores y evolución de cobranzas y pagos. |
| Socios y financiamiento | Préstamos, aportes, gastos pagados por socios y devoluciones. Su contabilización seguirá la naturaleza del movimiento y la aprobación profesional. |
| Asientos, ajustes, bienes de uso y amortizaciones | Resultado económico, pérdidas y ganancias, rentabilidad, clasificación integral de costos y gastos y distribuciones por categoría o proveedor. |
| Papeles de trabajo y parámetros fiscales vigentes | Liquidaciones preliminares de IVA e Ingresos Brutos, saldos previos, retenciones, percepciones, exportación y revisión técnica. |

El calendario vigente se carga manualmente. La persona responsable define la obligación, la fecha, el importe y las etapas de presentación y pago. Jurisdicciones, vigencias y reglas fiscales se incorporarán con fuentes verificadas y revisión profesional.

## Papel preliminar de IVA

Control mensual muestra IVA informado en ARS y subtotales revisados. Suma débito de ventas aprobadas y crédito computable definido de compras aprobadas; no presume deducibilidad cuando el valor es nulo. Conserva notas de crédito negativas y cero explícito. Las otras monedas se conservan en el detalle pero se excluyen del cálculo. La diferencia parcial no incluye saldos anteriores, percepciones, retenciones, ajustes ni IVA bancario sin documentar y no determina una DDJJ o deuda a pagar. Ver [Circuito mensual](MONTHLY_WORKFLOW.md).

## Registro operativo

- Cobros y pagos tienen fecha, importe, cuenta de caja/banco, contrapartida, concepto y respaldo opcional. Su asiento nace del evento monetario. La asignación a una factura positiva o devengamiento valida moneda, empresa, fecha y saldo restante. Los anticipos quedan sin asignación específica y afectan la cuenta corriente. Los reintegros y aplicaciones de notas de crédito a facturas requieren revisión mediante asientos; no se presume una aplicación automática.
- Las aperturas son únicas por cliente/proveedor y CUIT. Los comprobantes y cancelaciones anteriores a su fecha quedan fuera del saldo acumulado. Clientes usan cuenta de activo; proveedores, de pasivo. El estado manual de pago de un comprobante no altera los saldos.
- Los devengamientos de IVA/IIBB/TEM/sueldos/cargas usan cuentas elegidas por la persona responsable y crean una obligación visible en el calendario con saldo pendiente. La cancelación usa la cuenta de deuda y puede ser parcial. No prueba presentación fiscal. En IVA no se presume cuenta de gasto.
- La conciliación individual contrasta cuenta, moneda e importe con signo y permite arrastrar pendientes. Un extracto no duplica el asiento del libro. Una transferencia propia usa dos activos, se registra una vez, admite coincidencia en ambas cuentas con signos opuestos y se excluye del flujo externo. Los saldos inicial/final permiten detectar faltantes del extracto y comparar con el saldo del libro. La conciliación agrupada y parcial queda pendiente.
- La amortización es lineal por meses: inicia en el mes de puesta en uso y excluye el de baja. El costo menos residual se distribuye con redondeo acumulativo en centavos. Una clave por activo y mes impide repetir cuotas; el servidor recalcula y valida importe y cuentas. La ficha de activo no contabiliza otra compra. Acumulados anteriores deben incorporarse en el asiento de apertura si corresponden.
- El asiento explícito de un comprobante aprobado usa imputación, cuenta corriente y cuentas fiscales seleccionadas. El IVA no computable se suma a su costo/gasto/activo. Las notas de crédito invierten los signos. No se genera un segundo ingreso/gasto al cobrar o pagar.
- Los informes económicos suman solo asientos de Sofía. Las aperturas se excluyen del resultado; los movimientos de extracto y fichas de activos no se suman. Los gráficos acompañan una tabla de importes exactos. No se llama rentabilidad definitiva a un mes con registraciones faltantes.

La opción anual distribuye el mismo costo menos residual por meses de uso y acumula las cuotas en el mes anual elegido. El primer y último ejercicio pueden ser parciales. Esta elección fija la frecuencia de registración; no calcula un tratamiento fiscal especial. Las cuotas positivas del mes sin asiento aparecen como pendientes en Control mensual.
