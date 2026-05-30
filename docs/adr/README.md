# Architecture Decision Records

Short, append-only records of decisions that shape OpenWarden. Lightweight
[MADR](https://adr.github.io/madr/) style: **Context → Decision → Consequences →
Status**. One file per decision, numbered, never rewritten (supersede instead).

> Note: GitHub Spec Kit (`specify`) is **not** installed in this repo. These ADRs
> and the audit under `docs/audits/` are the current source of truth for design
> decisions and backlog. If we want the full Spec Kit workflow
> (`/specify`, `/plan`, `/tasks`), run `specify init` and migrate these in.

## Index

- [0001 — Agentic dev orchestrator](0001-agentic-dev-orchestrator.md)
- [0002 — Bitbucket comment likes are not in the public API](0002-bitbucket-comment-likes-unsupported.md)
- [0003 — Configurable land command for merge-queue repos](0003-configurable-land-command.md)

## Related

- `docs/audits/pr-ux-and-parity-audit.md` — PR UX + upstream parity audit and prioritized backlog.
- `CLAUDE.md` / `AGENTS.md` — agent workflow and engineering conventions.
