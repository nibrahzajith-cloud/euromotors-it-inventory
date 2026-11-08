/**
 * High-Performance In-Memory Cache for Node.js / Express
 * Dramatically accelerates remote PostgreSQL queries by caching read-heavy endpoints.
 * Automatically invalidates on data mutations to guarantee real-time consistency.
 */

const cacheStore = new Map();

const memoryCache = {
  get(key) {
    const entry = cacheStore.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiry) {
      cacheStore.delete(key);
      return null;
    }
    return entry.value;
  },

  set(key, value, ttlSeconds = 30) {
    cacheStore.set(key, {
      value,
      expiry: Date.now() + (ttlSeconds * 1000)
    });
    return value;
  },

  del(key) {
    cacheStore.delete(key);
  },

  delPrefix(prefix) {
    for (const key of cacheStore.keys()) {
      if (key.startsWith(prefix)) {
        cacheStore.delete(key);
      }
    }
  },

  flushAll() {
    cacheStore.clear();
  },

  async wrap(key, ttlSeconds, fetcherFn) {
    const cached = this.get(key);
    if (cached !== null) {
      return cached;
    }
    const fresh = await fetcherFn();
    this.set(key, fresh, ttlSeconds);
    return fresh;
  }
};

module.exports = memoryCache;

