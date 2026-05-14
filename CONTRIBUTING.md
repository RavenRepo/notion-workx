# Contributing to WorX

Thanks for contributing.

## Prerequisites

- Node.js 20+
- npm 10+

## Local setup

```bash
npm install
npm run build
```

## Development workflow

1. Create a branch from `main`.
2. Make focused changes.
3. Run checks:

```bash
npx tsc --noEmit
npm test
npm run build
```

4. Open a pull request with:
   - clear summary
   - why the change is needed
   - any behavior changes

## Project areas

- `src/parser/*` — OpenAPI loading and schema mapping
- `src/generator/*` — tool generation and templates
- `src/cli/*` — CLI entrypoint and command flow
- `test/*` — regression and behavior tests

## Contribution guidelines

- Keep changes small and targeted.
- Add or update tests for behavior changes.
- Do not commit secrets or local environment files.
- Do not commit local runtime artifacts (logs, session files, generated local workers).
- Keep docs in sync when changing behavior or flags.

## Commit style

Conventional commits are preferred:

- `feat: ...`
- `fix: ...`
- `docs: ...`
- `test: ...`
- `chore: ...`

