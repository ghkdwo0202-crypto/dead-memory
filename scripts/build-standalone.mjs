import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { deflateRawSync } from "node:zlib";

const root = new URL("../", import.meta.url);
const output = new URL(".local/standalone/", root);
const files = [
  "storage.js",
  "physics2d.js",
  "side-events.js",
  "sideview-core.js",
  "sideview-render.js",
  "sideview-game.js",
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
const css = await readFile(new URL("src/sideview.css", root), "utf8");
html = html.replace(
  /<link\s+rel="stylesheet"\s+href="\.\/src\/sideview\.css"\s*\/?>/,
  () => `<style>${css}</style>`,
);
html = html.replace(
  /<script\s+type="module"\s+src="\.\/src\/sideview-game\.js"><\/script>/,
  () => `<script>${bundle.replace(/<\/script/gi, "<\\/script")}</script>`,
);
html = html.replace('class="brand" href="./"', 'class="brand" href=""');
if (html.includes('src="./src/') || html.includes('href="./src/'))
  throw new Error("An external game resource remains");
await mkdir(output, { recursive: true });
const file = new URL("KAGE-IN-P3.html", output);
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
const instructions = `KAGE//IN — 횡스크롤 P3-A/B 실행 안내\n\n압축을 풀고 KAGE-IN-P3.html을 Chrome 또는 Edge로 여세요. Node.js/인터넷이 필요하지 않습니다.\n\n좌우 방향키: 달리기\nSpace: 점프 (길게 누르면 높게)\nZ: 검격 3타 / 홀드 반복\n위+Z: 상향 베기 / 공중 아래+Z: 포고\nX: 회피 (공중 1회)\nC: 근접 피니시 (지상 띄우기 / 공중 격추)\n아래+Space: 일방향 발판 내려가기\nEnter: 메뉴 확인 / Esc: 일시정지\n\nV·기억 슬롯은 사용하지 않습니다. 자동 속성 결인은 후속 P3-C 단계입니다.\n`;

const archive = zip([
  ["KAGE-IN-P3.html", html],
  ["START.txt", instructions],
]);
await writeFile(new URL("KAGE-IN-P3.zip", output), archive);
if (process.argv.includes("--release")) {
  const downloads = new URL("downloads/", root);
  await mkdir(downloads, { recursive: true });
  await writeFile(new URL("KAGE-IN-P3.zip", downloads), archive);
}
console.log(`Download archive built: ${archive.length} bytes`);
