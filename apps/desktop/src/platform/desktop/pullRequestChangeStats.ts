import type { PullRequestChangedFile } from "./contracts";
import type { PullRequestChangeStats } from "./contracts";

export function summarizePullRequestFiles(
  files: readonly PullRequestChangedFile[],
): PullRequestChangeStats {
  let additions = 0;
  let deletions = 0;

  for (const file of files) {
    additions += file.additions;
    deletions += file.deletions;
  }

  return {
    fileCount: files.length,
    additions,
    deletions,
  };
}

export function resolvePullRequestChangeStats({
  files,
  hasLoadedFiles,
  cachedChangeStats,
}: {
  files: readonly PullRequestChangedFile[];
  hasLoadedFiles: boolean;
  cachedChangeStats?: PullRequestChangeStats | null;
}): PullRequestChangeStats | null {
  if (hasLoadedFiles) {
    return summarizePullRequestFiles(files);
  }

  return cachedChangeStats ?? null;
}
