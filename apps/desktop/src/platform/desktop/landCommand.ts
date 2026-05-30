import type { AppSettings, LandCommandContext } from "./contracts";

/** Stable per-repo settings key, e.g. "workspace/repo" (case-insensitive). */
export function landCommandRepoKey(workspace: string, repo: string): string {
  return `${workspace.trim()}/${repo.trim()}`.toLowerCase();
}

/**
 * Resolve the effective land command template for a repo.
 * Per-repo override wins over the global default; `null` when neither is set.
 */
export function resolveLandCommandTemplate(settings: AppSettings, repoKey: string): string | null {
  const merge = settings.merge;
  if (!merge) {
    return null;
  }

  const repoOverride = merge.repos?.[repoKey]?.command?.trim();
  if (repoOverride) {
    return repoOverride;
  }

  const global = merge.landCommand?.trim();
  return global ? global : null;
}

const PLACEHOLDER = /\{(number|workspace|repo|sourceBranch|targetBranch|url)\}/g;

export function substituteLandPlaceholders(token: string, context: LandCommandContext): string {
  return token.replace(PLACEHOLDER, (match, key: string) => {
    switch (key) {
      case "number":
        return String(context.number);
      case "workspace":
        return context.workspace;
      case "repo":
        return context.repo;
      case "sourceBranch":
        return context.sourceBranch;
      case "targetBranch":
        return context.targetBranch;
      case "url":
        return context.url;
      default:
        return match;
    }
  });
}

/**
 * Tokenize on whitespace, then substitute placeholders per token. This keeps a
 * placeholder value (e.g. a branch name) as a single argv element and means the
 * command is run with shell:false — no shell, no injection. Quoting inside the
 * template is intentionally not interpreted.
 */
export function buildLandCommandArgv(template: string, context: LandCommandContext): string[] {
  return template
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => substituteLandPlaceholders(token, context));
}
