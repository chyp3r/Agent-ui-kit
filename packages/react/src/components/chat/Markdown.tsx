import { isValidElement, memo, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { CodeBlock } from "../primitives/CodeBlock";

const PLUGINS = [remarkGfm];

function textOf(node: ReactNode): string {
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children);
  return "";
}

const COMPONENTS = {
  // A fenced block inside markdown gets the same treatment as one the parser cut out.
  pre({ children }: { children?: ReactNode }) {
    const child = Array.isArray(children) ? children[0] : children;
    if (isValidElement<{ className?: string; children?: ReactNode }>(child)) {
      const language = /language-([\w-]+)/.exec(child.props.className ?? "")?.[1] ?? null;
      return <CodeBlock code={textOf(child.props.children).replace(/\n$/, "")} language={language} />;
    }
    return <pre>{children}</pre>;
  },
};

/** One block of the report. Memoised: a block whose text did not change is not parsed again. */
export const Markdown = memo(function Markdown({ text }: { text: string }) {
  return (
    <ReactMarkdown remarkPlugins={PLUGINS} components={COMPONENTS}>
      {text}
    </ReactMarkdown>
  );
});
