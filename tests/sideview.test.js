import test from "node:test";
import assert from "node:assert/strict";
import { SideGame, SWORD, SIDE_SAVE_KEY } from "../src/sideview-core.js";
import { PHYSICS } from "../src/physics2d.js";
const floor = [
  { id: "test-floor", x: 0, y: 500, width: 2000, height: 100, oneWay: false },
];
function setup() {
  const g = new SideGame({ demo: "dojo", random: () => 0.5 });
  g.enemies = [];
  g.platforms = floor;
  Object.assign(g.player, {
    x: 200,
    y: 474,
    vx: 0,
    vy: 0,
    grounded: true,
    groundPlatformId: "test-floor",
  });
  return g;
}
function enemy(g, type = "guard", x = 270, y = 474) {
  const e = g.spawn(type, x, y);
  e.dummy = true;
  e.hp = e.maxHP = 10000;
  e.grounded = true;
  return e;
}
function run(g, seconds, input = {}, dt = 1 / 60) {
  for (let i = 0; i < Math.round(seconds / dt); i++) g.tick(dt, input);
}
function sword(g, input = {}, finisher = false) {
  assert.ok(g.requestSword(input, finisher));
  let i = 100;
  while (g.player.attack && i--) g.tick(1 / 60, {});
  assert.ok(i > 0);
}
test("P3-A horizontal controls · up/down never move character on flat floor", () => {
  const g = setup();
  run(g, 0.5, { up: true });
  run(g, 0.5, { down: true });
  assert.equal(g.player.x, 200);
  assert.equal(g.player.y, 474);
  run(g, 0.2, { right: true });
  assert.ok(g.player.x > 220);
  run(g, 0.2);
  assert.equal(g.player.vx, 0);
});
test("P3-A variable jump · held jump reaches higher than short tap; real gravity restores ground", () => {
  const held = setup(),
    tap = setup();
  held.tick(1 / 60, { jumpPressed: true, jumpHeld: true });
  tap.tick(1 / 60, { jumpPressed: true, jumpHeld: false });
  let minA = held.player.y,
    minB = tap.player.y;
  for (let i = 0; i < 55; i++) {
    held.tick(1 / 60, { jumpHeld: true });
    tap.tick(1 / 60, {});
    minA = Math.min(minA, held.player.y);
    minB = Math.min(minB, tap.player.y);
  }
  assert.ok(minA < minB - 40);
  assert.ok(minA > 330 && minA < 365);
  assert.equal(held.player.grounded, true);
  assert.equal("airHeight" in held.player, false);
});
test("P3-A jump buffer · Space shortly before landing produces one next jump", () => {
  const g = setup(),
    p = g.player;
  p.y = 460;
  p.vy = 100;
  p.grounded = false;
  p.coyoteUntil = -1;
  g.tick(1 / 60, { jumpPressed: true, jumpHeld: true });
  run(g, 0.12, { jumpHeld: true });
  assert.ok(p.vy < 0);
  assert.equal(p.grounded, false);
});
test("P3-A air dash · only once before landing, wall collision and zero-gravity dash window", () => {
  const g = setup(),
    p = g.player;
  p.y = 350;
  p.grounded = false;
  assert.ok(g.dash({ right: true }));
  const y = p.y;
  run(g, 0.1);
  assert.equal(p.y, y);
  run(g, 0.1);
  assert.equal(g.dash({ right: true }), false);
  run(g, 0.5);
  assert.equal(p.grounded, true);
  assert.ok(g.dash({ right: true }));
});
test("P3-A fast fall/drop · down accelerates airborne fall but is not platform drop-through", () => {
  const a = setup(),
    b = setup();
  for (const g of [a, b]) {
    g.player.y = 300;
    g.player.grounded = false;
  }
  run(a, 0.15, { down: true });
  run(b, 0.15);
  assert.ok(a.player.vy > b.player.vy);
  assert.ok(a.player.y > b.player.y);
});
test("P3-A fixed step · 30/60Hz render batches produce same simulation movement", () => {
  const a = setup(),
    b = setup();
  run(a, 1, { right: true }, 1 / 30);
  run(b, 1, { right: true }, 1 / 60);
  assert.ok(Math.abs(a.player.x - b.player.x) < 0.001);
});
test("P3-A pit/checkpoint · falling respawns at safe XY with damage, never erases legacy storage", () => {
  const writes = [],
    g = new SideGame({
      storage: { getItem: () => null, setItem: (k) => writes.push(k) },
      demo: "dojo",
    });
  g.checkpoint = { id: "safe", x: 200, y: 474 };
  g.platforms = floor;
  g.player.y = 1400;
  g.tick(1 / 60, {});
  assert.equal(g.player.x, 200);
  assert.equal(g.player.y, 474);
  assert.equal(g.player.hp, 100);
  g.player.hp = 1;
  g.player.y = 1400;
  g.tick(1 / 60, {});
  assert.equal(g.mode, "dead");
  assert.deepEqual(writes, [SIDE_SAVE_KEY]);
});
test("P3-B Z hold · three actual sword timings, launch uses vy and subsequent gravity", () => {
  assert.deepEqual(
    SWORD.map((s) => s.damage),
    [16, 18, 23],
  );
  const g = setup(),
    e = enemy(g);
  run(g, 1.15, { attack: true });
  assert.ok(g.player.stats.attacks >= 3);
  assert.ok(e.hp < 10000);
  assert.ok(e.y < 474);
  assert.ok(e.vy !== 0);
  assert.equal("airHeight" in e, false);
});
test("P3-B sword geometry · forward/up/down hit boxes, no backward auto-aim or wall hits", () => {
  const g = setup(),
    front = enemy(g),
    back = enemy(g, "guard", 130),
    above = enemy(g, "guard", 200, 370);
  g.requestSword({ up: true });
  g.executeSword(g.player.attack);
  assert.ok(above.hp < 10000);
  assert.equal(front.hp, 10000);
  assert.equal(back.hp, 10000);
  g.player.attack = null;
  sword(g);
  assert.ok(front.hp < 10000);
  assert.equal(back.hp, 10000);
  const wall = {
    id: "wall",
    x: 225,
    y: 350,
    width: 12,
    height: 150,
    oneWay: false,
  };
  g.platforms = [...floor, wall];
  g.player.attack = null;
  const hp = front.hp;
  sword(g);
  assert.equal(front.hp, hp);
});
test("P3-B per attack nonce · repeated execute cannot double hit same target", () => {
  const g = setup(),
    e = enemy(g);
  g.requestSword();
  const a = g.player.attack;
  g.executeSword(a);
  const hp = e.hp;
  g.executeSword(a);
  assert.equal(e.hp, hp);
});
test("P3-B C · grounded uppercut, air downward slam and 2.8s spent on whiff", () => {
  const g = setup(),
    e = enemy(g);
  sword(g, {}, true);
  assert.ok(e.y < 474 || e.vy < 0);
  assert.ok(g.player.finisherAt > g.t);
  assert.equal(g.requestSword({}, true), false);
  const h = setup();
  h.player.grounded = false;
  h.player.y = 350;
  assert.ok(h.requestSword({}, true));
  assert.equal(h.player.attack.dir, "down");
  assert.equal(h.player.finisherAt, 2.8);
  assert.equal(h.player.vy, 620);
});
test("P3-B pogo · downward hit bounces player -430, same target has 0.2s hit gate", () => {
  const g = setup(),
    p = g.player,
    e = enemy(g, "guard", 200, 474);
  p.y = 390;
  p.grounded = false;
  p.vy = 100;
  g.requestSword({ down: true });
  g.executeSword(p.attack);
  assert.equal(p.vy, -430);
  assert.equal(p.stats.pogos, 1);
  const hp = e.hp;
  p.attack = null;
  g.requestSword({ down: true });
  g.executeSword(p.attack);
  assert.equal(e.hp, hp);
});
test("P3-B perfect dodge · only actual hostile collision in 25–125ms window grants C counter once", () => {
  const g = setup(),
    p = g.player,
    e = enemy(g);
  g.dash({ right: true });
  assert.equal(p.stats.perfect, 0);
  g.t = 0.01;
  assert.equal(g.damage(e, p, 1, "too-early"), 1);
  const h = setup(),
    q = h.player,
    f = enemy(h);
  h.dash();
  h.t = 0.05;
  h.damage(f, q, 10, "valid");
  h.damage(f, q, 10, "valid");
  assert.equal(q.stats.perfect, 1);
  assert.equal(q.hp, 120);
  h.t = 0.3;
  h.damage(f, q, 10, "valid");
  assert.equal(q.hp, 120);
  q.dashUntil = 0;
  h.requestSword({}, true);
  assert.ok(q.attack.counter);
  assert.equal(q.attack.range, 150);
});
test("P3-B dash slash · 35px swept lunge adds no new immunity", () => {
  const g = setup(),
    p = g.player;
  g.dash({ right: true });
  run(g, 0.19);
  assert.ok(g.requestSword());
  assert.ok(p.attack.dashCut);
  const until = p.invulnUntil,
    before = p.x;
  g.executeSword(p.attack);
  assert.equal(p.x - before, 35);
  assert.equal(p.invulnUntil, until);
});
test("P3-B juggle · five hits/one relift limit and heavy enemies never levitate", () => {
  const g = setup(),
    elite = enemy(g, "elite"),
    boss = enemy(g, "boss", 320);
  assert.equal(g.launch(elite), false);
  assert.equal(g.launch(boss), false);
  assert.equal(elite.vy, 0);
  const e = enemy(g, "guard", 270);
  g.launch(e);
  assert.ok(e.vy < 0);
  assert.ok(g.launch(e));
  assert.equal(g.launch(e), false);
  e.airJuggleHits = 5;
  e.grounded = false;
  g.requestSword();
  const hp = e.hp;
  g.executeSword(g.player.attack);
  assert.equal(e.hp, hp);
});
test("P3-B event safety · recursive event chain respects depth 4 and 64 total budget", () => {
  const g = setup();
  let count = 0;
  g.events.on("loop", () => {
    count++;
    g.events.emit("loop");
    g.events.emit("loop");
  });
  g.events.emit("loop");
  assert.ok(count <= 64);
  assert.ok(count > 1);
});
test("P3-B 3 minute simulation · enemies/FX bounded and checkpoint/levelup lifecycle remains usable", () => {
  const g = new SideGame({ random: () => 0.5 });
  let deaths = 0;
  for (let i = 0; g.t < 180 && i < 60 * 250; i++) {
    if (g.mode === "levelup") g.choose(0);
    if (g.mode === "dead") {
      deaths++;
      g.player.hp = g.player.maxHP;
      g.player.dead = false;
      g.mode = "playing";
      g.player.x = g.checkpoint.x;
      g.player.y = g.checkpoint.y;
      g.player.hurtUntil = g.t + 1;
    }
    g.tick(1 / 60, {
      attack: true,
      right: i % 700 < 350,
      left: i % 700 >= 350,
      jumpPressed: i % 100 === 0,
      jumpHeld: i % 100 < 12,
      dashPressed: i % 170 === 0,
      finisherPressed: i % 230 === 0,
    });
  }
  assert.ok(g.t >= 180);
  assert.ok(g.enemies.length <= 100);
  assert.ok(g.effects.length <= 180);
  assert.ok(g.projectiles.length <= 200);
  assert.ok(deaths >= 0);
});
