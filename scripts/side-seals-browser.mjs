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
  await mkdir(".local/browser/side-seals", { recursive: true });
  const p = await browser.newPage({ viewport: { width: 1500, height: 1300 } });
  p.on("pageerror", (e) => errors.push(e.stack));
  await p.clock.install({ time: new Date("2026-11-02T00:00:00Z") });
  await p.clock.pauseAt(new Date("2026-11-02T00:00:01Z"));
  for (const [key, single, mixed] of [
    ["a", "SINGLE_FIRE", "NIN_001"],
    ["s", "SINGLE_WATER", "NIN_002"],
    ["d", "SINGLE_LIGHTNING", "NIN_003"],
    ["f", "SINGLE_WIND", "NIN_004"],
  ]) {
    await dojo(p);
    await p.keyboard.down(key);
    await p.keyboard.down(key);
    await p.clock.runFor(20);
    await p.keyboard.up(key);
    let s = await snap(p);
    assert.equal(s.magic.logs.length, 1);
    assert.equal(s.magic.logs[0].id, single);
    assert.equal(s.magic.seals.length, 1);
    await p.keyboard.press(key);
    await p.clock.runFor(100);
    assert.equal((await snap(p)).magic.logs.length, 1);
    assert.equal((await snap(p)).magic.seals.length, 2);
    await p.keyboard.press(key);
    await p.clock.runFor(450);
    s = await snap(p);
    assert.ok(s.magic.logs.some((l) => l.id === mixed));
    assert.equal(s.magic.seals.length, 0);
    assert.equal(s.player.stats.finishers, 0);
    assert.equal(s.ninjutsu, undefined);
    await p.screenshot({
      path: `.local/browser/side-seals/${mixed}.png`,
      fullPage: true,
    });
    console.log(
      `PASS ${key.toUpperCase()}: first immediate single, second preview, third automatic ${mixed}, no V/C, real render`,
    );
  }
  for (const order of [
    ["a", "s", "d"],
    ["s", "d", "a"],
    ["d", "a", "s"],
  ]) {
    await dojo(p);
    for (const key of order) await p.keyboard.press(key);
    await p.clock.runFor(450);
    const s = await snap(p);
    assert.ok(s.magic.logs.some((l) => l.id === "NIN_017"));
    assert.equal(s.player.stats.finishers, 0);
  }
  console.log(
    "PASS ASD permutations automatically cast NIN017 with no Invoke or C",
  );
  await dojo(p);
  await p.keyboard.press("a");
  await p.clock.runFor(900);
  assert.equal((await snap(p)).magic.seals.length, 0);
  await p.keyboard.press("a");
  await p.keyboard.press("a");
  await p.keyboard.press("a");
  await p.clock.runFor(450);
  let s = await snap(p);
  assert.ok(s.magic.logs.some((l) => l.id === "NIN_001"));
  const cd = s.magic.cooldowns.NIN_001;
  await p.keyboard.press("a");
  await p.keyboard.press("a");
  await p.keyboard.press("a");
  await p.clock.runFor(100);
  s = await snap(p);
  assert.equal(s.magic.cooldowns.NIN_001, cd);
  assert.equal(s.magic.seals.length, 0);
  assert.ok(s.magic.feedback.includes("대기"));
  await p.keyboard.press("v");
  await p.keyboard.press("c");
  await p.clock.runFor(100);
  s = await snap(p);
  assert.equal(s.player.stats.finishers, 1);
  assert.equal(s.player.attack?.finisher, true);
  await p.keyboard.press("Escape");
  const t = s.time;
  await p.clock.runFor(500);
  assert.equal((await snap(p)).time, t);
  assert.equal(await p.locator("#spell-slots").count(), 0);
  console.log(
    "PASS sequence expiry, basic/mixed independent cooldown, failed triple cleanup, V inert and C melee-only",
  );
  assert.deepEqual(errors, []);
  await p.close();
} finally {
  await browser.close();
}
