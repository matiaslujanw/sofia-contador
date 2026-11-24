# Decisiones del proyecto

## Alcance inicial y arquitectura

La primera entrega concentra el trabajo diario en empresas, períodos, cierre, documentación, importación, clasificación y seguimiento. El calendario manual y las alertas determinísticas básicas acompañan esos registros. Los módulos con dependencias contables adicionales se desarrollarán a partir de flujos verificables.

Se eligió Next.js con App Router y TypeScript estricto para reunir navegación, validación de acciones y sesiones en el mismo proyecto. Tailwind, componentes propios con primitives de Radix, Lucide e Inter construyen la interfaz. Recharts muestra la evolución de compras y ventas. Supabase se prepara con migraciones versionadas para PostgreSQL, Auth y Storage. GitHub y Vercel son los destinos previstos para la publicación.

## Puesta en marcha privada y demostración

La aplicación conectada usa cuentas existentes de Supabase Auth y membresías explícitas por organización. El cliente de Supabase opera con la sesión de la persona y las restricciones de la base. La configuración de alta de cuentas y recuperación de contraseña se completa en el proyecto Supabase al integrarlo. [Seguridad](SECURITY.md)

La demostración local contiene datos sintéticos. Persiste cambios en el navegador y archivos de prueba en IndexedDB para ejercitar el circuito antes de conectar el backend. La versión conectada persiste en Supabase. El entorno local permite verificar la interfaz y los flujos con archivos de prueba.

## Integridad, concurrencia y trazabilidad

Las claves relacionales incluyen el alcance de empresa y período para impedir vínculos fuera del contexto. Los cambios en un período abierto se coordinan con bloqueos de la base durante cierres y archivados. Los motivos y actores de las transiciones quedan en la bitácora. El plan de cuentas es de nivel empresa y conserva sus códigos y jerarquía. [Base de datos](DATABASE.md)

La operación de confirmación de datos importados y su historial comparten una transacción. El almacenamiento del archivo original se realiza antes, en un paso separado. El servidor intenta limpiar el objeto si falla el registro inicial de sus metadatos. Un original registrado puede quedar disponible en Documentación si falla un paso posterior de la importación. Dos confirmaciones del mismo archivo iniciadas a la vez pueden conservar dos originales, con una sola importación estructurada.

La actualización de la imputación y el guardado opcional de su regla para la contraparte comparten una transacción. Si la regla solicitada se rechaza, el comprobante conserva su imputación previa.

La precisión monetaria se mantiene con `numeric` en PostgreSQL, texto decimal en los intercambios y centavos enteros en los cálculos. La cotización conserva su escala propia. Los montos del gráfico se proyectan para visualización y se acompañan de una tabla de valores exactos. [Reglas contables](ACCOUNTING_RULES.md)

## Compatibilidad de archivos

Se usan plantillas de Sofía y mapeo de encabezados configurable para CSV, XLS y XLSX. Los PDF se guardan como respaldo. El original y su huella SHA-256 acompañan la confirmación. La compatibilidad de un origen externo se valida con exportaciones anonimizadas y casos de prueba antes de anunciarla. Para Xubio queda pendiente la plantilla de asientos validada con una importación real. [Formatos de importación](IMPORT_FORMATS.md)

## Decisiones pendientes

| Tema | Evidencia requerida |
| --- | --- |
| Supabase alojado, Vercel y GitHub | Proyecto Supabase, configuración de Auth, pruebas de aislamiento y Storage en el entorno alojado, y destinos de repositorio y despliegue. |
| ARCA, Banco Comafi y Xubio | Archivos sanitizados y casos esperados por cada origen. La exportación específica de asientos requiere la plantilla confirmada de Xubio. |
| Reportes, asientos y financiamiento | Formatos y criterios de conciliación, clasificación y aprobación, y cuentas por empresa. |
| Configuración fiscal | Jurisdicciones, vigencias, fuentes autorizadas y criterios revisados por la contadora antes de incorporar cálculos. |
| PWA y dispositivos reales | Verificación de la instalación y del uso desde Safari en iPad al preparar la publicación. |
