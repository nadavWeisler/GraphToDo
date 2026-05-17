# GraphToDo

GraphToDo is an Eisenhower Matrix task app built with React + Vite. It helps you sort tasks by urgency and importance, then manage them with fast keyboard-friendly controls.

## Purpose

- Turn a flat to-do list into actionable priorities.
- Keep focus on high-impact work.
- Preserve tasks across browser reloads with local persistence.

## Current Features

- 4 Eisenhower quadrants (Do First, Schedule, Delegate, Eliminate).
- Add, edit, complete, delete, and move tasks between quadrants.
- Validation guardrails:
  - blocks empty tasks
  - blocks duplicates per quadrant (case/whitespace insensitive)
  - max task length (120 chars)
- Persistence in `localStorage`.
- Resilient persistence fallback: if `localStorage` is unavailable, tasks keep working in-memory with a warning that refresh may lose data.
- Quick search across tasks.
- Optional "Hide completed" filter.
- Per-quadrant count display (total + shown).
- Clear completed tasks in one click.
- JSON export/import for backup/restore.
- Accessibility-focused controls (labels, keyboard submit/edit/cancel, live status feedback).

## Local Setup

```bash
npm ci
npm run dev
```

Open the Vite local URL shown in the terminal.

## Scripts

- `npm run dev` — start development server
- `npm run build` — create production build
- `npm run preview` — preview production build
- `npm run lint` — run ESLint
- `npm run test` — run Vitest in watch mode
- `npm run test:run` — run Vitest once (CI mode)

## Testing

Core behavior tests cover:

- add/toggle/delete
- move between quadrants
- load from and persist to localStorage
- duplicate validation

Run with:

```bash
npm run test:run
```

## CI

GitHub Actions runs on pushes and pull requests:

1. Install dependencies
2. Lint
3. Build
4. Run tests

Workflow file: `.github/workflows/ci.yml`

## Roadmap

- [ ] Drag-and-drop task movement.
- [ ] Optional due dates and reminders.
- [ ] Quadrant-level analytics (completion trends).
- [ ] Theme customization.
- [ ] Multi-device sync backend.

## v1 Release Plan

- [ ] UI polish pass (spacing, responsive refinements, focus states)
- [ ] Bug triage and regression sweep
- [ ] Final README/usage refresh
- [ ] Changelog draft (`CHANGELOG.md`)
- [ ] Tag and publish `v1.0.0`
