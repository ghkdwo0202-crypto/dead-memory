import test from "node:test";
import assert from "node:assert/strict";
import { NinjaGame } from "../src/ninja.js";
import {
  NINJUTSU,
  SEALS,
  normalizeRecipe,
  recipeFor,
  validateNinjutsu,
} from "../src/ninjutsu-data.js";
function setup() {
  const g = new NinjaGame({ dojo: true, random: () => 0.5 });
  g.enemies = [];
  g.notifications = [];
  return g;
}
function enemy(g, x = 1280, y = 800, type = "hungry") {
  const e = g.spawnEnemy(type, { x, y });
  e.hp = e.maxHP = 10000;
  e.trainingDummy = true;
  return e;
}
function run(g, seconds, input = {}) {
  for (let i = 0; i < Math.ceil(seconds * 120); i++) g.tick(1 / 120, input);
}
function prepare(g, element) {
  g.ninjutsu.queue([element, element, element, "invoke"]);
  g.ninjutsu.input();
  return g.ninjutsu.invoked[0];
}
function cast(g, seconds = 0.6) {
  assert.ok(g.requestAttack(g.player, true));
  run(g, seconds);
}
test("P2 data · 4^3 inputs resolve to exactly 20 multiset recipes; every permutation matches", () => {
  const result = validateNinjutsu();
  assert.deepEqual(result, {
    valid: true,
    errors: [],
    count: 20,
    implemented: 4,
  });
  const found = new Set();
  for (const a of Object.keys(SEALS))
    for (const b of Object.keys(SEALS))
      for (const c of Object.keys(SEALS)) {
        const id = recipeFor([a, b, c])?.id;
        assert.ok(id);
        assert.equal(id, recipeFor([c, a, b]).id);
        assert.equal(id, recipeFor([b, c, a]).id);
        found.add(id);
      }
  assert.equal(found.size, 20);
  assert.ok(Object.isFrozen(NINJUTSU.NIN_001.operations));
});
test("P2 data · fixed F/W/L/V ordering, invalid input rejection and unsupported operations fail validation", () => {
  assert.equal(normalizeRecipe(["wind", "fire", "lightning"]), "FLV");
  assert.equal(normalizeRecipe(["fire", "bogus", "fire"]), null);
  assert.equal(normalizeRecipe(["fire"]), null);
  const registry = structuredClone(NINJUTSU);
  registry.NIN_001.operations = [{ op: "eval" }];
  assert.equal(validateNinjutsu(registry).valid, false);
});
test("P2 seals · FIFO keeps last three, previews exact recipe and grants no movement or invulnerability", () => {
  const g = setup(),
    p = g.player;
  g.ninjutsu.queue(["fire", "water", "lightning", "wind", "invalid"]);
  g.ninjutsu.input();
  assert.deepEqual(g.ninjutsu.ring, ["water", "lightning", "wind"]);
  assert.equal(g.ninjutsu.preview().id, "NIN_020");
  assert.equal(p.x, 1200);
  assert.equal(p.invulnerableUntil, 0);
  assert.equal(p.dashes, 2);
});
test("P2 Invoke · two memories, empty V swaps, duplicate invocation promotes without duplication", () => {
  const g = setup(),
    n = g.ninjutsu;
  prepare(g, "fire");
  prepare(g, "water");
  assert.deepEqual(n.invoked, ["NIN_002", "NIN_001"]);
  n.invoke();
  assert.deepEqual(n.invoked, ["NIN_001", "NIN_002"]);
  prepare(g, "water");
  assert.deepEqual(n.invoked, ["NIN_002", "NIN_001"]);
  assert.deepEqual(n.ring, []);
  prepare(g, "wind");
  assert.deepEqual(n.invoked, ["NIN_004", "NIN_002"]);
});
test("P2 Invoke · incomplete or planned mixed recipe preserves prepared skills and ring", () => {
  const g = setup(),
    n = g.ninjutsu;
  prepare(g, "fire");
  n.queue(["water", "wind"]);
  n.input();
  assert.equal(n.invoke(), false);
  assert.equal(n.ring.length, 2);
  n.queue(["wind"]);
  n.input();
  assert.equal(n.preview().id, "NIN_015");
  assert.equal(n.invoke(), false);
  assert.deepEqual(n.invoked, ["NIN_001", null]);
  assert.equal(n.ring.length, 3);
});
test("P2 cooldown · separate per-spell timers survive switching and re-invoking", () => {
  const g = setup();
  enemy(g);
  prepare(g, "fire");
  cast(g);
  const expiry = g.ninjutsu.cooldowns.NIN_001;
  prepare(g, "water");
  cast(g);
  assert.ok(g.ninjutsu.cooldowns.NIN_002 > expiry);
  prepare(g, "fire");
  assert.equal(g.ninjutsu.cooldowns.NIN_001, expiry);
  assert.equal(g.requestAttack(g.player, true), false);
  assert.equal(g.player.stats.specials, 2);
});
test("P2 input · V then C in same frame prepares and casts new spell before old fallback", () => {
  const g = setup();
  enemy(g);
  g.tick(0.01, {
    sealCommands: ["water", "water", "water", "invoke"],
    specialPressed: true,
  });
  assert.equal(g.player.attack.ninjutsuId, "NIN_002");
  assert.equal(g.player.stats.specials, 1);
  assert.equal(g.player.specialAt, 0);
});
test("P2 input · Z plus two seal edges and diagonal movement retain combat control", () => {
  const g = setup();
  enemy(g);
  g.tick(0.02, {
    right: true,
    down: true,
    attack: true,
    sealCommands: ["fire", "lightning"],
  });
  assert.equal(g.player.stats.attacks, 1);
  assert.deepEqual(g.ninjutsu.ring, ["fire", "lightning"]);
  assert.ok(g.player.x > 1200 && g.player.y > 800);
  assert.ok(Math.abs(g.player.x - 1200 - (g.player.y - 800)) < 0.001);
});
test("P2 buffers · late recovery V/C are deterministic and execute within 0.2s", () => {
  const g = setup(),
    p = g.player;
  enemy(g);
  g.requestAttack(p);
  g.t = p.attack.endAt - 0.1;
  g.tick(0.01, {
    sealCommands: ["water", "water", "water", "invoke"],
    specialPressed: true,
  });
  assert.ok(g.ninjutsu.invokeIntent);
  assert.ok(g.ninjutsu.castIntent?.awaitInvoke);
  run(g, 0.2);
  assert.equal(g.ninjutsu.invoked[0], "NIN_002");
  assert.equal(p.attack.ninjutsuId, "NIN_002");
  assert.equal(p.stats.specials, 1);
});
test("P2 buffers · too-early Invoke expires without consuming ring or silently casting fallback", () => {
  const g = setup(),
    p = g.player;
  g.requestAttack(p);
  g.tick(0.01, {
    sealCommands: ["fire", "fire", "fire", "invoke"],
    specialPressed: true,
  });
  run(g, 0.25);
  assert.equal(g.ninjutsu.invoked[0], null);
  assert.equal(g.ninjutsu.ring.length, 3);
  assert.equal(p.stats.specials, 0);
});
test("P2 buffers · taking damage clears V/C intents but preserves three seals", () => {
  const g = setup(),
    p = g.player,
    e = enemy(g);
  g.requestAttack(p);
  g.tick(0.01, {
    sealCommands: ["fire", "fire", "fire", "invoke"],
    specialPressed: true,
  });
  g.damage(e, p, 1, { attackInstanceId: "interrupt" });
  assert.equal(g.ninjutsu.invokeIntent, null);
  assert.equal(g.ninjutsu.castIntent, null);
  assert.equal(g.ninjutsu.ring.length, 3);
});
test("P2 buffers · changing seals cancels awaiting Invoke+C instead of firing an old spell", () => {
  const g = setup();
  prepare(g, "water");
  g.requestAttack(g.player);
  g.tick(0.01, {
    sealCommands: ["fire", "fire", "fire", "invoke"],
    specialPressed: true,
  });
  g.tick(0.01, { sealCommands: ["wind"] });
  run(g, 0.25);
  assert.equal(g.player.stats.specials, 0);
  assert.equal(g.ninjutsu.invoked[0], "NIN_002");
});
test("P2 FFF · forward explosion damages, burns and pushes; heat is bounded", () => {
  const g = setup(),
    e = enemy(g);
  prepare(g, "fire");
  const x = e.x;
  cast(g);
  assert.ok(e.hp < 10000 - 35);
  assert.ok(e.ninjutsuStatuses.burn);
  assert.ok(e.x > x);
  assert.equal(g.ninjutsu.overheat, 1);
  assert.ok(g.ninjutsu.logs.some((e) => e.op === "Detonate"));
  const hp = e.hp;
  run(g, 2.8);
  assert.ok(e.hp < hp);
  assert.equal(e.ninjutsuStatuses.burn, undefined);
});
test("P2 FFF · ground-only air attempt expires without using cooldown or replacing stored spell", () => {
  const g = setup();
  prepare(g, "fire");
  g.jump();
  assert.equal(g.requestAttack(g.player, true), false);
  run(g, 0.3);
  assert.equal(g.player.stats.specials, 0);
  assert.equal(g.ninjutsu.cooldowns.NIN_001, undefined);
  assert.equal(g.ninjutsu.invoked[0], "NIN_001");
  assert.ok(g.notifications.some((n) => n.text.includes("시전할 수")));
});
test("P2 FFF · landing within C buffer allows ground-only cast and boss cannot be pushed", () => {
  const g = setup(),
    boss = enemy(g, 1280, 800, "boss");
  prepare(g, "fire");
  g.jump();
  run(g, 0.38);
  assert.equal(g.requestAttack(g.player, true), false);
  run(g, 0.35);
  assert.equal(g.player.stats.specials, 1);
  assert.equal(boss.x, 1280);
  assert.equal(boss.airHeight || 0, 0);
});
test("P2 WWW · wave actually travels, wets for four seconds and hits each target only once", () => {
  const g = setup(),
    a = enemy(g),
    b = enemy(g, 1390);
  prepare(g, "water");
  cast(g, 0.9);
  assert.equal(10000 - a.hp, 25);
  assert.equal(10000 - b.hp, 25);
  assert.ok(a.ninjutsuStatuses.wet);
  assert.ok(b.ninjutsuStatuses.wet);
  assert.equal(a.receivedAttacks.size, 1);
  assert.equal(g.ninjutsu.bolts.length, 0);
  assert.ok(a.x > 1280);
});
test("P2 WWW · can be cast airborne; the wave does not push bosses", () => {
  const g = setup(),
    boss = enemy(g, 1300, 800, "boss");
  prepare(g, "water");
  g.jump();
  cast(g, 0.6);
  assert.ok(boss.hp < 10000);
  assert.equal(boss.x, 1300);
});
test("P2 LLL · forward marked target is preferred and shock is a real bounded status", () => {
  const g = setup(),
    near = enemy(g),
    marked = enemy(g, 1400),
    rear = enemy(g, 1100);
  marked.markedBy = g.player.id;
  marked.markUntil = 4;
  prepare(g, "lightning");
  cast(g);
  assert.equal(near.hp, 10000);
  assert.equal(rear.hp, 10000);
  assert.equal(marked.hp, 9960);
  assert.equal(marked.ninjutsuStatuses.shock.stacks, 1);
  g.ninjutsu.cooldowns.NIN_003 = 0;
  g.ninjutsu.globalUntil = 0;
  g.player.attack = null;
  cast(g, 0.2);
  assert.equal(marked.ninjutsuStatuses.shock.stacks, 2);
});
test("P2 LLL · targetless/behind/wall target never consumes C or cooldown", () => {
  const g = setup();
  prepare(g, "lightning");
  assert.equal(g.requestAttack(g.player, true), false);
  enemy(g, 1100);
  assert.equal(g.requestAttack(g.player, true), false);
  g.player.x = 1500;
  g.player.y = 500;
  enemy(g, 1800, 500);
  assert.equal(g.requestAttack(g.player, true), false);
  assert.equal(g.player.stats.specials, 0);
  assert.equal(g.ninjutsu.cooldowns.NIN_003, undefined);
});
test("P2 VVV · two distinct blades launch a mob, share one hit nonce and respect boss conversion", () => {
  const g = setup(),
    e = enemy(g),
    boss = enemy(g, 1360, 800, "boss");
  prepare(g, "wind");
  cast(g, 0.7);
  assert.equal(e.receivedAttacks.size, 1);
  assert.equal(10000 - e.hp, 27);
  assert.ok(e.launchReadyAt > 0);
  assert.equal(boss.airHeight || 0, 0);
  assert.equal(boss.staggerMeter, 25);
  assert.equal(g.ninjutsu.logs[0].op, "ProjectileFan");
});
test("P2 geometry · wave and wind blades stop at walls without hitting targets through them", () => {
  for (const element of ["water", "wind"]) {
    const g = setup();
    g.player.x = 1500;
    g.player.y = 500;
    const e = enemy(g, 1800, 500);
    prepare(g, element);
    cast(g, 1.1);
    assert.equal(e.hp, 10000);
    assert.equal(g.ninjutsu.bolts.length, 0);
  }
});
test("P2 safety · no recursive DOT procs; dead owner cannot finish delayed hits", () => {
  const g = setup(),
    e = enemy(g);
  prepare(g, "fire");
  let procs = 0;
  g.events.on("OnDirectHit", () => procs++);
  cast(g);
  const before = procs;
  run(g, 1);
  assert.equal(procs, before);
  prepare(g, "wind");
  g.player.attack = null;
  cast(g, 0.15);
  g.player.dead = true;
  const hp = e.hp;
  g.ninjutsu.tick(0.2);
  assert.equal(e.hp, hp);
  assert.equal(g.ninjutsu.bolts.length, 0);
});
test("P2 capacity · projectile cap rejects before consuming C; reserved fan slots survive hostile shots", () => {
  const g = setup();
  prepare(g, "wind");
  g.projectiles = Array.from({ length: 349 }, () => ({}));
  assert.equal(g.requestAttack(g.player, true), false);
  assert.equal(g.player.stats.specials, 0);
  assert.equal(g.ninjutsu.cooldowns.NIN_004, undefined);
  g.projectiles = [];
  assert.ok(g.requestAttack(g.player, true));
  assert.equal(g.ninjutsu.reservedProjectiles(), 2);
  const e = enemy(g);
  for (let i = 0; i < 400; i++) g.projectile(e, null, 0);
  assert.equal(g.projectiles.length, 348);
  g.player.attack.executed = true;
  g.ninjutsu.execute(g.player.attack);
  assert.equal(g.projectiles.length + g.ninjutsu.bolts.length, 350);
});
test("P2 progression · actual XP levelup gives three choices, freezes time, rewards applied once", () => {
  const g = new NinjaGame({ random: () => 0.5 });
  g.xp = 14;
  g.tick(0.02, {});
  assert.equal(g.mode, "levelup");
  assert.equal(g.rewardChoices.length, 3);
  const t = g.t;
  g.tick(1, { sealCommands: ["fire"] });
  assert.equal(g.t, t);
  assert.equal(g.choose(99), false);
  const hp = g.player.maxHP;
  assert.equal(g.choose(0), true);
  assert.equal(g.player.maxHP, hp + 20);
  assert.equal(g.choose(0), false);
  assert.equal(g.mode, "playing");
  assert.equal(g.ninjutsu.ring.length, 0);
});
test("P2 tutorial · optional A/S first, lightning at 60s and wind at 90s, normal mode has all four", () => {
  const g = new NinjaGame({ dojo: true, sealTutorial: true });
  g.ninjutsu.queue(["lightning", "fire", "water", "wind"]);
  g.ninjutsu.input();
  assert.deepEqual(g.ninjutsu.ring, ["fire", "water"]);
  g.t = 60;
  g.ninjutsu.queue(["lightning"]);
  g.ninjutsu.input();
  assert.deepEqual(g.ninjutsu.ring, ["fire", "water", "lightning"]);
  assert.equal(g.ninjutsu.unlocked("wind"), false);
  g.t = 90;
  assert.equal(g.ninjutsu.unlocked("wind"), true);
  assert.equal(setup().ninjutsu.snapshot().unlocked.length, 4);
});
test("P2 DOT · burn ticks never freeze the whole game or recursively emit direct hit events", () => {
  const g = setup(),
    e = enemy(g);
  prepare(g, "fire");
  cast(g);
  assert.equal(g.hitstop, 0);
  run(g, 0.7);
  assert.equal(g.hitstop, 0);
  assert.ok(e.hp < 9964);
});
test("P2 air safety · spells count toward the six-hit juggle cap and cannot keep airborne targets forever", () => {
  const g = setup(),
    e = enemy(g);
  g.launch(e);
  e.juggleCount = 5;
  const chain = {
    rootID: "cap",
    depth: 0,
    used: new Map(),
    budget: { count: 0 },
  };
  g.ninjutsu.hit(e, 1, "air-spell", chain);
  assert.equal(e.juggleCount, 6);
  assert.equal(e.airHeight, 0);
  assert.equal(e.juggleUntil, 0);
});
test("P2 global cooldown · instant memory switch cannot cast another spell inside global 0.2s", () => {
  const g = setup();
  enemy(g);
  prepare(g, "water");
  prepare(g, "fire");
  assert.ok(g.requestAttack(g.player, true));
  g.player.attack = null;
  g.ninjutsu.invoke();
  assert.equal(g.requestAttack(g.player, true), false);
  assert.equal(g.player.stats.specials, 1);
  g.t = 0.21;
  assert.ok(g.requestAttack(g.player, true));
  assert.equal(g.player.stats.specials, 2);
});
