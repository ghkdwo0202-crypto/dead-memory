import { mkdir } from "node:fs/promises";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } }),
  errors = [];
page.on("pageerror", (e) => errors.push(e.stack));
await page.clock.install();
await mkdir(".local/browser", { recursive: true });
try {
  await page.goto(process.env.GAME_URL || "http://127.0.0.1:3000");
  await page.screenshot({ path: ".local/browser/intro.png", fullPage: true });
  await page.click("#start");
  await page.click('[data-skill="A01"]');
  await page.clock.runFor(300);
  const start = await page.evaluate(() => window.deadMemory.snapshot());
  await page.keyboard.down("d");
  await page.clock.runFor(300);
  await page.keyboard.up("d");
  await page.keyboard.press("Space");
  await page.keyboard.press("q");
  await page.keyboard.press("Escape");
  const paused = await page.evaluate(() => window.deadMemory.snapshot());
  assert.ok(paused.player.x > start.player.x);
  assert.equal(paused.player.dashes, 1);
  assert.ok(paused.player.cooldowns.A01 > paused.time);
  await page.clock.runFor(500);
  assert.equal(
    (await page.evaluate(() => window.deadMemory.snapshot())).time,
    paused.time,
  );
  await page.click("#continue");
  await page.keyboard.press("h");
  await page.click("#close-help");
  await page.keyboard.press("Tab");
  await page.click("#close-loadout");
  await page.screenshot({ path: ".local/browser/arena.png", fullPage: true });
  // Let enemies approach and kill the player through normal combat.
  for (let i = 0; i < 24; i++) {
    await page.clock.runFor(5000);
    const s = await page.evaluate(() => window.deadMemory.snapshot());
    if (s.mode === "dead") break;
  }
  let s = await page.evaluate(() => window.deadMemory.snapshot());
  assert.equal(s.mode, "dead");
  assert.equal(s.records, 1);
  console.log("death and archive", s.records, s.time);
  await page.reload();
  assert.equal(
    await page.evaluate(() => window.deadMemory.snapshot().records),
    1,
  );
  await page.click("#start");
  await page.click('[data-skill="A01"]');
  const box = await page.locator("#game").boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  for (let i = 0; i < 400; i++) {
    s = await page.evaluate(() => window.deadMemory.snapshot());
    if (s.mode === "reward") {
      await page.mouse.up();
      await page.locator("[data-skill]").first().click();
      break;
    }
    assert.notEqual(s.mode, "dead", "combat bot survived first chamber");
    const target = s.enemies.sort(
      (a, b) =>
        Math.hypot(a.x - s.player.x, a.y - s.player.y) -
        Math.hypot(b.x - s.player.x, b.y - s.player.y),
    )[0];
    if (target) {
      await page.mouse.move(
        box.x + ((target.x - s.camera.x) / 1120) * box.width,
        box.y + ((target.y - s.camera.y) / 680) * box.height,
      );
      if (Math.hypot(target.x - s.player.x, target.y - s.player.y) < 140)
        await page.keyboard.press("q");
    }
    await page.clock.runFor(100);
  }
  s = await page.evaluate(() => window.deadMemory.snapshot());
  assert.ok(s.cleared.includes(0), "first room cleared via actual attacks");
  console.log("first chamber combat passed", s.player.hp);
  for (let i = 0; i < 8; i++) {
    await page.clock.runFor(4000);
    s = await page.evaluate(() => window.deadMemory.snapshot());
    if (s.hunter || s.mode === "dead") break;
  }
  assert.ok(s.hunter, "hunter spawned from prior death");
  assert.deepEqual(s.hunter.skills, ["A01"]);
  assert.deepEqual(s.hunter.allowed, []);
  console.log("hunter inherited", s.hunter);
  assert.deepEqual(errors, []);
  console.log("browser lifecycle: passed");
} finally {
  await browser.close();
}
