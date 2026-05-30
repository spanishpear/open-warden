# OpenWarden — agent guide

OpenWarden is a **high-performance pull-request manager** for internal Atlassian
PR workflows. It is an Electron + React + TypeScript desktop app that talks to
Bitbucket. This is a fork of upstream `open-warden`.

**Focus right now: pull requests.** Reviewing, approving, commenting, reacting,
and moving through PR diffs fast and with excellent UX. The local git-client
features (Changes/History) exist but are **not** the priority. Performance and
UX quality are the bar for everything.

See also: `AGENTS.md` (engineering rules + browser automation) and `docs/`.

## Running the app (READ THIS FIRST)

**Never run `pnpm dev:electron` or `pnpm dev` directly.** They are blocking
foreground processes. Re-running them spawns duplicate stacks that fight the
single-instance lock and make the window keep popping to the foreground, and
they drop the CDP session that `agent-browser` needs.

Use the idempotent orchestrator instead. It guarantees exactly one backgrounded
dev stack, tracks it via a PID file, and streams logs to `.dev/agent-app.log`:

```bash
pnpm app:up        # bring the stack up (no-op if already healthy)
pnpm app:status    # report dev-server + CDP health (exit 0 = healthy)
pnpm app:logs      # print recent logs (node scripts/agent-app.mjs logs -f to follow)
pnpm app:restart   # down then up (use after editing electron/ main-process code)
pnpm app:down      # stop the stack and free ports 1420 / 9222
pnpm app:browser   # renderer-only browser fallback (no Electron, mocked native APIs)
```

`pnpm app:up` runs the **full Electron app** with `--remote-debugging-port=9222`
so native git + Bitbucket IPC work. It is safe to call repeatedly — if the stack
is already healthy it just prints the connection info and exits.

### Driving the app with agent-browser

The installed `agent-browser` is **0.26.0**. Connect over CDP (note: the command
is `connect`, not `cdp connect`):

```bash
agent-browser connect http://localhost:9222
agent-browser snapshot -i           # interactive elements with @refs
agent-browser click @e9             # click by ref
agent-browser screenshot out.png    # capture
agent-browser get url               # confirm current route
```

For Electron-specific patterns: `agent-browser skills get electron`.

Renderer edits hot-reload automatically — no restart needed. Only main-process
edits under `apps/desktop/electron/` require `pnpm app:restart`.

## Verifying changes

```bash
pnpm --filter desktop typecheck   # tsgo, app + electron projects
pnpm test                         # full vitest suite
pnpm check:pr-inbox               # typecheck + the PR-inbox-focused test set
pnpm lint && pnpm fmt:check       # oxlint + formatting
```

When touching the PR inbox / diff loading / Bitbucket cache, read
`docs/pr-inbox-stability-skill.md` and `docs/pr-inbox-cache-map.md` first.

## Architecture map

- `apps/desktop/electron/` — main process. Bitbucket client + cache live in
  `bitbucket-repo.ts` and `inbox/`; hosted-repo PR APIs in `hosted-repos/`; IPC
  bridge in `preload.ts` + `main.ts` (`desktop:invoke` channel).
- `apps/desktop/src/features/` — renderer features. PR-relevant:
  `inbox/`, `pull-requests/`, `hosted-repos/`, `diff-view/`, `comments/`,
  `command-palette/`, `review/`.
- `apps/desktop/src/features/hosted-repos/api.ts` — RTK Query API surface.
- Diffs/trees use `@pierre/diffs` and `@pierre/trees`.

## Engineering conventions (see AGENTS.md for the full list)

- TypeScript everywhere; `tsgo` for typechecks, `vite-plus` (`vp`) for tooling.
- `@tanstack/react-hotkeys` for keyboard shortcuts.
- Do NOT use `React.memo` / `useMemo` / `useCallback` to mask render-flow
  problems. Control render scope with composition + Redux-connected boundaries;
  read the narrowest slice per component; use RTK Query `selectFromResult`.
- Ignore backward compatibility for internal APIs unless told otherwise.
- API references live in `./api-ref/`.
