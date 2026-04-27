# Agent Engineering Rules

## Running the Electron Dev Server & Connecting agent-browser

### Start the dev server

```bash
vp run:dev electron
```

This starts the Vite renderer, builds the main/preload bundles in watch mode, and launches Electron with **`--remote-debugging-port=9222`** automatically.

### Connect agent-browser to the running Electron app

Once Electron is running, connect via CDP on port 9222:

```bash
# List available targets (windows/views) in the Electron app
agent-browser cdp connect http://localhost:9222

# Or pass it directly when starting a session
agent-browser session new --cdp-url http://localhost:9222
```

> **Note:** Use the `electron` skill for Electron-specific patterns:
>
> ```bash
> agent-browser skills get electron
> ```

### Chrome DevTools (manual inspection)

Open `chrome://inspect` in Chrome → click **"Configure..."** → add `localhost:9222` → the Electron app will appear under **Remote Targets**.

- Use `@tanstack/react-hotkeys` for keyboard shortcuts in the desktop app.
- Do not use React memoization as a render escape hatch (`React.memo`, `useMemo`, `useCallback`) to mask render flow problems.
- Prefer component composition with Redux-connected boundaries to control render scope:
  - Read only the necessary slice in each component.
  - Keep frequently changing state subscriptions as close to the leaf component as possible.
- Use RTK Query selectFromResult to subscribe only to needed fields.
- Ignore backwards compatibility to apis unless explicitly told so
- For api reference github or bitbucket ./api-ref/
