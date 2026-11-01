import test from "node:test";
import assert from "node:assert/strict";
import {
  Actor,
  Game,
  CombatEvents,
  OrganSystem,
  direction,
  targetFor,
  rewardCandidates,
  applyReward,
  loadDeaths,
  saveDeath,
  createHunter,
  SAVE_KEY,
} from "../src/core.js";
import {
  CONFIG,
  ORGANS,
  MUTATIONS,
  STATUSES,
  compatible,
} from "../src/data.js";
const store = () => {
  const data = new Map();
  return {
    getItem: (k) => data.get(k) || null,
    setItem: (k, v) => data.set(k, v),
  };
};
function fixture() {
  const game = new Game({ storage: store(), random: () => 0.5 });
  game.enemies = [];
  game.spawnAt = Infinity;
  game.eliteAt = Infinity;
  game.hunterChecked = true;
  const enemy = game.spawnEnemy("hungry", { x: 1290, y: 800 });
  enemy.hp = enemy.maxHP = 1000;
  enemy.speed = 0;
  enemy.nextAttack = Infinity;
  return { game, p: game.player, e: enemy };
}
function step(game, seconds, input = {}) {
  for (let t = 0; t < seconds; t += 0.02)
    game.tick(Math.min(0.02, seconds - t), input);
}
test("01 · arrows produce all eight normalized movement directions", () => {
  const inputs = [
    { up: 1 },
    { down: 1 },
    { left: 1 },
    { right: 1 },
    { up: 1, left: 1 },
    { up: 1, right: 1 },
    { down: 1, left: 1 },
    { down: 1, right: 1 },
  ];
  for (const input of inputs)
    assert.ok(
      Math.abs(Math.hypot(...Object.values(direction(input))) - 1) < 1e-10,
    );
});
test("02 · diagonal distance equals cardinal distance", () => {
  const a = fixture(),
    b = fixture();
  step(a.game, 0.4, { right: true });
  step(b.game, 0.4, { right: true, down: true });
  assert.ok(
    Math.abs(
      Math.hypot(a.p.x - 1200, a.p.y - 800) -
        Math.hypot(b.p.x - 1200, b.p.y - 800),
    ) < 0.001,
  );
});
test("03 · movement and Z attack work together", () => {
  const { game, p, e } = fixture();
  step(game, 0.22, { right: true, attack: true });
  assert.ok(p.x > 1200);
  assert.ok(e.hp < 1000);
  assert.ok(p.stats.attacks > 0);
});
test("04 · directional X dash moves with two charges and no mouse", () => {
  const { game, p } = fixture();
  game.tick(0.02, { up: true, dashPressed: true });
  step(game, 0.16);
  assert.ok(p.y < 710);
  assert.equal(p.dashes, 1);
  assert.ok(p.invulnerableUntil > 0);
});
test("05 · C special is stronger and respects cooldown", () => {
  const { game, p, e } = fixture();
  assert.equal(game.requestAttack(p, true), true);
  step(game, 0.3);
  assert.ok(e.hp <= 1000 - 46.2);
  assert.equal(game.requestAttack(p, true), false);
  assert.equal(p.stats.specials, 1);
});
test("06 · rewards can be chosen by index without pointer input and freeze time", () => {
  const { game, p } = fixture();
  game.xp = game.xpRequired;
  game.checkLevel();
  const now = game.t;
  assert.equal(game.mode, "levelup");
  game.tick(0.04, { attack: true });
  assert.equal(game.t, now);
  assert.equal(game.choose(0), true);
  assert.equal(game.mode, "playing");
  assert.ok(p.organs.back);
});
test("07 · simultaneous movement + attack + dash buffers input instead of dropping it", () => {
  const { game, p } = fixture();
  game.tick(0.02, { right: true, attack: true, dashPressed: true });
  assert.ok(p.buffer);
  step(game, 0.28, { right: true });
  assert.equal(p.dashes, 1);
  assert.ok(p.stats.attacks >= 1);
  assert.ok(p.x > 1300);
});
test("08 · aim assist respects angle and distance, fallback retains facing", () => {
  const { p } = fixture();
  p.face = 0;
  const behind = new Actor({ x: 1100, y: 800 }),
    far = new Actor({ x: 1900, y: 800 }),
    front = new Actor({ x: 1250, y: 820 });
  assert.equal(targetFor(p, [behind, far]), null);
  assert.equal(targetFor(p, [behind, far, front]), front);
  assert.equal(p.face, 0);
});
test("09 · direct attacks do not damage out-of-range enemies", () => {
  const { game, p, e } = fixture();
  e.x = 1500;
  game.requestAttack(p);
  step(game, 0.2);
  assert.equal(e.hp, 1000);
});
test("10 · invulnerability rejects actual incoming damage and emits evade once per dash", () => {
  const { game, p, e } = fixture();
  let evades = 0;
  game.events.on("OnSuccessfulEvade", () => evades++);
  game.dash(p, { right: true });
  assert.equal(game.damage(e, p, 10), 0);
  assert.equal(game.damage(e, p, 10), 0);
  assert.equal(p.hp, 120);
  assert.equal(evades, 1);
  game.t = 0.17;
  assert.equal(game.damage(e, p, 10), 10);
});
test("11 · dash recharges one charge at a time, capped at two", () => {
  const { game, p } = fixture();
  game.dash(p);
  step(game, 0.25);
  game.dash(p);
  assert.equal(p.dashes, 0);
  step(game, 2.3);
  assert.equal(p.dashes, 1);
  step(game, 2.55);
  assert.equal(p.dashes, 2);
});
test("12 · early attack input is rejected; recovery input buffers and executes once", () => {
  const { game, p } = fixture();
  game.requestAttack(p);
  assert.equal(game.requestAttack(p), false);
  assert.equal(p.buffer, null);
  game.t = 0.2;
  game.requestAttack(p);
  assert.ok(p.buffer);
  step(game, 0.2);
  assert.equal(p.stats.attacks, 2);
  game.t = 2;
  p.attack = null;
  p.buffer = { special: false, until: 1 };
  game.updateActor(p, 0.02);
  assert.equal(p.attack, null);
});
test("13 · grafted automatic organs deal damage without action inputs", () => {
  for (const id of ["BACK_TENTACLE", "BACK_TURRET", "BACK_BLADES"]) {
    const { game, p, e } = fixture();
    e.x = p.x + 80;
    OrganSystem.equip(p, id);
    step(game, 1.6);
    assert.ok(e.hp < 1000, id);
    assert.ok(p.stats.auto > 0, id);
  }
});
test("14 · replacing organs removes old mutations and stops old automatic behavior", () => {
  const { game, p, e } = fixture();
  OrganSystem.equip(p, "BACK_TENTACLE");
  OrganSystem.mutate(p, "MUT05", "BACK_TENTACLE");
  OrganSystem.equip(p, "BACK_TURRET");
  assert.equal(p.organs.back, "BACK_TURRET");
  assert.equal(p.mutations.length, 0);
  e.x = 1500;
  game.autoAttack(p);
  assert.ok(game.projectiles.length);
  assert.ok(!game.effects.some((x) => x.type === "tentacle"));
});
test("15 · compatible mutation fires on its event and internal cooldown prevents duplicates", () => {
  const { game, p, e } = fixture();
  OrganSystem.mutate(p, "MUT03", "ARM_SAW");
  game.damage(p, e, 20, { organID: "ARM_SAW", direct: true });
  const blasts = game.effects.filter((x) => x.type === "blast");
  assert.equal(blasts.length, 1);
  game.damage(p, e, 20, { organID: "ARM_SAW", direct: true });
  assert.equal(game.effects.filter((x) => x.type === "blast").length, 1);
});
test("16 · incompatible and duplicate mutations cannot be equipped", () => {
  const { p } = fixture();
  assert.equal(OrganSystem.mutate(p, "MUT01", "ARM_SAW"), false);
  assert.equal(OrganSystem.mutate(p, "MUT05", "ARM_SAW"), true);
  assert.equal(OrganSystem.mutate(p, "MUT05", "ARM_SAW"), false);
  assert.equal(OrganSystem.mutate(p, "MUT03", "BACK_TURRET"), false);
});
test("17 · recursive event effects are bounded and deterministic", () => {
  const bus = new CombatEvents(),
    order = [];
  bus.on("OnHit", (event) => {
    order.push(event.context.depth);
    bus.emit("OnHit", {}, event.context);
  });
  bus.emit("OnHit");
  assert.deepEqual(order, [0, 1, 2, 3, 4]);
  assert.ok(bus.processed <= CONFIG.maxChainEvents);
});
test("18 · every generated reward is usable, no duplicates, at least one synergy", () => {
  const { p } = fixture();
  for (let i = 0; i < 100; i++) {
    const choices = rewardCandidates(p);
    assert.equal(choices.length, 3);
    assert.ok(choices.some((r) => r.synergy));
    for (const reward of choices) {
      if (reward.kind === "organ")
        assert.notEqual(p.organs[ORGANS[reward.id].slot], reward.id);
      if (reward.kind === "mutation")
        assert.ok(compatible(reward.organID, reward.id));
    }
  }
});
test("19 · death archives organs, mutations, profiles and combat stats", () => {
  const storage = store(),
    { p } = fixture();
  OrganSystem.equip(p, "BACK_TENTACLE");
  OrganSystem.mutate(p, "MUT05", "ARM_SAW");
  p.stats.direct = 52;
  const record = saveDeath(storage, p, {
    runID: "test",
    time: 42,
    cause: "test",
  });
  assert.equal(record.deathTime, 42);
  assert.equal(record.combatStatistics.direct, 52);
  assert.equal(record.mainAttackProfile, "ARM_SAW");
  assert.equal(record.equippedOrganIDs.back, "BACK_TENTACLE");
  assert.equal(loadDeaths(storage).length, 1);
});
test("20 · reopening storage restores records and ignores old DEAD MEMORY data", () => {
  const storage = store(),
    { p } = fixture();
  storage.setItem("dead-memory.deaths.v1", '[{"legacy":true}]');
  saveDeath(storage, p, { runID: "persist" });
  assert.equal(
    loadDeaths({ getItem: (k) => storage.getItem(k) })[0].runID,
    "persist",
  );
  assert.equal(storage.getItem("dead-memory.deaths.v1"), '[{"legacy":true}]');
});
test("21 · hunter reproduces saved arm, auto organs and compatible mutations only", () => {
  const { p } = fixture();
  OrganSystem.equip(p, "ARM_SPINE");
  OrganSystem.equip(p, "BACK_TURRET");
  OrganSystem.mutate(p, "MUT02", "ARM_SPINE");
  const record = saveDeath(store(), p, { runID: "test" }),
    h = createHunter(record, 1000, 800);
  assert.deepEqual(h.organs, p.organs);
  assert.deepEqual(h.mutations, p.mutations);
  assert.equal(h.arm.id, "ARM_SPINE");
  assert.equal(h.team, "hunter");
});
test("22 · hunter attacks telegraph at least .42s and can be evaded", () => {
  const { game, p } = fixture();
  const record = saveDeath(store(), p, { runID: "test" }),
    h = createHunter(record, 1270, 800);
  game.enemies = [h];
  game.hunter = h;
  h.face = Math.PI;
  game.requestAttack(h);
  assert.ok(h.attack.activeAt - game.t >= 0.42);
  game.t = 0.4;
  game.dash(p, { left: true });
  game.t = 0.43;
  game.updateActor(h, 0.03);
  assert.equal(p.hp, 120);
});
test("organ registry resolves 22 IDs, exposes 12 implemented organs and retains 12 legacy mutations", () => {
  assert.equal(Object.keys(ORGANS).length,22);
  assert.equal(Object.values(ORGANS).filter(o=>o.implemented!==false).length,12);
  assert.equal(Object.keys(MUTATIONS).length, 12);
  for (const o of Object.values(ORGANS))
    for (const k of [
      "id",
      "name",
      "slot",
      "description",
      "tags",
      "baseStats",
      "triggerConditions",
      "effects",
      "cooldown",
      "targetingRule",
      "visualID",
      "availableMutations",
      "aiUsageProfile",
    ])
      assert.ok(k in o, `${o.id}.${k}`);
  for (const m of Object.values(MUTATIONS))
    for (const k of [
      "id",
      "name",
      "compatibleTags",
      "triggerEvent",
      "conditions",
      "effectOperations",
      "internalCooldown",
      "maxTriggerCount",
      "visualID",
    ])
      assert.ok(k in m);
});
test("spine arm creates ranged basic and five-projectile special attacks", () => {
  const { game, p } = fixture();
  OrganSystem.equip(p, "ARM_SPINE");
  game.requestAttack(p);
  step(game, 0.14);
  assert.equal(game.projectiles.length, 1);
  p.attack = null;
  game.projectiles = [];
  game.requestAttack(p, true);
  step(game, 0.27);
  assert.equal(game.projectiles.length, 5);
});
test("bleed, poison and shock tick, slow applies and stun cancels action", () => {
  const { game, p, e } = fixture();
  for (const id of ["bleed", "poison", "shock", "slow", "stun"])
    game.applyStatus(p, e, id, "ARM_SAW");
  assert.equal(game.speed(e), 0);
  step(game, 0.8);
  assert.ok(e.hp < 1000);
  assert.ok(!e.statuses.stun);
  assert.equal(Object.keys(STATUSES).length, 5);
});
test("mutation split, pierce and return modify real projectiles", () => {
  const { game, p, e } = fixture();
  OrganSystem.equip(p, "ARM_SPINE");
  for (const id of ["MUT01", "MUT02", "MUT11"])
    assert.ok(OrganSystem.mutate(p, id, "ARM_SPINE"));
  game.projectile(p, "ARM_SPINE", 0);
  assert.equal(game.projectiles[0].pierce, 2);
  assert.equal(game.projectiles[0].canReturn, true);
  step(game, 0.2);
  assert.ok(game.projectiles.some((x) => x.small));
});
test("successful evade mutation emits eight counter spikes only on real evasion", () => {
  const { game, p, e } = fixture();
  OrganSystem.mutate(p, "MUT08", "ARM_SAW");
  game.dash(p);
  assert.equal(game.projectiles.length, 0);
  game.damage(e, p, 20);
  assert.equal(game.projectiles.length, 8);
  game.damage(e, p, 20);
  assert.equal(game.projectiles.length, 8);
});
test("hungry heart, blast heart and eyes respond to their triggers", () => {
  const { game, p, e } = fixture();
  OrganSystem.equip(p, "HEART_HUNGER");
  OrganSystem.equip(p, "EYE_HUNTER");
  game.damage(p, e, 5, { organID: "ARM_SAW", direct: true });
  assert.equal(e.markedBy, p.id);
  e.hp = 1;
  game.damage(p, e, 5, { organID: "ARM_SAW", direct: true });
  assert.ok(p.boostUntil > game.t);
  OrganSystem.equip(p, "HEART_BLAST");
  p.stats.kills = 4;
  const next = game.spawnEnemy("hungry", { x: 1300, y: 800 });
  game.damage(p, next, 100, { organID: "ARM_SAW" });
  assert.ok(game.effects.some((x) => x.type === "blast"));
});
test("XP collection advances level and pauses simulation at a reward", () => {
  const { game, p } = fixture();
  game.orbs = [{ x: p.x, y: p.y, value: 14 }];
  game.tick(0.02);
  assert.equal(game.level, 2);
  assert.equal(game.mode, "levelup");
  assert.equal(game.rewardChoices.length, 3);
});
test("boss cycles four distinct telegraphed patterns and victory ends run", () => {
  const { game, p } = fixture();
  game.t = 300;
  game.bossSpawned = false;
  game.tick(0.02);
  assert.ok(game.boss);
  const b = game.boss;
  b.x = p.x + 180;
  b.y = p.y;
  const kinds = [];
  for (let i = 0; i < 4; i++) {
    b.telegraph = null;
    b.nextAttack = 0;
    game.enemyAI(b, 0.02);
    kinds.push(b.telegraph.kind);
  }
  assert.deepEqual(kinds, ["sweep", "hook", "charge", "hazard"]);
  game.damage(p, b, 99999, { organID: "ARM_SAW" });
  assert.equal(game.mode, "victory");
});
test("malformed archives are ignored and history is capped at eight", () => {
  assert.deepEqual(loadDeaths({ getItem: () => "{bad" }), []);
  assert.deepEqual(loadDeaths({ getItem: () => '[{"version":1}]' }), []);
  const s = store(),
    { p } = fixture();
  for (let i = 0; i < 10; i++) saveDeath(s, p, { runID: String(i) });
  assert.equal(loadDeaths(s).length, 8);
  assert.equal(loadDeaths(s)[0].runID, "2");
  assert.ok(s.getItem(SAVE_KEY));
});
test("lifesteal, clone and haste mutations produce their specified outcomes", () => {
  const a = fixture();
  OrganSystem.mutate(a.p, "MUT05", "ARM_SAW");
  a.p.hp = 50;
  a.game.damage(a.p, a.e, 20, { organID: "ARM_SAW", direct: true });
  assert.ok(Math.abs(a.p.hp - 51.2) < 0.001);
  const b = fixture();
  OrganSystem.mutate(b.p, "MUT06", "ARM_SAW");
  b.game.requestAttack(b.p);
  step(b.game, 0.2);
  assert.ok(b.p.stats.mutation > 8);
  assert.ok(b.p.stats.direct >= 22);
  assert.ok(b.game.events.processed < 100);
  const c = fixture();
  OrganSystem.mutate(c.p, "MUT07", "ARM_SAW");
  c.e.hp = 1;
  c.game.damage(c.p, c.e, 5, { organID: "ARM_SAW" });
  assert.equal(c.game.haste(c.p), 1.2);
});
test("execution, focus, contagion and chain mutations change actual damage/status", () => {
  const a = fixture();
  OrganSystem.mutate(a.p, "MUT09", "ARM_SAW");
  a.e.hp = 200;
  assert.equal(a.game.damage(a.p, a.e, 10, { organID: "ARM_SAW" }), 14);
  const b = fixture();
  OrganSystem.mutate(b.p, "MUT10", "ARM_SAW");
  assert.equal(b.game.damage(b.p, b.e, 10, { organID: "ARM_SAW" }), 10.5);
  assert.equal(b.game.damage(b.p, b.e, 10, { organID: "ARM_SAW" }), 11);
  const c = fixture();
  OrganSystem.mutate(c.p, "MUT04", "ARM_SAW");
  const next = c.game.spawnEnemy("hungry", { x: 1330, y: 800 });
  c.game.applyStatus(c.p, c.e, "bleed", "ARM_SAW");
  assert.ok(next.statuses.bleed);
  const d = fixture();
  OrganSystem.mutate(d.p, "MUT12", "ARM_SAW");
  const other = d.game.spawnEnemy("hungry", { x: 1340, y: 800 });
  d.game.damage(d.p, d.e, 10, { organID: "ARM_SAW" });
  assert.ok(other.statuses.shock);
  assert.ok(other.statuses.slow);
  assert.ok(other.hp < other.maxHP);
});
test("blood eye and marked eye affect automatic target and damage", () => {
  const { game, p, e } = fixture();
  OrganSystem.equip(p, "BACK_TENTACLE");
  OrganSystem.equip(p, "EYE_BLOOD");
  const far = game.spawnEnemy("hungry", { x: 1370, y: 800 });
  game.applyStatus(p, far, "bleed", "ARM_SAW");
  assert.equal(game.autoTarget(p, 185), far);
  OrganSystem.equip(p, "EYE_HUNTER");
  game.damage(p, e, 1, { organID: "ARM_SAW", direct: true });
  const before = e.hp;
  game.damage(p, e, 10, { organID: "BACK_TENTACLE" });
  assert.ok(Math.abs(before - e.hp - 13) < 0.001);
});
test("return projectile travels outbound before hitting the same target on its return", () => {
  const { game, p, e } = fixture();
  OrganSystem.equip(p, "ARM_SPINE");
  OrganSystem.mutate(p, "MUT11", "ARM_SPINE");
  game.projectile(p, "ARM_SPINE", 0, { damage: 10, range: 200 });
  step(game, 0.22);
  assert.equal(e.hp, 990);
  step(game, 0.55);
  assert.equal(e.hp, 980);
});
test("five-minute populated simulation respects entity caps and reaches a boss", () => {
  const game = new Game({ storage: store(), random: () => 0.35 });
  game.player.maxHP = game.player.hp = 100000;
  for (let i = 0; i < 25000 && game.t < CONFIG.bossTime + 0.2; i++) {
    game.tick(0.02, { attack: true, specialPressed: i % 300 === 0 });
    if (game.mode === "levelup") game.choose(0);
  }
  assert.ok(
    game.t >= CONFIG.bossTime,
    "five simulated minutes must actually elapse despite hitstop",
  );
  assert.ok(game.bossSpawned);
  assert.ok(game.boss);
  assert.ok(game.enemies.length <= CONFIG.maxEnemies);
  assert.ok(game.projectiles.length <= CONFIG.maxProjectiles);
  assert.ok(game.orbs.length <= 301);
  assert.ok(Number.isFinite(game.player.hp));
});
test("spitter and elite telegraphs produce poison shots and pulling hooks", () => {
  const { game, p } = fixture();
  game.enemies = [];
  const spitter = game.spawnEnemy("spitter", { x: 1450, y: 800 });
  spitter.nextAttack = 0;
  game.enemyAI(spitter, 0.02);
  assert.equal(spitter.telegraph.kind, "spit");
  game.enemyStrike(spitter, spitter.telegraph);
  assert.equal(game.projectiles.at(-1).poison, true);
  game.projectiles = [];
  const elite = game.spawnEnemy("elite", { x: 1400, y: 800 });
  elite.nextAttack = 0;
  game.enemyAI(elite, 0.02);
  assert.equal(elite.telegraph.kind, "hook");
  game.enemyStrike(elite, elite.telegraph);
  assert.equal(game.projectiles.at(-1).hook, true);
  for (let i = 0; i < 40; i++) {
    game.t += 0.02;
    game.updateProjectiles(0.02);
  }
  assert.ok(p.x > 1200);
  assert.ok(p.statuses.slow);
});
test("exploder death blast hurts nearby monsters and player exactly once", () => {
  const { game, p } = fixture();
  game.enemies = [];
  const bomb = game.spawnEnemy("exploder", { x: 1280, y: 800 }),
    other = game.spawnEnemy("hungry", { x: 1320, y: 800 });
  game.damage(p, bomb, 999, { organID: "ARM_SAW" });
  assert.equal(p.hp, 102);
  assert.ok(other.hp < other.maxHP);
  const health = other.hp;
  game.explode(bomb);
  assert.equal(other.hp, health);
});
test("hunter loses sight behind obstacles and searches last seen position", () => {
  const { game, p } = fixture();
  p.x = 900;
  p.y = 530;
  const record = saveDeath(store(), p, { runID: "sight" }),
    h = createHunter(record, 600, 530);
  game.hunterAI(h, 0.02);
  assert.equal(h.lastSeen, null);
  assert.equal(h.state, "Patrol");
  p.x = 600;
  p.y = 700;
  game.hunterAI(h, 0.02);
  assert.deepEqual(h.lastSeen, { x: 600, y: 700 });
  p.x = 900;
  p.y = 530;
  game.t += 1;
  game.hunterAI(h, 0.02);
  assert.equal(h.state, "Search");
  assert.deepEqual(h.lastSeen, { x: 600, y: 700 });
});

test("blocked and quota-full storage preserve session records and report nonpersistent state", async () => {
  const { createStorage } = await import("../src/storage.js");
  for (const backend of [
    () => {
      throw new Error("blocked");
    },
    () => ({
      getItem: () => null,
      setItem: () => {
        throw new Error("quota full");
      },
    }),
  ]) {
    const storage = createStorage(backend),
      { p } = fixture();
    saveDeath(storage, p, { runID: "memory-only" });
    assert.equal(storage.persistent, false);
    assert.equal(loadDeaths(storage)[0].runID, "memory-only");
  }
});
