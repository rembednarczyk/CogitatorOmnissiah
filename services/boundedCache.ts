/**
 * A `Map` with a hard size limit and FIFO eviction.
 *
 * WHY. Two in-process caches (`cycleLookupService`, `isbnLookupService`) were plain
 * `Map`s with no cap, no TTL and no eviction, keyed by a string that comes straight
 * from the request (`?title=`, `/api/isbn/:code`). On a 512 MB instance a loop over
 * distinct keys grew the heap without bound — and each miss on the cycle lookup also
 * fans out up to ~34 requests to a third-party wiki, so the cache is what stands
 * between normal use and turning the app into a request amplifier.
 *
 * FIFO rather than LRU on purpose: these are lookup caches for a browsing session, and
 * insertion order is a good enough proxy for staleness. `Map` already iterates in
 * insertion order, so eviction is one `keys().next()` — no bookkeeping, nothing to get
 * subtly wrong. Note a HIT does not refresh position, which is exactly the trade being
 * made here (simplicity over hit-rate).
 *
 * `null` is a legitimate cached VALUE ("looked it up, there is nothing"), so presence
 * is tested with `has()`, never by truthiness of `get()`.
 */
export class BoundedCache<V> {
  private map = new Map<string, V>();

  constructor(private readonly maxEntries: number) {
    if (maxEntries < 1) throw new Error("BoundedCache: maxEntries must be >= 1");
  }

  has(key: string): boolean {
    return this.map.has(key);
  }

  get(key: string): V | undefined {
    return this.map.get(key);
  }

  set(key: string, value: V): void {
    // Re-setting an existing key must not count as growth.
    if (!this.map.has(key) && this.map.size >= this.maxEntries) {
      const oldest = this.map.keys().next();
      if (!oldest.done) this.map.delete(oldest.value);
    }
    this.map.set(key, value);
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }
}
