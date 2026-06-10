const TTL = 60 * 60 * 1000; // 1 hour default

const store = new Map();

function get(key) {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.exp) { store.delete(key); return undefined; }
  return entry.val;
}

function set(key, val, ttl = TTL) {
  store.set(key, { val, exp: Date.now() + ttl });
}

function del(...keys) {
  for (const k of keys) store.delete(k);
}

function flush() {
  store.clear();
}

module.exports = { get, set, del, flush };
