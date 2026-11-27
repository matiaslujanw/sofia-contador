# Auditoría previa — núcleo contable VIG.IA

27/11/2026. Revisión del checkout activo `/workspace/sofia-contador`, commit inicial ac608df. El otro checkout `sofia-contador-github` es anterior y no se modifica. Se inventariaron src, pruebas, migraciones, configuración, portable y documentación; node_modules y archivos reales quedan fuera del relevamiento.

Tecnología: Next.js 16, React 19, TypeScript estricto, Supabase Auth/PostgreSQL/Storage, Zod, SheetJS, unpdf, Vitest y Playwright. La demo local es un adaptador de desarrollo y no reemplaza persistencia PostgreSQL.

Datos existentes: organizations y organization_members/auth.users; companies; periods; accounts; vouchers; classification_rules; documents; imports; close_tasks; tax_obligations; audit_events; book_records. Identidad UUID, referencias compuestas por organización/empresa/período, roles y RLS. Importaciones y libro operativo usan RPC transaccionales. Los originales tienen almacenamiento privado. Las seis migraciones existentes se conservan sin edición.

Módulos encontrados: empresas, plan permanente con importación Xubio, compras/ventas con ARCA/manual, ausencia de actividad, PDF Comafi y papel bancario, checklist/IVA preliminar, fechas fiscales habituales, eventos operativos/pagos/activos/amortizaciones, cartera por CUIT, exportación XLS y auditoría Xubio. Los 98 tests unitarios de base pasan. Esto no demuestra que cada migración esté aplicada ni que existan registros completos en producción.

Brechas: eventos financieros JSON sin cabecera/líneas relacionales; no existe ejercicio explícito ni Diario correlativo; no hay reversión mediante contrasiento ni Mayor/Balance del Diario confirmado; naturaleza, rubro/subrubro, imputabilidad y equivalencias no tienen modelo propio. La cartera usa comprobantes/pagos y los gráficos el libro operativo: no se deben presentar como reportes del nuevo Diario. No se borran ni trasladan automáticamente esos datos.

La documentación señala migraciones operativas pendientes de activación en Supabase. En este entorno no hay URL/credenciales de administración ni conexión SQL de producción; no puede certificarse su estado remoto. La usuaria informa que no sabe acceder a Supabase. Se desarrolla y prueba con PostgreSQL aislado y se entrega activación separada, sin afirmar que un push a Vercel migra la base.

Plan: (1) tablas relacionales adicionales reutilizando entidades existentes; (2) RPC de confirmación y reversión, numeración serializada e idempotencia; (3) propiedades del plan sin alterar cuentas/importadores previos; (4) Diario, Mayor y sumas/saldos calculados desde las mismas líneas aprobadas; (5) navegación explícita con módulos futuros identificados; (6) pruebas unitarias, PostgreSQL/RLS/transacciones y navegador con las cinco operaciones ficticias. Las fechas del ejercicio se ingresan expresamente, sin asumir el cierre real de VIG.IA ni crear cuentas en su plan.

Hallazgo de historial ampliado: la bitácora original identifica actor/acción y campos cambiados, pero no guarda un snapshot completo anterior/posterior. La etapa agrega `accounting_change_history` append-only para el núcleo y futuros cambios del plan. No reconstruye ni inventa valores históricos anteriores a su activación.
