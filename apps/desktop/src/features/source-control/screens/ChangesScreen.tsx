import { skipToken } from "@reduxjs/toolkit/query";

import { useAppSelector } from "@/app/hooks";
import { ResizableSidebarLayout } from "@/components/layout/ResizableSidebarLayout";
import { DiffWorkspace } from "@/features/diff-view/DiffWorkspace";
import { useGetFileVersionsQuery } from "@/features/source-control/api";
import { ChangesSidebar } from "@/features/source-control/components/ChangesSidebar";
import { useChangesKeyboardNav } from "@/features/source-control/hooks/useChangesKeyboardNav";
import { useChangesSync } from "@/features/source-control/hooks/useChangesSync";
import { useThrottledDiffSelection } from "@/features/source-control/hooks/useThrottledDiffSelection";
import { errorMessageFrom } from "@/features/source-control/shared-utils/errorMessage";
import {
  selectActiveBucket,
  selectActivePath,
  selectActiveRepo,
  selectDiffFocusTarget,
} from "@/features/source-control/sourceControlSlice";

export function ChangesScreen() {
  useChangesKeyboardNav("changes");
  useChangesSync();

  return (
    <ResizableSidebarLayout
      panelId="primary"
      sidebarDefaultSize={22}
      sidebarMinSize={14}
      sidebarMaxSize={34}
      sidebar={<ChangesSidebar />}
      content={<ChangesDiffPane />}
    />
  );
}

function ChangesDiffPane() {
  const activeRepo = useAppSelector(selectActiveRepo);
  const activeBucket = useAppSelector(selectActiveBucket);
  const activePath = useAppSelector(selectActivePath);
  const diffFocusTarget = useAppSelector(selectDiffFocusTarget);

  const previewSelection = useThrottledDiffSelection(
    activePath
      ? {
          bucket: activeBucket,
          path: activePath,
        }
      : null,
  );

  const workingFileVersions = useGetFileVersionsQuery(
    activeRepo && previewSelection
      ? { repoPath: activeRepo, bucket: previewSelection.bucket, relPath: previewSelection.path }
      : skipToken,
    {
      refetchOnFocus: true,
      refetchOnReconnect: true,
    },
  );
  const fileVersions = workingFileVersions.currentData ?? workingFileVersions.data;
  const loadingPatch = !fileVersions && workingFileVersions.isFetching;
  const oldFile = fileVersions?.oldFile ?? null;
  const newFile = fileVersions?.newFile ?? null;
  const errorMessage = fileVersions ? "" : errorMessageFrom(workingFileVersions.error, "");
  const previewPath = previewSelection?.path ?? "";
  const isFocusedPreviewPath =
    diffFocusTarget?.kind === "changes" && diffFocusTarget.path === previewPath;
  const focusedLineNumber = isFocusedPreviewPath ? diffFocusTarget.lineNumber : null;
  const focusedLineIndex = isFocusedPreviewPath ? diffFocusTarget.lineIndex : null;
  const focusedLineKey = isFocusedPreviewPath ? diffFocusTarget.focusKey : null;

  return (
    <div className="grid h-full min-h-0 min-w-0">
      <section className="flex h-full min-h-0 min-w-0 flex-col">
        <div className="min-h-0 min-w-0 flex-1">
          {errorMessage ? (
            <div className="text-destructive p-3 text-sm">{errorMessage}</div>
          ) : loadingPatch ? (
            <div className="text-muted-foreground p-3 text-sm">Loading diff...</div>
          ) : !activePath ? (
            <div className="text-muted-foreground p-3 text-sm">Select a file to view diff.</div>
          ) : !oldFile && !newFile ? (
            <div className="text-muted-foreground p-3 text-sm">No diff content.</div>
          ) : (
            <div className="flex h-full min-h-0 min-w-0 flex-col">
              <DiffWorkspace
                oldFile={oldFile}
                newFile={newFile}
                activePath={previewPath}
                commentContext={{ kind: "changes" }}
                canComment
                fileViewerRevision={null}
                focusedLineNumber={focusedLineNumber}
                focusedLineIndex={focusedLineIndex}
                focusedLineKey={focusedLineKey}
              />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
