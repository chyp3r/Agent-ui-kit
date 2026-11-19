import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useKit } from "../../context/KitContext";

const CONFIRM_MS = 1600;

/**
 * `navigator.clipboard` does not exist on a plain-http origin, so the old selection
 * trick is the fallback rather than a dead button. Only a copy that happened says so.
 */
export async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Denied: try the other way.
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  }
  area.remove();
  return copied;
}

export function CopyButton({ text, label, iconOnly = false }: { text: () => string; label: string; iconOnly?: boolean }) {
  const { t } = useKit();
  const [copied, setCopied] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <button
      type="button"
      className="copy-button"
      title={label}
      aria-label={copied ? t("copy.done", { label }) : label}
      onClick={async () => {
        if (!(await writeClipboard(text()))) return;
        setCopied(true);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setCopied(false), CONFIRM_MS);
      }}
    >
      {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
      {!iconOnly && <span>{copied ? t("copy.copied") : t("copy.copy")}</span>}
    </button>
  );
}
