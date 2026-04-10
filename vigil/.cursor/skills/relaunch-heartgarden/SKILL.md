---
name: relaunch-heartgarden
description: Relaunch the heartgarden Next.js dev app on its existing port and open it immediately, including a specific route when provided. Use when the user asks to relaunch/restart the app, keep the same port, open in Cursor/browser, or mentions a target page like /, /foo, or /spaces/123. The app directory in git is vigil/ unless renamed (see vigil/docs/NAMING.md).
---

# Relaunch heartgarden

## Goal

Restart the heartgarden dev server quickly on the same port, verify it is healthy, and open the requested page.

## Inputs

- Optional page path from user context, such as `/`, `/spaces/abc`, or `/foo?bar=1`.
- If no page is given, use `/`.

## Workflow

1. Determine the target path:
   - Use the user-provided route if present.
   - Otherwise use `/`.

2. Reuse the current port when possible:
   - Check existing terminal metadata for the current dev command.
   - If a port is present, reuse it.
   - If unknown, default to `3000`.

3. Restart the app:
   - Stop the process currently bound to the selected port.
   - Start dev server from the app directory (**`vigil/`** today — see **`docs/NAMING.md`** if renamed). On Windows with a portable Node install, ensure **`node`** / **`npm`** are on `PATH` (see **`vigil/AGENTS.md`** → Node on PATH / `pin-portable-node-user-path.ps1`), then run:
     - `npm run dev -- --port <PORT> --hostname 127.0.0.1`

4. Verify health before opening:
   - Probe `http://127.0.0.1:<PORT>` and confirm status `200`.

5. Open the requested page:
   - URL format: `http://127.0.0.1:<PORT><PATH>`.
   - Open in Cursor-integrated browser tools when available.
   - If integrated browser tools are unavailable, fall back to launching the URL with system browser.

## Response Format

- Report the reused port.
- Report the final opened URL.
- Report health status result.
