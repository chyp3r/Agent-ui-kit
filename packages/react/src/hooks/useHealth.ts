import type { AgentAdapter } from "@agent-kit/core";
import { useEffect, useState } from "react";

export type SystemStatus = "checking" | "online" | "busy" | "offline";

const HEALTH_MS = 15_000;
const BUSY_MS = 3_000;

/**
 * Whether the backend can be asked anything. A busy backend (loading, seeding) locks
 * the composer, and a dead one is said out loud rather than left for the first
 * question to discover. An adapter without `health` is assumed online.
 */
export function useHealth(adapter: AgentAdapter): SystemStatus {
  const [status, setStatus] = useState<SystemStatus>(adapter.health ? "checking" : "online");
  useEffect(() => {
    if (!adapter.health) {
      setStatus("online");
      return;
    }
    const controller = new AbortController();
    let timer = 0;
    const check = async () => {
      let next: SystemStatus;
      try {
        const health = await (adapter.health as NonNullable<AgentAdapter["health"]>)(controller.signal);
        next = !health.ready || health.busy ? "busy" : "online";
      } catch {
        if (controller.signal.aborted) return;
        next = "offline";
      }
      setStatus(next);
      timer = window.setTimeout(check, next === "busy" ? BUSY_MS : HEALTH_MS);
    };
    void check();
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [adapter]);
  return status;
}
