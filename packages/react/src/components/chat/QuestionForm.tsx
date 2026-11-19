import { ArrowUp, Square } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { useKit } from "../../context/KitContext";

/** The one place a question is entered, and the anchor of the screen. */
export function QuestionForm({
  onSubmit,
  onCancel,
  busy,
  lockedNote,
  placeholder,
  prefill,
}: {
  onSubmit: (question: string) => void;
  onCancel: () => void;
  /** A question is being worked on: the send control becomes the stop control. */
  busy: boolean;
  /** Why nothing can be asked right now, or null when it can. */
  lockedNote: string | null;
  placeholder: string;
  /** Puts text in the field and focuses it (edit a question). A new `key` is a new request. */
  prefill?: { text: string; key: number } | null;
}) {
  const { t } = useKit();
  const locked = lockedNote !== null;
  const [value, setValue] = useState("");
  const field = useRef<HTMLTextAreaElement>(null);
  const empty = value.trim() === "";

  useEffect(() => {
    if (!prefill) return;
    setValue(prefill.text);
    field.current?.focus();
  }, [prefill]);

  // Grows with what is typed, up to the cap in the stylesheet, and shrinks back. The
  // width counts too: a line that wrapped in a narrow window unwraps in a wide one.
  useLayoutEffect(() => {
    const element = field.current;
    if (!element) return;
    const fit = () => {
      element.style.height = "auto";
      element.style.height = `${element.scrollHeight}px`;
    };
    fit();
    let width = element.clientWidth;
    const observer =
      typeof ResizeObserver === "function"
        ? new ResizeObserver(() => {
            if (element.clientWidth === width) return;
            width = element.clientWidth;
            fit();
          })
        : null;
    observer?.observe(element);
    return () => observer?.disconnect();
  }, [value]);

  const submit = () => {
    const question = value.trim();
    if (!question || busy || locked) return;
    onSubmit(question);
    setValue("");
  };

  return (
    <form
      className="composer-wrap"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="composer" data-locked={locked || undefined}>
        <textarea
          ref={field}
          rows={1}
          value={value}
          aria-label={t("composer.label")}
          placeholder={
            lockedNote ??
            (busy ? t("composer.busy") : placeholder)
          }
          disabled={locked}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
            event.preventDefault();
            submit();
          }}
        />
        {/* Two keys, two elements. The stop settles within its own click, and a reused
            element would by then be a submit button: the click's default action would
            send whatever draft is in the field. */}
        {busy ? (
          <button key="stop" type="button" className="send-control" data-stop aria-label={t("composer.stop")} onClick={onCancel}>
            <Square size={14} aria-hidden="true" />
          </button>
        ) : (
          <button key="send" type="submit" className="send-control" aria-label={t("composer.send")} disabled={empty || locked}>
            <ArrowUp size={18} aria-hidden="true" />
          </button>
        )}
      </div>
      <span className="composer-hint">{t("composer.hint")}</span>
    </form>
  );
}
