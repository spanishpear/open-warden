import { describe, expect, it } from "vite-plus/test";

import {
  openFileViewer,
  sourceControlReducer,
  // @ts-expect-error -- oxlint typescript
} from "@/features/source-control/sourceControlSlice";

describe("sourceControlSlice file viewer state", () => {
  it("keeps pull-request sidebar mode for PR-origin file viewer jumps", () => {
    const nextState = sourceControlReducer(
      undefined,
      openFileViewer({
        repoPath: "/repo",
        relPath: "src/ref.ts",
        line: 12,
        column: 0,
        focusKey: 3,
        returnToDiff: {
          kind: "pull-request",
          repoPath: "/repo",
          path: "src/origin.ts",
          lineNumber: 22,
          lineIndex: "21,0",
        },
      }),
    );

    expect(nextState.changesSidebarMode).toBe("pull-request");
    expect(nextState.fileViewerTarget?.returnToDiff).toEqual({
      kind: "pull-request",
      repoPath: "/repo",
      path: "src/origin.ts",
      lineNumber: 22,
      lineIndex: "21,0",
    });
  });
});
