import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const output = new URL(".local/pages/", root);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(new URL("index.html", root), new URL("index.html", output));
await cp(new URL("src/", root), new URL("src/", output), { recursive: true });
await writeFile(new URL(".nojekyll", output), "");
console.log(`Static game built: ${fileURLToPath(output)}`);
