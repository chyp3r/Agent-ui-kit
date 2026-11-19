import { Monitor, Moon, Sun } from "lucide-react";

import { useKit } from "../../context/KitContext";
import { useTheme } from "../../hooks/useTheme";

/** Light, dark or the OS's choice, one click at a time. */
export function ThemeToggle() {
  const { t } = useKit();
  const { theme, cycle } = useTheme();
  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;
  const label = t(theme === "light" ? "theme.light" : theme === "dark" ? "theme.dark" : "theme.system");
  return (
    <button type="button" className="theme-toggle" onClick={cycle} title={t("theme.change", { theme: label })} aria-label={t("theme.change", { theme: label })}>
      <Icon size={15} aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}
