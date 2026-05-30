# Agent Engineering Rules

## Running the app for development

**Never run `pnpm dev:electron` or `pnpm dev` directly.** They block the
foreground; re-running them spawns duplicate stacks that fight the
single-instance lock (the window keeps popping to the foreground) and drop the
CDP session `agent-browser` needs.

Use the idempotent orchestrator (`scripts/agent-app.mjs`). It guarantees exactly
one backgrounded dev stack, tracks it via `.dev/agent-app.pid`, and streams logs
to `.dev/agent-app.log`:

```bash
pnpm app:up        # bring the stack up (no-op if already healthy)
pnpm app:status    # dev-server + CDP health (exit 0 = healthy)
pnpm app:logs      # recent logs
pnpm app:restart   # down then up — use after editing electron/ main-process code
pnpm app:down      # stop and free ports 1420 / 9222
pnpm app:browser   # renderer-only browser fallback (no Electron)
```

## Browser Automation with agent-browser

The installed `agent-browser` is **0.26.0**. Two modes:

### Electron Mode (default — full app via CDP)

`pnpm app:up` runs the full Electron app with `--remote-debugging-port=9222`,
giving real native dialogs, git operations, and Bitbucket IPC. Connect over CDP
(the command is `connect`, **not** `cdp connect`):

```bash
agent-browser connect http://localhost:9222
agent-browser snapshot -i           # interactive elements with @refs
agent-browser click @e9             # click by ref
agent-browser screenshot out.png    # capture
agent-browser get url               # confirm current route
```

Use the `electron` skill for Electron-specific patterns:

```bash
agent-browser skills get electron
```

### Browser Mode (renderer-only)

For pure UI layout/styling work without Electron, `pnpm app:browser` serves the
Vite renderer at `http://localhost:1420` with `VITE_DESKTOP_FALLBACK=browser`:
native APIs are mocked (folder selection uses `window.prompt()`, git ops return
empty data).

```bash
agent-browser open http://localhost:1420
```

`window.prompt()` is a blocking native dialog agent-browser cannot interact with.
Override it before clicking:

```bash
agent-browser eval 'window.prompt = () => "/tmp/test-repo"'
agent-browser click @e5
```

### Chrome DevTools (manual inspection)

Open `chrome://inspect` in Chrome, click **"Configure..."**, add `localhost:9222`. The Electron app will appear under **Remote Targets**.

### Quick Reference

| What        | Browser Mode (`pnpm app:browser`)          | Electron Mode (`pnpm app:up`)                 |
| ----------- | ------------------------------------------ | --------------------------------------------- |
| URL         | `http://localhost:1420`                    | CDP on `http://localhost:9222`                |
| Connect     | `agent-browser open http://localhost:1420` | `agent-browser connect http://localhost:9222` |
| Native APIs | Browser fallbacks (mock data)              | Full Electron APIs                            |
| Best for    | UI layout, styling, component work         | Full integration, git ops, native dialogs     |

- Use `@tanstack/react-hotkeys` for keyboard shortcuts in the desktop app.
- Do not use React memoization as a render escape hatch (`React.memo`, `useMemo`, `useCallback`) to mask render flow problems.
- Prefer component composition with Redux-connected boundaries to control render scope:
  - Read only the necessary slice in each component.
  - Keep frequently changing state subscriptions as close to the leaf component as possible.
- Use RTK Query selectFromResult to subscribe only to needed fields.
- Ignore backwards compatibility to apis unless explicitly told so
- For api reference github or bitbucket ./api-ref/
