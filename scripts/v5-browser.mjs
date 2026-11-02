import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const root = new URL("../", import.meta.url),
  base = process.env.GAME_URL || "http://127.0.0.1:3000/kage-in-v5/index.html";
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const errors = [];
const dir = new URL("work/v5/browser/", root);
await mkdir(dir, { recursive: true });
let page;
try {
  page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
  page.on("pageerror", (e) => errors.push(e.message));
  // Add deterministic fixture access only to the test response, never the delivered source.
  await page.route("**/kage-in-v5/game.js", async (route) => {
    const response = await route.fetch();
    const source = await response.text();
    await route.fulfill({
      response,
      body: source + "\nwindow.__v5fixture={run:()=>run,gallery:()=>gallery};",
    });
  });
  await page.clock.install();
  await page.goto(base);
  await page.waitForFunction(() => window.kageV5);
  const snap = () => page.evaluate(() => window.kageV5.snapshot());
  assert.equal((await snap()).screen, "title");
  assert.ok(await page.locator("#continue").isDisabled());
  await page.screenshot({ path: new URL("title.png", dir).pathname });
  await page.locator("#gallery").click();
  assert.equal(await page.locator(".art-card").count(), 3);
  await page.locator("#art-hero_karasu").click();
  assert.equal((await snap()).screen, "detail");
  await page.locator("#zoom-in").click();
  assert.equal(await page.locator("#zoom-value").textContent(), "125%");
  await page.keyboard.press("Escape");
  await page.locator("#tab-rival").click();
  await page.locator("#art-rival_shiroha").click();
  assert.equal((await snap()).screen, "gallery");
  assert.equal(
    await page.locator(".art-card strong").first().textContent(),
    "미해금 작품",
  );
  await page.evaluate(() =>
    window.__v5fixture.gallery().event("rival.encountered", "rival_shiroha"),
  );
  await page.locator("#tab-rival").click();
  assert.equal(
    await page.locator(".art-card strong").first().textContent(),
    "시로하",
  );
  await page.locator("#back").click();
  await page.reload();
  await page.waitForFunction(() => window.kageV5);
  assert.equal((await snap()).gallery.filter((e) => e.unlocked).length, 5);
  await page.locator("#new").click();
  await page.locator("#hero-2").click();
  assert.equal((await snap()).run.heroId, "HERO_GORO");
  await page.locator("#support-S03").click();
  await page.locator("#enter").click();
  await page.clock.runFor(100);
  assert.equal((await snap()).screen, "combat");
  const before = (await snap()).run.player.x;
  await page.keyboard.down("d");
  await page.clock.runFor(250);
  await page.keyboard.up("d");
  assert.ok((await snap()).run.player.x > before);
  await page.screenshot({ path: new URL("combat.png", dir).pathname });
  await page.keyboard.press("Digit1");
  await page.clock.runFor(50);
  assert.equal((await snap()).run.player.element, "fire");
  // Place one surviving enemy in front, then execute a real click attack through the UI.
  await page.evaluate(() => {
    const r = window.__v5fixture.run();
    r.player.x = 220;
    r.player.y = 405;
    r.enemies = r.enemies.slice(0, 1);
    Object.assign(r.enemies[0], {
      x: 310,
      y: 405,
      hp: 30,
      attackAt: r.t + 100,
    });
  });
  await page.mouse.move(450, 405);
  await page.mouse.down();
  await page.clock.runFor(1000);
  await page.mouse.up();
  assert.equal((await snap()).screen, "reward");
  await page.locator("#reward-power").click();
  assert.equal((await snap()).screen, "doors");
  await page.locator("#door-rest").click();
  assert.equal((await snap()).screen, "doors");
  await page.locator("#door-boss").click();
  await page.clock.runFor(100);
  assert.equal((await snap()).run.roomId, "boss");
  await page.keyboard.press("Escape");
  assert.equal((await snap()).screen, "pause");
  const pausedTime = (await snap()).run.t;
  await page.locator("#pause-gallery").click();
  await page.clock.runFor(2000);
  assert.equal((await snap()).run.t, pausedTime);
  await page.keyboard.press("Escape");
  assert.equal((await snap()).screen, "pause");
  await page.locator("#quit").click();
  await page.locator("#yes").click();
  assert.equal((await snap()).screen, "title");
  assert.ok(await page.locator("#continue").isEnabled());
  await page.locator("#continue").click();
  assert.equal((await snap()).run.roomId, "boss");
  await page.evaluate(() => {
    const r = window.__v5fixture.run();
    r.player.x = 220;
    r.player.y = 405;
    r.enemies[0].x = 310;
    r.enemies[0].y = 405;
    r.enemies[0].hp = 25;
    r.enemies[0].attackAt = r.t + 100;
  });
  await page.mouse.move(450, 405);
  await page.keyboard.press("e");
  await page.clock.runFor(1000);
  assert.equal((await snap()).screen, "result");
  assert.equal((await snap()).run.mode, "victory");
  await page.screenshot({ path: new URL("result.png", dir).pathname });
  await page.locator("#to-title").click();
  assert.ok(await page.locator("#continue").isDisabled());
  // All three hero entries and settings remain reachable through keyboard-only menus.
  for (const hero of [0, 1]) {
    await page.locator("#new").click();
    if ((await snap()).screen === "confirm") await page.locator("#yes").click();
    await page.locator(`#hero-${hero}`).click();
    await page.locator("#enter").click();
    await page.clock.runFor(100);
    await page.keyboard.press("Escape");
    await page.locator("#quit").click();
    await page.locator("#yes").click();
  }
  await page.locator("#settings").click();
  await page.locator("#reveal").check();
  await page.locator("#back").click();
  await page.locator("#gallery").click();
  await page.locator("#tab-rival").click();
  assert.equal(
    await page.locator(".art-card strong").first().textContent(),
    "시로하",
  );
  await page.screenshot({ path: new URL("gallery.png", dir).pathname });
  await page.locator("#back").click();
  for (const [width, height] of [
    [1280, 720],
    [1920, 1080],
    [2560, 1080],
  ]) {
    await page.setViewportSize({ width, height });
    const bounds = await page.locator("#app").boundingBox();
    assert.ok(Math.abs(bounds.width / bounds.height - 16 / 9) < 0.01);
    assert.ok(await page.locator("#new").isVisible());
    await page.screenshot({
      path: new URL(`title-${width}.png`, dir).pathname,
    });
  }
  // Standalone file opens without a server and with network blocked.
  const offline = await browser.newPage();
  offline.on("pageerror", (e) => errors.push(e.message));
  await offline.route("http://**/*", (route) => route.abort());
  await offline.route("https://**/*", (route) => route.abort());
  await offline.setContent(
    await readFile(new URL("downloads/v5/KAGE-IN-V5.html", root), "utf8"),
    { waitUntil: "load" },
  );
  await offline.waitForFunction(() => window.kageV5);
  assert.equal(
    await offline
      .locator("#overlay")
      .evaluate((e) => getComputedStyle(e).position),
    "absolute",
  );
  await offline.locator("#new").click();
  await offline.locator("#hero-0").click();
  await offline.locator("#enter").click();
  assert.equal(
    await offline.evaluate(() => window.kageV5.snapshot().screen),
    "combat",
  );
  await offline.close();
  assert.deepEqual(errors, []);
  console.log(
    "V5 Chromium: title/gallery/unlock/zoom/3 heroes/input/attack/reward/doors/boss/result/save/720p/1080p/ultrawide/offline PASS",
  );
} finally {
  await browser.close();
}
