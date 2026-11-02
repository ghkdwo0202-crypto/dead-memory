import { TUNING as T, OBSTACLES } from "./data.js";
export function draw(ctx, run, clock, options = {}) {
  ctx.clearRect(0, 0, T.width, T.height);
  ctx.fillStyle = "#152023";
  ctx.fillRect(0, 0, T.width, T.height);
  if (!run) {
    title(ctx, clock);
    return;
  }
  // World remains top-down; diamond paving provides a quiet quarter-view visual cue.
  ctx.strokeStyle = "#bacbb308";
  ctx.lineWidth = 1;
  for (let x = -900; x < 2000; x += 80) {
    ctx.beginPath();
    ctx.moveTo(x, 110);
    ctx.lineTo(x + 1100, 720);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, 110);
    ctx.lineTo(x - 1100, 720);
    ctx.stroke();
  }
  ctx.fillStyle = "#0d1517";
  ctx.fillRect(0, 0, 1440, 110);
  ctx.fillRect(0, 720, 1440, 90);
  ctx.fillRect(0, 0, 80, 810);
  ctx.fillRect(1360, 0, 80, 810);
  ctx.strokeStyle = "#d6b67a35";
  ctx.strokeRect(80, 110, 1280, 610);
  for (const o of OBSTACLES) {
    ctx.fillStyle = "#070f1266";
    ctx.fillRect(o.x + 12, o.y + 12, o.w, o.h);
    ctx.fillStyle = "#283435";
    ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.fillStyle = "#53605b";
    ctx.fillRect(o.x, o.y, o.w, 7);
    ctx.strokeStyle = "#9fa89233";
    ctx.strokeRect(o.x, o.y, o.w, o.h);
  }
  for (const fx of run.effects) {
    if (fx.type === "zone") {
      ctx.strokeStyle = "#8ed1c0";
      ctx.fillStyle = "#8ed1c010";
      circle(ctx, fx.x, fx.y, fx.range, true, true);
    }
  }
  if (run.cloneUntil > run.t) {
    ctx.globalAlpha = 0.35;
    actor(
      ctx,
      { ...run.player, x: run.player.x - 42, y: run.player.y + 20 },
      run.hero.color,
      run.heroId,
    );
    ctx.globalAlpha = 1;
  }
  const entities = [
    ...run.enemies.map((e) => ({ ...e, enemy: true })),
    { ...run.player, player: true },
  ].sort((a, b) => a.y - b.y);
  for (const e of entities) {
    if (e.enemy) {
      actor(
        ctx,
        e,
        e.hurtUntil > run.t && options.flash !== false
          ? "#f1dfb1"
          : e.boss
            ? "#97798e"
            : "#687e79",
        e.boss ? "boss" : "enemy",
      );
      const width = e.boss ? 90 : 35;
      ctx.fillStyle = "#080e10";
      ctx.fillRect(e.x - width / 2, e.y - e.radius - 21, width, 4);
      ctx.fillStyle = "#d87965";
      ctx.fillRect(
        e.x - width / 2,
        e.y - e.radius - 21,
        (width * e.hp) / e.maxHP,
        4,
      );
    } else {
      actor(
        ctx,
        e,
        e.hurtUntil > run.t && options.flash !== false
          ? "#f1dfb1"
          : run.hero.color,
        run.heroId,
      );
      if (e.invulnerableUntil > run.t) {
        ctx.strokeStyle = "#d7b97b";
        circle(ctx, e.x, e.y, 26, false, true);
      }
    }
  }
  for (const fx of run.effects) {
    const age = (run.t - fx.born) / fx.life;
    ctx.globalAlpha = Math.max(0, 1 - age);
    ctx.strokeStyle = fx.color || "#d8c9a5";
    ctx.fillStyle = fx.color || "#d8c9a5";
    ctx.lineWidth = fx.heavy ? 14 : 5;
    if (fx.type === "slash") {
      ctx.beginPath();
      ctx.ellipse(
        fx.x,
        fx.y,
        fx.range,
        fx.range * 0.7,
        0,
        fx.face - 1.1,
        fx.face + 1.1,
      );
      ctx.stroke();
    } else if (fx.type === "hit") {
      ctx.font = "bold 19px monospace";
      ctx.textAlign = "center";
      ctx.fillText(fx.text, fx.x, fx.y - 32 - age * 30);
    } else if (fx.type === "chains") {
      for (let a = 0; a < 6; a++) {
        ctx.beginPath();
        ctx.moveTo(fx.x, fx.y);
        ctx.lineTo(
          fx.x + Math.cos((a * Math.PI) / 3) * fx.range,
          fx.y + Math.sin((a * Math.PI) / 3) * fx.range * 0.6,
        );
        ctx.stroke();
      }
    } else if (!["zone", "clone"].includes(fx.type)) {
      circle(ctx, fx.x, fx.y, (fx.range || 40) * (age + 0.3), false, true);
    }
    ctx.globalAlpha = 1;
  }
  // Hostile telegraphs are drawn last so player effects cannot hide timing.
  for (const e of run.enemies)
    if (e.telegraph) {
      const h = e.telegraph,
        progress = 1 - Math.max(0, h.at - run.t) / (e.boss ? 0.95 : 0.65);
      ctx.fillStyle = "#dd5d4d18";
      ctx.strokeStyle = "#f47761";
      ctx.lineWidth = 2;
      circle(ctx, h.x, h.y, h.radius, true, true);
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(
        h.x,
        h.y,
        h.radius,
        -Math.PI / 2,
        -Math.PI / 2 + Math.PI * 2 * progress,
      );
      ctx.stroke();
      ctx.fillStyle = "#ffc99b";
      ctx.font = "bold 22px monospace";
      ctx.textAlign = "center";
      ctx.fillText("!", h.x, h.y - 25);
    }
}
function circle(c, x, y, r, fill, stroke) {
  c.beginPath();
  c.ellipse(x, y, r, r * 0.72, 0, 0, Math.PI * 2);
  if (fill) c.fill();
  if (stroke) c.stroke();
}
function actor(c, e, color, id) {
  const g = id === "HERO_GORO",
    k = id === "HERO_KITSUNE",
    b = id === "boss";
  c.fillStyle = "#0005";
  circle(c, e.x, e.y + 13, b ? 44 : g ? 28 : 20, true, false);
  c.fillStyle = color;
  c.beginPath();
  c.ellipse(
    e.x,
    e.y,
    g ? 22 : b ? 34 : 15,
    g ? 23 : b ? 34 : 20,
    0,
    0,
    Math.PI * 2,
  );
  c.fill();
  c.fillStyle = "#172127";
  c.beginPath();
  c.arc(e.x, e.y - 18, g ? 15 : b ? 22 : 12, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = "#d45f50";
  c.lineWidth = 6;
  c.beginPath();
  c.moveTo(e.x - 7, e.y - 7);
  c.lineTo(e.x + 12, e.y - 6);
  c.lineTo(e.x + 27, e.y + 9);
  c.stroke();
  const a = e.face || 0;
  c.save();
  c.translate(e.x, e.y);
  c.rotate(a);
  c.strokeStyle = "#d9d7bc";
  c.lineWidth = g ? 11 : 3;
  c.beginPath();
  c.moveTo(12, 0);
  c.lineTo(g ? 65 : 47, 0);
  c.stroke();
  if (g) {
    c.fillStyle = "#647370";
    c.beginPath();
    c.ellipse(53, 0, 22, 12, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#c1c5ab";
    for (const x of [39, 51, 63]) {
      for (const y of [-11, 11]) {
        c.beginPath();
        c.arc(x, y, 3, 0, Math.PI * 2);
        c.fill();
      }
    }
  }
  if (k) {
    c.beginPath();
    c.moveTo(10, 14);
    c.lineTo(37, 14);
    c.stroke();
  }
  c.restore();
  if (g) {
    c.fillStyle = color;
    for (const sign of [-1, 1]) {
      c.beginPath();
      c.moveTo(e.x + sign * 7, e.y - 29);
      c.lineTo(e.x + sign * 13, e.y - 43);
      c.lineTo(e.x + sign * 16, e.y - 23);
      c.fill();
    }
  }
}
function title(c, time) {
  const gradient = c.createLinearGradient(0, 0, 1440, 810);
  gradient.addColorStop(0, "#111c20");
  gradient.addColorStop(1, "#293434");
  c.fillStyle = gradient;
  c.fillRect(0, 0, 1440, 810);
  c.fillStyle = "#a84e42";
  c.beginPath();
  c.arc(1020, 295, 218, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = "#d4a07730";
  c.lineWidth = 1;
  for (let r = 240; r < 330; r += 30) {
    c.beginPath();
    c.arc(1020, 295, r, 0, Math.PI * 2);
    c.stroke();
  }
  c.fillStyle = "#101b20";
  for (let i = 0; i < 5; i++) {
    const y = 260 + i * 43,
      w = 115 + i * 23;
    c.beginPath();
    c.moveTo(1010 - w, y);
    c.lineTo(1010 + w, y);
    c.lineTo(1010 + w - 40, y - 27);
    c.lineTo(1010 - w + 40, y - 27);
    c.fill();
    c.fillRect(1010 - w + 25, y, w * 2 - 50, 30);
  }
  c.fillStyle = "#0e171b";
  c.beginPath();
  c.moveTo(550, 810);
  c.lineTo(760, 580);
  c.lineTo(1020, 660);
  c.lineTo(1440, 510);
  c.lineTo(1440, 810);
  c.fill();
  for (const [i, mark] of ["烏", "狐", "鬼"].entries()) {
    const x = 780 + i * 205,
      y = 520 + (i === 1 ? -35 : 20);
    c.fillStyle = "#121c20";
    c.beginPath();
    c.ellipse(x, y + 150, i === 2 ? 88 : 62, 160, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#1b2528";
    c.beginPath();
    c.arc(x, y - 10, i === 2 ? 55 : 39, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#bb6b57";
    c.font = "42px Georgia";
    c.textAlign = "center";
    c.fillText(mark, x, y + 12);
    c.strokeStyle = "#934e40";
    c.lineWidth = 12;
    c.beginPath();
    c.moveTo(x - 35, y + 55);
    c.lineTo(x + 50, y + 62);
    c.lineTo(x + 110, y + 105);
    c.stroke();
  }
  c.fillStyle = "#b2714c";
  for (let i = 0; i < 24; i++) {
    const x = 650 + ((i * 127 + time * 14) % 800),
      y = (i * 83 + time * 23) % 810;
    c.save();
    c.translate(x, y);
    c.rotate(i + time * 0.1);
    c.fillRect(-3, -1, 10, 3);
    c.restore();
  }
  c.font = "11px monospace";
  c.fillStyle = "#9fa89b";
  c.textAlign = "right";
  c.fillText("ART PLACEHOLDER / ORIGINAL REFERENCES PENDING", 1390, 765);
}
