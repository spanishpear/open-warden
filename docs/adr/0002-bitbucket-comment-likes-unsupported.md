# 0002 — Bitbucket comment "likes" are not in the public API

**Status:** Open — needs a product decision (2026-05-30)

## Context

A "like / unlike on PR comments" feature was implemented
(`likePullRequestComment` in `apps/desktop/electron/hosted-repos/pullRequests.ts`,
plus an optimistic RTK mutation and a `CommentLikeButton`). It targets
`PUT`/`DELETE`/`GET .../pullrequests/{id}/comments/{cid}/likes`.

Validation against `api-ref/bitbucket-api.txt` (Bitbucket Cloud REST v2.0):

- The only PR-comment endpoints in the spec are `comments/{id}` and
  `comments/{id}/resolve`. **There is no `likes` endpoint for PR comments.**
- A `vote` endpoint exists only for **issues**
  (`/repositories/{ws}/{repo}/issues/{id}/vote`), not PR comments.

So the implemented endpoint is **not in the public, documented API**. It may exist
as an undocumented internal endpoint behind the Bitbucket web UI, but we cannot
rely on it. In production it will likely 404.

## Decision

Treat the like feature as **unverified / experimental**. It must not be presented
as a reliable action. Options (pick one — pending product input):

1. **Gate it** behind an explicit experimental flag (default off) until validated
   against a live workspace.
2. **Remove it** until/unless a supported endpoint is confirmed.
3. **Keep but clearly mark experimental** and surface failures honestly (it already
   degrades gracefully on read-back failure).

Recommendation: (1) or (2), given the project's "100% reliable" bar.

## Consequences

- No reliable comment-reaction capability on Bitbucket today; this is a Bitbucket
  API limitation, not an implementation gap.
- If a supported endpoint is found, supersede this ADR and wire it in.
