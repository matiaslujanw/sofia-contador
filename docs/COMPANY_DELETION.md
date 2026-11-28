# Eliminar una empresa

## Uso

En Empresas, la propietaria dispone de **Eliminar**, además de Archivar. El diálogo consulta una vista previa actualizada, identifica nombre/CUIT y muestra cantidades de períodos, cuentas, comprobantes, importaciones, documentos, tareas y vencimientos. Exige escribir el CUIT y marcar la confirmación de borrado irreversible. Cancelar o escribir otro CUIT no elimina nada.

La eliminación retira la empresa y las cargas de su ámbito; se puede crear una empresa nueva con el mismo CUIT y otros identificadores. No elimina el estudio, las otras empresas, los usuarios ni sus accesos. Se conserva el historial de auditoría, incluida la constancia de eliminación. Esto no es una función para borrar asientos confirmados: se bloquea si existen entradas en el nuevo Diario, movimientos bancarios inmutables o movimientos financieros del libro operativo (también anulados en la base conectada). Los registros confirmados siguen teniendo el procedimiento de reversión y archivo previsto en el núcleo.

Abajo a la izquierda, la etiqueta del perfil muestra **Sofía Luján** y las iniciales SL, con el rol vigente. Se toma la identidad profesional de la app, sin renombrar la organización ni VIG.IA.

## Activación

Se necesita la migración `20261128000100_company_deletion.sql`, descargable como `/activar-eliminacion-empresas.sql`. Publicar en Vercel no activa funciones PostgreSQL. Si la función aún no existe, el diálogo lo informa y ofrece descargar la migración, sin ejecutar una eliminación parcial ni retirar archivos. En esta entrega no se aplicó SQL a producción ni se eliminó una empresa real.

La migración funciona sobre las cuatro migraciones originales y también con el libro operativo y núcleo actuales. Se recomienda el orden normal versionado: base → libro/núcleo si corresponde → eliminación. Si se instala el núcleo manualmente después de esta migración, volver a ejecutar esta migración para adaptar la referencia histórica. Se utilizan CREATE TABLE IF NOT EXISTS, CREATE OR REPLACE y políticas/triggers reemplazables; no se elimina ninguna empresa al aplicar o reaplicar el archivo.

Una persona administradora debe identificar el mismo proyecto Supabase de Vercel, revisar el SQL y aplicarlo en ese entorno. [Identificar el proyecto y el acceso](etapa-1/ACTIVACION.md). No ejecutar los archivos de pruebas en producción. La comprobación con Auth/PostgREST/Storage reales requiere ese acceso y sigue pendiente.

## Funcionamiento

- RPC de vista previa y eliminación disponibles solo para propietarias de la organización. Confirmación por UUID de empresa, CUIT exacto y huella SHA-256 de la empresa, cantidades, archivos y bitácora. Se consulta otra vez bajo bloqueo de empresa; cambios posteriores requieren revisar y confirmar de nuevo.
- La base elimina filas relacionadas y registra la constancia en una transacción. Se usa una lista explícita de tablas; una dependencia futura desconocida provoca rollback en vez de un borrado en cascada sin control. No se tocan cabeceras/líneas financieras ni se deshabilitan sus restricciones.
- Los snapshots inmutables conservan el UUID histórico de la empresa sin exigir que exista la fila viva. Se retira exclusivamente su FK hacia companies, manteniendo la organización, RLS y triggers de inmutabilidad. La bitácora y los datos de las demás empresas permanecen.
- `company_deletions` conserva recibo y manifiesto de archivos. El servidor usa **Storage API** por lotes, no DELETE SQL sobre storage.objects en producción. Se incluyen los originales registrados y los objetos huérfanos de metadatos del prefijo exacto organización/empresa.
- Limpieza de archivos posterior a la transacción SQL: no es una transacción distribuida. Si falla, la empresa ya eliminada se informa como tal y queda una limpieza pendiente visible en Empresas. Reintentar retira los originales restantes de forma idempotente; la función de completar verifica que sus objetos ya no estén registrados en Storage antes de anunciar finalización.
- Las políticas temporales de lectura/borrado se limitan a los objetos del manifiesto de un trabajo pendiente, a su bucket y a propietarias de su organización. La inserción de objetos se coordina con el bloqueo de empresa para impedir nuevas subidas al ámbito eliminado. Un trabajo no permite borrar archivos de otra empresa.
- En demo, el borrado de metadatos se persiste y se retiran los bytes de IndexedDB; en portable se retiran de la memoria de esa pestaña. La eliminación conectada conserva su implementación PostgreSQL/Storage independiente.

## Verificación

115 pruebas unitarias aprobadas, incluidas cinco de ámbito/huella/bloqueos/no mutación y tres de orquestación de Storage/fallo parcial/migración ausente. Siete recorridos únicos Chromium aprobados: cancelación/CUIT equivocado, archivo real en IndexedDB, borrado/reapertura, recreación con CUIT idéntico, perfil en menú iPad, bloqueo por Diario/rol y reintento de limpieza; regresión de inicio, preferencias y vencimiento manual. Se corrigieron selectores del test de archivo y el ámbito del perfil duplicado entre sidebar y menú móvil.

PostgreSQL 17.12 local: migraciones originales y anteriores aprobadas junto con la nueva. Pruebas de propietario/editor/viewer, vista previa desactualizada, rollback, eliminación real de empresa/cargas, otra empresa conservada, auditoría inmutable preservada, limpieza incompleta/completada, permiso exacto de objetos y reutilización de CUIT. Se prueba también la base original más eliminación sin exigir el núcleo. Los tests SQL de Storage usan sus metadatos de plataforma simulados; los tests del servidor verifican las llamadas a Storage API. No se afirma eliminación física de objetos de producción ni aceptación conectada.
