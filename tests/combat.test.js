import test from "node:test";
import assert from "node:assert/strict";
import {
  Actor,
  Combat,
  Combo,
  Events,
  saveDeath,
  loadDeaths,
  createHunter,
  hunterPlan,
  findPath,
  lineOfSight,
} from "../src/core.js";
import {
  SKILLS,
  RECIPES,
  CORE_IDS,
  availableRecipes,
  rewardCandidates,
  connections,
} from "../src/data.js";
function fixture(skills = ["A01", "M01", "S01"]) {
  const actor = new Actor({ x: 0, y: 0, skills }),
    target = new Actor({ id: "target", x: 90, y: 0, hp: 1000 });
  const hits = [],
    resonances = [],
    effects = [],
    summons = [];
  const world = {
    targets: (a) => (a === actor ? [target] : [actor]),
    move: (a, dx, dy) => {
      a.x += dx;
      a.y += dy;
      return { x: a.x, y: a.y };
    },
    number: (a, n) => hits.push(n),
    effect: (e) => effects.push(e),
    summon: (a, s) => summons.push(s),
  };
  const combat = new Combat(world);
  let clock = 0;
  actor.bus.on("ResonanceTriggered", ({ recipe }) => {
    resonances.push(recipe.id);
    combat.resonance(actor, recipe, clock);
  });
  return {
    actor,
    target,
    combat,
    hits,
    resonances,
    effects,
    summons,
    use: (id, time) => {
      clock = time;
      return combat.use(actor, id, 0, time);
    },
  };
}
test("01 · A01 → M01 requires a dash hit to trigger R01", () => {
  const f = fixture();
  f.use("A01", 0);
  f.use("M01", 0.5);
  assert.deepEqual(f.resonances, ["R01"]);
  const miss = fixture();
  miss.target.y = 400;
  miss.use("A01", 0);
  miss.use("M01", 0.5);
  assert.deepEqual(miss.resonances, []);
});
test("02 · reverse order does not trigger R01", () => {
  const f = fixture();
  f.use("M01", 0);
  f.use("A01", 0.5);
  assert.deepEqual(f.resonances, []);
});
test("03 · window starts at action end and expires after 2s", () => {
  const f = fixture();
  f.use("A01", 0);
  f.use("M01", 2.19);
  assert.deepEqual(f.resonances, []);
  const edge = fixture();
  edge.use("A01", 0);
  edge.use("M01", 2.18);
  assert.deepEqual(edge.resonances, ["R01"]);
});
test("04 · A01 → M01 → S01 extends R01 into U01 only", () => {
  const f = fixture();
  f.use("A01", 0);
  f.use("M01", 0.5);
  f.use("S01", 1);
  assert.deepEqual(f.resonances, ["R01", "U01"]);
  assert.equal(f.summons.length, 3);
});
test("05 · U01 applies clone slashes without repeating dash/explosion damage", () => {
  const f = fixture();
  f.use("A01", 0);
  f.use("M01", 0.5);
  assert.deepEqual(f.hits, [32, 28, 26]);
  f.use("S01", 1);
  assert.deepEqual(f.hits, [32, 28, 26, 20, 20]);
  f.actor.combo.hit("S01");
  assert.deepEqual(f.resonances, ["R01", "U01"]);
});
test("06 · failed resonance still performs base skills", () => {
  const f = fixture();
  f.use("M01", 0);
  f.target.x = 250;
  f.use("A01", 0.5);
  assert.deepEqual(f.resonances, []);
  assert.deepEqual(f.hits, [28, 32]);
});
test("07 · cooling skills cannot append input or resolve resonance", () => {
  const f = fixture();
  f.actor.cooldowns.M01 = 7;
  f.use("A01", 0);
  assert.equal(f.use("M01", 0.5), false);
  assert.equal(f.actor.combo.history.length, 1);
  assert.deepEqual(f.resonances, []);
});
test("08 · equipping refreshes recipes and clears active chain", () => {
  const f = fixture();
  assert.equal(availableRecipes(f.actor.skills).length, 3);
  f.use("A01", 0);
  assert.equal(f.actor.equip("D01", 1), true);
  assert.equal(f.actor.combo.history.length, 0);
  assert.deepEqual(availableRecipes(f.actor.skills), []);
  assert.equal(f.actor.equip("A01", 1), false);
});
function fakeStorage() {
  const map = new Map();
  return {
    getItem: (k) => map.get(k) || null,
    setItem: (k, v) => map.set(k, v),
  };
}
test("09 · death saves equipped skills, successful recipes and counts", () => {
  const f = fixture();
  f.use("A01", 0);
  f.use("M01", 0.5);
  const storage = fakeStorage(),
    record = saveDeath(storage, f.actor, {
      runID: "test",
      floor: 2,
      cause: "enemy",
    });
  assert.deepEqual(record.equippedSkillIDs, ["A01", "M01", "S01"]);
  assert.deepEqual(record.successfulResonanceIDs, ["R01"]);
  assert.equal(record.comboUsageCounts.R01, 1);
  assert.equal(record.deathFloor, 2);
  assert.equal(loadDeaths(storage).length, 1);
});
test("10 · hunter inherits only equipped skills and actually successful resonances", () => {
  const f = fixture();
  f.use("A01", 0);
  f.use("M01", 0.5);
  const record = saveDeath(fakeStorage(), f.actor, { runID: "test" }),
    hunter = createHunter(record, 0, 0);
  assert.deepEqual(hunter.skills, record.equippedSkillIDs);
  assert.deepEqual(hunter.combo.allowed, ["R01"]);
  assert.deepEqual(
    hunterPlan(hunter, () => 0),
    ["A01", "M01"],
  );
  const fired = [];
  hunter.bus.on("ResonanceTriggered", ({ recipe }) => fired.push(recipe.id));
  hunter.combo.used("A01", 0, 0.18);
  hunter.combo.used("M01", 0.5, 0.72);
  hunter.combo.hit("M01");
  hunter.combo.used("S01", 1, 1.18);
  assert.deepEqual(fired, ["R01"]);
});
test("11 · interrupted hunter combo cannot extend to U01", () => {
  const record = {
      equippedSkillIDs: ["A01", "M01", "S01"],
      successfulResonanceIDs: ["R01", "U01"],
      comboUsageCounts: { R01: 1, U01: 3 },
    },
    hunter = createHunter(record, 0, 0),
    fired = [];
  hunter.bus.on("ResonanceTriggered", ({ recipe }) => fired.push(recipe.id));
  hunter.combo.used("A01", 0, 0.18);
  hunter.combo.used("M01", 0.5, 0.72);
  hunter.combo.hit("M01");
  hunter.combo.interrupt("lost-sight");
  hunter.combo.used("S01", 1, 1.18);
  assert.deepEqual(fired, ["R01"]);
});
test("12 · death archive reloads from a new storage adapter", () => {
  const storage = fakeStorage(),
    f = fixture();
  saveDeath(storage, f.actor, { runID: "persist" });
  const reopened = { getItem: (key) => storage.getItem(key) };
  assert.deepEqual(loadDeaths(reopened)[0].equippedSkillIDs, f.actor.skills);
  assert.equal(loadDeaths(reopened)[0].runID, "persist");
});
test("all 20 skills and 28 recipes are defined; only slice is playable", () => {
  assert.equal(Object.keys(SKILLS).length, 20);
  assert.equal(RECIPES.length, 28);
  assert.equal(Object.values(SKILLS).filter((s) => s.implemented).length, 6);
  for (const s of Object.values(SKILLS)) {
    for (const key of [
      "id",
      "name",
      "category",
      "tags",
      "cooldown",
      "castTime",
      "range",
      "damage",
      "statusEffects",
      "animationID",
      "vfxID",
      "aiUsageConditions",
    ])
      assert.ok(key in s);
  }
});
test("R05 replays dash path and R11 adds marked lifesteal", () => {
  const f = fixture();
  f.use("M01", 0);
  f.use("S01", 0.5);
  assert.deepEqual(f.resonances, ["R05"]);
  assert.ok(f.hits.includes(30));
  const blood = fixture(["D03", "A01", "D01"]);
  blood.actor.hp = 40;
  blood.use("D03", 0);
  blood.use("A01", 0.5);
  assert.deepEqual(blood.resonances, ["R11"]);
  assert.ok(blood.actor.hp > 40);
});
test("parry negates damage and retaliates, ordinary expired parry does not", () => {
  const f = fixture(["D01"]);
  f.use("D01", 1);
  assert.equal(f.combat.damage(f.target, f.actor, 20, 1.1), 0);
  assert.equal(f.actor.hp, 100);
  assert.equal(f.target.hp, 962);
  f.combat.damage(f.target, f.actor, 20, 2);
  assert.equal(f.actor.hp, 80);
});
test("expired extension cannot produce U01; old R01 cannot authorize a new missed dash", () => {
  const f = fixture();
  f.use("A01", 0);
  f.use("M01", 0.5);
  f.use("S01", 2.23);
  assert.deepEqual(f.resonances, ["R01"]);
  const bus = new Events(),
    combo = new Combo(bus),
    fired = [];
  bus.on("ResonanceTriggered", (e) => fired.push(e.recipe.id));
  combo.used("A01", 0, 0.18);
  combo.used("M01", 0.3, 0.52);
  combo.hit("M01");
  combo.used("A01", 0.6, 0.78);
  combo.used("M01", 0.9, 1.12);
  combo.used("S01", 1.3, 1.48);
  assert.deepEqual(fired, ["R01", "R05"]);
});
test("candidate generator guarantees a link if a feasible one exists", () => {
  for (let i = 0; i < 50; i++) {
    const candidates = rewardCandidates(["A01"]);
    assert.equal(candidates.length, 3);
    assert.ok(candidates.some((id) => connections(id, ["A01"]).length));
    assert.ok(!candidates.includes("A01"));
  }
  assert.deepEqual(rewardCandidates(CORE_IDS), []);
});
test("pathfinding detours around a wall and line of sight detects occlusion", () => {
  const open = (x, y) =>
    x >= 0 && y >= 0 && x < 240 && y < 200 && !(x >= 80 && x < 120 && y < 120);
  const a = { x: 20, y: 20 },
    b = { x: 180, y: 20 };
  assert.equal(lineOfSight(a, b, open), false);
  const path = findPath(a, b, open);
  assert.ok(path.length > 4);
  assert.ok(path.some((p) => p.y >= 120));
  assert.deepEqual(path.at(-1), { x: 180, y: 20 });
});
test("malformed archives are ignored and retained history is bounded", () => {
  assert.deepEqual(loadDeaths({ getItem: () => "{broken" }), []);
  assert.deepEqual(
    loadDeaths({
      getItem: () => '[{"version":1,"equippedSkillIDs":["missing"]}]',
    }),
    [],
  );
  const s = fakeStorage(),
    f = fixture();
  for (let i = 0; i < 10; i++) saveDeath(s, f.actor, { runID: String(i) });
  assert.equal(loadDeaths(s).length, 8);
  assert.equal(loadDeaths(s)[0].runID, "2");
});
