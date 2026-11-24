# Tracker del MVP

## Entrega inicial

| Prioridad | Fase | Estado | Entregable |
| --- | --- | --- | --- |
| P0 | Fundamentos | Implementado | Next.js, TypeScript, Tailwind, marca SVG, sistema visual oscuro, navegación y selección global |
| P0 | Fundamentos | Implementado, validación externa pendiente | Acceso privado, recuperación, organizaciones, gestión de miembros, RLS y bitácora |
| P0 | Fundamentos | Implementado | Empresas, archivo y reactivación, períodos e historial |
| P0 | Operativo | Implementado | Dashboard del estudio, checklist, tareas por período y herencia de definiciones, cierre y reapertura con registro |
| P0 | Operativo | Implementado, validación externa pendiente | Documentos privados por período, descargas firmadas y vínculos a checklist, comprobantes y obligaciones |
| P0 | Operativo | Implementado con plantillas propias | CSV/XLS/XLSX, mapeo, vista previa, deduplicación y conservación del original para compras, ventas y cuentas |
| P0 | Operativo | Bloqueado por muestras | Validar versiones reales de ARCA y del plan de cuentas Xubio |
| P0 | Operativo | Implementado | Revisión de compras y ventas, registros manuales de pago/cobro y Xubio, sugerencias por contraparte |
| P0 | Operativo | Implementado | Plan por empresa con carga manual, importación, jerarquía y clasificación básica |
| P1 | Control | Implementado parcialmente | Calendario manual, primeros indicadores, alertas determinísticas básicas y consulta de actividad |
| P1 | Publicación | Implementado parcialmente | Diseño adaptable, manifiesto e íconos. Falta validar iPad físico y flujo instalable en destino |

## Trabajo pendiente

| Prioridad | Fase | Estado | Entregable y dependencia |
| --- | --- | --- | --- |
| P0 | Publicación | Pendiente de acceso | Crear proyecto Supabase, configurar Auth/SMTP, aplicar migraciones y verificar dos estudios aislados |
| P0 | Publicación | Pendiente de acceso | GitHub, proyecto en Vercel, variables, HTTPS y verificación del despliegue |
| P1 | Automatización | Pendiente | Cuentas bancarias, saldos, extractos, movimientos manuales y conciliación por cuenta, fecha y moneda |
| P1 | Automatización | Bloqueado por muestras | Adaptador Banco Comafi con extractos PDF de texto, casos sin movimientos y reversos |
| P1 | Automatización | Pendiente | Socios y tipos de financiamiento, respaldos y propuestas de asientos |
| P1 | Automatización | Pendiente | Asientos, líneas, estados, aprobación, prevención de registraciones duplicadas y exportación CSV/XLSX |
| P1 | Automatización | Bloqueado por muestras | Balance, Libro Mayor, listados de asientos y adaptador de exportación Xubio |
| P1 | Control | Pendiente | Papeles de trabajo, reglas por vigencia y jurisdicción, crédito/débito computable, liquidaciones preliminares y Excel |
| P1 | Control | Pendiente | Saldos, flujo de fondos, gastos, costos, créditos, deudas, rentabilidad y alertas adicionales con resolución |
| P2 | Publicación | Pendiente | Auditoría de seguridad integral con el ambiente real, evaluación de rendimiento e instalación en iPad |
| P2 | Futuro | Pendiente | Asistente opcional, permisos de uso de datos y automatización de vencimientos |

## Pruebas y decisiones

- Corrió la prueba de las migraciones y RLS en PostgreSQL 17 con esquemas simulados para los servicios de Supabase. Se verificaron contratos en un PostgREST local.
- Pasaron ESLint, TypeScript, 32 pruebas Vitest y el build de producción. El build sirvió el manifiesto y mantuvo el acceso privado con la demo deshabilitada.
- Pasaron los 10 recorridos Playwright en cada motor, Chromium y WebKit. Se verificó la interfaz en medidas de escritorio, tablet y teléfono. Se corrigió un fallo de WebKit al guardar archivos en IndexedDB y se repitieron la carga, la importación y la descarga.
- El registro de decisiones está en [Decisiones](docs/DECISIONS.md). Pendientes de verificación externa en [Pruebas](docs/TESTING.md).
