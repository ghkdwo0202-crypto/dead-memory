export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export function lineOfSight(a, b, walkable) {
  const n = Math.ceil(distance(a, b) / 12);
  for (let i = 0; i <= n; i++)
    if (
      !walkable(
        a.x + ((b.x - a.x) * i) / (n || 1),
        a.y + ((b.y - a.y) * i) / (n || 1),
      )
    )
      return false;
  return true;
}
export function findPath(start, goal, walkable, cell = 40) {
  const key = (x, y) => `${x},${y}`,
    sx = Math.floor(start.x / cell),
    sy = Math.floor(start.y / cell),
    gx = Math.floor(goal.x / cell),
    gy = Math.floor(goal.y / cell);
  const queue = [[sx, sy]],
    prev = new Map([[key(sx, sy), null]]);
  let found = false;
  for (let i = 0; i < queue.length && i < 3000; i++) {
    const [x, y] = queue[i];
    if (x === gx && y === gy) {
      found = true;
      break;
    }
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx,
        ny = y + dy,
        k = key(nx, ny);
      if (
        !prev.has(k) &&
        walkable(nx * cell + cell / 2, ny * cell + cell / 2)
      ) {
        prev.set(k, [x, y]);
        queue.push([nx, ny]);
      }
    }
  }
  if (!found) return [];
  let point = [gx, gy],
    path = [];
  while (point) {
    path.push({ x: point[0] * cell + cell / 2, y: point[1] * cell + cell / 2 });
    point = prev.get(key(...point));
  }
  return path.reverse().slice(1);
}
