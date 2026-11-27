# Activación en Supabase

El núcleo tiene lógica, persistencia y pruebas PostgreSQL reales. Publicar el código en Vercel no aplica migraciones SQL. Sin esta activación, las pantallas nuevas informan que requieren base de datos; los módulos anteriores se conservan. No se cargaron pruebas ficticias ni se alteraron datos de VIG.IA en producción.

## Identificar el proyecto correcto

1. En el proyecto de Vercel `sofia-contador`, abrir Settings → Environment Variables y consultar la URL `NEXT_PUBLIC_SUPABASE_URL`. La parte anterior a `.supabase.co` identifica el proyecto. No compartir contraseñas, claves administrativas ni tokens.
2. Ingresar a https://supabase.com/dashboard con la cuenta que administra ese proyecto. Iniciar sesión con GitHub no garantiza pertenencia al proyecto: verificar organización, nombre y referencia. Si lo administra otra persona, solicitarle que haga la activación. Si fue creado mediante un servicio administrado como Lovable Cloud, verificar allí quién administra la base.
3. Confirmar que coincidan proyecto y entorno; realizar un respaldo de la base actual antes de cambios de esquema. No se necesita borrar ni reiniciar empresas, cuentas o documentos.

## Revisar y aplicar

En SQL Editor, ejecutar primero esta consulta de lectura:

```sql
select to_regclass('public.companies') as empresas,
       to_regclass('public.periods') as periodos,
       to_regclass('public.accounts') as cuentas,
       to_regclass('public.vouchers') as comprobantes,
       to_regclass('public.documents') as documentos,
       to_regprocedure('accounting_private.lock_open_period(uuid,uuid,uuid)') as control_de_periodos,
       to_regclass('public.accounting_journal_entries') as nuevo_diario;
```

Los seis primeros deben existir. Si falta alguno, detener la activación: la base aún no tiene los prerrequisitos del sistema existente. Si `nuevo_diario` ya existe, no repetir la migración; comprobar su versión y funciones.

Revisar y ejecutar **solamente** `supabase/migrations/20261127000100_accounting_core.sql`, también disponible como `/activacion-nucleo.sql` en la app. El archivo está transaccionado con BEGIN/COMMIT y no contiene INSERT de datos de prueba, DROP/TRUNCATE, ni modificación de importes reales. Incorpora tablas, índices, referencias, políticas y RPC. No ejecutar los archivos de `supabase/tests` en producción.

Esta migración depende de la base original (las cuatro migraciones de 24/11). El nuevo núcleo no exige activar el libro operativo JSON anterior para funcionar. En instalaciones gestionadas por Supabase CLI, coordinar el historial de migraciones con la persona administradora; no volver a aplicar los archivos antiguos sobre tablas existentes. Preferir el flujo versionado de la organización.

Después de aplicar, comprobar:

```sql
select to_regclass('public.accounting_journal_entries') as diario,
       to_regclass('public.accounting_journal_lines') as detalle,
       to_regprocedure('public.post_accounting_entry(uuid,uuid,date,text,text,jsonb,uuid,uuid,boolean)') as confirmar,
       to_regprocedure('public.reverse_accounting_entry(uuid,uuid,uuid,date,text,text)') as revertir;
```

## Comprobar el entorno conectado

Volver a la app y actualizar. En una empresa de prueba separada, con usuarios de prueba, repetir alta de ejercicio, asiento, consulta, reversión, período cerrado y usuario de solo lectura. Verificar documentos privados y aislamiento entre organizaciones. Esta comprobación con Auth/PostgREST/Storage reales sigue pendiente hasta disponer del acceso; las pruebas realizadas en desarrollo usan PostgreSQL 17 con sustitutos locales de las funciones administradas de Auth/Storage.

No cargar aperturas, capital, IVA ni saldos reales de VIG.IA hasta revisar su ejercicio y documentación. No activar contabilización automática de los módulos anteriores como parte de esta migración.

La independencia respecto del libro operativo anterior se verificó también ejecutando las pruebas SQL y de concurrencia sobre las cuatro migraciones originales más el núcleo, sin las dos migraciones JSON. Esta comprobación local no sustituye la revisión del estado del proyecto remoto.
