import { SealSequence, ELEMENTS } from "./seals.js";
import { SIDE_SKILLS, RECIPE_IDS } from "./side-skills.js";
import { clearLine, surfaceBelow, moveBody } from "./physics2d.js";
export class SideMagic {
  constructor(g) {
    this.g = g;
    this.sequence = new SealSequence((id) => this.request(id), RECIPE_IDS);
    this.cooldowns = {};
    this.globalUntil = 0;
    this.queued = null;
    this.cast = null;
    this.bolts = [];
    this.logs = [];
    this.feedback = "";
    this.events = [];
    g.events.on("OnHit", (e) => {
      if (e.source === g.player && String(e.attackId).startsWith("sword:")) {
        e.target.markUntil = g.t + 3;
      }
    });
  }
  enqueue(elements) {
    for (const e of elements)
      if (ELEMENTS[e]) {
        if (this.events.length >= 32) this.events.shift();
        this.events.push(e);
      }
  }
  input() {
    const events = this.events;
    this.events = [];
    for (const e of events) {
      this.sequence.input(e, this.g.t);
      this.g.effect("seal", this.g.player.x, this.g.player.y - 30, {
        element: e,
        life: 0.25,
      });
    }
  }
  fail(text) {
    this.feedback = text;
    if (this.lastFeedback === text && this.g.t - this.feedbackAt < 0.4) return;
    this.lastFeedback = text;
    this.feedbackAt = this.g.t;
    this.g.notify(text, "첫 인: 기본기 / 둘째: 조합 / 셋째: 자동 인술");
  }
  request(id, retry = false) {
    const g = this.g,
      p = g.player,
      d = SIDE_SKILLS[id];
    if (!d?.implemented) {
      this.fail(`${d?.name || "해당 인술"} · 후속 단계 예정`);
      return false;
    }
    if ((this.cooldowns[id] || 0) > g.t + 1e-8) {
      this.fail(`${d.name} 재사용 대기 중`);
      return false;
    }
    if (p.dead) return false;
    const state = p.dashUntil > g.t ? "dash" : p.grounded ? "ground" : "air";
    const cancelAt = p.attack ? p.attack.activeAt + p.attack.duration : 0;
    const busy =
      p.staggerUntil > g.t ||
      !d.allowedStates.includes(state) ||
      this.cast ||
      g.t + 1e-8 < this.globalUntil ||
      (d.kind === "mixed" && p.attack && g.t < cancelAt);
    if (this.queued && !retry) {
      this.fail("먼저 대기한 인술을 시전합니다.");
      return false;
    }
    if (busy) {
      if (!retry)
        this.queued = { skillId: id, kind: d.kind, expiresAt: g.t + 0.18 };
      return false;
    }
    if (d.operations.some((o) => o.op === "Lightning") && !this.target(420)) {
      this.fail("전방에 낙뢰 표적이 없습니다.");
      if (retry) this.queued = null;
      return false;
    }
    const count = d.operations.reduce(
      (n, o) => n + (["Shot", "Wave", "Fan"].includes(o.op) ? o.count || 1 : 0),
      0,
    );
    if (this.bolts.length + g.projectiles.length + count > 200) {
      this.fail("전장 투사체 한도");
      if (retry) this.queued = null;
      return false;
    }
    this.cooldowns[id] = g.t + d.cooldown;
    this.globalUntil = g.t + (d.kind === "single" ? 0.12 : 0.18);
    this.queued = null;
    this.feedback = `${d.name} 시전`;
    const angle = this.aim();
    const a = {
      id: `cast:${++g.serial}`,
      skillId: id,
      readyAt: g.t + d.casting.windup,
      endAt: g.t + d.casting.windup + d.casting.active + d.casting.recovery,
      angle,
      facing: p.facing,
      executed: false,
    };
    if (d.kind === "single") {
      this.execute(a);
    } else {
      p.attack = null;
      p.attackBuffer = null;
      this.cast = a;
      g.effect("cast", p.x, p.y, {
        element: d.operations[0].element,
        life: d.casting.windup,
      });
    }
    return true;
  }
  aim() {
    const p = this.g.player,
      input = this.g.input || {};
    if (input.up)
      return p.facing === 1 ? -Math.PI * 0.305 : Math.PI + Math.PI * 0.305;
    if (input.down && !p.grounded)
      return p.facing === 1 ? Math.PI * 0.305 : Math.PI - Math.PI * 0.305;
    return p.facing === 1 ? 0 : Math.PI;
  }
  target(range) {
    const p = this.g.player;
    return this.g.enemies
      .filter(
        (e) =>
          !e.dead &&
          (e.x - p.x) * p.facing >= 0 &&
          Math.abs(e.x - p.x) <= range &&
          Math.abs(e.y - p.y) <= 260 &&
          clearLine(p, e, this.g.platforms),
      )
      .sort(
        (a, b) =>
          Number(b.markUntil > this.g.t) - Number(a.markUntil > this.g.t) ||
          Math.abs(a.x - p.x) +
            Math.abs(a.y - p.y) -
            Math.abs(b.x - p.x) -
            Math.abs(b.y - p.y),
      )[0];
  }
  status(e, type) {
    e.elements ??= {};
    const old = e.elements[type],
      duration = { burn: 3, wet: 4, shock: 2.5, wind: 2 }[type];
    e.elements[type] = {
      stacks: Math.min(type === "burn" ? 3 : 1, (old?.stacks || 0) + 1),
      until: this.g.t + duration,
      next: old?.next || this.g.t + 0.5,
    };
  }
  hit(e, op, id, origin) {
    if (e.dead || !clearLine(origin, e, this.g.platforms)) return 0;
    if (!e.grounded && e.airJuggleHits >= 5) return 0;
    const g = this.g,
      wasAir = !e.grounded;
    const hit = g.damage(g.player, e, op.damage, id, { stagger: 0.15 });
    if (!hit) return 0;
    if (wasAir) {
      e.airJuggleHits++;
      if (e.airJuggleHits >= 5) {
        e.launchImmuneUntil = g.t + 1.5;
        e.vy = Math.max(e.vy, 200);
      }
    }
    if (op.status) this.status(e, op.status);
    if (op.push && !["boss", "elite"].includes(e.type))
      moveBody(e, (e.x >= origin.x ? 1 : -1) * op.push, 0, g.platforms, g.t);
    if (op.launch) {
      if (!g.player.grounded && !["boss", "elite"].includes(e.type)) {
        e.vy = 500;
      } else g.launch(e, op.launch);
    }
    return hit;
  }
  rayTargets(origin, angle, length, width) {
    const end = {
      x: origin.x + Math.cos(angle) * length,
      y: origin.y + Math.sin(angle) * length,
    };
    return this.g.enemies
      .filter((e) => {
        if (e.dead || !clearLine(origin, e, this.g.platforms)) return false;
        const n = Math.ceil(length / 6);
        for (let i = 0; i <= n; i++) {
          const x = origin.x + ((end.x - origin.x) * i) / n,
            y = origin.y + ((end.y - origin.y) * i) / n;
          if (
            Math.abs(x - e.x) < e.halfWidth + width &&
            Math.abs(y - e.y) < e.halfHeight + width
          )
            return true;
        }
        return false;
      })
      .sort((a, b) => Math.abs(a.x - origin.x) - Math.abs(b.x - origin.x));
  }
  execute(a) {
    if (a.executed) return;
    a.executed = true;
    const g = this.g,
      p = g.player,
      d = SIDE_SKILLS[a.skillId],
      origin = { x: p.x, y: p.y };
    this.logs.push({ id: d.id, time: g.t, attackId: a.id });
    this.logs = this.logs.slice(-120);
    for (const base of d.operations) {
      const op = { ...base };
      if (["Shot", "Fan", "Wave"].includes(op.op)) {
        let surface = null;
        if (op.op === "Wave" && p.grounded)
          surface =
            g.platforms.find((s) => s.id === p.groundPlatformId) ||
            surfaceBelow(p.x, p.y, g.platforms, 60);
        const count = op.count || 1,
          hits = new Set();
        for (let i = 0; i < count; i++) {
          let angle = a.angle;
          if (op.op === "Fan") {
            const tilt = p.grounded ? -0.25 - i * 0.25 : 0.4 + i * 0.3;
            angle = p.facing === 1 ? tilt : Math.PI - tilt;
          }
          this.bolts.push({
            id: a.id,
            skillId: d.id,
            element: op.element,
            x: p.x + p.facing * 15,
            y: surface ? surface.y - 24 : p.y,
            angle,
            range: op.range,
            speed: op.op === "Wave" ? 420 : 700,
            width: op.op === "Wave" ? 23 : 9,
            pierce: op.op === "Wave" || op.op === "Fan" ? 100 : 1,
            op,
            hits,
            surfaceId: surface?.id || null,
            origin: { ...origin },
          });
        }
      } else if (op.op === "Arc" || op.op === "Ray") {
        const width = op.op === "Arc" ? 26 : 5,
          targets = this.rayTargets(origin, a.angle, op.range, width).slice(
            0,
            op.pierce || 100,
          );
        for (const e of targets) this.hit(e, op, a.id, origin);
        g.effect("magic-line", p.x, p.y, {
          angle: a.angle,
          range: op.range,
          element: op.element,
          life: 0.2,
        });
      } else if (op.op === "Lightning") {
        const e = this.target(op.range);
        if (e) {
          this.hit(e, op, a.id, origin);
          g.effect("lightning", e.x, e.y, { element: op.element, life: 0.3 });
        }
      } else if (op.op === "Blast" || op.op === "Detonate") {
        const cx = p.x + p.facing * 55,
          cy = p.y + (!p.grounded && op.op === "Detonate" ? 65 : 0);
        for (const e of g.enemies) {
          if (
            e.dead ||
            (e.x - p.x) * p.facing < 0 ||
            Math.abs(e.x - cx) > op.range + e.halfWidth ||
            Math.abs(e.y - cy) > op.range * 0.7 + e.halfHeight
          )
            continue;
          const actual = { ...op };
          if (op.op === "Detonate") {
            const wet = e.elements?.wet?.until > g.t,
              burn = e.elements?.burn?.until > g.t;
            actual.damage = Math.min(50, 28 + (wet ? 10 : 0) + (burn ? 12 : 0));
            if (wet) delete e.elements.wet;
            if (burn) delete e.elements.burn;
          }
          this.hit(e, actual, a.id, origin);
        }
        g.effect(op.op === "Blast" ? "fireburst" : "detonation", cx, cy, {
          element: op.element,
          range: op.range,
          life: 0.38,
        });
      } else throw new Error(`Unsupported side operation ${op.op}`);
    }
    g.style(d.id, 8);
  }
  tick(dt) {
    const g = this.g,
      p = g.player;
    this.sequence.tick(g.t);
    if (p.dead) {
      this.cast = null;
      this.queued = null;
      this.bolts = [];
      return;
    }
    if (this.cast) {
      if (!this.cast.executed && g.t >= this.cast.readyAt)
        this.execute(this.cast);
      if (g.t >= this.cast.endAt) this.cast = null;
    }
    if (this.queued) {
      if (g.t > this.queued.expiresAt + 1e-8) {
        const q = this.queued;
        if (g.t - q.expiresAt <= 1 / 60 + 1e-8) this.request(q.skillId, true);
        if (this.queued === q) {
          this.queued = null;
          this.fail(`${SIDE_SKILLS[q.skillId].name} 시전 시간 초과`);
        }
      } else this.request(this.queued.skillId, true);
    }
    for (const b of this.bolts) {
      const travel = Math.min(b.speed * dt, b.range),
        steps = Math.ceil(travel / 5);
      for (let i = 0; i < steps && b.range > 0; i++) {
        const old = { x: b.x, y: b.y };
        b.x += (Math.cos(b.angle) * travel) / steps;
        b.y += (Math.sin(b.angle) * travel) / steps;
        b.range -= travel / steps;
        if (!clearLine(old, b, g.platforms)) {
          b.range = 0;
          break;
        }
        if (b.surfaceId) {
          const surface = g.platforms.find((s) => s.id === b.surfaceId);
          if (b.x < surface.x || b.x > surface.x + surface.width) {
            b.range = 0;
            break;
          }
        }
        for (const e of g.enemies)
          if (
            !e.dead &&
            !b.hits.has(e.id) &&
            Math.abs(b.x - e.x) < e.halfWidth + b.width &&
            Math.abs(b.y - e.y) < e.halfHeight + b.width
          ) {
            if (this.hit(e, b.op, b.id, b.origin)) {
              b.hits.add(e.id);
              b.pierce--;
              if (b.pierce <= 0) {
                b.range = 0;
                break;
              }
            }
          }
      }
    }
    this.bolts = this.bolts.filter((b) => b.range > 0);
    for (const e of g.enemies)
      for (const [type, s] of Object.entries(e.elements || {})) {
        if (g.t >= s.until || e.dead) {
          delete e.elements[type];
          continue;
        }
        if (type === "burn" && g.t >= s.next) {
          s.next += 0.5;
          g.damage(p, e, 2 * s.stacks, `burn:${e.id}:${s.next}`, {
            stagger: 0,
            quiet: true,
          });
        }
      }
  }
  interrupt() {
    if (this.cast) {
      this.cast = null;
      this.fail("피격으로 인술 시전 취소");
    }
  }
  reserved() {
    if (!this.cast || this.cast.executed) return 0;
    return SIDE_SKILLS[this.cast.skillId].operations.reduce(
      (n, o) => n + (["Shot", "Wave", "Fan"].includes(o.op) ? o.count || 1 : 0),
      0,
    );
  }
  snapshot() {
    return {
      seals: [...this.sequence.seals],
      sequenceExpiresAt: this.sequence.expiresAt,
      possible: this.sequence.possible(),
      lastRecipe: this.sequence.lastRecipe,
      queuedCast: this.queued ? { ...this.queued } : null,
      cast: this.cast?.skillId || null,
      cooldowns: { ...this.cooldowns },
      feedback: this.feedback,
      logs: this.logs.slice(-20),
      bolts: this.bolts.map((b) => ({ x: b.x, y: b.y, element: b.element })),
    };
  }
}
