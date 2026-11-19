/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "ndjson" (default) | "sse" | "openai" | "langgraph" */
  readonly VITE_ADAPTER?: string;
  /** Same-origin base of the backend. Default "/api". */
  readonly VITE_API_BASE_URL?: string;
  /** "local" (default, this browser) or "http" (your backend's /sessions). */
  readonly VITE_SESSION_STORE?: string;
}
