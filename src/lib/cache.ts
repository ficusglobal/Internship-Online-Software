// Small in-memory cache for public master data (universities, districts, colleges, courses, batches).
// These lists change rarely but several screens read them, so one request is shared between callers
// and reused for a few minutes. Failed requests are not cached, and admin writes clear their own keys.

const TTL_MS = 5 * 60 * 1000;

interface Entry {
  promise: Promise<unknown>;
  loadedAt: number;
}

const entries = new Map<string, Entry>();

export function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = entries.get(key);
  if (hit && Date.now() - hit.loadedAt < TTL_MS) return hit.promise as Promise<T>;

  const promise = load().catch((error: unknown) => {
    // Do not keep a failed request: the next caller should try again
    if (entries.get(key)?.promise === promise) entries.delete(key);
    throw error;
  });
  entries.set(key, { promise, loadedAt: Date.now() });
  return promise;
}

// Drops every entry whose key starts with the given prefix (e.g. "colleges:" after a college is added)
export function invalidate(prefix: string): void {
  for (const key of [...entries.keys()]) {
    if (key.startsWith(prefix)) entries.delete(key);
  }
}
