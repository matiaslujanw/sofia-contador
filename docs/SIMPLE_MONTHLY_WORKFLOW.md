# Trabajo mensual simplificado

## Recorrido

Inicio conserva el listado de empresas. Dentro de cada empresa se selecciona el mes una sola vez y se trabaja con cuatro accesos principales: Mes de trabajo, Cargar el mes, Auditar Xubio y Checklist y cierre.

La portada reemplaza el catálogo de herramientas por tres pasos:

1. **Cargar el mes:** compras/ventas ARCA, comprobantes manuales y resumen Comafi. Muestra cantidades reales del período, comprobantes pendientes de revisión y declaraciones explícitas sin actividad. La ausencia de registros no equivale a cero actividad.
2. **Auditar Xubio:** cargar y guardar Libro Diario detallado, Libro Mayor y Sumas y Saldos del mismo período. La portada cuenta clases de reportes archivados, sin interpretar ese conteo como auditoría aprobada. Los archivos sin guardar no incrementan el contador.
3. **Revisar y exportar ajustes:** acceso al exportador existente de faltantes revisados. Después de importar en Xubio, subir reportes actualizados y repetir el cruce. Descargar no confirma registración externa.

La auditoría presenta accesos directos a reportes, cuentas, diagnóstico y exportación. La explicación extensa y los accesos de apoyo se despliegan a pedido. Las cargas y el alcance se revisan antes del diagnóstico; errores, advertencias, posibles faltantes, confirmaciones y controles de exportación permanecen visibles. El acceso desde la portada a Exportar espera la recuperación de los respaldos antes de desplazarse a la sección.

## Herramientas ocasionales

Plan de cuentas, vencimientos IVA/IIBB/TEM, cuentas corrientes, cobros/pagos, devengamientos/sueldos, conciliación, bienes de uso, contabilidad propia y archivos continúan disponibles desde «Datos de la empresa y otras tareas» y «Herramientas de la empresa». El plan y los vencimientos habituales conservan su configuración permanente. Administración agrupa gestión de empresas y configuración.

Se retiran del menú los accesos duplicados, las pantallas pendientes de Bancos/Impuestos/Estados y el banner automático de siguientes pasos. Sus rutas anteriores no se eliminan y siguen identificando pendientes donde corresponde. La guía se abre voluntariamente. No se cambian datos, cálculos, permisos, asientos, validaciones, formatos ni esquema SQL.

## Alcance

La carga continúa siendo por archivos, sin descarga autenticada de ARCA ni conexión directa a Xubio. Los motores existentes conservan su alcance documentado en XUBIO_AUDIT.md y etapa-1/ENTREGA.md. Esta entrega organiza las funciones existentes; no amplía comparaciones fiscales ni integra automáticamente el nuevo Diario propio con el motor anterior de auditoría. Los registros que no tengan fuentes suficientes siguen observados.

No requiere migraciones nuevas. Las activaciones SQL previas del núcleo/eliminación continúan pendientes de acceso administrativo y no se consideran resueltas por este despliegue. No se modificaron datos reales de VIG.IA.
