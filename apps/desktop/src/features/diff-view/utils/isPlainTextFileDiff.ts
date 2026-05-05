import { getFiletypeFromFileName, type FileDiffMetadata } from "@pierre/diffs";

export function isPlainTextFileDiff(diff: FileDiffMetadata): boolean {
  const computedLang = diff.lang ?? getFiletypeFromFileName(diff.name);
  const computedPreviousLang =
    diff.lang ?? (diff.prevName ? getFiletypeFromFileName(diff.prevName) : "text");

  return computedLang === "text" && computedPreviousLang === "text";
}
