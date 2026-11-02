import {
  TUNING as T,
  HEROES,
  OFFENSES,
  SUPPORTS,
  ELEMENTS,
  ROOMS,
  OBSTACLES,
  REWARDS,
} from "./data.js";
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export class SafeStore {
  constructor(storage) {
    this.storage = storage;
    this.memory = new Map();
    this.persistent = true;
  }
  read(key, fallback) {
    try {
      const raw = this.memory.has(key)
        ? this.memory.get(key)
        : this.storage?.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      this.persistent = false;
      return fallback;
    }
  }
  write(key, value) {
    const raw = JSON.stringify(value);
    this.memory.set(key, raw);
    try {
      this.storage?.setItem(key, raw);
      if (!this.storage) this.persistent = false;
    } catch {
      this.persistent = false;
    }
  }
  remove(key) {
    this.memory.set(key, null);
    try {
      this.storage?.removeItem(key);
    } catch {
      this.persistent = false;
    }
  }
}
export class GalleryState {
  constructor(manifest, store) {
    this.entries = manifest.entries;
    this.store = store;
    const saved = store.read("kage-in.gallery.v1", {});
    this.unlocked = new Set(
      saved?.version === 1 && Array.isArray(saved.ids)
        ? saved.ids.filter((id) => this.entries.some((e) => e.id === id))
        : [],
    );
  }
  available(e, reveal = false) {
    return e.unlock === "default" || reveal || this.unlocked.has(e.id);
  }
  event(type, id) {
    if (!["rival.encountered", "rival.defeated"].includes(type)) return false;
    const entry = this.entries.find(
      (e) => e.id === id && e.unlock === `encounter:${id}`,
    );
    if (!entry || this.unlocked.has(id)) return false;
    this.unlocked.add(id);
    this.save();
    return true;
  }
  save() {
    this.store.write("kage-in.gallery.v1", {
      version: 1,
      ids: [...this.unlocked],
    });
  }
  reset() {
    this.unlocked.clear();
    this.save();
  }
}
export const RUN_KEY = "kage-in.v5.run.v1";
export class Run {
  constructor(heroId = "HERO_KARASU", supportId = "S01", seed = 20261102) {
    const hero = HEROES.find((h) => h.id === heroId);
    if (!hero) throw Error("Unknown hero");
    if (!SUPPORTS.some((s) => s.id === supportId))
      throw Error("Unknown support");
    this.version = 1;
    this.heroId = heroId;
    this.offenseId = hero.offense;
    this.supportId = supportId;
    this.seed = seed >>> 0;
    this.serial = 0;
    this.t = 0;
    this.accumulator = 0;
    this.mode = "hub";
    this.roomIndex = 0;
    this.roomId = "gate";
    this.kills = 0;
    this.player = {
      x: 220,
      y: 405,
      hp: hero.hp,
      maxHP: hero.hp,
      face: 0,
      dashAt: 0,
      dashUntil: 0,
      invulnerableUntil: 0,
      hurtUntil: 0,
      eAt: 0,
      sAt: 0,
      gauge: 0,
      element: null,
      attack: null,
      nextAttack: 0,
      combo: 0,
      comboUntil: 0,
      dashDirection: 0,
    };
    this.ranks = { power: 0, health: 0, haste: 0 };
    this.enemies = [];
    this.effects = [];
    this.scheduled = [];
    this.cloneUntil = 0;
    this.zone = null;
    this.message = "";
    this.messageUntil = 0;
    this.timePlayed = 0;
    this.hits = 0;
  }
  random() {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  nextId() {
    return ++this.serial;
  }
  notify(text) {
    this.message = text;
    this.messageUntil = this.t + 2.8;
  }
  get hero() {
    return HEROES.find((h) => h.id === this.heroId);
  }
  get room() {
    return ROOMS.find((r) => r.id === this.roomId);
  }
  enter(id = this.roomId) {
    const room = ROOMS.find((r) => r.id === id);
    if (!room) return false;
    this.roomId = id;
    this.roomIndex++;
    this.mode = "combat";
    this.player.x = 220;
    this.player.y = 405;
    this.player.attack = null;
    this.player.hurtUntil = this.t + 0.6;
    this.enemies = [];
    this.effects = [];
    this.scheduled = [];
    this.cloneUntil = 0;
    this.zone = null;
    if (id === "rest") {
      this.player.hp = Math.min(
        this.player.maxHP,
        this.player.hp + this.player.maxHP * 0.35,
      );
      this.mode = "doors";
      this.notify("따뜻하다. 쇼군도 이 맛을 알까?");
      return true;
    }
    for (let i = 0; i < room.enemies; i++) {
      const boss = room.boss;
      this.enemies.push({
        id: this.nextId(),
        x: boss ? 1050 : 720 + this.random() * 450,
        y: boss ? 405 : 160 + this.random() * 470,
        hp: boss ? 900 : 90,
        maxHP: boss ? 900 : 90,
        radius: boss ? 38 : 18,
        boss,
        dead: false,
        attackAt: this.t + 1 + this.random(),
        telegraph: null,
        hurtUntil: 0,
        slowUntil: 0,
        stunUntil: 0,
        burnUntil: 0,
        burnAt: 0,
        received: [],
      });
    }
    this.notify(
      room.boss
        ? "문지기: 초대장은? …철퇴는 초대장이 아니지!"
        : "검병의 붉은 전조가 끝나기 전에 피하세요.",
    );
    return true;
  }
  valid(x, y, r = 16) {
    return (
      x >= 80 + r &&
      x <= 1360 - r &&
      y >= 110 + r &&
      y <= 720 - r &&
      !OBSTACLES.some(
        (o) =>
          x + r > o.x && x - r < o.x + o.w && y + r > o.y && y - r < o.y + o.h,
      )
    );
  }
  move(body, dx, dy, r = 16) {
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 8));
    for (let i = 0; i < steps; i++) {
      if (this.valid(body.x + dx / steps, body.y, r)) body.x += dx / steps;
      if (this.valid(body.x, body.y + dy / steps, r)) body.y += dy / steps;
    }
  }
  fx(type, x, y, extra = {}) {
    if (this.effects.length < T.maxEffects)
      this.effects.push({ type, x, y, born: this.t, life: 0.35, ...extra });
  }
  queueAttack(kind, face) {
    const p = this.player;
    if (p.attack || p.dashUntil > this.t) return false;
    const g = this.heroId === "HERO_GORO",
      k = this.heroId === "HERO_KITSUNE";
    const primary = kind === "primary";
    if (primary && p.nextAttack > this.t) return false;
    if (kind === "active" && p.eAt > this.t) {
      this.notify("E 재사용 대기 중");
      return false;
    }
    const cadence =
        (g ? 0.78 : k ? 0.27 : 0.33) / (1 + this.ranks.haste * 0.08),
      windup = g ? 0.25 : k ? 0.045 : 0.075;
    if (primary) {
      p.combo = this.t < p.comboUntil ? (p.combo % (k ? 4 : g ? 3 : 5)) + 1 : 1;
      p.comboUntil = this.t + 1.1;
      p.nextAttack = this.t + cadence;
    } else {
      p.eAt = this.t + 6;
    }
    p.attack = {
      id: this.nextId(),
      kind,
      face,
      at: this.t + windup,
      until: this.t + (primary ? cadence : g ? 0.8 : 0.65),
      resolved: false,
      combo: p.combo,
    };
    return true;
  }
  hit(enemy, damage, id, element = null, knock = 20, gauge = true) {
    if (enemy.dead || enemy.received.includes(id)) return false;
    enemy.received.push(id);
    if (enemy.received.length > 80) enemy.received.shift();
    enemy.hp -= damage * (1 + this.ranks.power * 0.12);
    enemy.hurtUntil = this.t + 0.12;
    this.hits++;
    if (gauge)
      this.player.gauge = Math.min(
        T.gaugeMax,
        this.player.gauge + T.gaugePerHit,
      );
    const angle = Math.atan2(enemy.y - this.player.y, enemy.x - this.player.x);
    this.move(
      enemy,
      Math.cos(angle) * knock,
      Math.sin(angle) * knock,
      enemy.radius,
    );
    if (element === "fire") {
      enemy.burnUntil = this.t + 3;
      enemy.burnAt = this.t + 0.5;
    }
    if (element === "water") enemy.slowUntil = this.t + 3;
    if (element === "lightning")
      enemy.stunUntil = this.t + (enemy.boss ? 0.12 : 0.6);
    if (element === "wind")
      this.move(
        enemy,
        Math.cos(angle) * 45,
        Math.sin(angle) * 45,
        enemy.radius,
      );
    this.fx("hit", enemy.x, enemy.y, {
      text: String(Math.round(damage * (1 + this.ranks.power * 0.12))),
      color: element
        ? ELEMENTS.find((e) => e.id === element)?.color
        : this.hero.color,
    });
    if (enemy.hp <= 0) {
      enemy.dead = true;
      this.kills++;
      this.fx("death", enemy.x, enemy.y, { life: 0.6 });
    }
    return true;
  }
  strike(attack, origin = this.player, scale = 1, secondary = false) {
    const g = this.heroId === "HERO_GORO",
      k = this.heroId === "HERO_KITSUNE",
      active = attack.kind === "active";
    const range = g ? (active ? 190 : 135) : k ? 105 : 130,
      cone = g ? 1.3 : k ? 1 : 1.05;
    this.fx("slash", origin.x, origin.y, {
      face: attack.face,
      range,
      color: this.hero.color,
      life: g ? 0.3 : 0.17,
      heavy: g,
      combo: attack.combo,
    });
    let consumed = false;
    for (const e of this.enemies) {
      const angle = Math.atan2(e.y - origin.y, e.x - origin.x);
      const delta = Math.abs(
        Math.atan2(
          Math.sin(angle - attack.face),
          Math.cos(angle - attack.face),
        ),
      );
      if (
        distance(origin, e) < range + e.radius &&
        delta < cone &&
        this.clearLine(origin, e)
      ) {
        const element = !secondary && !consumed ? this.player.element : null;
        if (
          this.hit(
            e,
            (g ? 46 : k ? 12 : 21) * (active ? (g ? 2 : 1) : 1) * scale,
            attack.id,
            element,
            g ? 45 : 12,
            !secondary,
          )
        ) {
          if (element) {
            consumed = true;
            this.player.element = null;
          }
        }
      }
    }
    if (!secondary && this.cloneUntil > this.t) {
      const clone = {
        x: origin.x - Math.sin(attack.face) * 36,
        y: origin.y + Math.cos(attack.face) * 36,
      };
      this.strike({ ...attack, id: this.nextId() }, clone, 0.45, true);
    }
  }
  clearLine(a, b) {
    const n = Math.max(1, Math.ceil(distance(a, b) / 8));
    for (let i = 1; i < n; i++) {
      const x = a.x + ((b.x - a.x) * i) / n,
        y = a.y + ((b.y - a.y) * i) / n;
      if (
        OBSTACLES.some(
          (o) => x > o.x && x < o.x + o.w && y > o.y && y < o.y + o.h,
        )
      )
        return false;
    }
    return true;
  }
  support(aim) {
    const p = this.player,
      s = SUPPORTS.find((s) => s.id === this.supportId);
    if (p.sAt > this.t) {
      this.notify("지원 인술 재사용 대기 중");
      return false;
    }
    if (p.dashUntil > this.t) return false;
    p.sAt = this.t + s.cooldown;
    const a = Math.atan2(aim.y - p.y, aim.x - p.x),
      dest = { x: p.x, y: p.y };
    this.move(
      dest,
      Math.cos(a) * Math.min(220, distance(p, aim)),
      Math.sin(a) * Math.min(220, distance(p, aim)),
    );
    if (s.id === "S01") {
      this.cloneUntil = this.t + 4;
      this.fx("clone", p.x, p.y, { life: 4 });
    }
    if (s.id === "S02") {
      const id = this.nextId();
      for (const e of this.enemies)
        if (distance(e, dest) < 190) {
          const d = distance(e, dest) || 1;
          this.move(
            e,
            ((dest.x - e.x) / d) * 70,
            ((dest.y - e.y) / d) * 70,
            e.radius,
          );
          e.slowUntil = this.t + (e.boss ? 0.5 : 2);
          this.hit(e, 8, id, null, 0);
        }
      this.fx("chains", dest.x, dest.y, { life: 0.7, range: 190 });
    }
    if (s.id === "S03") {
      p.x = dest.x;
      p.y = dest.y;
      this.fx("teleport", p.x, p.y, { life: 0.6 });
    }
    if (s.id === "S04") {
      this.zone = { x: dest.x, y: dest.y, until: this.t + 4, radius: 155 };
      this.fx("zone", dest.x, dest.y, { range: 155, life: 4 });
    }
    this.notify(s.active);
    return true;
  }
  dash(input) {
    const p = this.player;
    if (p.dashAt > this.t) return false;
    p.attack = null;
    this.scheduled = [];
    p.dashDirection = Math.hypot(input.x, input.y)
      ? Math.atan2(input.y, input.x)
      : p.face;
    p.dashUntil = this.t + T.dashDuration;
    p.invulnerableUntil = this.t + T.dashInvulnerability;
    p.dashAt = this.t + T.dashRecharge;
    this.fx("dash", p.x, p.y, { life: 0.3 });
    return true;
  }
  damagePlayer(amount, id) {
    const p = this.player;
    if (p.invulnerableUntil > this.t) {
      this.notify("회피 성공");
      this.fx("evade", p.x, p.y);
      return false;
    }
    if (p.hurtUntil > this.t) return false;
    p.hp = Math.max(0, p.hp - amount);
    p.hurtUntil = this.t + 0.6;
    this.fx("hurt", p.x, p.y, { life: 0.3 });
    if (!p.hp) {
      this.mode = "dead";
      p.attack = null;
      this.scheduled = [];
    }
    return true;
  }
  tick(dt, input = {}) {
    if (this.mode !== "combat") return;
    this.accumulator += clamp(dt, 0, 0.1);
    let first = true;
    while (this.accumulator >= T.step) {
      this.step({
        ...input,
        dash: first && input.dash,
        active: first && input.active,
        support: first && input.support,
        fusion: first && input.fusion,
        element: first ? input.element : undefined,
      });
      this.accumulator -= T.step;
      first = false;
      if (this.mode !== "combat") break;
    }
  }
  step(input) {
    this.t += T.step;
    this.timePlayed += T.step;
    const p = this.player;
    if (input.element !== undefined && ELEMENTS[input.element])
      p.element = ELEMENTS[input.element].id;
    const aim = input.aim || {
      x: p.x + Math.cos(p.face) * 100,
      y: p.y + Math.sin(p.face) * 100,
    };
    if (distance(p, aim) > 2 && !p.attack)
      p.face = Math.atan2(aim.y - p.y, aim.x - p.x);
    let x = input.x || 0,
      y = input.y || 0;
    const n = Math.hypot(x, y) || 1;
    x /= n;
    y /= n;
    if (input.dash) this.dash({ x, y });
    if (p.dashUntil > this.t)
      this.move(
        p,
        Math.cos(p.dashDirection) * T.dashSpeed * T.step,
        Math.sin(p.dashDirection) * T.dashSpeed * T.step,
      );
    else
      this.move(
        p,
        x * T.speed * T.step * (p.attack?.kind === "active" ? 0.6 : 1),
        y * T.speed * T.step * (p.attack?.kind === "active" ? 0.6 : 1),
      );
    if (input.support) this.support(aim);
    if (input.fusion)
      this.notify(
        "Q 고유 합성은 다음 단계 구현 예정 · 게이지는 타격으로 충전됩니다.",
      );
    if (input.active) this.queueAttack("active", p.face);
    else if (input.attack) this.queueAttack("primary", p.face);
    if (p.attack && !p.attack.resolved && this.t >= p.attack.at) {
      p.attack.resolved = true;
      this.strike(p.attack);
      if (p.attack.kind === "active" && this.heroId !== "HERO_GORO") {
        const total = this.heroId === "HERO_KITSUNE" ? 9 : 7;
        for (let i = 1; i < total; i++)
          this.scheduled.push({
            at: this.t + i * 0.065,
            attack: { ...p.attack, id: this.nextId() },
          });
      }
    }
    if (p.attack && this.t >= p.attack.until) p.attack = null;
    for (const q of this.scheduled.filter((q) => q.at <= this.t)) {
      if (this.heroId === "HERO_KARASU")
        this.move(p, Math.cos(q.attack.face) * 9, Math.sin(q.attack.face) * 9);
      this.strike(q.attack);
    }
    this.scheduled = this.scheduled.filter((q) => q.at > this.t);
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (e.burnUntil > this.t && e.burnAt <= this.t) {
        e.burnAt = this.t + 0.5;
        this.hit(e, 3, this.nextId(), null, 0, false);
      }
      if (e.dead) continue;
      if (e.telegraph) {
        if (this.t >= e.telegraph.at) {
          const hit = e.telegraph;
          if (distance(p, hit) < hit.radius)
            this.damagePlayer(e.boss ? 28 : 12, hit.id);
          this.fx("enemySlash", hit.x, hit.y, {
            range: hit.radius,
            life: 0.25,
          });
          e.telegraph = null;
          e.attackAt = this.t + (e.boss ? 1.5 : 1.1);
        }
        continue;
      }
      if (e.stunUntil > this.t) continue;
      const d = distance(e, p),
        range = e.boss ? 155 : 58;
      if (d < range && this.t >= e.attackAt) {
        e.telegraph = {
          id: this.nextId(),
          x: e.x,
          y: e.y,
          at: this.t + (e.boss ? 0.95 : 0.65),
          radius: range + 15,
        };
        continue;
      }
      if (d > 40) {
        const slow =
          e.slowUntil > this.t ||
          (this.zone?.until > this.t &&
            distance(e, this.zone) < this.zone.radius);
        const speed = (e.boss ? 95 : 105) * (slow ? 0.45 : 1);
        this.move(
          e,
          ((p.x - e.x) / d) * speed * T.step,
          ((p.y - e.y) / d) * speed * T.step,
          e.radius,
        );
      }
    }
    this.effects = this.effects.filter((e) => e.born + e.life > this.t);
    this.enemies = this.enemies.filter((e) => !e.dead);
    if (this.mode === "combat" && !this.enemies.length) {
      this.mode = this.room.boss ? "victory" : "reward";
      this.player.attack = null;
      this.scheduled = [];
    }
  }
  reward(id) {
    if (this.mode !== "reward") return false;
    const r = REWARDS.find((r) => r.id === id);
    if (!r || this.ranks[id] >= r.cap) return false;
    this.ranks[id]++;
    if (id === "health") {
      this.player.maxHP += 15;
      this.player.hp = Math.min(this.player.maxHP, this.player.hp + 25);
    }
    this.mode = "doors";
    return true;
  }
  save(store) {
    store.write(RUN_KEY, this.snapshot());
  }
  snapshot() {
    return JSON.parse(
      JSON.stringify({
        version: this.version,
        heroId: this.heroId,
        offenseId: this.offenseId,
        supportId: this.supportId,
        seed: this.seed,
        serial: this.serial,
        t: this.t,
        mode: this.mode,
        roomIndex: this.roomIndex,
        roomId: this.roomId,
        kills: this.kills,
        player: this.player,
        ranks: this.ranks,
        enemies: this.enemies,
        scheduled: this.scheduled,
        cloneUntil: this.cloneUntil,
        zone: this.zone,
        timePlayed: this.timePlayed,
        hits: this.hits,
      }),
    );
  }
  static restore(raw) {
    try {
      if (
        raw?.version !== 1 ||
        !HEROES.some((h) => h.id === raw.heroId) ||
        !SUPPORTS.some((s) => s.id === raw.supportId) ||
        !ROOMS.some((r) => r.id === raw.roomId) ||
        !["hub", "combat", "reward", "doors"].includes(raw.mode)
      )
        return null;
      const p = raw.player;
      const finite = (v) => typeof v === "number" && Number.isFinite(v);
      if (
        !p ||
        ![
          "x",
          "y",
          "hp",
          "maxHP",
          "face",
          "dashAt",
          "dashUntil",
          "invulnerableUntil",
          "hurtUntil",
          "eAt",
          "sAt",
          "gauge",
          "nextAttack",
          "combo",
          "comboUntil",
          "dashDirection",
        ].every((k) => finite(p[k])) ||
        p.hp <= 0 ||
        p.hp > p.maxHP ||
        p.maxHP > 1000 ||
        !Array.isArray(raw.enemies) ||
        raw.enemies.length > T.maxEnemies
      )
        return null;
      if (
        ![
          "t",
          "seed",
          "serial",
          "roomIndex",
          "kills",
          "timePlayed",
          "hits",
          "cloneUntil",
        ].every((k) => finite(raw[k]) && raw[k] >= 0) ||
        !raw.ranks ||
        !REWARDS.every(
          (r) =>
            Number.isInteger(raw.ranks[r.id]) &&
            raw.ranks[r.id] >= 0 &&
            raw.ranks[r.id] <= r.cap,
        )
      )
        return null;
      if (
        raw.enemies.some(
          (e) =>
            !e ||
            ![
              "id",
              "x",
              "y",
              "hp",
              "maxHP",
              "radius",
              "attackAt",
              "hurtUntil",
              "slowUntil",
              "stunUntil",
              "burnUntil",
              "burnAt",
            ].every((k) => finite(e[k])) ||
            !Array.isArray(e.received) ||
            e.received.length > 80 ||
            e.hp <= 0 ||
            e.maxHP <= 0 ||
            e.hp > e.maxHP ||
            e.maxHP > 10000 ||
            e.radius < 1 ||
            e.radius > 100 ||
            (e.telegraph &&
              !["id", "x", "y", "at", "radius"].every((k) =>
                finite(e.telegraph[k]),
              )),
        )
      )
        return null;
      if (
        raw.zone &&
        (!["x", "y", "until", "radius"].every((k) => finite(raw.zone[k])) ||
          raw.zone.radius < 1 ||
          raw.zone.radius > 300)
      )
        return null;
      const run = new Run(raw.heroId, raw.supportId, raw.seed);
      if (!run.valid(p.x, p.y)) return null;
      // Only known state fields are copied. In-flight attacks are cancelled on resume.
      for (const k of [
        "serial",
        "t",
        "mode",
        "roomIndex",
        "roomId",
        "kills",
        "ranks",
        "enemies",
        "timePlayed",
        "hits",
        "cloneUntil",
      ])
        run[k] = structuredClone(raw[k]);
      run.player = { ...run.player, ...structuredClone(p), attack: null };
      run.player.element = ELEMENTS.some((e) => e.id === p.element)
        ? p.element
        : null;
      run.player.hurtUntil = run.t + 0.5;
      run.scheduled = [];
      run.zone = raw.zone ? structuredClone(raw.zone) : null;
      return run;
    } catch {
      return null;
    }
  }
}
