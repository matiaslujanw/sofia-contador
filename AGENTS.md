# Sofía · Gestión Contable

- Leé `TASKS.md` y la documentación relevante en `docs/` antes de modificar un flujo. Actualizalos cuando cambien entregas, decisiones o resultados de pruebas.
- El repositorio contiene una app Next.js con App Router, TypeScript estricto y Supabase. Los cambios de infraestructura se llevan en migraciones versionadas. Consultá las guías de la versión instalada cuando uses una API de Next.js.
- Los controles contables viven en `src/lib/workspace` y los formatos en `src/lib/imports`. Conservá los montos exactos con decimales en PostgreSQL y centavos enteros en cálculos locales.
- Preservá el alcance por organización, empresa y período. Verificá permisos en el servidor y contemplá RLS, concurrencia, archivos originales y períodos cerrados.
- Usá archivos y datos sintéticos en desarrollo y pruebas. Mantené claves y documentación real fuera de Git, los logs y las demos.
- Para adaptadores ARCA, Banco Comafi y Xubio, verificá muestras reales antes de afirmar compatibilidad. Registrá los supuestos y las decisiones contables.
- Corré `npm run lint`, `npm run typecheck`, `npm test` y `npm run build`. Usá Playwright para recorridos y PostgreSQL para cambios SQL. Guardá commits locales por entregas. Los cambios en servicios externos se coordinan con la persona usuaria.
