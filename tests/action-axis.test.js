import test from "node:test";
import assert from "node:assert/strict";
import {
  Game,
  Actor,
  OrganSystem,
  applyReward,
  rewardCandidates,
  targetFor,
  saveDeath,
  loadDeaths,
  createHunter,
} from "../src/core.js";
import { ACTION_UPGRADES, actionRank } from "../src/data.js";
function fixture() {
  const game = new Game({ random: () => 0.5 });
  game.enemies = [];
  game.spawnAt = Infinity;
  game.eliteAt = Infinity;
  game.hunterChecked = true;
  const p = game.player,
    e = game.spawnEnemy("hungry", { x: 1290, y: 800 });
  e.hp = e.maxHP = 1000;
  e.speed = 0;
  e.nextAttack = Infinity;
  return { game, p, e };
}
function attack(game, actor, special = false) {
  assert.equal(game.requestAttack(actor, special, false), true);
  const a = actor.attack;
  game.t = a.activeAt;
  game.updateActor(actor, 0);
  game.t = a.endAt + 0.01;
  game.updateActor(actor, 0);
  game.hitstop = 0;
  return a;
}
function upgrade(p, count) {
  for (let i = 0; i < count; i++)
    assert.ok(applyReward(p, { kind: "action", id: "ARM_SAW_FLOW" }));
}
const memory = () => {
  const data = new Map();
  return {
    getItem: (k) => data.get(k) || null,
    setItem: (k, v) => data.set(k, v),
  };
};
test("base saw chain counts confirmed hits on the same target, boosts third and applies bleed", () => {
  const { game, p, e } = fixture();
  attack(game, p);
  assert.equal(p.sawCombo.hits, 1);
  assert.ok(!e.statuses.bleed);
  attack(game, p);
  assert.equal(p.sawCombo.hits, 2);
  assert.ok(!e.statuses.bleed);
  const before = e.hp;
  const a = attack(game, p);
  assert.equal(a.nativeStrike, 3);
  assert.ok(Math.abs(before - e.hp - p.arm.baseStats.damage * 1.3) < 0.001);
  assert.ok(e.statuses.bleed);
  assert.equal(p.sawCombo.hits, 0);
});
test("a swing hitting multiple enemies only advances one primary chain hit", () => {
  const { game, p } = fixture();
  const other = game.spawnEnemy("hungry", { x: 1290, y: 820 });
  other.hp = 1000;
  attack(game, p);
  assert.equal(p.sawCombo.hits, 1);
  assert.ok(other.hp < 1000);
});
test("target switch, a whiff and timeout each reset the native chain", () => {
  const { game, p, e } = fixture();
  attack(game, p);
  e.y = 1400;
  const other = game.spawnEnemy("hungry", { x: 1290, y: 800 });
  other.hp = 1000;
  attack(game, p);
  assert.equal(p.sawCombo.hits, 1);
  assert.equal(p.sawCombo.targetId, other.id);
  game.enemies = [];
  attack(game, p);
  assert.equal(p.sawCombo.hits, 0);
  game.enemies = [e];
  e.x = 1290;
  e.y = 800;
  attack(game, p);
  game.t += p.arm.baseStats.comboWindow + 0.1;
  attack(game, p);
  assert.equal(p.sawCombo.hits, 1);
});
test("copied attacks do not advance the player-initiated combo", () => {
  const { game, p } = fixture();
  const template = {
    id: 100,
    organID: "ARM_SAW",
    angle: 0,
    special: false,
    rank: 0,
  };
  game.executeAttack(p, template, 0.4);
  assert.equal(p.sawCombo.hits, 0);
  assert.equal(p.stats.attacks, 0);
});
test("rank zero has no dash-cut; rank one lunges on X→Z once, without extending invulnerability", () => {
  const a = fixture();
  a.game.dash(a.p, { right: true });
  a.game.t = 0.23;
  assert.equal(attack(a.game, a.p).dashCut, false);
  const b = fixture();
  upgrade(b.p, 1);
  b.game.dash(b.p, { right: true });
  const until = b.p.invulnerableUntil;
  b.game.t = 0.23;
  const start = b.p.x,
    move = attack(b.game, b.p);
  assert.ok(move.dashCut);
  assert.ok(
    Math.abs(b.p.x - start - ACTION_UPGRADES.ARM_SAW_FLOW.lungeDistance) < 1e-8,
  );
  assert.equal(b.p.invulnerableUntil, until);
  assert.equal(attack(b.game, b.p).dashCut, false);
});
test("dash-cut cannot pass through obstacles and expires when delayed", () => {
  const { game, p } = fixture();
  upgrade(p, 1);
  p.x = 1560;
  p.y = 500;
  game.dash(p, { right: true });
  game.t = 0.23;
  attack(game, p);
  assert.ok(p.x < 1586);
  game.t += 1;
  assert.equal(attack(game, p).dashCut, false);
});
test("rank two unlocks third-hit C finisher; basic rank cannot prime it", () => {
  const a = fixture();
  for (let i = 0; i < 3; i++) attack(a.game, a.p);
  assert.equal(a.p.finisherUntil, 0);
  const { game, p, e } = fixture();
  upgrade(p, 2);
  for (let i = 0; i < 3; i++) attack(game, p);
  assert.ok(p.finisherUntil > game.t);
  const before = e.hp,
    finisher = attack(game, p, true);
  assert.ok(finisher.finisher);
  assert.ok(game.notifications.some((n) => n.sub === "FINISHER / C"));
  assert.equal(p.finisherUntil, 0);
  assert.ok(before - e.hp > p.arm.baseStats.damage * 2.1);
  assert.ok(game.effects.some((f) => f.type === "tentacle"));
  assert.equal(game.requestAttack(p, true), false);
});
test("expired third-hit window leaves normal C functioning", () => {
  const { game, p } = fixture();
  upgrade(p, 2);
  for (let i = 0; i < 3; i++) attack(game, p);
  game.t = p.finisherUntil + 0.1;
  assert.equal(attack(game, p, true).finisher, false);
});
test("rank three enables C→Z recovery cancel and only real evasions refund C cooldown", () => {
  const { game, p, e } = fixture();
  upgrade(p, 3);
  const c = attack(game, p, true);
  assert.ok(Math.abs(c.endAt - c.activeAt - 0.08) < 0.001);
  const before = p.specialAt;
  assert.ok(game.dash(p, { left: true }));
  assert.equal(p.specialAt, before);
  game.damage(e, p, 10, { attackInstanceId: "bite-1" });
  assert.ok(Math.abs(p.specialAt - (before - 1.25)) < 0.001);
  const refunded = p.specialAt;
  game.damage(e, p, 10, { attackInstanceId: "bite-1" });
  assert.equal(p.specialAt, refunded);
});
test("action upgrades are sequential, capped, valid rewards and inactive with another arm", () => {
  const { p } = fixture();
  for (let rank = 0; rank < 3; rank++) {
    assert.ok(rewardCandidates(p, () => 0.5).some((r) => r.kind === "action"));
    upgrade(p, 1);
    assert.equal(actionRank(p), rank + 1);
  }
  assert.equal(applyReward(p, { kind: "action", id: "ARM_SAW_FLOW" }), false);
  assert.ok(!rewardCandidates(p).some((r) => r.kind === "action"));
  OrganSystem.equip(p, "ARM_SPINE");
  assert.equal(actionRank(p), 0);
  assert.equal(applyReward(p, { kind: "action", id: "ARM_SAW_FLOW" }), false);
  OrganSystem.equip(p, "ARM_SAW");
  assert.equal(actionRank(p), 3);
  assert.equal(p.sawCombo.hits, 0);
});
test("legacy records load without action ranks; new ranks save and restore into hunter", () => {
  const store = memory(),
    { p } = fixture();
  const old = saveDeath(store, p, { runID: "old" });
  delete old.upgradeRanksById;
  assert.equal(actionRank(createHunter(old, 1500, 800)), 0);
  upgrade(p, 3);
  saveDeath(store, p, { runID: "new" });
  assert.equal(
    actionRank(createHunter(loadDeaths(store).at(-1), 1500, 800)),
    3,
  );
  const malformed = {
    ...old,
    upgradeRanksById: { ARM_SAW_FLOW: 99, UNKNOWN: 3 },
  };
  assert.equal(actionRank(createHunter(malformed, 1500, 800)), 0);
});
test("preview run starts with action axis unlocked and never writes death records", () => {
  const store = memory(),
    game = new Game({
      storage: store,
      previewActions: true,
      random: () => 0.5,
    });
  assert.equal(actionRank(game.player), 3);
  const e = game.enemies[0];
  game.damage(e, game.player, 9999);
  assert.equal(game.mode, "dead");
  assert.equal(loadDeaths(store).length, 0);
});
test("target selection prefers angular alignment, then distance and stable ID", () => {
  const { p } = fixture();
  const near = new Actor({ id: "near", x: 1240, y: 830 }),
    aligned = new Actor({ id: "aligned", x: 1300, y: 800 });
  assert.equal(targetFor(p, [near, aligned]), aligned);
  const a = new Actor({ id: "a", x: 1280, y: 800 }),
    b = new Actor({ id: "b", x: 1280, y: 800 });
  assert.equal(targetFor(p, [b, a]), a);
  const close = new Actor({ id: "z", x: 1240, y: 800 });
  assert.equal(targetFor(p, [aligned, close]), close);
});
test("distinct prevented hostile attacks each emit once per instance, never on an empty dash", () => {
  const { game, p, e } = fixture();
  let count = 0;
  game.events.on("OnSuccessfulEvade", () => count++);
  game.dash(p);
  assert.equal(count, 0);
  game.damage(e, p, 10, { attackInstanceId: "a" });
  game.damage(e, p, 10, { attackInstanceId: "a" });
  game.damage(e, p, 10, { attackInstanceId: "b" });
  assert.equal(count, 2);
  game.t = 0.3;
  game.damage(e, p, 10, { attackInstanceId: "a" });
  assert.equal(p.hp, 120);
});
test("same attack instance cannot deal repeated damage, but a separate instance can", () => {
  const { game, p, e } = fixture();
  assert.equal(game.damage(p, e, 10, { attackInstanceId: "one" }), 10);
  assert.equal(game.damage(p, e, 10, { attackInstanceId: "one" }), 0);
  assert.equal(game.damage(p, e, 10, { attackInstanceId: "two" }), 10);
});
test("a resolved primary attack cannot execute twice or double-advance its chain", () => {
  const { game, p, e } = fixture();
  const a = attack(game, p),
    hp = e.hp;
  game.executeAttack(p, a);
  assert.equal(e.hp, hp);
  assert.equal(p.sawCombo.hits, 1);
});

test("C pressed immediately after third hit buffers through recovery and wins over held Z", () => {
  const { game, p } = fixture();
  upgrade(p, 2);
  attack(game, p);
  attack(game, p);
  assert.ok(game.requestAttack(p));
  game.t = p.attack.activeAt;
  game.updateActor(p, 0);
  assert.ok(p.finisherUntil > game.t);
  assert.equal(game.requestAttack(p, true), false);
  assert.equal(p.buffer.special, true);
  for (let i = 0; i < 50; i++) game.tick(0.02, { attack: true });
  assert.equal(p.stats.finishers, 1);
  assert.equal(p.stats.specials, 1);
});

test("hitstop reports deferred input so C/X edges survive until a simulation step processes them", () => {
  const { game, p } = fixture();
  game.hitstop = 0.02;
  const before = game.t;
  assert.equal(game.tick(0.02, { specialPressed: true }), false);
  assert.equal(game.t, before);
  assert.equal(p.stats.specials, 0);
  assert.equal(game.tick(0.02, { specialPressed: true }), true);
  assert.equal(p.stats.specials, 1);
});

test("surplus XP creates consecutive valid level-up choices until all pending levels are resolved", () => {
  const { game } = fixture();
  game.xp = 80;
  game.checkLevel();
  let choices = 0;
  while (game.mode === "levelup") {
    assert.equal(game.rewardChoices.length, 3);
    assert.ok(game.choose(0));
    choices++;
    assert.ok(choices < 10);
  }
  assert.equal(choices, 3);
  assert.equal(game.mode, "playing");
  assert.equal(game.level, 4);
});
