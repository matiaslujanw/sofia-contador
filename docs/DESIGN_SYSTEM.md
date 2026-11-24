# Sistema de diseño

## Identidad

Sofía | Gestión Contable usa tres barras ascendentes como marca del estudio y el lema «Organizá. Controlá. Simplificá.». El archivo `public/sofia-mark.svg` se comparte entre navegación e ingreso. `src/app/icon.svg` sirve como favicon y `src/app/manifest.ts` describe el acceso instalable.

Inter Variable se distribuye con la aplicación. El texto de interfaz usa español argentino por defecto. Los montos, porcentajes e identificadores numéricos de tabla usan números tabulares cuando necesitan alineación. El formato monetario conserva la moneda de cada registro.

## Paleta

| Uso | Color |
| --- | --- |
| Fondo | `#10141C` |
| Superficie | `#1C2431` |
| Marca y acción principal | `#818CF8` |
| Confirmación | `#2DD4BF` |
| Atención | `#FBBF24` |
| Error | `#F87171` |
| Texto principal | `#F8FAFC` |
| Texto secundario | `#A0AEC0` |
| Bordes de panel | `#303846` |

Los tokens de `src/app/globals.css` definen además superficies suaves, focos y colores secundarios de cada estado. Los indicadores acompañan el color con texto. La acción principal usa texto oscuro sobre el color de marca.

## Estructura y componentes

- La barra superior mantiene visibles los selectores del contexto de trabajo. Las páginas muestran un título y las acciones disponibles para ese contexto.
- Los paneles agrupan indicadores, listas y gráficos. Las tablas conservan encabezados semánticos, ordenan los datos y alinean importes a la derecha. En espacios angostos, el desplazamiento horizontal queda dentro de la tabla.
- `src/components/workspace-ui.tsx` comparte encabezados, campos, etiquetas de estado, estados vacíos, barras de avance y diálogos. Los formularios mantienen visibles el estado de guardado y los mensajes de validación. Los diálogos usan Radix UI para manejar el foco y el cierre con Escape.
- Los gráficos financieros acompañan los valores con ejes, leyenda o información al interactuar. La falta de datos se comunica explícitamente en las métricas.

## Adaptación y accesibilidad

En escritorio se mantiene el menú lateral. Por debajo de 940 px se abre en un panel a demanda, con el selector en la barra superior. Por debajo de 660 px se apilan los paneles y campos y se reduce a dos columnas la grilla de indicadores. El ingreso pasa a una columna por debajo de 47 rem.

Las rutas privadas incluyen un enlace directo al contenido para teclado. Los controles tienen etiquetas y foco visible. Los encabezados definen la jerarquía de cada pantalla, y los estados que requieren atención usan texto además del color. La interfaz respeta la preferencia de movimiento reducido en los indicadores animados.
