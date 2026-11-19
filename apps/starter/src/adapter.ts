import {
  createHttpSessionStore,
  createLangGraphAdapter,
  createNdjsonAdapter,
  createOpenAiAdapter,
  createSseAdapter,
  type AgentAdapter,
  type SessionStore,
} from "@agent-kit/core";

const base = import.meta.env.VITE_API_BASE_URL ?? "/api";

/**
 * Where this starter's data comes from. Pick with VITE_ADAPTER, or replace this
 * function: any object with `ask()` (and optionally `respond()` and `health()`) works.
 */
export function createAdapter(): AgentAdapter {
  switch (import.meta.env.VITE_ADAPTER) {
    case "sse":
      return createSseAdapter({ baseUrl: base, healthPath: "/health", approvalPath: (id) => `/approvals/${id}` });
    case "openai":
      return createOpenAiAdapter({ baseUrl: `${base}/v1`, model: "mock" });
    case "langgraph":
      return createLangGraphAdapter({ baseUrl: base, runPath: "/runs/stream" });
    default:
      return createNdjsonAdapter({ baseUrl: base, healthPath: "/health", approvalPath: (id) => `/approvals/${id}` });
  }
}

/** Conversations live in this browser unless VITE_SESSION_STORE=http. */
export function createStore(): SessionStore | undefined {
  return import.meta.env.VITE_SESSION_STORE === "http" ? createHttpSessionStore({ baseUrl: base }) : undefined;
}
