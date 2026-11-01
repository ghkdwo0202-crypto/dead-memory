import test from "node:test";
import assert from "node:assert/strict";
import { SealSequence, canonical } from "../src/seals.js";
import {
  SIDE_SKILLS,
  RECIPE_IDS,
  validateSideSkills,
} from "../src/side-skills.js";
import { SideGame } from "../src/sideview-core.js";
const elements = ["fire", "water", "lightning", "wind"];
const floor = [
  { id: "floor", x: 0, y: 500, width: 1500, height: 100, oneWay: false },
];
function setup() {
  const g = new SideGame({ demo: "dojo" });
  g.enemies = [];
  g.platforms = floor;
  Object.assign(g.player, {
    x: 200,
    y: 474,
    vx: 0,
    vy: 0,
    grounded: true,
    groundPlatformId: "floor",
  });
  return g;
}
function enemy(g, x = 285, y = 474, type = "guard") {
  const e = g.spawn(type, x, y);
  e.dummy = true;
  e.hp = e.maxHP = 10000;
  e.grounded = true;
  return e;
}
function run(g, n, input = {}) {
  for (let i = 0; i < Math.ceil(n * 60); i++) g.tick(1 / 60, input);
}
function key(g, element) {
  g.tick(1 / 60, { elements: [element] });
}
test("P3-C canonical · all 64 triples resolve to 20 multisets and 9 executable skills", () => {
  const found = new Set();
  for (const a of elements)
    for (const b of elements)
      for (const c of elements) {
        const r = canonical([a, b, c]);
        assert.ok(RECIPE_IDS[r]);
        assert.equal(r, canonical([c, b, a]));
        found.add(r);
      }
  assert.equal(found.size, 20);
  assert.deepEqual(validateSideSkills(), {
    valid: true,
    errors: [],
    recipes: 20,
    singles: 4,
    mixed: 5,
  });
});
test("P3-C state machine · first casts once, second never casts, third resets without Invoke", () => {
  const calls = [],
    s = new SealSequence((id) => calls.push(id), RECIPE_IDS);
  s.input("fire", 0);
  assert.deepEqual(calls, ["SINGLE_FIRE"]);
  s.input("water", 0.1);
  assert.equal(calls.length, 1);
  assert.equal(s.seals.length, 2);
  s.input("lightning", 0.2);
  assert.deepEqual(calls, ["SINGLE_FIRE", "NIN_017"]);
  assert.equal(s.seals.length, 0);
  assert.equal(s.expiresAt, 0);
});
test("P3-C timeout · 0.75 seconds expires from last input and next input becomes a new single", () => {
  const calls = [],
    s = new SealSequence((id) => calls.push(id), RECIPE_IDS);
  s.input("fire", 0);
  s.input("water", 0.7);
  s.tick(1.4);
  assert.equal(s.seals.length, 2);
  s.input("wind", 1.46);
  assert.deepEqual(calls, ["SINGLE_FIRE", "SINGLE_WIND"]);
  assert.deepEqual(s.seals, ["wind"]);
});
test("P3-C singles · each first key emits its unique real action and independent 1s cooldown", () => {
  for (const element of elements) {
    const g = setup(),
      e = enemy(g);
    key(g, element);
    assert.equal(g.magic.logs.length, 1);
    assert.equal(g.magic.logs[0].id, "SINGLE_" + element.toUpperCase());
    assert.ok(g.magic.cooldowns[g.magic.logs[0].id] - g.t >= 0.999);
    run(g, 0.3);
    assert.ok(e.hp < 10000);
    assert.equal(g.magic.sequence.seals.length, 1);
  }
});
test("P3-C AAA · first basic and third advanced, with at most one bounded cast request", () => {
  const g = setup();
  enemy(g);
  g.tick(1 / 60, { elements: ["fire", "fire", "fire"] });
  assert.equal(g.magic.logs.length, 1);
  assert.equal(g.magic.queued.skillId, "NIN_001");
  assert.equal(g.magic.sequence.seals.length, 0);
  run(g, 0.4);
  assert.deepEqual(
    g.magic.logs.map((l) => l.id),
    ["SINGLE_FIRE", "NIN_001"],
  );
  assert.equal(g.magic.queued, null);
});
test("P3-C permutations · ASD/SAD/DSA all automatically cast NIN017 without C or V", () => {
  for (const order of [
    ["fire", "water", "lightning"],
    ["water", "fire", "lightning"],
    ["lightning", "water", "fire"],
  ]) {
    const g = setup();
    enemy(g);
    g.tick(1 / 60, { elements: order });
    run(g, 0.4);
    assert.ok(g.magic.logs.some((l) => l.id === "NIN_017"));
    assert.equal(g.player.stats.finishers, 0);
  }
});
test("P3-C cooldown failure · triple clears seals while CD remains unchanged; no extra cast", () => {
  const g = setup();
  enemy(g);
  g.tick(1 / 60, { elements: ["fire", "fire", "fire"] });
  run(g, 0.5);
  const cd = g.magic.cooldowns.NIN_001,
    count = g.magic.logs.length;
  g.tick(1 / 60, { elements: ["fire", "fire", "fire"] });
  run(g, 0.3);
  assert.equal(g.magic.sequence.seals.length, 0);
  assert.equal(g.magic.cooldowns.NIN_001, cd);
  assert.equal(g.magic.logs.length, count);
});
test("P3-C failed single CD never blocks completion of a mixed recipe", () => {
  const g = setup();
  enemy(g);
  key(g, "fire");
  run(g, 0.8);
  g.tick(1 / 60, { elements: ["fire", "water", "lightning"] });
  run(g, 0.4);
  assert.ok(g.magic.logs.some((l) => l.id === "NIN_017"));
  assert.equal(g.magic.logs.filter((l) => l.id === "SINGLE_FIRE").length, 1);
});
test("P3-C queue · oldest request retained, second rejected; stun expiry has explicit failure", () => {
  const g = setup();
  g.player.staggerUntil = 1;
  g.tick(1 / 60, { elements: ["fire", "water", "lightning"] });
  assert.equal(g.magic.queued.skillId, "SINGLE_FIRE");
  assert.equal(g.magic.sequence.seals.length, 0);
  assert.equal(g.magic.cooldowns.NIN_017, undefined);
  run(g, 0.3);
  assert.equal(g.magic.queued, null);
  assert.equal(g.magic.logs.length, 0);
  assert.ok(g.magic.feedback.includes("시간 초과"));
});
test("P3-C FFF · directional blast differs from single projectile, burn and physical target effects", () => {
  const g = setup(),
    e = enemy(g, 330),
    rear = enemy(g, 120);
  g.tick(1 / 60, { elements: ["fire", "fire", "fire"] });
  run(g, 0.45);
  assert.ok(e.elements.burn);
  assert.ok(e.hp < 10000 - 30);
  assert.equal(rear.hp, 10000);
  assert.ok(g.effects.some((e) => e.type === "fireburst"));
});
test("P3-C WWW · grounded wave remains on its actual platform and stops at platform edge", () => {
  const g = setup();
  g.platforms = [
    { id: "floor", x: 0, y: 500, width: 350, height: 100, oneWay: false },
  ];
  const far = enemy(g, 420, 474);
  g.tick(1 / 60, { elements: ["water", "water", "water"] });
  run(g, 0.9);
  assert.equal(far.hp, 10000);
  assert.equal(g.magic.bolts.length, 0);
});
test("P3-C LLL · forward marked target takes actual lightning; rear target is excluded", () => {
  const g = setup(),
    front = enemy(g, 330),
    rear = enemy(g, 120);
  g.tick(1 / 60, { elements: ["lightning", "lightning", "lightning"] });
  run(g, 0.45);
  assert.ok(front.hp < 10000 - 30);
  assert.equal(rear.hp, 10000);
  assert.ok(front.elements.shock);
  assert.ok(
    g.effects.some((e) => e.type === "lightning") ||
      g.magic.logs.some((l) => l.id === "NIN_003"),
  );
});
test("P3-C VVV · rising wind physically launches, two blades cannot duplicate a target hit", () => {
  const g = setup(),
    e = enemy(g);
  g.tick(1 / 60, { elements: ["wind", "wind", "wind"] });
  run(g, 0.45);
  assert.ok(e.y < 474);
  const entries = [...e.received.keys()].filter((id) => id.startsWith("cast:"));
  assert.equal(new Set(entries).size, entries.length);
  assert.ok(g.magic.logs.some((l) => l.id === "NIN_004"));
});
test("P3-C FWL · consumes pre-existing wet and burn, finite amplified blast; never grants free three states", () => {
  const g = setup(),
    e = enemy(g, 285);
  e.elements = {
    burn: { stacks: 1, until: 3, next: 1 },
    wet: { stacks: 1, until: 4 },
  };
  g.tick(1 / 60, { elements: ["lightning", "fire", "water"] });
  run(g, 0.4);
  assert.equal(e.elements.burn, undefined);
  assert.equal(e.elements.wet, undefined);
  assert.ok(e.elements.shock);
  assert.ok(e.hp >= 10000 - 12 - 50);
});
test("P3-C air variants · wave in air creates blade not fake ground; wind drives enemies downward", () => {
  const g = setup(),
    e = enemy(g, 285, 360);
  g.player.y = 340;
  g.player.grounded = false;
  e.grounded = false;
  g.tick(1 / 60, { elements: ["wind", "wind", "wind"] });
  run(g, 0.4);
  assert.ok(e.y > 360);
  assert.ok(e.vy >= 0);
  const h = setup();
  h.player.y = 300;
  h.player.grounded = false;
  h.tick(1 / 60, { elements: ["water", "water", "water"] });
  run(h, 0.25);
  assert.ok(h.magic.bolts.length > 0);
  assert.ok(h.magic.bolts.every((b) => !b.surfaceId));
});
test("P3-C geometry · solid wall blocks spells and rush never warps player", () => {
  const g = setup(),
    e = enemy(g, 360);
  g.platforms.push({
    id: "wall",
    x: 250,
    y: 350,
    width: 20,
    height: 150,
    oneWay: false,
  });
  const x = g.player.x;
  g.tick(1 / 60, { elements: ["fire", "fire", "fire"] });
  run(g, 0.5);
  assert.equal(e.hp, 10000);
  assert.equal(g.player.x, x);
});
test("P3-C future 15 · preview metadata never falls back to bogus functional spell", () => {
  const g = setup();
  enemy(g);
  g.tick(1 / 60, { elements: ["fire", "fire", "water"] });
  run(g, 0.4);
  assert.equal(
    g.magic.logs.some((l) => l.id === "NIN_005"),
    false,
  );
  assert.ok(g.magic.feedback.includes("후속 단계"));
  assert.equal(g.magic.sequence.seals.length, 0);
});
