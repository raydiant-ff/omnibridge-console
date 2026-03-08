const store = new Map<string, { data: unknown; expiresAt: number; tags: string[] }>();

export async function cached<T>(
  fn: () => Promise<T>,
  key: string,
  opts: { revalidate: number; tags?: string[] },
): Promise<T> {
  const entry = store.get(key);
  if (entry && Date.now() < entry.expiresAt) {
    return entry.data as T;
  }

  const data = await fn();
  store.set(key, {
    data,
    expiresAt: Date.now() + opts.revalidate * 1000,
    tags: opts.tags ?? [],
  });
  return data;
}

export function invalidateTag(tag: string) {
  for (const [key, entry] of store) {
    if (entry.tags.includes(tag)) {
      store.delete(key);
    }
  }
}

export function invalidateAll() {
  store.clear();
}
