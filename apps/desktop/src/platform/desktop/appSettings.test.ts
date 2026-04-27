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
      lsp: {
        servers: {},
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
});
