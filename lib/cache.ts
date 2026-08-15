type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const memoryCache = new Map<string, CacheEntry<unknown>>();

export async function cachedByUser<T>(key: string, userId: number, ttlSeconds: number, loader: () => Promise<T>) {
  const cacheKey = `${key}:user:${userId}`;
  const existing = memoryCache.get(cacheKey) as CacheEntry<T> | undefined;
  if (existing && existing.expiresAt > Date.now()) return existing.value;
  const value = await loader();
  memoryCache.set(cacheKey, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
  return value;
}

export function invalidateUserCache(userId: number, keyPrefix?: string) {
  const userNeedle = `:user:${userId}`;
  for (const key of memoryCache.keys()) {
    if (!key.includes(userNeedle)) continue;
    if (keyPrefix && !key.startsWith(`${keyPrefix}:`)) continue;
    memoryCache.delete(key);
  }
}

export function cacheSize() {
  return memoryCache.size;
}
