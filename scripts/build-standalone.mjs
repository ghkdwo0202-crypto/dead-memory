import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { deflateRawSync } from "node:zlib";

const root = new URL("../", import.meta.url);
const output = new URL(".local/standalone/", root);
const files = [
  "data.js",
  "navigation.js",
  "storage.js",
  "action-paths.js",
  "action-morph.js",
  "core.js",
  "ninjutsu-data.js",
  "ninjutsu.js",
  "ninja.js",
  "ninja-render.js",
  "ninja-game.js",
];
let bundle = '"use strict";\n(() => {\nconst modules = Object.create(null);\n';

// Bundle this project's named ES modules without eval, network requests or a runtime loader.
for (const file of files) {
  let source = await readFile(new URL(`src/${file}`, root), "utf8");
  const names = [
    ...source.matchAll(/export\s+(?:const|let|class|function)\s+(\w+)/g),
  ].map((match) => match[1]);
  source = source.replace(
    /export\s*\{([^}]+)\}\s*from\s*["']([^"']+)["'];?/g,
    (_, exported) => {
      names.push(
        ...exported
          .split(",")
          .map((name) => name.trim())
          .filter(Boolean),
      );
      return "";
    },
  );
  source = source.replace(
    /import\s*\{([^}]+)\}\s*from\s*["']\.\/([^"']+)["'];?/g,
    (_, imported, dependency) =>
      `const {${imported}} = modules[${JSON.stringify(dependency)}];`,
  );
  source = source.replace(/export\s+(const|let|class|function)\s/g, "$1 ");
  if (/^\s*(?:import|export)\s/m.test(source))
    throw new Error(`Unsupported module syntax: ${file}`);
  bundle += `modules[${JSON.stringify(file)}] = (() => {\n${source}\nreturn {${[...new Set(names)].join(",")}};\n})();\n`;
}
bundle += "})();\n";

let html = await readFile(new URL("index.html", root), "utf8");
const css = await readFile(new URL("src/ninja.css", root), "utf8");
html = html.replace(
  /<link\s+rel="stylesheet"\s+href="\.\/src\/ninja\.css"\s*\/?>/,
  () => `<style>${css}</style>`,
);
html = html.replace(
  /<script\s+type="module"\s+src="\.\/src\/ninja-game\.js"><\/script>/,
  () => `<script>${bundle.replace(/<\/script/gi, "<\\/script")}</script>`,
);
html = html.replace('class="brand" href="./"', 'class="brand" href=""');
if (html.includes('src="./src/') || html.includes('href="./src/'))
  throw new Error("An external game resource remains");
await mkdir(output, { recursive: true });
const file = new URL("KAGE-IN.html", output);
await writeFile(file, html);
console.log(`Offline game built: ${fileURLToPath(file)}`);

// A small standards-based ZIP writer keeps the download build dependency-free.
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function zip(entries) {
  const local = [],
    central = [];
  let offset = 0;
  for (const [filename, text] of entries) {
    const name = Buffer.from(filename),
      bytes = Buffer.from(text),
      compressed = deflateRawSync(bytes),
      crc = crc32(bytes);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x800, 6);
    header.writeUInt16LE(8, 8);
    header.writeUInt16LE(0x21, 12);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(compressed.length, 18);
    header.writeUInt32LE(bytes.length, 22);
    header.writeUInt16LE(name.length, 26);
    local.push(header, name, compressed);
    const directory = Buffer.alloc(46);
    directory.writeUInt32LE(0x02014b50, 0);
    directory.writeUInt16LE(20, 4);
    header.copy(directory, 6, 4, 30);
    directory.writeUInt32LE(offset, 42);
    central.push(directory, name);
    offset += header.length + name.length + compressed.length;
  }
  const directory = Buffer.concat(central),
    end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
}
const instructions = `KAGE//IN — 실행 안내\n\n1. ZIP 압축을 풉니다.\n2. KAGE-IN.html을 Chrome 또는 Edge로 엽니다.\n3. Enter를 눌러 출격합니다. 방향키로 검술 수련장을 선택할 수도 있습니다.\n\n방향키: 이동 / 메뉴 선택\nZ: 공격 (길게 누르기 가능)\nX: 회피\nSpace: 점프 / 공중 추격\nA/S/D/F: 화/수/뇌/풍 결인\n같은 인 3개 입력 후 V: 인술 준비\nV (빈 결인): 두 슬롯 교대\nC: 인술 발동 (준비가 없으면 표창)\nEnter: 확인\nEsc: 일시정지\n\n4개 순수 인술만 시전됩니다. 혼합 인술은 다음 업데이트 예정입니다.\n\nNode.js, 개발 서버, 인터넷 연결이 필요하지 않습니다.\n`;
const archive = zip([
  ["KAGE-IN.html", html],
  ["START.txt", instructions],
]);
await writeFile(new URL("KAGE-IN.zip", output), archive);
if (process.argv.includes("--release")) {
  const downloads = new URL("downloads/", root);
  await mkdir(downloads, { recursive: true });
  await writeFile(new URL("KAGE-IN.zip", downloads), archive);
}
console.log(`Download archive built: ${archive.length} bytes`);
