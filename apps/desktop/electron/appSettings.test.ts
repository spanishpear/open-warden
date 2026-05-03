import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { rmSync } from "node:fs";

import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";

let userDataPath = "";

vi.mock("electron", () => ({
  app: {
    getPath: vi.fn(() => userDataPath),
  },
}));

describe("electron app settings persistence", () => {
  beforeEach(async () => {
    userDataPath = await mkdtemp(path.join(os.tmpdir(), "open-warden-app-settings-"));
    vi.resetModules();
  });

  afterEach(() => {
    if (userDataPath) {
      rmSync(userDataPath, { recursive: true, force: true });
    }
  });

  test("saves and loads normalized app settings", async () => {
    const { loadAppSettings, saveAppSettings } = await import("./appSettings");

    await saveAppSettings({
      version: 1,
      sourceControl: {
        fileTreeRenderMode: "list",
      },
    });

    const rawFile = await readFile(path.join(userDataPath, "settings.json"), "utf8");
    expect(JSON.parse(rawFile)).toEqual({
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

    await expect(loadAppSettings()).resolves.toEqual({
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

  test("falls back to defaults when the file is invalid", async () => {
    const settingsPath = path.join(userDataPath, "settings.json");
    await writeFile(settingsPath, "{not json", "utf8");

    const { loadAppSettings } = await import("./appSettings");

    await expect(loadAppSettings()).resolves.toEqual({
      version: 1,
      sourceControl: {
        fileTreeRenderMode: "tree",
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
});
