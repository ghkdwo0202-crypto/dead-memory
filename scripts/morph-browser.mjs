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
const errors = [];
const snap = (p) => p.evaluate(() => window.meatMarket.snapshot());
async function enter(page, index, tier) {
  await page.goto(process.env.GAME_URL || "http://127.0.0.1:3000");
  for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  assert.equal((await snap(page)).screen, "path-lab");
  for (let i = 0; i < index; i++) await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  assert.equal((await snap(page)).screen, "path-tier");
  for (let i = 0; i < tier; i++) await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await page.clock.runFor(100);
}
try {
  await mkdir(".local/browser/morph", { recursive: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1050 },
  });
  page.on("pageerror", (e) => errors.push(e.stack));
  await page.clock.install();
  for (const [index, id] of [
    "PATH_01",
    "PATH_06",
    "PATH_17",
    "PATH_25",
  ].entries()) {
    for (let tier = 0; tier <= 3; tier++) {
      await enter(page, index, tier);
      let s = await snap(page);
      assert.equal(s.previewPath, id);
      assert.equal(s.player.activeMorphTier, tier);
      const pos = { x: s.player.x, y: s.player.y };
      await page.keyboard.down("w");
      await page.clock.runFor(100);
      await page.keyboard.up("w");
      s = await snap(page);
      assert.equal(s.player.x, pos.x);
      assert.equal(s.player.y, pos.y);
      if (id === "PATH_17") {
        await page.keyboard.press("x");
        await page.clock.runFor(220);
      }
      await page.keyboard.down("z");
      await page.clock.runFor(
        id === "PATH_06" ? 1000 : id === "PATH_17" ? 250 : 1800,
      );
      await page.keyboard.up("z");
      await page.clock.runFor(130);
      s = await snap(page);
      assert.ok(s.player.stats.attacks > 0);
      if (tier > 0) {
        if (id === "PATH_01")
          assert.ok(s.morphLog.some((l) => l.op === "ArcSlash"));
        if (id === "PATH_06")
          assert.ok(s.morphLog.some((l) => l.op === "PiercingRay"));
        if (id === "PATH_17")
          assert.ok(s.constructs.some((e) => e.kind === "echo"));
        if (id === "PATH_25")
          assert.ok(s.morphLog.some((l) => l.op === "SummonOrder"));
      }
      await page.clock.runFor(500);
      await page.keyboard.press("c");
      await page.clock.runFor(130);
      s = await snap(page);
      assert.ok(s.player.stats.specials > 0);
      await page.screenshot({
        path: `.local/browser/morph/${id}-T${tier}.png`,
        fullPage: true,
      });
      assert.equal(s.mode, "playing");
      assert.equal(s.records, 0);
      console.log(
        `PASS ${id} T${tier}: keyboard lab, Z/X/C, Canvas render, no save`,
      );
    }
  }
  assert.deepEqual(errors, []);
  await page.close();
} finally {
  await browser.close();
}
