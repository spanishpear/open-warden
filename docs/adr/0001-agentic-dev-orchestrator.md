# 0001 — Agentic dev orchestrator

**Status:** Accepted (2026-05-30)

## Context

Agents (and humans) repeatedly ran `pnpm dev:electron` directly. It is a blocking
foreground `concurrently` process with no tracking, so:

- Re-running it spawned duplicate stacks. Electron's single-instance lock
  (`apps/desktop/electron/main.ts`) made the new process exit while the existing
  app's `second-instance` handler `show()`+`focus()`ed the window — so it "kept
  re-opening".
- There was no reliable way to background the stack, tail its logs, or know if it
  was healthy, and the CDP session agent-browser needs dropped on every
  main-process rebuild.

## Decision

Add `scripts/agent-app.mjs`, an **idempotent, backgrounded** orchestrator, fronted
by `pnpm app:up | app:down | app:status | app:restart | app:logs | app:browser`.
It guarantees exactly one tracked dev stack (PID file in `.dev/`), streams logs to
`.dev/agent-app.log`, exposes CDP on `:9222`, polls for health, and sweeps stale
ports. `app:up` is a no-op when already healthy.

`CLAUDE.md` and `AGENTS.md` make the rule explicit: **never run `pnpm dev:electron`
/ `pnpm dev` directly; use `pnpm app:*`.** The health probe checks both IPv4 and
IPv6 because Vite binds `localhost` (often `::1`) while CDP listens on `127.0.0.1`.

## Consequences

- One canonical, repeatable way to run + drive the app; no more window thrash or
  orphaned ports.
- `.dev/` is gitignored; installed skill dirs (`.agents`, `.claude`) are excluded
  from lint/format so they don't break pre-commit.
- The orchestrator wraps the existing `dev:electron` script rather than replacing
  it, so the underlying build pipeline is unchanged.
