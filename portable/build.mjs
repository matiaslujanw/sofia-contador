import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const local = (path) => fileURLToPath(new URL(path, import.meta.url));
const buildOutput = await build({
  root: local("../"),
  configFile: false,
  envDir: false,
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  publicDir: false,
  resolve: {
    alias: [
      { find: "@/lib/workspace/actions", replacement: local("server-unavailable.ts") },
      { find: "@/lib/supabase/auth-actions", replacement: local("server-unavailable.ts") },
      { find: "next/link", replacement: local("navigation.tsx") },
      { find: "next/navigation", replacement: local("navigation.tsx") },
      { find: "next/image", replacement: local("image.tsx") },
      { find: "@", replacement: local("../src") },
    ],
  },
  build: {
    write: false,
    target: "es2022",
    cssCodeSplit: false,
    license: { fileName: "dependencies.md" },
    rolldownOptions: {
      onLog(level, log, handler) {
        if (log.code !== "MODULE_LEVEL_DIRECTIVE") handler(level, log);
      },
    },
    lib: { entry: local("main.tsx"), name: "SofiaDemo", formats: ["iife"] },
  },
});

const bundle = Array.isArray(buildOutput) ? buildOutput[0] : buildOutput;
const scripts = bundle.output.filter((entry) => entry.type === "chunk");
const styles = bundle.output.filter((entry) => entry.type === "asset" && entry.fileName.endsWith(".css"));
const license = bundle.output.find((entry) => entry.type === "asset" && entry.fileName === "dependencies.md");
if (scripts.length !== 1 || styles.length !== 1 || !license || license.type !== "asset" || bundle.output.length !== 3) {
  throw new Error("La demo debe incluir todos sus recursos en un solo archivo.");
}

const css = String(styles[0].source).replace(/<\/style/gi, "<\\/style");
const fontLicense = await readFile(local("../node_modules/@fontsource-variable/inter/LICENSE"), "utf-8");
const notices = `${license.source}\n\nInter\n${fontLicense}`.replace(/<\/script/gi, "<\\/script");
const code = scripts[0].code.replace(/<\/script/gi, "<\\/script");
const html = `<!doctype html>
<html lang="es-AR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="robots" content="noindex, nofollow">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; object-src 'none'; base-uri 'none'; form-action 'none'">
  <title>Sofía | Recorrido de demostración</title>
  <style>${css}</style>
</head>
<body>
  <div id="demo"></div>
  <noscript>Para usar el recorrido, abrí este archivo en un navegador con JavaScript activado.</noscript>
  <script type="text/plain" id="third-party-notices">${notices}</script>
  <script>${code}</script>
</body>
</html>`;

const output = process.argv[2] ? resolve(process.argv[2]) : local("../demo-dist/Sofia-demo.html");
await mkdir(dirname(output), { recursive: true });
await writeFile(output, html);
console.log(output);
