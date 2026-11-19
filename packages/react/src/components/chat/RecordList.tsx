import type { RecordLine } from "@agent-kit/core";
import { memo } from "react";

import { useKit } from "../../context/KitContext";

const Row = memo(function Row({ record, onTag }: { record: RecordLine; onTag?: (tag: string) => void }) {
  const { t } = useKit();
  return (
    <li className="record-row">
      <time data-numeric>{record.time}</time>
      {onTag ? (
        <button type="button" className="tag-chip" title={t("records.openTag", { tag: record.tag })} onClick={() => onTag(record.tag)}>
          {record.tag}
        </button>
      ) : (
        <span className="tag-chip">{record.tag}</span>
      )}
      <p>{record.text}</p>
    </li>
  );
});

/**
 * Record lines as rows. Each row is memoised on its own, so a list of hundreds that
 * is still arriving only ever renders its last line again.
 */
export function RecordList({ items, onTag }: { items: RecordLine[]; onTag?: (tag: string) => void }) {
  return (
    <ul className="record-list">
      {items.map((record, index) => (
        <Row key={index} record={record} onTag={onTag} />
      ))}
    </ul>
  );
}
