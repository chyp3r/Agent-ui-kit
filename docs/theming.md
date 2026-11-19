# Theming

All colour is a token in `packages/react/src/styles/tokens.css`: `:root` is dark, `:root[data-theme="light"]`
is light, and with no `data-theme` the OS decides. `useTheme()` / `<ThemeToggle/>` set it and remember the
choice.

Names follow shadcn (`--background --foreground --card --primary --accent --border …`), plus `--chart-1…8`,
`--code-bg --code-fg --tag-fg --danger-fg --shadow`. To re-brand, edit those values; components read nothing
else.

`src/test/contrast.test.ts` reads the tokens of **both** themes and fails if body, secondary, coloured or code
text drops below WCAG AA (4.5:1) on any surface it sits on, or a chart mark below 3:1. Run it after changing a
colour.

Motion: everything that moves is stopped by `prefers-reduced-motion` (CSS for the UI, `useReducedMotion` for
the charts, which animate in JavaScript). Motion only tells that work is running; keep it that way.

Fonts (Geist, JetBrains Mono) are bundled by `@fontsource`: nothing here reaches the internet.
