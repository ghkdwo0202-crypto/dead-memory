import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const url = process.env.GAME_URL || "http://127.0.0.1:3000",
  errors = [];
const snap = (p) => p.evaluate(() => window.kageIn.snapshot());
async function dojo(p) {
  await p.goto(url);
  await p.keyboard.press("ArrowDown");
  await p.keyboard.press("Enter");
  await p.clock.runFor(100);
}
try {
  await mkdir(".local/browser/sideview", { recursive: true });
  const p = await browser.newPage({ viewport: { width: 1500, height: 1160 } });
  p.on("pageerror", (e) => errors.push(e.stack));
  await p.clock.install({ time: new Date("2026-11-02T00:00:00Z") });
  await p.clock.pauseAt(new Date("2026-11-02T00:00:01Z"));
  await p.goto(url);
  await p.screenshot({
    path: ".local/browser/sideview/title.png",
    fullPage: true,
  });
  await p.keyboard.press("ArrowDown");
  await p.keyboard.press("ArrowDown");
  await p.keyboard.press("Enter");
  assert.equal((await snap(p)).screen, "help");
  await p.keyboard.press("Enter");
  await p.keyboard.press("ArrowDown");
  await p.keyboard.press("Enter");
  await p.clock.runFor(100);
  let s = await snap(p);
  const pos = { x: s.player.x, y: s.player.y };
  await p.keyboard.down("ArrowUp");
  await p.clock.runFor(200);
  await p.keyboard.up("ArrowUp");
  for (const k of ["w", "a", "s", "d", "v"]) await p.keyboard.press(k);
  await p.clock.runFor(100);
  s = await snap(p);
  assert.equal(s.player.x, pos.x);
  assert.equal(s.player.y, pos.y);
  assert.equal("airHeight" in s.player, false);
  assert.equal(s.ninjutsu, undefined);
  assert.equal(await p.locator("#spell-slots").count(), 0);
  await p.keyboard.down("ArrowRight");
  await p.clock.runFor(200);
  await p.keyboard.up("ArrowRight");
  await p.keyboard.press("c");
  await p.clock.runFor(220);
  s = await snap(p);
  assert.equal(s.player.stats.finishers, 1);
  assert.ok(s.enemies.some((e) => e.y < 850));
  await p.screenshot({
    path: ".local/browser/sideview/uppercut.png",
    fullPage: true,
  });
  await p.keyboard.down("ArrowRight");
  await p.keyboard.down("Space");
  await p.clock.runFor(230);
  await p.keyboard.up("ArrowRight");
  await p.keyboard.up("Space");
  await p.keyboard.down("ArrowDown");
  await p.keyboard.press("z");
  await p.clock.runFor(160);
  await p.keyboard.up("ArrowDown");
  s = await snap(p);
  assert.ok(s.player.stats.pogos > 0);
  assert.ok(s.player.vy < 0);
  await p.screenshot({
    path: ".local/browser/sideview/pogo.png",
    fullPage: true,
  });
  console.log(
    "PASS physical sideview: horizontal-only movement, real C launch, jump/down-Z pogo, no airHeight/old slots/V",
  );
  await dojo(p);
  await p.keyboard.down("Space");
  await p.clock.runFor(200);
  await p.keyboard.up("Space");
  await p.keyboard.down("x");
  await p.keyboard.down("x");
  await p.clock.runFor(100);
  await p.keyboard.up("x");
  s = await snap(p);
  assert.equal(s.player.dashes, 1);
  assert.equal(s.player.airDashUsed, true);
  await p.clock.runFor(100);
  await p.keyboard.press("x");
  await p.clock.runFor(20);
  assert.equal((await snap(p)).player.dashes, 1);
  await p.keyboard.press("Escape");
  const t = (await snap(p)).time;
  await p.clock.runFor(500);
  assert.equal((await snap(p)).time, t);
  await p.keyboard.press("ArrowDown");
  await p.keyboard.press("ArrowDown");
  await p.keyboard.press("Enter");
  assert.equal((await snap(p)).shake, false);
  await p.keyboard.press("ArrowDown");
  await p.keyboard.press("Enter");
  assert.equal((await snap(p)).lowFlash, true);
  await p.keyboard.press("Escape");
  console.log(
    "PASS air dash one-per-landing, held-X filtering, physical pause and motion settings",
  );
  await p.goto(url);
  await p.keyboard.press("Enter");
  await p.clock.runFor(100);
  await p.keyboard.down("ArrowRight");
  await p.clock.runFor(2200);
  await p.keyboard.up("ArrowRight");
  s = await snap(p);
  assert.ok(s.player.x <= 666.01);
  assert.ok(s.player.x > 640);
  const wallY = s.player.y;
  await p.keyboard.down("Space");
  await p.keyboard.down("ArrowRight");
  await p.clock.runFor(310);
  await p.keyboard.up("Space");
  await p.keyboard.up("ArrowRight");
  s = await snap(p);
  assert.ok(s.player.y < wallY - 70);
  assert.ok(s.player.x > 666);
  await p.screenshot({
    path: ".local/browser/sideview/wall-jump.png",
    fullPage: true,
  });
  await dojo(p);
  await p.keyboard.down("z");
  await p.clock.runFor(1200);
  await p.keyboard.up("z");
  s = await snap(p);
  assert.ok(s.player.stats.attacks >= 3);
  assert.ok(s.enemies.some((e) => e.hp < 10000));
  assert.equal(s.mode, "playing");
  console.log(
    "PASS actual wall blocks run, jump clears obstacle, Z hold plays three hits with real target damage",
  );
  assert.deepEqual(errors, []);
  await p.close();
} finally {
  await browser.close();
}
