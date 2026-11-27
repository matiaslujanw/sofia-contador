# Auditoría mensual de Xubio

Acceso: empresa → **Auditoría de Xubio** (`/xubio`). Se reutiliza el plan permanente de la empresa. No modifica Xubio ni certifica registros o documentación no proporcionados.

## Archivos y evidencia

Se revisaron inicialmente tres muestras reales proporcionadas por la persona usuaria: AsientoManual.xlsx contiene dos encabezados de asientos (junio/septiembre de 2026), sin cuentas ni Debe/Haber; Libro Mayor.xlsx incluye una cuenta bancaria, saldo inicial y movimientos de septiembre/octubre; Sumas y Saldos.xlsx tiene catorce cuentas y créditos firmados negativos. Ese listado manual **no sustituye el Libro Diario completo**. No se produjo un lote real de faltantes a partir de estas muestras ni se cargaron en producción. El entorno fue reemplazado durante la sesión y los originales temporales dejaron de estar disponibles; los parsers se comprobaron después con casos sintéticos de esas estructuras, no con una repetición integral de las muestras. Posteriormente se validó un Libro Diario real, detallado en el apartado final. Sigue pendiente la aceptación del XLS dentro de Xubio.

La carga mensual admite XLSX/XLS/CSV con los límites del lector compartido (3 MiB, una hoja, 5.000 filas, celdas sin fórmulas). Diario detallado: Fecha, Documento o Número, Cuenta, Código opcional, Debe/Haber, Circuito y Descripción opcionales. Acepta fechas ISO, DD/MM/AAAA y seriales Excel. Los grupos se forman por fecha/circuito/documento; exige líneas completas y balanceadas. Los formatos agrupados o columnas ambiguas se observan y no habilitan exportación. Un listado Fecha/Documento/Concepto se reconoce explícitamente como resumen.

Mayor: Fecha/Documento/Cuenta/Debe/Haber/Saldo; comprueba saldo inicial y evolución por cuenta. Las fechas ajenas al mes permanecen como evidencia, pero el cruce utiliza movimientos del mes. Sumas y Saldos: Código/Cuenta/Saldo Anterior/Débitos/Créditos/Saldo Final y, si están, totales ajustados. Normaliza créditos negativos de este reporte a magnitudes positivas, conservando el signo del saldo; no cambia esa convención en el Mayor/Diario. Comprueba saldo anterior + débitos − créditos = saldo final, y lo mismo con los totales ajustados (no son movimientos adicionales).

Estos archivos no identifican inequívocamente empresa, moneda y filtros de exportación: se exige confirmar empresa, ARS, todos los circuitos, Diario del mes sin agrupación y rango mensual de Sumas y Saldos. Esa declaración no convierte un listado sin detalle en Diario. Se comparan además totales Diario/Sumas y Saldos y Diario/Mayor por cuenta. Cuentas desconocidas o ambiguas, códigos/nombres incompatibles, saldos incoherentes o grupos incompletos bloquean el lote.

## Qué se compara

- Asientos ya preparados en el libro operativo de Sofía, incluidos cobros/pagos, devengamientos, aperturas y amortizaciones efectivamente registradas allí. El alta de un activo no genera una propuesta de amortización por sí sola. El módulo operativo requiere sus migraciones previas; la carga/archivo de esta auditoría usa Documentación existente y no agrega SQL.
- Comprobantes del período sin asiento de origen en el libro: propone netos, IVA y cuenta de control de clientes/proveedores. Requiere aprobación, contraparte identificada, cuenta del comprobante y mapeo de IVA/control. IVA no definido o parcial/no computable, otros tributos sin desglosar y centros de costo requieren un asiento revisado en Contabilidad antes de usar este exportador. El pago no se infiere de condición contado/crédito.
- Resúmenes Comafi del mes guardados en Extractos bancarios: recupera un papel bancario compatible para conservar categorías revisadas. Vincula banco y contrapartidas a cuentas activas. Comisiones, intereses, IVA, percepciones/retenciones, débitos/créditos y sellos son propuestas revisables; no presume cómputo fiscal. Transferencias y otros movimientos necesitan identificación en Contabilidad y quedan bloqueados como propuestas automáticas. Si existe un movimiento similar del libro, observa el duplicado potencial. Extractos incompatibles o versiones diferentes de una misma cuenta se observan.

Faltan como fuentes aquellas obligaciones, remuneraciones, activos o comprobantes no cargados. La ausencia de una propuesta no demuestra que no exista obligación de registrarla. Solo se cruzan empresas/períodos seleccionados; otras monedas no se exportan en el modelo verificado.

## Resultados y decisiones

Compara vectores de cuentas/importes exactos por fecha. Las coincidencias contables siguen requiriendo revisar la identidad del documento; no usa solamente el número de asiento, que Xubio puede renumerar. Multiplicidades, coincidencias de otra fecha, importes parciales iguales en las mismas cuentas o agrupaciones bancarias o de comprobantes detectadas quedan ambiguas y no se exportan. No resuelve todas las combinaciones de asientos consolidados o conciliaciones parciales.

Sin coincidencia significa **posible faltante**, no certeza automática. Para exportar se exige alcance válido, cuentas activas de la misma empresa, asiento balanceado en ARS, selección individual y declaración final de revisión de documentos, cuentas, contrapartes, agrupaciones y registraciones posteriores. Los nombres deben ser únicos y coincidir con Xubio. La aplicación permite descargar un informe CSV con evidencias/observaciones aun si el alcance está incompleto.

## Persistencia y lotes

Cada reporte se guarda sin alterar sus bytes en Respaldos, con nombre `xubio-{diario|mayor|saldos}-{mes}-…`. Al reingresar recupera el más reciente de cada clase y los extractos del mes. Guardar revisión y cuentas conserva un CSV con empresa/CUIT/mes, huella de fuentes y datos usados, mapeos, selección, circuito y confirmación de alcance. Solo reaplica revisiones compatibles con las fuentes y el plan actuales. Cambiar una fuente, cuenta o selección requiere revisión nueva. Las vistas previas sin guardar no se presentan como archivadas.

El XLS sigue el modelo argentino verificado de asientos manuales: una hoja, fila cabecera por asiento, nombres exactos, importes decimales como texto, fechas Excel y formato BIFF8 (.xls). Conserva organizaciones cuando el origen las identifica. Limita a 65.536 filas XLS y a 5.000 operaciones por lote; la revisión completa también debe caber en 5.000 filas de control. Si excede esos límites se pide dividir la selección antes de guardar, para evitar truncamiento o un manifiesto ilegible.

Antes de generar, consulta nuevamente documentos e historial del período y guarda una revisión con cuentas, selección y circuito para permitir reintentos idénticos. Guarda el XLS y un manifiesto CSV con empresa/período, huella de fuentes, IDs y SHA-256 del XLS. Al recuperar, verifica el manifiesto contra los bytes del archivo y excluye esos IDs de nuevas propuestas exportables. Un XLS sin manifiesto se observa: solo un reintento idéntico puede completar ese lote; no se generan otros mientras haya lotes incompletos. Si falla un guardado parcial, los respaldos permanecen para revisión. Las descargas guardadas se reutilizan.

Generado/exportado no equivale a **importado en Xubio**. Después de importar, cargar un Diario actualizado y volver a comparar. Los operadores deben coordinarse: la consulta fresca y el historial reducen reenvíos, pero no son una transacción distribuida ni un bloqueo atómico entre múltiples dispositivos y Xubio. No se verificó importación real ni guardado con una sesión Supabase de producción.


## Libro Diario nativo validado (27/11/2026)

La nueva muestra real tiene una hoja y columnas N°, Fecha, Documento/Concepto, Código, Cuenta, Año, Mes, Debe y Haber. Incluye 32 renglones de ocho asientos balanceados: junio (uno, dos renglones), septiembre (cinco, 23 renglones) y octubre (dos, siete renglones) de 2026. El lector compartido y el parser de la app se ejecutaron sobre el original con cero errores; no se incorporó el archivo a Git ni a las pruebas.

Se conserva el número como identidad del asiento, con fecha/circuito, y el Documento/Concepto como referencia legible. Las líneas que dejan vacíos número/concepto heredan la cabecera; repetir el número sin volver a escribir el concepto no divide un asiento. Se reinician las cabeceras al cambiar de asiento/fecha/circuito. Una fecha o circuito nuevo sin identificador y un mismo número con documentos incompatibles se observan, igual que un asiento incompleto o desbalanceado. Este control se realiza también antes de disponer del plan u otros reportes. Mayor conserva su control individual de saldos, sin exigir balance por asiento de una sola cuenta.

La vista mensual muestra asientos/renglones de todo el archivo y del mes elegido, con un desglose de los demás meses; el cruce usa solo el elegido. No hace falta recortar el Diario por mes si está completo y coherente. Sumas y Saldos debe corresponder al rango del mes y el Mayor debe ser compatible. Que todos los asientos cuadren no prueba integridad documental ni permite concluir faltantes sin el resto de las fuentes. No se generó un lote real ni se importó este archivo en producción desde la sesión.
