// Process-local stores for roadmap features that need durable-ish state
// without a database. Survives hot reloads poorly; multi-instance deploys
// do not share state. Production should replace with Redis/Postgres.

type GlobalStores = {
  __trustgateStores?: Map<string, Map<string, unknown>>;
};

function rootMap(): Map<string, Map<string, unknown>> {
  const g = globalThis as typeof globalThis & GlobalStores;
  if (!g.__trustgateStores) {
    g.__trustgateStores = new Map();
  }
  return g.__trustgateStores;
}

export function getStore<T>(namespace: string): Map<string, T> {
  const root = rootMap();
  let ns = root.get(namespace) as Map<string, T> | undefined;
  if (!ns) {
    ns = new Map<string, T>();
    root.set(namespace, ns as Map<string, unknown>);
  }
  return ns;
}

export function storeValues<T>(namespace: string): T[] {
  return Array.from(getStore<T>(namespace).values());
}
