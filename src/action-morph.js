import { MORPH_LIMITS } from "./data.js";
import { ACTION_PATHS, activeMorphTier, emptyMorph } from "./action-paths.js";
import { distance, findPath } from "./navigation.js";
const angleDelta = (a, b) =>
  Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
const segmentDistance = (p, a, b) => {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    u = Math.max(
      0,
      Math.min(
        1,
        ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1),
      ),
    );
  return Math.hypot(p.x - a.x - u * dx, p.y - a.y - u * dy);
};
export class ActionMorph {
  constructor(game) {
    this.game = game;
    this.entities = [];
    this.delayed = [];
    this.logs = [];
    this.serial = 0;
    game.events.on("OnSuccessfulEvade", (e) => this.onEvade(e));
    game.events.on("OnDirectHit", (e) => this.onDirectHit(e));
  }
  attach(actor) {
    actor.morphController = this;
    if (!actor.actionMorph) actor.actionMorph = emptyMorph();
    this.sync(actor);
  }
  root(actor, id) {
    return {
      rootID: `morph:${actor.id}:${id}`,
      depth: 0,
      used: new Map(),
      budget: { count: 0 },
    };
  }
  log(actor, op, id, chain, extra = {}) {
    this.logs.push({
      time: this.game.t,
      pathId: actor.actionMorph.pathId,
      tier: activeMorphTier(actor),
      sourceId: actor.id,
      op,
      attackInstanceId: id,
      chainId: chain?.rootID,
      depth: chain?.depth || 0,
      ...extra,
    });
    if (this.logs.length > MORPH_LIMITS.logs) this.logs.shift();
  }
  status(actor) {
    const p = ACTION_PATHS[actor.actionMorph?.pathId],
      tier = activeMorphTier(actor);
    return {
      path: p || null,
      tier,
      dormant: Boolean(p && !tier),
      reason: p && !tier ? "해당 티어의 장비 조건이 맞지 않습니다." : "",
    };
  }
  sync(actor) {
    const state = actor.actionMorph || emptyMorph(),
      signature = `${state.pathId}|${state.tier}|${activeMorphTier(actor)}|${Object.values(actor.organs).join(",")}`;
    if (actor.morphSignature !== signature) {
      this.cleanup(actor);
      actor.morphSignature = signature;
      state.counters = {};
      state.comboWindowEnd = 0;
      actor.morphDash = null;
      actor.morphTargetId = null;
    }
    actor.actionMorph = state;
    this.mirror(actor);
  }
  cleanup(actor) {
    this.entities = this.entities.filter((e) => e.owner !== actor);
    this.delayed = this.delayed.filter((e) => e.actor !== actor);
    if (actor.attack?.kind === "charge") actor.attack = null;
    if (actor.buffer?.chargeIntent) actor.buffer = null;
    for (const key of Object.keys(actor.timers))
      if (key.startsWith("morph:")) delete actor.timers[key];
    if (actor.actionMorph) actor.actionMorph.temporaryEntities = [];
  }
  mirror(actor) {
    actor.actionMorph.temporaryEntities = this.entities
      .filter((e) => e.owner === actor)
      .map((e) => ({
        entityId: e.id,
        kind: e.kind,
        expiresAt: e.expiresAt,
        sourceId: e.sourceId,
      }));
  }
  allowed(actor) {
    return !actor.dead && activeMorphTier(actor) > 0;
  }
  operations(actor, key) {
    const s = actor.actionMorph,
      tier = activeMorphTier(actor),
      p = ACTION_PATHS[s?.pathId];
    if (!tier || !p) return [];
    if (key === "x") return tier >= 2 ? p.tier2.x : [];
    return tier === 3
      ? p.tier3[key] || []
      : key === "z"
        ? p.tier1.z || []
        : tier >= 2
          ? p.tier2.c || []
          : [];
  }
  movementScale(actor) {
    if (actor.attack?.kind === "charge") return 0.35;
    if ((actor.timers["morph:root"] || 0) > this.game.t) return 0;
    const { path, tier } = this.status(actor);
    return tier &&
      this.operations(actor, "z").some((o) => o.op === "ArcSlash") &&
      actor.attack &&
      (actor.attack.special || actor.attack.previewStrike === 3)
      ? 0.75
      : 1;
  }
  autoSpeed(actor) {
    return activeMorphTier(actor) > 0 &&
      (actor.timers["morph:orbitBoost"] || 0) > this.game.t
      ? actor.timers["morph:orbitHaste"] || 1.8
      : 1;
  }
  clip(origin, angle, length) {
    const p = { x: origin.x, y: origin.y };
    for (let left = length; left > 0; left -= 8) {
      const step = Math.min(8, left),
        x = p.x + Math.cos(angle) * step,
        y = p.y + Math.sin(angle) * step;
      if (!this.game.walkable(x, y, 2)) break;
      p.x = x;
      p.y = y;
    }
    return p;
  }
  defer(actor, op, at, origin, angle, attackId, chain, extra = {}) {
    if (
      this.delayed.filter((j) => j.actor === actor).length >=
      MORPH_LIMITS.delayed
    )
      return;
    this.delayed.push({
      id: ++this.serial,
      actor,
      pathId: actor.actionMorph.pathId,
      op,
      at,
      expiresAt: at + 0.2,
      origin: { x: origin.x, y: origin.y },
      angle,
      attackId,
      chain,
      extra,
    });
  }
  mark(actor, target) {
    if (!target) return;
    for (const e of this.game.targets(actor))
      if (e.markedBy === actor.id) e.markUntil = 0;
    target.markedBy = actor.id;
    target.markUntil = this.game.t + 4;
    actor.morphTargetId = target.id;
  }
  target(actor, range = 700) {
    const p = this.game
      .targets(actor)
      .filter(
        (e) =>
          distance(actor, e) < range &&
          this.game.visible(actor, e) &&
          angleDelta(Math.atan2(e.y - actor.y, e.x - actor.x), actor.face) <=
            actor.arm.targetingRule.assistAngle,
      );
    return (
      p.find((e) => e.markedBy === actor.id && e.markUntil > this.game.t) ||
      p.sort(
        (a, b) =>
          distance(actor, a) - distance(actor, b) ||
          String(a.id).localeCompare(String(b.id)),
      )[0]
    );
  }
  hit(
    actor,
    target,
    damage,
    id,
    chain,
    {
      direct = false,
      copied = false,
      cap = Infinity,
      organID = actor.organs.arm,
    } = {},
  ) {
    return this.game.damage(actor, target, damage, {
      organID,
      direct,
      mutation: copied || (!direct && organID === actor.organs.arm),
      context: chain,
      attackInstanceId: id,
      suppressProcs: copied,
      damageCap: cap,
      stagger: 0.12,
    });
  }
  primitive(actor, op, origin, angle, id, chain, extra = {}) {
    const g = this.game,
      targets = g.targets(actor),
      base = actor.arm.baseStats.damage;
    this.log(actor, op.op, id, chain, { expiresAt: extra.expiresAt });
    if (op.op === "Pull") {
      for (const e of targets.filter(
        (e) => distance(origin, e) < op.radius && g.visible(origin, e),
      )) {
        if (e.type === "boss") {
          e.staggerMeter = Math.min(100, (e.staggerMeter || 0) + 5);
          continue;
        }
        const d = distance(origin, e) || 1,
          n = Math.min(
            op.distance * (e.type === "elite" ? 0.5 : 1),
            Math.max(0, d - 38),
          );
        g.move(e, ((origin.x - e.x) / d) * n, ((origin.y - e.y) / d) * n);
      }
      return [];
    }
    if (op.op === "Orbit") {
      actor.timers["morph:orbitBoost"] = g.t + op.duration;
      actor.timers["morph:orbitHaste"] = op.haste || 1.8;
      return [];
    }
    if (op.op === "ArcSlash" || op.op === "CleaveAround") {
      const radius = op.radius || actor.arm.baseStats.range,
        cone = op.coneRad || Math.PI * 2,
        hits = [];
      for (const e of targets)
        if (
          distance(origin, e) <= radius &&
          angleDelta(Math.atan2(e.y - origin.y, e.x - origin.x), angle) <=
            cone / 2 &&
          g.visible(origin, e)
        ) {
          const used = extra.damageBudget?.get(e.id) || 0,
            cap =
              extra.absoluteCap === undefined
                ? extra.cap
                : Math.max(0, extra.absoluteCap - used);
          if (cap !== undefined && cap <= 0) continue;
          const actual = this.hit(
            actor,
            e,
            base * (op.damageScale || 1),
            `${id}:${e.id}`,
            chain,
            { direct: extra.direct, copied: extra.copied, cap },
          );
          if (extra.damageBudget) extra.damageBudget.set(e.id, used + actual);
          if (actual > 0) {
            hits.push(e);
            if (extra.bleed && !e.dead)
              g.applyStatus(actor, e, "bleed", actor.organs.arm, chain);
          }
        }
      g.effect("morph-arc", origin.x, origin.y, {
        angle,
        range: radius,
        cone,
        life: 0.24,
        echo: extra.copied,
        dual: op.dual,
      });
      return hits;
    }
    if (op.op === "PiercingRay") {
      const end = this.clip(origin, angle, op.length),
        hits = [];
      for (const e of targets)
        if (
          segmentDistance(e, origin, end) < op.width / 2 + e.radius &&
          g.visible(origin, e)
        ) {
          const budget = extra.damageBudget,
            used = budget?.get(e.id) || 0,
            cap =
              extra.absoluteCap === undefined
                ? Infinity
                : Math.max(0, extra.absoluteCap - used);
          const actual = this.hit(
            actor,
            e,
            base * (op.damageScale || 1),
            `${id}:${e.id}`,
            chain,
            { direct: extra.direct, copied: extra.copied, cap },
          );
          if (budget) budget.set(e.id, used + actual);
          if (actual > 0) {
            hits.push(e);
            if (op.mark) this.mark(actor, e);
            if (op.bossStagger && e.type === "boss") {
              e.staggerMeter = (e.staggerMeter || 0) + op.bossStagger;
              if (e.staggerMeter >= 100) {
                e.staggerMeter = 0;
                e.staggerUntil = g.t + 0.65;
                g.effect("morph-stagger", e.x, e.y, { range: 75, life: 0.5 });
              }
            }
          }
        }
      g.effect("morph-ray", origin.x, origin.y, {
        end,
        range: op.length,
        width: op.width,
        rail: op.rail,
        life: 0.25,
      });
      return hits;
    }
    if (op.op === "GroundLine") {
      const d = distance(origin, extra.end),
        a = Math.atan2(extra.end.y - origin.y, extra.end.x - origin.x),
        end = this.clip(origin, a, d),
        hits = [];
      for (const e of targets)
        if (
          segmentDistance(e, origin, end) < op.width / 2 + e.radius &&
          g.visible(origin, e)
        ) {
          if (
            this.hit(
              actor,
              e,
              base * 2.1 * op.damageScale,
              `${id}:${e.id}`,
              chain,
              { copied: true },
            ) > 0
          )
            hits.push(e);
        }
      g.effect("morph-line", origin.x, origin.y, {
        end,
        width: op.width,
        life: 0.35,
      });
      return hits;
    }
    throw new Error(`No executable primitive: ${op.op}`);
  }
  recordCombo(actor, attack, hits) {
    if (attack.special || actor.organs.arm !== "ARM_SAW") return;
    const primary = hits.find((e) => e.id === attack.targetId) || hits[0],
      strike = attack.nativeStrike || attack.previewStrike || 1;
    if (primary) {
      actor.sawCombo = {
        targetId: primary.id,
        hits: strike >= 3 ? 0 : strike,
        until: this.game.t + actor.arm.baseStats.comboWindow,
      };
      if (strike >= 3) actor.stats.thirdStrikes++;
    } else actor.sawCombo = { targetId: null, hits: 0, until: 0 };
  }
  execute(actor, attack, context) {
    const { path, tier } = this.status(actor);
    if (!tier) return false;
    const g = this.game,
      chain = context || this.root(actor, attack.id),
      key = attack.special ? "c" : "z",
      ops = this.operations(actor, key),
      id = `${actor.id}:morph:${attack.id}`;
    if (this.operations(actor, "z").some((o) => o.op === "ArcSlash")) {
      if (!attack.special) {
        const op = ops[0];
        if (
          op.when === "third" &&
          (attack.nativeStrike || attack.previewStrike) !== 3
        )
          return false;
        g.events.emit(
          "OnAttack",
          {
            actor,
            organID: actor.organs.arm,
            sourceID: actor.organs.arm,
            attack,
            attackInstanceId: attack.id,
          },
          chain,
        );
        if ((attack.nativeStrike || attack.previewStrike) === 3) {
          g.move(
            actor,
            Math.cos(attack.angle) * (op.lunge ?? path.tier1.z[0].lunge ?? 0),
            Math.sin(attack.angle) * (op.lunge ?? path.tier1.z[0].lunge ?? 0),
          );
          actor.timers["morph:root"] = g.t + (op.root || 0);
        }
        const hits = this.primitive(
          actor,
          {
            ...op,
            radius: actor.arm.baseStats.range + 25,
            damageScale: attack.previewStrike === 3 ? 1.3 : 1,
          },
          actor,
          attack.angle,
          id,
          chain,
          { direct: true, bleed: attack.previewStrike === 3 },
        );
        this.recordCombo(actor, attack, hits);
        return true;
      }
      if (ops.some((o) => o.op === "CleaveAround")) {
        g.events.emit(
          "OnAttack",
          { actor, organID: actor.organs.arm, attack },
          chain,
        );
        this.primitive(actor, ops[0], actor, attack.angle, id + ":pull", chain);
        const spin = ops[1],
          budget = new Map();
        for (let i = 0; i < spin.ticks; i++)
          this.defer(
            actor,
            { ...spin, damageScale: spin.damageScale * 2.1 },
            g.t + i * spin.interval,
            actor,
            attack.angle,
            `${id}:spin:${i}`,
            chain,
            {
              direct: true,
              followActor: true,
              damageBudget: budget,
              absoluteCap: actor.arm.baseStats.damage * spin.capScale,
            },
          );
        actor.attack.endAt = Math.max(actor.attack.endAt, g.t + 0.72);
        return true;
      }
    }
    if (this.operations(actor, "z").some((o) => o.op === "ChargedRelease")) {
      if (!attack.special) {
        const spec = ops[0];
        if ((attack.chargeAmount || 0) < spec.threshold) return false;
        const rail = tier === 3 && attack.chargeAmount >= spec.railThreshold;
        g.events.emit(
          "OnAttack",
          { actor, organID: actor.organs.arm, attack },
          chain,
        );
        const hits = this.primitive(
          actor,
          {
            op: "PiercingRay",
            length: rail ? spec.length : path.tier1.z[0].length,
            width: rail ? spec.width : path.tier1.z[0].width,
            damageScale: rail ? 3.2 : 2,
            rail,
            bossStagger: rail ? spec.bossStagger : 0,
            mark: true,
          },
          actor,
          attack.angle,
          id,
          chain,
          { direct: true },
        );
        return true;
      }
      if (tier >= 2) {
        const target = this.target(actor, tier === 3 ? 850 : 650);
        if (!target) return false;
        this.mark(actor, target);
        const angle = Math.atan2(target.y - actor.y, target.x - actor.x),
          op = ops[0];
        g.events.emit(
          "OnAttack",
          { actor, organID: actor.organs.arm, attack },
          chain,
        );
        const budget = new Map(),
          count = 1 + (op.followups || 0);
        for (let i = 0; i < count; i++)
          this.defer(
            actor,
            {
              ...op,
              op: "PiercingRay",
              damageScale: i === 0 ? op.damageScale : 1.2,
            },
            g.t + i * (op.interval || 0.3),
            actor,
            angle,
            `${id}:shot:${i}`,
            chain,
            {
              direct: true,
              damageBudget: budget,
              absoluteCap: actor.arm.baseStats.damage * (op.capScale || 3),
            },
          );
        return true;
      }
    }
    if (
      this.operations(actor, "z").some((o) => o.op === "DelayedEcho") &&
      attack.special &&
      tier >= 2
    ) {
      const echoes = this.entities.filter(
        (e) => e.owner === actor && e.kind === "echo",
      );
      if (!echoes.length) return false;
      g.events.emit(
        "OnAttack",
        { actor, organID: actor.organs.arm, attack },
        chain,
      );
      for (const echo of echoes) {
        if (tier === 3)
          this.primitive(
            actor,
            ops[0],
            echo,
            attack.angle,
            `${id}:${echo.id}`,
            chain,
            { end: { x: actor.x, y: actor.y } },
          );
        else
          this.primitive(
            actor,
            {
              op: "ArcSlash",
              radius: actor.arm.baseStats.range,
              coneRad: Math.PI * 2,
              damageScale: 2.1 * 0.45,
            },
            echo,
            attack.angle,
            `${id}:${echo.id}`,
            chain,
            { copied: true },
          );
      }
      if (tier === 3) {
        this.entities = this.entities.filter((e) => !echoes.includes(e));
        this.mirror(actor);
      }
      return true;
    }
    return false;
  }
  afterAttack(actor, attack) {
    const { path, tier } = this.status(actor);
    if (!tier) return;
    const g = this.game,
      chain = this.root(actor, attack.id),
      id = `after:${actor.id}:${attack.id}`;
    if (
      this.operations(actor, "z").some((o) => o.op === "ArcSlash") &&
      tier >= 2 &&
      attack.special
    )
      this.defer(
        actor,
        path.tier2.c.find((o) => o.op === "Orbit"),
        attack.endAt,
        actor,
        0,
        id,
        chain,
      );
    if (
      this.operations(actor, "z").some((o) => o.op === "DelayedEcho") &&
      !attack.special &&
      actor.morphDash &&
      g.t - actor.lastDashAt <= 0.7 &&
      actor.actionMorph.counters.echoDash !== actor.dashSerial
    ) {
      actor.actionMorph.counters.echoDash = actor.dashSerial;
      const dash = actor.morphDash;
      this.echo(
        actor,
        {
          x: (dash.start.x + dash.end.x) / 2,
          y: (dash.start.y + dash.end.y) / 2,
        },
        attack.angle,
        0.12,
        chain,
        id,
      );
      if (tier === 3)
        for (let i = 0; i < 2; i++)
          this.echo(
            actor,
            dash.end,
            attack.angle,
            0.8,
            chain,
            id + ":end:" + i,
          );
    }
    if (
      this.operations(actor, "z").some((o) => o.op === "SummonOrder") &&
      !attack.special &&
      actor.morphTargetId
    ) {
      const locked = g.targets(actor).find((e) => e.id === actor.morphTargetId);
      if (locked) this.mark(actor, locked);
    }
    if (
      this.operations(actor, "z").some((o) => o.op === "SummonOrder") &&
      attack.special &&
      tier >= 2
    ) {
      const target = this.target(actor, 500);
      if (target) {
        this.mark(actor, target);
        const op = this.operations(actor, "c")[0];
        this.orderBrood(actor, target, op.mode, tier === 3 ? 3 : 0, chain, id);
      }
    }
  }
  echo(actor, point, angle, delay, chain, id, fire = true) {
    const owned = this.entities.filter(
      (e) => e.owner === actor && e.kind === "echo",
    );
    if (owned.length >= MORPH_LIMITS.echoes)
      this.entities = this.entities.filter((e) => e !== owned[0]);
    const end = this.clip(
      actor,
      Math.atan2(point.y - actor.y, point.x - actor.x),
      distance(actor, point),
    );
    const e = {
      id: `echo:${++this.serial}`,
      kind: "echo",
      owner: actor,
      pathId: actor.actionMorph.pathId,
      sourceId: actor.organs.arm,
      x: end.x,
      y: end.y,
      angle,
      readyAt: this.game.t + delay,
      expiresAt: this.game.t + 3,
      chain,
      attackId: id,
      fired: !fire,
    };
    this.entities.push(e);
    this.mirror(actor);
    return e;
  }
  onDash(actor, wasAttacking = false) {
    actor.morphDash = {
      start: { x: actor.x, y: actor.y },
      end: { x: actor.x, y: actor.y },
      wasAttacking,
    };
    const { path, tier } = this.status(actor),
      g = this.game;
    if (
      this.operations(actor, "x").some((o) => o.op === "ResourceBank") &&
      tier >= 2 &&
      actor.morphCancelledCharge
    ) {
      actor.actionMorph.counters.bankedCharge =
        actor.morphCancelledCharge * 0.5;
      actor.actionMorph.comboWindowEnd = g.t + 0.6;
    }
    actor.morphCancelledCharge = 0;
    if (
      this.operations(actor, "x").some(
        (o) => o.op === "DelayedEcho" && o.mode === "dash-arc",
      ) &&
      actor.morphDash.wasAttacking &&
      tier >= 2
    )
      this.defer(
        actor,
        { op: "ArcSlash", radius: 135, coneRad: Math.PI, damageScale: 0.6 },
        actor.dashUntil + 0.02,
        actor,
        Math.atan2(actor.dashDirection.y, actor.dashDirection.x),
        `dash:${actor.id}:${actor.dashSerial}`,
        this.root(actor, "dash:" + actor.dashSerial),
        { followActor: true },
      );
    for (const e of this.entities.filter(
      (e) => e.owner === actor && e.kind === "brood",
    )) {
      if (
        this.operations(actor, "x").some(
          (o) => o.op === "SummonOrder" && o.mode === "hold-vulnerable",
        ) &&
        tier >= 2
      ) {
        e.holdUntil = g.t + 0.8;
        e.evadeUntil = 0;
      } else {
        e.recallUntil = actor.dashUntil;
        e.evadeUntil = actor.invulnerableUntil;
      }
    }
  }
  onEvade({ actor, context, attackInstanceId }) {
    const { path, tier } = this.status(actor);
    if (
      this.operations(actor, "x").some(
        (o) => o.op === "DelayedEcho" && o.mode === "successful-evade",
      ) &&
      tier >= 2
    )
      this.echo(
        actor,
        actor.morphDash?.start || actor,
        actor.face,
        0.1,
        context || this.root(actor, attackInstanceId),
        `evade:${attackInstanceId}`,
        false,
      );
  }
  onDirectHit(e) {
    const a = e.actor,
      { path, tier } = this.status(a);
    if (
      !this.operations(a, "z").some((o) => o.op === "SummonOrder") ||
      !tier ||
      e.organID !== a.organs.arm ||
      !a.attack ||
      a.attack.special
    )
      return;
    if (a.actionMorph.counters.broodAttack === a.attack.id) return;
    a.actionMorph.counters.broodAttack = a.attack.id;
    a.actionMorph.counters.broodHits =
      (a.actionMorph.counters.broodHits || 0) + 1;
    this.mark(a, e.target);
    const flank = tier === 3 && a.actionMorph.counters.broodHits % 3 === 0;
    this.orderBrood(
      a,
      e.target,
      flank ? "flank" : "dash",
      flank ? 2 : 1,
      e.context,
      `brood-z:${a.attack.id}`,
    );
  }
  cancelCharge(actor) {
    if (actor.attack?.kind !== "charge") return;
    actor.morphCancelledCharge = actor.attack.chargeAmount || 0;
    actor.attack = null;
    actor.buffer = null;
  }
  handleInput(actor, input, dt) {
    if (
      !this.operations(actor, "z").some((o) => o.op === "ChargedRelease") ||
      activeMorphTier(actor) < 1
    )
      return false;
    const g = this.game;
    if (actor.attack?.kind === "charge") actor.face = actor.lastNonZeroFacing;
    if (actor.dashUntil > g.t) return true;
    if (input.attack) {
      if (!actor.attack) {
        const bank =
          actor.actionMorph.comboWindowEnd >= g.t
            ? actor.actionMorph.counters.bankedCharge || 0
            : 0;
        actor.actionMorph.counters.bankedCharge = 0;
        actor.attack = {
          id: ++g.attackSerial,
          organID: actor.organs.arm,
          kind: "charge",
          angle: actor.face,
          special: false,
          start: g.t,
          activeAt: Infinity,
          endAt: Infinity,
          executed: false,
          chargeAmount: bank,
        };
      }
      if (
        actor.attack.kind === "charge" &&
        !input.up &&
        !input.down &&
        !input.left &&
        !input.right
      )
        actor.attack.chargeAmount = Math.min(
          0.9,
          actor.attack.chargeAmount + dt,
        );
    } else if (actor.attack?.kind === "charge") {
      const a = actor.attack,
        target = this.target(actor, 850);
      a.angle = target
        ? Math.atan2(target.y - actor.y, target.x - actor.x)
        : actor.lastNonZeroFacing;
      actor.face = a.angle;
      a.kind = "charged-release";
      a.activeAt = g.t + 0.08;
      a.endAt = g.t + (a.chargeAmount >= 0.9 ? 0.52 : 0.32);
      actor.stats.attacks++;
    }
    return true;
  }
  nativeBrood(actor) {
    const g = this.game;
    if (actor.organs.back !== "BACK_BROOD") return false;
    if ((actor.timers.auto || 0) > g.t) return true;
    const count = this.entities.filter(
      (e) => e.owner === actor && e.kind === "brood",
    ).length;
    if (count < 3) {
      const angle = (count * Math.PI * 2) / 3,
        p = this.clip(actor, angle, 32);
      this.entities.push({
        id: `brood:${++this.serial}`,
        kind: "brood",
        owner: actor,
        sourceId: "BACK_BROOD",
        pathId: null,
        x: p.x,
        y: p.y,
        radius: 9,
        hp: 18,
        maxHP: 18,
        speed: 150,
        statuses: {},
        upgrades: { speed: 0 },
        attack: null,
        nextAttack: g.t + 0.4,
        expiresAt: g.t + 18,
        targetId: null,
      });
      this.mirror(actor);
    }
    actor.timers.auto = g.t + 5;
    return true;
  }
  orderBrood(actor, target, mode, count, chain, id) {
    this.log(actor, "SummonOrder", id, chain, { mode, targetId: target.id });
    let brood = this.entities.filter(
      (e) => e.owner === actor && e.kind === "brood",
    );
    if (count > 0) brood = brood.slice(0, count);
    for (let i = 0; i < brood.length; i++) {
      const e = brood[i];
      e.targetId = target.id;
      if (mode === "focus") continue;
      e.command = {
        targetId: target.id,
        mode,
        angle: i % 2 ? 1 : -1,
        until: this.game.t + 0.8,
        chain,
        id: `${id}:${e.id}`,
        hit: false,
      };
    }
  }
  moveBrood(e, target, dt, speed) {
    const d = distance(e, target);
    if (d < 3) return;
    if (this.game.visible(e, target)) {
      this.game.move(
        e,
        ((target.x - e.x) / d) * speed * dt,
        ((target.y - e.y) / d) * speed * dt,
      );
      return;
    }
    if (this.game.t >= (e.pathAt || 0)) {
      e.path = findPath(e, target, (x, y) =>
        this.game.walkable(x, y, e.radius),
      );
      e.pathAt = this.game.t + 0.7;
    }
    while (e.path?.length && distance(e, e.path[0]) < 15) e.path.shift();
    const next = e.path?.[0];
    if (next) {
      const n = distance(e, next) || 1;
      this.game.move(
        e,
        ((next.x - e.x) / n) * speed * dt,
        ((next.y - e.y) / n) * speed * dt,
      );
    }
  }
  tickBrood(e, dt) {
    const g = this.game,
      a = e.owner;
    if (e.recallUntil > g.t) {
      this.moveBrood(e, a, dt, 650);
      return;
    }
    let target =
      g.targets(a).find((t) => t.id === e.targetId && t.markUntil > g.t) ||
      g.autoTarget(a, 500);
    if (e.command) {
      target = g.targets(a).find((t) => t.id === e.command.targetId);
      if (!target || g.t > e.command.until) e.command = null;
      else {
        const goal =
          e.command.mode === "flank"
            ? { x: target.x + e.command.angle * 30, y: target.y + 20 }
            : target;
        this.moveBrood(e, goal, dt, 420);
        if (
          !e.command.hit &&
          distance(e, target) < target.radius + 35 &&
          g.visible(e, target)
        ) {
          const factor =
            e.command.mode === "converge-execute"
              ? target.type === "boss"
                ? 1.3
                : target.hp / target.maxHP <= 0.2
                  ? 2
                  : 1.5
              : 1;
          this.hit(a, target, 7 * factor, e.command.id, e.command.chain, {
            organID: "BACK_BROOD",
            cap: 21,
          });
          e.command.hit = true;
          g.effect("morph-brood-hit", target.x, target.y, {
            life: 0.2,
            range: 25,
          });
        }
        return;
      }
    }
    if (target) {
      if (distance(e, target) > target.radius + 18)
        this.moveBrood(e, target, dt, 150);
      else if (g.t >= e.nextAttack && g.visible(e, target)) {
        this.hit(
          a,
          target,
          7,
          `brood:${e.id}:${++this.serial}`,
          this.root(a, e.id),
          { organID: "BACK_BROOD" },
        );
        e.nextAttack = g.t + 0.9 / g.haste(a);
      }
    } else if (!(e.holdUntil > g.t) && distance(e, a) > 65)
      this.moveBrood(e, a, dt, 140);
  }
  hostileStrike(enemy, w) {
    for (const e of this.entities.filter(
      (e) => e.kind === "brood" && e.owner.team === "player",
    )) {
      if ((e.evadeUntil || 0) > this.game.t) continue;
      if (
        ["bite", "sweep", "explode"].includes(w.kind) &&
        distance(enemy, e) < w.range &&
        this.game.visible(enemy, e) &&
        (w.kind === "explode" ||
          angleDelta(Math.atan2(e.y - enemy.y, e.x - enemy.x), w.angle) < 1.7)
      )
        e.hp -= enemy.type === "boss" ? 28 : 9;
    }
  }
  hitBroodProjectile(p) {
    if (p.actor.team === "player") return;
    for (const e of this.entities.filter(
      (e) => e.kind === "brood" && e.owner.team === "player",
    ))
      if (distance(p, e) < 14 && (e.evadeUntil || 0) <= this.game.t) {
        e.hp -= p.damage;
        p.dead = true;
        return;
      }
  }
  tick(dt) {
    const g = this.game;
    let processed = 0;
    for (const job of [...this.delayed].sort(
      (a, b) => a.at - b.at || a.id - b.id,
    )) {
      if (job.at > g.t || processed >= MORPH_LIMITS.eventsPerTick) continue;
      this.delayed = this.delayed.filter((j) => j !== job);
      processed++;
      if (
        job.actor.dead ||
        job.pathId !== job.actor.actionMorph.pathId ||
        !activeMorphTier(job.actor)
      )
        continue;
      this.primitive(
        job.actor,
        job.op,
        job.extra.followActor ? job.actor : job.origin,
        job.angle,
        job.attackId,
        job.chain,
        job.extra,
      );
    }
    for (const e of this.entities) {
      if (e.owner.dead || e.expiresAt <= g.t || e.hp <= 0) continue;
      if (e.kind === "echo" && !e.fired && e.readyAt <= g.t) {
        e.fired = true;
        this.primitive(
          e.owner,
          {
            op: "ArcSlash",
            radius: e.owner.arm.baseStats.range,
            coneRad: 2.3,
            damageScale: 0.45,
          },
          e,
          e.angle,
          e.id,
          e.chain,
          { copied: true },
        );
      } else if (e.kind === "brood") this.tickBrood(e, dt);
    }
    this.entities = this.entities.filter(
      (e) =>
        !e.owner.dead &&
        e.expiresAt > g.t &&
        (e.hp === undefined || e.hp > 0) &&
        ((e.kind === "brood" && e.owner.organs.back === "BACK_BROOD") ||
          (e.kind === "echo" &&
            activeMorphTier(e.owner) > 0 &&
            e.pathId === e.owner.actionMorph.pathId)),
    );
    for (const a of [g.player, ...g.enemies].filter((a) => a.organs.arm)) {
      if (a.morphDash && a.dashUntil >= g.t)
        a.morphDash.end = { x: a.x, y: a.y };
      this.mirror(a);
    }
  }
}
