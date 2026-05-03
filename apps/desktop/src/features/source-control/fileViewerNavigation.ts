let nextFileViewerFocusKey = 1;

export function createFileViewerFocusKey() {
  const focusKey = nextFileViewerFocusKey;
  nextFileViewerFocusKey += 1;
  return focusKey;
}
