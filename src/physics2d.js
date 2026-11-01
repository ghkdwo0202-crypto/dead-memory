export const PHYSICS = Object.freeze({
  step: 1 / 60,
  gravity: 1900,
  runSpeed: 270,
  groundAccel: 2400,
  groundBrake: 3000,
  airAccel: 1550,
  jumpSpeed: -680,
  coyote: 0.1,
  jumpBuffer: 0.12,
  jumpHold: 0.18,
  dashSpeed: 620,
  dashDuration: 0.17,
  terminal: 1100,
});
export const WORLD = Object.freeze({ width: 5800, height: 1450 });
export const PLATFORMS = Object.freeze([
  { id: "floor-a", x: 0, y: 1000, width: 1240, height: 300, oneWay: false },
  { id: "floor-b", x: 1450, y: 1000, width: 1400, height: 300, oneWay: false },
  { id: "floor-c", x: 3050, y: 1000, width: 2750, height: 300, oneWay: false },
  { id: "step-wall", x: 680, y: 920, width: 42, height: 80, oneWay: false },
  { id: "ceiling", x: 940, y: 780, width: 180, height: 24, oneWay: false },
  { id: "balcony-a", x: 350, y: 900, width: 210, height: 14, oneWay: true },
  { id: "balcony-b", x: 750, y: 825, width: 150, height: 14, oneWay: true },
  { id: "bridge-a", x: 1250, y: 910, width: 170, height: 14, oneWay: true },
  { id: "stair-a", x: 1800, y: 900, width: 190, height: 14, oneWay: true },
  { id: "stair-b", x: 2030, y: 800, width: 170, height: 14, oneWay: true },
  { id: "stair-c", x: 2240, y: 710, width: 240, height: 14, oneWay: true },
  { id: "bridge-b", x: 2850, y: 905, width: 160, height: 14, oneWay: true },
  { id: "late-wall", x: 3650, y: 920, width: 40, height: 80, oneWay: false },
  { id: "late-balcony", x: 4070, y: 900, width: 210, height: 14, oneWay: true },
]);
export function body2d(x, y, extra = {}) {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    halfWidth: 14,
    halfHeight: 26,
    grounded: false,
    groundPlatformId: null,
    facing: 1,
    coyoteUntil: -1,
    jumpBufferedUntil: 0,
    airDashUsed: false,
    dropUntil: 0,
    ...extra,
  };
}
export function overlap(a, b) {
  return (
    Math.abs(a.x - b.x) < a.halfWidth + b.halfWidth &&
    Math.abs(a.y - b.y) < a.halfHeight + b.halfHeight
  );
}
export function rectOverlap(b, p) {
  return (
    b.x + b.halfWidth > p.x &&
    b.x - b.halfWidth < p.x + p.width &&
    b.y + b.halfHeight > p.y &&
    b.y - b.halfHeight < p.y + p.height
  );
}
export function approach(v, target, amount) {
  return v < target
    ? Math.min(target, v + amount)
    : Math.max(target, v - amount);
}
export function moveBody(b, dx, dy, platforms, now = 0) {
  let wall = false,
    ceiling = false,
    landed = false;
  const steps = Math.max(
    1,
    Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 5),
  );
  for (let i = 0; i < steps; i++) {
    const oldX = b.x;
    b.x += dx / steps;
    for (const p of platforms)
      if (!p.oneWay && rectOverlap(b, p)) {
        if (b.x > oldX) b.x = p.x - b.halfWidth;
        else if (b.x < oldX) b.x = p.x + p.width + b.halfWidth;
        b.vx = 0;
        wall = true;
      }
    const oldBottom = b.y + b.halfHeight,
      oldY = b.y;
    b.y += dy / steps;
    for (const p of platforms) {
      if (b.x + b.halfWidth <= p.x || b.x - b.halfWidth >= p.x + p.width)
        continue;
      if (
        dy >= 0 &&
        oldBottom <= p.y + 0.05 &&
        b.y + b.halfHeight >= p.y &&
        (!p.oneWay || b.dropUntil <= now)
      ) {
        b.y = p.y - b.halfHeight;
        b.vy = 0;
        b.grounded = true;
        b.groundPlatformId = p.id;
        landed = true;
      } else if (
        dy < 0 &&
        !p.oneWay &&
        b.y - b.halfHeight < p.y + p.height &&
        oldY - b.halfHeight >= p.y + p.height - 0.05
      ) {
        b.y = p.y + p.height + b.halfHeight;
        b.vy = 0;
        ceiling = true;
      }
    }
  }
  return { wall, ceiling, landed };
}
export function stepBody(
  b,
  dt,
  platforms,
  now,
  { gravity = PHYSICS.gravity } = {},
) {
  const wasGround = b.grounded;
  b.grounded = false;
  b.groundPlatformId = null;
  b.vy = Math.min(PHYSICS.terminal, b.vy + gravity * dt);
  const result = moveBody(b, b.vx * dt, b.vy * dt, platforms, now);
  if (b.grounded) {
    b.coyoteUntil = now + PHYSICS.coyote;
    b.airDashUsed = false;
  }
  return { ...result, landed: b.grounded && !wasGround };
}
export function jumpBody(b, now, platforms, { down = false } = {}) {
  const ground = platforms.find((p) => p.id === b.groundPlatformId);
  if (down && b.grounded && ground?.oneWay) {
    b.dropUntil = now + 0.25;
    b.y += 3;
    b.vy = 80;
    b.grounded = false;
    b.groundPlatformId = null;
    b.coyoteUntil = 0;
    b.jumpBufferedUntil = 0;
    return "drop";
  }
  if (b.grounded || now <= b.coyoteUntil) {
    b.vy = PHYSICS.jumpSpeed;
    b.grounded = false;
    b.groundPlatformId = null;
    b.coyoteUntil = -1;
    b.jumpBufferedUntil = 0;
    b.jumpStartedAt = now;
    return "jump";
  }
  b.jumpBufferedUntil = now + PHYSICS.jumpBuffer;
  b.bufferedJumpDown = down;
  return "buffer";
}
export function clearLine(a, b, platforms) {
  const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 4));
  for (let i = 1; i < n; i++) {
    const x = a.x + ((b.x - a.x) * i) / n,
      y = a.y + ((b.y - a.y) * i) / n;
    if (
      platforms.some(
        (p) =>
          !p.oneWay &&
          x > p.x &&
          x < p.x + p.width &&
          y > p.y &&
          y < p.y + p.height,
      )
    )
      return false;
  }
  return true;
}
export function surfaceBelow(x, y, platforms, maxDepth = 900) {
  return (
    platforms
      .filter(
        (p) =>
          x >= p.x && x <= p.x + p.width && p.y >= y && p.y - y <= maxDepth,
      )
      .sort((a, b) => a.y - b.y)[0] || null
  );
}
