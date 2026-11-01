import {
  SKILLS,
  CORE_IDS,
  ACTIVE_RECIPES,
  COLORS,
  availableRecipes,
  connections,
  rewardCandidates,
} from "./data.js";
import {
  Actor,
  Combat,
  distance,
  segmentDistance,
  loadDeaths,
  saveDeath,
  createHunter,
  hunterPlan,
  lineOfSight,
  findPath,
} from "./core.js";
const $ = (id) => document.getElementById(id),
  canvas = $("game"),
  ctx = canvas.getContext("2d");
const icons = { A01: "╱", M01: "ϟ", S01: "◇", D03: "♢", D01: "⊕", C02: "◎" };
const rooms = [
  { x: 80, y: 100, w: 680, h: 520, name: "기억의 입구" },
  { x: 920, y: 100, w: 680, h: 520, name: "망각의 제단" },
  { x: 1760, y: 100, w: 680, h: 520, name: "마지막 잔향" },
];
const halls = [
  { x: 760, y: 300, w: 160, h: 120 },
  { x: 1600, y: 300, w: 160, h: 120 },
];
const pillars = [
  { x: 320, y: 255, w: 64, h: 90 },
  { x: 550, y: 430, w: 65, h: 65 },
  { x: 1130, y: 240, w: 65, h: 80 },
  { x: 1390, y: 430, w: 64, h: 65 },
  { x: 1970, y: 255, w: 64, h: 90 },
  { x: 2210, y: 430, w: 65, h: 65 },
];
let storageOK = true;
let memoryStorage = new Map();
const storage = {
  getItem: (key) => {
    try {
      return localStorage.getItem(key);
    } catch {
      storageOK = false;
      return memoryStorage.get(key) || null;
    }
  },
  setItem: (key, value) => {
    memoryStorage.set(key, value);
    try {
      localStorage.setItem(key, value);
    } catch {
      storageOK = false;
    }
  },
};
let deaths = loadDeaths(storage),
  player,
  hunter,
  enemies = [],
  effects = [],
  numbers = [],
  zones = [],
  clones = [],
  t = 0,
  mode = "intro",
  runID,
  visited = new Set(),
  cleared = new Set(),
  kills = 0,
  runSeconds = 0,
  cam = { x: 0, y: 0 },
  mouse = { x: 560, y: 340, down: false },
  keys = new Set(),
  lastFrame = 0,
  toastUntil = 0,
  hunterSpawnAt = 28,
  warningUntil = 0,
  soundOn = false,
  audio,
  roomIndex = 0,
  noisePoint = null,
  nextEnemy = 0,
  previousMode = "playing",
  cause = "기억의 잔해",
  pausedPlan = null;
function inRect(x, y, r, pad = 0) {
  return (
    x > r.x + pad && x < r.x + r.w - pad && y > r.y + pad && y < r.y + r.h - pad
  );
}
function walkable(x, y, radius = 0) {
  return (
    [...rooms, ...halls].some((r) => inRect(x, y, r, -(radius ? 0 : 0))) &&
    (!radius ||
      [
        [radius, 0],
        [-radius, 0],
        [0, radius],
        [0, -radius],
      ].every(([dx, dy]) =>
        [...rooms, ...halls].some((r) => inRect(x + dx, y + dy, r)),
      )) &&
    !pillars.some((r) =>
      inRect(x, y, {
        x: r.x - radius,
        y: r.y - radius,
        w: r.w + 2 * radius,
        h: r.h + 2 * radius,
      }),
    )
  );
}
function move(actor, dx, dy) {
  const n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 8));
  for (let i = 0; i < n; i++) {
    if (walkable(actor.x + dx / n, actor.y, 13)) actor.x += dx / n;
    if (walkable(actor.x, actor.y + dy / n, 13)) actor.y += dy / n;
  }
  return { x: actor.x, y: actor.y };
}
function enemiesOf(actor) {
  return actor.id === "player"
    ? [...enemies, ...(hunter && !hunter.dead ? [hunter] : [])].filter(
        (e) => !e.dead,
      )
    : player && !player.dead
      ? [player]
      : [];
}
const world = {
  targets: enemiesOf,
  move,
  effect: (e) => effects.push({ ...e, born: t }),
  number: (target, amount) =>
    numbers.push({
      x: target.x,
      y: target.y - 25,
      text: Math.round(amount),
      born: t,
      player: target === player,
    }),
  noise: (actor, radius) => {
    if (actor === player)
      noisePoint = { x: actor.x, y: actor.y, radius, until: t + 2 };
  },
  addZone: (z) => zones.push(z),
  summon: (actor, data) =>
    clones.push({ ...data, owner: actor, nextAttack: t + 0.25 }),
  death: (target, source) => {
    if (target === player) {
      cause =
        source?.id === "hunter"
          ? "과거의 자신"
          : source?.elite
            ? "정예 잔해"
            : "기억의 잔해";
      finishDeath();
    } else if (target === hunter) {
      notify("기억 강탈", "PAST SELF DEFEATED");
      beep(260, 0.4);
      hunter.combo.interrupt("death");
      queueMicrotask(() => {
        if (mode === "playing") hunterReward();
      });
    } else {
      kills++;
      beep(150, 0.05);
      effects.push({
        type: "death",
        x: target.x,
        y: target.y,
        born: t,
        life: 0.45,
      });
    }
  },
};
const combat = new Combat(world);
function bindActor(actor) {
  actor.bus.on("ResonanceTriggered", ({ recipe }) => {
    combat.resonance(actor, recipe, t);
    if (actor === player) {
      notify(
        recipe.name,
        recipe.type === "advanced"
          ? "ADVANCED RESONANCE // CONFIRMED"
          : "RESONANCE // CONFIRMED",
      );
      beep(recipe.type === "advanced" ? 660 : 440, 0.25);
    }
  });
}
function beep(freq = 440, duration = 0.1) {
  if (!soundOn) return;
  try {
    audio ??= new AudioContext();
    const o = audio.createOscillator(),
      g = audio.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(freq, audio.currentTime);
    o.frequency.exponentialRampToValueAtTime(
      freq * 0.55,
      audio.currentTime + duration,
    );
    g.gain.setValueAtTime(0.07, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
    o.connect(g).connect(audio.destination);
    o.start();
    o.stop(audio.currentTime + duration);
  } catch {}
}
function notify(name, sub = "") {
  const toast = $("toast");
  toast.replaceChildren();
  const b = document.createElement("b"),
    span = document.createElement("span");
  b.textContent = name;
  span.textContent = sub;
  toast.append(b, span);
  toast.classList.remove("hidden");
  toastUntil = t + 2.4;
}
function modal(content) {
  keys.clear();
  mouse.down = false;
  $("overlay").innerHTML = `<div class="modal">${content}</div>`;
  $("overlay").classList.remove("hidden");
}
function resume() {
  mode = "playing";
  $("overlay").classList.add("hidden");
  canvas.focus();
}
function init() {
  t = 0;
  kills = 0;
  runSeconds = 0;
  roomIndex = 0;
  visited = new Set();
  cleared = new Set();
  effects = [];
  numbers = [];
  zones = [];
  clones = [];
  enemies = [];
  hunter = null;
  noisePoint = null;
  warningUntil = 0;
  toastUntil = 0;
  nextEnemy = 0;
  cam = { x: 0, y: 0 };
  runID = crypto.randomUUID();
  deaths = loadDeaths(storage);
  player = new Actor({ x: 180, y: 360, skills: [] });
  bindActor(player);
  mode = "reward";
  $("run-number").textContent =
    `RUN ${String(deaths.length + 1).padStart(3, "0")}`;
  $("phase-label").textContent = "MEMORY CONNECTED";
  $("hunter-warning").classList.add("hidden");
  $("toast").classList.add("hidden");
  chooseSkill(
    "최초의 기억",
    "세 가지 기억 중 하나를 선택하세요. 첫 방을 정리하며 빌드를 완성합니다.",
    ["A01", "M01", "D03"],
    () => {
      resume();
      spawnRoom(0);
    },
  );
  updateHUD();
}
function card(id) {
  const s = SKILLS[id],
    links = connections(id, player.skills);
  return `<button class="card" data-skill="${id}" style="--skill-color:${COLORS[s.tags[0]]}"><span class="skill-icon">${icons[id]}</span><strong>${s.name}</strong><small>${s.category} / ${s.cooldown} SEC</small><p>${s.description}</p><span class="link">${links.length ? links.map((r) => `${r.type === "advanced" ? "상급 · " : ""}${r.name}${r.sequence.every((x) => [...player.skills, id].includes(x)) ? " 완성 가능" : ""}`).join("<br>") : "새로운 연계의 시작"}</span></button>`;
}
function chooseSkill(title, description, candidates, done = resume) {
  mode = "reward";
  modal(
    `<div class="eyebrow">MEMORY ACQUISITION</div><h2>${title}</h2><p>${description}</p><div class="cards">${candidates.map(card).join("")}</div>`,
  );
  for (const button of $("overlay").querySelectorAll("[data-skill]"))
    button.onclick = () => {
      const id = button.dataset.skill;
      if (player.skills.length < 3) {
        player.equip(id, player.skills.length);
        done();
        updateHUD();
      } else {
        modal(
          `<div class="eyebrow">REPLACE MEMORY</div><h2>어떤 기억을 놓아줄까요?</h2><p>${SKILLS[id].name}을 장착할 슬롯을 선택하세요.</p><div class="replace-row">${player.skills.map((old, i) => `<button data-slot="${i}"><kbd>${["Q", "E", "F"][i]}</kbd> ${SKILLS[old].name}</button>`).join("")}</div><button id="cancel-replace">다시 선택</button>`,
        );
        for (const b of $("overlay").querySelectorAll("[data-slot]"))
          b.onclick = () => {
            player.equip(id, Number(b.dataset.slot));
            done();
            updateHUD();
          };
        $("cancel-replace").onclick = () =>
          chooseSkill(title, description, candidates, done);
      }
    };
}
function spawnRoom(index) {
  if (visited.has(index)) return;
  visited.add(index);
  const r = rooms[index];
  for (let i = 0; i < 4 + index * 2; i++) {
    let pos;
    do {
      pos = {
        x: r.x + 220 + Math.random() * (r.w - 270),
        y: r.y + 65 + Math.random() * (r.h - 130),
      };
    } while (!walkable(pos.x, pos.y, 24) || distance(pos, player) < 170);
    const e = new Actor({
      id: `enemy-${nextEnemy++}`,
      ...pos,
      hp: index === 1 && i === 0 ? 115 : 60 + index * 12,
    });
    Object.assign(e, {
      room: index,
      speed: 55 + index * 9,
      elite: index === 1 && i === 0,
      nextAttack: t + 1,
      windup: 0,
      path: [],
      pathAt: 0,
    });
    enemies.push(e);
  }
  notify(
    index === 0 ? "기억의 입구" : r.name,
    `SECTOR 0${index + 1} // HOSTILE SIGNALS`,
  );
}
function finishDeath() {
  if (mode === "dead") return;
  mode = "dead";
  saveDeath(storage, player, { runID, floor: roomIndex + 1, cause });
  deaths = loadDeaths(storage);
  updateArchive();
  modal(
    `<div class="eyebrow">DEATH ARCHIVED // ${storageOK ? "LOCAL STORAGE" : "SESSION ONLY"}</div><h2>당신은 이제 <em>기억</em>이다.</h2><p>${cause}에 의해 쓰러졌습니다.<br>남겨진 스킬과 성공한 공명은 다음 회차에서 당신을 추적합니다.${storageOK ? "" : "<br>브라우저 저장이 차단되어 이 탭에서만 기억됩니다."}</p><div class="stats"><span><b>${kills}</b>처치</span><span><b>${Object.keys(player.comboCounts).length}</b>발견한 공명</span><span><b>${Math.floor(runSeconds)}s</b>생존 시간</span></div><button class="primary" id="restart">다음 기억으로 →</button>`,
  );
  $("restart").onclick = init;
}
function hunterReward() {
  const ids = hunter.record.equippedSkillIDs.filter(
    (id) => !player.skills.includes(id),
  );
  if (ids.length) {
    chooseSkill(
      "과거로부터의 계승",
      "쓰러뜨린 추적자의 실제 기억에서 스킬을 계승합니다.",
      ids,
      () => {
        player.hp = Math.min(player.maxHp, player.hp + 25);
        resume();
      },
    );
  } else {
    mode = "reward";
    const known = hunter.record.successfulResonanceIDs
      .map((id) => ACTIVE_RECIPES.find((r) => r.id === id))
      .filter(Boolean);
    modal(
      `<div class="eyebrow">MEMORY RECLAIMED</div><h2>기억의 생명력</h2><p>추적자의 스킬을 이미 모두 보유하고 있습니다.<br>기억을 흡수해 최대 체력 +20, 체력 40을 회복합니다.${known.length ? "<br>과거의 공명: " + known.map((r) => r.name).join(" · ") : ""}</p><button id="claim" class="primary">기억 흡수</button>`,
    );
    $("claim").onclick = () => {
      player.maxHp += 20;
      player.hp = Math.min(player.maxHp, player.hp + 40);
      resume();
    };
  }
}
function basicAttack(actor, angle, heavy = false) {
  if (t < actor.attackAt || actor.dead) return;
  actor.attackAt = t + (heavy ? 0.9 : 0.32);
  if (actor === player) actor.stats.attacks++;
  world.noise(actor, heavy ? 400 : 270);
  effects.push({
    type: heavy ? "heavy" : "slash",
    x: actor.x,
    y: actor.y,
    angle,
    born: t,
    life: 0.18,
  });
  enemiesOf(actor)
    .filter(
      (e) =>
        distance(actor, e) < (heavy ? 130 : 102) &&
        Math.abs(
          Math.atan2(
            Math.sin(Math.atan2(e.y - actor.y, e.x - actor.x) - angle),
            Math.cos(Math.atan2(e.y - actor.y, e.x - actor.x) - angle),
          ),
        ) < (heavy ? 1.5 : 1.1),
    )
    .forEach((e) => combat.damage(actor, e, heavy ? 24 : 15, t));
  beep(heavy ? 130 : 200, 0.06);
}
function dash() {
  if (mode !== "playing" || player.dashes < 1) return;
  let dx = Number(keys.has("d")) - Number(keys.has("a")),
    dy = Number(keys.has("s")) - Number(keys.has("w"));
  if (!dx && !dy) {
    const a = aim();
    dx = Math.cos(a);
    dy = Math.sin(a);
  }
  const len = Math.hypot(dx, dy);
  player.dashes--;
  if (!player.dashRecharge) player.dashRecharge = t + 2.5;
  player.invulnerableUntil = t + 0.28;
  player.stats.dashes++;
  const from = { x: player.x, y: player.y };
  move(player, (dx / len) * 125, (dy / len) * 125);
  effects.push({
    type: "dash",
    x: from.x,
    y: from.y,
    end: { x: player.x, y: player.y },
    born: t,
    life: 0.3,
  });
  beep(300, 0.08);
}
function aim() {
  if (!player) return 0;
  return Math.atan2(mouse.y + cam.y - player.y, mouse.x + cam.x - player.x);
}
function follow(actor, target, dt, speed) {
  if (lineOfSight(actor, target, (x, y) => walkable(x, y, 15))) {
    const d = distance(actor, target);
    if (d > 5)
      move(
        actor,
        ((target.x - actor.x) / d) * speed * dt,
        ((target.y - actor.y) / d) * speed * dt,
      );
    return;
  }
  if (t > (actor.pathAt || 0)) {
    actor.path = findPath(actor, target, (x, y) => walkable(x, y, 14));
    actor.pathAt = t + 0.7;
  }
  while (actor.path?.length && distance(actor, actor.path[0]) < 13)
    actor.path.shift();
  const point = actor.path?.[0];
  if (point) {
    const d = distance(actor, point);
    move(
      actor,
      ((point.x - actor.x) / d) * speed * dt,
      ((point.y - actor.y) / d) * speed * dt,
    );
  }
}
function updateHunter(dt) {
  if (!hunter || hunter.dead) return;
  const h = hunter;
  if (t < (h.stunnedUntil || 0)) {
    h.plan = [];
    h.telegraph = null;
    return;
  }
  const d = distance(h, player),
    sight = d < 430 && lineOfSight(h, player, walkable);
  if (sight) {
    h.lastSeen = { x: player.x, y: player.y };
    h.lostAt = t;
  }
  if (h.state === "Retreat") {
    h.combo.interrupt("retreat");
    h.plan = [];
    follow(h, { x: rooms[2].x + 400, y: rooms[2].y + 260 }, dt, h.speed * 1.35);
    if (t > h.stateUntil) {
      h.state = "Recover";
      h.stateUntil = t + 3;
    }
    return;
  }
  if (h.state === "Recover") {
    if (t > h.stateUntil) h.state = "Search";
    return;
  }
  if (h.hp < 50 && !h.retreated) {
    h.retreated = true;
    h.state = "Retreat";
    h.stateUntil = t + 3;
    notify("추적자가 후퇴합니다", "WOUNDS WILL REMAIN");
    return;
  }
  if (sight) {
    h.state = d < 240 ? "Combat" : "Chase";
    h.target = h.lastSeen;
  } else if (h.lastSeen && t - h.lostAt < 6) {
    h.state = "Search";
    h.target = h.lastSeen;
  } else if (
    noisePoint &&
    noisePoint.until > t &&
    distance(h, noisePoint) < noisePoint.radius
  ) {
    h.state = "Investigate";
    h.target = { x: noisePoint.x, y: noisePoint.y };
  } else {
    h.state = "Patrol";
    if (!h.target || distance(h, h.target) < 30 || t > (h.patrolUntil || 0)) {
      const r = rooms[Math.floor(Math.random() * 3)];
      h.target = { x: r.x + 150, y: r.y + 260 };
      h.patrolUntil = t + 8;
    }
  }
  if (h.state !== "Combat") {
    if (h.plan.length) {
      h.plan = [];
      h.combo.interrupt("lost-sight");
      h.telegraph = null;
    }
    if (h.target) follow(h, h.target, dt, h.speed);
    return;
  }
  const angle = Math.atan2(player.y - h.y, player.x - h.x);
  if (d > 110) follow(h, h.lastSeen, dt, h.speed * 0.8);
  if (t > h.nextDecision) {
    if (h.telegraph) {
      const id = h.telegraph;
      combat.use(h, id, angle, t);
      h.plan.shift();
      h.telegraph = null;
      h.nextDecision = t + 0.35;
    } else {
      if (!h.plan.length)
        h.plan = hunterPlan(h).filter((id) => (h.cooldowns[id] || 0) <= t);
      if (h.plan.length) {
        h.telegraph = h.plan[0];
        h.nextDecision = t + 0.7;
        effects.push({
          type: "warning",
          x: h.x,
          y: h.y,
          angle,
          born: t,
          life: 0.7,
          owner: h,
        });
      } else {
        if (d < 100) basicAttack(h, angle);
        h.nextDecision = t + 0.65;
      }
    }
  }
}
function update(dt) {
  t += dt;
  runSeconds += dt;
  player.combo.expire(t);
  hunter?.combo.expire(t);
  let dx = Number(keys.has("d")) - Number(keys.has("a")),
    dy = Number(keys.has("s")) - Number(keys.has("w"));
  if (dx || dy) {
    const len = Math.hypot(dx, dy);
    move(player, (dx / len) * 185 * dt, (dy / len) * 185 * dt);
  }
  if (mouse.down) basicAttack(player, aim());
  if (player.dashes < 2 && t >= player.dashRecharge) {
    player.dashes++;
    player.dashRecharge = player.dashes < 2 ? t + 2.5 : 0;
  }
  const currentRoom = rooms.findIndex((r) => inRect(player.x, player.y, r));
  if (currentRoom >= 0) roomIndex = currentRoom;
  if (!visited.has(roomIndex)) spawnRoom(roomIndex);
  for (const e of enemies) {
    if (e.dead) continue;
    if (e.windup) {
      if (t > e.windup) {
        if (
          distance(e, player) < (e.elite ? 100 : 65) &&
          lineOfSight(e, player, walkable)
        )
          combat.damage(e, player, e.elite ? 20 : 12, t);
        e.windup = 0;
        e.nextAttack = t + 1.2;
      }
      continue;
    }
    if (distance(e, player) < (e.elite ? 82 : 48) && t > e.nextAttack) {
      e.windup = t + 0.55;
      effects.push({
        type: "warning",
        x: e.x,
        y: e.y,
        born: t,
        life: 0.55,
        owner: e,
      });
    } else if (distance(e, player) < 650) follow(e, player, dt, e.speed);
  }
  updateHunter(dt);
  for (const z of zones) {
    if (t > z.until) continue;
    for (const e of enemiesOf(z.owner)) {
      if (distance(e, z) < z.range) {
        const d = distance(e, z) || 1;
        move(e, ((z.x - e.x) / d) * 85 * dt, ((z.y - e.y) / d) * 85 * dt);
      }
    }
    if (t > z.nextTick) {
      enemiesOf(z.owner)
        .filter((e) => distance(e, z) < z.range)
        .forEach((e) => combat.damage(z.owner, e, 7, t));
      z.nextTick = t + 0.5;
    }
  }
  for (const c of clones) {
    if (t > c.until || c.owner.dead) continue;
    if (t > c.nextAttack) {
      const target = enemiesOf(c.owner)
        .filter((e) => distance(c, e) < 200 && lineOfSight(c, e, walkable))
        .sort((a, b) => distance(c, a) - distance(c, b))[0];
      if (target) {
        combat.damage(c.owner, target, c.damage, t);
        effects.push({
          type: "beam",
          x: c.x,
          y: c.y,
          end: { x: target.x, y: target.y },
          born: t,
          life: 0.2,
        });
      }
      c.nextAttack = t + 0.75;
    }
  }
  zones = zones.filter((z) => t < z.until);
  clones = clones.filter((c) => t < c.until && !c.owner.dead);
  effects = effects.filter((e) => t - e.born < e.life);
  numbers = numbers.filter((n) => t - n.born < 0.65);
  if (deaths.length && !hunter && (t > hunterSpawnAt || roomIndex === 2)) {
    const r = rooms[roomIndex === 2 ? 0 : 2];
    hunter = createHunter(deaths.at(-1), r.x + 400, r.y + 260);
    bindActor(hunter);
    warningUntil = t + 5;
    beep(90, 0.9);
    $("hunter-warning").textContent =
      `과거의 당신이 깨어났습니다 · 사망 기록 #${deaths.length}`;
  }
  if (mode === "playing")
    for (const index of visited) {
      if (
        !cleared.has(index) &&
        !enemies.some((e) => !e.dead && e.room === index)
      ) {
        cleared.add(index);
        player.hp = Math.min(player.maxHp, player.hp + 18);
        if (index === 2) {
          if (deaths.length && (!hunter || !hunter.dead)) {
            notify("과거의 기억을 마주하세요", "DEFEAT YOUR PAST SELF");
          } else victory();
        } else
          chooseSkill(
            index === 1 ? "정예의 기억" : "전투의 잔향",
            "방을 정리했습니다. 체력 18 회복. 공명으로 연결되는 기억을 선택하세요.",
            rewardCandidates(player.skills),
          );
        break;
      }
    }
  if (
    mode === "playing" &&
    cleared.size === 3 &&
    (!deaths.length || hunter?.dead)
  )
    victory();
  if (toastUntil < t) $("toast").classList.add("hidden");
  $("hunter-warning").classList.toggle(
    "hidden",
    t > warningUntil || !hunter || hunter.dead,
  );
  updateHUD();
}
function victory() {
  mode = "victory";
  modal(
    `<div class="eyebrow">SECTOR CLEARED</div><h2>아직 끝나지 않은 <em>기억.</em></h2><p>세 전투방을 돌파했습니다.<br>기억을 남기고 다음 회차에서 과거의 자신을 만나보세요.</p><div class="stats"><span><b>${kills}</b>처치</span><span><b>${Math.floor(runSeconds)}s</b>소요 시간</span></div><button id="archive-run" class="primary">기억을 남기고 다음 회차 →</button>`,
  );
  $("archive-run").onclick = () => {
    saveDeath(storage, player, {
      runID,
      floor: 3,
      cause: "회랑 끝에 남긴 기억",
    });
    init();
  };
}
function updateArchive() {
  $("record-count").textContent =
    `${String(deaths.length).padStart(2, "0")} DEATH RECORDS`;
  $("archive-preview").replaceChildren();
  if (!deaths.length) {
    $("archive-preview").innerHTML =
      '아직 남겨진 기억이 없습니다.<br><span class="muted">당신의 마지막 빌드가<br>다음 회차의 추적자가 됩니다.</span>';
  } else {
    const record = deaths.at(-1),
      a = document.createElement("span"),
      b = document.createElement("span");
    a.textContent = `이전의 당신 / 기록 #${deaths.length}`;
    b.className = "muted";
    b.textContent = record.equippedSkillIDs
      .map((id) => SKILLS[id].name)
      .join(" · ");
    $("archive-preview").append(a, document.createElement("br"), b);
  }
}
function updateHUD() {
  if (!player) return;
  $("hp-value").textContent = `${Math.ceil(player.hp)} / ${player.maxHp}`;
  $("health-fill").style.width = `${(player.hp / player.maxHp) * 100}%`;
  $("dash-charges").innerHTML = [0, 1]
    .map((i) => `<i style="opacity:${i < player.dashes ? 1 : 0.15}"></i>`)
    .join("");
  const next = player.combo.candidates(player.skills).map((c) => c.next);
  $("skills").innerHTML = [0, 1, 2]
    .map((i) => {
      const id = player.skills[i],
        s = SKILLS[id],
        cool = id ? Math.max(0, (player.cooldowns[id] || 0) - t) : 0;
      return `<div class="skill ${cool ? "cooling" : ""} ${next.includes(id) ? "next" : ""}" style="--skill-color:${s ? COLORS[s.tags[0]] : "#526766"}"><div class="skill-icon">${icons[id] || "+"}</div>${cool ? `<span class="cooldown">${cool.toFixed(1)}</span>` : ""}<div><div class="skill-name">${s?.name || "빈 기억 슬롯"}</div><div class="skill-sub">${s ? `${s.category} / ${s.cooldown} SEC` : "ACQUIRE A MEMORY"}</div></div><kbd>${["Q", "E", "F"][i]}</kbd></div>`;
    })
    .join("");
  const history = player.combo.history,
    last = history.at(-1),
    window = player.combo.window();
  $("combo-display").replaceChildren();
  const primary = document.createTextNode(
      last
        ? history.map((h) => SKILLS[h.id].name).join(" → ")
        : "연계를 기다리는 중",
    ),
    sub = document.createElement("span");
  sub.textContent = last
    ? next.length
      ? "다음 기억: " + next.map((id) => SKILLS[id].name).join(" / ")
      : "연결 가능한 다음 스킬이 없습니다."
    : "스킬 사이 2초 · 상급 확장 1.5초";
  $("combo-display").append(primary, sub);
  $("combo-fill").style.width = last
    ? `${Math.min(100, Math.max(0, ((last.end + window - t) / window) * 100))}%`
    : "0%";
  $("recipe-list").innerHTML =
    availableRecipes(player.skills)
      .map(
        (r) =>
          `<div class="recipe"><b>${r.name}</b><span class="sequence">${r.sequence.map((id) => ["Q", "E", "F"][player.skills.indexOf(id)]).join(" → ")}</span></div>`,
      )
      .join("") || '<p class="muted small">기억을 모아 연계를 완성하세요.</p>';
  $("room-label").innerHTML =
    `0${roomIndex + 1} <i>/</i> ${rooms[roomIndex].name}`;
  $("enemy-count").textContent =
    `${enemies.filter((e) => !e.dead).length} HOSTILE SIGNALS`;
  $("objective").textContent = cleared.has(roomIndex)
    ? roomIndex === 2
      ? "추적자의 기억을 회수하세요."
      : "방 정리 완료 · 오른쪽 통로로 이동하세요."
    : "적을 처치하고 기억을 획득하세요.";
  $("hunter-health").classList.toggle("hidden", !hunter || hunter.dead);
  if (hunter) {
    $("hunter-health").querySelector(".hunter-name").textContent =
      `과거의 당신 · 기록 #${deaths.length}`;
    $("hunter-health").querySelector(".hunter-track>div").style.width =
      `${(hunter.hp / hunter.maxHp) * 100}%`;
    $("hunter-state").textContent =
      `${hunter.state.toUpperCase()} / ${Math.ceil(hunter.hp)} HP`;
  }
}
function polygon(points, fill, stroke) {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}
function circle(x, y, r, fill, stroke) {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}
function drawActor(a, type) {
  const ghost = type === "clone",
    p = type === "player",
    h = type === "hunter",
    color = p
      ? "#9df6d5"
      : h
        ? "#f4779a"
        : ghost
          ? "#b59bff"
          : a.elite
            ? "#f0ad79"
            : "#b08c7c";
  ctx.save();
  ctx.translate(a.x, a.y);
  if (ghost) ctx.globalAlpha = 0.5;
  circle(0, 6, 19, "#0006");
  if (h || p) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 15;
    circle(0, 1, 14, null, color);
    ctx.shadowBlur = 0;
  }
  if (t < (a.flashUntil || 0)) ctx.globalAlpha = 0.5;
  if (p || h || ghost) {
    polygon(
      [
        [-13, 13],
        [-10, -5],
        [0, -17],
        [10, -5],
        [14, 13],
        [0, 9],
      ],
      h ? "#612b42" : ghost ? "#5c4f87" : "#365c53",
      color,
    );
    polygon(
      [
        [-6, -3],
        [0, -12],
        [6, -3],
        [0, 3],
      ],
      color,
    );
    const angle = p
      ? aim()
      : player
        ? Math.atan2(player.y - a.y, player.x - a.x)
        : 0;
    ctx.save();
    ctx.rotate(angle);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(11, 6);
    ctx.lineTo(30, 6);
    ctx.stroke();
    ctx.restore();
  } else {
    polygon(
      [
        [-15, 4],
        [-9, -14],
        [6, -17],
        [17, -1],
        [10, 16],
        [-7, 14],
      ],
      a.elite ? "#68432f" : "#453a34",
      color,
    );
    ctx.fillStyle = "#f0b49b";
    ctx.fillRect(-6, -4, 4, 3);
    ctx.fillRect(4, -4, 4, 3);
  }
  if (!ghost && a.hp < a.maxHp) {
    ctx.fillStyle = "#263331";
    ctx.fillRect(-18, -29, 36, 3);
    ctx.fillStyle = color;
    ctx.fillRect(-18, -29, (36 * a.hp) / a.maxHp, 3);
  }
  if (a.markedUntil > t) circle(0, 0, 24, null, "#ff6a95");
  if (a.parryUntil > t) circle(0, 0, 30, "#f9dc9520", "#f9dc95");
  if (a.invulnerableUntil > t) circle(0, 0, 25, null, "#bffff0");
  ctx.restore();
}
function draw() {
  const w = canvas.width,
    h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#091014";
  ctx.fillRect(0, 0, w, h);
  const focus = player || { x: 420, y: 360 };
  cam.x = Math.max(-105, Math.min(1550, focus.x - w * 0.45));
  cam.y = Math.max(-100, Math.min(80, focus.y - h * 0.5));
  ctx.save();
  ctx.translate(-cam.x, -cam.y);
  for (const r of [...rooms, ...halls]) {
    ctx.fillStyle = "#142024";
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = "#2e4142";
    ctx.lineWidth = 2;
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = "#1d2c30";
    ctx.lineWidth = 1;
    for (let x = r.x; x < r.x + r.w; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, r.y);
      ctx.lineTo(x, r.y + r.h);
      ctx.stroke();
    }
    for (let y = r.y; y < r.y + r.h; y += 40) {
      ctx.beginPath();
      ctx.moveTo(r.x, y);
      ctx.lineTo(r.x + r.w, y);
      ctx.stroke();
    }
  }
  for (const r of rooms) {
    ctx.fillStyle = "#0d171a";
    ctx.fillRect(r.x - 10, r.y - 15, r.w + 20, 15);
    ctx.fillRect(r.x - 10, r.y, 10, r.h + 10);
    ctx.fillRect(r.x + r.w, r.y, 10, r.h + 10);
    ctx.strokeStyle = "#344b49";
    ctx.strokeRect(r.x + 10, r.y + 10, r.w - 20, r.h - 20);
    const index = rooms.indexOf(r);
    ctx.fillStyle = "#39534f";
    ctx.font = "10px monospace";
    ctx.fillText(`SECTOR 0${index + 1} / MEMORY CHAMBER`, r.x + 28, r.y + 37);
    ctx.fillStyle = "#1f3435";
    ctx.font = "bold 80px monospace";
    ctx.fillText(`0${index + 1}`, r.x + r.w - 140, r.y + r.h - 35);
    // Memory altar and exit threshold.
    ctx.save();
    ctx.translate(r.x + 90, r.y + 120);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = "#1d3934";
    ctx.fillRect(-24, -24, 48, 48);
    ctx.strokeStyle = "#527d6b";
    ctx.strokeRect(-24, -24, 48, 48);
    ctx.fillStyle = "#80cbb0";
    ctx.fillRect(-7, -7, 14, 14);
    ctx.restore();
    if (cleared.has(index) && index < 2) {
      ctx.strokeStyle = "#8cf4d0";
      ctx.beginPath();
      ctx.moveTo(r.x + r.w - 40, r.y + 250);
      ctx.lineTo(r.x + r.w - 27, r.y + 260);
      ctx.lineTo(r.x + r.w - 40, r.y + 270);
      ctx.stroke();
    }
  }
  for (const hall of halls) {
    ctx.fillStyle = "#142024";
    ctx.fillRect(hall.x - 14, hall.y + 2, hall.w + 28, hall.h - 4);
    ctx.strokeStyle = "#3b5d52";
    for (let i = 0; i < 4; i++) {
      ctx.strokeRect(hall.x + 10 + i * 40, hall.y + 15, 10, hall.h - 30);
    }
    ctx.fillStyle = "#8cf4d0";
    ctx.fillRect(hall.x - 5, hall.y, 5, 10);
    ctx.fillRect(hall.x - 5, hall.y + hall.h - 10, 5, 10);
  }
  for (const r of pillars) {
    ctx.fillStyle = "#0005";
    ctx.fillRect(r.x + 10, r.y + 15, r.w + 4, r.h + 6);
    ctx.fillStyle = "#1f2d30";
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = "#3c4a49";
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = "#2a3b3b";
    ctx.fillRect(r.x + 6, r.y + 6, r.w - 12, 12);
    ctx.fillStyle = "#51746a";
    ctx.fillRect(r.x + 10, r.y + r.h - 10, r.w - 20, 3);
  }
  // Floor scuffs, broken tiles and tiny emissive archive fragments.
  for (let i = 0; i < 85; i++) {
    const x = 110 + ((i * 173) % 2290),
      y = 140 + ((i * 97) % 430);
    if (!walkable(x, y)) continue;
    ctx.fillStyle = i % 9 === 0 ? "#638f7740" : "#7c979416";
    ctx.fillRect(x, y, i % 3 === 0 ? 8 : 3, 2);
  }
  for (const z of zones) {
    circle(z.x, z.y, z.range, "#777fff12", "#899fff55");
    circle(z.x, z.y, 17 + Math.sin(t * 4) * 5, "#9d9bff22", "#bbb3ff");
    for (let i = 0; i < 5; i++) {
      const a = t + i * 1.256;
      circle(z.x + Math.cos(a) * 75, z.y + Math.sin(a) * 75, 2, "#a7abff");
    }
  }
  for (const c of clones) drawActor(c, "clone");
  for (const e of enemies) if (!e.dead) drawActor(e, "enemy");
  if (hunter && !hunter.dead) drawActor(hunter, "hunter");
  if (player) drawActor(player, "player");
  else drawActor({ x: 420, y: 360, hp: 100, maxHp: 100 }, "player");
  for (const e of effects) {
    const progress = Math.max(0, (t - e.born) / e.life);
    ctx.save();
    ctx.globalAlpha = 1 - progress;
    ctx.lineWidth = 2;
    if (e.type === "warning") {
      const a = e.owner || e;
      circle(a.x, a.y, 30 + progress * 30, "#f4779a15", "#f4779a");
      ctx.fillStyle = "#ff9cb8";
      ctx.font = "bold 18px monospace";
      ctx.fillText("!", a.x - 4, a.y - 36);
    } else if (e.type === "beam" || e.type === "dash") {
      ctx.strokeStyle = e.type === "dash" ? "#8cf4d0" : "#bc9cff";
      ctx.lineWidth = e.type === "dash" ? 17 : 3;
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(e.end.x, e.end.y);
      ctx.stroke();
    } else if (["slash", "heavy", "A01"].includes(e.type)) {
      ctx.translate(e.x, e.y);
      ctx.rotate(e.angle || 0);
      ctx.strokeStyle = e.type === "A01" ? "#ffb083" : "#b3ffe4";
      ctx.lineWidth = e.type === "heavy" ? 14 : 7;
      ctx.beginPath();
      ctx.arc(0, 0, (e.type === "A01" ? 105 : 70) + progress * 30, -1.1, 1.1);
      ctx.stroke();
    } else {
      const color =
        e.type === "R11"
          ? "#ff6a95"
          : e.type === "U01"
            ? "#c8b0ff"
            : e.type === "R01"
              ? "#ffba83"
              : e.type === "death"
                ? "#a88d7a"
                : "#8cf4d0";
      circle(
        e.x,
        e.y,
        20 + progress * (e.type[0] === "U" ? 190 : 110),
        null,
        color,
      );
      circle(e.x, e.y, 10 + progress * 55, color + "22");
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4 + progress;
        ctx.fillStyle = color;
        ctx.fillRect(
          e.x + Math.cos(a) * progress * 95,
          e.y + Math.sin(a) * progress * 95,
          3,
          3,
        );
      }
    }
    ctx.restore();
  }
  for (const n of numbers) {
    ctx.globalAlpha = 1 - (t - n.born) / 0.65;
    ctx.fillStyle = n.player ? "#ff88a9" : "#deeee3";
    ctx.font = "bold 15px monospace";
    ctx.fillText(n.text, n.x - 8, n.y - (t - n.born) * 40);
  }
  ctx.globalAlpha = 1;
  if (player && mode === "playing") {
    const x = mouse.x + cam.x,
      y = mouse.y + cam.y;
    ctx.strokeStyle = "#8cf4d088";
    ctx.lineWidth = 1;
    circle(x, y, 6, null, "#8cf4d0aa");
    ctx.beginPath();
    ctx.moveTo(x - 11, y);
    ctx.lineTo(x - 8, y);
    ctx.moveTo(x + 8, y);
    ctx.lineTo(x + 11, y);
    ctx.moveTo(x, y - 11);
    ctx.lineTo(x, y - 8);
    ctx.moveTo(x, y + 8);
    ctx.lineTo(x, y + 11);
    ctx.stroke();
  }
  ctx.restore();
  const vignette = ctx.createRadialGradient(
    w / 2,
    h / 2,
    h * 0.2,
    w / 2,
    h / 2,
    w * 0.68,
  );
  vignette.addColorStop(0, "#0000");
  vignette.addColorStop(1, "#03080bc9");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);
}
function frame(now) {
  const dt = Math.min(0.035, (now - lastFrame) / 1000 || 0);
  lastFrame = now;
  if (mode === "playing") update(dt);
  draw();
  requestAnimationFrame(frame);
}
function showHelp() {
  if (mode === "reward" || mode === "dead" || mode === "victory") return;
  previousMode = mode;
  mode = "help";
  modal(
    `<div class="eyebrow">FIELD MANUAL / CONTROLS</div><h2>기억을 연결하세요.</h2><div class="help-grid"><span><kbd>W A S D</kbd> 이동</span><span><kbd>MOUSE</kbd> 조준</span><span><kbd>LMB</kbd> 기본 참격</span><span><kbd>RMB</kbd> 강한 참격</span><span><kbd>SPACE</kbd> 대시 / 2회 충전</span><span><kbd>Q E F</kbd> 장착 스킬</span><span><kbd>TAB</kbd> 빌드 정보</span><span><kbd>ESC</kbd> 일시정지</span></div><p>화염 참격 → 뇌전 돌진(적중) → 그림자 분신<br>2초 이내 연계, 돌진 종료 후 1.5초 이내 확장.<br>기본 공격과 대시는 연계를 끊지 않습니다.<br>사망 기록은 이 브라우저에 최대 8개 저장됩니다.<br>PC 키보드와 마우스로 플레이하세요.</p><button id="close-help" class="primary">${player ? "계속하기" : "돌아가기"}</button>`,
  );
  $("close-help").onclick = () => {
    if (previousMode === "intro") intro();
    else resume();
  };
}
function showLoadout() {
  if (mode !== "playing") return;
  mode = "loadout";
  modal(
    `<div class="eyebrow">CURRENT BUILD</div><h2>장착한 기억</h2><div class="cards">${player.skills.map(card).join("")}</div><p>장착한 순서대로 Q · E · F에 배치됩니다.<br>스킬 교체는 다음 전투 보상에서 가능합니다.</p><button id="close-loadout" class="primary">전투로 돌아가기</button>`,
  );
  $("overlay")
    .querySelectorAll("[data-skill]")
    .forEach((b) => (b.disabled = true));
  $("close-loadout").onclick = resume;
}
function pause() {
  if (mode === "playing") {
    mode = "pause";
    modal(
      '<div class="eyebrow">SIGNAL SUSPENDED</div><h2>잠시 멈춘 기억.</h2><p>회랑과 연계 시간이 일시정지되었습니다.</p><button id="continue" class="primary">계속하기</button>',
    );
    $("continue").onclick = resume;
  } else if (["pause", "help", "loadout"].includes(mode)) {
    if (mode === "help" && previousMode === "intro") intro();
    else resume();
  }
}
function intro() {
  mode = "intro";
  modal(
    '<div class="intro-glyph">✳</div><div class="intro-meta">A TOP-DOWN ACTION ROGUELIKE</div><h2>당신의 죽음이<br>다음의 <em>적</em>이 된다.</h2><p>기억을 수집하고, 스킬을 연결해 공명을 깨우세요.<br>회랑 어딘가에서 과거의 당신이 기다립니다.</p><button class="primary" id="start">회랑에 진입하기 →</button><div class="intro-meta">3 CHAMBERS · 6 SKILLS · ONE PAST SELF</div>',
  );
  $("start").onclick = init;
}
canvas.addEventListener("mousemove", (e) => {
  const r = canvas.getBoundingClientRect();
  mouse.x = ((e.clientX - r.left) * canvas.width) / r.width;
  mouse.y = ((e.clientY - r.top) * canvas.height) / r.height;
});
canvas.addEventListener("mousedown", (e) => {
  if (mode !== "playing") return;
  canvas.focus();
  if (e.button === 0) mouse.down = true;
  if (e.button === 2) basicAttack(player, aim(), true);
});
canvas.addEventListener("contextmenu", (e) => e.preventDefault());
window.addEventListener("mouseup", () => (mouse.down = false));
window.addEventListener("keydown", (e) => {
  if (["Space", "Tab", "Escape"].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  const k = e.key.toLowerCase();
  keys.add(k);
  if (k === "h") {
    if (mode === "help") pause();
    else showHelp();
  }
  if (e.code === "Escape") pause();
  if (e.code === "Tab") showLoadout();
  if (mode === "playing") {
    if (e.code === "Space") dash();
    const slot = ["q", "e", "f"].indexOf(k);
    if (slot >= 0 && player.skills[slot])
      combat.use(player, player.skills[slot], aim(), t);
  }
});
window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener("blur", () => {
  keys.clear();
  mouse.down = false;
  if (mode === "playing") pause();
});
$("help-button").onclick = showHelp;
$("loadout-button").onclick = showLoadout;
$("sound-button").onclick = () => {
  soundOn = !soundOn;
  $("sound-button").textContent = soundOn ? "소리 끄기" : "소리 켜기";
  $("sound-button").setAttribute("aria-pressed", String(soundOn));
  if (soundOn) beep(440, 0.1);
};
updateArchive();
intro();
requestAnimationFrame(frame);
// Read-only diagnostics for smoke tests and local debugging; no game mutations.
window.deadMemory = {
  snapshot: () => ({
    mode,
    time: t,
    camera: { ...cam },
    map: { rooms, halls, pillars },
    player: player
      ? {
          x: player.x,
          y: player.y,
          hp: player.hp,
          skills: [...player.skills],
          dashes: player.dashes,
          successful: [...player.successful],
          cooldowns: { ...player.cooldowns },
        }
      : null,
    enemies: enemies
      .filter((e) => !e.dead)
      .map((e) => ({ id: e.id, x: e.x, y: e.y, hp: e.hp })),
    hunter: hunter
      ? {
          hp: hunter.hp,
          state: hunter.state,
          skills: hunter.skills,
          allowed: hunter.combo.allowed,
        }
      : null,
    records: deaths.length,
    cleared: [...cleared],
  }),
};
