/**
 * Safe localStorage wrapper that handles QuotaExceededError and private browsing restrictions.
 * Never throws exceptions that could crash component state.
 */

export function safeSetItem(key, value) {
  try {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    localStorage.setItem(key, serialized);
  } catch (err) {
    console.warn(`[Storage] Failed to write key '${key}' (Quota Exceeded or Access Denied):`, err.message);
    try {
      // Purge bulky non-essential caches to prevent persistent storage errors
      localStorage.removeItem('assetsCache');
      localStorage.removeItem('assignmentsCache');
    } catch (_) {}
  }
}

export function safeGetItem(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (err) {
    return fallback;
  }
}

export function safeRemoveItem(key) {
  try {
    localStorage.removeItem(key);
  } catch (_) {}
}

export function purgeBulkyCaches() {
  try {
    localStorage.removeItem('assetsCache');
    localStorage.removeItem('assignmentsCache');
  } catch (_) {}
}

