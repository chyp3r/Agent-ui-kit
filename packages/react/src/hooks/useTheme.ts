import { useCallback, useEffect, useState } from "react";

import { readStored, writeStored } from "../lib/storage";

export type ThemeChoice = "system" | "light" | "dark";

function apply(choice: ThemeChoice): void {
  const root = document.documentElement;
  if (choice === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", choice);
}

/** The reader's theme: light, dark, or whatever the OS says. Remembered in this browser. */
export function useTheme(): { theme: ThemeChoice; setTheme: (choice: ThemeChoice) => void; cycle: () => void } {
  const [theme, setThemeState] = useState<ThemeChoice>(() => {
    const stored = readStored("theme");
    return stored === "light" || stored === "dark" ? stored : "system";
  });
  useEffect(() => apply(theme), [theme]);
  const setTheme = useCallback((choice: ThemeChoice) => {
    writeStored("theme", choice === "system" ? null : choice);
    setThemeState(choice);
  }, []);
  const cycle = useCallback(() => setTheme(theme === "system" ? "light" : theme === "light" ? "dark" : "system"), [theme, setTheme]);
  return { theme, setTheme, cycle };
}
