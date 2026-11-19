# Customizing

## Your agents and tools

```ts
export const kit = defineAgentKit({
  brand: { name: "Acme Assistant", subtitle: "Support agents" },
  entryNode: "router",                      // going back to it is a replan
  endingNodes: ["responder"],               // after these, the answer is being written
  agents: [
    { node: "router", name: "Router", role: "Routing agent", purpose: "…", status: "Routing the question.",
      avatar: "planner", mainTool: "route" },
    // names and labels may be { tr: "…", en: "…" }
  ],
  tools: { route: { label: "Route", short: "Route", reason: "…", icon: "route" } },
  categories: { billing: "Billing" },
  smallTalkCategories: ["chat"],            // no sources, no verdict for these
});
```

`avatar` is one of `AVATARS` (`planner searcher analyst timekeeper cataloger reviewer charter operator helper
mascot`) or a name you add to `TRADES` in `AgentPortrait.tsx`. `icon` is a key of `TOOL_ICONS`; add your own
(`TOOL_ICONS.rocket = Rocket`).

## Your own answer blocks

```ts
const kit = defineAgentKit({
  agents: [...],
  answer: {
    fences: { kv: (body) => ({ kind: "kv", data: parse(body) }) },            // ```kv fences
    lines:  [{ kind: "todo", match: (line) => /^\* todo: (.*)$/.exec(line)?.[1] ?? null }],
  },
});

<AgentApp kit={kit} renderers={{ blocks: { kv: ({ block }) => <KeyValues data={(block as any).data} /> } }} />
```

A tool's result is drawn by `renderers.outputs[outputKind]`; register a kind (`"map"`, `"diff"`) the same way.

## Text

Every string is a key in `packages/core/src/i18n/tr.ts` (default) and `en.ts`. Override a few without
forking: `<AgentApp messages={{ "empty.title": "Ask anything" }} />`. A new locale is a new file typed as
`Messages`, so a missing key is a compile error.

## Layout

Replace `<AgentApp>` by copying `AgentApp.tsx` and composing `AppShell`, `Sidebar`, `TurnView`, `PendingTurn`,
`QuestionForm` and `WorkspacePanel` yourself over `useAgentChat`. The panel, the map and the sources list also
work alone (`gallery`).
