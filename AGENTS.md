# AGENTS.md

Guidance for AI coding agents working in this repository.

## Goal

Maintain WorX as a reliable OpenAPI 3.x → Notion Worker generator.

## Scope boundaries

- Prefer correctness over broad speculative support.
- Keep v1 limitations explicit instead of silently failing.
- Do not introduce hidden fallbacks that mask real errors.

## Required checks before finalizing changes

```bash
npx tsc --noEmit
npm test
npm run build
```

## File ownership map

- `src/parser/*`: spec loading and schema normalization
- `src/generator/*`: tool definitions and generated output templates
- `src/deploy/*`: Notion deploy wrapper logic
- `src/cli/index.ts`: CLI UX and output wiring
- `test/*`: behavioral and regression coverage

## Safety rules

- Never commit secrets (`.env`, API keys, PATs).
- Keep generated local worker folders out of commits.
- Do not modify unrelated files.
- Document behavior changes in `README.md` and/or templates when relevant.

## Practical constraints to preserve

- `ntn workers deploy --no-git` is used to avoid git-discovery issues in ignored output folders.
- Notion worker capability limits are real; large APIs should be split (e.g., by `--filter`).
- OAuth2/OpenID remains placeholder-based in v1.

