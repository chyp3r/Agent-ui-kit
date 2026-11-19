import type { Flow } from "@agent-kit/core";

import type { KitContextValue } from "../context/KitContext";

/** What the status line says right now. */
export function statusLineOf(flow: Flow, kit: Pick<KitContextValue, "agent" | "t">): { title: string; detail: string } {
  const { agent, t } = kit;
  if (flow.phase === "waiting") return { title: t("status.waiting"), detail: t("status.waitingDetail") };
  if (flow.current) {
    const who = agent(flow.current.node, flow.current.title);
    return { title: who.status, detail: t("status.working", { name: who.name }) };
  }
  if (flow.phase === "writing") return { title: t("status.writing"), detail: t("status.writingDetail") };
  if (flow.visits.length) return { title: t("status.next"), detail: t("status.nextDetail") };
  return { title: t("status.connecting"), detail: t("status.connectingDetail") };
}
