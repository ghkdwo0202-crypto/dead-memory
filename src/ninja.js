import { Game, CombatEvents, direction } from "./core.js";
import { CONFIG } from "./data.js";
import { distance } from "./navigation.js";
export const NINJA_SAVE_KEY = "kage-in.deaths.v1";
export const NINJA_RULES = Object.freeze({
  step: 1 / 120,
  comboBuffer: 0.19,
  jumpDuration: 0.52,
  airGravity: 29.586,
  dashDuration: 0.22,
  dashInvulnerability: 0.14,
  dashRecharge: 2.3,
  airHitCap: 6,
  launchICD: 2,
});
export const NINJA_STRIKES = Object.freeze([
  Object.freeze({
    windup: 0.08,
    active: 0.07,
    recovery: 0.14,
    range: 90,
    cone: 110,
    damage: 20,
  }),
  Object.freeze({
    windup: 0.09,
    active: 0.07,
    recovery: 0.17,
    range: 90,
    cone: 110,
    damage: 22,
  }),
  Object.freeze({
    windup: 0.11,
    active: 0.09,
    recovery: 0.2,
    range: 110,
    cone: 145,
    damage: 28,
  }),
]);
export function readNinjaRecords(storage) {
  try {
    const data = JSON.parse(storage?.getItem(NINJA_SAVE_KEY) || "[]");
    return Array.isArray(data)
      ? data
          .filter(
            (r) =>
              r?.version === 1 &&
              Number.isFinite(r.time) &&
              Number.isFinite(r.kills),
          )
          .slice(-8)
      : [];
  } catch {
    return [];
  }
}
const delta = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
const memory = { getItem: () => null, setItem: () => {} };
export class NinjaGame extends Game {
  constructor({ storage = memory, random = Math.random, dojo = false } = {}) {
    // Reuse collision, navigation, hostile telegraphs, damage nonces and projectiles.
    // The parent sees empty storage; legacy records are never parsed/imported.
    super({ storage: memory, random });
    this.storage = storage;
    this.ninja = true;
    this.dojo = dojo;
    this.records = readNinjaRecords(storage);
    this.enemies = [];
    this.effects = [];
    this.notifications = [];
    this.events = new CombatEvents();
    this.pending = {};
    this.accumulator = 0;
    this.spawnAt = 2;
    this.finished = false;
    const p = this.player;
    p.speed = 245;
    p.critChance = 0;
    p.comboIndex = 0;
    p.comboExpiresAt = 0;
    p.airHeight = 0;
    p.airVelocity = 0;
    p.airHits = 0;
    p.followUsed = false;
    p.momentum = 0;
    p.momentumHits = 0;
    p.styleScore = 0;
    p.perfectDodgeWindowEnd = 0;
    p.combatState = "ground";
    this.styleVariety = new Set();
    this.lastHitAt = 0;
    this.lastMomentumDecay = 0;
    this.shakeUntil = 0;
    this.shakeStrength = 0;
    this.events.on("OnSuccessfulEvade", (e) => {
      if (e.actor !== p) return;
      p.perfectDodgeWindowEnd = this.t + 0.7;
      this.addStyle("evade", 15);
      this.effect("perfect", p.x, p.y, { life: 0.35 });
      this.notify("간파 · PERFECT DODGE", "0.7초 안에 Z · 60px 반격 찌르기");
    });
    if (dojo) {
      for (const [x, y, type] of [
        [1280, 800, "hungry"],
        [1410, 800, "hungry"],
        [1200, 1000, "spitter"],
      ]) {
        const e = this.spawnEnemy(type, { x, y });
        e.trainingDummy = true;
        e.hp = e.maxHP = 10000;
      }
    } else
      for (const [type, x, y] of [
        ["hungry", 1280, 800],
        ["crawler", 1510, 920],
        ["spitter", 1450, 590],
      ])
        this.spawnEnemy(type, { x, y });
    this.notify(
      dojo ? "검술 수련장" : "지붕 위의 첫 교전",
      "Z 3타 → 방향키 + Space 추격 → 공중 Z → ↓+Z 격추",
    );
  }
  styleRank() {
    return ["D", "C", "B", "A", "S", "SS"][
      [12, 30, 55, 85, 120].filter((n) => this.player.styleScore >= n).length
    ];
  }
  addStyle(kind, amount) {
    this.styleRepeat =
      this.lastStyleKind === kind ? (this.styleRepeat || 0) + 1 : 0;
    this.lastStyleKind = kind;
    const varied = !this.styleVariety.has(kind);
    this.styleVariety.add(kind);
    const gain = this.styleRepeat > 4 ? 0 : amount * (varied ? 1 : 0.25);
    this.player.styleScore = Math.min(150, this.player.styleScore + gain);
  }

  speed(a) {
    return (
      a.speed *
      (1 + (a.upgrades?.speed || 0)) *
      (a.statuses.stun || a.staggerUntil > this.t ? 0 : 1) *
      (a === this.player && a.attack?.special ? 0.7 : 1)
    );
  }
  aim(a, range = 110) {
    return this.targets(a)
      .filter(
        (e) =>
          distance(a, e) <= range &&
          this.visible(a, e) &&
          delta(Math.atan2(e.y - a.y, e.x - a.x), a.lastNonZeroFacing) <=
            (50 * Math.PI) / 180,
      )
      .sort(
        (x, y) =>
          distance(a, x) - distance(a, y) ||
          String(x.id).localeCompare(String(y.id)),
      )[0];
  }
  requestAttack(a, special = false, buffer = true) {
    if (a !== this.player) return super.requestAttack(a, special, buffer);
    if (a.dead || a.staggerUntil > this.t) return false;
    if (special && a.specialAt > this.t) return false;
    const slamReady =
      !special &&
      a.airHeight > 0 &&
      a.airHits >= 2 &&
      this.t <= (a.slamWindowEnd || 0) &&
      (this.currentInput?.down || this.attackDownIntentUntil > this.t) &&
      a.dashUntil <= this.t &&
      (!a.attack || (a.attack.air && a.attack.executed));
    if (slamReady) {
      this.landImpact(a);
      return true;
    }
    if (a.attack || a.dashUntil > this.t) {
      if (buffer && (!a.buffer?.special || special))
        a.buffer = { special, until: this.t + NINJA_RULES.comboBuffer };
      return false;
    }
    const air = a.airHeight > 0;
    const strike = air
      ? (a.airHits % 2) + 1
      : this.t <= a.comboExpiresAt
        ? (a.comboIndex % 3) + 1
        : 1;
    const spec = NINJA_STRIKES[air ? strike - 1 : strike - 1],
      target = this.aim(a, spec.range + 10),
      counter = !special && a.perfectDodgeWindowEnd > this.t;
    const angle = target
      ? Math.atan2(target.y - a.y, target.x - a.x)
      : a.lastNonZeroFacing;
    a.face = angle;
    a.faceLockUntil = this.t + 0.1;
    a.attack = {
      id: ++this.attackSerial,
      start: this.t,
      activeAt: this.t + (special ? 0.1 : spec.windup),
      endAt:
        this.t + (special ? 0.32 : spec.windup + spec.active + spec.recovery),
      activeDuration: spec.active,
      angle,
      special,
      air,
      strike,
      counter,
      executed: false,
      range: counter ? 145 : spec.range,
      cone: counter ? 0.35 : (spec.cone * Math.PI) / 180,
      damage: special ? 18 : spec.damage,
    };
    if (counter) a.perfectDodgeWindowEnd = 0;
    if (special) {
      a.specialAt = this.t + 4;
      a.stats.specials++;
    } else {
      a.stats.attacks++;
      if (!air) {
        a.comboIndex = strike;
        a.comboExpiresAt = a.attack.endAt + 0.5;
      }
    }
    return true;
  }
  executeAttack(a, attack) {
    if (a !== this.player) return super.executeAttack(a, attack);
    if (attack.resolved) return;
    attack.resolved = true;
    if (attack.special) {
      this.projectile(a, null, attack.angle, {
        damage: 18,
        speed: 680,
        range: 440,
        direct: true,
        attackInstanceId: `kunai:${attack.id}`,
      });
      this.effect("kunai", a.x, a.y, { angle: attack.angle, life: 0.12 });
      return;
    }
    if (attack.counter)
      this.move(a, Math.cos(attack.angle) * 60, Math.sin(attack.angle) * 60);
    this.effect("ninja-slash", a.x, a.y, {
      angle: attack.angle,
      range: attack.range,
      cone: attack.cone,
      airHeight: a.airHeight,
      strike: attack.strike,
      counter: attack.counter,
      life: attack.strike === 3 ? 0.14 : 0.1,
    });
    if (attack.air) {
      a.airHits++;
      a.slamWindowEnd = this.t + 0.3;
    }
    let connected = false;
    for (const e of this.targets(a)) {
      if (
        distance(a, e) > attack.range + e.radius ||
        delta(Math.atan2(e.y - a.y, e.x - a.x), attack.angle) >
          attack.cone / 2 ||
        !this.visible(a, e)
      )
        continue;
      if (
        (e.airHeight || 0) > 0 &&
        (e.juggleCount || 0) >= NINJA_RULES.airHitCap
      )
        continue;
      const hit = this.damage(a, e, attack.damage, {
        direct: true,
        attackInstanceId: `katana:${attack.id}`,
        stagger: 0.16,
        knockback: attack.strike === 2 ? 8 : 0,
      });
      if (!hit) continue;
      connected = true;
      if (e.airHeight > 0) {
        e.juggleCount = (e.juggleCount || 0) + 1;
        if (e.juggleCount >= NINJA_RULES.airHitCap) {
          e.airHeight = 0;
          e.airVelocity = 0;
          e.juggleUntil = 0;
        }
      }
      if (!e.dead && attack.strike === 3 && !attack.air) this.launch(e);
    }
    if (connected) {
      this.lastHitAt = this.t;
      a.momentumHits++;
      if (a.momentumHits % 3 === 0) a.momentum = Math.min(3, a.momentum + 1);
      this.addStyle(
        attack.counter ? "counter" : attack.air ? "air" : "sword",
        attack.air ? 8 : 4,
      );
    }
  }
  damage(source, target, amount, opts = {}) {
    const hit = super.damage(source, target, amount, opts);
    if (hit > 0 && source === this.player) {
      this.hitstop = Math.max(this.hitstop, 0.05);
      this.shakeUntil = this.t + 0.12;
      this.shakeStrength =
        target.type === "boss" || target.type === "elite" ? 4 : 2;
    }
    if (hit > 0 && target === this.player) {
      target.buffer = null;
      target.attack = null;
      target.styleScore = Math.max(0, target.styleScore - 18);
      target.staggerUntil = this.t + 0.15;
      this.addStyleReset();
    }
    return hit;
  }
  addStyleReset() {
    this.styleVariety.clear();
    this.styleRepeat = 0;
    this.lastStyleKind = null;
  }
  launch(e) {
    if (e.type === "boss") {
      e.staggerMeter = Math.min(100, (e.staggerMeter || 0) + 8);
      return false;
    }
    if (this.t < (e.launchReadyAt || 0)) return false;
    e.launchReadyAt = this.t + NINJA_RULES.launchICD;
    e.juggleCount = 0;
    e.airHeight = 0.05;
    e.airVelocity = e.type === "elite" ? 3.8 : 7.1;
    e.airGravity = e.type === "elite" ? 19 : 16;
    e.juggleUntil = this.t + (e.type === "elite" ? 0.45 : 1.2);
    e.telegraph = null;
    e.staggerUntil = this.t + 0.28;
    if (e.type === "elite")
      e.staggerMeter = Math.min(100, (e.staggerMeter || 0) + 25);
    this.effect("launch", e.x, e.y, { life: 0.35 });
    return true;
  }
  jump(input = {}) {
    const p = this.player;
    if (p.dead || p.staggerUntil > this.t || p.dashUntil > this.t) return false;
    const dir = direction(input),
      air = p.airHeight > 0;
    const target =
      (dir.x || dir.y) && !p.followUsed
        ? this.enemies
            .filter(
              (e) =>
                !e.dead &&
                e.airHeight > 0 &&
                distance(p, e) <= 220 &&
                this.visible(p, e) &&
                delta(
                  Math.atan2(e.y - p.y, e.x - p.x),
                  Math.atan2(dir.y, dir.x),
                ) <=
                  Math.PI / 2.5,
            )
            .sort((a, b) => distance(p, a) - distance(p, b))[0]
        : null;
    if (air && !target) return false;
    if (!air) {
      p.airHits = 0;
      p.followUsed = false;
    }
    p.attack = null;
    p.buffer = null;
    if (target) {
      const angle = Math.atan2(target.y - p.y, target.x - p.x),
        d = Math.min(
          100 + p.momentum * 10,
          Math.max(0, distance(p, target) - 35),
        );
      this.move(p, Math.cos(angle) * d, Math.sin(angle) * d);
      p.followUsed = true;
      this.addStyle("follow", 12);
      this.effect("follow", p.x, p.y, {
        end: { x: target.x, y: target.y },
        life: 0.18,
      });
    }
    p.airHeight = 0.001;
    p.airVelocity = 7.69;
    p.combatState = target ? "air-combo" : "jump";
    this.effect("jump", p.x, p.y, { life: 0.25 });
    return true;
  }
  landImpact(p) {
    p.airHeight = 0;
    p.airVelocity = 0;
    p.airHits = 0;
    p.attack = null;
    p.slamWindowEnd = 0;
    p.followUsed = false;
    p.combatState = "landing";
    p.landingUntil = this.t + 0.12;
    const id = `impact:${++this.attackSerial}`;
    for (const e of this.targets(p))
      if (distance(p, e) < 115 && this.visible(p, e)) {
        this.damage(p, e, 30, {
          direct: true,
          attackInstanceId: id,
          stagger: 0.3,
        });
        if (e.type !== "boss") {
          e.airHeight = 0;
          e.airVelocity = 0;
          e.juggleUntil = 0;
        }
      }
    this.effect("impact", p.x, p.y, { range: 115, life: 0.35 });
    this.addStyle("impact", 12);
  }
  dash(a, input = {}) {
    if (a !== this.player) return super.dash(a, input);
    if (
      a.dead ||
      a.staggerUntil > this.t ||
      a.dashes <= 0 ||
      a.dashUntil > this.t
    )
      return false;
    if (a.attack) {
      const cancelAt =
        a.attack.activeAt +
        a.attack.activeDuration +
        (!a.attack.air && a.attack.strike === 3 ? 0.06 : 0);
      if (this.t < cancelAt) return false;
    }
    const d = direction(input);
    a.dashDirection =
      d.x || d.y
        ? d
        : {
            x: Math.cos(a.lastNonZeroFacing),
            y: Math.sin(a.lastNonZeroFacing),
          };
    a.attack = null;
    a.buffer = null;
    a.dashes--;
    a.stats.dashes++;
    a.dashSerial++;
    a.dashUntil = this.t + 0.22;
    a.invulnerableUntil = this.t + 0.14;
    if (!a.rechargeAt) a.rechargeAt = this.t + 2.3;
    for (let i = 0; i < 3; i++)
      this.effect(
        "afterimage",
        a.x + a.dashDirection.x * i * 22,
        a.y + a.dashDirection.y * i * 22,
        { face: a.face, airHeight: a.airHeight, life: 0.15 + i * 0.025 },
      );
    return true;
  }
  updateAir(a, dt) {
    if (!(a.airHeight > 0)) return;
    a.airVelocity -=
      (a === this.player ? NINJA_RULES.airGravity : a.airGravity || 16) * dt;
    a.airHeight = Math.max(0, Math.min(1, a.airHeight + a.airVelocity * dt));
    if (a !== this.player && this.t >= a.juggleUntil) a.airHeight = 0;
    if (!a.airHeight) {
      a.airVelocity = 0;
      if (a === this.player) {
        a.airHits = 0;
        a.followUsed = false;
        a.combatState = "ground";
      }
      this.effect("landing", a.x, a.y, { life: 0.2, range: 28 });
    }
  }
  updateActor(a, dt) {
    this.updateAir(a, dt);
    if (a !== this.player) {
      for (const [id, s] of Object.entries(a.statuses))
        if (this.t >= s.until) delete a.statuses[id];
      return;
    }
    if (a.dashUntil > this.t) {
      this.move(a, a.dashDirection.x * 780 * dt, a.dashDirection.y * 780 * dt);
      a.combatState = "dash";
    } else if (!a.airHeight)
      a.combatState = a.attack
        ? "ground"
        : a.landingUntil > this.t
          ? "landing"
          : "ground";
    if (a.rechargeAt && this.t >= a.rechargeAt) {
      a.dashes = Math.min(2, a.dashes + 1);
      a.rechargeAt = a.dashes < 2 ? this.t + 2.3 : 0;
    }
    if (a.attack && !a.attack.executed && this.t >= a.attack.activeAt) {
      a.attack.executed = true;
      this.executeAttack(a, a.attack);
    }
    if (a.attack && this.t >= a.attack.endAt) {
      a.attack = null;
      if (a.buffer && a.buffer.until >= this.t) {
        const b = a.buffer;
        a.buffer = null;
        this.requestAttack(a, b.special, false);
      }
    }
    if (a.buffer && a.buffer.until < this.t) a.buffer = null;
  }
  enemyAI(a, dt) {
    if (a.airHeight > 0) return;
    return super.enemyAI(a, dt);
  }
  enemyStrike(enemy, w) {
    if (w.kind === "spit") {
      this.projectile(enemy, null, w.angle, {
        damage: 13,
        speed: 340,
        range: w.range,
        direct: false,
        attackInstanceId: w.id,
      });
      return;
    }
    super.enemyStrike(enemy, w);
  }
  onDeath(target, source) {
    if (target === this.player) {
      this.mode = "dead";
      this.cause =
        source.type === "spitter"
          ? "표창 닌자"
          : source.type === "crawler"
            ? "측면 암살자"
            : "추격 닌자";
      if (!this.dojo)
        try {
          const records = [
            ...readNinjaRecords(this.storage),
            {
              version: 1,
              time: this.t,
              kills: this.kills,
              style: this.styleRank(),
              phase: "P1",
            },
          ].slice(-8);
          this.storage.setItem(NINJA_SAVE_KEY, JSON.stringify(records));
          this.records = records;
          this.saved = true;
        } catch {
          this.saved = false;
        }
      return;
    }
    this.kills++;
    this.effect("death", target.x, target.y, { life: 0.28 });
    this.orbs.push({ x: target.x, y: target.y, value: 5 });
  }
  tick(dt, input = {}) {
    if (this.mode !== "playing") return false;
    for (const key of [
      "dashPressed",
      "jumpPressed",
      "specialPressed",
      "attackPressed",
    ])
      if (input[key] && !this.pending[key])
        this.pending[key] = {
          up: input.up,
          down: input.down,
          left: input.left,
          right: input.right,
        };
    this.currentInput = input;
    this.accumulator += Math.min(0.1, Math.max(0, dt));
    while (this.accumulator >= NINJA_RULES.step) {
      this.accumulator -= NINJA_RULES.step;
      if (this.hitstop > 0) {
        this.hitstop = Math.max(0, this.hitstop - NINJA_RULES.step);
        continue;
      }
      this.advance(NINJA_RULES.step, input);
      if (this.mode !== "playing") {
        this.accumulator = 0;
        break;
      }
    }
    return true;
  }
  advance(dt, input) {
    this.t += dt;
    const p = this.player,
      d = direction(input);
    if (d.x || d.y) {
      p.lastNonZeroFacing = Math.atan2(d.y, d.x);
      p.lastMove = d;
      if (!p.attack || this.t >= p.faceLockUntil) p.face = p.lastNonZeroFacing;
      if (p.dashUntil <= this.t)
        this.move(p, d.x * this.speed(p) * dt, d.y * this.speed(p) * dt);
    }
    const edges = this.pending;
    this.pending = {};
    if (edges.dashPressed) this.dash(p, edges.dashPressed);
    if (edges.jumpPressed) this.jump(edges.jumpPressed);
    if (edges.specialPressed) this.requestAttack(p, true);
    if (edges.attackPressed?.down) this.attackDownIntentUntil = this.t + 0.15;
    if (input.attack || edges.attackPressed) this.requestAttack(p);
    for (const a of [p, ...this.enemies]) this.updateActor(a, dt);
    for (const e of this.enemies) if (!e.trainingDummy) this.enemyAI(e, dt);
    this.updateProjectiles(dt);
    for (const o of this.orbs) {
      const dist = distance(o, p);
      if (dist < 140) {
        if (dist < 22) {
          o.dead = true;
          this.xp += o.value;
        } else {
          this.move(
            o,
            ((p.x - o.x) / dist) * 400 * dt,
            ((p.y - o.y) / dist) * 400 * dt,
          );
        }
      }
    }
    this.orbs = this.orbs.filter((o) => !o.dead).slice(-300);
    if (!this.dojo && this.t >= this.spawnAt) {
      const types = ["hungry", "crawler", "spitter"];
      for (let i = 0; i < Math.min(5, 2 + Math.floor(this.t / 30)); i++)
        this.spawnEnemy(types[Math.floor(this.random() * 3)]);
      this.spawnAt = this.t + Math.max(2, 5 - this.t / 80);
    }
    if (this.t - this.lastHitAt > 5 && this.t - this.lastMomentumDecay >= 5) {
      p.momentum = Math.max(0, p.momentum - 1);
      this.lastMomentumDecay = this.t;
    }
    p.styleScore = Math.max(0, p.styleScore - dt * 1.3);
    this.enemies = this.enemies.filter((e) => !e.dead);
    this.effects = this.effects
      .filter((e) => this.t - e.born < e.life)
      .slice(-160);
    this.numbers = this.numbers.filter((n) => this.t - n.born < 0.6);
    this.notifications = this.notifications.filter((n) => n.until > this.t);
  }
  snapshot() {
    return {
      ...super.snapshot(),
      ninja: true,
      phase: "P1",
      dojo: this.dojo,
      style: this.styleRank(),
      player: {
        ...super.snapshot().player,
        airHeight: this.player.airHeight,
        airVelocity: this.player.airVelocity,
        airHits: this.player.airHits,
        followUsed: this.player.followUsed,
        comboIndex: this.player.comboIndex,
        momentum: this.player.momentum,
        styleScore: this.player.styleScore,
        combatState: this.player.combatState,
        perfectDodgeWindowEnd: this.player.perfectDodgeWindowEnd,
      },
      enemies: this.enemies.map((e) => ({
        id: e.id,
        type: e.type,
        x: e.x,
        y: e.y,
        hp: e.hp,
        airHeight: e.airHeight || 0,
        juggleCount: e.juggleCount || 0,
        telegraph: e.telegraph,
      })),
      effects: this.effects.map((e) => ({ type: e.type, x: e.x, y: e.y })),
    };
  }
}
