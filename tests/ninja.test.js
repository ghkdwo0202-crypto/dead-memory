import test from "node:test";
import assert from "node:assert/strict";
import {
  NinjaGame,
  NINJA_SAVE_KEY,
  NINJA_RULES,
  NINJA_STRIKES,
  readNinjaRecords,
} from "../src/ninja.js";
import { SAVE_KEY } from "../src/core.js";
const memory = () => {
  const d = new Map();
  return { getItem: (k) => d.get(k) || null, setItem: (k, v) => d.set(k, v) };
};
function setup() {
  const g = new NinjaGame({ random: () => 0.5, dojo: true });
  g.enemies = [];
  g.notifications = [];
  return g;
}
function mob(g, x = 1280, y = 800, type = "hungry") {
  const e = g.spawnEnemy(type, { x, y });
  e.hp = e.maxHP = 10000;
  e.trainingDummy = true;
  return e;
}
function run(g, seconds, input = {}, dt = 1 / 120) {
  for (let i = 0; i < Math.round(seconds / dt); i++) g.tick(dt, input);
}
function cast(g) {
  assert.ok(g.requestAttack(g.player));
  let limit = 200;
  while (g.player.attack && limit-- > 0) g.tick(1 / 120, {});
  assert.ok(limit > 0);
}
test("P1 timing · explicit three-stage sword contract and exact dash constants", () => {
  assert.deepEqual(
    NINJA_STRIKES.map((s) => [s.windup, s.active, s.recovery]),
    [
      [0.08, 0.07, 0.14],
      [0.09, 0.07, 0.17],
      [0.11, 0.09, 0.2],
    ],
  );
  assert.equal(NINJA_RULES.step, 1 / 120);
  assert.equal(NINJA_RULES.dashRecharge, 2.3);
});
test("P1 Z hold · all three stages loop and third hit launches small targets", () => {
  const g = setup(),
    e = mob(g);
  run(g, 1.3, { attack: true });
  assert.ok(g.player.stats.attacks >= 3);
  assert.ok(e.hp < 10000);
  assert.ok(e.launchReadyAt > 0);
  assert.ok(g.effects.some((e) => e.type === "launch") || e.airHeight > 0);
});
test("P1 sword · one nonce per target, no backward aim and walls block hitboxes", () => {
  const g = setup(),
    e = mob(g),
    rear = mob(g, 1120);
  g.requestAttack(g.player);
  const a = g.player.attack;
  g.executeAttack(g.player, a);
  const hp = e.hp;
  g.executeAttack(g.player, a);
  assert.equal(e.hp, hp);
  assert.equal(rear.hp, 10000);
  g.player.attack = null;
  g.player.x = 660;
  g.player.y = 520;
  g.player.lastNonZeroFacing = -Math.PI / 4;
  const wall = mob(g, 720, 460);
  g.requestAttack(g.player);
  g.executeAttack(g.player, g.player.attack);
  assert.equal(wall.hp, 10000);
});
test("P1 input · diagonal movement normalized and equal to axial distance", () => {
  const g = setup(),
    h = setup();
  run(g, 0.1, { right: true });
  run(h, 0.1, { right: true, down: true });
  assert.ok(
    Math.abs(
      Math.hypot(h.player.x - 1200, h.player.y - 800) - (g.player.x - 1200),
    ) < 0.01,
  );
});
test("P1 input · hitstop retains one Space edge and fixed timestep survives frame batching", () => {
  const g = setup();
  g.hitstop = 0.05;
  g.tick(0.02, { jumpPressed: true });
  assert.equal(g.player.airHeight, 0);
  g.tick(0.06, {});
  assert.ok(g.player.airHeight > 0);
  const a = setup(),
    b = setup();
  run(a, 1, { right: true }, 1 / 60);
  run(b, 1, { right: true }, 1 / 120);
  assert.ok(Math.abs(a.player.x - b.player.x) < 0.001);
  assert.ok(Math.abs(a.t - b.t) < 0.001);
});
test("P1 attack buffer · Z queue is consumed once, special has priority, expired input drops", () => {
  const g = setup(),
    p = g.player;
  g.requestAttack(p);
  g.t = p.attack.endAt - 0.05;
  g.requestAttack(p, true);
  g.requestAttack(p);
  assert.equal(p.buffer.special, true);
  g.t = p.attack.endAt + 0.001;
  g.updateActor(p, 0);
  assert.equal(p.attack.special, true);
  assert.equal(p.stats.specials, 1);
  p.buffer = { special: false, until: g.t - 0.1 };
  g.t = p.attack.endAt + 0.01;
  g.updateActor(p, 0);
  assert.equal(p.attack, null);
});
test("P1 X · two charges, exact windows and one-at-a-time 2.3s recharge", () => {
  const g = setup(),
    p = g.player;
  assert.ok(g.dash(p, { right: true }));
  assert.equal(p.dashUntil - g.t, 0.22);
  assert.equal(p.invulnerableUntil - g.t, 0.14);
  run(g, 0.24);
  assert.ok(g.dash(p, { right: true }));
  assert.equal(p.dashes, 0);
  assert.equal(g.dash(p), false);
  run(g, 2.1);
  assert.equal(p.dashes, 1);
  run(g, 2.31);
  assert.equal(p.dashes, 2);
});
test("P1 X cancel · active frames cannot cancel; third hit must wait 0.06s after active", () => {
  const g = setup(),
    p = g.player;
  g.requestAttack(p);
  assert.equal(g.dash(p), false);
  g.t = p.attack.activeAt + p.attack.activeDuration;
  assert.equal(g.dash(p), true);
  run(g, 0.24);
  p.comboIndex = 2;
  p.comboExpiresAt = g.t + 1;
  assert.ok(g.requestAttack(p));
  g.t = p.attack.activeAt + p.attack.activeDuration + 0.03;
  assert.equal(g.dash(p), false);
  g.t += 0.031;
  assert.equal(g.dash(p), true);
});
test("P1 X movement · dash stops before walls and creates three visual-only afterimages", () => {
  const g = setup(),
    p = g.player;
  p.x = 1500;
  p.y = 500;
  assert.ok(g.dash(p, { right: true }));
  assert.equal(g.effects.filter((e) => e.type === "afterimage").length, 3);
  run(g, 0.3);
  assert.ok(g.walkable(p.x, p.y, p.radius));
  assert.ok(p.x < 1620);
  assert.equal(p.momentum, 0);
});
test("P1 PerfectDodge · only real negated hostile strike, deduped per attack instance", () => {
  const g = setup(),
    p = g.player,
    e = mob(g, 1225);
  assert.ok(g.dash(p));
  assert.equal(p.perfectDodgeWindowEnd, 0);
  const w = { kind: "bite", angle: Math.PI, range: 65, id: "hostile-test" };
  g.enemyStrike(e, w);
  g.enemyStrike(e, w);
  assert.equal(p.stats.evades, 1);
  assert.equal(p.hp, p.maxHP);
  assert.equal(p.perfectDodgeWindowEnd, g.t + 0.7);
});
test("P1 counter · actual dodge opens a bounded forward lunge and consumes window", () => {
  const g = setup(),
    p = g.player,
    e = mob(g, 1225);
  g.dash(p, { right: true });
  g.enemyStrike(e, { kind: "bite", range: 65, id: "counter-test" });
  g.t = 0.23;
  p.dashUntil = 0;
  g.requestAttack(p);
  assert.ok(p.attack.counter);
  assert.equal(p.perfectDodgeWindowEnd, 0);
  const before = p.x;
  g.executeAttack(p, p.attack);
  assert.ok(p.x - before <= 60.001 && p.x > before);
});
test("P1 Space · jump has height and gravity, lands near 0.52 seconds without invulnerability", () => {
  const g = setup(),
    p = g.player;
  g.jump();
  assert.equal(p.invulnerableUntil, 0);
  run(g, 0.25);
  assert.ok(p.airHeight > 0.9);
  run(g, 0.3);
  assert.equal(p.airHeight, 0);
  assert.equal(p.followUsed, false);
});
test("P1 Space · forward airborne target permits one wall-safe chase per sequence", () => {
  const g = setup(),
    p = g.player,
    e = mob(g, 1370);
  g.launch(e);
  const before = p.x;
  assert.ok(g.jump({ right: true }));
  assert.ok(p.x - before <= 100.001 && p.x > before);
  assert.equal(p.followUsed, true);
  assert.equal(g.jump({ right: true }), false);
});
test("P1 Space · target behind or behind a wall is never selected for chase", () => {
  const g = setup(),
    p = g.player,
    e = mob(g, 1080);
  g.launch(e);
  g.jump({ right: true });
  assert.equal(p.followUsed, false);
  assert.equal(p.x, 1200);
});
test("P1 airborne safety · no boss levitation, elite duration bound, launch cooldown", () => {
  const g = setup(),
    boss = mob(g, 1300, 800, "boss"),
    elite = mob(g, 1400, 800, "elite"),
    small = mob(g);
  assert.equal(g.launch(boss), false);
  assert.equal(boss.staggerMeter, 8);
  g.launch(elite);
  assert.ok(elite.juggleUntil - g.t <= 0.45);
  assert.equal(elite.staggerMeter, 25);
  g.launch(small);
  assert.equal(g.launch(small), false);
});
test("P1 air hits · target reaches six-hit limit then lands instead of infinite juggling", () => {
  const g = setup(),
    p = g.player,
    e = mob(g);
  g.launch(e);
  for (let i = 0; i < 6; i++)
    g.executeAttack(p, {
      id: "air-" + i,
      angle: 0,
      range: 110,
      cone: Math.PI,
      damage: 1,
      air: true,
      strike: 1,
    });
  assert.equal(e.juggleCount, 6);
  assert.equal(e.airHeight, 0);
  assert.equal(e.juggleUntil, 0);
});
test("P1 slam · requires two airborne hits and down input, never forces a ground down+Z slam", () => {
  const g = setup(),
    p = g.player;
  g.currentInput = { down: true };
  g.requestAttack(p);
  assert.equal(
    g.effects.some((e) => e.type === "impact"),
    false,
  );
  p.attack = null;
  g.jump();
  p.airHits = 2;
  p.slamWindowEnd = g.t + 0.3;
  assert.ok(g.requestAttack(p));
  assert.equal(p.airHeight, 0);
  assert.ok(g.effects.some((e) => e.type === "impact"));
});
test("P1 C · usable fallback shuriken, 4s cooldown and duplicate use rejected", () => {
  const g = setup(),
    p = g.player,
    e = mob(g);
  assert.ok(g.requestAttack(p, true));
  assert.equal(g.requestAttack(p, true), false);
  run(g, 0.3);
  assert.ok(e.hp < 10000);
  assert.equal(p.stats.specials, 1);
  assert.equal(p.specialAt, 4);
});
test("P1 player damage · interrupts queued attacks and reduces style; jump offers no immunity", () => {
  const g = setup(),
    p = g.player,
    e = mob(g);
  g.jump();
  p.styleScore = 40;
  g.requestAttack(p);
  p.buffer = { special: true, until: 1 };
  const hp = p.hp;
  g.damage(e, p, 9, { attackInstanceId: "hit" });
  assert.equal(p.hp, hp - 9);
  assert.equal(p.attack, null);
  assert.equal(p.buffer, null);
  assert.equal(p.styleScore, 22);
});
test("P1 momentum · gained by three connecting attacks, never by whiffs or raw dashes", () => {
  const g = setup(),
    p = g.player;
  cast(g);
  cast(g);
  cast(g);
  assert.equal(p.momentum, 0);
  mob(g);
  cast(g);
  cast(g);
  cast(g);
  assert.equal(p.momentum, 1);
  run(g, 5.2);
  assert.equal(p.momentum, 0);
});
test("P1 separate storage · legacy key never read/written; ninja summaries validated and isolated", () => {
  const s = memory();
  s.setItem(SAVE_KEY, "legacy-sentinel");
  const read = [],
    writes = [],
    spy = {
      getItem: (k) => {
        read.push(k);
        return s.getItem(k);
      },
      setItem: (k, v) => {
        writes.push(k);
        s.setItem(k, v);
      },
    };
  const g = new NinjaGame({ storage: spy, random: () => 0.5 });
  g.damage(g.enemies[0], g.player, 1000, { attackInstanceId: "fatal" });
  assert.equal(g.mode, "dead");
  assert.equal(g.saved, true);
  assert.equal(read.includes(SAVE_KEY), false);
  assert.equal(writes.includes(SAVE_KEY), false);
  assert.equal(s.getItem(SAVE_KEY), "legacy-sentinel");
  assert.equal(readNinjaRecords(s).length, 1);
  s.setItem(NINJA_SAVE_KEY, '{"bad":true}');
  assert.deepEqual(readNinjaRecords(s), []);
});
test("P1 encounter · three enemy roles, P1 dojo avoids growth/legacy hunters, bounded entities", () => {
  const g = new NinjaGame({ dojo: false, random: () => 0.5 });
  assert.deepEqual(
    g.enemies.map((e) => e.type),
    ["hungry", "crawler", "spitter"],
  );
  const h = setup();
  run(h, 8);
  assert.equal(h.mode, "playing");
  assert.equal(h.player.organs.back, null);
  assert.equal(h.hunter, null);
  assert.ok(h.effects.length <= 160);
});
test("P1 real sequence · Space + held Z reaches air second hit, then down+Z can cancel its recovery into slam", () => {
  const g = setup();
  mob(g);
  g.tick(0.01, { jumpPressed: true, attack: true });
  let limit = 160;
  while (g.player.airHits < 2 && limit-- > 0) g.tick(1 / 120, { attack: true });
  assert.ok(limit > 0);
  assert.ok(g.player.airHeight > 0);
  assert.ok(g.player.attack?.air && g.player.attack.executed);
  run(g, 0.1, { attack: true, down: true });
  assert.equal(g.player.airHeight, 0);
  assert.ok(g.effects.some((e) => e.type === "impact"));
});
test("P1 edge buffer · short Z/Space inputs and their directions survive hitstop after key release", () => {
  const g = setup(),
    e = mob(g, 1370);
  g.launch(e);
  g.hitstop = 0.05;
  g.tick(0.01, {
    jumpPressed: true,
    right: true,
    attackPressed: true,
    attack: true,
  });
  g.tick(0.08, {});
  assert.equal(g.player.followUsed, true);
  assert.ok(g.player.attack?.air);
});
test("P1 style · repeated single action stops granting style; varied combat earns more", () => {
  const g = setup();
  for (let i = 0; i < 20; i++) g.addStyle("sword", 4);
  const before = g.player.styleScore;
  g.addStyle("sword", 4);
  assert.equal(g.player.styleScore, before);
  g.addStyle("air", 8);
  assert.ok(g.player.styleScore > before);
});
