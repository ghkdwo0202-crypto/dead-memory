import http from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const html = await readFile(
  new URL("../.local/standalone/KAGE-IN.html", import.meta.url),
);
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
try {
  const page = await browser.newPage({
      viewport: { width: 1440, height: 1350 },
    }),
    errors = [],
    requests = [];
  page.on("pageerror", (e) => errors.push(e.stack));
  page.on("request", (r) => requests.push(r.url()));
  await page.clock.install({ time: new Date("2026-11-01T00:00:00Z") });
  await page.clock.pauseAt(new Date("2026-11-01T00:00:01Z"));
  await page.goto(`http://127.0.0.1:${port}/KAGE-IN.html`);
  await page.waitForSelector("#start");
  assert.equal(requests.filter((u) => !u.endsWith("favicon.ico")).length, 1);
  await page.context().setOffline(true);
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await page.clock.runFor(50);
  for (let i = 0; i < 3; i++) await page.keyboard.press("f");
  await page.keyboard.press("v");
  await page.keyboard.press("c");
  await page.clock.runFor(300);
  const s = await page.evaluate(() => window.kageIn.snapshot());
  assert.equal(s.ninjutsu.invoked[0], "NIN_004");
  assert.ok(s.ninjutsu.logs.some((l) => l.op === "ProjectileFan"));
  assert.ok(s.enemies.some((e) => e.airHeight > 0));
  await page.keyboard.down("ArrowRight");
  await page.keyboard.press("Space");
  await page.clock.runFor(50);
  await page.keyboard.up("ArrowRight");
  assert.equal(
    (await page.evaluate(() => window.kageIn.snapshot())).player.followUsed,
    true,
  );
  await mkdir(".local/browser/seals", { recursive: true });
  await page.screenshot({
    path: ".local/browser/seals/offline-wind-chase.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    "PASS offline single HTML: no external resources; server stopped/network offline; seals + Invoke + wind spell + Space chase work",
  );
} finally {
  await browser.close();
  if (server.listening) {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}
