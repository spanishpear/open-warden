# Agent Engineering Rules

## Browser Automation with agent-browser

Two modes are available depending on whether you need native Electron APIs or just the web UI.

### Browser Mode (Web UI)

For UI layout, styling, and component work without Electron.

```bash
pnpm dev
```

This starts the Vite renderer at `http://localhost:1420` with `VITE_DESKTOP_FALLBACK=browser`. Native Electron APIs are replaced with browser fallbacks: folder selection uses `window.prompt()`, git operations return mock/empty data.

Connect agent-browser directly:

```bash
agent-browser open http://localhost:1420
agent-browser snapshot -i           # see interactive elements
agent-browser click @e9             # click an element by ref
agent-browser screenshot out.png    # capture the result
```

`window.prompt()` is a blocking native dialog that agent-browser cannot interact with. To automate past it, override prompt before clicking:

```bash
agent-browser eval 'window.prompt = () => "/tmp/test-repo"'
agent-browser click @e5  # now the click completes instantly
```

### Electron Mode (Desktop App via CDP)

For full integration testing with native dialogs, git operations, and file system access.

```bash
pnpm dev:electron
```

This launches Electron with `--remote-debugging-port=9222` automatically. Connect agent-browser to the running app:

```bash
agent-browser cdp connect http://localhost:9222

# Or start a session directly
agent-browser session new --cdp-url http://localhost:9222
```

Use the `electron` skill for Electron-specific patterns:

```bash
agent-browser skills get electron
```

### Chrome DevTools (manual inspection)

Open `chrome://inspect` in Chrome, click **"Configure..."**, add `localhost:9222`. The Electron app will appear under **Remote Targets**.

### Quick Reference

| What        | Browser Mode                               | Electron Mode                                     |
| ----------- | ------------------------------------------ | ------------------------------------------------- |
| Start       | `pnpm dev`                                 | `pnpm dev:electron`                               |
| URL         | `http://localhost:1420`                    | CDP on `http://localhost:9222`                    |
| Connect     | `agent-browser open http://localhost:1420` | `agent-browser cdp connect http://localhost:9222` |
| Native APIs | Browser fallbacks (mock data)              | Full Electron APIs                                |
| Best for    | UI layout, styling, component work         | Full integration, git ops, native dialogs         |

- Use `@tanstack/react-hotkeys` for keyboard shortcuts in the desktop app.
- Do not use React memoization as a render escape hatch (`React.memo`, `useMemo`, `useCallback`) to mask render flow problems.
- Prefer component composition with Redux-connected boundaries to control render scope:
  - Read only the necessary slice in each component.
  - Keep frequently changing state subscriptions as close to the leaf component as possible.
- Use RTK Query selectFromResult to subscribe only to needed fields.
- Ignore backwards compatibility to apis unless explicitly told so
- For api reference github or bitbucket ./api-ref/
