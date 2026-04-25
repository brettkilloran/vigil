/**
 * BoundedMap — a tiny LRU map with a hard size cap.
 *
 * Entries are ordered by insertion (recency). On `get`, a hit is reinserted so it
 * becomes the most-recent. On `set`, if the size exceeds `maxSize`, the
 * least-recently-touched entry is evicted.
 *
 * This is intentionally minimal and synchronous; use it for client-side hot-path
 * caches (e.g. alt-hover mention/search caches) that previously used an unbounded
 * `Map` and would grow without bound during long sessions.
 *
 * See `REVIEW_2026-04-25_1835.md` finding M8.
 */
export class BoundedMap<K, V> {
  private readonly map: Map<K, V> = new Map();

  constructor(private readonly maxSize: number) {
    if (!Number.isFinite(maxSize) || maxSize <= 0) {
      throw new Error(`BoundedMap maxSize must be a positive integer, got ${maxSize}`);
    }
  }

  get size(): number {
    return this.map.size;
  }

  has(key: K): boolean {
    return this.map.has(key);
  }

  get(key: K): V | undefined {
    if (!this.map.has(key)) return undefined;
    const value = this.map.get(key) as V;
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, value);
    while (this.map.size > this.maxSize) {
      const oldestKey = this.map.keys().next();
      if (oldestKey.done) break;
      this.map.delete(oldestKey.value);
    }
  }

  delete(key: K): boolean {
    return this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }
}
