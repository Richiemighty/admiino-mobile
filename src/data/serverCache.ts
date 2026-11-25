type CacheKey = string;

type Entry<T> = {
  value: T;
  updatedAt: number;
};

const entries = new Map<CacheKey, Entry<unknown>>();
const inFlight = new Map<CacheKey, Promise<unknown>>();

export const cachePolicy = {
  taskList: 45_000,
  taskDetails: 30_000,
  watchers: 45_000,
  home: 60_000,
  projects: 60_000,
  teams: 60_000,
  inbox: 30_000,
  retention: 5 * 60_000,
} as const;

export function cacheKey(
  scope: string,
  ...parts: (string | number | boolean | null | undefined)[]
) {
  return [scope, ...parts.map((part) => String(part ?? ''))].join(':');
}

export const serverCache = {
  get<T>(key: CacheKey): T | undefined {
    const entry = entries.get(key) as Entry<T> | undefined;
    if (!entry) return undefined;
    if (Date.now() - entry.updatedAt > cachePolicy.retention) {
      entries.delete(key);
      return undefined;
    }
    return entry.value;
  },

  getMeta(key: CacheKey): { updatedAt: number } | undefined {
    const entry = entries.get(key);
    return entry ? { updatedAt: entry.updatedAt } : undefined;
  },

  set<T>(key: CacheKey, value: T) {
    entries.set(key, { value, updatedAt: Date.now() });
  },

  isFresh(key: CacheKey, staleTime: number) {
    const entry = entries.get(key);
    return Boolean(entry && Date.now() - entry.updatedAt <= staleTime);
  },

  async fetch<T>(
    key: CacheKey,
    request: () => Promise<T>,
    options: { staleTime: number; force?: boolean } = { staleTime: 0 },
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== undefined && !options.force && this.isFresh(key, options.staleTime)) {
      return cached;
    }
    const existing = inFlight.get(key) as Promise<T> | undefined;
    if (existing) return existing;
    const promise = request()
      .then((value) => {
        this.set(key, value);
        return value;
      })
      .finally(() => inFlight.delete(key));
    inFlight.set(key, promise);
    return promise;
  },

  update<T>(key: CacheKey, updater: (value: T) => T): boolean {
    const current = this.get<T>(key);
    if (current === undefined) return false;
    this.set(key, updater(current));
    return true;
  },

  invalidate(prefix: string) {
    for (const key of entries.keys())
      if (key === prefix || key.startsWith(`${prefix}:`)) entries.delete(key);
  },

  clearWorkspace(workspaceId: string) {
    this.invalidate(`workspace:${workspaceId}`);
    for (const key of inFlight.keys()) {
      if (key.startsWith(`workspace:${workspaceId}:`)) inFlight.delete(key);
    }
  },

  clearAuthenticated() {
    entries.clear();
    inFlight.clear();
  },

  clearForTests() {
    entries.clear();
    inFlight.clear();
  },
};

export type { CacheKey };
