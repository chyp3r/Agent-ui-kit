import type { AnswerBlock, ToolCall } from "@agent-kit/core";
import type { ReactNode } from "react";

export interface BlockProps {
  block: AnswerBlock;
  streaming: boolean;
  /** Follows a source tag to the sources panel. Absent while the answer is still arriving. */
  onTag?: (tag: string) => void;
}

export interface OutputProps {
  call: ToolCall;
}

/**
 * Who draws what. `blocks` is keyed by `AnswerBlock.kind` (what the answer parser
 * produced), `outputs` by `ToolCall.outputKind` (how a tool's result is drawn in the
 * step detail). Pass your own through `<AgentKitProvider renderers>`; keys you leave
 * out keep the defaults. Defaults are filled in by `renderers/defaults.tsx`.
 */
export interface Renderers {
  blocks: Record<string, (props: BlockProps) => ReactNode>;
  outputs: Record<string, (props: OutputProps) => ReactNode>;
}

export const defaultRenderers: Renderers = { blocks: {}, outputs: {} };

/** Used by `defaults.tsx` at import time; kept apart so the context has no component imports. */
export function registerDefaultRenderers(next: Renderers): void {
  Object.assign(defaultRenderers.blocks, next.blocks);
  Object.assign(defaultRenderers.outputs, next.outputs);
}
