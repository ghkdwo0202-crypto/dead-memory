import { CONFIG, OBSTACLES } from "./data.js";
const TAU = Math.PI * 2;
function line(ctx, points, color, width = 1) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
}
function circle(ctx, x, y, r, color, fill = false) {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.01, r), 0, TAU);
  if (fill) {
    ctx.fillStyle = color;
    ctx.fill();
  } else {
    ctx.strokeStyle = color;
    ctx.stroke();
  }
}
function fighter(ctx, a, t, ghost = false) {
  const player = a.team === "player",
    height = (a.airHeight || 0) * 48,
    angle = a.attack?.angle ?? a.face,
    r = player ? 14 : 17;
  ctx.save();
  ctx.translate(a.x, a.y);
  if (!ghost) {
    ctx.fillStyle = "#0008";
    ctx.beginPath();
    ctx.ellipse(0, 8, 19 - height * 0.12, 7, 0, 0, TAU);
    ctx.fill();
    if (height > 2) {
      ctx.strokeStyle = player ? "#9ee6ed66" : "#ffbd8c55";
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -height);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  ctx.translate(0, -height);
  ctx.rotate(angle);
  if (ghost) ctx.globalAlpha *= 0.25;
  // Trailing scarf, wrapped hood, a single visible eye slit and a real blade silhouette.
  const flutter = Math.sin(t * 13 + a.x) * 5;
  ctx.fillStyle = player ? "#f15d5a" : "#96728d";
  ctx.beginPath();
  ctx.moveTo(-7, -6);
  ctx.lineTo(-38, -15 + flutter);
  ctx.lineTo(-59, -5 + flutter);
  ctx.lineTo(-32, -5 + flutter);
  ctx.lineTo(-9, 1);
  ctx.fill();
  ctx.fillStyle = player ? "#172735" : "#3e3448";
  ctx.strokeStyle = player ? "#77939e" : "#a58ca3";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(9, -10);
  ctx.lineTo(16, -1);
  ctx.lineTo(8, 12);
  ctx.lineTo(-9, 10);
  ctx.lineTo(-15, -3);
  ctx.lineTo(-6, -13);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  line(
    ctx,
    [
      [-9, -6],
      [-18, -13],
      [-22, -8],
    ],
    "#697584",
    5,
  );
  line(
    ctx,
    [
      [-8, 8],
      [-18, 15],
      [-23, 13],
    ],
    "#697584",
    5,
  );
  circle(ctx, 5, -2, r * 0.62, player ? "#233949" : "#4a4158", true);
  line(
    ctx,
    [
      [8, -9],
      [13, -5],
      [12, 1],
    ],
    player ? "#c7f7f0" : "#f8a29a",
    2.3,
  );
  line(
    ctx,
    [
      [5, 11],
      [17, 20],
    ],
    "#495666",
    5,
  );
  line(
    ctx,
    [
      [17, 20],
      [39, 2],
    ],
    player ? "#f2f7e4" : "#f9a8a0",
    2.5,
  );
  line(
    ctx,
    [
      [15, 15],
      [22, 20],
    ],
    "#dbbc8a",
    2,
  );
  if (a.type === "spitter" && !player) {
    circle(ctx, 0, 0, 25, "#efba7466");
    line(
      ctx,
      [
        [15, -5],
        [29, -11],
        [24, 3],
      ],
      "#edc58d",
      2,
    );
  }
  if (a.type === "crawler" && !player)
    line(
      ctx,
      [
        [-8, -15],
        [-29, -22],
      ],
      "#e987a5",
      4,
    );
  if (a.flashUntil > t && !ghost) {
    ctx.globalAlpha = 0.65;
    circle(ctx, 4, 0, 18, "#e8fcfa");
  }
  ctx.restore();
  if (!ghost && a.hp < a.maxHP) {
    ctx.fillStyle = "#202332";
    ctx.fillRect(a.x - 19, a.y - height - 30, 38, 3);
    ctx.fillStyle = player ? "#9ce1d5" : "#eb817a";
    ctx.fillRect(a.x - 19, a.y - height - 30, (38 * a.hp) / a.maxHP, 3);
  }
  if (a.airHeight > 0 && !player) {
    ctx.fillStyle = "#dbeff2";
    ctx.font = "11px monospace";
    ctx.fillText("↑", a.x - 4, a.y - height - 38);
  }
}
export function renderNinja(
  ctx,
  game,
  time = 0,
  { shake = true, reducedFlash = false } = {},
) {
  const w = ctx.canvas.width,
    h = ctx.canvas.height,
    p = game?.player || { x: 1200, y: 800 },
    t = game?.t || time;
  const camera = {
    x: Math.max(
      0,
      Math.min(CONFIG.width - w, p.x - w / 2 + (p.lastMove?.x || 0) * 22),
    ),
    y: Math.max(
      0,
      Math.min(CONFIG.height - h, p.y - h / 2 + (p.lastMove?.y || 0) * 22),
    ),
  };
  ctx.fillStyle = "#101724";
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  const amount = shake && game?.shakeUntil > t ? game.shakeStrength : 0;
  ctx.translate(
    -camera.x + Math.sin(time * 113) * amount,
    -camera.y + Math.cos(time * 97) * amount,
  );
  ctx.fillStyle = "#17202c";
  ctx.fillRect(40, 40, CONFIG.width - 80, CONFIG.height - 80);
  for (let x = Math.floor(camera.x / 64) * 64; x < camera.x + w + 64; x += 64)
    for (
      let y = Math.floor(camera.y / 64) * 64;
      y < camera.y + h + 64;
      y += 64
    ) {
      ctx.fillStyle = (x + y) % 128 ? "#1b2531" : "#19232f";
      ctx.fillRect(x + 1, y + 1, 62, 62);
      line(
        ctx,
        [
          [x + 3, y + 61],
          [x + 60, y + 61],
        ],
        "#2c384044",
      );
    }
  for (let i = 0; i < 9; i++) {
    const x = 130 + i * 260,
      y = 180 + (i % 3) * 410;
    ctx.strokeStyle = "#95b6bb08";
    ctx.lineWidth = 2;
    circle(ctx, x, y, 95, "#95b6bb08");
    line(
      ctx,
      [
        [x - 105, y],
        [x + 105, y],
      ],
      "#95b6bb06",
    );
  }
  for (const o of OBSTACLES) {
    ctx.fillStyle = "#090e19aa";
    ctx.fillRect(o.x + 14, o.y + 20, o.w, o.h);
    ctx.fillStyle = "#29323e";
    ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.strokeStyle = "#4a535e";
    ctx.strokeRect(o.x, o.y, o.w, o.h);
    ctx.fillStyle = "#111825";
    ctx.fillRect(o.x + 8, o.y + 10, o.w - 16, o.h - 20);
    for (let x = o.x + 12; x < o.x + o.w; x += 12)
      line(
        ctx,
        [
          [x, o.y + 7],
          [x, o.y + o.h - 7],
        ],
        "#3b4652",
      );
    line(
      ctx,
      [
        [o.x - 5, o.y],
        [o.x + o.w + 5, o.y],
      ],
      "#84908b",
      3,
    );
    circle(ctx, o.x + 10, o.y + o.h + 10, 6, "#fb8767", true);
    circle(ctx, o.x + 10, o.y + o.h + 10, 20, "#f7725013", true);
  }
  line(
    ctx,
    [
      [40, 40],
      [CONFIG.width - 40, 40],
      [CONFIG.width - 40, CONFIG.height - 40],
      [40, CONFIG.height - 40],
      [40, 40],
    ],
    "#7f8f9a",
    4,
  );
  for (let i = 0; i < 20; i++) {
    const x = camera.x + ((i * 163 + time * (10 + (i % 4))) % (w + 70)) - 35,
      y = camera.y + ((i * 91 + time * 13) % (h + 50)) - 25;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(time * 0.6 + i);
    ctx.fillStyle = "#ca71854d";
    ctx.fillRect(0, 0, 5, 2);
    ctx.restore();
  }
  if (game) {
    for (const o of game.orbs) {
      circle(ctx, o.x, o.y, 9, "#91d7d022", true);
      circle(ctx, o.x, o.y, 3, "#afdfca", true);
    }
    for (const e of game.effects) {
      if (e.type !== "afterimage") continue;
      fighter(
        ctx,
        {
          ...p,
          x: e.x,
          y: e.y,
          face: e.face,
          airHeight: e.airHeight,
          attack: null,
        },
        t,
        true,
      );
    }
    for (const a of [...game.enemies, p].sort((a, b) => a.y - b.y))
      if (!a.dead) fighter(ctx, a, t);
    for (const b of game.projectiles) {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.angle);
      line(
        ctx,
        [
          [-17, 0],
          [8, 0],
        ],
        b.actor === p ? "#a7eee4" : "#fc8b79",
        3,
      );
      line(
        ctx,
        [
          [5, -5],
          [13, 0],
          [5, 5],
        ],
        "#e0e7e0",
        2,
      );
      ctx.restore();
    }
    for (const e of game.effects) {
      const q = (t - e.born) / e.life;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - q);
      if (e.type === "ninja-slash") {
        const y = e.y - (e.airHeight || 0) * 48;
        ctx.strokeStyle = e.counter
          ? "#ffbd87"
          : e.strike === 3
            ? "#e3fff7"
            : "#a1eee4";
        ctx.shadowColor = "#71d8d9";
        ctx.shadowBlur = reducedFlash ? 0 : 12;
        ctx.lineWidth = e.strike === 3 ? 11 : 6;
        ctx.beginPath();
        ctx.arc(
          e.x,
          y,
          e.range * (0.65 + q * 0.35),
          e.angle - e.cone / 2 + q * 0.2,
          e.angle + e.cone / 2 + q * 0.2,
        );
        ctx.stroke();
        ctx.lineWidth = 1.3;
        ctx.strokeStyle = "#ffffff";
        ctx.stroke();
      } else if (["impact", "landing", "jump"].includes(e.type)) {
        ctx.lineWidth = e.type === "impact" ? 4 : 1;
        circle(ctx, e.x, e.y, (e.range || 35) * (0.4 + q * 0.6), "#c7eee3");
        if (e.type === "impact")
          for (let i = 0; i < 8; i++) {
            const a = (i * TAU) / 8;
            line(
              ctx,
              [
                [e.x + Math.cos(a) * 25, e.y + Math.sin(a) * 25],
                [e.x + Math.cos(a) * 90 * q, e.y + Math.sin(a) * 90 * q],
              ],
              "#c7eee3",
              2,
            );
          }
      } else if (e.type === "follow") {
        line(
          ctx,
          [
            [e.x, e.y],
            [e.end.x, e.end.y - 42],
          ],
          "#92e7df",
          2,
        );
      } else if (e.type === "perfect") {
        ctx.lineWidth = 2;
        circle(ctx, e.x, e.y, 35 + q * 50, "#f4bf7b");
        line(
          ctx,
          [
            [e.x - 20 - q * 20, e.y],
            [e.x + 20 + q * 20, e.y],
          ],
          "#fff0cd",
          2,
        );
      } else if (e.type === "launch") {
        line(
          ctx,
          [
            [e.x - 9, e.y - 30 - q * 25],
            [e.x, e.y - 42 - q * 25],
            [e.x + 9, e.y - 30 - q * 25],
          ],
          "#baf5ed",
          2,
        );
      } else if (e.type === "death") {
        for (let i = 0; i < 7; i++) {
          const a = (i * TAU) / 7;
          line(
            ctx,
            [
              [e.x + Math.cos(a) * q * 25, e.y + Math.sin(a) * q * 25],
              [e.x + Math.cos(a) * q * 50, e.y + Math.sin(a) * q * 50],
            ],
            "#d79591",
            2,
          );
        }
      }
      ctx.restore();
    }
    // Hostile telegraphs always render last over player FX.
    for (const a of game.enemies) {
      const e = a.telegraph;
      if (!e) continue;
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.rotate(e.angle);
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#ff8b70";
      ctx.fillStyle = "#ff6b5726";
      const progress = Math.min(1, (t - e.born) / (e.at - e.born));
      if (e.kind === "spit") {
        ctx.fillRect(0, -11, e.range, 22);
        line(
          ctx,
          [
            [0, 0],
            [e.range * progress, 0],
          ],
          "#ffb08a",
          2,
        );
      } else {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, e.range, -1.25, 1.25);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        circle(ctx, 0, 0, 20 + progress * 12, "#ffbd8f");
      }
      ctx.restore();
    }
    for (const n of game.numbers) {
      ctx.globalAlpha = 1 - (t - n.born) / 0.6;
      ctx.fillStyle = n.color;
      ctx.font = "bold 14px monospace";
      ctx.fillText(Math.round(n.text), n.x, n.y - (t - n.born) * 40);
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  const vignette = ctx.createRadialGradient(
    w / 2,
    h / 2,
    h * 0.22,
    w / 2,
    h / 2,
    w * 0.68,
  );
  vignette.addColorStop(0, "#070b1200");
  vignette.addColorStop(1, "#060a127a");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);
  return camera;
}
