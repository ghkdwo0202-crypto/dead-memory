import { SKILLS, ACTIVE_RECIPES, availableRecipes } from "./data.js";
export class Events {
  constructor() {
    this.listeners = new Map();
  }
  on(name, fn) {
    const list = this.listeners.get(name) || [];
    list.push(fn);
    this.listeners.set(name, list);
    return () =>
      this.listeners.set(
        name,
        list.filter((x) => x !== fn),
      );
  }
  emit(name, event) {
    for (const fn of this.listeners.get(name) || []) fn(event);
  }
}
export class Combo {
  constructor(bus = new Events(), allowed = null) {
    this.bus = bus;
    this.allowed = allowed;
    this.history = [];
    this.fired = new Set();
    this.serial = 0;
  }
  interrupt(reason = "stun") {
    this.history = [];
    this.fired.clear();
    this.bus.emit("ComboInterrupted", { reason });
  }
  window() {
    return this.history.at(-1)?.id === "M01" &&
      this.fired.has(`R01:${this.history.at(-1).serial}`)
      ? 1.5
      : 2;
  }
  expire(now) {
    if (this.history.length && now > this.history.at(-1).end + this.window()) {
      this.history = [];
      this.fired.clear();
      this.bus.emit("ComboExpired", {});
    }
  }
  used(id, now, end) {
    this.expire(now);
    this.history.push({
      id,
      time: now,
      end,
      hit: false,
      parry: false,
      serial: ++this.serial,
    });
    if (this.history.length > 3) this.history.shift();
    return this.evaluate("use");
  }
  hit(id, serial = this.serial) {
    const entry = this.history.find((e) => e.id === id && e.serial === serial);
    if (entry) entry.hit = true;
    return this.evaluate("hit");
  }
  parry() {
    if (this.history.length) this.history.at(-1).parry = true;
    return this.evaluate("parry");
  }
  evaluate(event) {
    const sorted = ACTIVE_RECIPES.filter(
      (r) => !this.allowed || this.allowed.includes(r.id),
    ).sort((a, b) => b.sequence.length - a.sequence.length);
    for (const recipe of sorted) {
      const n = recipe.sequence.length,
        entries = this.history.slice(-n);
      if (
        entries.length !== n ||
        !entries.every((e, i) => e.id === recipe.sequence[i])
      )
        continue;
      if (
        entries.some(
          (e, i) =>
            i &&
            e.time - entries[i - 1].end >
              (i === 2 ? recipe.extensionWindow : recipe.window),
        )
      )
        continue;
      if (
        recipe.parent &&
        !this.fired.has(`${recipe.parent}:${entries[1].serial}`)
      )
        continue;
      if (recipe.condition === "hit" && !entries.at(-1).hit) continue;
      if (recipe.condition === "parry" && !entries.some((e) => e.parry))
        continue;
      const token = `${recipe.id}:${entries.at(-1).serial}`;
      if (this.fired.has(token)) continue;
      // The third input resolves the extension alone; it must not also resolve R05.
      if (n === 2 && entries.at(-1).serial === this.advancedSerial) continue;
      this.fired.add(token);
      this.fired.add(recipe.id);
      if (n === 3) this.advancedSerial = entries.at(-1).serial;
      this.bus.emit("ResonanceTriggered", { recipe, event });
      return recipe;
    }
    return null;
  }
  candidates(ids) {
    const result = [];
    for (const recipe of availableRecipes(ids))
      for (let n = 1; n < recipe.sequence.length; n++) {
        const entries = this.history.slice(-n);
        if (
          entries.length === n &&
          entries.every((e, i) => e.id === recipe.sequence[i]) &&
          !(
            n === 2 &&
            recipe.parent &&
            !this.fired.has(`${recipe.parent}:${entries[1].serial}`)
          )
        )
          result.push({ recipe, next: recipe.sequence[n] });
      }
    return result;
  }
}
export class Actor {
  constructor({
    id = "player",
    x = 0,
    y = 0,
    skills = [],
    hp = 100,
    allowed = null,
  } = {}) {
    Object.assign(this, {
      id,
      x,
      y,
      hp,
      maxHp: hp,
      skills: [...skills],
      cooldowns: {},
      invulnerableUntil: 0,
      dead: false,
      parryUntil: 0,
      perfectUntil: 0,
      markedUntil: 0,
      attackAt: 0,
      dashes: 2,
      dashRecharge: 0,
      stats: { attacks: 0, dashes: 0, skills: 0 },
      successful: new Set(),
      comboCounts: {},
    });
    this.bus = new Events();
    this.combo = new Combo(this.bus, allowed);
    this.bus.on("ResonanceTriggered", ({ recipe }) => {
      this.successful.add(recipe.id);
      this.comboCounts[recipe.id] = (this.comboCounts[recipe.id] || 0) + 1;
    });
  }
  equip(id, slot) {
    if (
      !SKILLS[id]?.implemented ||
      this.skills.includes(id) ||
      slot < 0 ||
      slot > 2
    )
      return false;
    this.skills[slot] = id;
    this.combo.interrupt("equip");
    return true;
  }
  stun() {
    this.combo.interrupt("stun");
    this.stunnedUntil = Infinity;
  }
}
export class Combat {
  constructor(world) {
    this.world = world;
  }
  use(actor, id, angle, now) {
    const skill = SKILLS[id];
    if (
      actor.dead ||
      now < (actor.stunnedUntil || 0) ||
      now < (actor.actionUntil || 0) ||
      !actor.skills.includes(id) ||
      !skill?.implemented ||
      (actor.cooldowns[id] || 0) > now
    )
      return false;
    actor.cooldowns[id] = now + skill.cooldown;
    actor.stats.skills++;
    actor.actionUntil = now + skill.castTime;
    const start = { x: actor.x, y: actor.y };
    actor.combo.used(id, now, now + skill.castTime);
    actor.bus.emit("SkillUsed", { id, now });
    const serial = actor.combo.serial;
    const hit = (target, damage) => {
      this.damage(actor, target, damage, now);
      actor.bus.emit("SkillHit", { id, target });
      actor.combo.hit(id, serial);
    };
    this.world.noise?.(actor, 320);
    this.world.effect?.({
      type: id,
      x: actor.x,
      y: actor.y,
      angle,
      color: skill.tags[0],
      life: 0.4,
    });
    if (id === "A01")
      this.world
        .targets(actor)
        .filter(
          (t) =>
            distance(actor, t) < skill.range && facing(actor, t, angle, 1.25),
        )
        .forEach((t) => hit(t, skill.damage));
    if (id === "M01") {
      actor.invulnerableUntil = now + 0.3;
      const end = this.world.move(
        actor,
        Math.cos(angle) * skill.range,
        Math.sin(angle) * skill.range,
      );
      actor.dashPath = { start, end: { x: actor.x, y: actor.y } };
      this.world
        .targets(actor)
        .filter((t) => segmentDistance(t, start, end) < 34)
        .forEach((t) => hit(t, skill.damage));
    }
    if (id === "D01") {
      actor.parryUntil = now + 0.65;
      actor.perfectUntil = now + 0.25;
    }
    if (id === "D03")
      this.world
        .targets(actor)
        .filter((t) => distance(actor, t) < skill.range)
        .forEach((t) => {
          t.markedUntil = now + 5;
          t.markOwner = actor.id;
          hit(t, skill.damage);
          actor.bus.emit("StatusApplied", { id, target: t });
        });
    if (id === "C02")
      this.world.addZone?.({
        owner: actor,
        x: actor.x + Math.cos(angle) * 160,
        y: actor.y + Math.sin(angle) * 160,
        until: now + 3,
        nextTick: now,
        range: 115,
      });
    if (id === "S01")
      this.world.summon?.(actor, {
        x: actor.x,
        y: actor.y,
        until: now + 4,
        damage: skill.damage,
      });
    return true;
  }
  damage(source, target, amount, now) {
    if (target.dead) return 0;
    if (now < target.invulnerableUntil) {
      target.bus.emit("DashEvaded", { source });
      return 0;
    }
    if (now < target.parryUntil) {
      if (now < target.perfectUntil) {
        target.perfectUntil = 0;
        target.bus.emit("PerfectParry", {});
        target.combo.parry();
        source.combo.interrupt("parried");
        source.stunnedUntil = now + 0.75;
        this.damage(target, source, 38, now);
        this.world.effect?.({
          type: "parry",
          x: target.x,
          y: target.y,
          life: 0.5,
        });
      }
      return 0;
    }
    const dealt = Math.min(target.hp, amount);
    target.hp -= dealt;
    target.flashUntil = now + 0.1;
    if (target.markedUntil > now && target.markOwner === source.id)
      source.hp = Math.min(source.maxHp, source.hp + dealt * 0.25);
    this.world.number?.(target, dealt);
    if (target.hp <= 0) {
      target.dead = true;
      target.combo.interrupt("death");
      this.world.death?.(target, source);
    }
    return dealt;
  }
  resonance(actor, recipe, now) {
    const targets = this.world.targets(actor);
    if (recipe.id === "R01")
      targets
        .filter((t) => distance(actor, t) < 125)
        .forEach((t) => this.damage(actor, t, 26, now));
    if (recipe.id === "R05" && actor.dashPath) {
      const { start, end } = actor.dashPath;
      targets
        .filter((t) => segmentDistance(t, start, end) < 45)
        .forEach((t) => this.damage(actor, t, 30, now));
      this.world.summon?.(actor, { ...start, until: now + 2, damage: 14 });
    }
    if (recipe.id === "R11")
      targets
        .filter(
          (t) =>
            distance(actor, t) < 160 &&
            t.markedUntil > now &&
            t.markOwner === actor.id,
        )
        .forEach((t) => {
          const dealt = this.damage(actor, t, 24, now);
          actor.hp = Math.min(actor.maxHp, actor.hp + dealt * 0.3);
        });
    // U01 adds clone slashes only. It never repeats M01 or R01 damage.
    if (recipe.id === "U01")
      for (const offset of [-35, 35]) {
        this.world.summon?.(actor, {
          x: actor.x + offset,
          y: actor.y,
          until: now + 2,
          damage: 24,
        });
        targets
          .filter((t) => distance(actor, t) < 175)
          .forEach((t) => this.damage(actor, t, 20, now));
      }
    this.world.effect?.({
      type: recipe.id,
      x: actor.x,
      y: actor.y,
      life: recipe.id === "U01" ? 1 : 0.65,
      angle: 0,
    });
  }
}
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export function facing(a, b, angle, cone) {
  return (
    Math.abs(
      Math.atan2(
        Math.sin(Math.atan2(b.y - a.y, b.x - a.x) - angle),
        Math.cos(Math.atan2(b.y - a.y, b.x - a.x) - angle),
      ),
    ) < cone
  );
}
export function segmentDistance(p, a, b) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    t = Math.max(
      0,
      Math.min(
        1,
        ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1),
      ),
    );
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
export const SAVE_KEY = "dead-memory.deaths.v1";
export function loadDeaths(storage) {
  try {
    const data = JSON.parse(storage.getItem(SAVE_KEY) || "[]");
    return Array.isArray(data)
      ? data
          .filter(
            (d) =>
              d &&
              d.version === 1 &&
              Array.isArray(d.equippedSkillIDs) &&
              d.equippedSkillIDs.length <= 3 &&
              new Set(d.equippedSkillIDs).size === d.equippedSkillIDs.length &&
              d.equippedSkillIDs.every((id) => SKILLS[id]?.implemented) &&
              Array.isArray(d.successfulResonanceIDs) &&
              typeof d.comboUsageCounts === "object" &&
              d.comboUsageCounts !== null,
          )
          .slice(-8)
      : [];
  } catch {
    return [];
  }
}
export function saveDeath(
  storage,
  actor,
  { runID, floor = 1, cause = "기억의 잔해" } = {},
) {
  const record = {
    version: 1,
    runID,
    deathID: globalThis.crypto.randomUUID(),
    weaponID: "memory-blade",
    equippedSkillIDs: [...actor.skills],
    availableResonanceIDs: availableRecipes(actor.skills).map((r) => r.id),
    successfulResonanceIDs: [...actor.successful],
    comboUsageCounts: { ...actor.comboCounts },
    combatStyle:
      actor.stats.dashes > actor.stats.attacks ? "mobile" : "aggressive",
    deathFloor: floor,
    deathCause: cause,
    createdAt: new Date().toISOString(),
  };
  storage.setItem(
    SAVE_KEY,
    JSON.stringify([...loadDeaths(storage), record].slice(-8)),
  );
  return record;
}
export function createHunter(record, x, y) {
  const skills = record.equippedSkillIDs
    .filter((id) => SKILLS[id]?.implemented)
    .slice(0, 3);
  const valid = availableRecipes(skills).map((r) => r.id);
  const allowed = record.successfulResonanceIDs.filter((id) =>
    valid.includes(id),
  );
  const hunter = new Actor({ id: "hunter", x, y, skills, hp: 180, allowed });
  Object.assign(hunter, {
    record,
    state: "Patrol",
    lastSeen: null,
    heard: null,
    stateUntil: 0,
    nextDecision: 0,
    plan: [],
    path: [],
    speed: record.combatStyle === "mobile" ? 112 : 95,
  });
  return hunter;
}
export function hunterPlan(hunter, random = Math.random) {
  const recipes = ACTIVE_RECIPES.filter(
    (r) =>
      hunter.combo.allowed.includes(r.id) &&
      r.sequence.every((id) => hunter.skills.includes(id)),
  );
  const total = recipes.reduce(
    (sum, r) => sum + (Number(hunter.record.comboUsageCounts[r.id]) || 1),
    0,
  );
  let roll = random() * total;
  for (const r of recipes) {
    roll -= Number(hunter.record.comboUsageCounts[r.id]) || 1;
    if (roll <= 0) return [...r.sequence];
  }
  return hunter.skills.length
    ? [hunter.skills[Math.floor(random() * hunter.skills.length)]]
    : [];
}
export function lineOfSight(a, b, walkable) {
  const n = Math.ceil(distance(a, b) / 12);
  for (let i = 0; i <= n; i++)
    if (
      !walkable(
        a.x + ((b.x - a.x) * i) / (n || 1),
        a.y + ((b.y - a.y) * i) / (n || 1),
      )
    )
      return false;
  return true;
}
export function findPath(start, goal, walkable, cell = 40) {
  const key = (x, y) => `${x},${y}`,
    sx = Math.floor(start.x / cell),
    sy = Math.floor(start.y / cell),
    gx = Math.floor(goal.x / cell),
    gy = Math.floor(goal.y / cell);
  const queue = [[sx, sy]],
    prev = new Map([[key(sx, sy), null]]);
  let found = false;
  for (let i = 0; i < queue.length && i < 3000; i++) {
    const [x, y] = queue[i];
    if (x === gx && y === gy) {
      found = true;
      break;
    }
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx,
        ny = y + dy,
        k = key(nx, ny);
      if (
        !prev.has(k) &&
        walkable(nx * cell + cell / 2, ny * cell + cell / 2)
      ) {
        prev.set(k, [x, y]);
        queue.push([nx, ny]);
      }
    }
  }
  if (!found) return [];
  let point = [gx, gy],
    path = [];
  while (point) {
    path.push({ x: point[0] * cell + cell / 2, y: point[1] * cell + cell / 2 });
    point = prev.get(key(...point));
  }
  return path.reverse().slice(1);
}
