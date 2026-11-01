import { WORLD, surfaceBelow } from "./physics2d.js";
const TAU = Math.PI * 2;
function line(c, points, color, width = 1) {
  c.strokeStyle = color;
  c.lineWidth = width;
  c.beginPath();
  points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.stroke();
}
function ellipse(c, x, y, rx, ry, color) {
  c.fillStyle = color;
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, TAU);
  c.fill();
}
function ninja(c, a, t, ghost = false) {
  c.save();
  c.translate(a.x, a.y);
  c.scale(a.facing, 1);
  c.globalAlpha = ghost ? 0.2 : 1;
  const player = a.team === "player",
    heavy = ["elite", "boss"].includes(a.type),
    run = Math.abs(a.vx) > 30 && a.grounded,
    swing = Math.sin(t * 16) * 7;
  c.fillStyle = player ? "#dfe6df" : heavy ? "#a1a6b5" : "#9fa4b5";
  c.strokeStyle = player ? "#9ee6df" : "#e5a6a0";
  // Hood, eye slit, flowing scarf and jointed legs are deliberately original silhouettes.
  c.fillStyle = player ? "#34475c" : heavy ? "#434054" : "#333347";
  c.beginPath();
  c.moveTo(-9, -21);
  c.lineTo(6, -25);
  c.lineTo(13, -13);
  c.lineTo(7, -6);
  c.lineTo(-10, -8);
  c.closePath();
  c.fill();
  line(
    c,
    [
      [5, -17],
      [13, -16],
    ],
    player ? "#ddf9e5" : "#ffb697",
    2,
  );
  c.fillStyle = player ? "#ed7067" : "#9d6079";
  c.beginPath();
  c.moveTo(-7, -10);
  c.lineTo(-29, -14 + Math.sin(t * 10) * 4);
  c.lineTo(-48, -8 + Math.sin(t * 8) * 6);
  c.lineTo(-29, -7);
  c.lineTo(-6, -5);
  c.fill();
  c.fillStyle = player ? "#263b4b" : heavy ? "#4e4656" : "#424256";
  c.beginPath();
  c.moveTo(-8, -7);
  c.lineTo(7, -6);
  c.lineTo(10, 12);
  c.lineTo(-10, 12);
  c.closePath();
  c.fill();
  line(
    c,
    [
      [-4, 10],
      [-8 + (run ? swing : 0), 20],
      [-12 + (run ? swing : 0), 25],
    ],
    "#71818d",
    5,
  );
  line(
    c,
    [
      [4, 10],
      [6 - (run ? swing : 0), 19],
      [12 - (run ? swing : 0), 25],
    ],
    "#566779",
    5,
  );
  line(
    c,
    [
      [3, -1],
      [15, 7],
      [22, 4],
    ],
    "#708993",
    4,
  );
  line(
    c,
    [
      [18, 6],
      [43, -7],
    ],
    player ? "#e1f4dd" : "#deaaa6",
    2,
  );
  line(
    c,
    [
      [19, 1],
      [24, 11],
    ],
    "#d6b493",
    2,
  );
  if (a.type === "thrower") {
    line(
      c,
      [
        [12, -4],
        [21, -15],
        [26, -6],
        [15, -7],
      ],
      "#d3bc97",
      2,
    );
  }
  if (heavy) {
    c.fillStyle = "#6b6073";
    c.fillRect(-15, -5, 9, 18);
    c.fillRect(7, -6, 11, 17);
    line(
      c,
      [
        [16, 4],
        [49, -2],
      ],
      "#aeb4c3",
      5,
    );
  }
  if (a.flashUntil > t && !ghost) {
    c.strokeStyle = "#effff0";
    c.strokeRect(-14, -26, 28, 52);
  }
  c.restore();
  if (!ghost && a.hp < a.maxHP) {
    c.fillStyle = "#272d3a";
    c.fillRect(a.x - 19, a.y - 38, 38, 3);
    c.fillStyle = player ? "#9bded4" : "#ed897c";
    c.fillRect(a.x - 19, a.y - 38, 38 * Math.max(0, a.hp / a.maxHP), 3);
  }
}
export function renderSide(
  c,
  g,
  time = 0,
  { shake = true, lowFlash = false } = {},
) {
  const w = c.canvas.width,
    h = c.canvas.height,
    p = g?.player || { x: 200, y: 974 },
    t = g?.t || time;
  const targetX = Math.max(
    0,
    Math.min(WORLD.width - w, p.x - w * 0.34 + (p.facing || 1) * 45),
  );
  const targetY = Math.max(180, Math.min(WORLD.height - h, p.y - h * 0.75));
  const camera = g
    ? (g.camera ??= { x: targetX, y: targetY })
    : { x: targetX, y: targetY };
  camera.x += (targetX - camera.x) * 0.12;
  camera.y += (targetY - camera.y) * 0.1;
  const bg = c.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, "#0d1423");
  bg.addColorStop(1, "#273047");
  c.fillStyle = bg;
  c.fillRect(0, 0, w, h);
  ellipse(c, w * 0.77 - camera.x * 0.06, 100, 53, 53, "#d8dfd3");
  ellipse(c, w * 0.77 - 18 - camera.x * 0.06, 90, 47, 47, "#152036");
  for (let layer = 0; layer < 3; layer++) {
    const speed = 0.12 + layer * 0.1;
    for (let i = -1; i < 14; i++) {
      const x = i * 190 - ((camera.x * speed) % 190),
        base = h - 70 - layer * 42,
        height = 90 + ((i * 71) % 90);
      c.fillStyle = ["#1b2539", "#1c293c", "#203047"][layer];
      c.fillRect(x, base - height, 175, height + 100);
      c.beginPath();
      c.moveTo(x - 16, base - height);
      c.lineTo(x + 80, base - height - 35);
      c.lineTo(x + 190, base - height);
      c.fill();
      for (let k = 0; k < 4; k++) {
        c.fillStyle = "#dac6a21a";
        c.fillRect(x + 20 + k * 36, base - height + 22, 6, 13);
      }
    }
  }
  c.save();
  const amount = shake && g?.shakeUntil > t ? g.shakeStrength : 0;
  c.translate(
    -camera.x + Math.sin(time * 110) * amount,
    -camera.y + Math.cos(time * 91) * amount,
  );
  if (g) {
    for (const s of g.platforms) {
      if (s.x + s.width < camera.x - 100 || s.x > camera.x + w + 100) continue;
      c.fillStyle = "#080d17aa";
      c.fillRect(s.x + 9, s.y + 14, s.width, s.height);
      c.fillStyle = s.oneWay ? "#3d4c58" : "#263542";
      c.fillRect(s.x, s.y, s.width, s.oneWay ? 13 : s.height);
      line(
        c,
        [
          [s.x - 4, s.y],
          [s.x + s.width + 4, s.y],
        ],
        "#8faaa7",
        3,
      );
      for (let x = s.x + 12; x < s.x + s.width; x += 26)
        line(
          c,
          [
            [x, s.y + 4],
            [x - 9, s.y + 12],
          ],
          "#6b81835a",
        );
      if (!s.oneWay)
        for (let y = s.y + 28; y < s.y + s.height; y += 32)
          line(
            c,
            [
              [s.x, y],
              [s.x + s.width, y],
            ],
            "#42506433",
          );
    }
    for (const [x, label] of [
      [1100, "一"],
      [3300, "二"],
    ]) {
      line(
        c,
        [
          [x, 1000],
          [x, 934],
        ],
        "#536b78",
        3,
      );
      c.fillStyle = "#b95257";
      c.fillRect(x, 936, 28, 26);
      c.fillStyle = "#ecd6b8";
      c.font = "15px serif";
      c.fillText(label, x + 5, 955);
    }
    for (const a of [...g.enemies, p]) {
      const surface = surfaceBelow(a.x, a.y + a.halfHeight, g.platforms, 500);
      if (surface) ellipse(c, a.x, surface.y - 2, 18, 3, "#02060c70");
    }
    for (const e of g.effects)
      if (e.type === "afterimage")
        ninja(c, { ...p, x: e.x, y: e.y, facing: e.facing }, t, true);
    for (const e of g.enemies) if (!e.dead) ninja(c, e, t);
    if (!p.dead) ninja(c, p, t);
    for (const b of g.projectiles) {
      line(
        c,
        [
          [b.x - 12, b.y],
          [b.x + 7, b.y],
        ],
        "#efa787",
        3,
      );
    }
    for (const e of g.effects) {
      const q = (t - e.born) / e.life;
      c.save();
      c.globalAlpha = 1 - q;
      if (e.type === "slash" || e.type === "hostile-slash") {
        const angle =
            e.dir === "up"
              ? -Math.PI / 2
              : e.dir === "down"
                ? Math.PI / 2
                : e.facing === 1
                  ? 0
                  : Math.PI,
          range = e.range || 90;
        c.strokeStyle =
          e.type === "hostile-slash"
            ? "#f59b83"
            : e.counter
              ? "#ffcf95"
              : e.finisher
                ? "#dbffe3"
                : "#9ee5de";
        c.lineWidth = e.finisher ? 10 : e.strike === 3 ? 8 : 5;
        c.shadowColor = "#84dfd4";
        c.shadowBlur = lowFlash ? 0 : 10;
        c.beginPath();
        c.arc(e.x, e.y, range * (0.55 + q * 0.4), angle - 0.72, angle + 0.72);
        c.stroke();
        line(
          c,
          [
            [e.x + Math.cos(angle) * 20, e.y + Math.sin(angle) * 20],
            [e.x + Math.cos(angle) * range, e.y + Math.sin(angle) * range],
          ],
          "#effff099",
          1,
        );
      } else if (
        ["jump", "pogo", "impact", "respawn", "death"].includes(e.type)
      ) {
        c.strokeStyle = e.type === "death" ? "#ef8e8a" : "#b7eddf";
        c.lineWidth = 2;
        c.beginPath();
        c.ellipse(
          e.x,
          e.y,
          e.type === "impact" ? 70 * q : 20 + q * 20,
          6 + q * 12,
          0,
          0,
          TAU,
        );
        c.stroke();
        if (e.type === "impact")
          line(
            c,
            [
              [e.x, e.y - 45],
              [e.x, e.y + 15],
            ],
            "#d9f7e6",
            3,
          );
      } else if (e.type === "perfect") {
        c.strokeStyle = "#f2ca91";
        c.lineWidth = 2;
        c.beginPath();
        c.arc(e.x, e.y, 30 + q * 35, 0, TAU);
        c.stroke();
        line(
          c,
          [
            [e.x - 50 * q, e.y],
            [e.x + 50 * q, e.y],
          ],
          "#f6d9b0",
          2,
        );
      }
      c.restore();
    }
    // Readable enemy tells are the highest combat layer.
    for (const e of g.enemies) {
      const a = e.telegraph;
      if (!a) continue;
      const prog = Math.min(1, (t - a.born) / (a.at - a.born));
      c.fillStyle = "#ff725325";
      c.strokeStyle = "#ffad86";
      c.lineWidth = 1.5;
      if (a.kind === "throw") {
        line(
          c,
          [
            [e.x, e.y],
            [
              e.x + Math.cos(a.angle) * a.range * prog,
              e.y + Math.sin(a.angle) * a.range * prog,
            ],
          ],
          "#ffac88",
          2,
        );
      } else {
        const x = a.facing === 1 ? e.x : e.x - a.range;
        c.fillRect(x, e.y - 38, a.range, 76);
        c.strokeRect(x, e.y - 38, a.range, 76);
        line(
          c,
          [
            [x, e.y + 37],
            [x + a.range * prog, e.y + 37],
          ],
          "#ffd5a6",
          3,
        );
      }
    }
    for (const n of g.numbers) {
      c.globalAlpha = 1 - (t - n.born) / 0.6;
      c.fillStyle = "#f8d6b8";
      c.font = "bold 14px monospace";
      c.fillText(n.text, n.x, n.y - (t - n.born) * 35);
    }
    c.globalAlpha = 1;
  }
  c.restore();
  const v = c.createRadialGradient(
    w / 2,
    h / 2,
    h * 0.2,
    w / 2,
    h / 2,
    w * 0.65,
  );
  v.addColorStop(0, "#070b1200");
  v.addColorStop(1, "#070b1277");
  c.fillStyle = v;
  c.fillRect(0, 0, w, h);
  return camera;
}
