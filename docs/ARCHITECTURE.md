# Arquitectura

- **Next.js App Router** renderiza rutas privadas por sección. La URL conserva organización, empresa y mes para facilitar la navegación a períodos anteriores.
- **Supabase SSR** renueva sesión desde `src/proxy.ts`. Las páginas protegidas y acciones de servidor verifican la sesión. El cliente de datos usa la clave publicable y las credenciales de sesión de la persona.
- **PostgreSQL** mantiene relaciones multiempresa, restricciones exactas, RLS y bitácora. Las operaciones que requieren atomicidad emplean funciones SQL. Supabase Storage conserva originales en un bucket privado.
- **Workspace** reúne datos del estudio, componentes de navegación y módulos de interfaz. Las validaciones Zod son compartidas entre la demo y el servidor. El dashboard calcula los indicadores con funciones determinísticas.
- **Importadores** leen CSV, XLS y XLSX. En la app conectada se procesa la vista previa en el navegador y se repite el análisis en el servidor sobre el archivo original, con las columnas ya elegidas. Las reglas SQL validan lo persistido. [Formatos](IMPORT_FORMATS.md)
- **Demostración** utiliza metadatos en localStorage y originales en IndexedDB. Es una experiencia individual de desarrollo. Al conectar Supabase se usa el conjunto de datos privado del estudio.
- **Rendimiento inicial.** Las consultas SQL tienen paginación por entidad y se sirven juntas para el estudio seleccionado. Para estudios más grandes, mover a consultas por módulo y período antes de añadir conjuntos como extractos, asientos y mayores.
- **Instalación.** El manifiesto y los íconos están preparados para la experiencia instalable. Los permisos y archivos privados se consultan en línea.

Las operaciones contables y los adaptadores externos se mantendrán fuera de los componentes. Los módulos futuros de bancos, socios y asientos incorporarán sus tablas mediante nuevas migraciones con relaciones compuestas de alcance y pruebas SQL.
