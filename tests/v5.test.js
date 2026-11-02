import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  HEROES,
  OFFENSES,
  SUPPORTS,
  FUSIONS,
  fusionFor,
  OBSTACLES,
} from "../kage-in-v5/data.js";
import { Run, SafeStore, GalleryState, RUN_KEY } from "../kage-in-v5/model.js";
const manifest = JSON.parse(
  await readFile(
    new URL("../assets/kage-in/gallery/gallery_manifest.json", import.meta.url),
    "utf8",
  ),
);
function tick(r, seconds, input = {}) {
  for (let i = 0; i < Math.ceil(seconds * 60); i++) r.tick(1 / 60, input);
}
function fixture(hero) {
  const r = new Run(hero);
  r.enter();
  r.enemies = r.enemies.slice(0, 1);
  Object.assign(r.enemies[0], {
    x: 310,
    y: 405,
    hp: 10000,
    maxHP: 10000,
    attackAt: 9999,
  });
  return r;
}
test("V5 registry contains O12/S4 and exactly 48 unique canonical Q names and pairs", () => {
  assert.equal(OFFENSES.length, 12);
  assert.equal(SUPPORTS.length, 4);
  assert.equal(FUSIONS.length, 48);
  assert.equal(new Set(FUSIONS.map((q) => q.name)).size, 48);
  assert.equal(new Set(FUSIONS.map((q) => q.id)).size, 48);
  for (const o of OFFENSES)
    for (const s of SUPPORTS) {
      const q = fusionFor(o.id, s.id);
      assert.ok(q);
      for (const key of [
        "start",
        "active",
        "recovery",
        "targetMethod",
        "collisionGeometry",
        "maxHitsPerTarget",
        "knockback",
        "control",
        "iframePolicy",
        "vfxHooks",
        "cancelWindows",
        "gaugeCost",
        "entityCap",
      ])
        assert.ok(key in q);
      assert.equal(q.implemented, false);
    }
});
test("normalized diagonal and fixed timestep agree across render frame rates", () => {
  const a = fixture(),
    b = fixture(),
    c = fixture();
  for (const r of [a, b, c]) r.enemies[0].x = 1200;
  tick(a, 0.6, { x: 1 });
  tick(b, 0.6, { x: 1, y: 1 });
  assert.ok(
    Math.abs(
      Math.hypot(b.player.x - 220, b.player.y - 405) - (a.player.x - 220),
    ) < 0.01,
  );
  for (let i = 0; i < 12; i++) c.tick(0.05, { x: 1 });
  assert.ok(Math.abs(c.player.x - a.player.x) < 0.01);
});
test("three heroes use distinct cadence and impact; E resolves real multi-hit or heavy attacks", () => {
  const samples = HEROES.map((h) => {
    const r = fixture(h.id);
    tick(r, 0.9, { attack: true, aim: { x: 600, y: 405 } });
    return { r, damage: 10000 - r.enemies[0].hp };
  });
  assert.equal(new Set(samples.map((x) => x.damage)).size, 3);
  for (const h of HEROES) {
    const r = fixture(h.id);
    r.queueAttack("active", 0);
    tick(r, 1);
    assert.ok(r.hits > 0);
    assert.equal(r.player.eAt, 6);
    assert.ok(r.hits >= (h.id === "HERO_GORO" ? 1 : 7));
  }
});
test("same attack instance cannot double-hit and copied hits do not charge gauge", () => {
  const r = fixture();
  const e = r.enemies[0];
  assert.ok(r.hit(e, 10, 123));
  assert.equal(r.hit(e, 10, 123), false);
  const gauge = r.player.gauge;
  r.hit(e, 10, 124, null, 0, false);
  assert.equal(r.player.gauge, gauge);
});
test("infusion remains on a whiff, consumes only a real hit, and changes status", () => {
  const r = fixture();
  r.player.element = "fire";
  r.strike({ id: 101, kind: "primary", face: Math.PI });
  assert.equal(r.player.element, "fire");
  r.strike({ id: 102, kind: "primary", face: 0 });
  assert.equal(r.player.element, null);
  assert.ok(r.enemies[0].burnUntil > r.t);
});
test("dash and teleport cannot cross a wall or leave arena; dash cancels active strikes", () => {
  for (const support of ["S03", "S01"]) {
    const r = fixture();
    r.supportId = support;
    r.player.x = 340;
    r.player.y = 315;
    r.queueAttack("active", 0);
    r.dash({ x: 1, y: 0 });
    assert.equal(r.player.attack, null);
    tick(r, 0.2, { x: 1 });
    assert.ok(r.player.x <= 354.01);
    assert.ok(r.valid(r.player.x, r.player.y));
    if (support === "S03") {
      r.support({ x: 800, y: 315 });
      assert.ok(r.player.x <= 354.01);
    }
  }
});
test("actual dash invulnerability blocks damage; empty dash never applies damage", () => {
  const r = fixture();
  r.player.hurtUntil = 0;
  r.dash({ x: 0, y: 0 });
  const hp = r.player.hp;
  assert.equal(r.damagePlayer(12, 1), false);
  assert.equal(r.player.hp, hp);
  tick(r, 0.2);
  assert.equal(r.damagePlayer(12, 2), true);
  assert.equal(r.player.hp, hp - 12);
});
test("all four supports affect combat or position and honor cooldown", () => {
  for (const s of SUPPORTS) {
    const r = fixture();
    r.supportId = s.id;
    assert.ok(r.support({ x: 350, y: 405 }));
    assert.equal(r.support({ x: 350, y: 405 }), false);
    if (s.id === "S01") assert.ok(r.cloneUntil > 0);
    if (s.id === "S02") assert.ok(r.enemies[0].slowUntil > 0);
    if (s.id === "S03") assert.ok(r.player.x > 220);
    if (s.id === "S04") assert.ok(r.zone.until > 0);
  }
});
test("deterministic seed and room reward/door/boss progression are playable", () => {
  const a = new Run(),
    b = new Run();
  a.enter();
  b.enter();
  assert.deepEqual(a.enemies, b.enemies);
  for (const e of a.enemies) a.hit(e, 9999, a.nextId());
  tick(a, 0.02);
  assert.equal(a.mode, "reward");
  assert.ok(a.reward("power"));
  assert.equal(a.mode, "doors");
  assert.equal(a.reward("power"), false);
  a.enter("rest");
  assert.equal(a.mode, "doors");
  a.enter("boss");
  a.hit(a.enemies[0], 9999, a.nextId());
  tick(a, 0.02);
  assert.equal(a.mode, "victory");
});
test("enemy telegraph deals damage only at completion and death ends run", () => {
  const r = fixture();
  Object.assign(r.enemies[0], { x: 240, attackAt: 0 });
  r.player.hp = 12;
  tick(r, 0.1);
  assert.ok(r.enemies[0].telegraph);
  assert.equal(r.player.hp, 12);
  tick(r, 0.8);
  assert.equal(r.mode, "dead");
  assert.equal(r.player.attack, null);
});
test("valid run snapshot restores and corrupted or unrelated saves are rejected", () => {
  const r = fixture();
  const store = new SafeStore({ getItem: () => null, setItem: () => {} });
  r.save(store);
  const restored = Run.restore(store.read(RUN_KEY));
  assert.equal(restored.heroId, r.heroId);
  assert.equal(restored.enemies.length, 1);
  assert.equal(
    Run.restore({ version: 1, equippedOrganIDs: { arm: "ARM_SAW" } }),
    null,
  );
  const raw = r.snapshot();
  raw.player.x = NaN;
  assert.equal(Run.restore(raw), null);
  raw.player.x = 220;
  raw.ranks.power = 900;
  assert.equal(Run.restore(raw), null);
});
test("gallery has four defaults, per-rival unlock is idempotent and stored separately", () => {
  const store = new SafeStore(null),
    g = new GalleryState(manifest, store);
  assert.equal(g.entries.filter((e) => g.available(e)).length, 4);
  assert.equal(g.event("rival.encountered", "rival_shiroha"), true);
  assert.equal(g.event("rival.encountered", "rival_shiroha"), false);
  assert.equal(g.event("rival.encountered", "bad"), false);
  assert.equal(
    new GalleryState(manifest, store).entries.filter((e) =>
      new GalleryState(manifest, store).available(e),
    ).length,
    5,
  );
  assert.equal(store.read(RUN_KEY, null), null);
  g.reset();
  assert.equal(g.unlocked.size, 0);
});
test("blocked and broken JSON storage recovers with session state and keeps legacy keys untouched", () => {
  const touched = [];
  const store = new SafeStore({
    getItem: (k) => {
      touched.push(k);
      return "{bad";
    },
    setItem: () => {
      throw Error("quota");
    },
  });
  assert.deepEqual(store.read("kage-in.gallery.v1", {}), {});
  store.write("kage-in.gallery.v1", { version: 1, ids: [] });
  assert.equal(store.persistent, false);
  assert.equal(store.read("kage-in.gallery.v1", null).version, 1);
  assert.ok(touched.every((k) => k.startsWith("kage-in.")));
});

test("malformed telegraph state cannot crash a continued run", () => {
  const raw = fixture().snapshot();
  raw.enemies[0].telegraph = { id: 1, x: 220, y: 405, at: 2, radius: "bad" };
  assert.equal(Run.restore(raw), null);
});

test("continue preserves remaining support duration without restoring in-flight attacks", () => {
  const r = fixture();
  r.support({ x: 300, y: 405 });
  r.player.attack = { id: 100, at: 1 };
  const a = Run.restore(r.snapshot());
  assert.equal(a.cloneUntil, r.cloneUntil);
  assert.equal(a.player.attack, null);
  r.supportId = "S04";
  r.player.sAt = 0;
  r.support({ x: 300, y: 405 });
  assert.deepEqual(Run.restore(r.snapshot()).zone, r.zone);
});
