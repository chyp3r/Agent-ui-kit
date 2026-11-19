import { createMemorySessionStore } from "./memory";
import { SessionNotFound, type SessionDetail, type SessionStore, type SessionSummary } from "./store";
import type { StoredMessage } from "./turn";

interface Row extends SessionDetail {
  created_at: string;
}

const STORE = "sessions";

function open(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "session_id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function wrap<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Conversations kept in this browser (IndexedDB), so the kit works with no backend
 * at all. Falls back to memory where storage is blocked.
 */
export function createLocalSessionStore(name = "agent-kit"): SessionStore {
  if (typeof indexedDB === "undefined") return createMemorySessionStore();
  let db: Promise<IDBDatabase> | null = null;
  const connection = () => (db ??= open(name));
  const tx = async (mode: IDBTransactionMode) => (await connection()).transaction(STORE, mode).objectStore(STORE);

  return {
    async list() {
      const rows = await wrap((await tx("readonly")).getAll() as IDBRequest<Row[]>);
      return rows
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map<SessionSummary>(({ session_id, title, created_at }) => ({ session_id, title, created_at }));
    },
    async get(id) {
      const row = await wrap((await tx("readonly")).get(id) as IDBRequest<Row | undefined>);
      if (!row) throw new SessionNotFound(id);
      return { session_id: row.session_id, title: row.title, messages: row.messages };
    },
    async save(id, title, messages: StoredMessage[]) {
      const store = await tx("readwrite");
      const existing = await wrap(store.get(id) as IDBRequest<Row | undefined>);
      const row: Row = { session_id: id, title, messages, created_at: existing?.created_at ?? new Date().toISOString() };
      await wrap((await tx("readwrite")).put(row));
    },
    async remove(id) {
      await wrap((await tx("readwrite")).delete(id));
    },
  };
}
