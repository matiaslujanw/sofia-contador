# Sistema de diseño

## Identidad

Sofía | Gestión Contable usa tres barras ascendentes como marca del estudio y el lema «Organizá. Controlá. Simplificá.». El archivo `public/sofia-mark.svg` se comparte entre navegación e ingreso. `src/app/icon.svg` sirve como favicon y `src/app/manifest.ts` describe el acceso instalable.

Inter Variable se distribuye con la aplicación. El texto de interfaz usa español argentino por defecto. Los montos, porcentajes e identificadores numéricos de tabla usan números tabulares cuando necesitan alineación. El formato monetario conserva la moneda de cada registro.

## Paleta

| Uso | Color |
| --- | --- |
| Fondo de la aplicación | `#11131C` |
| Superficie | `#1A1E2B` |
| Identidad del símbolo | `#F5B8D0` |
| Acción principal | `#F5B8D0` |
| Confirmación | `#2DD4BF` |
| Atención | `#FBBF24` |
| Error | `#F87171` |
| Texto principal | `#F8FAFC` |
| Texto secundario | `#A0AEC0` |
| Bordes de panel | `#31374A` |

La identidad usa rosa pastel para acciones, navegación activa, gráficos de compras y detalles decorativos. Los fondos oscuros y los colores semánticos de confirmación, atención y error conservan su función.

Los tokens de `src/app/globals.css` definen además superficies suaves, focos y colores secundarios de cada estado. Los indicadores acompañan el color con texto. La acción principal usa texto oscuro sobre el color de marca.

## Estructura y componentes

- Dentro de una empresa, la barra superior mantiene visibles los selectores de empresa y mes. El selector de organización se conserva si corresponde. En el inicio global no se muestra el selector mensual. La navegación muestra las tareas frecuentes y agrupa la configuración, el plan de cuentas, los informes y la auditoría en **Más herramientas**.
- El inicio muestra únicamente tarjetas de empresas activas, con nombre y CUIT, y la acción para agregar una empresa. Al abrir una tarjeta se presenta el espacio de esa empresa, con accesos a todas las tareas e importaciones. Los indicadores y las operaciones se consultan dentro de la empresa.
- En la aplicación conectada, la guía refleja las altas y revisiones reales del estudio. El siguiente paso queda visible durante la configuración y el encabezado conserva el acceso a la guía y al mapa de secciones.
- El recorrido de demostración muestra un paso por vez junto a la pantalla real. Abre las fichas de ejemplo con sus diálogos habituales y permite salir o continuar.
- Los paneles agrupan indicadores, listas y gráficos. Las tablas conservan encabezados semánticos, ordenan los datos y alinean importes a la derecha. En espacios angostos, el desplazamiento horizontal queda dentro de la tabla.
- `src/components/workspace-ui.tsx` comparte encabezados, campos, etiquetas de estado, estados vacíos, barras de avance y diálogos. Los formularios mantienen visibles el estado de guardado y los mensajes de validación. Los diálogos usan Radix UI para manejar el foco y el cierre con Escape.
- Los gráficos financieros acompañan los valores con ejes, leyenda o información al interactuar. La falta de datos se comunica explícitamente en las métricas.

## Adaptación y accesibilidad

En escritorio se mantiene el menú lateral. Por debajo de 940 px se abre en un panel a demanda, con el selector en la barra superior. Por debajo de 660 px se apilan los paneles y campos y se reduce a dos columnas la grilla de indicadores. El ingreso pasa a una columna por debajo de 47 rem.

Las rutas privadas incluyen un enlace directo al contenido para teclado. Los controles tienen etiquetas y foco visible. Los encabezados definen la jerarquía de cada pantalla, y los estados que requieren atención usan texto además del color. La interfaz respeta la preferencia de movimiento reducido en los indicadores animados.

## Ajuste rosa pastel y lila

Se combinan rosa `#F5B8D0` y lila `#D8C7F3` en acciones y navegación. Las tarjetas del inicio usan fondos pastel alternados (`#F7DCE8`/`#E8DDF8`) y texto oscuro para mantener legibilidad; iconos y controles secundarios incorporan lila. Se retira el cuadro explicativo «Tu trabajo contable, mes a mes» del inicio: permanecen identidad, empresas y alta. Los estados de error, atención y confirmación mantienen sus colores semánticos y sus etiquetas.
