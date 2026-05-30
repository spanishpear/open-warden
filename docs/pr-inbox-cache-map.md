# PR inbox Bitbucket cache map

This document maps the current PR inbox and pull-request diff cache behavior so later hardening work can make cache state, background work, and rate-limit handling explicit.

## Entry points

| Layer                           | Entry point                                                           | Notes                                                                                                                                                                                                                      |
| ------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Renderer inbox screen           | `apps/desktop/src/features/inbox/screens/InboxScreen.tsx`             | Calls `useGetInboxPullRequestsQuery` for Bitbucket repos, exposes a refresh button through `useRefreshInboxPullRequestsMutation`, and displays open/merged cache source, stale/partial status, and active background work. |
| Renderer background prefetch    | `apps/desktop/src/features/inbox/hooks/useBackgroundInboxPrefetch.ts` | After inbox data loads, schedules `prefetchPullRequestDetail` for at most 10 unique PRs, sorted by `updatedAt`, with a 1.5 second gap. It pauses while inbox refresh or merged-cache warming is active.                    |
| Renderer hover prefetch         | `apps/desktop/src/features/inbox/hooks/useInboxNavigation.ts`         | `prefetchPullRequestDetail` warms `getPullRequestDiffCached`, `getPullRequestConversation`, and `getPullRequestFiles` with RTK Query `force: false`.                                                                       |
| RTK Query API                   | `apps/desktop/src/features/hosted-repos/api.ts`                       | Uses `fakeBaseQuery`; all endpoint errors are converted to `{ message }`. PR detail queries keep unused data for 300 seconds in renderer memory. Cached diff queries return patch text plus cache source metadata.         |
| IPC bridge                      | `apps/desktop/electron/preload.ts`, `apps/desktop/electron/main.ts`   | A single `desktop:invoke` channel forwards method name and args. The preload bridge rejects renderer calls after 120 seconds, but there is still no main-process cancellation or priority metadata.                        |
| Desktop API                     | `apps/desktop/electron/desktop-api.ts`                                | Wires `getInboxPullRequests`, `refreshInboxPullRequests`, `getPullRequestDiffCached`, `getPullRequestConversation`, and `getPullRequestFiles` into the shared `DesktopApi`.                                                |
| Main-process inbox orchestrator | `apps/desktop/electron/inbox/orchestrator.ts`                         | Resolves hosted repo, credentials, user identity, SQLite snapshots, live Bitbucket fetches, classification, and background refresh.                                                                                        |
| Bitbucket HTTP client           | `apps/desktop/electron/bitbucket-repo.ts`                             | `bitbucketRequest` wraps `fetch`, throws on non-OK responses, and preserves 429 responses as typed `BitbucketRateLimitError`s with parsed `Retry-After` timing. It does not automatically retry.                           |

## Persistent caches

### SQLite inbox cache

Implementation: `apps/desktop/electron/inbox/cache.ts` and `apps/desktop/electron/inbox/pr-cache.ts`.

Database path: `app.getPath("userData")/open-warden-cache.db`.

Tables:

| Table             | Key                  | Contents                                                                                              | Current expiry behavior                                                                                                                 |
| ----------------- | -------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `inbox_snapshots` | `(repo_path, scope)` | JSON-serialized `InboxPullRequest[]`, `fetched_at`, and `is_partial`. Scopes are `open` and `merged`. | `OPEN_CACHE_TTL_MS` is 2 minutes. `MERGED_CACHE_TTL_MS` is 10 minutes. Both scopes are exposed through `InboxPullRequestsResult.cache`. |
| `user_identity`   | `provider_id`        | Bitbucket `uuid`, `account_id`, `login`, `display_name`, `fetched_at`.                                | `IDENTITY_CACHE_TTL_MS` is 24 hours. Stale identity is returned immediately while a refresh runs in the background.                     |
| `cache_metadata`  | `key`                | Generic string metadata.                                                                              | Present in the schema but not currently used by the inbox flow.                                                                         |

Important details:

- `getDb` enables WAL mode and initializes tables lazily.
- `cacheInboxSnapshot` serializes a reduced PR shape and writes an upsert.
- `getCachedInboxSnapshot` drops malformed or non-array JSON by returning `null`.
- `clearInboxCache(repoPath)` deletes all inbox snapshots for that repo, including both `open` and `merged` scopes; manual refresh no longer clears before a successful replacement fetch.
- `isPartial`, source (`empty`/`cache`/`live`), and per-scope staleness are exposed through `InboxPullRequestsResult.cache` in `apps/desktop/src/platform/desktop/contracts.ts`.

### Filesystem content cache

Implementation: `apps/desktop/electron/inbox/content-cache.ts`.

Root: `app.getPath("userData")/open-warden-content-cache`.

| Key helper                                                       | Contents                                                                                          | Expiry                                                    |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `prDiffKey(providerId, owner, repo, prNumber, baseSha, headSha)` | Pull-request patch text at `pr/<provider>/<owner>/<repo>/<number>/<baseSha>/<headSha>/patch.txt`. | 14 days by file `mtime`; stale files are deleted on read. |
| `gitFileKey(repoPath, commitId, filePath)`                       | Git file-version content.                                                                         | Same 14-day read-time expiry.                             |

Important details:

- `cacheContent` is immutable for an existing key; if the file exists, it returns without rewriting.
- PR diff cache keys include base and head SHAs, so a force-push naturally misses the old cache key.
- `getPullRequestDiffCached` still performs a live provider PR metadata request before it can compute the SHA-based diff cache key.
- `getPullRequestDiffCached` returns `PullRequestDiffResult`, including `cache.source`, `cache.key`, `baseSha`, and `headSha`; the files screen displays whether the patch came from disk cache or the provider API.

## Renderer and in-memory caches

| Cache             | Location                                                               | Contents                                                                           | Notes                                                                                                                                                          |
| ----------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RTK Query cache   | `apps/desktop/src/features/hosted-repos/api.ts`                        | Inbox result, PR conversation, changed files, patch text plus diff cache metadata. | PR conversation/files/diff queries use `keepUnusedDataFor: 300`. Inbox query has normal RTK Query lifetime and is invalidated by refresh and review mutations. |
| Parsed diff LRU   | `apps/desktop/src/features/diff-view/services/parsedDiffCache.ts`      | Parsed file diffs and parsed PR patches.                                           | Holds up to 64 entries per map and deduplicates in-flight parses by cache key.                                                                                 |
| Diff worker queue | `apps/desktop/src/features/diff-view/services/parseDiffInWorker.ts`    | Active parse work.                                                                 | File diffs use `AsyncQueuer` with concurrency 1 and priority. Patch parsing posts directly to the worker and tracks `patchRequests`.                           |
| Highlighter cache | `apps/desktop/src/features/pull-requests/screens/PullRequestFiles.tsx` | Worker-pool highlight results.                                                     | `FilesDiffViewer` prewarms syntax highlighting for parsed files in the background.                                                                             |

## What fetches live data

### Inbox load

`getInboxPullRequests(repoPath)` in `apps/desktop/electron/inbox/orchestrator.ts`:

1. Resolves the active repo with `resolveHostedRepo`.
2. Rejects non-Bitbucket providers.
3. Loads provider credentials through `getProviderConnection`.
4. Resolves Bitbucket identity with `getOrResolveUserIdentity`.
5. Reads the `open` snapshot from SQLite.
6. If the `open` snapshot is fresh, returns cached `open` plus cached `merged`; if `merged` is missing or stale, schedules merged-cache warming without blocking the response.
7. If the `open` snapshot is stale, returns cached data with `isStale: true`, marks background refresh metadata, and schedules a deduped background refresh for open and merged scopes.
8. If the `open` snapshot is missing, fetches open PRs live, caches them, starts a deduped merged PR fetch in the background, and returns open PRs immediately.
9. `refreshInboxPullRequests` performs live open and merged fetches before replacing snapshots, so stale snapshots survive failed manual refresh attempts.

Live Bitbucket calls from `apps/desktop/electron/inbox/bitbucket-inbox.ts`:

- `fetchBitbucketInboxPullRequests` queries open PRs where the current user is author or reviewer.
- `fetchBitbucketRecentlyMergedPullRequests` queries merged PRs updated in the last 7 days where the current user is author or reviewer.
- Each query paginates through `fetchBitbucketPaginatedValues` with 20 PRs per page and max 25 pages.
- After PR pages load, every PR may trigger a build-status request and a diffstat request; enrichment is limited to 4 concurrent requests per enrichment type instead of unbounded fan-out.

### PR files tab and diff loading

Renderer: `apps/desktop/src/features/pull-requests/screens/PullRequestFiles.tsx`.

Main process: `apps/desktop/electron/hosted-repos/pullRequests.ts`.

For a selected PR, the files screen issues three RTK Query requests:

- `getPullRequestDiffCached`: live PR metadata fetch, filesystem patch cache read, live patch fetch only on cache miss, and `PullRequestDiffResult.cache` metadata telling the renderer whether the patch came from disk cache or provider API.
- `getPullRequestFiles`: live changed-files/diffstat fetch.
- `getPullRequestConversation`: live PR detail plus comments/conversation fetch; the renderer polls conversation every 30 seconds on the files tab.

`PullRequestConversation.tsx` separately polls conversation every 10 seconds on the conversation tab.

## Background activity

| Background work             | Trigger                                                                              | What it does                                                                                                                        | Current visibility                                                                                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stale inbox refresh         | `getInboxPullRequests` sees stale open snapshot.                                     | `setTimeout(..., 0)` runs a deduped `refreshBitbucketInbox`, which fetches open PRs and then merged PRs, and writes both snapshots. | Renderer receives `isStale: true`, per-scope cache metadata, and `background.openRefresh` / `background.mergedRefresh`; errors are logged in the main process. |
| Cold-cache merged fetch     | Cold open inbox fetch completes, or fresh open cache has missing/stale merged cache. | A deduped `fetchAndCacheMerged` runs fire-and-forget and caches recent merged PRs.                                                  | Renderer receives `background.mergedRefresh: true`; merged data appears after a later query reads the cache.                                                   |
| Stale identity refresh      | Cached identity is stale.                                                            | Returns stale identity immediately and refreshes `/user` in the background.                                                         | No UI state. Errors are swallowed by `resolveUserIdentity`.                                                                                                    |
| Inbox PR detail prefetch    | Inbox data changes and no inbox background refresh is active.                        | `useBackgroundInboxPrefetch` queues diff, conversation, and files prefetches for at most 10 unique PRs at 1.5 second intervals.     | No foreground/background priority is communicated to IPC or Bitbucket yet; work is capped and paused during inbox refresh.                                     |
| Row hover prefetch          | Mouse enters an inbox row.                                                           | Prefetches diff, conversation, and files for that PR.                                                                               | No visible state.                                                                                                                                              |
| Syntax highlighting prewarm | PR patch has been parsed.                                                            | Warms the diff highlighter cache for parsed files.                                                                                  | No visible state.                                                                                                                                              |
| Conversation polling        | PR conversation/files screens mounted.                                               | Refetches conversation every 10 seconds or 30 seconds depending on tab.                                                             | Standard screen loading/error states only.                                                                                                                     |

## Rate-limit and stuck-loading risks

1. `bitbucketRequest` preserves 429s and `Retry-After` timing, but it still does not automatically retry or coordinate global backoff.
2. `fetchBitbucketPullRequests` now rethrows typed 429s, but non-rate-limit API failures still degrade to an empty result.
3. Build-status and diffstat enrichment are concurrency-limited, but a 500-PR inbox can still eventually perform hundreds of enrichment requests.
4. Background prefetch is capped and paused during inbox refresh, but it still has no foreground/background priority at the IPC or Bitbucket request layer.
5. Cold-cache merged fetches and stale refreshes are deduped in-process only; they are not coordinated across app restarts or multiple windows.
6. Stale background refresh errors are logged in the main process but are not surfaced as actionable renderer UI.
7. Manual refresh preserves stale snapshots until replacement fetches succeed, but the refresh mutation error is not prominently displayed in the inbox UI.
8. `desktop:invoke` now has a 120 second renderer timeout, but no main-process cancellation; timed-out handlers can keep running in the background.
9. Diff loading displays cache source metadata after success and rate-limit messages on failure, but retry timing is still only part of the error message, not structured renderer state.
10. `parsePatchInWorker` abort recreates the worker, but aborted patch requests are best-effort cleanup; this is separate from Bitbucket rate limits but can contribute to perceived stuck diff loading.

## Data that is not currently exposed to users or developers

- Whether PR detail prefetch is active, queued, skipped, or blocked by rate limits.
- Structured renderer state for Bitbucket rate-limit retry timing; today retry timing is preserved in the error object in the main process and included in the error message across IPC.
- Which background request failed when stale refresh or merged fetch fails; failures are logged but not visible in the inbox UI.
- Main-process cancellation state for renderer calls that timed out after 120 seconds.

## Existing tests and useful commands

Reliable commands from the repo root:

```bash
pnpm check:pr-inbox
pnpm test:pr-inbox
pnpm --filter desktop typecheck
```

For a single targeted test file, avoid `pnpm test -- <file>` because the extra separator can run the full configured suite in this repo. Use `vp test run` directly:

```bash
pnpm --dir apps/desktop exec vp test run --config vitest.config.ts electron/bitbucket-repo.test.ts
pnpm --dir apps/desktop exec vp test run --config vitest.config.ts electron/inbox/orchestrator.test.ts
pnpm --dir apps/desktop exec vp test run --config vitest.config.ts electron/hosted-repos/pullRequests.test.ts
```

Coverage notes:

- `orchestrator.test.ts` covers cold cache, warm cache, stale cache, background refresh scheduling, duplicate PR deduplication, identity failure, unsupported provider, and no-hosted-repo paths.
- `bitbucket-repo.test.ts` covers typed 429 handling and `Retry-After` parsing.
- `bitbucket-inbox.test.ts` covers query construction, pagination, 500-result cap, comments, build statuses, diffstat-to-change-stats mapping, typed 429 propagation, and some API failure paths.
- `pr-cache.test.ts`, `cache.test.ts`, `content-cache.test.ts`, and `identity.test.ts` cover the core cache storage layers.
- `InboxScreen.test.tsx` covers loading, error/retry rendering, section counts, search filtering, stale indicator in the merged section, cache status copy, and background prefetch trigger.
- `hosted-repos/pullRequests.test.ts` now covers `getPullRequestDiffCached` cache-hit and live-fetch metadata for Bitbucket.

## Recommended next hardening seams

1. Add a Bitbucket request scheduler that can dedupe, rate-limit, and prioritize foreground requests over background prefetch.
2. Surface rate-limit retry timing as structured renderer state, not only formatted error text.
3. Make background work failures visible in the inbox UI or a diagnostics panel.
4. Add main-process cancellation for renderer calls that hit the 120 second preload timeout.
5. Add direct tests for manual refresh failure, duplicate in-flight inbox loads, and rate-limit responses on foreground diff requests.
6. Consider moving expensive inbox enrichment into its own background cache so the base inbox can render before build statuses and diffstat finish.
