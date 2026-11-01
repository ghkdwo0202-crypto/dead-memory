// Same bounded breadth-first contract as the preserved core CombatEvents, without importing the top-view game.
export class SideEvents {
  constructor() {
    this.listeners = new Map();
    this.queue = [];
    this.active = null;
    this.serial = 0;
  }
  on(name, fn) {
    const list = this.listeners.get(name) || [];
    list.push(fn);
    this.listeners.set(name, list);
    return () =>
      this.listeners.set(
        name,
        list.filter((x) => x !== fn),
      );
  }
  root() {
    return {
      id: ++this.serial,
      depth: 0,
      budget: { count: 0 },
      pairs: new Set(),
    };
  }
  emit(name, data = {}, parent = null) {
    const prev = parent || this.active,
      root = prev ? { ...prev, depth: prev.depth + 1 } : this.root();
    if (root.depth > 4 || root.budget.count >= 64) return false;
    root.budget.count++;
    this.queue.push({ name, data, root });
    if (this.active) return true;
    try {
      while (this.queue.length) {
        const e = this.queue.shift();
        this.active = e.root;
        for (const f of this.listeners.get(e.name) || [])
          f({ ...e.data, context: e.root });
      }
    } finally {
      this.active = null;
      this.queue = [];
    }
    return true;
  }
}
