// Preserve the current tab's archive if browser storage is blocked or full.
export function createStorage(backend) {
  const memory = new Map();
  return {
    persistent: true,
    getItem(key) {
      if (!this.persistent && memory.has(key)) return memory.get(key);
      try {
        return backend().getItem(key);
      } catch {
        this.persistent = false;
        return memory.get(key) ?? null;
      }
    },
    setItem(key, value) {
      memory.set(key, value);
      try {
        backend().setItem(key, value);
      } catch {
        this.persistent = false;
      }
    },
  };
}
