# PR inbox Bitbucket cache map

This document maps the current PR inbox and pull-request diff cache behavior so later hardening work can make cache state, background work, and rate-limit handling explicit.

## Entry points

| Layer                           | Entry point                                                           | Notes                                                                                                                                                                                                                       |
| ------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Renderer inbox screen           | `apps/desktop/src/features/inbox/screens/InboxScreen.tsx`             | Calls `useGetInboxPullRequestsQuery` for Bitbucket repos, exposes a refresh button through `useRefreshInboxPullRequestsMutation`, and only displays `isStale` as `Loading more data…` for the `MERGING_AND_MERGED` section. |
| Renderer background prefetch    | `apps/desktop/src/features/inbox/hooks/useBackgroundInboxPrefetch.ts` | After inbox data loads, schedules `prefetchPullRequestDetail` for every unique PR, sorted by `updatedAt`, with a 150 ms gap.                                                                                                |
| Renderer hover prefetch         | `apps/desktop/src/features/inbox/hooks/useInboxNavigation.ts`         | `prefetchPullRequestDetail` warms `getPullRequestDiffCached`, `getPullRequestConversation`, and `getPullRequestFiles` with RTK Query `force: false`.                                                                        |
| RTK Query API                   | `apps/desktop/src/features/hosted-repos/api.ts`                       | Uses `fakeBaseQuery`; all endpoint errors are converted to `{ message }`. PR detail queries keep unused data for 300 seconds in renderer memory.                                                                            |
| IPC bridge                      | `apps/desktop/electron/preload.ts`, `apps/desktop/electron/main.ts`   | A single `desktop:invoke` channel forwards method name and args. There is no timeout, cancellation, or priority metadata at this layer.                                                                                     |
| Desktop API                     | `apps/desktop/electron/desktop-api.ts`                                | Wires `getInboxPullRequests`, `refreshInboxPullRequests`, `getPullRequestDiffCached`, `getPullRequestConversation`, and `getPullRequestFiles` into the shared `DesktopApi`.                                                 |
| Main-process inbox orchestrator | `apps/desktop/electron/inbox/orchestrator.ts`                         | Resolves hosted repo, credentials, user identity, SQLite snapshots, live Bitbucket fetches, classification, and background refresh.                                                                                         |
| Bitbucket HTTP client           | `apps/desktop/electron/bitbucket-repo.ts`                             | `bitbucketRequest` wraps `fetch`, throws on non-OK responses, and does not inspect `Retry-After` or retry.                                                                                                                  |

## Persistent caches

### SQLite inbox cache

Implementation: `apps/desktop/electron/inbox/cache.ts` and `apps/desktop/electron/inbox/pr-cache.ts`.

Database path: `app.getPath("userData")/open-warden-cache.db`.

Tables:

| Table             | Key                  | Contents                                                                                              | Current expiry behavior                                                                                                                |
| ----------------- | -------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `inbox_snapshots` | `(repo_path, scope)` | JSON-serialized `InboxPullRequest[]`, `fetched_at`, and `is_partial`. Scopes are `open` and `merged`. | `OPEN_CACHE_TTL_MS` is 2 minutes. `MERGED_CACHE_TTL_MS` is 10 minutes, but the orchestrator only gates on the open snapshot age today. |
| `user_identity`   | `provider_id`        | Bitbucket `uuid`, `account_id`, `login`, `display_name`, `fetched_at`.                                | `IDENTITY_CACHE_TTL_MS` is 24 hours. Stale identity is returned immediately while a refresh runs in the background.                    |
| `cache_metadata`  | `key`                | Generic string metadata.                                                                              | Present in the schema but not currently used by the inbox flow.                                                                        |

Important details:

- `getDb` enables WAL mode and initializes tables lazily.
- `cacheInboxSnapshot` serializes a reduced PR shape and writes an upsert.
- `getCachedInboxSnapshot` drops malformed or non-array JSON by returning `null`.
- `clearInboxCache(repoPath)` deletes all inbox snapshots for that repo, including both `open` and `merged` scopes.
- `isPartial` is stored in SQLite but is not exposed through `InboxPullRequestsResult` in `apps/desktop/src/platform/desktop/contracts.ts`.

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

## Renderer and in-memory caches

| Cache             | Location                                                               | Contents                                                  | Notes                                                                                                                                                          |
| ----------------- | ---------------------------------------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RTK Query cache   | `apps/desktop/src/features/hosted-repos/api.ts`                        | Inbox result, PR conversation, changed files, patch text. | PR conversation/files/diff queries use `keepUnusedDataFor: 300`. Inbox query has normal RTK Query lifetime and is invalidated by refresh and review mutations. |
| Parsed diff LRU   | `apps/desktop/src/features/diff-view/services/parsedDiffCache.ts`      | Parsed file diffs and parsed PR patches.                  | Holds up to 64 entries per map and deduplicates in-flight parses by cache key.                                                                                 |
| Diff worker queue | `apps/desktop/src/features/diff-view/services/parseDiffInWorker.ts`    | Active parse work.                                        | File diffs use `AsyncQueuer` with concurrency 1 and priority. Patch parsing posts directly to the worker and tracks `patchRequests`.                           |
| Highlighter cache | `apps/desktop/src/features/pull-requests/screens/PullRequestFiles.tsx` | Worker-pool highlight results.                            | `FilesDiffViewer` prewarms syntax highlighting for parsed files in the background.                                                                             |

## What fetches live data

### Inbox load

`getInboxPullRequests(repoPath)` in `apps/desktop/electron/inbox/orchestrator.ts`:

1. Resolves the active repo with `resolveHostedRepo`.
2. Rejects non-Bitbucket providers.
3. Loads provider credentials through `getProviderConnection`.
4. Resolves Bitbucket identity with `getOrResolveUserIdentity`.
5. Reads the `open` snapshot from SQLite.
6. If the `open` snapshot is fresh, returns cached `open` plus cached `merged` and performs no Bitbucket PR fetch.
7. If the `open` snapshot is stale, returns cached data with `isStale: true` and schedules a background refresh.
8. If the `open` snapshot is missing, fetches open PRs live, caches them, starts merged PR fetch in the background, and returns open PRs immediately.

Live Bitbucket calls from `apps/desktop/electron/inbox/bitbucket-inbox.ts`:

- `fetchBitbucketInboxPullRequests` queries open PRs where the current user is author or reviewer.
- `fetchBitbucketRecentlyMergedPullRequests` queries merged PRs updated in the last 7 days where the current user is author or reviewer.
- Each query paginates through `fetchBitbucketPaginatedValues` with 20 PRs per page and max 25 pages.
- After PR pages load, every PR may trigger a build-status request and a diffstat request.

### PR files tab and diff loading

Renderer: `apps/desktop/src/features/pull-requests/screens/PullRequestFiles.tsx`.

Main process: `apps/desktop/electron/hosted-repos/pullRequests.ts`.

For a selected PR, the files screen issues three RTK Query requests:

- `getPullRequestDiffCached`: live PR metadata fetch, filesystem patch cache read, and live patch fetch only on cache miss.
- `getPullRequestFiles`: live changed-files/diffstat fetch.
- `getPullRequestConversation`: live PR detail plus comments/conversation fetch; the renderer polls conversation every 30 seconds on the files tab.

`PullRequestConversation.tsx` separately polls conversation every 10 seconds on the conversation tab.

## Background activity

| Background work             | Trigger                                          | What it does                                                                                                              | Current visibility                                                                                               |
| --------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Stale inbox refresh         | `getInboxPullRequests` sees stale open snapshot. | `setTimeout(..., 0)` runs `refreshBitbucketInbox`, which fetches open PRs and then merged PRs, and writes both snapshots. | Renderer receives `isStale: true`, but only the merged section shows `Loading more data…`. Errors are swallowed. |
| Cold-cache merged fetch     | Cold open inbox fetch completes.                 | `fetchAndCacheMerged` runs fire-and-forget and caches recent merged PRs.                                                  | No explicit UI state; merged data appears only after a later query reads the cache.                              |
| Stale identity refresh      | Cached identity is stale.                        | Returns stale identity immediately and refreshes `/user` in the background.                                               | No UI state. Errors are swallowed by `resolveUserIdentity`.                                                      |
| Inbox PR detail prefetch    | Inbox data changes.                              | `useBackgroundInboxPrefetch` queues diff, conversation, and files prefetches for every unique PR at 150 ms intervals.     | No visible state, no foreground/background priority communicated to IPC or Bitbucket.                            |
| Row hover prefetch          | Mouse enters an inbox row.                       | Prefetches diff, conversation, and files for that PR.                                                                     | No visible state.                                                                                                |
| Syntax highlighting prewarm | PR patch has been parsed.                        | Warms the diff highlighter cache for parsed files.                                                                        | No visible state.                                                                                                |
| Conversation polling        | PR conversation/files screens mounted.           | Refetches conversation every 10 seconds or 30 seconds depending on tab.                                                   | Standard screen loading/error states only.                                                                       |

## Rate-limit and stuck-loading risks

1. `bitbucketRequest` throws on 429 but does not inspect `Retry-After`, apply backoff, or preserve a typed rate-limit error.
2. `fetchBitbucketPullRequests` catches all top-level errors and returns an empty result. A first-page 429 can look like an empty inbox.
3. Build-status and diffstat enrichment run with unbounded `Promise.allSettled` fan-out. A 500-PR inbox can attempt hundreds of status and diffstat requests in one burst.
4. Background prefetch has no foreground/background priority at the IPC or Bitbucket request layer. It can spend rate-limit budget on diff, conversation, and files requests while the user is trying to open a foreground diff.
5. Cold-cache merged fetches are fire-and-forget. A second inbox load before the merged cache write completes can start duplicate merged work.
6. Stale background refresh errors are swallowed, so stale data can remain without an actionable user message.
7. The explicit refresh path clears both `open` and `merged` snapshots before refetching. If the live fetch is rate-limited, the app may lose useful stale data for that repo.
8. `desktop:invoke` has no timeout or cancellation. A hung main-process handler can leave the renderer query stuck in loading/fetching state.
9. Diff loading displays a generic error when `getPullRequestDiffCached` rejects, but the current contract cannot say whether the patch came from disk cache, live fetch, or a rate-limited request.
10. `parsePatchInWorker` abort recreates the worker, but aborted patch requests are best-effort cleanup; this is separate from Bitbucket rate limits but can contribute to perceived stuck diff loading.

## Data that is not currently exposed to users or developers

- Whether an inbox section was assembled from fresh cache, stale cache, or live Bitbucket data.
- Whether the merged scope is still warming in the background.
- Whether a PR diff was served from filesystem cache or fetched live.
- Whether PR detail prefetch is active, queued, skipped, or blocked by rate limits.
- Whether Bitbucket returned a rate-limit response and when retry is safe.
- Whether an inbox result is partial because the 25-page cap was reached.
- Which background request failed when stale refresh or merged fetch fails.

## Existing tests and useful commands

Targeted commands from `apps/desktop`:

```bash
pnpm test -- electron/inbox
pnpm test -- electron/inbox/orchestrator.test.ts
pnpm test -- electron/inbox/bitbucket-inbox.test.ts
pnpm test -- electron/inbox/pr-cache.test.ts
pnpm test -- electron/inbox/content-cache.test.ts
pnpm test -- electron/inbox/identity.test.ts
pnpm test -- src/features/inbox/screens/InboxScreen.test.tsx
pnpm test -- src/features/inbox/hooks/useInboxNavigation.test.ts
pnpm test -- src/features/diff-view/services/parsedDiffCache.test.ts
pnpm test -- electron/hosted-repos/pullRequests.test.ts
```

Coverage notes:

- `orchestrator.test.ts` covers cold cache, warm cache, stale cache, background refresh scheduling, duplicate PR deduplication, identity failure, unsupported provider, and no-hosted-repo paths.
- `bitbucket-inbox.test.ts` covers query construction, pagination, 500-result cap, comments, build statuses, diffstat-to-change-stats mapping, and some API failure paths.
- `pr-cache.test.ts`, `cache.test.ts`, `content-cache.test.ts`, and `identity.test.ts` cover the core cache storage layers.
- `InboxScreen.test.tsx` covers loading, error/retry rendering, section counts, search filtering, stale indicator in the merged section, and background prefetch trigger.
- `getPullRequestDiffCached` is currently mocked in hosted-repos tests; cache hit/miss and live patch fetch behavior need direct coverage.

## Recommended next hardening seams

1. Add typed cache/source metadata to inbox and diff contracts before changing UI copy.
2. Add a Bitbucket request scheduler that can dedupe, rate-limit, and prioritize foreground requests over background prefetch.
3. Preserve stale snapshots on manual refresh failure instead of clearing before a successful replacement is available.
4. Surface rate-limit errors with retry timing in renderer state.
5. Make background work observable in development logs or a diagnostics command.
6. Add direct tests for `getPullRequestDiffCached`, manual refresh failure, duplicate in-flight inbox loads, and rate-limit responses on foreground diff requests.
