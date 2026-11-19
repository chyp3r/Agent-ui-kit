# Agent UI Kit: notes for Claude Code

- Packages are source-first (`exports` → `src`); there is no build step for `core`, `react` or `mock`.
- `@agent-kit/core` has no React and no DOM beyond `fetch`/`indexedDB`. Components never call `fetch`.
- The mock server is run by Node's type stripping: its files import with `.ts` extensions and only
  `import type` from core. Do not add enums, parameter properties or runtime imports from core there.
- Every UI string is a key in `core/src/i18n/tr.ts` and `en.ts`; `en` is typed to `tr`'s keys.
- Nothing domain-specific in the packages: `node scripts/check-clean.mjs` enforces it.
- Check everything in a container: `docker compose --profile test run --rm check`.
- Conventional Commits: `<type>(<scope>): <summary>`; scopes `core`, `react`, `mock`, `starter`, `docs`, `infra`.
