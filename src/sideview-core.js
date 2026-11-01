import { SideMagic } from "./side-magic.js";
import {
  PHYSICS,
  WORLD,
  PLATFORMS,
  body2d,
  approach,
  stepBody,
  moveBody,
  jumpBody,
  overlap,
  clearLine,
  surfaceBelow,
} from "./physics2d.js";
import { SideEvents } from "./side-events.js";
export const SIDE_SAVE_KEY = "kage-in.p3.v1";
export const SWORD = Object.freeze([
  { windup: 0.07, active: 0.08, recovery: 0.13, range: 100, damage: 16 },
  { windup: 0.08, active: 0.07, recovery: 0.15, range: 95, damage: 18 },
  { windup: 0.11, active: 0.08, recovery: 0.19, range: 110, damage: 23 },
]);
export const ENEMY_TYPES = Object.freeze({
  guard: { name: "문지기", hp: 58, speed: 100, damage: 12, range: 68 },
  runner: { name: "그림자 척후", hp: 42, speed: 175, damage: 10, range: 60 },
  thrower: { name: "표창 사수", hp: 46, speed: 90, damage: 11, range: 430 },
  elite: { name: "철갑 무사", hp: 190, speed: 75, damage: 21, range: 110 },
  boss: { name: "수련 대장", hp: 1000, speed: 0, damage: 25, range: 130 },
});
export class SideGame {
  constructor({ storage = null, random = Math.random, demo = "run" } = {}) {
    this.storage = storage;
    this.random = random;
    this.demo = demo;
    this.platforms = PLATFORMS;
    this.t = 0;
    this.mode = "playing";
    this.accumulator = 0;
    this.events = new SideEvents();
    this.serial = 0;
    this.enemies = [];
    this.effects = [];
    this.numbers = [];
    this.projectiles = [];
    this.pending = {};
    this.hitstop = 0;
    this.kills = 0;
    this.xp = 0;
    this.level = 1;
    this.xpRequired = 15;
    this.rewardChoices = [];
    this.notifications = [];
    this.spawnAt = 4;
    this.shakeUntil = 0;
    this.shakeStrength = 0;
    this.finished = false;
    this.cause = "";
    this.saved = false;
    this.checkpoint = { id: "gate", x: 160, y: 974 };
    this.player = {
      ...body2d(160, 974, { grounded: true, groundPlatformId: "floor-a" }),
      id: "player",
      team: "player",
      hp: 120,
      maxHP: 120,
      dead: false,
      attack: null,
      comboIndex: 0,
      comboUntil: 0,
      airCombo: 0,
      attackBuffer: null,
      staggerUntil: 0,
      hurtUntil: 0,
      lastDashAt: -10,
      dashUntil: 0,
      invulnFrom: 0,
      invulnUntil: 0,
      dashes: 2,
      rechargeAt: 0,
      finisherAt: 0,
      perfectUntil: 0,
      style: 0,
      speedBonus: 0,
      stats: {
        attacks: 0,
        finishers: 0,
        dashes: 0,
        perfect: 0,
        pogos: 0,
        hits: 0,
      },
      received: new Map(),
      evaded: new Set(),
    };
    this.magic = new SideMagic(this);
    this.recentKinds = [];
    this.lastActionAt = 0;
    this.pendingJumpHeld = false;
    if (demo === "run") {
      for (const [type, x] of [
        ["guard", 370],
        ["runner", 840],
        ["thrower", 1080],
        ["elite", 1960],
      ])
        this.spawn(type, x);
    } else {
      this.player.x = 380;
      this.player.y = 874;
      this.player.groundPlatformId = "balcony-a";
      for (const [type, x, y] of [
        ["guard", 490, 874],
        ["runner", 620, 974],
        ["thrower", 950, 974],
        ["elite", 1100, 974],
      ]) {
        const e = this.spawn(type, x, y);
        e.dummy = true;
        e.hp = e.maxHP = 10000;
      }
    }
    this.notify(
      demo === "run"
        ? "밤의 성문 · 횡스크롤 검술"
        : "수련장 · 점프 / 포고 / 반격",
      "← → 이동 · Space 점프 · ↑/↓+Z 방향 베기 · C 피니시",
    );
  }
  effect(type, x, y, extra = {}) {
    this.effects.push({ type, x, y, born: this.t, life: 0.25, ...extra });
    if (this.effects.length > 180) this.effects.shift();
  }
  notify(text, sub = "") {
    this.notifications.push({ text, sub, until: this.t + 2.5 });
    this.notifications = this.notifications.slice(-5);
  }
  spawn(type = "guard", x = 600, y = null) {
    if (this.enemies.filter((e) => !e.dead).length >= 100) return null;
    const d = ENEMY_TYPES[type];
    const ground = surfaceBelow(x, y ?? 500, this.platforms);
    const e = {
      ...body2d(x, y ?? (ground ? ground.y - 26 : 850)),
      id: `enemy:${++this.serial}`,
      team: "enemy",
      type,
      hp: d.hp,
      maxHP: d.hp,
      dead: false,
      nextAttack: this.t + 1,
      telegraph: null,
      staggerUntil: 0,
      received: new Map(),
      evaded: new Set(),
      launchImmuneUntil: 0,
      airJuggleHits: 0,
      relifts: 0,
      staggerMeter: 0,
      attack: null,
    };
    this.enemies.push(e);
    return e;
  }
  style(kind, value = 5) {
    const p = this.player,
      repeat = this.recentKinds.filter((k) => k === kind).length;
    p.style = Math.min(150, p.style + (repeat >= 4 ? 0 : value));
    this.recentKinds.push(kind);
    this.recentKinds = this.recentKinds.slice(-6);
    this.lastActionAt = this.t;
  }
  styleRank() {
    return ["D", "C", "B", "A", "S", "SS"][
      [15, 35, 60, 95, 125].filter((n) => this.player.style >= n).length
    ];
  }
  visible(a, b) {
    return clearLine(a, b, this.platforms);
  }
  dash(input = {}) {
    const p = this.player;
    if (
      p.dead ||
      p.staggerUntil > this.t ||
      p.dashUntil > this.t ||
      p.dashes <= 0 ||
      (!p.grounded && p.airDashUsed)
    )
      return false;
    if (p.attack && this.t < p.attack.activeAt + p.attack.duration)
      return false;
    if (this.magic.cast && !this.magic.cast.executed) return false;
    if (this.magic.cast) this.magic.cast = null;
    const facing = input.left ? -1 : input.right ? 1 : p.facing;
    p.facing = facing;
    p.attack = null;
    p.attackBuffer = null;
    p.dashes--;
    p.stats.dashes++;
    p.lastDashAt = this.t;
    p.dashUntil = this.t + 0.17;
    p.invulnFrom = this.t + 0.025;
    p.invulnUntil = this.t + 0.125;
    p.vx = facing * 620;
    p.vy = 0;
    if (!p.grounded) p.airDashUsed = true;
    if (!p.rechargeAt) p.rechargeAt = this.t + 2.3;
    for (let i = 0; i < 3; i++)
      this.effect("afterimage", p.x - facing * i * 18, p.y, {
        facing,
        life: 0.15 + i * 0.02,
      });
    return true;
  }
  requestSword(input = {}, finisher = false) {
    const p = this.player;
    if (p.dead || p.staggerUntil > this.t || p.dashUntil > this.t) return false;
    if (finisher && p.finisherAt > this.t) return false;
    if (this.magic.cast || p.attack) {
      if (!p.attackBuffer || finisher)
        p.attackBuffer = {
          finisher,
          input: { up: input.up, down: input.down },
          until: this.t + 0.19,
        };
      return false;
    }
    const air = !p.grounded,
      strike = air
        ? (p.airCombo % 2) + 1
        : this.t <= p.comboUntil
          ? (p.comboIndex % 3) + 1
          : 1,
      spec = SWORD[strike - 1];
    let dir = input.up ? "up" : input.down && air ? "down" : "front";
    if (finisher) dir = air ? "down" : "up";
    const dashCut = !finisher && this.t - p.lastDashAt <= 0.35;
    const counter = finisher && p.perfectUntil > this.t;
    p.attack = {
      id: `sword:${++this.serial}`,
      start: this.t,
      activeAt: this.t + (finisher ? 0.1 : spec.windup),
      endAt:
        this.t + (finisher ? 0.42 : spec.windup + spec.active + spec.recovery),
      duration: finisher ? 0.1 : spec.active,
      strike,
      air,
      dir,
      facing: p.facing,
      finisher,
      counter,
      dashCut,
      range: finisher ? (counter ? 150 : 120) : spec.range,
      damage: finisher ? 31 : spec.damage,
      executed: false,
    };
    if (finisher) {
      p.finisherAt = this.t + 2.8;
      p.perfectUntil = 0;
      p.stats.finishers++;
      if (air) p.vy = 620;
    } else {
      p.stats.attacks++;
      if (air) p.airCombo = strike;
      else {
        p.comboIndex = strike;
        p.comboUntil = p.attack.endAt + 0.45;
      }
    }
    return true;
  }
  inSword(a, e) {
    const p = this.player,
      dx = e.x - p.x,
      dy = e.y - p.y;
    if (a.dir === "up")
      return (
        Math.abs(dx - (a.finisher ? a.facing * 35 : 0)) <
          (a.counter ? 75 : 45) + e.halfWidth &&
        dy < e.halfHeight + 5 &&
        dy > -a.range - e.halfHeight
      );
    if (a.dir === "down")
      return (
        Math.abs(dx) < 45 + e.halfWidth &&
        dy > -e.halfHeight - 3 &&
        dy < a.range + e.halfHeight
      );
    return (
      dx * a.facing >= -e.halfWidth &&
      dx * a.facing <= a.range + e.halfWidth &&
      Math.abs(dy) < (a.strike === 2 ? 54 : 40) + e.halfHeight
    );
  }
  executeSword(a) {
    if (a.executed) return;
    a.executed = true;
    const p = this.player;
    if (a.dashCut) moveBody(p, a.facing * 35, 0, this.platforms, this.t);
    this.effect("slash", p.x, p.y, {
      dir: a.dir,
      facing: a.facing,
      range: a.range,
      strike: a.strike,
      finisher: a.finisher,
      counter: a.counter,
      life: 0.14,
    });
    for (const e of this.enemies) {
      if (e.dead || !this.inSword(a, e) || !this.visible(p, e)) continue;
      if (a.dir === "down" && a.air && !a.finisher && (e.pogoAt || 0) > this.t)
        continue;
      if (!e.grounded && (e.airJuggleHits || 0) >= 5) continue;
      const hit = this.damage(p, e, a.damage, a.id, { stagger: 0.18 });
      if (!hit) continue;
      p.stats.hits++;
      this.style(
        a.counter
          ? "counter"
          : a.dir === "down"
            ? "pogo"
            : a.air
              ? "air"
              : "sword",
        a.air ? 8 : 4,
      );
      if (!e.grounded) {
        e.airJuggleHits++;
        if (e.airJuggleHits >= 5) {
          e.launchImmuneUntil = this.t + 1.5;
          e.vy = Math.max(180, e.vy);
        }
      }
      if (a.finisher && a.air) {
        e.vy = 700;
        this.effect("impact", e.x, e.y, { life: 0.3, range: 75 });
      } else if (a.finisher || (!a.air && a.strike === 3))
        this.launch(e, a.finisher ? 680 : 570);
      if (
        a.dir === "down" &&
        !a.finisher &&
        a.air &&
        this.t >= (e.pogoAt || 0)
      ) {
        p.vy = -430;
        p.stats.pogos++;
        e.pogoAt = this.t + 0.2;
        this.effect("pogo", p.x, p.y + 27, { life: 0.22 });
      }
    }
  }
  launch(e, speed = 570) {
    if (["elite", "boss"].includes(e.type)) {
      e.staggerMeter += e.type === "boss" ? 8 : 25;
      if (e.staggerMeter >= 100) {
        e.staggerUntil = this.t + 0.6;
        e.staggerMeter = 0;
      }
      return false;
    }
    if (this.t < e.launchImmuneUntil) return false;
    if (!e.grounded && e.relifts >= 1) return false;
    e.relifts = e.grounded ? 0 : e.relifts + 1;
    e.vy = -speed;
    e.grounded = false;
    e.telegraph = null;
    e.launchUntil = Math.min(e.launchUntil || this.t + 1, this.t + 1);
    return true;
  }
  damage(source, target, amount, id, { stagger = 0.12, quiet = false } = {}) {
    if (target.dead || target.received.has(id) || target.evaded.has(id))
      return 0;
    if (
      target === this.player &&
      this.t >= target.invulnFrom &&
      this.t < target.invulnUntil
    ) {
      if (!target.evaded.has(id)) {
        target.evaded.add(id);
        if (target.evaded.size > 128)
          target.evaded.delete(target.evaded.values().next().value);
        target.stats.perfect++;
        target.perfectUntil = this.t + 0.55;
        this.effect("perfect", target.x, target.y, { life: 0.35 });
        this.notify("간파 · PERFECT DODGE", "0.55초 C 반격 창");
        this.style("perfect", 15);
      }
      return 0;
    }
    if (target === this.player && this.t < target.hurtUntil) return 0;
    target.received.set(id, this.t);
    if (target.received.size > 256)
      target.received.delete(target.received.keys().next().value);
    const actual = Math.min(target.hp, amount);
    target.hp -= actual;
    target.flashUntil = this.t + 0.08;
    target.staggerUntil = Math.max(target.staggerUntil, this.t + stagger);
    this.numbers.push({
      x: target.x,
      y: target.y - 30,
      text: Math.ceil(actual),
      born: this.t,
    });
    if (!quiet)
      this.events.emit("OnHit", {
        source,
        target,
        amount: actual,
        attackId: id,
      });
    if (target === this.player) {
      this.magic.interrupt();
      target.attack = null;
      target.attackBuffer = null;
      target.hurtUntil = this.t + 0.5;
      target.style = Math.max(0, target.style - 20);
      target.vx = (target.x >= source.x ? 1 : -1) * 220;
      target.vy = -170;
    }
    if (!quiet) this.hitstop = Math.max(this.hitstop, 0.045);
    if (!quiet) this.shakeUntil = this.t + 0.12;
    this.shakeStrength = ["elite", "boss"].includes(target.type) ? 4 : 2;
    if (target.hp <= 0) {
      target.dead = true;
      if (target === this.player) this.endRun(source.type || "낙사");
      else {
        this.kills++;
        this.xp += 5;
        this.effect("death", target.x, target.y, { life: 0.3 });
      }
    }
    return actual;
  }
  endRun(cause) {
    this.mode = "dead";
    this.cause = cause;
    try {
      const raw = JSON.parse(this.storage?.getItem(SIDE_SAVE_KEY) || "{}"),
        records = Array.isArray(raw.records) ? raw.records : [];
      this.storage?.setItem(
        SIDE_SAVE_KEY,
        JSON.stringify({
          version: 1,
          records: [
            ...records,
            { time: this.t, kills: this.kills, checkpoint: this.checkpoint.id },
          ].slice(-8),
        }),
      );
      this.saved = Boolean(this.storage);
    } catch {
      this.saved = false;
    }
  }
  respawn() {
    const p = this.player;
    p.hp -= 20;
    p.x = this.checkpoint.x;
    p.y = this.checkpoint.y;
    p.vx = p.vy = 0;
    p.grounded = false;
    p.airDashUsed = false;
    p.attack = null;
    p.attackBuffer = null;
    p.dashUntil = 0;
    p.hurtUntil = this.t + 1;
    p.airCombo = 0;
    this.effect("respawn", p.x, p.y, { life: 0.5 });
    this.notify("체크포인트로 복귀", "낙사 · 체력 -20");
    if (p.hp <= 0) {
      p.dead = true;
      this.endRun("낙사");
    }
  }
  enemyTick(e, dt) {
    const p = this.player,
      d = ENEMY_TYPES[e.type];
    if (e.dummy || e.dead) return;
    if (e.staggerUntil > this.t || !e.grounded) {
      e.vx = approach(e.vx, 0, 1000 * dt);
      return;
    }
    if (e.telegraph) {
      e.vx = 0;
      const a = e.telegraph;
      if (this.t >= a.at) {
        e.telegraph = null;
        e.nextAttack = this.t + (e.type === "elite" ? 1.8 : 1.1);
        if (a.kind === "throw") {
          if (
            this.projectiles.length + this.magic.bolts.length <
            200 - this.magic.reserved()
          )
            this.projectiles.push({
              id: a.id,
              x: e.x,
              y: e.y - 7,
              vx: Math.cos(a.angle) * 330,
              vy: Math.sin(a.angle) * 330,
              owner: e,
              life: 1.5,
            });
        } else {
          const box = {
            x: e.x + a.facing * a.range * 0.5,
            y: e.y,
            halfWidth: a.range * 0.5,
            halfHeight: 40,
          };
          if (overlap(box, p) && this.visible(e, p))
            this.damage(e, p, d.damage, a.id);
          this.effect("hostile-slash", e.x, e.y, {
            facing: a.facing,
            range: a.range,
            life: 0.2,
          });
        }
      }
      return;
    }
    const dx = p.x - e.x,
      dy = p.y - e.y;
    e.facing = dx < 0 ? -1 : 1;
    if (
      this.t >= e.nextAttack &&
      Math.abs(dx) < d.range &&
      Math.abs(dy) < (e.type === "thrower" ? 260 : 58) &&
      this.visible(e, p)
    ) {
      e.telegraph = {
        id: `hostile:${++this.serial}`,
        at:
          this.t +
          (e.type === "thrower" ? 0.65 : e.type === "elite" ? 0.75 : 0.4),
        born: this.t,
        kind: e.type === "thrower" ? "throw" : "sword",
        angle: Math.atan2(dy, dx),
        facing: e.facing,
        range: d.range,
      };
      e.vx = 0;
      return;
    }
    const desired =
      e.type === "thrower" && Math.abs(dx) < 210
        ? -e.facing * d.speed
        : Math.abs(dx) > 45
          ? e.facing * d.speed
          : 0;
    e.vx = approach(e.vx, desired, 1600 * dt);
    const ahead = e.x + e.facing * 35,
      ground = surfaceBelow(ahead, e.y, this.platforms, 90);
    if (!ground) {
      e.vx = 0;
      return;
    }
    if (
      this.platforms.some(
        (s) =>
          !s.oneWay &&
          s.x < ahead + e.halfWidth &&
          s.x + s.width > ahead - e.halfWidth &&
          s.y < e.y + e.halfHeight &&
          s.y + s.height > e.y - e.halfHeight,
      )
    ) {
      e.vy = -580;
      e.grounded = false;
    }
  }
  tick(dt, input = {}) {
    if (this.mode !== "playing") return false;
    for (const k of [
      "jumpPressed",
      "dashPressed",
      "attackPressed",
      "finisherPressed",
    ])
      if (input[k] && !this.pending[k])
        this.pending[k] = {
          left: input.left,
          right: input.right,
          up: input.up,
          down: input.down,
        };
    this.magic.enqueue(input.elements || []);
    this.accumulator += Math.min(0.1, Math.max(0, dt));
    this.input = input;
    while (this.accumulator + 1e-9 >= PHYSICS.step) {
      this.accumulator = Math.max(0, this.accumulator - PHYSICS.step);
      if (this.hitstop > 0) {
        this.hitstop = Math.max(0, this.hitstop - PHYSICS.step);
        continue;
      }
      this.advance(PHYSICS.step, input);
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
      edges = this.pending;
    this.pending = {};
    const move = Number(Boolean(input.right)) - Number(Boolean(input.left));
    if (move && !p.attack) p.facing = move;
    if (edges.jumpPressed) {
      const outcome = jumpBody(p, this.t, this.platforms, edges.jumpPressed);
      if (outcome === "jump") {
        p.airCombo = 0;
        this.effect("jump", p.x, p.y + 26);
      }
    }
    if (edges.dashPressed) this.dash(edges.dashPressed);
    if (edges.finisherPressed) this.requestSword(edges.finisherPressed, true);
    if (input.attack || edges.attackPressed)
      this.requestSword(edges.attackPressed || input);
    this.magic.input();
    const dashing = p.dashUntil > this.t;
    if (dashing) {
      p.vx = p.facing * 620;
      p.vy = 0;
    } else if (this.t >= p.staggerUntil) {
      p.vx = approach(
        p.vx,
        move * 270 * (1 + p.speedBonus),
        (p.grounded ? (move ? 2400 : 3000) : 1550) * dt,
      );
      if (
        !input.jumpHeld &&
        this.t - (p.jumpStartedAt || -10) < 0.18 &&
        p.vy < -220
      )
        p.vy = -220;
      if (input.down && !p.grounded) p.vy = Math.min(1100, p.vy + 900 * dt);
    }
    const result = stepBody(p, dt, this.platforms, this.t, {
      gravity: dashing ? 0 : 1900,
    });
    p.x = Math.max(14, Math.min(WORLD.width - 14, p.x));
    if (result.landed) {
      p.airCombo = 0;
      if (p.airAttackLastAt > this.t - 0.5) {
        p.comboUntil = this.t + 0.2;
        p.comboIndex = 2;
      }
      if (p.jumpBufferedUntil >= this.t) {
        jumpBody(p, this.t, this.platforms, { down: p.bufferedJumpDown });
        this.effect("jump", p.x, p.y + 26);
      }
    }
    if (p.attack) {
      if (this.t >= p.attack.activeAt && !p.attack.executed) {
        if (p.attack.air) p.airAttackLastAt = this.t;
        this.executeSword(p.attack);
      }
      if (p.attack && this.t >= p.attack.endAt) {
        p.attack = null;
        if (p.attackBuffer) {
          const b = p.attackBuffer;
          p.attackBuffer = null;
          if (b.until >= this.t) this.requestSword(b.input, b.finisher);
        }
      }
    }
    this.magic.tick(dt);
    if (
      !p.attack &&
      !this.magic.cast &&
      p.attackBuffer &&
      p.dashUntil <= this.t
    ) {
      const b = p.attackBuffer;
      p.attackBuffer = null;
      if (b.until >= this.t) this.requestSword(b.input, b.finisher);
    }
    if (p.rechargeAt && this.t >= p.rechargeAt) {
      p.dashes = Math.min(2, p.dashes + 1);
      p.rechargeAt = p.dashes < 2 ? this.t + 2.3 : 0;
    }
    for (const e of this.enemies) {
      if (e.dead) continue;
      this.enemyTick(e, dt);
      const landed = stepBody(e, dt, this.platforms, this.t).landed;
      if (landed) {
        e.airJuggleHits = 0;
        e.relifts = 0;
        e.launchUntil = 0;
      }
      if (!e.grounded && e.launchUntil && this.t >= e.launchUntil) {
        e.launchImmuneUntil = this.t + 1.5;
        e.vy = Math.max(200, e.vy);
        e.launchUntil = 0;
      }
      if (e.y > 1400) e.dead = true;
    }
    for (const b of this.projectiles) {
      const steps = Math.ceil((Math.hypot(b.vx, b.vy) * dt) / 5);
      for (let i = 0; i < steps; i++) {
        const old = { x: b.x, y: b.y };
        b.x += (b.vx * dt) / steps;
        b.y += (b.vy * dt) / steps;
        if (!clearLine(old, b, this.platforms)) {
          b.life = 0;
          break;
        }
        if (overlap({ x: b.x, y: b.y, halfWidth: 5, halfHeight: 5 }, p)) {
          this.damage(b.owner, p, ENEMY_TYPES[b.owner.type].damage, b.id);
          b.life = 0;
          break;
        }
      }
      b.life -= dt;
    }
    this.projectiles = this.projectiles.filter((b) => b.life > 0);
    if (p.y > 1390) this.respawn();
    if (this.demo === "run") {
      if (p.grounded && p.x > 1030 && p.x < 1170)
        this.checkpoint = { id: "roof-gate", x: 1090, y: 974 };
      if (p.grounded && p.x > 3200 && p.x < 3400)
        this.checkpoint = { id: "inner-gate", x: 3300, y: 974 };
      if (
        this.t >= this.spawnAt &&
        this.enemies.filter((e) => !e.dead).length < 14
      ) {
        const x = Math.min(WORLD.width - 80, p.x + 380 + this.random() * 220);
        if (surfaceBelow(x, 700, this.platforms))
          this.spawn(
            ["guard", "runner", "thrower"][Math.floor(this.random() * 3)],
            x,
          );
        this.spawnAt = this.t + 6;
      }
    }
    this.enemies = this.enemies.filter((e) => !e.dead);
    this.effects = this.effects.filter((e) => this.t - e.born < e.life);
    this.numbers = this.numbers.filter((n) => this.t - n.born < 0.6);
    this.notifications = this.notifications.filter((n) => n.until > this.t);
    p.style = Math.max(0, p.style - dt * 1.2);
    if (
      this.xp >= this.xpRequired &&
      this.demo === "run" &&
      this.mode === "playing"
    ) {
      this.xp -= this.xpRequired;
      this.level++;
      this.xpRequired = 15 + this.level * 8;
      this.rewardChoices = ["health", "speed", "breath"];
      this.mode = "levelup";
    }
  }
  choose(i) {
    if (this.mode !== "levelup" || !this.rewardChoices[i]) return false;
    const r = this.rewardChoices[i];
    if (r === "health") {
      this.player.maxHP += 20;
      this.player.hp = Math.min(this.player.maxHP, this.player.hp + 40);
    }
    if (r === "speed")
      this.player.speedBonus = Math.min(0.25, this.player.speedBonus + 0.05);
    if (r === "breath") {
      this.player.dashes = 2;
      this.player.rechargeAt = 0;
      this.player.finisherAt = this.t;
    }
    this.mode = "playing";
    this.rewardChoices = [];
    return true;
  }
  snapshot() {
    const p = this.player;
    return {
      phase: "P3-A-C",
      mode: this.mode,
      time: this.t,
      demo: this.demo,
      checkpoint: { ...this.checkpoint },
      kills: this.kills,
      level: this.level,
      xp: this.xp,
      rewardChoices: [...this.rewardChoices],
      style: this.styleRank(),
      magic: this.magic.snapshot(),
      player: { ...p, received: undefined, evaded: undefined },
      enemies: this.enemies.map((e) => ({
        id: e.id,
        type: e.type,
        x: e.x,
        y: e.y,
        vx: e.vx,
        vy: e.vy,
        hp: e.hp,
        grounded: e.grounded,
        telegraph: e.telegraph,
        staggerMeter: e.staggerMeter,
        airJuggleHits: e.airJuggleHits,
        elements: e.elements,
      })),
      effects: this.effects.map((e) => ({ type: e.type, x: e.x, y: e.y })),
      projectiles: this.projectiles.map((b) => ({ x: b.x, y: b.y })),
    };
  }
}
