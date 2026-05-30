import { describe, expect, it } from "vite-plus/test";

// @ts-expect-error -- oxlint typescript
import { createAppSettings, DEFAULT_APP_SETTINGS } from "@/platform/desktop/appSettings";

describe("appSettings helpers", () => {
  it("returns defaults for missing or invalid settings", () => {
    expect(createAppSettings()).toEqual(DEFAULT_APP_SETTINGS);
    expect(createAppSettings(null)).toEqual(DEFAULT_APP_SETTINGS);
    expect(createAppSettings({})).toEqual(DEFAULT_APP_SETTINGS);
  });

  it("normalizes known settings fields", () => {
    expect(
      createAppSettings({
        version: 99,
        sourceControl: {
          fileTreeRenderMode: "list",
        },
      }),
    ).toEqual({
      version: 1,
      sourceControl: {
        fileTreeRenderMode: "list",
      },
      inboxSectionVisibility: {
        NEEDS_REVIEW: true,
        WAITING_FOR_REVIEW: true,
        RETURNED_TO_YOU: true,
        APPROVED: true,
        DRAFTS: true,
        MERGING_AND_MERGED: true,
      },
    });
  });

  it("resolves inboxSectionVisibility with partial overrides", () => {
    const result = createAppSettings({
      inboxSectionVisibility: {
        APPROVED: false,
        DRAFTS: false,
      },
    });
    expect(result.inboxSectionVisibility).toEqual({
      NEEDS_REVIEW: true,
      WAITING_FOR_REVIEW: true,
      RETURNED_TO_YOU: true,
      APPROVED: false,
      DRAFTS: false,
      MERGING_AND_MERGED: true,
    });
  });

  it("ignores unknown section keys in inboxSectionVisibility", () => {
    const result = createAppSettings({
      inboxSectionVisibility: {
        UNKNOWN_SECTION: false,
        NEEDS_REVIEW: false,
      },
    });
    expect(result.inboxSectionVisibility).toEqual({
      NEEDS_REVIEW: false,
      WAITING_FOR_REVIEW: true,
      RETURNED_TO_YOU: true,
      APPROVED: true,
      DRAFTS: true,
      MERGING_AND_MERGED: true,
    });
    expect(result.inboxSectionVisibility).not.toHaveProperty("UNKNOWN_SECTION");
  });

  it("omits merge settings when none are valid", () => {
    expect(createAppSettings({ merge: {} })).not.toHaveProperty("merge");
    expect(createAppSettings({ merge: { landCommand: "   " } })).not.toHaveProperty("merge");
  });

  it("normalizes a global land command and lowercases per-repo keys", () => {
    const result = createAppSettings({
      merge: {
        landCommand: "ag land {number}",
        repos: {
          "Acme/Web": { command: "ag land --queue {number}" },
          "bad/repo": { command: "  " },
          "no-command": {},
        },
      },
    });
    expect(result.merge).toEqual({
      landCommand: "ag land {number}",
      repos: { "acme/web": { command: "ag land --queue {number}" } },
    });
  });
});
