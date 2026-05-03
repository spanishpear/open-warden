import type { AppSettings, FileTreeRenderMode } from "./contracts";

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

export function createAppSettings(settings?: unknown): AppSettings {
  if (!isObject(settings)) {
    return DEFAULT_APP_SETTINGS;
  }

  const sourceControl = isObject(settings.sourceControl) ? settings.sourceControl : {};

  return {
    version: 1,
    sourceControl: {
      fileTreeRenderMode: resolveFileTreeRenderMode(sourceControl.fileTreeRenderMode),
    },
    inboxSectionVisibility: resolveInboxSectionVisibility(settings.inboxSectionVisibility),
  };
}
