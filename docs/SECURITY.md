# Seguridad

## Puesta en marcha del acceso privado

1. Aplicá las migraciones descritas en [Base de datos](DATABASE.md) en el proyecto Supabase del entorno.
2. En **Authentication**, deshabilitá los registros públicos y los accesos anónimos. Habilitá el proveedor de correo y contraseña. Creá en **Users** la cuenta de la primera contadora y confirmá el correo según el flujo administrativo del proyecto.
3. Configurá `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` con los valores del proyecto. La aplicación admite una clave publicable y, en proyectos heredados, el JWT con rol `anon`. Conservá las claves administrativas fuera de Next.js.
4. Configurá `SOFIA_SITE_URL` con el origen canónico de la app. En producción requiere HTTPS. Generá `SOFIA_AUTH_SECRET` con `openssl rand -hex 32`, guardalo como variable privada del entorno y usá un valor independiente por entorno.
5. Configurá **Site URL** en Supabase con el mismo origen, sin barra final, y agregá la URL exacta del flujo de recuperación a **Redirect URLs**, por ejemplo `https://sofia.example.com/auth/confirm`.
6. Configurá el servicio de correo de Supabase para entregar mensajes al equipo previsto. En la plantilla **Reset password**, usá un enlace que lleve a la pantalla de confirmación. El token se canjea cuando la persona elige continuar, lo que preserva el enlace ante vistas previas de correo. [Plantillas de correo de Supabase](https://supabase.com/docs/guides/auth/auth-email-templates)

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=recovery">Restablecer contraseña</a>
```

7. Iniciá sesión en `/ingresar` y creá el estudio. La creadora recibe el rol `owner`. Para incorporar a otra persona, primero creá su usuario en Supabase Auth. Usá su UUID al asignarle un rol desde la organización.
8. Antes de incorporar documentación real, repetí el ingreso, la recuperación por correo, el cierre de sesión y las verificaciones de aislamiento en el entorno destinado al estudio. Usá cuentas de prueba en dos organizaciones distintas, incluyendo un miembro de solo lectura.

## Ingreso con usuario

Las cuentas provisionadas con un alias interno usan en Supabase Auth la dirección `<usuario>@cuentas.sofia.invalid`, confirmada por administración. El inicio de sesión admite ese nombre de usuario o una dirección de correo habilitada. Para que una persona recupere su clave por correo, asignale una dirección real y usá esa dirección para el ingreso.

## Sesiones y autorización

- El servidor comprueba los claims de Supabase en páginas y acciones privadas. El proxy renueva la sesión cuando corresponde y devuelve las respuestas privadas con `Cache-Control: private, no-store`.
- Las cookies de sesión son `HttpOnly`, `SameSite=Lax` y `Secure` en producción. La prueba de recuperación es una cookie `HttpOnly` de alcance restringido, firmada por el servidor y vinculada al identificador de la sesión verificada. Vence a los 15 minutos. Después de cambiar la contraseña se solicita revocar las sesiones del usuario en Supabase y se limpia la sesión local.
- Las respuestas al pedido de recuperación son uniformes ante un correo desconocido u otros rechazos del proveedor. La dirección de retorno se construye a partir del origen configurado en el servidor.
- Los permisos por organización los decide PostgreSQL mediante RLS, privilegios por columna y comprobaciones de rol en las funciones de escritura. Los roles `owner`, `editor` y `viewer` se asignan en cada organización. Las políticas de Storage aplican el mismo alcance.
- La bitácora se genera en PostgreSQL e identifica actor, acción, entidad y contexto. El cliente puede consultar eventos de sus organizaciones según sus permisos. Los motivos y observaciones deben limitarse a la información necesaria para el trabajo contable.

## Documentos

- Los originales se guardan en el bucket privado `accounting-documents`, bajo claves con identificadores de organización, empresa, período y documento. El nombre visible se guarda como metadato autorizado.
- La aplicación revisa el tipo y tamaño del archivo antes de guardarlo. Al pedir una descarga, el servidor consulta los permisos del documento y genera una URL firmada de 60 segundos. Quien tenga esa URL puede usarla hasta el vencimiento. Mantené la URL dentro del flujo de descarga.
- Los documentos registrados son inmutables en el flujo actual. Las políticas permiten al cargador retirar un objeto de Storage mientras este todavía carece de un registro de metadatos.

## Demostración local

`SOFIA_DEMO_MODE=1` habilita la demostración en `next dev`, desde `localhost`, `127.0.0.1` o `[::1]` y con las variables de Supabase vacías. El comando de desarrollo liga el servidor a la interfaz loopback. Si falta parte de la configuración de Supabase, el acceso queda bloqueado.

La compilación de producción deshabilita la demostración, incluso cuando la variable se establece por error. Usá únicamente material sintético en modo demo. Los datos que ingreses ahí se conservan en el navegador y son accesibles desde ese mismo perfil.

## Verificación con el proyecto real

Las pruebas unitarias cubren la validación de formularios, la vinculación y el vencimiento de la prueba de recuperación, y el alcance de la demo. Las pruebas SQL locales ejercitan los permisos con esquemas de plataforma simulados. La comprobación de las sesiones emitidas por el proyecto Supabase, las entregas de correo, el aislamiento a través de PostgREST y las descargas de Storage requiere el proyecto de destino.
