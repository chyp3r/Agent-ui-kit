import type { StoredMessage } from "./turn";

export interface SessionSummary {
  session_id: string;
  title: string;
  created_at: string;
}

export interface SessionDetail {
  session_id: string;
  title: string;
  messages: StoredMessage[];
}

/** Where conversations live. Swap it to move from this browser to your backend. */
export interface SessionStore {
  list(signal?: AbortSignal): Promise<SessionSummary[]>;
  get(id: string, signal?: AbortSignal): Promise<SessionDetail>;
  save(id: string, title: string, messages: StoredMessage[]): Promise<void>;
  remove(id: string): Promise<void>;
}

/** The session is gone: the UI says so instead of offering a retry. */
export class SessionNotFound extends Error {
  constructor(readonly id: string) {
    super(`session ${id} not found`);
    this.name = "SessionNotFound";
  }
}
