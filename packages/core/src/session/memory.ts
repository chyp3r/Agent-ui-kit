import { SessionNotFound, type SessionDetail, type SessionStore, type SessionSummary } from "./store";
import type { StoredMessage } from "./turn";

/** Sessions kept in memory: tests, demos, and the fallback when no storage is allowed. */
export function createMemorySessionStore(): SessionStore {
  const rows = new Map<string, SessionDetail & { created_at: string }>();
  return {
    async list() {
      return [...rows.values()]
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map<SessionSummary>(({ session_id, title, created_at }) => ({ session_id, title, created_at }));
    },
    async get(id) {
      const row = rows.get(id);
      if (!row) throw new SessionNotFound(id);
      return { session_id: row.session_id, title: row.title, messages: row.messages };
    },
    async save(id, title, messages: StoredMessage[]) {
      const existing = rows.get(id);
      rows.set(id, { session_id: id, title, messages, created_at: existing?.created_at ?? new Date().toISOString() });
    },
    async remove(id) {
      rows.delete(id);
    },
  };
}
