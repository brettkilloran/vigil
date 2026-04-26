---
name: boot
description: Restart heartgarden and Storybook on their active/default ports, verify both are healthy, and open inside Cursor only. Use when the user asks to boot, restart, relaunch, or bring app and Storybook back up quickly.
---

# Boot heartgarden + Storybook

## Goal

Restart both local surfaces quickly on the same ports when possible, verify health, and open them in Cursor-integrated browser tools only.

## Inputs

- Optional app route path from user context, such as `/`, `/spaces/abc`, or `/foo?bar=1`.
- If no app route is given, use `/`.

## Workflow

1. Determine app target path:
   - Use the user-provided app route if present.
   - Otherwise use `/`.

2. Resolve ports, preferring currently-used ports:
   - Check existing terminal metadata for active commands and explicit ports.
   - Check listening ports when needed.
   - If unknown, default to:
     - App (Next): `3000`
     - Storybook: `6006`

3. **Always** restart both services from app root `heartgarden/` — even if they appear to be already running:
   - **Kill** all processes bound to the app and Storybook ports (use `netstat -ano` to find PIDs, then `taskkill /PID <pid> /T /F`). Do not skip this step.
   - Start app:
     - `pnpm run dev -- --port <APP_PORT> --hostname 127.0.0.1`
   - Start Storybook:
     - `pnpm run dev:storybook`
   - On Windows with portable Node, ensure `node` and `pnpm` are on `PATH` (see `heartgarden/AGENTS.md`).

4. Verify health before opening:
   - App: probe `http://127.0.0.1:<APP_PORT>` and confirm status `200`.
   - Storybook: probe `http://127.0.0.1:<STORYBOOK_PORT>` and confirm status `200`.
   - For Storybook dev, wait for the terminal to print `Local:` before probing.

5. Open pages in Cursor only:
   - App URL: `http://127.0.0.1:<APP_PORT><PATH>`
   - Storybook URL: `http://127.0.0.1:<STORYBOOK_PORT>`
   - Use Cursor-integrated browser tools to open both.
   - Do not launch the system browser as a fallback.

## Response Format

- Report app and Storybook ports used.
- Report opened app and Storybook URLs.
- Report health status results for both services.
