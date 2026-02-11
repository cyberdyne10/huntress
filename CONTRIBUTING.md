# Contributing Guide

## Workflow
1. Create an issue (or reference an existing one).
2. Branch from `main` using: `feat/<topic>`, `fix/<topic>`, or `chore/<topic>`.
3. Keep commits atomic and scoped to one concern.
4. Open a PR with:
   - summary of changes
   - testing evidence (lint + smoke tests)
   - risk/rollback notes

## Branch and PR Conventions
- Branch naming: `type/short-description`.
- PR title style: `<type>: <summary>` (e.g., `feat: add demo intake api scaffold`).
- Prefer small PRs (<500 LOC net when practical).
- Require CI green before merge.

## Code Style
- HTML/CSS/JS: follow project linters (`htmlhint`, `stylelint`, `eslint`).
- Keep presentation in `css/` and behavior in `js/`; avoid inline styles/scripts.
- For shared UI elements, keep logic in `js/components.js` to avoid page drift.
- Preserve existing page rendering unless change is intentional and documented.

## Local Validation Checklist
Run before pushing:

```bash
npm ci
npm run lint
npm run test:smoke
```

Optional API check:

```bash
npm run start
# then visit http://localhost:3001/health
```
