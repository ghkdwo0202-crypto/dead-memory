import { CONFIG, ORGANS, OBSTACLES, ENEMIES, SLOT_COLORS } from "./data.js";
const TAU = Math.PI * 2;
function circle(ctx, x, y, r, fill, stroke) {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.01, r), 0, TAU);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}
function poly(ctx, points, fill, stroke) {
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
export function body(ctx, actor, t) {
  const player = actor.team === "player",
    hunter = actor.team === "hunter",
    type = actor.type,
    enemy = ENEMIES[type],
    r = actor.radius || 15,
    color = player ? "#f0d4b2" : hunter ? "#f48f81" : enemy?.color || "#c0ac82";
  ctx.save();
  ctx.translate(actor.x, actor.y);
  circle(ctx, 0, 10, r + 5, "#0005");
  const wobble = Math.sin(t * 8 + actor.x) * 1.4;
  ctx.translate(0, wobble);
  if (actor.invulnerableUntil > t) {
    ctx.globalAlpha = 0.65;
    circle(ctx, 0, 0, r + 12, null, "#e8d9ae");
  }
  if (actor.flashUntil > t) {
    ctx.shadowColor = "#ffeed0";
    ctx.shadowBlur = 15;
  }
  if (player || hunter) {
    if (actor.organs.back === "BACK_TENTACLE") {
      ctx.strokeStyle = "#b6b775";
      ctx.lineWidth = 6;
      for (const sign of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(sign * 9, 4);
        ctx.quadraticCurveTo(
          sign * 42,
          17 + Math.sin(t * 4) * 10,
          sign * 32,
          -18,
        );
        ctx.stroke();
        ctx.fillStyle = "#e0b198";
        ctx.fillRect(sign * 32 - 3, -22, 6, 9);
      }
    }
    if (actor.organs.back === "BACK_TURRET") {
      poly(
        ctx,
        [
          [-23, 2],
          [-24, -15],
          [0, -29],
          [24, -15],
          [23, 2],
        ],
        "#4d5840",
        "#b0b982",
      );
      ctx.fillStyle = "#a5b678";
      ctx.fillRect(-6, -38, 12, 17);
      ctx.fillStyle = "#292b20";
      ctx.fillRect(-3, -38, 6, 5);
    }
    if (actor.organs.back === "BACK_BLADES")
      for (let i = 0; i < 2; i++) {
        const a = t * 3.5 + i * Math.PI,
          x = Math.cos(a) * 80,
          y = Math.sin(a) * 80;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(a + t * 5);
        poly(
          ctx,
          [
            [-17, -4],
            [4, -7],
            [18, 4],
            [-5, 7],
          ],
          "#cec7a4",
          "#ece0b4",
        );
        ctx.restore();
        circle(ctx, 0, 0, 80, null, "#b1b87812");
      }
    // Separate stitched torso, boots, arm graft, heart and eye silhouettes.
    ctx.fillStyle = "#544a36";
    ctx.fillRect(-11, 11, 8, 10);
    ctx.fillRect(4, 11, 8, 10);
    poly(
      ctx,
      [
        [-16, 7],
        [-13, -12],
        [0, -20],
        [14, -12],
        [17, 10],
        [2, 15],
      ],
      hunter ? "#6c473b" : "#8d7856",
      color,
    );
    ctx.strokeStyle = "#352b22";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-7, -9);
    ctx.lineTo(7, 9);
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-8 + i * 4, -3 + i * 4);
      ctx.lineTo(-3 + i * 4, -6 + i * 4);
      ctx.stroke();
    }
    circle(ctx, 0, -12, 8, hunter ? "#c68e72" : "#e0c49a", "#4a3c2c");
    if (actor.organs.heart) {
      const pulse = 1 + Math.sin(t * 6) * 0.15;
      circle(
        ctx,
        -1,
        3,
        4 * pulse,
        actor.organs.heart === "HEART_BLAST" ? "#f5b35d" : "#e57071",
      );
    }
    if (actor.organs.eye) {
      ctx.fillStyle = actor.organs.eye === "EYE_BLOOD" ? "#f59c8f" : "#d5e7a2";
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 8;
      ctx.fillRect(-6, -15, 12, 4);
      ctx.shadowBlur = 0;
    }
    ctx.save();
    ctx.rotate(actor.face || 0);
    ctx.fillStyle = "#b3a17a";
    ctx.fillRect(10, -2, 19, 9);
    if (actor.organs.arm === "ARM_SPINE") {
      poly(
        ctx,
        [
          [16, -9],
          [32, -7],
          [42, 1],
          [31, 8],
          [18, 7],
        ],
        "#7d8160",
        "#dcdbac",
      );
      for (let i = 0; i < 3; i++)
        poly(
          ctx,
          [
            [25 + i * 4, -6],
            [29 + i * 4, -17 + i * 2],
            [32 + i * 4, -5],
          ],
          "#dbd6ac",
        );
    } else {
      circle(ctx, 29, 2, 13, "#8e8d6a", "#e4d2a3");
      ctx.save();
      ctx.translate(29, 2);
      ctx.rotate(t * (actor.attack ? 18 : 2));
      for (let i = 0; i < 9; i++) {
        const a = (i * TAU) / 9;
        poly(
          ctx,
          [
            [Math.cos(a) * 11, Math.sin(a) * 11],
            [Math.cos(a + 0.12) * 18, Math.sin(a + 0.12) * 18],
            [Math.cos(a + 0.4) * 11, Math.sin(a + 0.4) * 11],
          ],
          "#cfca9e",
        );
      }
      ctx.restore();
      circle(ctx, 29, 2, 4, "#514d37");
    }
    ctx.restore();
  } else {
    const s = type === "boss" ? 1.9 : type === "elite" ? 1.35 : 1;
    ctx.scale(s, s);
    if (type === "crawler") {
      ctx.strokeStyle = "#a6b579";
      ctx.lineWidth = 3;
      for (const sign of [-1, 1])
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(sign * 9, -7 + i * 7);
          ctx.lineTo(sign * (20 + Math.sin(t * 13 + i) * 3), -10 + i * 9);
          ctx.stroke();
        }
      poly(
        ctx,
        [
          [-10, -5],
          [0, -14],
          [11, -4],
          [7, 10],
          [-6, 9],
        ],
        "#6c7250",
        color,
      );
    } else if (type === "spitter") {
      circle(ctx, 0, 0, 17, "#666f3d", color);
      circle(ctx, 0, -7, 11, "#9a9f58");
      circle(ctx, 1, 3, 6, "#2f3b24", "#bcca69");
      circle(ctx, 0, 3, 2, "#c8db7b");
    } else if (type === "exploder") {
      poly(
        ctx,
        [
          [-17, 5],
          [-13, -12],
          [1, -20],
          [15, -10],
          [19, 9],
          [0, 17],
        ],
        "#865539",
        color,
      );
      for (const [x, y] of [
        [-7, -4],
        [6, 5],
        [4, -11],
      ])
        circle(ctx, x, y, 4 + Math.sin(t * 5) * 0.5, "#cf9157", "#f0be7e");
    } else {
      poly(
        ctx,
        [
          [-17, 7],
          [-15, -7],
          [-6, -17],
          [9, -14],
          [17, 1],
          [12, 16],
          [-4, 18],
        ],
        type === "boss" ? "#895d45" : type === "elite" ? "#665b43" : "#73735b",
        color,
      );
      ctx.fillStyle = "#252a1d";
      ctx.fillRect(-7, -6, 4, 4);
      ctx.fillRect(4, -6, 4, 4);
      ctx.fillStyle = "#c9b783";
      ctx.fillRect(-4, 4, 10, 4);
      if (type === "elite" || type === "boss") {
        ctx.strokeStyle = "#d5bf90";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-15, 3);
        ctx.lineTo(-29, -6);
        ctx.quadraticCurveTo(-37, -17, -27, -19);
        ctx.stroke();
        ctx.fillStyle = "#382c21";
        ctx.fillRect(10, 0, 19, 13);
        if (type === "boss") {
          ctx.fillStyle = "#d7c4a2";
          ctx.fillRect(21, -9, 16, 29);
          ctx.fillStyle = "#655d47";
          ctx.fillRect(22, 11, 14, 5);
          ctx.fillStyle = "#49382c";
          ctx.fillRect(-7, 9, 21, 12);
        }
      }
    }
  }
  ctx.shadowBlur = 0;
  if (actor.hp < actor.maxHP && !actor.dead) {
    ctx.fillStyle = "#262d20";
    ctx.fillRect(-r, -r - 13, r * 2, 3);
    ctx.fillStyle = player ? "#dfca8a" : hunter ? "#ee8e80" : "#bfbc88";
    ctx.fillRect(-r, -r - 13, r * 2 * Math.max(0, actor.hp / actor.maxHP), 3);
  }
  if (actor.statuses?.bleed) circle(ctx, 0, 0, r + 5, null, "#c56c5a88");
  if (actor.markUntil > t) {
    ctx.strokeStyle = "#f4d486";
    for (const sign of [-1, 1]) {
      ctx.strokeRect(sign * (r + 7) - 3, -r - 5, 6, 6);
    }
  }
  if (actor.statuses?.shock) {
    ctx.strokeStyle = "#d7d77a";
    ctx.beginPath();
    ctx.moveTo(-r, -r);
    ctx.lineTo(-r + 7, -2);
    ctx.lineTo(-r, 9);
    ctx.stroke();
  }
  ctx.restore();
}
export function render(ctx, game, realTime = 0) {
  const w = ctx.canvas.width,
    h = ctx.canvas.height,
    p = game?.player || { x: 1200, y: 800 },
    t = game?.t || realTime;
  const camera = {
    x: Math.max(0, Math.min(CONFIG.width - w, p.x - w / 2)),
    y: Math.max(0, Math.min(CONFIG.height - h, p.y - h / 2)),
  };
  ctx.fillStyle = "#1d251a";
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.translate(-camera.x, -camera.y);
  ctx.fillStyle = "#263021";
  ctx.fillRect(40, 40, CONFIG.width - 80, CONFIG.height - 80);
  const tile = 80;
  for (
    let x = Math.floor(camera.x / tile) * tile;
    x < camera.x + w + tile;
    x += tile
  )
    for (
      let y = Math.floor(camera.y / tile) * tile;
      y < camera.y + h + tile;
      y += tile
    ) {
      if (x < 40 || y < 40 || x > CONFIG.width - 80 || y > CONFIG.height - 80)
        continue;
      const n = (x * 13 + y * 17) % 29;
      ctx.fillStyle = n < 12 ? "#2b3425" : "#283222";
      ctx.fillRect(x + 1, y + 1, 78, 78);
      ctx.strokeStyle = "#3e493029";
      ctx.strokeRect(x + 3, y + 3, 74, 74);
      if (n < 6) {
        ctx.fillStyle = "#929b6233";
        ctx.fillRect(x + 12, y + 15, 3, 2);
        ctx.fillRect(x + 52, y + 53, 7, 2);
      }
      if (n % 9 === 0) {
        ctx.strokeStyle = "#1a251b88";
        ctx.beginPath();
        ctx.moveTo(x + 18, y);
        ctx.lineTo(x + 30, y + 20);
        ctx.lineTo(x + 23, y + 32);
        ctx.stroke();
      }
    }
  // Old market markings and wash drains.
  for (let i = 0; i < 6; i++) {
    const x = 180 + (i % 3) * 760,
      y = 200 + Math.floor(i / 3) * 1100;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "#a0a26b24";
    ctx.font = "bold 54px monospace";
    ctx.fillText(`LOT 0${i + 1}`, 0, 0);
    ctx.font = "10px monospace";
    ctx.fillText("HUMAN RESOURCES / NO REFUNDS", 0, 23);
    ctx.restore();
  }
  for (let i = 0; i < 14; i++) {
    const x = 150 + ((i * 181) % 2120),
      y = 140 + ((i * 251) % 1310);
    ctx.fillStyle = "#151f1599";
    ctx.fillRect(x, y, 36, 15);
    ctx.strokeStyle = "#6d754240";
    for (let j = 0; j < 6; j++) {
      ctx.beginPath();
      ctx.moveTo(x + 3 + j * 6, y + 3);
      ctx.lineTo(x + 3 + j * 6, y + 12);
      ctx.stroke();
    }
    circle(ctx, x + 40, y + 35, 13 + (i % 9), "#67493214");
  }
  ctx.strokeStyle = "#66734a";
  ctx.lineWidth = 6;
  ctx.strokeRect(40, 40, CONFIG.width - 80, CONFIG.height - 80);
  ctx.strokeStyle = "#a4a66244";
  ctx.lineWidth = 1;
  ctx.strokeRect(51, 51, CONFIG.width - 102, CONFIG.height - 102);
  for (const o of OBSTACLES) {
    ctx.fillStyle = "#10190d77";
    ctx.fillRect(o.x + 12, o.y + 17, o.w, o.h);
    ctx.fillStyle = "#424b32";
    ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.strokeStyle = "#7c8056";
    ctx.lineWidth = 1;
    ctx.strokeRect(o.x, o.y, o.w, o.h);
    ctx.fillStyle = "#535a3a";
    ctx.fillRect(o.x + 7, o.y + 7, o.w - 14, 18);
    ctx.fillStyle = "#232d20";
    ctx.fillRect(o.x + 12, o.y + 38, o.w - 24, o.h - 50);
    ctx.fillStyle = "#c1b16d";
    ctx.fillRect(o.x + 15, o.y + 14, 7, 4);
    ctx.font = "9px monospace";
    ctx.fillStyle = "#9ca679";
    ctx.fillText("COLD STORAGE", o.x + 10, o.y + o.h - 20);
  }
  if (game) {
    if (game.debugTargeting && game.player.arm) {
      const a = game.player.face,
        rule = game.player.arm.targetingRule;
      ctx.save();
      ctx.translate(game.player.x, game.player.y);
      ctx.rotate(a);
      ctx.fillStyle = "#d7d59310";
      ctx.strokeStyle = "#d7d59366";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, rule.distance, -rule.assistAngle, rule.assistAngle);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    for (const orb of game.orbs) {
      const pulse = 2 + Math.sin(t * 5 + orb.x);
      circle(ctx, orb.x, orb.y, 8, "#cad47910");
      poly(
        ctx,
        [
          [orb.x, orb.y - 4 - pulse],
          [orb.x + 4, orb.y],
          [orb.x, orb.y + 4 + pulse],
          [orb.x - 4, orb.y],
        ],
        "#c0cc83",
      );
    }
    for (const hazard of game.hazards) {
      const progress = Math.min(1, (hazard.at - t) / 1.2);
      circle(ctx, hazard.x, hazard.y, hazard.range, "#c1664930", "#e9a778");
      circle(
        ctx,
        hazard.x,
        hazard.y,
        hazard.range * (1 - progress),
        null,
        "#f0bc83",
      );
    }
    for (const enemy of game.enemies) {
      const a = enemy.telegraph;
      if (!a) continue;
      const progress = Math.min(1, (t - a.born) / (a.at - a.born));
      ctx.save();
      ctx.translate(enemy.x, enemy.y);
      ctx.rotate(a.angle);
      ctx.strokeStyle = "#f4ad76";
      ctx.fillStyle = "#e9a55b22";
      ctx.lineWidth = 2;
      if (["hook", "spit", "charge"].includes(a.kind)) {
        ctx.fillRect(
          0,
          -(a.kind === "charge" ? 36 : 12),
          a.range,
          a.kind === "charge" ? 72 : 24,
        );
        ctx.setLineDash([8, 8]);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(a.range * progress, 0);
        ctx.stroke();
        ctx.setLineDash([]);
        poly(
          ctx,
          [
            [a.range - 10, -8],
            [a.range, 0],
            [a.range - 10, 8],
          ],
          "#f3bd83",
        );
      } else {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(
          0,
          0,
          a.range,
          a.kind === "explode" ? -Math.PI : -1.6,
          a.kind === "explode" ? Math.PI : 1.6,
        );
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        circle(ctx, 0, 0, enemy.radius + 9, null, "#ffd28e");
      }
      ctx.restore();
    }
    for (const actor of [...game.enemies, game.player].sort(
      (a, b) => a.y - b.y,
    ))
      if (!actor.dead) body(ctx, actor, t);
    if (p.attack && !p.attack.executed) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.attack.angle);
      ctx.strokeStyle = "#edc88d";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, p.arm.baseStats.range, -0.6, 0.6);
      ctx.stroke();
      ctx.restore();
    }
    if (game.hunter?.attack && !game.hunter.attack.executed) {
      const a = game.hunter.attack;
      ctx.save();
      ctx.translate(game.hunter.x, game.hunter.y);
      ctx.rotate(a.angle);
      ctx.fillStyle = "#f3996e22";
      ctx.fillRect(0, -35, game.hunter.arm.baseStats.range, 70);
      ctx.strokeStyle = "#f5b783";
      ctx.strokeRect(0, -35, game.hunter.arm.baseStats.range, 70);
      ctx.restore();
    }
    for (const projectile of game.projectiles) {
      ctx.save();
      ctx.translate(projectile.x, projectile.y);
      ctx.rotate(projectile.angle);
      ctx.fillStyle =
        projectile.actor.team === "player" ? "#e9d28c" : "#ed9d68";
      poly(
        ctx,
        [
          [-12, -3],
          [10, 0],
          [-12, 3],
        ],
        ctx.fillStyle,
      );
      ctx.fillStyle = projectile.poison ? "#c5d36c" : "#a08a60";
      ctx.fillRect(-14, -1, 9, 2);
      ctx.restore();
    }
    for (const e of game.effects) {
      const q = (t - e.born) / e.life;
      ctx.save();
      ctx.globalAlpha = 1 - q;
      ctx.lineWidth = 2;
      if (e.type === "slash") {
        ctx.translate(e.x, e.y);
        ctx.rotate(e.angle);
        ctx.strokeStyle = e.finisher
          ? "#ffc992"
          : e.dashCut
            ? "#b7e2c8"
            : e.strike === 3
              ? "#ffb87d"
              : e.enemy
                ? "#e9a177"
                : e.clone
                  ? "#c2cb8d"
                  : "#f1d49a";
        ctx.lineWidth = e.finisher
          ? 20
          : e.strike === 3
            ? 13
            : e.special
              ? 16
              : 8;
        ctx.beginPath();
        ctx.arc(
          0,
          0,
          e.range * (0.55 + q * 0.4),
          e.finisher
            ? 0
            : e.special
              ? -2.3
              : e.strike === 2
                ? 0.9 - q * 2.1
                : -1.6 + q * 2.1,
          e.finisher
            ? Math.PI * 2
            : e.special
              ? 2.3
              : e.strike === 2
                ? 1.6 - q * 2.1
                : -0.9 + q * 2.1,
        );
        ctx.stroke();
        for (let i = 0; i < 5; i++) {
          const a = -0.9 + i * 0.45;
          circle(
            ctx,
            Math.cos(a) * e.range * q,
            Math.sin(a) * e.range * q,
            2,
            "#dfc187",
          );
        }
      } else if (
        e.type === "tentacle" ||
        e.type === "chain" ||
        e.type === "charge"
      ) {
        ctx.strokeStyle =
          e.type === "tentacle"
            ? "#c8ae8a"
            : e.type === "chain"
              ? "#d9d87c"
              : "#ef9e73";
        ctx.lineWidth =
          e.type === "charge" ? 30 : e.type === "tentacle" ? 6 : 2;
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        if (e.type === "tentacle")
          ctx.quadraticCurveTo(e.x + 45, e.y - 40, e.end.x, e.end.y);
        else ctx.lineTo(e.end.x, e.end.y);
        ctx.stroke();
        circle(ctx, e.end.x, e.end.y, 8, null, "#d8c8a0");
      } else if (e.type === "dash") {
        for (let i = 0; i < 3; i++)
          circle(
            ctx,
            e.x - Math.cos(e.angle) * i * 19,
            e.y - Math.sin(e.angle) * i * 19,
            14 - i * 3,
            "#ddce9022",
            "#dccd8a33",
          );
      } else {
        const color = e.enemy
          ? "#eaa16e"
          : e.type === "death"
            ? "#b88063"
            : "#cfd396";
        circle(ctx, e.x, e.y, 8 + q * (e.range || 55), null, color);
        circle(ctx, e.x, e.y, 6 + q * (e.range || 55) * 0.65, color + "18");
        for (let i = 0; i < 7; i++) {
          const a = (i * TAU) / 7;
          ctx.fillStyle = color;
          ctx.fillRect(
            e.x + Math.cos(a) * q * 65,
            e.y + Math.sin(a) * q * 65,
            3,
            3,
          );
        }
      }
      ctx.restore();
    }
    for (const n of game.numbers) {
      ctx.globalAlpha = 1 - (t - n.born) / 0.6;
      ctx.font = "bold 14px monospace";
      ctx.fillStyle = n.color;
      ctx.fillText(n.text, n.x - 7, n.y - (t - n.born) * 38);
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  const gradient = ctx.createRadialGradient(
    w / 2,
    h / 2,
    100,
    w / 2,
    h / 2,
    w * 0.7,
  );
  gradient.addColorStop(0, "#10150b00");
  gradient.addColorStop(0.65, "#0d160a28");
  gradient.addColorStop(1, "#071008b0");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#12180d12";
  for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1);
  return camera;
}
