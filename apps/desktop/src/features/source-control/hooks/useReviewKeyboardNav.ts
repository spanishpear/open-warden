import { useAppDispatch } from "@/app/hooks";
import { gitApi } from "@/features/source-control/api";
import {
  selectActiveRepo,
  selectReviewActivePath,
  selectReviewBaseRef,
  selectReviewHeadRef,
  setReviewActivePath,
} from "@/features/source-control/sourceControlSlice";
import type { FileItem } from "@/features/source-control/types";
import { useSimpleFileListKeyboardNav } from "./useSimpleFileListKeyboardNav";

export function useReviewKeyboardNav(regionId = "review-files") {
  const dispatch = useAppDispatch();

  useSimpleFileListKeyboardNav({
    regionId,
    getAllFilePaths: (state) => {
      const activeRepo = selectActiveRepo(state);
      const reviewBaseRef = selectReviewBaseRef(state);
      const reviewHeadRef = selectReviewHeadRef(state);
      const branchFilesArgs =
        activeRepo && reviewBaseRef && reviewHeadRef
          ? {
              repoPath: activeRepo,
              baseRef: reviewBaseRef,
              headRef: reviewHeadRef,
            }
          : null;
      const reviewFiles = branchFilesArgs
        ? gitApi.endpoints.getBranchFiles.select(branchFilesArgs)(state).data
        : undefined;

      // oxlint-disable-next-line typescript-eslint(no-unnecessary-type-assertion)
      return ((reviewFiles ?? []) as FileItem[]).map((file) => file.path);
    },
    getActivePath: selectReviewActivePath,
    onSelectPath: (path) => {
      dispatch(setReviewActivePath(path));
    },
  });
}
