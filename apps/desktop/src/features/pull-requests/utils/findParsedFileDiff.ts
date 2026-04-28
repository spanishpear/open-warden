import type { FileDiffMetadata } from "@pierre/diffs";

interface FileMatcher {
  path: string;
  previousPath?: string | null;
}

export function matchesParsedFileDiff(fileDiff: FileDiffMetadata, file: FileMatcher): boolean {
  if (fileDiff.name === file.path) {
    return (fileDiff.prevName ?? null) === (file.previousPath ?? null);
  }

  if (file.previousPath && fileDiff.prevName === file.previousPath) {
    return fileDiff.name === file.path || fileDiff.name === file.previousPath;
  }

  return false;
}

export function findParsedFileDiff(
  parsedFiles: FileDiffMetadata[],
  file: FileMatcher | null,
): FileDiffMetadata | null {
  if (!file) {
    return null;
  }

  return (
    parsedFiles.find((fileDiff) => matchesParsedFileDiff(fileDiff, file)) ??
    parsedFiles.find((fileDiff) => fileDiff.name === file.path) ??
    (file.previousPath
      ? (parsedFiles.find((fileDiff) => fileDiff.prevName === file.previousPath) ?? null)
      : null)
  );
}
