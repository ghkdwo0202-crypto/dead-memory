import { mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
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
async function pageWithClock() {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1050 },
  });
  page.on("pageerror", (e) => errors.push(e.stack));
  await page.addInitScript(() => {
    let seed = 17;
    Math.random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  });
  await page.clock.install();
  await page.goto(url);
  return page;
}
const snapshot = (page) => page.evaluate(() => window.meatMarket.snapshot());
const held = new Set();
async function setKeys(page, names) {
  const next = new Set(names);
  for (const key of held) if (!next.has(key)) await page.keyboard.up(key);
  for (const key of next) if (!held.has(key)) await page.keyboard.down(key);
  held.clear();
  for (const key of next) held.add(key);
}
try {
  await mkdir(".local/browser", { recursive: true });
  const page = await pageWithClock();
  await page.screenshot({
    path: ".local/browser/meat-market-title.png",
    fullPage: true,
  });
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  assert.equal((await snapshot(page)).screen, "help");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.clock.runFor(100);
  let s = await snapshot(page);
  assert.equal(s.mode, "playing");
  const start = { ...s.player };
  await page.keyboard.down("ArrowRight");
  await page.keyboard.down("z");
  await page.clock.runFor(300);
  await page.keyboard.up("ArrowRight");
  await page.keyboard.up("z");
  s = await snapshot(page);
  assert.ok(s.player.x > start.x);
  assert.ok(s.player.stats.attacks > 0);
  await page.keyboard.down("ArrowDown");
  await page.keyboard.press("x");
  await page.clock.runFor(200);
  await page.keyboard.up("ArrowDown");
  s = await snapshot(page);
  assert.equal(s.player.dashes, 1);
  assert.ok(s.player.y > start.y);
  await page.keyboard.press("c");
  await page.clock.runFor(300);
  assert.ok((await snapshot(page)).player.specialAt > 0);
  await page.keyboard.press("Escape");
  const paused = await snapshot(page);
  await page.clock.runFor(500);
  assert.equal((await snapshot(page)).time, paused.time);
  await page.keyboard.press("Enter");
  // Play normal combat using only the documented keys, until the first level reward.
  for (let i = 0; i < 450; i++) {
    s = await snapshot(page);
    if (s.mode === "levelup") break;
    assert.notEqual(s.mode, "dead", "player survived first growth");
    let target = s.enemies.sort(
      (a, b) =>
        Math.hypot(a.x - s.player.x, a.y - s.player.y) -
        Math.hypot(b.x - s.player.x, b.y - s.player.y),
    )[0];
    const orb = s.orbs.sort(
      (a, b) =>
        Math.hypot(a.x - s.player.x, a.y - s.player.y) -
        Math.hypot(b.x - s.player.x, b.y - s.player.y),
    )[0];
    if (
      orb &&
      (!target || Math.hypot(orb.x - s.player.x, orb.y - s.player.y) < 130)
    )
      target = orb;
    const controls = ["z"];
    if (target) {
      const dx = target.x - s.player.x,
        dy = target.y - s.player.y,
        d = Math.hypot(dx, dy);
      if (d > 45) {
        if (dx > 20) controls.push("ArrowRight");
        if (dx < -20) controls.push("ArrowLeft");
        if (dy > 20) controls.push("ArrowDown");
        if (dy < -20) controls.push("ArrowUp");
      }
      if (s.player.specialAt <= s.time && d < 150)
        await page.keyboard.press("c");
    }
    await setKeys(page, controls);
    await page.clock.runFor(100);
  }
  await setKeys(page, []);
  s = await snapshot(page);
  assert.equal(s.mode, "levelup");
  assert.equal(s.rewardChoices.length, 3);
  const frozen = s.time;
  await page.clock.runFor(500);
  assert.equal((await snapshot(page)).time, frozen);
  await page.keyboard.press("ArrowDown");
  assert.equal((await snapshot(page)).selection, 1);
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter");
  await page.clock.runFor(100);
  s = await snapshot(page);
  assert.ok(s.player.organs.back);
  assert.equal(s.mode, "playing");
  await page.screenshot({
    path: ".local/browser/meat-market-combat.png",
    fullPage: true,
  });
  console.log(
    "PASS: keyboard-only menu, movement + attack, directional dash, special, pause, combat, XP, three rewards, graft",
  );
  // Fresh profile: a real death persists through page reload; test summon reproduces that build.
  const life = await pageWithClock();
  await life.keyboard.press("Enter");
  for (let i = 0; i < 30; i++) {
    await life.clock.runFor(3000);
    s = await snapshot(life);
    if (s.mode === "dead") break;
    if (s.mode === "levelup") await life.keyboard.press("Enter");
  }
  s = await snapshot(life);
  assert.equal(s.mode, "dead");
  assert.equal(s.records, 1);
  const saved = s.player.organs;
  await life.reload();
  assert.equal((await snapshot(life)).records, 1);
  await life.keyboard.press("ArrowDown");
  await life.keyboard.press("Enter");
  assert.equal((await snapshot(life)).forceHunter, true);
  await life.keyboard.press("Enter");
  const route = [
    ["ArrowRight", 3000],
    ["ArrowUp", 2000],
    ["ArrowLeft", 3000],
    ["ArrowDown", 2000],
  ];
  for (let i = 0; i < 8; i++) {
    const [key, duration] = route[i % 4];
    await life.keyboard.down(key);
    await life.clock.runFor(duration);
    await life.keyboard.up(key);
    s = await snapshot(life);
    assert.notEqual(s.mode, "dead");
    if (s.mode === "levelup") await life.keyboard.press("Enter");
    if (s.hunter) break;
  }
  s = await snapshot(life);
  assert.ok(s.hunter);
  assert.deepEqual(s.hunter.organs, saved);
  console.log(
    "PASS: real death, persistent archive after reload, keyboard forced hunter, saved organ build",
  );
  assert.deepEqual(errors, []);
  console.log("PASS: no browser runtime errors");
} finally {
  await browser.close();
}
