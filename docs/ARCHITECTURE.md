# Arquitectura

- **Next.js App Router** renderiza rutas privadas por sección. La URL conserva organización, empresa y mes para facilitar la navegación a períodos anteriores.
- **Supabase SSR** renueva sesión desde `src/proxy.ts`. Las páginas protegidas y acciones de servidor verifican la sesión. El cliente de datos usa la clave publicable y las credenciales de sesión de la persona.
- **PostgreSQL** mantiene relaciones multiempresa, restricciones exactas, RLS y bitácora. Las operaciones que requieren atomicidad emplean funciones SQL. Supabase Storage conserva originales en un bucket privado.
- **Workspace** reúne datos del estudio, componentes de navegación y módulos de interfaz. Las validaciones Zod son compartidas entre la demo y el servidor. El dashboard calcula los indicadores con funciones determinísticas.
- **Importadores** leen CSV, XLS y XLSX. En la app conectada se procesa la vista previa en el navegador y se repite el análisis en el servidor sobre el archivo original, con las columnas ya elegidas. Las reglas SQL validan lo persistido. [Formatos](IMPORT_FORMATS.md)
- **Demostración** utiliza metadatos en localStorage y originales en IndexedDB. Es una experiencia individual de desarrollo. Al conectar Supabase se usa el conjunto de datos privado del estudio.
- **Demo portable.** Vite empaqueta la misma interfaz y operaciones sintéticas en un HTML. La navegación usa el fragmento de URL y los adaptadores del build excluyen las acciones de servidor. Al abrir el archivo local, los cambios y archivos viven en la memoria de la pestaña.
- **Rendimiento inicial.** Las consultas SQL tienen paginación por entidad y se sirven juntas para el estudio seleccionado. Para estudios más grandes, mover a consultas por módulo y período antes de añadir conjuntos como extractos, asientos y mayores.
- **Instalación.** El manifiesto y los íconos están preparados para la experiencia instalable. Los permisos y archivos privados se consultan en línea.

Las operaciones contables y los adaptadores externos se mantendrán fuera de los componentes. Los módulos futuros de bancos, socios y asientos incorporarán sus tablas mediante nuevas migraciones con relaciones compuestas de alcance y pruebas SQL.

## Libro operativo

`src/lib/accounting` contiene esquemas, cálculos exactos, importación con columnas y exportación Xubio. `book_records` mantiene eventos tipados en JSON con importes como texto; el alcance y la anulación son columnas relacionales. No se concede escritura directa a clientes: las RPC validan empresa activa, período abierto, moneda, cuentas, respaldo, balance, relaciones e importes cancelados, y serializan las escrituras de una empresa. Cada lote es una transacción. Los registros financieros son inmutables; se anulan con auditoría si no tienen dependencias. Solo las coincidencias de extractos se pueden modificar.

Los reportes usan las líneas derivadas de cada evento; extractos, saldos bancarios y fichas de activos no generan asientos. Los comprobantes generan un asiento explícito revisado, con una clave de origen única. La carga de comprobantes manuales reutiliza el importador existente y conserva una ficha CSV generada del formulario. Los saldos de cuenta corriente se calculan por contraparte con apertura única y corte de historial, comprobantes y pagos efectivos; los estados de seguimiento anteriores no presumen pagos.

Si la migración del libro no está aplicada, la consulta captura exclusivamente el error de tabla ausente y deshabilita las altas del módulo, sin afectar las demás secciones. Otros errores de consulta se propagan. La demo mantiene el mismo esquema y cálculos, pero no reemplaza las pruebas del servidor.

## Fechas fiscales habituales sin cambio de esquema

`fiscal-recurrence.ts` valida y serializa una regla versionada (identidad UUID, día, desplazamiento 0/1, mes de vigencia y activo) junto a las observaciones de la obligación base. El bloque estructurado queda oculto en el formulario normal de notas. La longitud total respeta el límite de 4.000 caracteres; metadatos inválidos permanecen como texto y no activan reglas. El comando `obligation.save` recibe la regla tipada opcional; servidor/demo la serializan con el mismo helper, conservando los permisos, bitácora y bloqueo de período existentes. No requiere migración ni columnas adicionales.

El calendario consulta obligaciones y períodos de la organización, agrupa versiones por empresa/identidad y usa la última vigente para el mes consultado. Las previsiones tienen ID virtual y nunca se escriben por consultar la pantalla, ni se presentan como pagos o deudas de importe conocido. Se materializan únicamente al guardar; importes y evidencias no se copian. La configuración de un mes posterior no altera registros anteriores ni genera filas en períodos cerrados. La función de previsiones se usa en Calendario fiscal; los demás indicadores contables continúan basados en registros efectivos. La persistencia sigue el guardado normal de obligaciones; no se afirma exclusión atómica de dos operadores que registren simultáneamente una misma previsión.

## Núcleo relacional VIG.IA — etapa 1

`src/lib/accounting/core` concentra esquema de comandos, validación de dominio y libros. `accountingBooks` produce Diario, Mayor y sumas/saldos de las mismas líneas confirmadas, con índices en memoria por cuenta/asiento para evitar barridos cruzados repetidos. El servidor confirma/revierte mediante RPC transaccionales; el adaptador local permite pruebas de interfaz, pero no sustituye las restricciones SQL.

La migración `20261127000100` mantiene el plan original y agrega ejercicios, perfiles/equivalencias, Diario/líneas, historia completa antes/después y relaciones preparatorias de contrapartes y bancos. La numeración se serializa por empresa y es única en el ejercicio; claves de origen y huellas SHA-256 canónicas sostienen reintentos y revisión de duplicados. Las líneas/cabeceras son inmutables y el contrasiento se relaciona con el original. La historia nueva comienza al activar, sin reconstruir cambios anteriores.

Las consultas nuevas se paginan y acotan a la empresa seleccionada; no alteran el alcance de las consultas operativas previas. La ausencia de la tabla de ejercicios deshabilita el núcleo en la interfaz. Sin empresa no se carga un Diario global de todas las organizaciones. Las integraciones con los módulos y auditoría anteriores no se activan automáticamente. [Entrega y límites](etapa-1/ENTREGA.md).
