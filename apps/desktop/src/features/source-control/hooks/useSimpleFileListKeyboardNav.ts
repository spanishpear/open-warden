import { startTransition } from "react";
import { useStore } from "react-redux";

import type { RootState } from "@/app/store";
import { movePierreFileTreeFocusToFile } from "@/features/source-control/pierreFileTreeNavigation";
import { isTypingTarget } from "@/features/source-control/utils";
import { useVerticalNavigationHotkeys } from "./keyboardNavigation";

type UseSimpleFileListKeyboardNavOptions = {
  regionId: string;
  getAllFilePaths: (state: RootState) => string[];
  getActivePath: (state: RootState) => string;
  onSelectPath: (path: string) => void;
  enabled?: (state: RootState) => boolean;
};

export function useSimpleFileListKeyboardNav({
  regionId,
  onSelectPath,
  enabled,
}: UseSimpleFileListKeyboardNavOptions) {
  const store = useStore<RootState>();

  useVerticalNavigationHotkeys({
    onNext: (event) => navigate(event, true),
    onPrevious: (event) => navigate(event, false),
  });

  function navigate(event: KeyboardEvent, nextKey: boolean) {
    if (isTypingTarget(event.target)) {
      return;
    }

    const state = store.getState();
    if (enabled && !enabled(state)) {
      return;
    }

    event.preventDefault();

    const targetFile = movePierreFileTreeFocusToFile(regionId, nextKey);
    if (!targetFile) {
      return;
    }

    startTransition(() => {
      onSelectPath(targetFile.realPath ?? targetFile.path);
    });
  }
}
