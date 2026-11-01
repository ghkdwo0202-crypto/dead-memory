import {
  CONFIG,
  ORGANS,
  MUTATIONS,
  STATUSES,
  ENEMIES,
  OBSTACLES,
  compatible,
  ACTION_UPGRADES,
  actionRank,
  sanitizeActionRanks,
} from "./data.js";
import { distance, lineOfSight, findPath } from "./navigation.js";
export { distance } from "./navigation.js";
export function direction(input = {}) {
  let x = Number(Boolean(input.right)) - Number(Boolean(input.left)),
    y = Number(Boolean(input.down)) - Number(Boolean(input.up));
  const n = Math.hypot(x, y) || 1;
  return { x: x / n, y: y / n };
}
const angleDelta = (a, b) =>
  Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
const uid = () => globalThis.crypto.randomUUID();
export class CombatEvents {
  constructor() {
    this.listeners = new Map();
    this.queue = [];
    this.active = null;
    this.processed = 0;
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
  emit(name, data = {}, parent = null) {
    const previous = parent || this.active;
    const context = previous
      ? {
          rootID: previous.rootID,
          depth: previous.depth + 1,
          used: previous.used,
          budget: previous.budget,
        }
      : { rootID: uid(), depth: 0, used: new Map(), budget: { count: 0 } };
    if (
      context.depth > CONFIG.maxChainDepth ||
      context.budget.count >= CONFIG.maxChainEvents
    )
      return false;
    context.budget.count++;
    this.queue.push({ name, data, context });
    if (this.active) return true;
    try {
      while (this.queue.length) {
        const item = this.queue.shift();
        this.active = item.context;
        this.processed++;
        for (const fn of this.listeners.get(item.name) || [])
          fn({ ...item.data, context: item.context });
      }
    } finally {
      this.active = null;
      this.queue = [];
    }
    return true;
  }
}
export class Actor {
  constructor({
    id = uid(),
    team = "enemy",
    x = 1200,
    y = 800,
    hp = 120,
    speed = 195,
    organs = false,
    type = "hungry",
  } = {}) {
    Object.assign(this, {
      id,
      team,
      type,
      x,
      y,
      hp,
      maxHP: hp,
      speed,
      radius: team === "player" ? 15 : ENEMIES[type]?.radius || 16,
      dead: false,
      face: 0,
      lastMove: { x: 1, y: 0 },
      lastNonZeroFacing: 0,
      actionRanks: {},
      sawCombo: { targetId: null, hits: 0, until: 0 },
      finisherUntil: 0,
      lastDashAt: -Infinity,
      dashSerial: 0,
      dashLinkUsed: 0,
      receivedAttacks: new Map(),
      evadedAttacks: new Map(),
      organs: { arm: null, back: null, heart: null, eye: null },
      mutations: [],
      statuses: {},
      timers: {},
      upgrades: { damage: 0, hp: 0, speed: 0 },
      stats: {
        kills: 0,
        direct: 0,
        auto: 0,
        mutation: 0,
        attacks: 0,
        specials: 0,
        dashes: 0,
        evades: 0,
        dashCuts: 0,
        finishers: 0,
        thirdStrikes: 0,
      },
      invulnerableUntil: 0,
      attack: null,
      buffer: null,
      specialAt: 0,
      dashes: 2,
      rechargeAt: 0,
      dashUntil: 0,
      dashDirection: { x: 1, y: 0 },
      nextAttack: 0,
      staggerUntil: 0,
      flashUntil: 0,
      boostUntil: 0,
      mutationBoostUntil: 0,
      markUntil: 0,
      markedBy: null,
      focusTarget: null,
      focusCount: 0,
      critChance: 0.05,
    });
    if (organs) this.organs.arm = "ARM_SAW";
  }
  has(id, organID) {
    return this.mutations.some(
      (m) => m.id === id && (!organID || m.organID === organID),
    );
  }
  get arm() {
    return ORGANS[this.organs.arm];
  }
}
export class OrganSystem {
  static equip(actor, id) {
    const organ = ORGANS[id];
    if (!organ || actor.organs[organ.slot] === id) return false;
    const old = actor.organs[organ.slot];
    actor.organs[organ.slot] = id;
    actor.mutations = actor.mutations.filter((m) => m.organID !== old);
    actor.timers = {};
    actor.attack = null;
    actor.buffer = null;
    if (organ.slot === "arm") {
      actor.specialAt = 0;
      actor.sawCombo = { targetId: null, hits: 0, until: 0 };
      actor.finisherUntil = 0;
      actor.dashLinkUsed = actor.dashSerial;
    }
    return true;
  }
  static mutate(actor, id, organID) {
    if (
      !Object.values(actor.organs).includes(organID) ||
      !compatible(organID, id) ||
      actor.has(id)
    )
      return false;
    actor.mutations.push({ id, organID });
    return true;
  }
}
export function targetFor(actor, targets, rule = actor.arm?.targetingRule) {
  if (!rule) return null;
  return (
    targets
      .filter(
        (e) =>
          !e.dead &&
          distance(actor, e) <= rule.distance &&
          angleDelta(Math.atan2(e.y - actor.y, e.x - actor.x), actor.face) <=
            rule.assistAngle,
      )
      .sort(
        (a, b) =>
          angleDelta(Math.atan2(a.y - actor.y, a.x - actor.x), actor.face) -
            angleDelta(Math.atan2(b.y - actor.y, b.x - actor.x), actor.face) ||
          distance(actor, a) - distance(actor, b) ||
          String(a.id).localeCompare(String(b.id)),
      )[0] || null
  );
}
export function rewardCandidates(actor, random = Math.random) {
  const organs = Object.values(ORGANS)
    .filter((o) => actor.organs[o.slot] !== o.id)
    .map((o) => ({
      kind: "organ",
      id: o.id,
      synergy:
        (o.tags.includes("bleed") &&
          Object.values(actor.organs).some((id) =>
            ORGANS[id]?.tags.includes("bleed"),
          )) ||
        (o.tags.includes("auto") && Boolean(actor.organs.eye)),
    }));
  const mutations = Object.values(actor.organs)
    .filter(Boolean)
    .flatMap((organID) =>
      ORGANS[organID].availableMutations
        .filter((id) => !actor.has(id) && compatible(organID, id))
        .map((id) => ({ kind: "mutation", id, organID, synergy: true })),
    );
  const upgrades = [
    { kind: "upgrade", id: "damage", synergy: false },
    { kind: "upgrade", id: "health", synergy: false },
    { kind: "upgrade", id: "speed", synergy: false },
  ];
  const actions = Object.values(ACTION_UPGRADES)
    .filter(
      (d) =>
        actor.organs.arm === d.organID &&
        (actor.actionRanks[d.id] || 0) < d.maxRank,
    )
    .map((d) => ({ kind: "action", id: d.id, synergy: true }));
  const pool = [...organs, ...mutations, ...actions]
    .map((value) => ({ value, n: random() }))
    .sort((a, b) => a.n - b.n)
    .map((x) => x.value);
  // The first two levels introduce automatic organs and targeting/passives before numeric rewards.
  const priority = !actor.organs.back
    ? pool.find((x) => x.kind === "organ" && ORGANS[x.id].slot === "back")
    : !actor.organs.heart
      ? pool.find((x) => x.kind === "organ" && ORGANS[x.id].slot === "heart")
      : pool.find((x) => x.synergy);
  const synergy = actions[0] || pool.find((x) => x.synergy && x !== priority);
  return [
    ...new Set([
      ...(priority ? [priority] : []),
      ...(synergy ? [synergy] : []),
      ...pool,
      ...upgrades,
    ]),
  ].slice(0, 3);
}
export function applyReward(actor, reward) {
  if (reward.kind === "action") {
    const d = ACTION_UPGRADES[reward.id];
    if (
      !d ||
      actor.organs.arm !== d.organID ||
      (actor.actionRanks[d.id] || 0) >= d.maxRank
    )
      return false;
    actor.actionRanks[d.id] = (actor.actionRanks[d.id] || 0) + 1;
    return true;
  }
  if (reward.kind === "organ") return OrganSystem.equip(actor, reward.id);
  if (reward.kind === "mutation")
    return OrganSystem.mutate(actor, reward.id, reward.organID);
  if (reward.kind !== "upgrade") return false;
  if (reward.id === "health") {
    actor.maxHP += 20;
    actor.hp = Math.min(actor.maxHP, actor.hp + 35);
  } else if (reward.id === "damage") actor.upgrades.damage += 0.1;
  else if (reward.id === "speed") actor.upgrades.speed += 0.05;
  else return false;
  return true;
}
export const SAVE_KEY = "meat-market.deaths.v1";
export function loadDeaths(storage) {
  try {
    const data = JSON.parse(storage.getItem(SAVE_KEY) || "[]");
    return Array.isArray(data)
      ? data
          .filter(
            (d) =>
              d?.version === 1 &&
              d.equippedOrganIDs &&
              typeof d.equippedOrganIDs === "object" &&
              Object.entries(d.equippedOrganIDs).every(
                ([slot, id]) => id === null || ORGANS[id]?.slot === slot,
              ) &&
              ORGANS[d.equippedOrganIDs.arm]?.slot === "arm" &&
              Array.isArray(d.mutationIDs) &&
              d.mutationIDs.every(
                (m) =>
                  m &&
                  Object.values(d.equippedOrganIDs).includes(m.organID) &&
                  compatible(m.organID, m.id),
              ),
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
  { runID, time = 0, cause = "굶주린 것" } = {},
) {
  const record = {
    version: 1,
    deathID: uid(),
    runID,
    equippedOrganIDs: { ...actor.organs },
    mutationIDs: actor.mutations.map((m) => ({ ...m })),
    mainAttackProfile: actor.arm.id,
    specialAttackProfile: actor.arm.id,
    autoAttackProfiles: [actor.organs.back].filter(Boolean),
    combatStatistics: { ...actor.stats },
    upgradeRanksById: sanitizeActionRanks(actor.actionRanks),
    deathTime: time,
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
  const a = new Actor({
    id: "hunter",
    team: "hunter",
    x,
    y,
    hp: 240,
    speed: 130,
    organs: true,
    type: "hunter",
  });
  for (const id of Object.values(record.equippedOrganIDs))
    if (id) OrganSystem.equip(a, id);
  for (const m of record.mutationIDs) OrganSystem.mutate(a, m.id, m.organID);
  a.actionRanks = sanitizeActionRanks(record.upgradeRanksById);
  a.state = "Patrol";
  a.record = record;
  a.lastSeen = null;
  a.lostAt = 0;
  a.nextDecision = 0;
  a.retreated = false;
  return a;
}
export class Game {
  constructor({
    storage = { getItem: () => null, setItem: () => {} },
    random = Math.random,
    forceHunter = false,
    previewActions = false,
  } = {}) {
    this.storage = storage;
    this.random = random;
    this.forceHunter = forceHunter;
    this.previewActions = Boolean(previewActions);
    this.records = loadDeaths(storage);
    this.runID = uid();
    this.t = 0;
    this.mode = "playing";
    this.level = 1;
    this.xp = 0;
    this.xpRequired = 14;
    this.kills = 0;
    this.spawnAt = 1;
    this.eliteAt = 65;
    this.hunterChecked = false;
    this.bossSpawned = false;
    this.player = new Actor({ id: "player", team: "player", organs: true });
    if (this.previewActions) this.player.actionRanks.ARM_SAW_FLOW = 3;
    this.enemies = [];
    this.projectiles = [];
    this.orbs = [];
    this.effects = [];
    this.numbers = [];
    this.hazards = [];
    this.events = new CombatEvents();
    this.attackSerial = 0;
    this.hitstop = 0;
    this.notifications = [];
    this.rewardChoices = [];
    this.cause = "";
    this.saved = false;
    this.hunter = null;
    this.boss = null;
    this.noise = null;
    this.spawnCount = 0;
    this.installEvents();
    for (let i = 0; i < 7; i++) this.spawnEnemy("hungry");
    this.notify("살아 나오면 전부 당신 겁니다.", "HUNT 001 / MARKET OPEN");
  }
  walkable(x, y, r = 0) {
    return (
      x > 40 + r &&
      y > 40 + r &&
      x < CONFIG.width - 40 - r &&
      y < CONFIG.height - 40 - r &&
      !OBSTACLES.some(
        (o) =>
          x > o.x - r && x < o.x + o.w + r && y > o.y - r && y < o.y + o.h + r,
      )
    );
  }
  move(actor, dx, dy) {
    const n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 8));
    for (let i = 0; i < n; i++) {
      if (this.walkable(actor.x + dx / n, actor.y, actor.radius))
        actor.x += dx / n;
      if (this.walkable(actor.x, actor.y + dy / n, actor.radius))
        actor.y += dy / n;
    }
  }
  visible(a, b) {
    return lineOfSight(a, b, (x, y) => this.walkable(x, y));
  }
  targets(actor) {
    return actor.team === "player"
      ? this.enemies.filter((e) => !e.dead)
      : this.player.dead
        ? []
        : [this.player];
  }
  effect(type, x, y, extra = {}) {
    this.effects.push({ type, x, y, born: this.t, life: 0.35, ...extra });
  }
  notify(text, sub = "") {
    this.notifications.push({ text, sub, until: this.t + 3 });
  }
  spawnEnemy(type = "hungry", position = null) {
    if (this.enemies.filter((e) => !e.dead).length >= CONFIG.maxEnemies)
      return null;
    let p = position;
    if (!p)
      for (let i = 0; i < 30; i++) {
        const a = this.random() * Math.PI * 2,
          r = 470 + this.random() * 150;
        const candidate = {
          x: Math.min(
            CONFIG.width - 90,
            Math.max(90, this.player.x + Math.cos(a) * r),
          ),
          y: Math.min(
            CONFIG.height - 90,
            Math.max(90, this.player.y + Math.sin(a) * r),
          ),
        };
        if (
          this.walkable(candidate.x, candidate.y, 30) &&
          distance(candidate, this.player) > 260
        ) {
          p = candidate;
          break;
        }
      }
    if (!p)
      p = [
        { x: 160, y: 160 },
        { x: 2200, y: 1400 },
        { x: 160, y: 1400 },
        { x: 2200, y: 160 },
      ].find(
        (candidate) =>
          distance(candidate, this.player) > 260 &&
          this.walkable(candidate.x, candidate.y, 45),
      );
    if (!p) return null;
    const data = ENEMIES[type],
      scale = 1 + Math.min(0.8, this.t / 500);
    const enemy = new Actor({
      id: `enemy-${++this.spawnCount}`,
      type,
      x: p.x,
      y: p.y,
      hp: data.hp * scale,
      speed: data.speed,
      team: "enemy",
    });
    enemy.nextAttack = this.t + 1;
    enemy.aiState = "Chase";
    this.enemies.push(enemy);
    return enemy;
  }
  speed(actor) {
    return (
      actor.speed *
      (1 + actor.upgrades.speed) *
      (actor.statuses.slow ? STATUSES.slow.speed : 1) *
      (actor.statuses.stun ? 0 : 1) *
      (actor.attack ? actor.arm?.baseStats.moveScale || 1 : 1)
    );
  }
  haste(actor) {
    return (
      1 +
      (actor.boostUntil > this.t ? 0.25 : 0) +
      (actor.mutationBoostUntil > this.t ? 0.2 : 0)
    );
  }
  requestAttack(actor, special = false, buffer = true) {
    if (actor.dead || !actor.arm || actor.statuses.stun) return false;
    if (special && actor.specialAt > this.t) return false;
    if (actor.dashUntil > this.t || actor.attack) {
      const primedFinisher =
        special && actionRank(actor) >= 2 && actor.finisherUntil > this.t;
      if (actor.buffer?.special && !special && actor.buffer.until >= this.t)
        return false;
      if (
        buffer &&
        (primedFinisher ||
          actor.dashUntil > this.t ||
          actor.attack.endAt - this.t <
            (actor.arm.baseStats.bufferWindow || CONFIG.attackBuffer))
      )
        actor.buffer = {
          special,
          until: Math.max(
            this.t + (actor.arm.baseStats.bufferWindow || CONFIG.attackBuffer),
            primedFinisher ? (actor.attack?.endAt || this.t) + 0.05 : 0,
          ),
        };
      return false;
    }
    const arm = actor.arm,
      s = arm.baseStats,
      rule = {
        ...arm.targetingRule,
        distance: special
          ? Math.max(arm.targetingRule.distance, 155)
          : arm.targetingRule.distance,
      };
    const target = targetFor(
        actor,
        this.targets(actor).filter((e) => this.visible(actor, e)),
        rule,
      ),
      angle = target
        ? Math.atan2(target.y - actor.y, target.x - actor.x)
        : actor.lastNonZeroFacing;
    actor.face = angle;
    actor.faceLockUntil = this.t + arm.targetingRule.directionLock;
    const rank = actionRank(actor),
      flow = ACTION_UPGRADES.ARM_SAW_FLOW;
    const predicted =
      !special &&
      arm.id === "ARM_SAW" &&
      target &&
      actor.sawCombo.targetId === target.id &&
      this.t <= actor.sawCombo.until
        ? actor.sawCombo.hits + 1
        : 1;
    const dashCut =
      !special &&
      rank >= 1 &&
      this.t - actor.lastDashAt <= flow.dashWindow &&
      actor.dashLinkUsed !== actor.dashSerial;
    const finisher = special && rank >= 2 && actor.finisherUntil > this.t;
    const speed = this.haste(actor),
      windup = special
        ? s.windup + 0.12
        : arm.id === "ARM_SAW"
          ? s.comboWindups[(predicted - 1) % 3]
          : s.windup;
    const recovery =
      !special && arm.id === "ARM_SAW"
        ? s.comboRecoveries[(predicted - 1) % 3]
        : s.recovery;
    if (dashCut) actor.dashLinkUsed = actor.dashSerial;
    if (finisher) actor.finisherUntil = 0;
    actor.attack = {
      id: ++this.attackSerial,
      organID: arm.id,
      angle,
      special,
      targetId: target?.id || null,
      previewStrike: predicted,
      dashCut,
      finisher,
      rank,
      start: this.t,
      activeAt: this.t + windup / speed,
      endAt:
        this.t + (windup + s.active + recovery * (special ? 1.4 : 1)) / speed,
      executed: false,
    };
    actor.stats[special ? "specials" : "attacks"]++;
    if (special) actor.specialAt = this.t + arm.cooldown;
    if (actor.team === "hunter")
      actor.attack.activeAt = Math.max(actor.attack.activeAt, this.t + 0.42);
    actor.attack.endAt = Math.max(
      actor.attack.endAt,
      actor.attack.activeAt + 0.2,
    );
    this.noise =
      actor.team === "player"
        ? { x: actor.x, y: actor.y, until: this.t + 2 }
        : this.noise;
    return true;
  }
  dash(actor, input = {}) {
    if (
      actor.dead ||
      actor.dashes <= 0 ||
      actor.dashUntil > this.t ||
      actor.statuses.stun
    )
      return false;
    if (
      actor.attack &&
      this.t - actor.attack.start < actor.arm.baseStats.cancelFrom
    )
      return false;
    const dir = direction(input),
      chosen =
        dir.x || dir.y
          ? dir
          : {
              x: Math.cos(actor.lastNonZeroFacing),
              y: Math.sin(actor.lastNonZeroFacing),
            };
    actor.attack = null;
    actor.dashes--;
    actor.stats.dashes++;
    actor.lastDashAt = this.t;
    actor.dashSerial++;
    actor.dashDirection = { ...chosen };
    actor.dashUntil = this.t + CONFIG.dash.duration;
    actor.invulnerableUntil = this.t + CONFIG.dash.invulnerable;
    if (!actor.rechargeAt) actor.rechargeAt = this.t + CONFIG.dash.recharge;
    actor.evadedThisDash = false;
    this.events.emit("OnDash", { actor, sourceID: "dash" });
    this.effect("dash", actor.x, actor.y, {
      angle: Math.atan2(chosen.y, chosen.x),
      life: 0.22,
    });
    return true;
  }
  applyStatus(source, target, id, organID, context = null) {
    const data = STATUSES[id];
    if (!data || target.dead || data.immune.includes(target.type)) return false;
    const prev = target.statuses[id];
    target.statuses[id] = {
      id,
      until: this.t + data.duration,
      stacks: Math.min(data.maxStacks, (prev?.stacks || 0) + 1),
      nextTick: prev?.nextTick || this.t + (data.tick || 1),
      source,
      organID,
    };
    this.events.emit(
      "OnStatusApplied",
      { actor: source, target, status: id, organID, sourceID: organID },
      context,
    );
    return true;
  }
  damage(
    source,
    target,
    amount,
    {
      organID = null,
      direct = false,
      mutation = false,
      status = false,
      context = null,
      knockback = 0,
      stagger = 0,
      attackInstanceId = null,
    } = {},
  ) {
    if (!target || target.dead || source === target) return 0;
    const attackKey =
      attackInstanceId === null ? null : String(attackInstanceId);
    if (
      attackKey &&
      (target.receivedAttacks.has(attackKey) ||
        target.evadedAttacks.has(attackKey))
    )
      return 0;
    if (target.invulnerableUntil > this.t) {
      if (
        (attackKey || !target.evadedThisDash) &&
        target.dashUntil > this.t &&
        source.team !== target.team
      ) {
        if (attackKey) {
          target.evadedAttacks.set(attackKey, this.t);
          if (target.evadedAttacks.size > 128)
            target.evadedAttacks.delete(
              target.evadedAttacks.keys().next().value,
            );
        }
        target.evadedThisDash = true;
        target.stats.evades++;
        this.events.emit(
          "OnSuccessfulEvade",
          {
            actor: target,
            target: source,
            organID: target.organs.arm,
            sourceID: "evade",
            attackInstanceId: attackKey,
          },
          context,
        );
        this.notify(
          target.team === "player" ? "완벽한 회피" : "회피",
          "CLEAN CUT",
        );
      }
      return 0;
    }
    if ((target.hurtUntil || 0) > this.t) return 0;
    let multiplier = 1 + (source.upgrades?.damage || 0);
    if (
      !mutation &&
      organID &&
      source.has("MUT09", organID) &&
      target.hp / target.maxHP < 0.3
    )
      multiplier *= 1.4;
    if (!mutation && organID && source.has("MUT10", organID)) {
      source.focusCount =
        source.focusTarget === target.id
          ? Math.min(6, source.focusCount + 1)
          : 1;
      source.focusTarget = target.id;
      multiplier *= 1 + source.focusCount * 0.05;
    }
    if (
      !direct &&
      !mutation &&
      source.organs.eye === "EYE_HUNTER" &&
      target.markedBy === source.id &&
      target.markUntil > this.t
    )
      multiplier *= 1.3;
    const critical = direct && this.random() < (source.critChance || 0),
      actual = Math.min(target.hp, amount * multiplier * (critical ? 1.5 : 1));
    target.hp -= actual;
    if (attackKey && actual > 0) {
      target.receivedAttacks.set(attackKey, this.t);
      if (target.receivedAttacks.size > 256)
        target.receivedAttacks.delete(
          target.receivedAttacks.keys().next().value,
        );
    }
    if (target.team === "player") target.hurtUntil = this.t + 0.45;
    target.flashUntil = this.t + 0.08;
    target.staggerUntil = Math.max(target.staggerUntil, this.t + stagger);
    if (knockback) {
      const d = distance(source, target) || 1;
      this.move(
        target,
        ((target.x - source.x) / d) * knockback,
        ((target.y - source.y) / d) * knockback,
      );
    }
    if (source.stats)
      source.stats[mutation ? "mutation" : direct ? "direct" : "auto"] +=
        actual;
    this.numbers.push({
      x: target.x,
      y: target.y - 24,
      text: Math.ceil(actual),
      born: this.t,
      color:
        target.team === "player" ? "#ff7a72" : critical ? "#ffe4a4" : "#e9dac4",
    });
    if (direct) {
      this.hitstop = Math.max(this.hitstop, 0.018);
      this.events.emit(
        "OnDirectHit",
        {
          actor: source,
          target,
          organID,
          damage: actual,
          sourceID: organID,
          attackInstanceId: attackKey,
        },
        context,
      );
    }
    this.events.emit(
      "OnHit",
      {
        actor: source,
        target,
        organID,
        damage: actual,
        sourceID: organID,
        mutation,
        status,
        attackInstanceId: attackKey,
      },
      context,
    );
    if (target.hp <= 0 && !target.dead) {
      target.dead = true;
      target.attack = null;
      target.buffer = null;
      if (source.stats) source.stats.kills++;
      this.events.emit(
        "OnKill",
        {
          actor: source,
          target,
          organID,
          sourceID: organID,
          attackInstanceId: attackKey,
        },
        context,
      );
      this.onDeath(target, source);
    }
    return actual;
  }
  projectile(
    actor,
    organID,
    angle,
    {
      x = actor.x,
      y = actor.y,
      damage = 19,
      speed = 500,
      range = 520,
      direct = true,
      context = null,
      small = false,
      attackInstanceId = null,
    } = {},
  ) {
    if (this.projectiles.length >= CONFIG.maxProjectiles) return;
    this.projectiles.push({
      id: uid(),
      attackInstanceId: attackInstanceId ?? `projectile:${++this.attackSerial}`,
      actor,
      organID,
      x,
      y,
      angle,
      damage,
      speed,
      remaining: range,
      range,
      direct,
      context,
      small,
      hits: new Set(),
      pierce: actor.has("MUT02", organID) ? 2 : 0,
      returning: false,
      canReturn: actor.has("MUT11", organID),
      dead: false,
    });
  }
  executeAttack(actor, attack, scale = 1, context = null) {
    const organ = ORGANS[attack.organID];
    if (!organ || (scale === 1 && attack.resolved)) return;
    if (scale === 1) attack.resolved = true;
    const s = organ.baseStats,
      saw = organ.id === "ARM_SAW",
      native = saw && scale === 1,
      flow = ACTION_UPGRADES.ARM_SAW_FLOW;
    if (native && attack.dashCut) {
      actor.stats.dashCuts++;
      this.move(
        actor,
        Math.cos(attack.angle) * flow.lungeDistance,
        Math.sin(attack.angle) * flow.lungeDistance,
      );
      this.effect("dash", actor.x, actor.y, {
        angle: attack.angle,
        life: 0.25,
      });
    }
    if (native && attack.finisher) {
      actor.stats.finishers++;
      if (actor.team === "player") this.notify("회수 회전", "FINISHER / C");
    }
    if (native && attack.finisher)
      for (const e of this.targets(actor).filter(
        (e) => distance(actor, e) < 210 && this.visible(actor, e),
      )) {
        const d = distance(actor, e) || 1;
        const from = { x: e.x, y: e.y };
        this.move(
          e,
          ((actor.x - e.x) / d) *
            Math.min(flow.finisherPull, Math.max(0, d - 36)),
          ((actor.y - e.y) / d) *
            Math.min(flow.finisherPull, Math.max(0, d - 36)),
        );
        this.effect("tentacle", from.x, from.y, {
          end: { x: actor.x, y: actor.y },
          life: 0.2,
        });
      }
    const range =
        s.range *
        (attack.finisher
          ? 1.8
          : attack.special
            ? 1.55
            : attack.dashCut
              ? 1.15
              : 1),
      cone = attack.special ? Math.PI : s.cone;
    const hits = this.targets(actor)
      .filter(
        (e) =>
          distance(actor, e) <= range &&
          angleDelta(Math.atan2(e.y - actor.y, e.x - actor.x), attack.angle) <
            cone &&
          this.visible(actor, e),
      )
      .sort(
        (a, b) =>
          distance(actor, a) - distance(actor, b) ||
          String(a.id).localeCompare(String(b.id)),
      );
    const primary = hits.find((e) => e.id === attack.targetId) || hits[0];
    const strike =
      native && !attack.special && primary
        ? actor.sawCombo.targetId === primary.id &&
          this.t <= actor.sawCombo.until
          ? actor.sawCombo.hits + 1
          : 1
        : 1;
    if (native) attack.nativeStrike = strike;
    this.events.emit(
      "OnAttack",
      {
        actor,
        organID: organ.id,
        sourceID: organ.id,
        attack,
        attackInstanceId: attack.id,
      },
      context,
    );
    if (organ.tags.includes("projectile")) {
      for (const offset of attack.special ? [-0.4, -0.2, 0, 0.2, 0.4] : [0])
        this.projectile(actor, organ.id, attack.angle + offset, {
          damage: s.damage * (attack.special ? 1.2 : 1) * scale,
          direct: scale === 1,
          context,
          attackInstanceId: `${actor.id}:${attack.id}:shot:${offset}`,
        });
    } else {
      let confirmed = false;
      for (const enemy of hits) {
        const damage =
          s.damage *
          (attack.special ? 2.1 : 1) *
          (saw && strike === 3 ? s.thirdStrikeMultiplier : 1) *
          (attack.finisher ? flow.finisherDamage : 1) *
          scale;
        const actual = this.damage(actor, enemy, damage, {
          organID: organ.id,
          direct: scale === 1,
          mutation: scale !== 1,
          context,
          attackInstanceId:
            scale === 1
              ? `${actor.id}:${attack.id}`
              : `${actor.id}:${attack.id}:copy:${++this.attackSerial}`,
          knockback: attack.special
            ? 55
            : saw
              ? strike === 3
                ? 38
                : 10
              : s.knockback,
          stagger: attack.special ? 0.45 : strike === 3 ? 0.28 : s.stagger,
        });
        if (enemy === primary && actual > 0) confirmed = true;
        if (actual > 0 && !enemy.dead) {
          if (!saw || attack.special || strike === 3)
            this.applyStatus(actor, enemy, "bleed", organ.id, context);
          if (attack.special)
            this.applyStatus(actor, enemy, "stun", organ.id, context);
        }
      }
      if (native && !attack.special && confirmed && strike === 3)
        actor.stats.thirdStrikes++;
      if (native && !attack.special) {
        actor.sawCombo = confirmed
          ? {
              targetId: primary.id,
              hits: strike === 3 ? 0 : strike,
              until: this.t + s.comboWindow,
            }
          : { targetId: null, hits: 0, until: 0 };
        if (confirmed && strike === 3 && attack.rank >= 2) {
          actor.finisherUntil = this.t + flow.finisherWindow;
          if (actor.team === "player")
            this.notify(
              actor.specialAt <= this.t
                ? "C · 회수 회전 준비"
                : "강화 3타 적중 · C 충전 중",
              "THIRD HIT CONFIRMED",
            );
        }
      }
      if (native && attack.special && attack.rank >= 3)
        attack.endAt = Math.min(attack.endAt, this.t + flow.specialRecovery);
      this.effect("slash", actor.x, actor.y, {
        angle: attack.angle,
        range,
        life: attack.finisher ? 0.38 : 0.21,
        special: attack.special,
        clone: scale !== 1,
        strike,
        dashCut: attack.dashCut,
        finisher: attack.finisher,
      });
    }
  }
  autoTarget(actor, range) {
    return this.targets(actor)
      .filter((e) => distance(actor, e) < range && this.visible(actor, e))
      .sort((a, b) => {
        const rank = (e) =>
          (actor.organs.eye === "EYE_BLOOD" && e.statuses.bleed ? 4 : 0) +
          (e.markedBy === actor.id && e.markUntil > this.t ? 3 : 0) +
          (actor.lastDirectTarget === e.id ? 1 : 0);
        return rank(b) - rank(a) || distance(actor, a) - distance(actor, b);
      })[0];
  }
  autoAttack(actor) {
    const organ = ORGANS[actor.organs.back];
    if (!organ || actor.dead || actor.statuses.stun) return;
    if ((actor.timers.auto || 0) > this.t) return;
    const target = this.autoTarget(actor, organ.baseStats.range);
    if (!target) return;
    if (organ.id === "BACK_BLADES") {
      const a = this.t * 3.5;
      const blades = [
        { x: actor.x + Math.cos(a) * 80, y: actor.y + Math.sin(a) * 80 },
        { x: actor.x - Math.cos(a) * 80, y: actor.y - Math.sin(a) * 80 },
      ];
      const hits = this.targets(actor).filter((e) =>
        blades.some((b) => distance(b, e) < e.radius + 20),
      );
      if (!hits.length) return;
      for (const e of hits)
        this.damage(actor, e, organ.baseStats.damage, { organID: organ.id });
    } else if (organ.id === "BACK_TURRET")
      this.projectile(
        actor,
        organ.id,
        Math.atan2(target.y - actor.y, target.x - actor.x),
        {
          damage: organ.baseStats.damage,
          direct: false,
          range: organ.baseStats.range,
        },
      );
    else {
      const bonus = target.hp / target.maxHP < 0.3 ? 1.6 : 1;
      this.damage(actor, target, organ.baseStats.damage * bonus, {
        organID: organ.id,
      });
      this.effect("tentacle", actor.x, actor.y, {
        end: { x: target.x, y: target.y },
        life: 0.2,
      });
    }
    actor.timers.auto = this.t + organ.cooldown / this.haste(actor);
    this.events.emit("OnAttack", {
      actor,
      organID: organ.id,
      sourceID: organ.id,
      auto: true,
    });
    this.events.emit("OnOrganTriggered", {
      actor,
      organID: organ.id,
      target,
      sourceID: organ.id,
    });
  }
  installEvents() {
    this.events.on("OnSuccessfulEvade", ({ actor }) => {
      const flow = ACTION_UPGRADES.ARM_SAW_FLOW;
      if (actionRank(actor) >= 3 && (actor.timers.flowEvade || 0) <= this.t) {
        actor.specialAt = Math.max(
          this.t,
          actor.specialAt - flow.evadeCooldownRefund,
        );
        actor.timers.flowEvade = this.t + flow.evadeRefundICD;
      }
    });
    this.events.on("OnDirectHit", (e) => {
      e.actor.lastDirectTarget = e.target.id;
      if (e.actor.organs.eye === "EYE_HUNTER") {
        e.target.markUntil = this.t + 4;
        e.target.markedBy = e.actor.id;
      }
    });
    this.events.on("OnKill", (e) => {
      const a = e.actor;
      if (a.organs.heart === "HEART_HUNGER") a.boostUntil = this.t + 2;
      if (
        a.organs.heart === "HEART_BLAST" &&
        a.stats.kills % 5 === 0 &&
        (a.timers.heart || 0) <= this.t
      ) {
        a.timers.heart = this.t + 0.4;
        this.area(a, a, 160, 28, "HEART_BLAST", e.context);
      }
    });
    for (const event of [
      "OnAttack",
      "OnHit",
      "OnKill",
      "OnSuccessfulEvade",
      "OnStatusApplied",
      "OnProjectileHit",
    ])
      this.events.on(event, (e) => {
        const actor = e.actor;
        if (!actor?.mutations) return;
        for (const link of actor.mutations) {
          const m = MUTATIONS[link.id];
          if (
            m.triggerEvent !== event ||
            !Object.values(actor.organs).includes(link.organID) ||
            !compatible(link.organID, m.id)
          )
            continue;
          if (
            !["OnKill", "OnSuccessfulEvade"].includes(event) &&
            link.organID !== e.organID
          )
            continue;
          // Passive modifier mutations are evaluated directly by the damage/projectile pipeline.
          if (["MUT02", "MUT09", "MUT10", "MUT11"].includes(m.id)) continue;
          const token = `${actor.id}:${link.organID}:${m.id}`,
            timer = `mutation:${m.id}`;
          if (
            (e.context.used.get(token) || 0) >= m.maxTriggerCount ||
            (actor.timers[timer] || 0) > this.t
          )
            continue;
          e.context.used.set(token, (e.context.used.get(token) || 0) + 1);
          actor.timers[timer] = this.t + m.internalCooldown;
          this.mutateEffect(actor, link, e);
        }
      });
  }
  mutateEffect(actor, link, e) {
    const id = link.id,
      organID = link.organID,
      context = e.context,
      target = e.target;
    if (id === "MUT01" && target)
      for (const offset of [-0.6, 0.6])
        this.projectile(
          actor,
          organID,
          (e.projectile?.angle || actor.face) + offset,
          {
            x: target.x,
            y: target.y,
            damage: 6,
            range: 180,
            small: true,
            direct: false,
            context,
          },
        );
    if (id === "MUT03" && target)
      this.area(actor, target, 72, 9, organID, context);
    if (id === "MUT04" && target)
      for (const other of this.targets(actor)
        .filter((x) => x !== target && distance(x, target) < 140)
        .slice(0, 2))
        this.applyStatus(actor, other, e.status, organID, context);
    if (id === "MUT05")
      actor.hp = Math.min(actor.maxHP, actor.hp + e.damage * 0.06);
    if (id === "MUT06") {
      if (e.attack) this.executeAttack(actor, e.attack, 0.4, context);
      else {
        const other = this.autoTarget(actor, ORGANS[organID].baseStats.range);
        if (other)
          this.damage(actor, other, ORGANS[organID].baseStats.damage * 0.4, {
            organID,
            mutation: true,
            context,
          });
      }
    }
    if (id === "MUT07") actor.mutationBoostUntil = this.t + 2;
    if (id === "MUT08") {
      for (let i = 0; i < 8; i++)
        this.projectile(actor, organID, (i * Math.PI) / 4, {
          damage: 13,
          range: 220,
          direct: false,
          context,
        });
      this.effect("evade", actor.x, actor.y, { life: 0.4 });
    }
    if (id === "MUT12" && target) {
      const other = this.targets(actor).find(
        (x) => x !== target && distance(x, target) < 150,
      );
      if (other) {
        this.damage(actor, other, 8, { organID, mutation: true, context });
        this.applyStatus(actor, other, "shock", organID, context);
        this.applyStatus(actor, other, "slow", organID, context);
        this.effect("chain", target.x, target.y, {
          end: { x: other.x, y: other.y },
          life: 0.2,
        });
      }
    }
  }
  area(actor, center, range, damage, organID = null, context = null) {
    this.effect("blast", center.x, center.y, { range, life: 0.45 });
    for (const enemy of this.targets(actor))
      if (distance(center, enemy) < range && this.visible(center, enemy))
        this.damage(actor, enemy, damage, { organID, mutation: true, context });
  }
  updateActor(actor, dt) {
    if (actor.dead) return;
    if (
      actor.dashes < CONFIG.dash.charges &&
      actor.rechargeAt &&
      this.t >= actor.rechargeAt
    ) {
      actor.dashes++;
      actor.rechargeAt = actor.dashes < 2 ? this.t + CONFIG.dash.recharge : 0;
    }
    for (const [id, s] of Object.entries(actor.statuses)) {
      if (this.t >= s.until) {
        delete actor.statuses[id];
        continue;
      }
      const data = STATUSES[id];
      if (data.tick && this.t >= s.nextTick) {
        s.nextTick = this.t + data.tick;
        this.damage(s.source, actor, data.damage * s.stacks, {
          organID: s.organID,
          status: true,
          mutation: true,
        });
      }
    }
    if (actor.dead) return;
    if (actor.statuses.stun) {
      actor.attack = null;
      actor.buffer = null;
      return;
    }
    if (actor.dashUntil > this.t)
      this.move(
        actor,
        actor.dashDirection.x * CONFIG.dash.speed * dt,
        actor.dashDirection.y * CONFIG.dash.speed * dt,
      );
    if (actor.attack) {
      const a = actor.attack;
      if (!a.executed && this.t >= a.activeAt) {
        a.executed = true;
        this.executeAttack(actor, a);
      }
      if (this.t >= a.endAt) actor.attack = null;
    }
    if (!actor.attack && actor.dashUntil <= this.t && actor.buffer) {
      const b = actor.buffer;
      actor.buffer = null;
      if (b.until >= this.t) this.requestAttack(actor, b.special, false);
    }
    if (actor.organs.back) this.autoAttack(actor);
  }
  updateProjectiles(dt) {
    for (const p of this.projectiles) {
      if (p.dead) continue;
      if (p.returning) {
        const target = Math.atan2(p.actor.y - p.y, p.actor.x - p.x);
        p.angle = target;
        if (distance(p, p.actor) < 20) {
          p.dead = true;
          continue;
        }
      }
      const step = p.speed * dt,
        n = Math.max(1, Math.ceil(step / 9));
      for (let i = 0; i < n && !p.dead; i++) {
        p.x += (Math.cos(p.angle) * step) / n;
        p.y += (Math.sin(p.angle) * step) / n;
        p.remaining -= step / n;
        if (!this.walkable(p.x, p.y)) {
          p.dead = true;
          break;
        }
        for (const target of this.targets(p.actor))
          if (
            (!p.outboundSpent || p.returning) &&
            !p.hits.has(target.id) &&
            distance(p, target) < target.radius + (p.small ? 4 : 7)
          ) {
            p.hits.add(target.id);
            this.damage(p.actor, target, p.damage, {
              organID: p.organID,
              direct: p.direct,
              mutation: p.small,
              context: p.context,
              stagger: 0.08,
              knockback: 8,
              attackInstanceId: p.attackInstanceId,
            });
            if (p.poison)
              this.applyStatus(p.actor, target, "poison", p.organID, p.context);
            if (p.hook && !target.dead && target.invulnerableUntil <= this.t) {
              const d = distance(p.actor, target) || 1;
              this.move(
                target,
                ((p.actor.x - target.x) / d) * 110,
                ((p.actor.y - target.y) / d) * 110,
              );
              this.applyStatus(p.actor, target, "slow", p.organID);
            }
            this.events.emit(
              "OnProjectileHit",
              {
                actor: p.actor,
                target,
                organID: p.organID,
                projectile: p,
                sourceID: p.organID,
                attackInstanceId: p.attackInstanceId,
              },
              p.context,
            );
            if (p.pierce-- <= 0) {
              if (p.canReturn && !p.returning) {
                p.outboundSpent = true;
              } else p.dead = true;
            }
            break;
          }
        if (p.remaining <= 0 && !p.dead) {
          if (p.canReturn && !p.returning) {
            p.returning = true;
            p.attackInstanceId = String(p.attackInstanceId) + ":return";
            p.outboundSpent = false;
            p.hits.clear();
            p.remaining = p.range;
          } else p.dead = true;
        }
      }
    }
    this.projectiles = this.projectiles.filter((p) => !p.dead);
  }
  follow(actor, target, dt, multiplier = 1) {
    const d = distance(actor, target);
    if (d < 8) return;
    if (
      this.visible(actor, target) &&
      lineOfSight(actor, target, (x, y) => this.walkable(x, y, actor.radius))
    ) {
      this.move(
        actor,
        ((target.x - actor.x) / d) * this.speed(actor) * dt * multiplier,
        ((target.y - actor.y) / d) * this.speed(actor) * dt * multiplier,
      );
      return;
    }
    if (this.t >= (actor.pathAt || 0)) {
      actor.path = findPath(actor, target, (x, y) =>
        this.walkable(x, y, actor.radius),
      );
      actor.pathAt = this.t + 1;
    }
    while (actor.path?.length && distance(actor, actor.path[0]) < 18)
      actor.path.shift();
    const next = actor.path?.[0];
    if (next) {
      const len = distance(actor, next) || 1;
      this.move(
        actor,
        ((next.x - actor.x) / len) * this.speed(actor) * dt * multiplier,
        ((next.y - actor.y) / len) * this.speed(actor) * dt * multiplier,
      );
    }
  }
  enemyAI(enemy, dt) {
    if (enemy.dead || enemy.statuses.stun || this.t < enemy.staggerUntil)
      return;
    if (enemy.team === "hunter") {
      this.hunterAI(enemy, dt);
      return;
    }
    const p = this.player,
      d = distance(enemy, p),
      data = ENEMIES[enemy.type];
    if (enemy.telegraph) {
      const w = enemy.telegraph;
      if (this.t >= w.at) {
        enemy.telegraph = null;
        enemy.nextAttack =
          this.t +
          (enemy.type === "boss" ? 1.7 : enemy.type === "elite" ? 2.4 : 1.15);
        this.enemyStrike(enemy, w);
      }
      return;
    }
    if (this.t < enemy.nextAttack && ["elite", "boss"].includes(enemy.type))
      return;
    if (enemy.type === "spitter") {
      if (d < 180) {
        const a = Math.atan2(p.y - enemy.y, p.x - enemy.x);
        this.move(
          enemy,
          -Math.cos(a) * this.speed(enemy) * dt,
          -Math.sin(a) * this.speed(enemy) * dt,
        );
      } else if (d > 330 || !this.visible(enemy, p)) this.follow(enemy, p, dt);
      if (d < 480 && this.t >= enemy.nextAttack && this.visible(enemy, p))
        this.telegraph(enemy, "spit", 0.8, 420);
    } else if (enemy.type === "elite" || enemy.type === "boss") {
      if (d > 260) this.follow(enemy, p, dt);
      if (d < 500 && this.t >= enemy.nextAttack && this.visible(enemy, p)) {
        const pattern =
          enemy.type === "elite"
            ? "hook"
            : ["sweep", "hook", "charge", "hazard"][
                (enemy.patternIndex || 0) % 4
              ];
        enemy.patternIndex = (enemy.patternIndex || 0) + 1;
        this.telegraph(
          enemy,
          pattern,
          enemy.type === "boss" ? 1 : 0.85,
          pattern === "sweep" ? 210 : 450,
        );
      }
    } else {
      if (d > data.radius + 30) {
        let target = p;
        if (enemy.type === "crawler")
          target = {
            x: p.x + Math.cos(this.t + Number(enemy.id.split("-")[1])) * 65,
            y: p.y + Math.sin(this.t) * 65,
          };
        this.follow(enemy, target, dt);
      }
      if (
        d < (enemy.type === "exploder" ? 90 : 48) &&
        this.t >= enemy.nextAttack &&
        this.visible(enemy, p)
      )
        this.telegraph(
          enemy,
          enemy.type === "exploder" ? "explode" : "bite",
          enemy.type === "exploder" ? 0.9 : 0.6,
          enemy.type === "exploder" ? 105 : 65,
        );
    }
  }
  telegraph(actor, kind, duration, range) {
    actor.telegraph = {
      id: `hostile:${++this.attackSerial}`,
      kind,
      at: this.t + duration,
      born: this.t,
      angle: Math.atan2(this.player.y - actor.y, this.player.x - actor.x),
      x: this.player.x,
      y: this.player.y,
      range,
    };
  }
  enemyStrike(enemy, w) {
    if (w.kind === "spit" || w.kind === "hook") {
      this.projectile(enemy, null, w.angle, {
        damage: ENEMIES[enemy.type].damage,
        speed: w.kind === "hook" ? 360 : 280,
        range: w.range,
        direct: false,
        attackInstanceId: w.id,
      });
      const p = this.projectiles.at(-1);
      if (p) {
        p.poison = w.kind === "spit";
        p.hook = w.kind === "hook";
      }
    } else if (w.kind === "explode") {
      this.explode(enemy);
      enemy.dead = true;
      this.onDeath(enemy, enemy);
    } else if (w.kind === "hazard") {
      for (let i = 0; i < 4; i++)
        this.hazards.push({
          owner: enemy,
          attackInstanceId: `hazard:${++this.attackSerial}`,
          x: w.x + Math.cos((i * Math.PI) / 2) * 100,
          y: w.y + Math.sin((i * Math.PI) / 2) * 100,
          range: 78,
          at: this.t + 1.2,
          until: this.t + 1.7,
          done: false,
        });
    } else if (w.kind === "charge") {
      const start = { x: enemy.x, y: enemy.y };
      this.move(enemy, Math.cos(w.angle) * 380, Math.sin(w.angle) * 380);
      this.effect("charge", start.x, start.y, {
        end: { x: enemy.x, y: enemy.y },
        life: 0.5,
      });
      const dx = enemy.x - start.x,
        dy = enemy.y - start.y,
        u = Math.max(
          0,
          Math.min(
            1,
            ((this.player.x - start.x) * dx + (this.player.y - start.y) * dy) /
              (dx * dx + dy * dy || 1),
          ),
        );
      if (
        Math.hypot(
          this.player.x - start.x - u * dx,
          this.player.y - start.y - u * dy,
        ) < 60
      )
        this.damage(enemy, this.player, 28, { attackInstanceId: w.id });
    } else if (
      distance(enemy, this.player) < w.range &&
      this.visible(enemy, this.player) &&
      (w.kind === "bite" ||
        angleDelta(
          Math.atan2(this.player.y - enemy.y, this.player.x - enemy.x),
          w.angle,
        ) < 1.6)
    ) {
      this.damage(enemy, this.player, ENEMIES[enemy.type].damage, {
        attackInstanceId: w.id,
      });
      this.effect("slash", enemy.x, enemy.y, {
        range: w.range,
        angle: w.angle,
        life: 0.3,
        enemy: true,
      });
    }
  }
  explode(enemy) {
    if (enemy.exploded) return;
    enemy.exploded = true;
    this.effect("blast", enemy.x, enemy.y, {
      range: 105,
      life: 0.45,
      enemy: true,
    });
    if (distance(enemy, this.player) < 105)
      this.damage(enemy, this.player, 18, {
        attackInstanceId: `${enemy.id}:explode`,
      });
    for (const other of this.enemies)
      if (other !== enemy && !other.dead && distance(enemy, other) < 105)
        this.damage(enemy, other, 14, {
          attackInstanceId: `${enemy.id}:explode`,
        });
  }
  hunterAI(h, dt) {
    const d = distance(h, this.player),
      seen = d < 470 && this.visible(h, this.player);
    if (seen) {
      h.lastSeen = { x: this.player.x, y: this.player.y };
      h.lostAt = this.t;
    }
    if (h.hp < h.maxHP * 0.25 && !h.retreated) {
      h.retreated = true;
      h.state = "Retreat";
      h.retreatUntil = this.t + 4;
      h.attack = null;
    }
    if (h.state === "Retreat") {
      if (this.t < h.retreatUntil) {
        const point = {
          x: Math.max(120, Math.min(2250, h.x + (h.x - this.player.x))),
          y: Math.max(120, Math.min(1450, h.y + (h.y - this.player.y))),
        };
        this.follow(h, point, dt, 1.2);
        return;
      }
      h.state = "Search";
    }
    if (!seen) {
      h.attack = null;
      h.buffer = null;
      if (h.lastSeen && this.t - h.lostAt < 7) {
        h.state = "Search";
        this.follow(h, h.lastSeen, dt);
      } else if (
        this.noise &&
        this.noise.until > this.t &&
        distance(h, this.noise) < 650
      ) {
        h.state = "Investigate";
        this.follow(h, this.noise, dt);
      } else {
        h.state = "Patrol";
        if (!h.patrol || distance(h, h.patrol) < 30)
          h.patrol = {
            x: 150 + this.random() * 2100,
            y: 150 + this.random() * 1300,
          };
        this.follow(h, h.patrol, dt, 0.55);
      }
      return;
    }
    const desired = h.arm.tags.includes("projectile") ? 250 : 85;
    h.state = d < desired + 75 ? "Attack" : "Chase";
    h.face = Math.atan2(this.player.y - h.y, this.player.x - h.x);
    h.lastNonZeroFacing = h.face;
    h.lastMove = { x: Math.cos(h.face), y: Math.sin(h.face) };
    if (d > desired) this.follow(h, h.lastSeen, dt);
    if (h.arm.tags.includes("projectile") && d < 170)
      this.move(
        h,
        -Math.cos(h.face) * h.speed * dt,
        -Math.sin(h.face) * h.speed * dt,
      );
    if (h.state === "Attack" && this.t > h.nextDecision) {
      this.requestAttack(h, h.specialAt <= this.t);
      h.nextDecision = this.t + 0.95;
    }
    if (
      h.has("MUT08") &&
      this.player.attack &&
      !this.player.attack.executed &&
      d < 190 &&
      this.t > (h.nextDodge || 0)
    ) {
      this.dash(h, {
        left: h.x < this.player.x,
        right: h.x >= this.player.x,
        up: false,
        down: false,
      });
      h.nextDodge = this.t + 3;
    }
  }
  onDeath(target, source) {
    if (target === this.player) {
      this.mode = "dead";
      this.cause =
        source.team === "hunter"
          ? "이전의 사냥꾼"
          : ENEMIES[source.type]?.name || "시장 폐장";
      if (this.previewActions) return;
      try {
        saveDeath(this.storage, target, {
          runID: this.runID,
          time: this.t,
          cause: this.cause,
        });
        this.saved = true;
        this.records = loadDeaths(this.storage);
      } catch {
        this.saved = false;
      }
      return;
    }
    this.kills++;
    this.effect("death", target.x, target.y, { life: 0.4 });
    if (target.type === "exploder") this.explode(target);
    if (target === this.boss) {
      this.mode = "victory";
      this.notify("탈출 허가. 상품 회수 완료.", "MARKET CLOSED");
    }
    if (target === this.hunter) {
      const pool = [
        ...Object.values(target.organs)
          .filter((id) => id && this.player.organs[ORGANS[id].slot] !== id)
          .map((id) => ({ kind: "organ", id, synergy: true })),
        ...target.mutations
          .filter(
            (m) =>
              Object.values(this.player.organs).includes(m.organID) &&
              !this.player.has(m.id),
          )
          .map((m) => ({ kind: "mutation", ...m, synergy: true })),
      ];
      this.rewardChoices = pool.slice(0, 3);
      if (!this.rewardChoices.length)
        this.rewardChoices = [
          { kind: "upgrade", id: "health", synergy: false },
        ];
      if (this.mode === "playing") this.mode = "inherit";
      this.notify("상품 소유권 이전.", "HUNTER HARVESTED");
    }
    const xp = ENEMIES[target.type]?.xp || 40;
    this.orbs.push({ x: target.x, y: target.y, value: xp });
  }
  choose(index) {
    if (!["levelup", "inherit"].includes(this.mode)) return false;
    const reward = this.rewardChoices[index];
    if (!reward || !applyReward(this.player, reward)) return false;
    this.mode = "playing";
    this.notify(
      "상품 가치 상승.",
      reward.kind === "organ"
        ? ORGANS[reward.id].name
        : reward.kind === "mutation"
          ? MUTATIONS[reward.id].name
          : reward.kind === "action"
            ? ACTION_UPGRADES[reward.id].ranks[
                this.player.actionRanks[reward.id] - 1
              ].name
            : "신체 강화",
    );
    this.rewardChoices = [];
    this.checkLevel();
    return true;
  }
  checkLevel() {
    if (this.mode !== "playing" || this.xp < this.xpRequired) return;
    this.xp -= this.xpRequired;
    this.level++;
    this.xpRequired = Math.round(14 + this.level * 7);
    this.mode = "levelup";
    this.rewardChoices = rewardCandidates(this.player, this.random);
  }
  spawnHunter() {
    if (this.hunter || !this.records.length) return null;
    const r = this.records.at(-1);
    let position = { x: 200, y: 200 };
    for (let i = 0; i < 20; i++) {
      const a = this.random() * Math.PI * 2,
        p = {
          x: this.player.x + Math.cos(a) * 550,
          y: this.player.y + Math.sin(a) * 550,
        };
      if (this.walkable(p.x, p.y, 30)) {
        position = p;
        break;
      }
    }
    this.hunter = createHunter(r, position.x, position.y);
    this.enemies.push(this.hunter);
    this.notify("당신이 만든 상품이 돌아왔습니다.", "PAST BUILD DETECTED");
    return this.hunter;
  }
  tick(dt, input = {}) {
    if (this.mode !== "playing") return false;
    dt = Math.min(0.04, Math.max(0, dt));
    if (this.hitstop > 0) {
      this.hitstop -= dt;
      return false;
    }
    this.t += dt;
    const p = this.player,
      dir = direction(input);
    if (dir.x || dir.y) {
      p.lastMove = { ...dir };
      p.lastNonZeroFacing = Math.atan2(dir.y, dir.x);
      if (!p.attack || this.t >= p.attack.activeAt + p.arm.baseStats.active)
        p.face = Math.atan2(dir.y, dir.x);
      if (p.dashUntil <= this.t)
        this.move(p, dir.x * this.speed(p) * dt, dir.y * this.speed(p) * dt);
    }
    if (input.dashPressed) this.dash(p, input);
    if (input.specialPressed) this.requestAttack(p, true);
    if (input.attack) this.requestAttack(p, false);
    for (const actor of [p, ...this.enemies]) this.updateActor(actor, dt);
    for (const enemy of this.enemies) this.enemyAI(enemy, dt);
    this.updateProjectiles(dt);
    for (const hazard of this.hazards)
      if (!hazard.done && this.t >= hazard.at) {
        hazard.done = true;
        if (distance(hazard, p) < hazard.range)
          this.damage(hazard.owner, p, 25, {
            attackInstanceId: hazard.attackInstanceId,
          });
        this.effect("blast", hazard.x, hazard.y, {
          range: hazard.range,
          enemy: true,
        });
      }
    for (const orb of this.orbs) {
      const d = distance(orb, p);
      if (d < CONFIG.pickupRadius) {
        if (d < 22) {
          this.xp += orb.value;
          orb.dead = true;
        } else {
          orb.x += ((p.x - orb.x) / d) * 420 * dt;
          orb.y += ((p.y - orb.y) / d) * 420 * dt;
        }
      }
    }
    this.orbs = this.orbs.filter((o) => !o.dead);
    if (this.orbs.length > 300) {
      const excess = this.orbs.splice(0, this.orbs.length - 250);
      this.orbs.push({
        x: excess[0].x,
        y: excess[0].y,
        value: excess.reduce((n, o) => n + o.value, 0),
      });
    }
    if (this.t >= this.spawnAt && this.t < CONFIG.bossTime) {
      const count = 2 + Math.floor(this.t / 35);
      for (let i = 0; i < count; i++) {
        const types =
          this.t < 20
            ? ["hungry"]
            : this.t < 45
              ? ["hungry", "crawler"]
              : ["hungry", "hungry", "crawler", "spitter", "exploder"];
        this.spawnEnemy(types[Math.floor(this.random() * types.length)]);
      }
      this.spawnAt = this.t + Math.max(1.6, 4 - this.t / 120);
    }
    if (this.t >= this.eliteAt && this.t < CONFIG.bossTime) {
      this.spawnEnemy("elite");
      this.eliteAt += 70;
      this.notify("고기 집게 · 경매 개시", "ELITE ARRIVAL");
    }
    if (!this.hunterChecked && this.t >= (this.forceHunter ? 18 : 100)) {
      this.hunterChecked = true;
      if (this.forceHunter || this.random() < 0.35) this.spawnHunter();
    }
    if (!this.bossSpawned && this.t >= CONFIG.bossTime) {
      this.bossSpawned = true;
      this.boss = this.spawnEnemy("boss");
      if (!this.boss) {
        const ordinary = this.enemies.find(
          (e) => !e.dead && e.team === "enemy",
        );
        if (ordinary) ordinary.dead = true;
        this.boss = this.spawnEnemy("boss");
      }
      this.notify("도축장 주인이 입장했습니다.", "FINAL LOT / BOSS");
    }
    if (this.t >= CONFIG.runLimit && !p.dead) {
      this.damage(
        new Actor({ team: "enemy", type: "closure" }),
        p,
        p.maxHP + 1,
      );
    }
    this.enemies = this.enemies.filter((e) => !e.dead);
    this.effects = this.effects.filter((e) => this.t - e.born < e.life);
    this.numbers = this.numbers.filter((n) => this.t - n.born < 0.6);
    this.hazards = this.hazards.filter((h) => this.t < h.until);
    this.notifications = this.notifications.filter((n) => n.until > this.t);
    if (this.notifications.length > 3)
      this.notifications = this.notifications.slice(-3);
    this.checkLevel();
    return true;
  }
  snapshot() {
    return {
      mode: this.mode,
      previewActions: this.previewActions,
      time: this.t,
      level: this.level,
      xp: this.xp,
      xpRequired: this.xpRequired,
      kills: this.kills,
      player: {
        x: this.player.x,
        y: this.player.y,
        hp: this.player.hp,
        dashes: this.player.dashes,
        face: this.player.face,
        specialAt: this.player.specialAt,
        organs: { ...this.player.organs },
        mutations: this.player.mutations.map((m) => ({ ...m })),
        attack: this.player.attack ? { ...this.player.attack } : null,
        stats: { ...this.player.stats },
        actionRanks: { ...this.player.actionRanks },
        sawCombo: { ...this.player.sawCombo },
        finisherUntil: this.player.finisherUntil,
        lastNonZeroFacing: this.player.lastNonZeroFacing,
      },
      enemies: this.enemies.map((e) => ({
        id: e.id,
        type: e.type,
        x: e.x,
        y: e.y,
        hp: e.hp,
        telegraph: e.telegraph ? { ...e.telegraph } : null,
      })),
      orbs: this.orbs.map((o) => ({ x: o.x, y: o.y, value: o.value })),
      rewardChoices: this.rewardChoices.map((r) => ({ ...r })),
      records: this.records.length,
      hunter: this.hunter
        ? {
            state: this.hunter.state,
            hp: this.hunter.hp,
            organs: { ...this.hunter.organs },
            mutations: this.hunter.mutations.map((m) => ({ ...m })),
          }
        : null,
    };
  }
}
