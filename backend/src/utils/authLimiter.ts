// Reserve attempts before async password verification so parallel requests cannot skip the limit.
export function createAuthLimiter(limit = 5, windowMs = 15 * 60 * 1000) {
  const entries = new Map<string, { count: number; expiresAt: number }>();
  return {
    take(key: string) {
      const now = Date.now();
      for (const [id, entry] of entries) {
        if (entry.expiresAt <= now) entries.delete(id);
      }
      const entry = entries.get(key) ?? { count: 0, expiresAt: now + windowMs };
      if (entry.count >= limit) return false;
      entry.count++;
      entries.set(key, entry);
      return true;
    },
    refund(key: string) {
      const entry = entries.get(key);
      if (entry && entry.count > 0) entry.count--;
    },
    reset(key: string) { entries.delete(key); },
    clear() { entries.clear(); },
  };
}
