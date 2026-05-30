# PR UX & Parity Audit

OpenWarden (Bitbucket-focused fork of `ShpetimA/open-warden`). Audit of frontend
design quality and feature parity across PR review, inbox, diff viewing, and
comments. Comparison axes: upstream (`upstream/master`), `nkzw-tech/codiff`, and
the Pierre "On rendering diffs" essay (we render via `@pierre/diffs`).

Date: 2026-05-30. Branch: `feat/pr-review-decisions`. Scope: report only, no app
code changed.

---

## Executive summary — top 5 highest-leverage improvements

1. **The Inbox (primary entry surface) has no keyboard navigation.**
   `InboxScreen.tsx` / `InboxPRRow.tsx` ship zero `useHotkey` bindings — no
   arrow/`j`/`k` row movement, no `Enter` to open, and the `isSelected` prop on
   `InboxPRRow` is never wired (`InboxPRRow.tsx:13,44`; `InboxScreen.tsx:184-196`).
   Upstream's `PullRequestsScreen` had full `↑/↓` + `j/k` + `Enter` list nav with
   a live preview pane (`upstream/master:PullRequestsScreen.tsx:459-479,667`). We
   regressed the most-used screen to a mouse-only list. **P0.**

2. **No "mark file viewed" / review-progress tracking anywhere.** Grep for
   `viewed|markViewed|isViewed` across `pull-requests/`, `inbox/`, and the file
   list returns nothing. codiff treats per-file "Viewed" toggling as a core
   review primitive; for multi-file PRs this is the single biggest workflow gap.
   **P0.**

3. **`PullRequestsScreen` was gutted into a "Debug Inbox" launcher.** Our version
   dropped the selection state, keyboard nav, and the inline preview detail pane
   that upstream had (`PullRequestRow` lost `selected`/`index`/`aria-current`;
   compare `PullRequestsScreen.tsx:51-99` to `upstream/master:…:84-160`). It even
   renders a literal `Debug Inbox` button (`PullRequestsScreen.tsx:470-477`). Two
   parallel PR-list surfaces (`/pull-requests` and `/inbox`) now exist with
   diverging quality. Consolidate. **P1.**

4. **Diff style (split/unified) and "expand unchanged" are buried.** The
   split/unified toggle is only reachable from the command palette
   (`AppCommandPalette.tsx:408-425`); it is never surfaced in the PR review
   chrome (`DiffWorkspace.tsx` exposes no control). Pierre/codiff both treat
   layout toggle as a first-class, always-visible affordance. **P1.**

5. **Inline word-level intra-line diff emphasis is unverified / likely
   under-used.** We lean entirely on `@pierre/diffs` defaults and never set
   options for character-level highlighting; the essay stresses intra-line diff
   as a primary readability lever. Audit and explicitly enable. **P2.**

---

## Upstream parity gap table

`upstream` = `ShpetimA/open-warden` `upstream/master`. `ours` = this fork.

| Feature | Upstream | Ours | Severity | File refs |
| --- | --- | --- | --- | --- |
| PR-list keyboard nav (↑/↓, j/k, Enter) | Full, with focus ring + `aria-current` | **Absent** on both Inbox and `/pull-requests` | **High** | `upstream:PullRequestsScreen.tsx:459-479`; ours `InboxScreen.tsx`, `PullRequestsScreen.tsx:51-99` |
| PR-list inline preview pane | Split pane: description, state, reviewers, conversation, "open in browser" inline (`PreviewDetail`, `CommentBody`) | None — list only; preview is a separate route | Medium | `upstream:PullRequestsScreen.tsx:72-294` |
| Inbox sectioning (Needs review / Waiting / Returned / Approved / Drafts / Merged) | — (upstream has no inbox) | **We add this** (good) | Ours ahead | `InboxScreen.tsx:22-29`, `InboxSectionSidebar.tsx:7-14` |
| Build/CI status on PR rows | — | **We add** failed/inprogress/success icons + comment count | Ours ahead | `InboxPRRow.tsx:44-119` |
| Conversation: reply to thread, resolve/unresolve, mentions | Read-mostly | **We add** reply + resolve + mention candidates | Ours ahead | `PullRequestConversationTab.tsx:16-31` |
| LSP diagnostics / symbol-peek navigation in diffs | Present (`lsp/`, `symbolPeekNavigation.ts`, `hunkOperations.ts`) | **Removed** | Medium (deliberate?) | upstream `features/lsp/*`, `source-control/hooks/symbolPeekNavigation.ts` |
| Merge-conflict viewer | `MergeConflictViewer.tsx` (401 lines) | **Removed** | Low (out of PR scope) | upstream `source-control/components/MergeConflictViewer.tsx` |
| Mark-file-viewed / review progress | Absent | Absent | High (both behind codiff) | n/a |
| Approve / request-changes / merge actions | Absent | Absent | Medium | n/a |
| Diff style toggle surfaced in review chrome | Absent (palette only) | Absent (palette only) | Medium | `AppCommandPalette.tsx:408-425` |
| "Open in browser" / copy PR link / copy branch | Inline on list + preview | On preview header only (`PullRequestPreviewHeader`) | Low | `PullRequestPreviewHeader.tsx:158-176` |
| Background prefetch on hover/idle | Hover prefetch | **We add** hover + background idle prefetch | Ours ahead | `PullRequestsScreen.tsx:232-265`, `useBackgroundInboxPrefetch.ts` |

Net: our fork is **ahead** on inbox sectioning, build status, conversation
write-actions, and prefetching; **behind** on list keyboard nav and the inline
preview pane (a regression from upstream), and **dropped** LSP + merge-conflict.

---

## codiff & Pierre takeaways (concrete, adoptable)

### Pierre — "On rendering diffs" (we already use `@pierre/diffs`, so this is a fit check)

Principles and how our `diff-view/` measures up:

- **Progressive syntax highlighting via workers + LRU cache.** Adopted well. We
  gate render on the Shiki worker (`DiffViewer.tsx:184-237`) and pre-warm all
  parsed files so `j/k` navigation is instant (`PullRequestFiles.tsx:283-301`).
  This is exactly the essay's "render plaintext immediately, enhance async"
  pattern — arguably we go further by gating to avoid the flicker the essay
  tolerates.
- **Inverse-sticky virtualization, rough layout estimates, DOM pooling.**
  Delegated to `@pierre/diffs` `Virtualizer` (`DiffViewer.tsx:300-314`,
  `InboxScreen.tsx:184`). We get these for free; nothing to do.
- **String detachment / memory limits.** We add our own size gates:
  `MAX_DIFF_BUFFER_SIZE` (70 MB), a derived "large" threshold, and a per-line
  length scan (`diffRenderLimits.ts:3-65`) with graceful "Diff too large / show
  anyway" states (`DiffViewer.tsx:113-125,272-292`). Solid.
- **Gap vs essay:** the essay calls out *no horizontal virtualization for long
  lines* as an open problem; we cap at `MAX_DIFF_LINE_LENGTH = 5000`
  (`diffRenderLimits.ts:7`) and force "large" mode, which is a reasonable
  mitigation but produces an all-or-nothing wall. Consider a soft-wrap/truncate
  affordance per long line instead of gating the whole file. **P2.**

### codiff — adoptable interaction patterns

- **Per-file "Viewed" toggle that persists and visibly checks off the file in
  the sidebar.** This is the headline gap (see P0). Wire into
  `PullRequestFileList.tsx` rows and persist per `pr-${repoPath}:${number}`.
- **Always-visible split/unified layout toggle + whitespace-visibility toggle**
  in the diff toolbar, not just the palette. We have `ReviewCommentsCopyToolbar`
  above the diff (`PullRequestFiles.tsx:408-415`) — that's the natural home.
- **Command bar parity.** Our `AppCommandPalette` is strong
  (`AppCommandPalette.tsx`), but it carries no PR-review commands (next/prev
  file, toggle viewed, jump to next comment, open in browser). Add them when the
  active feature is a PR.
- **Bulk export of comments as Markdown** — we already have "copy comments to
  agent" (`ReviewCopyBar`, `copyComments`), which is the same idea aimed at LLMs.
  Parity met; consider a "copy as review-ready Markdown" variant.
- **Editor integration / open file in IDE** — codiff opens files in your IDE; we
  have `OpenInExternalEditor` in source-control but it is not surfaced from PR
  diff rows. Low priority.

---

## Design-quality findings by area

### Inbox (`features/inbox/`)

- **No keyboard nav (repeat of P0).** `InboxScreen.tsx:184-196` maps rows into a
  `Virtualizer` with click/hover only. `InboxPRRow` accepts `isSelected`
  (`InboxPRRow.tsx:13,53-55`) but `InboxScreen` never passes it and tracks no
  selected index. **Recommendation:** add a `useSimpleFileListKeyboardNav`-style
  hook (one already exists for files,
  `source-control/hooks/useSimpleFileListKeyboardNav.ts`) for inbox rows with
  `j/k`/arrows to move selection, `Enter` to `navigateToPreview`, `o` to open in
  browser, and scroll-into-view; pass `isSelected` through.
- **Section switching is mouse-only too.** `InboxSectionSidebar.tsx:95-119`
  renders buttons with no `[`/`]` or `g`-prefixed section hotkeys, and the active
  section uses `bg-accent` which is fine but there's no roving tabindex.
- **Filtering recomputed inline every render.** `InboxScreen.tsx:122-140`
  computes `filteredPRs` directly in the body. Per AGENTS.md "no memo escape
  hatch", the better fix is not `useMemo` but pushing the search/filter into a
  Redux selector or a leaf `InboxRowList` component so typing in the search box
  doesn't re-run the predicate over the whole section in the parent render scope.
  **Recommendation:** extract a connected `InboxRowList` that reads only
  `activeSection`, `searchText`, `activeFilter`.
- **"Loading more data…" stale hint** is a bare line with no spinner or skeleton
  for the merged section (`InboxScreen.tsx:174-176`); inconsistent with the
  skeleton treatment used elsewhere (`InboxScreen.tsx:87-95`).
- **Empty state is a centered sentence** (`InboxScreen.tsx:178-182`) while the
  rest of the app uses the richer `Empty`/`EmptyMedia` component
  (`PullRequestFiles.tsx:328-343`). Inconsistent affordance. Use `Empty`.

### Pull-requests list (`features/pull-requests/screens/PullRequestsScreen.tsx`)

- **Gutted relative to upstream + ships a debug button.** Lines `470-477` render
  a `Debug Inbox` outline button in production header chrome. The row
  (`PullRequestRow`, `51-99`) lost selection/keyboard affordances. Two diverging
  PR-list surfaces is a maintenance and UX-consistency liability.
  **Recommendation:** decide the canonical list (Inbox), then either delete
  `/pull-requests` or make it the keyboard-first list and remove the debug
  button.
- **Draft badge styling diverges** between the two lists: `PullRequestsScreen`
  uses a hollow bordered pill (`:80-84`) while `InboxPRRow` uses filled colored
  pills with state variants (`InboxPRRow.tsx:73-89`). Pick one badge system.
- **Pagination** uses Previous/Next with a page counter (`:290-331`) — fine, but
  the empty-on-page-N path renders three pulse skeletons *plus* pagination
  (`:410-424`), which reads as "loading" when it actually means "empty page";
  confusing. **Recommendation:** show an explicit "No results on this page" with
  a "back to page 1" action.

### PR diff review (`features/pull-requests/screens/PullRequestFiles.tsx`, `diff-view/`)

- **No layout/whitespace controls in the review toolbar.** `ReviewCopyBar`
  (`PullRequestFiles.tsx:408-415`) only carries copy actions. Add split/unified
  and whitespace toggles here (codiff parity, P1).
- **Loading state is a centered spinner with no file context**
  (`PullRequestFiles.tsx:362-369`) — when switching files via `j/k` the whole
  pane blanks to a spinner. Given we pre-warm highlighting
  (`:283-301`), most switches should be instant; verify the spinner only appears
  on cold load and consider keeping the previous diff visible with a thin
  top-progress bar (the header already uses this pattern,
  `PullRequestPreviewHeader.tsx:80-84`). **P1 perceived-perf.**
- **Good:** the empty/error/unavailable matrix is thorough and uses the shared
  `Empty` component consistently (`:328-403`). This is the model the inbox should
  follow.
- **`findParsedFileDiff` + flatten on every parse** (`:47-49,303`) — fine, but
  the parse effect keys on `files` identity (`:281`); confirm `EMPTY_FILES`
  stable default is used (it is, `:33,98`) so this doesn't thrash.

### Comment composer (`diff-view/components/CommentComposer.tsx`)

- **Keyboard ergonomics are good:** `Mod+Enter` submits, `Esc` cancels, autofocus
  with caret-to-end (`:56-82`). 
- **Submit disabled only on empty trim** (`:102`) but there is no pending/saving
  state on the button — a slow network leaves the user unsure whether the comment
  posted. **Recommendation:** disable + spinner during the async `addComment`
  dispatch. **P2.**
- **`rounded-none` buttons** (`:99,106`) are intentional brutalist styling but
  inconsistent with the `rounded-md`/`rounded-lg` used in row and empty
  components elsewhere — confirm this is a deliberate design token, not drift.

### Command palette (`features/command-palette/AppCommandPalette.tsx`)

- **No PR-context commands.** The `feature` switch handles `changes`/`history`/
  `review` (`:247-524`) but there is no branch for the PR/inbox features, so when
  reviewing a PR the palette offers no "next file", "toggle viewed", "open in
  browser", "jump to next thread". **Recommendation:** add a `pull-requests`/
  `inbox` arm. **P1.**
- **Footer only documents `ESC`** (`:626-629`); `↑/↓`/`Enter` affordances are
  undocumented. Minor.

### Cross-cutting

- **Badge/pill, empty-state, and spinner treatments are inconsistent** across
  inbox vs pull-requests vs diff panes (cited above). A small shared
  `StatusBadge` + mandatory `Empty` usage would remove most of the drift.
- **Relative vs absolute timestamps differ by surface**: inbox uses "3h ago"
  (`InboxPRRow.tsx:19-42`) while the list/preview use absolute
  (`PullRequestsScreen.tsx:25-37`, `PullRequestPreviewHeader.tsx`). Pick one,
  with a `title` tooltip for the other.

---

## Prioritized backlog

Effort: S ≈ <0.5d, M ≈ 0.5–1.5d, L ≈ 2–4d. Each item is independently
dispatchable.

### P0

- **[M] Inbox keyboard navigation.** Add `j/k`/`↑↓` row selection + `Enter` to
  open + `o` open-in-browser to `InboxScreen`/`InboxPRRow`; wire `isSelected`;
  scroll-selected-into-view inside the `Virtualizer`. Reuse the pattern in
  `source-control/hooks/useSimpleFileListKeyboardNav.ts`. *Rationale:* primary
  surface is mouse-only and regressed vs upstream; highest daily-use leverage.
  Files: `inbox/screens/InboxScreen.tsx`, `inbox/components/InboxPRRow.tsx`, new
  `inbox/hooks/useInboxKeyboardNav.ts`.

- **[M] Per-file "Viewed" toggle + sidebar check-off + persistence.** Add a
  viewed flag keyed by `pr-${repoPath}:${pullRequestNumber}:${path}`, a checkbox/
  check icon in `PullRequestFileList` rows, auto-collapse-or-dim viewed files, and
  a "N/M viewed" counter. *Rationale:* the defining multi-file review primitive;
  codiff has it, we have nothing. Files: `pull-requests/screens/PullRequestFileList.tsx`,
  `FileList`, a new slice or settings-backed store.

### P1

- **[S] Remove the "Debug Inbox" button and decide the canonical PR list.**
  Either delete `/pull-requests` or restore keyboard-first list semantics; stop
  shipping a debug control in header chrome. *Rationale:* two diverging surfaces
  + visible debug affordance. File: `pull-requests/screens/PullRequestsScreen.tsx:470-477`.

- **[M] Surface split/unified + whitespace toggles in the review toolbar.** Add
  controls to `ReviewCommentsCopyToolbar`/`DiffHeaderMetadataControls` driven by
  the existing `selectDiffStyle`/`setDiffStyleValue`. *Rationale:* core diff-view
  affordance currently buried in the palette; codiff/Pierre parity. Files:
  `pull-requests/components/ReviewCopyBar.tsx`, `diff-view/components/DiffHeaderMetadataControls.tsx`.

- **[M] PR/inbox arm in the command palette.** Add next/prev file, toggle viewed,
  jump-to-next-thread, open-in-browser, copy PR link when feature is
  `pull-requests`/`inbox`. File: `command-palette/AppCommandPalette.tsx:247+`,
  `buildCommandItems.ts`.

- **[S] Preserve previous diff during `j/k` file switches.** Avoid blanking to a
  centered spinner on warm-cache switches; show a thin top-progress bar instead,
  matching `PullRequestPreviewHeader.tsx:80-84`. File:
  `pull-requests/screens/PullRequestFiles.tsx:362-369`, `diff-view/components/DiffViewer.tsx:319-323`.

- **[S] Inbox empty/loading consistency.** Replace the centered-sentence empty
  state with the shared `Empty` component and add a skeleton/spinner to the
  "Loading more data…" stale hint. File: `inbox/screens/InboxScreen.tsx:174-182`.

- **[S] Extract a connected `InboxRowList` to scope filter/search renders.** Move
  `filteredPRs` computation out of `InboxScreen`'s render into a leaf that reads
  only the needed slices (no `useMemo` escape hatch). File:
  `inbox/screens/InboxScreen.tsx:122-196`.

### P2

- **[S] Comment composer pending state.** Disable + spinner the submit button
  during the async dispatch. File: `diff-view/components/CommentComposer.tsx:44-54,96-108`.
- **[S] Unify badge / timestamp / pill systems** across inbox vs list vs preview.
  Files: `InboxPRRow.tsx:73-89`, `PullRequestsScreen.tsx:80-84`, time formatters.
- **[M] Soft-wrap/truncate long lines instead of gating the whole file** to
  "large" at `MAX_DIFF_LINE_LENGTH`. File: `diff-view/services/diffRenderLimits.ts:7,56-63`.
- **[S] Verify/enable intra-line (word-level) diff emphasis** in
  `@pierre/diffs` options. File: `diff-view/components/DiffViewer.tsx:249-262`.
- **[?] Decide whether to re-adopt upstream LSP diagnostics / symbol-peek** in
  PR diffs (deliberately dropped; flag for product call). upstream `features/lsp/*`.

---

## Notes / caveats

- The task brief referenced a `CLAUDE.md` and a `review/` feature dir; neither
  exists — conventions live in `AGENTS.md`, and "review" lives inside
  `pull-requests/` (`PullRequestReview*Screen.tsx`) and `source-control/` (the
  local branch-compare `ReviewScreen`).
- Upstream's default branch is `master`, not `main`.
- Our diff-rendering layer is the strongest part of the app and already follows
  the Pierre essay closely; most leverage is in list-surface ergonomics and
  review-progress tracking, not in the renderer.
</content>
</invoke>
