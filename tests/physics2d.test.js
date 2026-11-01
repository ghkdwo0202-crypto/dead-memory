import test from "node:test";
import assert from "node:assert/strict";
import {
  body2d,
  stepBody,
  jumpBody,
  moveBody,
  PHYSICS,
  clearLine,
  surfaceBelow,
} from "../src/physics2d.js";
const floor = [
  { id: "floor", x: 0, y: 300, width: 1000, height: 80, oneWay: false },
];
function simulate(b, seconds, platforms = floor) {
  for (let i = 1; i <= Math.round(seconds * 60); i++)
    stepBody(b, 1 / 60, platforms, i / 60);
}
test("P3-A gravity and floor · real downward velocity lands body bottom on surface", () => {
  const b = body2d(100, 100);
  simulate(b, 1);
  assert.equal(b.y, 274);
  assert.equal(b.vy, 0);
  assert.equal(b.grounded, true);
  assert.equal(b.groundPlatformId, "floor");
});
test("P3-A swept collision · high speed cannot tunnel through narrow wall or ceiling", () => {
  const platforms = [
    ...floor,
    { id: "wall", x: 150, y: 100, width: 8, height: 200, oneWay: false },
    { id: "ceiling", x: 0, y: 100, width: 140, height: 12, oneWay: false },
  ];
  const b = body2d(100, 200);
  const r = moveBody(b, 300, 0, platforms, 1);
  assert.equal(r.wall, true);
  assert.equal(b.x, 136);
  b.x = 80;
  const c = moveBody(b, 0, -250, platforms, 1);
  assert.equal(c.ceiling, true);
  assert.equal(b.y, 138);
});
test("P3-A one-way · passes upward but lands from above and allows down+Space only", () => {
  const platforms = [
    ...floor,
    { id: "ledge", x: 0, y: 200, width: 250, height: 12, oneWay: true },
  ];
  const b = body2d(100, 240);
  b.vy = PHYSICS.jumpSpeed;
  simulate(b, 0.2, platforms);
  assert.ok(b.y < 174);
  simulate(b, 0.8, platforms);
  assert.equal(b.y, 174);
  assert.equal(jumpBody(b, 1, platforms, { down: true }), "drop");
  for (let i = 1; i <= 30; i++) stepBody(b, 1 / 60, platforms, 1 + i / 60);
  assert.equal(b.y, 274);
});
test("P3-A coyote · allowed within 0.10 seconds; beyond limit queues instead", () => {
  const b = body2d(100, 274, { grounded: true });
  stepBody(b, 1 / 60, floor, 1);
  b.x = 1100;
  stepBody(b, 1 / 60, floor, 1.02);
  assert.equal(jumpBody(b, 1.08, floor), "jump");
  const c = body2d(1100, 274, { coyoteUntil: 1.1 });
  assert.equal(jumpBody(c, 1.11, floor), "buffer");
  assert.equal(c.jumpBufferedUntil, 1.23);
});
test("P3-A surfaces/LOS · no imaginary platform over pit and wall blocks sight", () => {
  assert.equal(surfaceBelow(1100, 100, floor), null);
  assert.equal(clearLine({ x: 50, y: 250 }, { x: 50, y: 400 }, floor), false);
  assert.equal(clearLine({ x: 10, y: 200 }, { x: 300, y: 200 }, floor), true);
});
