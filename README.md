# Sofía | Gestión Contable

**Organizá. Controlá. Simplificá.**

Espacio privado para estudios contables argentinos. Esta primera entrega permite organizar empresas y períodos, seguir el checklist mensual, revisar compras y ventas, importar un plan de cuentas y conservar archivos de respaldo. Incluye calendario manual, indicadores de comprobantes, actividad y alertas básicas.

## Probar en local

Con Node.js 22 o 24, ejecutá estos comandos en la carpeta del proyecto:

```sh
npm ci
SOFIA_DEMO_MODE=1 npm run dev
```

Abrí [Sofía en localhost](http://127.0.0.1:3000). La demo comienza con empresas ficticias y guarda los cambios en el navegador. Incluye archivos de plantilla descargables en **Documentación → Importaciones**. Usá únicamente material sintético.

## Conectar Supabase y Vercel

1. Creá el proyecto Supabase y aplicá las migraciones de [Base de datos](docs/DATABASE.md).
2. Copiá `.env.example` a `.env.local` y configurá la URL y clave publicable del proyecto, el origen de Sofía y su secreto de recuperación. Completá la configuración de acceso y correo en [Seguridad](docs/SECURITY.md).
3. Creá la primera cuenta en Supabase Auth. Ingresá en Sofía y creá el estudio. Para sumar personas a un estudio existente, creá primero sus usuarios en Supabase Auth y asignales un rol con su UUID.
4. Con el repositorio en GitHub, importalo en Vercel como proyecto Next.js, seleccioná Node.js 24 y cargá las variables del ambiente. Definí el dominio canónico y configurá el mismo origen en Supabase.
5. Antes de cargar archivos reales, probá ingreso, recuperación, permisos entre dos organizaciones y carga y descarga privada en el entorno de destino. [Pruebas](docs/TESTING.md)

La demo está limitada al servidor de desarrollo en loopback. El modo conectado valida sesión y permisos y conserva los originales en Supabase Storage.

## Comprobaciones

```sh
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
supabase/tests/run-postgres.sh
```

El estado del proyecto está en [TASKS.md](TASKS.md). Consultá [Producto](docs/PRODUCT.md), [Arquitectura](docs/ARCHITECTURE.md), [Formatos](docs/IMPORT_FORMATS.md) y [Reglas contables](docs/ACCOUNTING_RULES.md) para alcance, datos y supuestos.
