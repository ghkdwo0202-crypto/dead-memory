import {
  SEALS,
  NINJUTSU,
  recipeFor,
  normalizeRecipe,
} from "./ninjutsu-data.js";
import { distance } from "./navigation.js";
const delta = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
const segDistance = (p, a, b) => {
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
export class NinjutsuSystem {
  constructor(game) {
    this.game = game;
    this.ring = [];
    this.invoked = [null, null];
    this.cooldowns = {};
    this.globalUntil = 0;
    this.commands = [];
    this.invokeIntent = null;
    this.castIntent = null;
    this.bolts = [];
    this.logs = [];
    this.serial = 0;
    this.overheat = 0;
    game.events.on("OnDirectHit", (e) => {
      if (
        e.actor === game.player &&
        String(e.attackInstanceId).startsWith("katana:") &&
        !e.target.dead
      ) {
        e.target.markedBy = e.actor.id;
        e.target.markUntil = game.t + 3;
      }
    });
  }
  queue(commands = []) {
    for (const c of commands) {
      if (c === "invoke" || SEALS[c]) {
        if (this.commands.length >= 32) this.commands.shift();
        this.commands.push(c);
      }
    }
  }
  feedback(text) {
    if (this.lastFeedback === text && this.lastFeedbackAt > this.game.t - 0.5)
      return;
    this.lastFeedback = text;
    this.lastFeedbackAt = this.game.t;
    this.game.notify(text, "A 화 · S 수 · D 뇌 · F 풍 / V 준비 · C 발동");
  }
  unlocked(element) {
    return (
      !this.game.sealTutorial ||
      ["fire", "water"].includes(element) ||
      this.game.t >= (element === "lightning" ? 60 : 90)
    );
  }
  input() {
    const commands = this.commands;
    this.commands = [];
    for (const c of commands) {
      if (c === "invoke") this.invoke();
      else {
        if (!this.unlocked(c)) {
          this.feedback(
            `${SEALS[c].name}인은 ${c === "lightning" ? 60 : 90}초 수련 뒤 열립니다.`,
          );
          continue;
        }
        this.ring.push(c);
        this.ring = this.ring.slice(-3);
        this.game.effect("seal", this.game.player.x, this.game.player.y, {
          element: c,
          glyph: SEALS[c].glyph,
          life: 0.28,
        });
      }
    }
  }
  preview() {
    return recipeFor(this.ring);
  }
  invoke() {
    const g = this.game,
      p = g.player;
    if (!this.ring.length) {
      if (this.invoked[1]) this.invoked.reverse();
      else this.feedback("교대할 두 번째 인술이 없습니다.");
      return true;
    }
    if (this.ring.length !== 3) {
      this.feedback("세 개의 인을 맺은 뒤 V를 누르세요.");
      return false;
    }
    const spell = this.preview();
    if (!spell?.implemented) {
      this.feedback(
        spell
          ? `${spell.name} · 혼합 인술은 다음 업데이트 예정`
          : "올바른 인 세 개가 필요합니다.",
      );
      return false;
    }
    if (p.attack || p.dashUntil > g.t || p.staggerUntil > g.t) {
      this.invokeIntent = {
        recipe: normalizeRecipe(this.ring),
        expiresAt: g.t + 0.2,
      };
      return false;
    }
    this.prepare(spell);
    return true;
  }
  prepare(spell) {
    this.invoked = [
      spell.id,
      ...this.invoked.filter((id) => id && id !== spell.id),
    ].slice(0, 2);
    while (this.invoked.length < 2) this.invoked.push(null);
    this.ring = [];
    this.invokeIntent = null;
    this.game.effect("invoke", this.game.player.x, this.game.player.y, {
      element: spell.element,
      life: 0.16,
    });
    this.feedback(`${spell.name} 준비 · C 발동`);
  }
  cancelBuffered() {
    this.invokeIntent = null;
    this.castIntent = null;
  }
  target(spell) {
    const p = this.game.player;
    return this.game
      .targets(p)
      .filter(
        (e) =>
          distance(p, e) <= spell.range &&
          delta(Math.atan2(e.y - p.y, e.x - p.x), p.lastNonZeroFacing) <=
            spell.cone / 2 &&
          this.game.visible(p, e),
      )
      .sort(
        (a, b) =>
          Number(b.markUntil > this.game.t && b.markedBy === p.id) -
            Number(a.markUntil > this.game.t && a.markedBy === p.id) ||
          distance(p, a) - distance(p, b) ||
          String(a.id).localeCompare(String(b.id)),
      )[0];
  }
  requestCast({ retry = false, id = this.invoked[0] } = {}) {
    const g = this.game,
      p = g.player;
    if (p.dead) return false;
    if (this.invokeIntent) {
      if (!retry)
        this.castIntent = { id: null, awaitInvoke: true, expiresAt: g.t + 0.2 };
      return false;
    }
    const d = NINJUTSU[id];
    if (!d?.implemented || !this.invoked.includes(id)) return false;
    if ((this.cooldowns[id] || 0) > g.t || this.globalUntil > g.t) {
      if (!retry) this.feedback("인술이 아직 재사용 대기 중입니다.");
      return false;
    }
    const air = p.airHeight > 0,
      allowed = d.casting.allowedStates.includes(air ? "air" : "ground");
    const cancelAt = p.attack
      ? p.attack.activeAt +
        p.attack.activeDuration +
        (!p.attack.air && p.attack.strike === 3 ? 0.06 : 0)
      : 0;
    const busy =
      p.dashUntil > g.t ||
      p.staggerUntil > g.t ||
      (p.attack && (p.attack.ninjutsuId || (!air && g.t < cancelAt)));
    if (!allowed || busy) {
      if (!retry) this.castIntent = { id, expiresAt: g.t + 0.2 };
      return false;
    }
    const needed = d.operations.reduce(
      (n, op) =>
        n +
        (["GroundWave", "ProjectileFan"].includes(op.op) ? op.count || 1 : 0),
      0,
    );
    if (needed + this.bolts.length + g.projectiles.length > 350) {
      this.feedback("전장 투사체 한도에 도달했습니다.");
      return false;
    }
    const target = d.element === "lightning" ? this.target(d) : null;
    if (d.element === "lightning" && !target) {
      this.feedback("전방 시야 안에 낙뢰 표적이 없습니다.");
      return false;
    }
    const angle = target
      ? Math.atan2(target.y - p.y, target.x - p.x)
      : p.lastNonZeroFacing;
    p.attack = {
      id: ++g.attackSerial,
      ninjutsuId: id,
      start: g.t,
      activeAt: g.t + d.casting.windup,
      endAt: g.t + d.casting.windup + d.casting.active + d.casting.recovery,
      activeDuration: d.casting.active,
      angle,
      special: true,
      air,
      targetId: target?.id,
      executed: false,
    };
    p.buffer = null;
    p.face = angle;
    p.faceLockUntil = g.t + 0.1;
    p.stats.specials++;
    this.cooldowns[id] = g.t + d.cooldown;
    this.globalUntil = g.t + 0.2;
    this.castIntent = null;
    g.effect("cast", p.x, p.y, {
      element: d.element,
      range: d.element === "fire" ? 115 : 45,
      angle,
      life: d.casting.windup,
    });
    if (target)
      g.effect("thunder-mark", target.x, target.y, { life: d.casting.windup });
    return true;
  }
  hit(target, damage, id, chain) {
    const air = target.airHeight > 0;
    if (air && (target.juggleCount || 0) >= 6) return 0;
    const hit = this.game.damage(
      this.game.player,
      target,
      damage * (1 + this.game.player.momentum * 0.05),
      { direct: true, attackInstanceId: id, context: chain, stagger: 0.18 },
    );
    if (hit && air) {
      target.juggleCount = (target.juggleCount || 0) + 1;
      if (target.juggleCount >= 6) {
        target.airHeight = 0;
        target.airVelocity = 0;
        target.juggleUntil = 0;
      }
    }
    return hit;
  }
  status(e, type, chain) {
    if (e.dead) return;
    const g = this.game;
    e.ninjutsuStatuses ??= {};
    const old = e.ninjutsuStatuses[type];
    const duration = { burn: 3, wet: 4, shock: 3, windMark: 2 }[type];
    e.ninjutsuStatuses[type] = {
      type,
      stacks: Math.min(
        type === "burn" ? 3 : type === "shock" ? 2 : 1,
        (old?.stacks || 0) + 1,
      ),
      expiresAt: g.t + duration,
      nextTick: old?.nextTick || g.t + 0.5,
      sourceId: g.player.id,
      chain,
      nonce: ++this.serial,
    };
    if (type === "shock" && e.ninjutsuStatuses.shock.stacks === 2) {
      if (e.type === "boss")
        e.staggerMeter = Math.min(100, (e.staggerMeter || 0) + 8);
      else e.staggerUntil = Math.max(e.staggerUntil, g.t + 0.3);
    }
  }
  push(e, origin, amount) {
    if (e.type === "boss") return;
    const d = distance(e, origin) || 1;
    this.game.move(
      e,
      ((e.x - origin.x) / d) * amount,
      ((e.y - origin.y) / d) * amount,
    );
  }
  execute(attack) {
    if (attack.resolved) return;
    attack.resolved = true;
    const g = this.game,
      p = g.player,
      d = NINJUTSU[attack.ninjutsuId];
    if (!d?.implemented) return;
    const chain = {
      rootID: `ninjutsu:${p.id}:${attack.id}`,
      depth: 0,
      used: new Map(),
      budget: { count: 0 },
    };
    for (const op of d.operations) {
      this.logs.push({ time: g.t, id: d.id, op: op.op, attackId: attack.id });
      if (this.logs.length > 120) this.logs.shift();
      if (op.op === "Detonate") {
        const origin = {
          x: p.x + Math.cos(attack.angle) * op.offset,
          y: p.y + Math.sin(attack.angle) * op.offset,
        };
        for (const e of g.targets(p))
          if (
            distance(origin, e) <= op.radius &&
            g.visible(p, e) &&
            g.visible(origin, e)
          ) {
            if (this.hit(e, op.damage, `spell:${attack.id}`, chain)) {
              this.status(e, op.status, chain);
              this.push(e, origin, op.push);
            }
          }
        this.overheat = Math.min(3, this.overheat + 1);
        g.effect("fire-burst", origin.x, origin.y, {
          range: op.radius,
          element: d.element,
          life: 0.4,
        });
      } else if (op.op === "LightningStrike") {
        const e = g.targets(p).find((t) => t.id === attack.targetId);
        if (e && g.visible(p, e) && distance(p, e) <= d.range) {
          if (this.hit(e, op.damage, `spell:${attack.id}`, chain)) {
            this.status(e, op.status, chain);
            if (e.airHeight > 0)
              e.staggerUntil = Math.max(e.staggerUntil, g.t + 0.3);
          }
          g.effect("lightning-strike", e.x, e.y, {
            start: { x: p.x, y: p.y },
            element: d.element,
            life: 0.28,
          });
        }
      } else if (op.op === "GroundWave" || op.op === "ProjectileFan") {
        const count = op.count || 1;
        if (this.bolts.length + g.projectiles.length + count > 350) {
          this.feedback("전장 투사체 한도에 도달했습니다.");
          continue;
        }
        const hits = new Set();
        for (let i = 0; i < count; i++) {
          const angle =
            attack.angle +
            (count === 1 ? 0 : (i / (count - 1) - 0.5) * op.spread);
          this.bolts.push({
            id: `spell:${attack.id}`,
            element: d.element,
            x: p.x,
            y: p.y,
            origin: { x: p.x, y: p.y },
            angle,
            remaining: op.length,
            op,
            hits,
            chain,
          });
        }
      } else throw new Error("Unsupported ninjutsu operation " + op.op);
    }
    g.addStyle(d.element, 10);
  }
  tick(dt) {
    const g = this.game,
      p = g.player;
    if (p.dead) {
      this.bolts = [];
      this.cancelBuffered();
      return;
    }
    if (this.invokeIntent) {
      const intent = this.invokeIntent;
      if (g.t > intent.expiresAt) {
        this.invokeIntent = null;
        this.feedback("결인 준비 시간이 지났습니다. V로 다시 준비하세요.");
        if (this.castIntent?.awaitInvoke) this.castIntent = null;
      } else if (normalizeRecipe(this.ring) !== intent.recipe) {
        this.invokeIntent = null;
        this.feedback("인이 바뀌어 준비를 취소했습니다.");
        if (this.castIntent?.awaitInvoke) this.castIntent = null;
      } else if (!p.attack && p.dashUntil <= g.t && p.staggerUntil <= g.t)
        this.prepare(this.preview());
    }
    if (this.castIntent) {
      const intent = this.castIntent;
      if (g.t > intent.expiresAt) {
        this.castIntent = null;
        this.feedback("지금은 시전할 수 없습니다. C로 다시 시도하세요.");
      } else if (!this.invokeIntent)
        this.requestCast({
          retry: true,
          id: intent.awaitInvoke ? this.invoked[0] : intent.id,
        });
    }
    for (const b of this.bolts) {
      let remain = Math.min(b.op.speed * dt, b.remaining);
      while (remain > 0 && b.remaining > 0) {
        const step = Math.min(6, remain),
          from = { x: b.x, y: b.y };
        b.x += Math.cos(b.angle) * step;
        b.y += Math.sin(b.angle) * step;
        b.remaining -= step;
        remain -= step;
        if (!g.walkable(b.x, b.y, 2)) {
          b.remaining = 0;
          break;
        }
        for (const e of g.targets(p))
          if (
            !b.hits.has(e.id) &&
            segDistance(e, from, b) < b.op.width / 2 + e.radius &&
            g.visible(b.origin, e) &&
            g.visible(b, e)
          ) {
            b.hits.add(e.id);
            if (this.hit(e, b.op.damage, b.id, b.chain)) {
              this.status(e, b.op.status, b.chain);
              if (b.op.push) this.push(e, b.origin, b.op.push);
              if (b.op.launch && !e.dead) {
                if (e.type === "boss")
                  e.staggerMeter = Math.min(
                    100,
                    (e.staggerMeter || 0) + b.op.bossStagger,
                  );
                else g.launch(e);
              }
            }
          }
      }
    }
    this.bolts = this.bolts.filter((b) => b.remaining > 0 && !p.dead);
    for (const e of g.enemies)
      for (const [type, s] of Object.entries(e.ninjutsuStatuses || {})) {
        if (e.dead || g.t >= s.expiresAt) {
          delete e.ninjutsuStatuses[type];
          continue;
        }
        if (type === "burn" && g.t >= s.nextTick) {
          s.nextTick += 0.5;
          g.damage(p, e, 3 * s.stacks, {
            mutation: true,
            suppressProcs: true,
            attackInstanceId: `burn:${e.id}:${s.nonce}:${s.nextTick}`,
            context: s.chain,
          });
        }
      }
  }
  reservedProjectiles() {
    const a = this.game.player.attack;
    if (!a?.ninjutsuId || a.executed) return 0;
    return NINJUTSU[a.ninjutsuId].operations.reduce(
      (n, op) =>
        n +
        (["GroundWave", "ProjectileFan"].includes(op.op) ? op.count || 1 : 0),
      0,
    );
  }
  snapshot() {
    return {
      tutorial: this.game.sealTutorial,
      unlocked: Object.keys(SEALS).filter((e) => this.unlocked(e)),
      ring: [...this.ring],
      preview: this.preview()?.id || null,
      invoked: [...this.invoked],
      cooldowns: { ...this.cooldowns },
      globalUntil: this.globalUntil,
      invokePending: Boolean(this.invokeIntent),
      castPending: Boolean(this.castIntent),
      overheat: this.overheat,
      bolts: this.bolts.map((b) => ({ x: b.x, y: b.y, element: b.element })),
      logs: this.logs.slice(-12),
    };
  }
}
