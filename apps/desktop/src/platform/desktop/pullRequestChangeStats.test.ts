import { describe, expect, it } from "vite-plus/test";

import type { PullRequestChangedFile, PullRequestChangeStats } from "./contracts";
import { resolvePullRequestChangeStats, summarizePullRequestFiles } from "./pullRequestChangeStats";

function createFile(overrides: Partial<PullRequestChangedFile> = {}): PullRequestChangedFile {
  return {
    path: overrides.path ?? "src/example.ts",
    previousPath: overrides.previousPath ?? null,
    status: overrides.status ?? "modified",
    additions: overrides.additions ?? 0,
    deletions: overrides.deletions ?? 0,
  };
}

describe("pullRequestChangeStats", () => {
  it("uses cached change stats while files are still loading", () => {
    const cachedChangeStats: PullRequestChangeStats = {
      fileCount: 12,
      additions: 48,
      deletions: 9,
    };

    expect(
      resolvePullRequestChangeStats({
        files: [],
        hasLoadedFiles: false,
        cachedChangeStats,
      }),
    ).toEqual(cachedChangeStats);
  });

  it("prefers loaded files over cached change stats once the files query resolves", () => {
    const files = [
      createFile({ path: "src/one.ts", additions: 5, deletions: 1 }),
      createFile({ path: "src/two.ts", additions: 3, deletions: 4 }),
    ];

    expect(
      resolvePullRequestChangeStats({
        files,
        hasLoadedFiles: true,
        cachedChangeStats: {
          fileCount: 99,
          additions: 999,
          deletions: 999,
        },
      }),
    ).toEqual(summarizePullRequestFiles(files));
  });
});
