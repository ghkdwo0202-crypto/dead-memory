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
async function pressSeals(p, key) {
  for (let i = 0; i < 3; i++) await p.keyboard.press(key);
  await p.clock.runFor(20);
}
async function dojo(p) {
  await p.goto(url);
  await p.keyboard.press("ArrowDown");
  await p.keyboard.press("Enter");
  await p.clock.runFor(50);
}
try {
  await mkdir(".local/browser/seals", { recursive: true });
  const p = await browser.newPage({ viewport: { width: 1440, height: 1350 } });
  p.on("pageerror", (e) => errors.push(e.stack));
  await p.clock.install({ time: new Date("2026-11-01T00:00:00Z") });
  await p.clock.pauseAt(new Date("2026-11-01T00:00:01Z"));
  for (const [key, id, op, status] of [
    ["a", "NIN_001", "Detonate", "burn"],
    ["s", "NIN_002", "GroundWave", "wet"],
    ["d", "NIN_003", "LightningStrike", "shock"],
    ["f", "NIN_004", "ProjectileFan", "windMark"],
  ]) {
    await dojo(p);
    const pos = (await snap(p)).player;
    await p.keyboard.down(key);
    await p.keyboard.down(key);
    await p.clock.runFor(120);
    await p.keyboard.up(key);
    assert.equal((await snap(p)).ninjutsu.ring.length, 1);
    await p.keyboard.press(key);
    await p.keyboard.press(key);
    await p.clock.runFor(20);
    let s = await snap(p);
    assert.equal(s.ninjutsu.preview, id);
    assert.equal(s.player.x, pos.x);
    assert.equal(s.player.y, pos.y);
    assert.equal(s.player.dashes, 2);
    await p.keyboard.press("v");
    await p.keyboard.press("c");
    await p.clock.runFor(key === "s" ? 340 : 250);
    s = await snap(p);
    assert.equal(s.ninjutsu.invoked[0], id);
    assert.equal(s.ninjutsu.ring.length, 0);
    assert.ok(s.ninjutsu.logs.some((l) => l.op === op));
    assert.ok(s.enemies.some((e) => e.ninjutsuStatuses[status]));
    assert.ok(s.enemies.some((e) => e.hp < 10000));
    assert.equal(s.player.stats.specials, 1);
    await p.screenshot({
      path: `.local/browser/seals/${id}.png`,
      fullPage: true,
    });
    console.log(
      `PASS ${id}: real ${key.toUpperCase()} key repeat filtering, preview, V+C, ${op}, actual ${status}/damage`,
    );
  }
  await dojo(p);
  await pressSeals(p, "a");
  await p.keyboard.press("v");
  await p.keyboard.press("c");
  await p.clock.runFor(600);
  const fireCD = (await snap(p)).ninjutsu.cooldowns.NIN_001;
  await pressSeals(p, "s");
  await p.keyboard.press("v");
  await p.keyboard.press("c");
  await p.clock.runFor(650);
  let s = await snap(p);
  assert.deepEqual(s.ninjutsu.invoked, ["NIN_002", "NIN_001"]);
  assert.ok(s.ninjutsu.cooldowns.NIN_002 > fireCD);
  await p.keyboard.press("v");
  await p.clock.runFor(20);
  s = await snap(p);
  assert.equal(s.ninjutsu.invoked[0], "NIN_001");
  assert.equal(s.ninjutsu.cooldowns.NIN_001, fireCD);
  await p.keyboard.press("c");
  await p.clock.runFor(20);
  assert.equal((await snap(p)).player.stats.specials, 2);
  await p.keyboard.press("a");
  await p.keyboard.press("s");
  await p.keyboard.press("d");
  await p.clock.runFor(20);
  s = await snap(p);
  assert.equal(s.ninjutsu.preview, "NIN_017");
  await p.keyboard.press("v");
  await p.clock.runFor(20);
  assert.equal((await snap(p)).ninjutsu.invoked[0], "NIN_001");
  assert.equal((await snap(p)).ninjutsu.ring.length, 3);
  await p.keyboard.press("Escape");
  const t = (await snap(p)).time;
  await p.clock.runFor(500);
  assert.equal((await snap(p)).time, t);
  await p.keyboard.press("Escape");
  assert.equal((await snap(p)).ninjutsu.ring.length, 3);
  console.log(
    "PASS memories/cooldowns: two slots, empty V switch, no cooldown reset, planned mixed recipe safe, pause retains ring",
  );
  // Actual encounter XP and keyboard reward selection, no mutation/debug commands.
  await p.goto(url);
  await p.keyboard.press("Enter");
  await p.clock.runFor(50);
  await pressSeals(p, "f");
  await p.keyboard.press("v");
  await p.clock.runFor(20);
  for (let i = 0; i < 350; i++) {
    s = await snap(p);
    if (s.screen === "reward") break;
    if (s.mode === "dead") throw new Error("Encounter bot died before reward");
    const target = s.enemies
      .filter((e) => e.hp > 0)
      .sort(
        (a, b) =>
          Math.hypot(a.x - s.player.x, a.y - s.player.y) -
          Math.hypot(b.x - s.player.x, b.y - s.player.y),
      )[0];
    const desired = new Set(["z"]);
    if (target) {
      if (target.x > s.player.x + 25) desired.add("ArrowRight");
      if (target.x < s.player.x - 25) desired.add("ArrowLeft");
      if (target.y > s.player.y + 25) desired.add("ArrowDown");
      if (target.y < s.player.y - 25) desired.add("ArrowUp");
    }
    for (const key of [
      "z",
      "ArrowRight",
      "ArrowLeft",
      "ArrowUp",
      "ArrowDown",
    ]) {
      if (desired.has(key)) await p.keyboard.down(key);
      else await p.keyboard.up(key);
    }
    if (i % 20 === 0) await p.keyboard.press("c");
    await p.clock.runFor(80);
  }
  s = await snap(p);
  assert.equal(s.screen, "reward");
  assert.equal(s.rewardChoices.length, 3);
  const before = s.player.hp,
    level = s.level;
  await p.screenshot({
    path: ".local/browser/seals/reward.png",
    fullPage: true,
  });
  await p.keyboard.press("Enter");
  await p.clock.runFor(20);
  s = await snap(p);
  assert.equal(s.screen, "play");
  assert.equal(s.level, level);
  assert.ok(s.player.hp >= before);
  assert.equal(s.rewardChoices.length, 0);
  console.log(
    "PASS actual XP progression: earned reward via combat, keyboard 3-choice menu, resume without stale combat keys",
  );
  assert.deepEqual(errors, []);
  await p.close();
} finally {
  await browser.close();
}
