import type { AppSettings, FileTreeRenderMode, MergeSettings } from "./contracts";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

const DEFAULT_SECTION_KEYS = [
  "NEEDS_REVIEW",
  "WAITING_FOR_REVIEW",
  "RETURNED_TO_YOU",
  "APPROVED",
  "DRAFTS",
  "MERGING_AND_MERGED",
] as const;

export function getDefaultInboxSectionVisibility(): Record<string, boolean> {
  const visibility: Record<string, boolean> = {};
  for (const key of DEFAULT_SECTION_KEYS) {
    visibility[key] = true;
  }
  return visibility;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  version: 1,
  sourceControl: {
    fileTreeRenderMode: "tree",
  },
  inboxSectionVisibility: getDefaultInboxSectionVisibility(),
};

function resolveFileTreeRenderMode(value: unknown): FileTreeRenderMode {
  return value === "list" ? "list" : "tree";
}

function resolveInboxSectionVisibility(value: unknown): Record<string, boolean> {
  const defaults = getDefaultInboxSectionVisibility();
  if (!isObject(value)) {
    return defaults;
  }

  const result: Record<string, boolean> = { ...defaults };
  for (const [key, val] of Object.entries(value)) {
    if (key in defaults && typeof val === "boolean") {
      result[key] = val;
    }
  }
  return result;
}

function resolveMergeSettings(value: unknown): MergeSettings | undefined {
  if (!isObject(value)) {
    return undefined;
  }

  const merge: MergeSettings = {};

  if (typeof value.landCommand === "string" && value.landCommand.trim()) {
    merge.landCommand = value.landCommand;
  }

  if (isObject(value.repos)) {
    const repos: NonNullable<MergeSettings["repos"]> = {};
    for (const [key, entry] of Object.entries(value.repos)) {
      if (isObject(entry) && typeof entry.command === "string" && entry.command.trim()) {
        repos[key.toLowerCase()] = { command: entry.command };
      }
    }
    if (Object.keys(repos).length > 0) {
      merge.repos = repos;
    }
  }

  return merge.landCommand || merge.repos ? merge : undefined;
}

export function createAppSettings(settings?: unknown): AppSettings {
  if (!isObject(settings)) {
    return DEFAULT_APP_SETTINGS;
  }

  const sourceControl = isObject(settings.sourceControl) ? settings.sourceControl : {};

  const result: AppSettings = {
    version: 1,
    sourceControl: {
      fileTreeRenderMode: resolveFileTreeRenderMode(sourceControl.fileTreeRenderMode),
    },
    inboxSectionVisibility: resolveInboxSectionVisibility(settings.inboxSectionVisibility),
  };

  const merge = resolveMergeSettings(settings.merge);
  if (merge) {
    result.merge = merge;
  }

  return result;
}
