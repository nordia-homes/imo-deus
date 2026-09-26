import type { Firestore } from 'firebase-admin/firestore';

type Data = Record<string, unknown>;
function merge(a: Data, b: Data): Data {
  const result = structuredClone(a);
  for (const [key, value] of Object.entries(b)) {
    result[key] = value && typeof value === 'object' && !Array.isArray(value)
      ? merge((result[key] || {}) as Data, value as Data) : structuredClone(value);
  }
  return result;
}

export function memoryDb() {
  const docs = new Map<string, Data>();
  let tail = Promise.resolve();
  const snapshot = (path: string) => ({ exists: docs.has(path), id: path.split('/').at(-1)!, data: () => structuredClone(docs.get(path)) });
  function ref(path: string) {
    return {
      path, firestore: db, id: path.split('/').at(-1)!,
      get: async () => snapshot(path),
      set: async (data: Data) => { docs.set(path, merge(docs.get(path) || {}, data)); },
      collection: (name: string) => collection(`${path}/${name}`),
    };
  }
  function collection(path: string): { doc: (id: string) => ReturnType<typeof ref> } { return { doc: id => ref(`${path}/${id}`) }; }
  type Ref = ReturnType<typeof ref>;
  type Tx = { get: (ref: Ref) => Promise<ReturnType<typeof snapshot>>; set: (ref: Ref, data: Data, options?: unknown) => void; update: (ref: Ref, data: Data) => void; delete: (ref: Ref) => void };
  const db = {
    collection,
    runTransaction: <T>(work: (tx: Tx) => Promise<T>) => {
      const result = tail.then(async () => {
        const writes: Array<() => void> = [];
        const set = (r: Ref, data: Data) => { writes.push(() => docs.set(r.path, merge(docs.get(r.path) || {}, data))); };
        const result = await work({
          get: async r => snapshot(r.path), set,
          update: (r, data) => { if (!docs.has(r.path)) throw new Error('Missing document'); set(r, data); },
          delete: r => { writes.push(() => docs.delete(r.path)); },
        });
        writes.forEach(write => write()); return result;
      });
      tail = result.then(() => undefined, () => undefined);
      return result;
    },
  } as unknown as Firestore;
  return { db, docs };
}
