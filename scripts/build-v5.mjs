import { Script } from "node:vm";
import { readFile, writeFile, mkdir } from "node:fs/promises";
const root = new URL("../", import.meta.url),
  out = new URL("downloads/v5/", root);
await mkdir(out, { recursive: true });
const manifest = JSON.parse(
  await readFile(
    new URL("assets/kage-in/gallery/gallery_manifest.json", root),
    "utf8",
  ),
);
let code =
  '"use strict";\nwindow.KAGE_GALLERY=' +
  JSON.stringify(manifest).replace(/</g, "\\u003c") +
  ";\n(() => { const modules = {};\n";
for (const file of ["data.js", "model.js", "render.js", "game.js"]) {
  let src = await readFile(new URL("kage-in-v5/" + file, root), "utf8");
  const names = [
    ...src.matchAll(/export\s+(?:const|class|function)\s+(\w+)/g),
  ].map((m) => m[1]);
  src = src.replace(
    /import\s*\{([^}]+)\}\s*from\s*['"]\.\/([^'"]+)['"];?/g,
    (_, names, dep) =>
      `const {${names.replace(/\b(\w+)\s+as\s+(\w+)\b/g, "$1: $2")}} = modules[${JSON.stringify(dep)}];`,
  );
  src = src.replace(/export\s+(const|class|function)\s/g, "$1 ");
  code += `modules[${JSON.stringify(file)}] = (() => {\n${src}\nreturn {${names.join(",")}};\n})();\n`;
}
code += "})();";
new Script(code);
const css = await readFile(new URL("kage-in-v5/style.css", root), "utf8");
let html = await readFile(new URL("kage-in-v5/index.html", root), "utf8");
html = html
  .replace(
    /<link\s+rel="stylesheet"\s+href="\.\/style\.css"\s*\/?>/,
    () => `<style>${css}</style>`,
  )
  .replace(
    '<script type="module" src="./game.js"></script>',
    () => `<script>${code.replace(/<\/script/gi, "<\\/script")}</script>`,
  );
if (/<(?:link|script)[^>]+(?:href|src)="\.\//.test(html))
  throw Error("External code or style remains");
await writeFile(new URL("KAGE-IN-V5.html", out), html);
const missing = [];
for (const e of manifest.entries) {
  try {
    await readFile(new URL(e.asset, root));
  } catch {
    missing.push({
      id: e.id,
      asset: e.asset,
      sourceFilename: e.sourceFilename,
    });
  }
}
await writeFile(
  new URL("asset-report.json", out),
  JSON.stringify({ source: "PR #9 / 995d7d8", missing }, null, 2),
);
console.log(
  "Built downloads/v5/KAGE-IN-V5.html; missing original art: " +
    missing.length +
    "/7 (placeholder active)",
);
