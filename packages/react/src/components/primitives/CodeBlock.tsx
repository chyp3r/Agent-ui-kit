import { memo, useMemo } from "react";

import { useKit } from "../../context/KitContext";
import { highlight } from "../../lib/highlight";
import { CopyButton } from "./CopyButton";

/** A code or query block with light syntax colouring and a copy button. */
export const CodeBlock = memo(function CodeBlock({ code, language }: { code: string; language?: string | null }) {
  const { t } = useKit();
  const tokens = useMemo(() => highlight(code, language), [code, language]);
  return (
    <figure className="code-block">
      <figcaption>
        <span>{language || t("code.code")}</span>
        <CopyButton label={t("code.copy")} text={() => code} />
      </figcaption>
      <pre>
        <code>
          {tokens.map((token, index) =>
            token.kind === "plain" ? token.text : (
              <span key={index} className={`tok-${token.kind}`}>
                {token.text}
              </span>
            ),
          )}
        </code>
      </pre>
    </figure>
  );
});
