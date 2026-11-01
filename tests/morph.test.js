import test from "node:test";
import assert from "node:assert/strict";
import {
  Game,
  Actor,
  OrganSystem,
  applyReward,
  saveDeath,
  loadDeaths,
  createHunter,
  SAVE_KEY,
} from "../src/core.js";
import { ORGANS, CONFIG, MORPH_LIMITS } from "../src/data.js";
import {
  ACTION_PATHS,
  validatePaths,
  morphRewards,
  selectMorph,
  activeMorphTier,
  restoreMorph,
  serializeMorph,
} from "../src/action-paths.js";
function setup(id = "PATH_01", tier = 0) {
  const g = new Game({ random: () => 0.5, previewPath: id, previewTier: tier });
  g.enemies = [];
  g.spawnAt = g.eliteAt = Infinity;
  g.bossSpawned = g.hunterChecked = true;
  g.player.timers.auto = Infinity;
  return g;
}
function enemy(g, x = 1290, y = 800, type = "hungry") {
  const e = g.spawnEnemy(type, { x, y });
  e.hp = e.maxHP = 10000;
  e.speed = 0;
  e.nextAttack = Infinity;
  return e;
}
function cast(g, special = false, end = true) {
  const p = g.player;
  assert.ok(g.requestAttack(p, special, false));
  const a = p.attack;
  g.t = a.activeAt;
  g.updateActor(p, 0);
  g.morph.tick(0);
  if (end) {
    g.t = a.endAt + 0.01;
    g.updateActor(p, 0);
    g.morph.tick(0);
  }
  g.hitstop = 0;
  return a;
}
function step(g, duration, input = {}) {
  const until = g.t + duration;
  for (let i = 0; i < duration * 150 + 100 && g.t < until; i++)
    g.tick(0.02, input);
  assert.ok(g.t >= until - 0.001);
}
const storage = () => {
  const d = new Map();
  return { getItem: (k) => d.get(k) || null, setItem: (k, v) => d.set(k, v) };
};
test("A · registry has 32 unique paths, 8 families, valid gear and exactly four executable slices", () => {
  const result = validatePaths();
  assert.deepEqual(result.errors, []);
  assert.equal(result.count, 32);
  assert.equal(Object.keys(result.families).length, 8);
  assert.ok(Object.values(result.families).every((n) => n === 4));
  assert.deepEqual(
    Object.values(ACTION_PATHS)
      .filter((p) => p.implemented)
      .map((p) => p.id),
    ["PATH_01", "PATH_06", "PATH_17", "PATH_25"],
  );
  assert.ok(Object.isFrozen(ACTION_PATHS.PATH_01.tier1.z));
});
test("A · unknown operations and wrong-slot gear fail registry validation", () => {
  const p = structuredClone(ACTION_PATHS.PATH_01);
  p.tier1.z = [{ op: "ExecuteArbitraryScript" }];
  assert.equal(validatePaths({ PATH_01: p }).valid, false);
  p.tier1.z = [];
  p.required.eye = "ARM_SAW";
  assert.equal(validatePaths({ PATH_01: p }).valid, false);
});
test("B · explicit sequential path choice, one path only and exact tier gear gates", () => {
  const g = new Game(),
    p = g.player;
  assert.equal(p.actionMorph.pathId, null);
  OrganSystem.equip(p, "BACK_BLADES");
  assert.ok(morphRewards(p).some((r) => r.id === "PATH_01"));
  assert.ok(selectMorph(p, { kind: "path", id: "PATH_01", tier: 1 }));
  assert.equal(selectMorph(p, { kind: "path", id: "PATH_17", tier: 1 }), false);
  assert.deepEqual(morphRewards(p), []);
  OrganSystem.equip(p, "HEART_HUNGER");
  assert.ok(selectMorph(p, { kind: "path-tier", id: "PATH_01", tier: 2 }));
  assert.deepEqual(morphRewards(p), []);
  OrganSystem.equip(p, "EYE_BLOOD");
  assert.ok(selectMorph(p, { kind: "path-tier", id: "PATH_01", tier: 3 }));
  assert.equal(
    selectMorph(p, { kind: "path-tier", id: "PATH_01", tier: 3 }),
    false,
  );
});
test("B · planned paths and planned organs never enter gameplay", () => {
  const g = new Game();
  assert.equal(OrganSystem.equip(g.player, "ARM_WHIP"), false);
  assert.equal(
    selectMorph(g.player, { kind: "path", id: "PATH_02", tier: 1 }),
    false,
  );
  assert.equal(ORGANS.ARM_WHIP.implemented, false);
});
test("B · swap makes path dormant, cleans delayed work, restores unchanged tier with gear", () => {
  const g = setup("PATH_17", 3),
    p = g.player;
  g.morph.echo(p, p, 0, 0.8, g.morph.root(p, 1), "one");
  assert.equal(g.morph.entities.length, 1);
  OrganSystem.equip(p, "EYE_BLOOD");
  assert.equal(activeMorphTier(p), 0);
  assert.equal(g.morph.entities.length, 0);
  assert.equal(p.actionMorph.tier, 3);
  OrganSystem.equip(p, "EYE_HUNTER");
  assert.equal(activeMorphTier(p), 3);
  assert.equal(g.morph.entities.length, 0);
});
test("B · v1 saves load intact, v2 morph state restores, unknown path falls back safely", () => {
  const s = storage(),
    g = setup("PATH_17", 2);
  let old = saveDeath(s, g.player, { runID: "old" });
  old.version = 1;
  delete old.actionMorph;
  s.setItem(SAVE_KEY, JSON.stringify([old]));
  assert.equal(loadDeaths(s)[0].version, 1);
  assert.equal(createHunter(old, 1500, 800).actionMorph.pathId, null);
  const record = saveDeath(s, g.player, { runID: "new" });
  assert.equal(record.version, 2);
  assert.equal(createHunter(record, 1500, 800).actionMorph.pathId, "PATH_17");
  assert.equal(activeMorphTier(createHunter(record, 1500, 800)), 0);
  assert.equal(
    restoreMorph({ version: 2, pathId: "PATH_99", tier: 3 }).tier,
    0,
  );
  assert.equal(serializeMorph(g.player).temporaryEntities.length, 0);
});
test("PATH_01 T0/T1 · third hit gains a 270-degree shape, controlled lunge and root", () => {
  const base = setup("PATH_01", 0),
    e0 = enemy(base),
    side0 = enemy(base, 1195, 890);
  cast(base);
  cast(base);
  cast(base);
  assert.equal(side0.hp, 10000);
  const g = setup("PATH_01", 1),
    front = enemy(g),
    side = enemy(g, 1195, 890);
  cast(g);
  cast(g);
  const before = g.player.x;
  cast(g, false, false);
  assert.ok(side.hp < 10000);
  assert.ok(g.player.x - before <= 45.001 && g.player.x > before);
  assert.equal(g.speed(g.player), 0);
  assert.ok(g.effects.some((e) => e.type === "morph-arc" && e.cone > 4.7));
});
test("PATH_01 T2 · X remains real dash, attack-cancel adds half arc and C boosts orbit for two seconds", () => {
  const g = setup("PATH_01", 2),
    p = g.player;
  enemy(g);
  g.requestAttack(p);
  g.t = p.attack.start + 0.08;
  assert.ok(g.dash(p, { right: true }));
  assert.equal(p.dashes, 1);
  assert.ok(p.invulnerableUntil > g.t);
  step(g, 0.35);
  assert.ok(
    g.morph.logs.some(
      (e) =>
        e.op === "ArcSlash" && String(e.attackInstanceId).startsWith("dash:"),
    ),
  );
  p.attack = null;
  p.specialAt = 0;
  cast(g, true);
  assert.equal(g.morph.autoSpeed(p), 1.8);
  g.t += 2.1;
  assert.equal(g.morph.autoSpeed(p), 1);
});
test("PATH_01 T3 · Z explicitly reaches rear targets and C has exactly three bounded ticks", () => {
  const g = setup("PATH_01", 3),
    p = g.player;
  const front = enemy(g),
    rear = enemy(g, 1110, 800);
  cast(g);
  assert.ok(rear.hp < 10000);
  p.attack = null;
  const before = front.hp;
  cast(g, true);
  const ticks = g.morph.logs.filter((l) => l.op === "CleaveAround");
  assert.equal(ticks.length, 3);
  assert.ok(before - front.hp <= p.arm.baseStats.damage * 5.1 + 0.001);
  assert.ok(front.receivedAttacks.size <= 5);
  assert.ok(p.specialAt > g.t);
});
test("B · shared ray clips at obstacles and never corrects behind the facing direction", () => {
  const g = setup("PATH_06", 1),
    p = g.player;
  p.x = 1500;
  p.y = 500;
  const behind = enemy(g, 1400, 500),
    wall = enemy(g, 1850, 500);
  g.morph.primitive(
    p,
    { op: "PiercingRay", length: 700, width: 20, damageScale: 2 },
    p,
    0,
    "clip",
    g.morph.root(p, 1),
    { direct: true },
  );
  assert.equal(wall.hp, 10000);
  assert.equal(behind.hp, 10000);
});
function charge(g, seconds) {
  step(g, seconds, { attack: true });
  const amount = g.player.attack?.chargeAmount;
  step(g, 0.12);
  return amount;
}
test("PATH_06 T0/T1 · hold-release replaces repeated shots with a stationary piercing charge", () => {
  const base = setup("PATH_06", 0);
  charge(base, 0.6);
  assert.ok(base.player.stats.attacks >= 2);
  const g = setup("PATH_06", 1);
  const a = enemy(g),
    b = enemy(g, 1400, 800);
  assert.ok(charge(g, 0.5) >= 0.45);
  assert.ok(a.hp < 10000 && b.hp < 10000);
  assert.ok(g.effects.some((e) => e.type === "morph-ray" && e.width === 22));
  assert.equal(g.player.stats.attacks, 1);
});
test("PATH_06 T1 · moving slows to 35 percent without charging; a short tap uses ordinary projectile", () => {
  const g = setup("PATH_06", 1);
  step(g, 0.2, { attack: true, right: true });
  assert.equal(g.player.attack.chargeAmount, 0);
  assert.ok(g.speed(g.player) < 100);
  step(g, 0.12);
  assert.ok(g.projectiles.length > 0);
  assert.equal(g.morph.logs.filter((l) => l.op === "PiercingRay").length, 0);
});
test("PATH_06 T2 · X cancels charge, banks half for 0.6 seconds and preserves dash invulnerability", () => {
  const g = setup("PATH_06", 2),
    p = g.player;
  step(g, 0.5, { attack: true });
  const amount = p.attack.chargeAmount;
  assert.ok(g.dash(p, { right: true }));
  assert.equal(p.attack, null);
  assert.ok(
    Math.abs(p.actionMorph.counters.bankedCharge - amount * 0.5) < 0.001,
  );
  assert.ok(p.invulnerableUntil > g.t);
  step(g, 0.3);
  step(g, 0.02, { attack: true });
  assert.ok(p.attack.chargeAmount >= amount * 0.5);
  g.morph.cancelCharge(p);
  g.t += 1;
  step(g, 0.02, { attack: true });
  assert.ok(p.attack.chargeAmount < 0.1);
});
test("PATH_06 T2/T3 · C has a marked ray; rail is narrower, adds boss stagger and C has three follow-ups", () => {
  const t2 = setup("PATH_06", 2);
  enemy(t2);
  cast(t2, true);
  assert.equal(t2.morph.logs.filter((l) => l.op === "PiercingRay").length, 1);
  const g = setup("PATH_06", 3),
    p = g.player,
    boss = enemy(g, 1400, 800, "boss");
  charge(g, 1);
  assert.equal(boss.staggerMeter, 30);
  assert.ok(
    g.effects.some((e) => e.type === "morph-ray" && e.rail && e.width === 12),
  );
  step(g, 0.6);
  const before = boss.hp;
  cast(g, true);
  step(g, 0.95);
  assert.equal(g.morph.logs.filter((l) => l.op === "PiercingRay").length, 5);
  assert.ok(before - boss.hp <= p.arm.baseStats.damage * 5 + 0.001);
  assert.ok(p.specialAt > g.t);
});
function dashZ(g) {
  assert.ok(g.dash(g.player, { right: true }));
  step(g, 0.22);
  cast(g, false, false);
}
test("PATH_17 T0/T1 · dash then Z creates one delayed replay, ordinary Z does not", () => {
  const base = setup("PATH_17", 0);
  dashZ(base);
  assert.equal(base.morph.entities.length, 0);
  const g = setup("PATH_17", 1);
  enemy(g, 1370, 800);
  dashZ(g);
  assert.equal(g.morph.entities.filter((e) => e.kind === "echo").length, 1);
  step(g, 0.2);
  assert.ok(g.morph.logs.some((l) => l.op === "ArcSlash"));
  assert.equal(g.morph.entities.filter((e) => e.kind === "echo").length, 1);
});
test("PATH_17 T2 · successful evade creates one extra echo, C attacks from echoes and cannot recursively spawn", () => {
  const g = setup("PATH_17", 2),
    p = g.player;
  enemy(g);
  g.events.emit("OnSuccessfulEvade", {
    actor: p,
    attackInstanceId: "hostile-1",
  });
  assert.equal(g.morph.entities.length, 1);
  const before = g.morph.logs.length;
  cast(g, true);
  assert.ok(g.morph.logs.length > before);
  assert.equal(g.morph.entities.length, 1);
  for (let i = 0; i < 9; i++)
    g.morph.echo(p, p, 0, 0.8, g.morph.root(p, i), "e" + i);
  assert.equal(g.morph.entities.length, MORPH_LIMITS.echoes);
  step(g, 3.2);
  assert.equal(g.morph.entities.length, 0);
});
test("PATH_17 T3 · dash Z leaves three echoes, two delayed 0.8 seconds; C consumes them into ground lines", () => {
  const g = setup("PATH_17", 3),
    p = g.player;
  enemy(g, 1380, 800);
  dashZ(g);
  assert.equal(g.morph.entities.length, 3);
  assert.equal(g.morph.entities.filter((e) => e.readyAt - g.t > 0.7).length, 2);
  step(g, 0.4);
  assert.equal(g.morph.entities.filter((e) => e.fired).length, 1);
  step(g, 0.4);
  assert.equal(g.morph.entities.filter((e) => e.fired).length, 3);
  p.attack = null;
  cast(g, true);
  assert.equal(g.morph.entities.length, 0);
  assert.equal(g.morph.logs.filter((l) => l.op === "GroundLine").length, 3);
});
test("PATH_25 T0/T1 · native brood exists without a path, T1 adds a real targeted dash command", () => {
  const base = setup("PATH_25", 0);
  assert.equal(base.morph.entities.length, 3);
  enemy(base);
  cast(base);
  assert.equal(base.morph.logs.filter((l) => l.op === "SummonOrder").length, 0);
  const g = setup("PATH_25", 1);
  enemy(g);
  cast(g, false, false);
  const commands = g.morph.entities.filter((e) => e.command);
  assert.equal(commands.length, 1);
  assert.equal(commands[0].command.mode, "dash");
  const x = commands[0].x;
  step(g, 0.08);
  assert.notEqual(commands[0].x, x);
});
test("PATH_25 T2 · X retains vulnerable minions and C focuses; baseline X recalls and evades", () => {
  const base = setup("PATH_25", 0);
  base.dash(base.player, { right: true });
  assert.ok(base.morph.entities.every((e) => e.evadeUntil > base.t));
  const g = setup("PATH_25", 2),
    p = g.player,
    target = enemy(g);
  g.dash(p, { right: true });
  assert.ok(
    g.morph.entities.every((e) => e.holdUntil > g.t && e.evadeUntil === 0),
  );
  const minion = g.morph.entities[0];
  g.morph.hitBroodProjectile({
    actor: target,
    x: minion.x,
    y: minion.y,
    damage: 9,
  });
  assert.equal(minion.hp, 9);
  step(g, 0.3);
  target.x = p.x + 100;
  target.y = p.y;
  p.attack = null;
  cast(g, true);
  assert.ok(g.morph.logs.some((l) => l.mode === "focus"));
});
test("PATH_25 T3 · third hit flanks with two minions; C converges with three and respects native cap/lifetime", () => {
  const g = setup("PATH_25", 3);
  enemy(g);
  cast(g);
  cast(g);
  cast(g, false, false);
  assert.equal(
    g.morph.entities.filter((e) => e.command?.mode === "flank").length,
    2,
  );
  g.player.attack = null;
  cast(g, true, false);
  assert.equal(
    g.morph.entities.filter((e) => e.command?.mode === "converge-execute")
      .length,
    3,
  );
  for (let i = 0; i < 20; i++) {
    g.player.timers.auto = 0;
    g.morph.nativeBrood(g.player);
  }
  assert.equal(g.morph.entities.length, 3);
  g.player.timers.auto = Infinity;
  step(g, 18.2);
  assert.equal(g.morph.entities.length, 0);
});
test("B · delayed jobs/logs are bounded and removing the originating organ cleans summons", () => {
  const g = setup("PATH_01", 3),
    p = g.player;
  for (let i = 0; i < 100; i++)
    g.morph.defer(
      p,
      { op: "Orbit", duration: 2 },
      g.t + 1,
      p,
      0,
      "x" + i,
      g.morph.root(p, i),
    );
  assert.equal(g.morph.delayed.length, MORPH_LIMITS.delayed);
  g.t += 2;
  g.morph.tick(0);
  for (let i = 0; i < 200; i++) g.morph.log(p, "Orbit", i);
  assert.equal(g.morph.logs.length, MORPH_LIMITS.logs);
  const brood = setup("PATH_25", 3);
  OrganSystem.equip(brood.player, "BACK_BLADES");
  assert.equal(brood.morph.entities.length, 0);
});
test("native organs · weak eye affects only direct elite/boss damage", () => {
  const g = setup("PATH_06", 0),
    boss = enemy(g, 1400, 800, "boss"),
    normal = enemy(g);
  assert.equal(
    g.damage(g.player, boss, 10, { direct: true, organID: "ARM_SPINE" }),
    12,
  );
  assert.equal(g.damage(g.player, boss, 10, { organID: "BACK_TURRET" }), 10);
  assert.equal(
    g.damage(g.player, normal, 10, { direct: true, organID: "ARM_SPINE" }),
    10,
  );
});
test("native organs · parasite cooldown reduction is limited and ignores copied/direct damage", () => {
  const g = setup("PATH_25", 1),
    p = g.player,
    target = enemy(g);
  p.specialAt = 10;
  for (let i = 0; i < 20; i++)
    g.damage(p, target, 1, {
      organID: "BACK_BROOD",
      attackInstanceId: "parasite-" + i,
    });
  assert.ok(Math.abs(p.specialAt - 9.4) < 0.001);
  g.damage(p, target, 1, { direct: true, organID: "ARM_SAW" });
  g.damage(p, target, 1, {
    mutation: true,
    suppressProcs: true,
    organID: "BACK_BROOD",
  });
  assert.ok(Math.abs(p.specialAt - 9.4) < 0.001);
  g.t = 1;
  g.damage(p, target, 1, { organID: "BACK_BROOD" });
  assert.ok(Math.abs(p.specialAt - 9.25) < 0.001);
});
