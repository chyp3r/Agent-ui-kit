import { jsonRequest, type HttpOptions } from "../adapters/http";
import { ApiError } from "../protocol/stream";
import { SessionNotFound, type SessionDetail, type SessionStore, type SessionSummary } from "./store";

/**
 * Sessions on your backend, REST-shaped:
 * `GET /sessions`, `GET|POST|DELETE /sessions/:id` with `{ title, messages }`.
 */
export function createHttpSessionStore(options: HttpOptions & { path?: string }): SessionStore {
  const base = options.path ?? "/sessions";
  return {
    list: (signal) => jsonRequest<SessionSummary[]>(options, base, {}, signal),
    async get(id, signal) {
      try {
        return await jsonRequest<SessionDetail>(options, `${base}/${encodeURIComponent(id)}`, {}, signal);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) throw new SessionNotFound(id);
        throw error;
      }
    },
    async save(id, title, messages) {
      await jsonRequest(options, `${base}/${encodeURIComponent(id)}`, { method: "POST", body: JSON.stringify({ title, messages }) });
    },
    async remove(id) {
      await jsonRequest(options, `${base}/${encodeURIComponent(id)}`, { method: "DELETE" });
    },
  };
}
