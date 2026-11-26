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
