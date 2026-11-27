# Base de datos

Sofía usa Supabase PostgreSQL para los datos del estudio, Supabase Auth para las identidades y Supabase Storage para los archivos originales. Una identificación de Auth puede pertenecer a más de una organización con un rol diferente en cada una.

## Aplicar las migraciones

Instalá Supabase CLI v3 o posterior e identificá la referencia del proyecto correspondiente. Desde la raíz del repositorio vinculá el proyecto y aplicá las migraciones del directorio `supabase/migrations`. [Despliegue con Supabase CLI](https://supabase.com/docs/guides/deployment/database-migrations)

```sh
supabase login
supabase link --project-ref TU_REFERENCIA_DE_PROYECTO
supabase db push --remote
```

Para un entorno Supabase local con Docker y CLI, usá `supabase start` y aplicá las migraciones con `supabase migration up`. La configuración local mantiene deshabilitada la carga automática de semillas. Creá las cuentas y ajustá la URL correspondiente. [Seguridad](SECURITY.md)

## Modelo operativo

| Tabla | Función |
| --- | --- |
| `organizations` | Estudio con configuración regional, moneda y zona horaria. Los valores iniciales son `es-AR`, `ARS` y `America/Argentina/Tucuman`. |
| `organization_members` | Relación entre el estudio y `auth.users` con los roles `owner`, `editor` y `viewer`. |
| `companies` | Ficha fiscal y operativa. CUIT único en cada organización. El estado archivado conserva su historial. |
| `periods` | Mes por empresa con identificador único, estado y motivo de cierre o reapertura. El mes se representa con el primer día. |
| `close_tasks` | Checklist de cada período con orden, observaciones y un documento vinculado opcional. |
| `documents` | Metadatos del original asociado con un objeto del bucket privado. |
| `imports` | Historial de importaciones confirmadas con original, huella SHA-256 y cantidad de filas incorporadas y duplicadas. |
| `accounts` | Plan de cuentas por empresa. El código y el código de la cuenta padre conservan la estructura de origen. |
| `vouchers` | Comprobantes emitidos o recibidos con importes, IVA, imputación, estado de revisión y origen. |
| `classification_rules` | Imputaciones sugeridas por empresa, dirección y CUIT de la contraparte. |
| `tax_obligations` | Calendario manual con vencimiento, importe, estado y fechas de presentación y pago. |
| `audit_events` | Bitácora generada por las escrituras autorizadas y la confirmación de importaciones. |

Las referencias compuestas entre organización, empresa y período impiden asociar registros con otro estudio o período. El plan de cuentas pertenece a la empresa. Los períodos, comprobantes, documentos, importaciones y tareas identifican explícitamente el mes correspondiente.

## Integridad contable y permisos

- Los dominios `accounting_money` y `accounting_exchange_rate` usan `numeric` exacto. Los montos admiten dos decimales y el tipo de cambio, hasta seis. En los intercambios que requieren preservar precisión, los montos se transportan como texto decimal. PostgreSQL verifica el total y la composición del IVA, y exige un tipo de cambio unitario para comprobantes en ARS.
- `ensure_period` inicia un único período por empresa y mes. El primer período incluye 16 tareas iniciales. Los períodos siguientes heredan los títulos y el orden del período anterior más reciente, con estados pendientes y sin copiar observaciones ni respaldos. `set_period_status` deja constancia de cierre y reapertura. La reapertura y los cierres con tareas pendientes exigen un motivo.
- Los bloqueos de período y empresa coordinan escrituras con cierres y archivados. El alcance de una fila y los valores de auditoría se protegen también con privilegios de columna.
- `confirm_import` transacciona la carga de datos con su historial. Una huella repetida para el mismo período y tipo devuelve el resultado existente. El índice de comprobantes de compras incorpora el CUIT de la contraparte. Los comprobantes emitidos se identifican por empresa, tipo, punto de venta y número. El plan de cuentas deduplica por código y comprueba que la jerarquía pertenezca a la empresa y carezca de ciclos.
- `create_organization` registra al creador como propietario. `set_organization_member` permite a propietarios administrar miembros y exige conservar al menos un propietario al operar por el flujo de la app. Las cuentas son preexistentes en Auth.
- `save_classification_rule` exige un comprobante aprobado, una contraparte identificada y una imputación para guardar una regla. La regla se ofrece para revisión en usos posteriores.

## Storage

El bucket `accounting-documents` guarda cada original bajo `organización/empresa/período/documento`, con cuatro UUID. El objeto se crea primero y el servidor registra los metadatos después. Un disparador verifica que el objeto exista y coincida en propietario, tamaño y tipo MIME. La importación contable se confirma en una operación posterior que referencia el documento original.

## Evolución del esquema

El roadmap contempla proveedores y clientes como entidades independientes, cuentas bancarias, extractos, movimientos, conciliaciones, socios, financiamiento, asientos y sus líneas, papeles de trabajo, liquidaciones fiscales y resoluciones de auditoría. Se incorporarán en migraciones independientes al implementar sus flujos y las restricciones que correspondan.

## Verificación local

Con `initdb`, `pg_ctl` y `psql` de PostgreSQL 17 disponibles en `PATH`, ejecutá `bash supabase/tests/run-postgres.sh` desde la raíz. El script prepara una instancia temporal, instala esquemas mínimos compatibles con Auth y Storage, aplica las migraciones y corre los casos de políticas y flujos. La prueba de integración con el proyecto Supabase verifica por separado PostgREST, Auth y Storage.

## Activación del libro operativo (20261126000100)

La migración `20261126000100_operating_book.sql` crea `book_records`, políticas de lectura, validaciones de escritura por RPC, índices de referencia/origen/apertura/coincidencia, bitácora y bloqueo de cambios de naturaleza contable con historia cerrada. `save_book_record` inserta un registro o cambia únicamente la coincidencia de un extracto. `save_book_batch` importa hasta 500 aperturas o movimientos de extracto en una transacción, exigiendo respaldo del período. `void_book_record` anula sin borrar historia y rechaza dependencias activas.

Aplicá esta migración en el mismo proyecto Supabase usado por Vercel. No se cambian las tablas contables previas. Después verificá desde dos usuarios con roles diferentes: alta, consulta, pago parcial, rechazo de sobrepago, conciliación, cierre e intento de modificación. Hasta aplicar la migración, Contabilidad operativa muestra su estado de activación y conserva habilitados los módulos previos. Las pruebas locales usan sustitutos de Auth/Storage; la verificación contra Supabase real debe registrarse por separado.

`20261126000200_asset_frequency.sql` amplía la validación del libro para la frecuencia mensual/anual de activos. Debe aplicarse después de `20261126000100`; no modifica registros existentes, que conservan frecuencia mensual si no tienen ese dato. Ambas migraciones siguen pendientes de activación en producción hasta contar con acceso Supabase.

## Núcleo contable relacional — etapa 1

`20261127000100_accounting_core.sql` incorpora diez tablas sin trasladar ni borrar registros: ejercicios; perfiles del plan; equivalencias Xubio; contrapartes cliente/proveedor; relación de comprobantes con contrapartes; cuentas bancarias; cabeceras del Diario; líneas del Diario; movimientos bancarios; snapshots de historial. Reutiliza empresa/período/cuenta/comprobante/documento/usuario existentes. Referencias compuestas y RLS mantienen el aislamiento. Índices por origen, ejercicio/correlativo, cuenta y fecha sostienen los accesos nuevos.

Los asientos se confirman mediante `post_accounting_entry`, con saldo exacto, fecha/cuenta autorizadas, numeración serializada, clave de origen única y huella SHA-256; cabecera y líneas se transaccionan. Restricciones diferidas rechazan una cabecera incompleta y triggers prohíben modificar/borrar confirmados. La reversión inserta otro asiento con referencia única al original. Cambios de naturaleza/imputabilidad con historia se rechazan. Los maestros de contrapartes/bancos y la equivalencia están preparados; su integración a los módulos operativos es posterior.

[Diagnóstico y entrega](etapa-1/ENTREGA.md), [activación](etapa-1/ACTIVACION.md). No se certificó la activación remota. La app conserva el funcionamiento previo y deshabilita el núcleo si falta la migración.
