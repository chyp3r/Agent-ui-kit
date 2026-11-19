import type { AnswerBlock, ChartData, RecordLine } from "@agent-kit/core";

import { useKit } from "../context/KitContext";
import { ChartView } from "../components/analysis/ChartPanel";
import { Markdown } from "../components/chat/Markdown";
import { RecordList } from "../components/chat/RecordList";
import { CodeBlock } from "../components/primitives/CodeBlock";
import { registerDefaultRenderers } from "./registry";

function Pending() {
  const { t } = useKit();
  return (
    <div className="chart-pending" role="status">
      {t("answer.pending")}
    </div>
  );
}

function prettyJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

registerDefaultRenderers({
  blocks: {
    markdown: ({ block }) => <Markdown text={(block as Extract<AnswerBlock, { kind: "markdown" }>).text} />,
    records: ({ block, onTag }) => <RecordList items={(block as { items: RecordLine[] }).items} onTag={onTag} />,
    chart: ({ block }) => (
      <figure className="answer-chart">
        <ChartView chart={(block as { chart: ChartData }).chart} height={260} />
      </figure>
    ),
    code: ({ block }) => {
      const { code, language } = block as { code: string; language: string };
      return <CodeBlock code={code} language={language || null} />;
    },
    pending: () => <Pending />,
  },
  outputs: {
    text: ({ call }) => <p className="detail-pre">{call.output}</p>,
    markdown: ({ call }) => (
      <div className="detail-result md-prose">
        <Markdown text={call.output ?? ""} />
      </div>
    ),
    table: ({ call }) => (
      <div className="detail-result md-prose">
        <Markdown text={call.output ?? ""} />
      </div>
    ),
    code: ({ call }) => <CodeBlock code={call.output ?? ""} language={null} />,
    json: ({ call }) => <CodeBlock code={prettyJson(call.output ?? "")} language="json" />,
  },
});
