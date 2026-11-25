type CacheKey = string;

type Entry<T> = {
  value: T;
  updatedAt: number;
};

const entries = new Map<CacheKey, Entry<unknown>>();
const inFlight = new Map<CacheKey, Promise<unknown>>();
const keyEpochs = new Map<CacheKey, number>();
let authenticatedEpoch = 0;

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
    const epoch = keyEpochs.get(key) ?? 0;
    const accountEpoch = authenticatedEpoch;
    const promise = request()
      .then((value) => {
        if ((keyEpochs.get(key) ?? 0) === epoch && authenticatedEpoch === accountEpoch) {
          this.set(key, value);
        }
        return value;
      })
      .finally(() => {
        if (inFlight.get(key) === promise) inFlight.delete(key);
      });
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
    const affected = new Set<CacheKey>();
    for (const key of entries.keys()) {
      if (key === prefix || key.startsWith(`${prefix}:`)) affected.add(key);
    }
    for (const key of inFlight.keys()) {
      if (key === prefix || key.startsWith(`${prefix}:`)) affected.add(key);
    }
    for (const key of affected) {
      entries.delete(key);
      keyEpochs.set(key, (keyEpochs.get(key) ?? 0) + 1);
    }
  },

  clearWorkspace(workspaceId: string) {
    this.invalidate(`workspace:${workspaceId}`);
    for (const key of inFlight.keys()) {
      if (key.startsWith(`workspace:${workspaceId}:`)) inFlight.delete(key);
    }
  },

  clearAuthenticated() {
    authenticatedEpoch += 1;
    entries.clear();
    inFlight.clear();
    keyEpochs.clear();
  },

  clearForTests() {
    authenticatedEpoch += 1;
    entries.clear();
    inFlight.clear();
    keyEpochs.clear();
  },
};

export type { CacheKey };
