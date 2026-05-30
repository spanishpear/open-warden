# 0003 — Configurable land command for merge-queue repos

**Status:** Accepted (2026-05-30)

## Context

Some repos can only land changes through a merge queue triggered by a local CLI
(e.g. `ag land`); a direct Bitbucket merge-API call is rejected. We need to trigger
that CLI from the app, configurable per repo, without weakening the default
Bitbucket merge path.

## Decision

Add a `merge` block to the global `settings.json` (`AppSettings`):

```jsonc
{
  "merge": {
    "landCommand": "ag land {number}", // global default
    "repos": {
      "workspace/repo": { "command": "ag land --queue {number}" }, // per-repo override
    },
  },
}
```

Resolution order: **per-repo override → global default → Bitbucket merge API**
(the existing control is the fallback). Supported placeholders: `{number}`,
`{workspace}`, `{repo}`, `{sourceBranch}`, `{targetBranch}`, `{url}`.

Execution (`electron/landCommand.ts`): the template is **whitespace-tokenized,
then placeholders are substituted per token**, and the command runs with
`shell:false` — so placeholder values (e.g. branch names) are always a single
argv element and never reach a shell (no injection). Runs in the project's local
checkout when known, with a timeout. The pure resolution/substitution logic lives
in `src/platform/desktop/landCommand.ts` and is unit-tested; the executor is
tested against real commands per the repo convention.

When a land command resolves for the repo, `PullRequestMergeControl` shows a
"Land" action (displaying the exact command) instead of the merge control.

## Consequences

- Merge-queue repos are first-class without special-casing providers; the land
  command runs locally regardless of provider.
- Quoting inside a template is intentionally not interpreted (no shell). Templates
  needing complex quoting should wrap logic in a script the command invokes.
- Live end-to-end verification requires a connected workspace + a real land CLI;
  the logic is otherwise fully unit-tested.
