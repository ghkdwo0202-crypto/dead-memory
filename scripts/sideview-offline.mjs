import http from "node:http";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const html = await readFile(
  new URL("../.local/standalone/KAGE-IN-P3.html", import.meta.url),
);
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
try {
  const p = await browser.newPage(),
    errors = [],
    requests = [];
  p.on("pageerror", (e) => errors.push(e.stack));
  p.on("request", (r) => requests.push(r.url()));
  await p.clock.install({ time: new Date("2026-11-02T00:00:00Z") });
  await p.clock.pauseAt(new Date("2026-11-02T00:00:01Z"));
  await p.goto(`http://127.0.0.1:${port}/`);
  assert.equal(requests.filter((u) => !u.endsWith("favicon.ico")).length, 1);
  await p.context().setOffline(true);
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
  await p.keyboard.press("ArrowDown");
  await p.keyboard.press("Enter");
  await p.clock.runFor(100);
  await p.keyboard.down("ArrowRight");
  await p.keyboard.down("Space");
  await p.clock.runFor(200);
  await p.keyboard.up("Space");
  await p.keyboard.up("ArrowRight");
  await p.keyboard.press("c");
  await p.clock.runFor(200);
  const s = await p.evaluate(() => window.kageIn.snapshot());
  assert.ok(s.player.x > 380);
  assert.equal(s.player.stats.finishers, 1);
  assert.equal(s.phase, "P3-A/B");
  assert.equal("airHeight" in s.player, false);
  assert.deepEqual(errors, []);
  console.log(
    "PASS P3 offline single HTML: no external assets; server stopped/network offline; physical jump, horizontal movement and C finisher work",
  );
} finally {
  await browser.close();
  if (server.listening) {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
}
