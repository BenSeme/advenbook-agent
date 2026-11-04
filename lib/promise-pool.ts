// Small promise pool: run async work over items with a concurrency cap.
// Pure (no browser APIs) so it is unit-testable in Node. Results keep the
// input order regardless of completion order.

export async function mapPool<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  if (items.length === 0) return results;
  const cap = Math.max(1, Math.min(items.length, Math.floor(limit) || 1));
  let next = 0;
  async function run(): Promise<void> {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: cap }, () => run()));
  return results;
}
