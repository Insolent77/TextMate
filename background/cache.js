(() => {
  const TTL_MS = 30 * 60 * 1000;
  const MAX_ITEMS = 100;
  const PREFIX = "aiTextCache:";
  const memory = new Map();

  function hashString(value) {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i += 1) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function makeKey(parts) {
    return PREFIX + hashString(JSON.stringify(parts));
  }

  async function get(key) {
    const now = Date.now();
    const mem = memory.get(key);
    if (mem && now - mem.createdAt < TTL_MS) return mem.value;
    if (mem) memory.delete(key);

    try {
      const store = chrome.storage.session;
      if (!store) return null;
      const saved = (await store.get(key))[key];
      if (!saved || now - saved.createdAt >= TTL_MS) {
        if (saved) await store.remove(key);
        return null;
      }
      memory.set(key, saved);
      return saved.value;
    } catch {
      return null;
    }
  }

  async function set(key, value) {
    const item = { createdAt: Date.now(), value };
    memory.set(key, item);
    while (memory.size > MAX_ITEMS) memory.delete(memory.keys().next().value);
    try {
      const store = chrome.storage.session;
      if (store) await store.set({ [key]: item });
    } catch {}
  }

  async function clear() {
    memory.clear();
    try { await chrome.storage.session?.clear(); } catch {}
  }

  globalThis.AITextCache = Object.freeze({ makeKey, get, set, clear });
})();
