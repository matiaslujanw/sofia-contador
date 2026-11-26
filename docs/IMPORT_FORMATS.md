# Formatos de importación

Sofía importa comprobantes de compras, comprobantes de ventas y planes de cuentas mediante plantillas y asignación de columnas. Las plantillas CSV están disponibles en **Documentación → Importar datos**.

## Flujo

1. Seleccioná la empresa y un período abierto.
2. Elegí el tipo de importación y cargá el archivo. Para comprobantes, elegí el separador decimal cuando el formato sea ambiguo.
3. Verificá la correspondencia entre encabezados y campos. Sofía sugiere asignaciones cuando reconoce un encabezado único. Las columnas con el mismo nombre se pueden distinguir por su posición.
4. Revisá la vista previa paginada. Los errores identifican el campo y la fila del archivo. Para corregir un valor, editá el archivo y volvé a cargarlo.
5. Confirmá la asignación y los importes. En el modo conectado, el servidor vuelve a leer el original, verifica el período y registra la importación con el archivo en almacenamiento privado.

## Archivos admitidos

| Formato | Preparación |
| --- | --- |
| CSV | UTF-8, UTF-16 con BOM o Windows-1252. Se admiten comas, punto y coma y tabulaciones como separadores. Un encabezado `sep=` de Excel puede indicar el separador. |
| XLS y XLSX | Libro con una hoja. La primera fila con datos contiene los encabezados. Las columnas importadas requieren valores verificados, por lo que las fórmulas deben convertirse a valores antes de cargar el archivo. |
| PDF | Se carga como documento respaldatorio. La extracción de datos contables queda pendiente de validación con archivos de muestra. |

La importación estructurada admite hasta 3 MiB, 5.000 filas de datos, 80 columnas y 2.000 caracteres por celda. El lector XLSX comprueba el tamaño de los componentes ZIP y limita el total descomprimido a 24 MiB. Para archivos XLSX comprimidos se requiere un navegador con soporte de descompresión DEFLATE, disponible en Safari para iPad desde iPadOS 16.4. Para las hojas de Excel se usa SheetJS Community Edition 0.20.3. [Opciones de lectura de SheetJS](https://docs.sheetjs.com/docs/api/parse-options/) · [Compatibilidad de descompresión de MDN](https://github.com/mdn/browser-compat-data/blob/main/api/DecompressionStream.json)

## Comprobantes

| Campo de plantilla | Contenido |
| --- | --- |
| `date` | Fecha de emisión en el mes activo. La plantilla acepta `AAAA-MM-DD`, `DD/MM/AAAA` y `AAAAMMDD`. También admite fechas reconocidas en celdas de Excel. |
| `receipt_type`, `point_of_sale`, `receipt_number` | Descripción o código de tipo con el que se identifica el comprobante, punto de venta de hasta cinco dígitos y número de hasta ocho. Usá una codificación de tipo consistente en todos los archivos. |
| `receipt_number_to` | Columna opcional para exportaciones con número desde y hasta. Si tiene un valor, debe coincidir con el número de comprobante. Se importa una fila por comprobante. |
| `counterparty_cuit`, `counterparty_name` | CUIT de 11 dígitos y denominación. En compras se exige el CUIT del emisor para distinguir proveedores. En ventas el CUIT del receptor es opcional. |
| `currency`, `exchange_rate` | Código de moneda de tres letras y cotización positiva de hasta seis decimales. Sofía reconoce `PES` como `ARS` y `DOL` como `USD`. La cotización en ARS es 1. [Códigos de moneda de ARCA](https://arca.gob.ar/libro-iva-digital/documentos/Libro-IVA-Digital-Tablas-del-Sistema.pdf) |
| `taxable`, `untaxed`, `exempt`, `vat`, `other_taxes`, `total` | Neto gravado, neto no gravado, exento, IVA total, otros tributos e importe total. Cargá cero explícito cuando el concepto corresponda a cero. Cada importe admite hasta dos decimales. |
| `vat_rate_0`, `vat_rate_2_5`, `vat_rate_5`, `vat_rate_10_5`, `vat_rate_21`, `vat_rate_27` | Desglose opcional del importe informado por alícuota. Si cargás un desglose, su suma debe coincidir con el IVA total. |

La suma de netos, exento, IVA y otros tributos debe coincidir exactamente con el total. Los importes se conservan como decimales y la validación de sumas usa unidades enteras. En Excel conviene guardar como texto los importes con más dígitos significativos de los que admite la hoja. La elección del separador se aplica a celdas de texto. Las celdas numéricas se leen según su valor almacenado.

Ingresá las notas de crédito con importes negativos y las notas de débito con importes positivos. Los conceptos que correspondan a cero se cargan como cero. La validación usa la descripción explícita de la nota con o sin «de» y los códigos de notas de la tabla de tipos de comprobantes del Libro IVA Digital. Cuando el tipo consiste solamente en uno a tres dígitos, Sofía lo guarda con tres dígitos para que entradas como `3` y `003` tengan la misma identidad. Los signos se guardan tal como se informan en el archivo. [Tabla de tipos de comprobantes de ARCA](https://arca.gob.ar/libro-iva-digital/documentos/Libro-IVA-Digital-Tablas-del-Sistema.pdf)

Los importadores del navegador y del servidor usan el mismo lector y las mismas reglas de signo. Los importes de texto conservan sus dígitos, incluyendo signos negativos expresados con paréntesis. Para abreviaturas que la aplicación no identifica y códigos fuera de la tabla de notas, revisá el tipo y los signos durante la preparación del archivo.

## Plan de cuentas

| Campo de plantilla | Contenido |
| --- | --- |
| `code`, `name` | Código y nombre obligatorios. Usá texto en Excel para preservar ceros iniciales y la escritura exacta de códigos. |
| `kind` | Activo (`asset`), pasivo (`liability`), patrimonio neto (`equity`), ingresos (`revenue`), costos (`cost`) o gastos (`expense`). |
| `parent_code` | Código opcional de la cuenta padre. Puede corresponder a otra fila del archivo o a una cuenta existente de la misma empresa. |
| `category` | Categoría interna opcional para informes. |
| `status` | `active` o `inactive`. También admite las variantes activo, activa, inactivo e inactiva. |

## Identidad e historial

- Compras. La clave de una empresa combina tipo, punto de venta, número y CUIT del emisor.
- Ventas. La clave de una empresa combina tipo, punto de venta y número.
- Plan de cuentas. La clave de una empresa es el código textual.
- Archivo. SHA-256 identifica el contenido ya confirmado dentro del mismo período y tipo.

El tipo de comprobante admite diferencias de mayúsculas y espacios externos. Otras variaciones de descripción o código requieren un criterio consistente al preparar los archivos. La vista previa omite réplicas idénticas y detiene la confirmación cuando encuentra la misma clave con valores distintos dentro del archivo. La persistencia omite claves ya registradas y conserva la fila anterior.

## Adaptadores pendientes de validar

| Origen | Evidencia pendiente |
| --- | --- |
| Mis Comprobantes de ARCA | Exportaciones sanitizadas de emitidos y recibidos, incluyendo notas de crédito y débito, moneda extranjera, alícuotas discriminadas y filas con datos faltantes. Hasta entonces se usa la asignación manual de columnas. |
| Plan de cuentas de Xubio | Exportación sanitizada con códigos, ramas, categorías y estados. Hasta entonces se usa la asignación manual de columnas. |
| Banco Comafi | Extractos anonimizados en PDF o formato tabular. Incluir casos con movimientos, cuentas sin movimientos, reversos y débitos rechazados. |
| Xubio, asientos | Plantilla oficial y muestra de importación verificada para implementar el exportador específico. |
| Balances y libros mayores | Ejemplos del origen y definición de sus claves, importes y controles. |

## Exportaciones de Control mensual

Checklist, detalle y resumen de IVA se descargan como CSV propios de Sofía (UTF-8 con BOM, punto y coma, importes decimales con punto). El detalle identifica comprobantes pendientes y excluidos de los subtotales. No son archivos de importación Xubio: el adaptador sigue pendiente de plantilla y prueba verificadas. Ver [Circuito mensual](MONTHLY_WORKFLOW.md).

## Libro operativo: aperturas y extractos

En **Contabilidad operativa** se importan saldos de apertura o movimientos de extracto desde CSV/XLS/XLSX con asignación de columnas y vista previa. Un lote admite hasta 500 filas, se valida íntegramente y se confirma en una sola transacción. Una referencia repetida impide duplicar el movimiento. Primero se conserva el original en Documentación; el lote exige elegir ese respaldo. La persona responsable verifica que el archivo analizado corresponda al original seleccionado.

Aperturas: `date`, `reference`, `description`, `role` (`cliente`/`proveedor`), `cuit`, `name`, `amount` con signo, `control_account_code`, `offset_account_code`. Solo una apertura por tipo y CUIT en cada empresa; usar el saldo anterior al inicio del historial importado, no volver a cargar el cierre de cada mes.

Extractos: `date`, `reference`, `description`, `amount` (+ crédito, − débito), `cash_account_code`. Fechas ISO o DD/MM/AAAA. Seleccionar el separador decimal de texto; los números de Excel usan su valor almacenado. Los códigos se vinculan a cuentas activas de la empresa. Las notas de archivo y correspondencias de Xubio se revisan en la vista previa; no se afirma compatibilidad universal con sus exportaciones.

## Asientos XLS para Xubio

El exportador usa el [instructivo oficial argentino](https://ayuda.xubio.com/es-ar/como-importo-asientos-contables-manuales/) y su [modelo descargable](https://ayuda.xubio.com/es-ar/filedownload/3043/), consultados el 26/11/2026. El modelo publicado es un libro XLSX; el instructivo exige el archivo de salida **XLS (Excel 97-2003)**, por lo que Sofía escribe BIFF8.

Las columnas exactas del modelo son `FECHA`, `CONCEPTO`, `CIRCUITOCONTABLE`, `CUENTA`, `DEBE`, `HABER`, `ORGANIZACION`, `CENTRODECOSTO`, `DESCRIPCION`. Cada asiento tiene una fila cabecera con fecha numérica de Excel y formato DD/MM/AAAA, concepto y circuito; luego sus líneas por **nombre exacto** de cuenta. Los importes se escriben como texto decimal para conservar centavos, conforme a la recomendación del instructivo. Las contrapartes comerciales se informan cuando están identificadas; los nombres deben existir en Xubio. No se exporta un centro de costo que no haya sido definido.

Se bloquean otras monedas porque el modelo verificado no contiene columnas de moneda/cotización. El CSV alternativo conserva códigos y valores exactos para revisión. La descarga no equivale a una importación aceptada y no marca registros como enviados. Se requiere confirmar cuentas/organizaciones/circuito y ausencia de registración previa, probar primero en una empresa de Xubio y comparar saldos. La aceptación real en Xubio continúa pendiente.
