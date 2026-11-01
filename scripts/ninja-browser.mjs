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
const errors = [],
  url = process.env.GAME_URL || "http://127.0.0.1:3000";
const snap = (p) => p.evaluate(() => window.kageIn.snapshot());
try {
  await mkdir(".local/browser/ninja", { recursive: true });
  const p = await browser.newPage({ viewport: { width: 1440, height: 1120 } });
  p.on("pageerror", (e) => errors.push(e.stack));
  await p.clock.install({ time: new Date("2026-11-01T00:00:00Z") });
  await p.clock.pauseAt(new Date("2026-11-01T00:00:01Z"));
  await p.goto(url);
  await p.screenshot({
    path: ".local/browser/ninja/title.png",
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
  assert.equal((await snap(p)).dojo, true);
  const pos = (await snap(p)).player;
  for (const k of ["w", "a", "s", "d"]) await p.keyboard.press(k);
  await p.clock.runFor(150);
  let s = await snap(p);
  assert.equal(s.player.x, pos.x);
  assert.equal(s.player.y, pos.y);
  await p.keyboard.down("z");
  await p.clock.runFor(1000);
  await p.keyboard.up("z");
  s = await snap(p);
  assert.ok(s.enemies.some((e) => e.airHeight > 0));
  assert.ok(s.player.stats.attacks >= 3);
  await p.keyboard.down("ArrowRight");
  await p.keyboard.press("Space");
  await p.clock.runFor(50);
  await p.keyboard.up("ArrowRight");
  s = await snap(p);
  assert.equal(s.player.followUsed, true);
  assert.ok(s.player.airHeight > 0);
  await p.screenshot({
    path: ".local/browser/ninja/air-chase.png",
    fullPage: true,
  });
  await p.keyboard.down("z");
  let airborneTwo = false;
  for (let i = 0; i < 45; i++) {
    await p.clock.runFor(20);
    s = await snap(p);
    if (s.player.airHits >= 2) {
      airborneTwo = true;
      break;
    }
    if (s.player.airHeight === 0) break;
  }
  assert.ok(
    airborneTwo,
    "two airborne sword hits must be reachable in actual keyboard play",
  );
  await p.keyboard.down("ArrowDown");
  await p.clock.runFor(100);
  await p.keyboard.up("ArrowDown");
  await p.keyboard.up("z");
  s = await snap(p);
  assert.equal(s.player.airHeight, 0);
  assert.ok(s.effects.some((e) => e.type === "impact"));
  await p.screenshot({ path: ".local/browser/ninja/slam.png", fullPage: true });
  console.log(
    "PASS keyboard: title/help/dojo, Z hold third-hit launch, Space air chase, two airborne Z hits, down+Z slam",
  );
  await p.clock.runFor(250);
  const before = (await snap(p)).player;
  await p.keyboard.down("ArrowRight");
  await p.keyboard.down("x");
  await p.keyboard.down("x");
  await p.clock.runFor(250);
  await p.keyboard.up("x");
  await p.keyboard.up("ArrowRight");
  s = await snap(p);
  assert.equal(s.player.dashes, 1);
  assert.ok(s.player.x > before.x);
  await p.keyboard.press("c");
  await p.clock.runFor(170);
  assert.equal((await snap(p)).player.stats.specials, 1);
  await p.keyboard.press("Escape");
  s = await snap(p);
  const time = s.time;
  await p.clock.runFor(500);
  assert.equal((await snap(p)).time, time);
  assert.equal((await snap(p)).screen, "pause");
  await p.keyboard.press("ArrowDown");
  await p.keyboard.press("ArrowDown");
  await p.keyboard.press("Enter");
  assert.equal((await snap(p)).shake, false);
  await p.keyboard.press("ArrowDown");
  await p.keyboard.press("Enter");
  assert.equal((await snap(p)).reducedFlash, true);
  await p.keyboard.press("Escape");
  assert.equal((await snap(p)).screen, "play");
  console.log(
    "PASS keyboard: repeat X consumes one charge, movement/C, pause freezes air/combat time, reduced effects settings",
  );
  // Restart in the actual encounter without debug writes, then verify distinct opponents and real combat.
  await p.keyboard.press("Escape");
  for (let i = 0; i < 4; i++) await p.keyboard.press("ArrowDown");
  await p.keyboard.press("Enter");
  await p.keyboard.press("Enter");
  await p.clock.runFor(100);
  s = await snap(p);
  assert.equal(s.dojo, false);
  assert.deepEqual(
    new Set(s.enemies.map((e) => e.type)),
    new Set(["hungry", "crawler", "spitter"]),
  );
  await p.keyboard.down("z");
  await p.clock.runFor(1700);
  await p.keyboard.up("z");
  s = await snap(p);
  assert.ok(s.player.stats.attacks >= 3);
  assert.ok(s.kills > 0);
  assert.equal(s.player.organs.back, null);
  assert.equal(s.hunter, null);
  await p.screenshot({
    path: ".local/browser/ninja/encounter.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    "PASS encounter: three enemy archetypes, real kills, no legacy organs/hunter UI, no browser runtime errors",
  );
  await p.close();
} finally {
  await browser.close();
}
