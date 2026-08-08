# AI Agent Entry Point

This repository is primarily maintained through AI-assisted coding tasks.

## Required First Step

Before analyzing or editing the project, read `HANDOFF.md` from the repository root. Treat its Section 0 as mandatory project instructions.

Then run:

```powershell
git fetch --prune origin
git status -sb
git branch --show-current
git log -1 --oneline --decorate
git rev-list --left-right --count HEAD...origin/main
```

## Core Rules

- Preserve unknown or user-authored working-tree changes.
- Do not use destructive Git commands or force-push.
- Keep the project as static HTML/CSS/JS unless the user explicitly approves a migration.
- Prefer shared modules under `js/` for shared data, schema, storage, timing, import, and cloud behavior.
- Check both `agenda_generator.html` and `agenda_generator_modern.html` when changing shared generator behavior.
- Do not clear timekeeper records or overwrite live/completed timekeeper agenda state during synchronization.
- Do not commit secrets, private draft links, access tokens, service-role keys, or user meeting data.
- Do not push or deploy unless the user explicitly requests publication.

## Verification

For code changes, run at minimum:

```powershell
npm test
git diff --check
```

For responsive UI changes, verify 1440 × 1000, 390 × 844, and 412 × 915. For Supabase changes, also run the production smoke test and inspect the deployment workflow.

Update `HANDOFF.md` when a task materially changes architecture, data contracts, deployment, current priorities, or known issues.
