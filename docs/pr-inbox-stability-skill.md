# PR inbox stability skill

Use this skill when changing the Bitbucket PR inbox, pull-request diff loading, PR detail prefetching, or cache/rate-limit behavior.

## First checks

1. Read `docs/pr-inbox-cache-map.md` before changing behavior.
2. Identify which layer is changing:
   - Renderer inbox UI: `apps/desktop/src/features/inbox/`
   - Hosted repos RTK Query API: `apps/desktop/src/features/hosted-repos/api.ts`
   - Main-process Bitbucket API/client code: `apps/desktop/electron/bitbucket-repo.ts`, `apps/desktop/electron/inbox/`, `apps/desktop/electron/hosted-repos/pullRequests.ts`
   - IPC bridge: `apps/desktop/electron/preload.ts`, `apps/desktop/electron/main.ts`
3. Preserve stale cache data on failures. Do not clear useful snapshots before replacement data has been fetched and written.

## Stability rules

- Make cache source explicit in contracts and UI when introducing or changing cached data.
- Keep Bitbucket 429s typed in the main process. Preserve `Retry-After` timing and avoid converting rate limits into empty inboxes.
- Avoid unbounded Bitbucket request fan-out. Use bounded concurrency for enrichment and cap speculative background prefetch.
- Keep foreground user actions safer than background warming. If there is no scheduler yet, reduce background work instead of adding more speculative calls.
- Add focused tests for cache hit, cache miss, stale cache, background work, and rate-limit paths.
- Avoid relying on `pnpm test -- <file>` for targeted tests; in this repo that can run the full suite. Use the reliable commands below.

## Reliable commands

From the repo root:

```bash
pnpm check:pr-inbox
pnpm test:pr-inbox
pnpm --filter desktop typecheck
```

For one targeted test file:

```bash
pnpm --dir apps/desktop exec vp test run --config vitest.config.ts electron/bitbucket-repo.test.ts
```

For all tests before pushing:

```bash
pnpm test
```

Pre-push hooks already run `pnpm --filter desktop typecheck` and the desktop test suite.
