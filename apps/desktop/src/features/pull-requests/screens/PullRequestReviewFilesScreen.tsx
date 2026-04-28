import { skipToken } from "@reduxjs/toolkit/query";
import { useEffect, useState } from "react";

import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { ResizableSidebarLayout } from "@/components/layout/ResizableSidebarLayout";
import { DiffWorkspace } from "@/features/diff-view/DiffWorkspace";
import {
  getParsedPatchRequest,
  loadParsedPatch,
  type ParsedPatch,
} from "@/features/diff-view/services/parsedDiffCache";
import type { FileDiffMetadata } from "@pierre/diffs";
import {
  useGetPullRequestConversationQuery,
  useGetPullRequestDiffCachedQuery,
} from "@/features/hosted-repos/api";
import ReviewCommentsCopyToolbar from "@/features/pull-requests/components/ReviewCopyBar";
import { PullRequestFilesSidebar } from "@/features/pull-requests/components/PullRequestFilesSidebar";
import { usePullRequestMentionCandidates } from "@/features/pull-requests/hooks/usePullRequestMentionCandidates";
import { usePullRequestReviewAnchors } from "@/features/pull-requests/hooks/usePullRequestReviewAnchors";
import {
  clearPullRequestFileJumpTarget,
  setPullRequestFilesViewMode,
} from "@/features/pull-requests/pullRequestsSlice";
import { buildPullRequestAnchorAnnotations } from "@/features/pull-requests/utils/reviewAnchors";
import { useGetBranchFilesQuery } from "@/features/source-control/api";
import { GeneralFileViewer } from "@/features/source-control/components/GeneralFileViewer";
import { useThrottledDiffSelection } from "@/features/source-control/hooks/useThrottledDiffSelection";
import { errorMessageFrom } from "@/features/source-control/shared-utils/errorMessage";
import {
  selectFileViewerTarget,
  selectReviewActivePath,
} from "@/features/source-control/sourceControlSlice";
import type { FileItem } from "@/features/source-control/types";
import type { GitProviderId, PullRequestConversation } from "@/platform/desktop";

import {
  InactivePullRequestReviewPlaceholder,
  usePullRequestReviewSession,
} from "./PullRequestReviewShared";

const EMPTY_BRANCH_FILES: FileItem[] = [];

type PullRequestDiffPaneProps = {
  activeRepo: string;
  reviewRepoPath: string;
  reviewProviderId?: GitProviderId;
  pullRequestNumber: number;
  reviewBaseRef: string;
  reviewHeadRef: string;
  readyForDiff: boolean;
  branchFiles: FileItem[];
  conversation: PullRequestConversation | null;
  focusedLineNumber: number | null;
  focusedLineIndex: string | null;
  focusedLineKey: number | null;
};

function PullRequestDiffPane({
  activeRepo,
  reviewRepoPath,
  reviewProviderId,
  pullRequestNumber,
  reviewBaseRef,
  reviewHeadRef,
  readyForDiff,
  branchFiles,
  conversation,
  focusedLineNumber,
  focusedLineIndex,
  focusedLineKey,
}: PullRequestDiffPaneProps) {
  const reviewActivePath = useAppSelector(selectReviewActivePath);
  const selectedReviewFile = branchFiles.find((file) => file.path === reviewActivePath);
  const previewSelection = useThrottledDiffSelection(
    reviewActivePath
      ? {
          path: reviewActivePath,
          previousPath: selectedReviewFile?.previousPath ?? undefined,
        }
      : null,
  );
  const previewPath = previewSelection?.path ?? reviewActivePath;
  const commentMentions = usePullRequestMentionCandidates(conversation);
  const { anchorsByFile } = usePullRequestReviewAnchors({
    repoPath: reviewRepoPath,
    compareBaseRef: reviewBaseRef,
    compareHeadRef: reviewHeadRef,
    files: branchFiles,
    reviewThreads: conversation?.reviewThreads ?? [],
  });
  const annotationItems = previewPath
    ? buildPullRequestAnchorAnnotations({
        anchors: anchorsByFile[previewPath] ?? [],
        repoPath: reviewRepoPath,
        pullRequestNumber,
        compareBaseRef: reviewBaseRef,
        compareHeadRef: reviewHeadRef,
        providerId: reviewProviderId,
      })
    : [];

  const pullRequestDiffQuery = useGetPullRequestDiffCachedQuery(
    readyForDiff ? { repoPath: activeRepo, pullRequestNumber } : skipToken,
  );

  const patchText = pullRequestDiffQuery.currentData ?? pullRequestDiffQuery.data;

  const [parsedFiles, setParsedFiles] = useState<FileDiffMetadata[]>([]);
  const [isParsingPatch, setIsParsingPatch] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!patchText || !previewPath) {
      setParsedFiles([]);
      setIsParsingPatch(false);
      return () => {
        cancelled = true;
      };
    }

    const request = getParsedPatchRequest(previewPath, patchText);
    if (!request) {
      setParsedFiles([]);
      setIsParsingPatch(false);
      return () => {
        cancelled = true;
      };
    }

    setIsParsingPatch(true);

    void loadParsedPatch(request, "high")
      .then((parsedPatch: ParsedPatch | null) => {
        if (cancelled) return;
        const nextParsedFiles = parsedPatch?.flatMap((p) => p.files) ?? [];
        setParsedFiles(nextParsedFiles);
      })
      .finally(() => {
        if (!cancelled) setIsParsingPatch(false);
      });

    return () => {
      cancelled = true;
    };
  }, [patchText, previewPath]);

  const selectedFileDiff =
    parsedFiles.find((f) => f.name === previewPath || f.prevName === previewPath) ?? null;
  const oldFile = null;
  const newFile = null;
  const loadingPatch = isParsingPatch || (!patchText && pullRequestDiffQuery.isLoading);
  const errorMessage = patchText ? "" : errorMessageFrom(pullRequestDiffQuery.error, "");

  const hasContent = Boolean(selectedFileDiff);

  return (
    <section className="flex h-full min-h-0 flex-col">
      <ReviewCommentsCopyToolbar
        repoPath={reviewRepoPath}
        pullRequestNumber={pullRequestNumber}
        compareBaseRef={reviewBaseRef}
        compareHeadRef={reviewHeadRef}
        activePath={previewPath ?? ""}
        activePreviousPath={previewSelection?.previousPath}
      />
      <div className="grid min-h-0 flex-1">
        {!reviewActivePath ? (
          <div className="text-muted-foreground p-3 text-sm">Select a file to view diff.</div>
        ) : (
          <div className="relative flex h-full min-h-0 min-w-0 flex-col" key="pr-diff-viewer">
            <DiffWorkspace
              oldFile={oldFile}
              newFile={newFile}
              fileDiff={selectedFileDiff}
              activePath={previewPath ?? ""}
              commentContext={{ kind: "review", baseRef: reviewBaseRef, headRef: reviewHeadRef }}
              canComment
              includeCurrentFileComments={false}
              fileViewerRevision={reviewHeadRef}
              focusedLineNumber={focusedLineNumber}
              focusedLineIndex={focusedLineIndex}
              focusedLineKey={focusedLineKey}
              annotationItems={annotationItems}
              commentMentions={commentMentions}
            />
            {errorMessage ? (
              <div className="absolute inset-0 z-10 flex items-start justify-start bg-background/80 p-3">
                <div className="text-destructive text-sm">{errorMessage}</div>
              </div>
            ) : loadingPatch ? (
              <div className="absolute inset-0 z-10 flex items-start justify-start bg-background/80 p-3">
                <div className="text-muted-foreground text-sm">Loading diff...</div>
              </div>
            ) : !hasContent ? (
              <div className="absolute inset-0 z-10 flex items-start justify-start bg-background/80 p-3">
                <div className="text-muted-foreground text-sm">No diff content.</div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}

export function PullRequestReviewFilesScreen() {
  const dispatch = useAppDispatch();
  const reviewActivePath = useAppSelector(selectReviewActivePath);
  const filesViewMode = useAppSelector((state) => state.pullRequests.filesViewMode);
  const fileJumpTarget = useAppSelector((state) => state.pullRequests.fileJumpTarget);
  const fileViewerTarget = useAppSelector(selectFileViewerTarget);

  const { activeRepo, resolvedReview } = usePullRequestReviewSession();

  const currentCompareBaseRef = resolvedReview?.compareBaseRef ?? "";
  const currentCompareHeadRef = resolvedReview?.compareHeadRef ?? "";
  const readyForDiff = Boolean(
    resolvedReview && activeRepo && currentCompareBaseRef && currentCompareHeadRef,
  );

  const { branchFiles, hasBranchFilesData, isLoadingBranchFiles } = useGetBranchFilesQuery(
    readyForDiff
      ? { repoPath: activeRepo, baseRef: currentCompareBaseRef, headRef: currentCompareHeadRef }
      : skipToken,
    {
      selectFromResult: ({ data, isLoading }) => ({
        branchFiles: data ?? EMPTY_BRANCH_FILES,
        hasBranchFilesData: Boolean(data),
        isLoadingBranchFiles: isLoading,
      }),
    },
  );

  const { conversation } = useGetPullRequestConversationQuery(
    resolvedReview
      ? {
          repoPath: resolvedReview.repoPath,
          pullRequestNumber: resolvedReview.pullRequestNumber,
        }
      : skipToken,
    {
      selectFromResult: ({ data }) => ({
        conversation: data ?? null,
      }),
      pollingInterval: 10000,
      refetchOnFocus: true,
      refetchOnReconnect: true,
    },
  );

  const focusedLineNumber =
    fileJumpTarget && fileJumpTarget.path === reviewActivePath ? fileJumpTarget.lineNumber : null;
  const focusedLineIndex =
    fileJumpTarget && fileJumpTarget.path === reviewActivePath ? fileJumpTarget.lineIndex : null;
  const focusedLineKey =
    fileJumpTarget && fileJumpTarget.path === reviewActivePath ? fileJumpTarget.focusKey : null;

  const showingPullRequestFileViewer =
    fileViewerTarget?.returnToDiff?.kind === "pull-request" &&
    (fileViewerTarget.returnToDiff.repoPath === activeRepo ||
      fileViewerTarget.returnToDiff.repoPath === resolvedReview?.repoPath);

  useEffect(() => {
    if (
      fileViewerTarget?.returnToDiff?.kind === "pull-request" &&
      fileViewerTarget.returnToDiff.repoPath === activeRepo &&
      filesViewMode !== "files"
    ) {
      dispatch(setPullRequestFilesViewMode("files"));
    }
  }, [activeRepo, dispatch, fileViewerTarget, filesViewMode]);

  useEffect(() => {
    if (!fileJumpTarget || fileJumpTarget.path !== reviewActivePath) {
      return;
    }

    dispatch(clearPullRequestFileJumpTarget());
  }, [dispatch, fileJumpTarget, reviewActivePath]);

  if (!resolvedReview) {
    return <InactivePullRequestReviewPlaceholder />;
  }

  return (
    <ResizableSidebarLayout
      panelId="primary"
      sidebarDefaultSize={24}
      sidebarMinSize={16}
      sidebarMaxSize={40}
      sidebar={
        <PullRequestFilesSidebar
          activeRepo={activeRepo}
          review={resolvedReview}
          readyForDiff={readyForDiff}
          branchFiles={branchFiles}
          hasBranchFilesData={hasBranchFilesData}
          isLoadingBranchFiles={isLoadingBranchFiles}
        />
      }
      content={
        showingPullRequestFileViewer ? (
          <GeneralFileViewer />
        ) : (
          <PullRequestDiffPane
            activeRepo={activeRepo}
            reviewRepoPath={resolvedReview.repoPath}
            reviewProviderId={resolvedReview.providerId}
            pullRequestNumber={resolvedReview.pullRequestNumber}
            reviewBaseRef={currentCompareBaseRef}
            reviewHeadRef={currentCompareHeadRef}
            readyForDiff={readyForDiff}
            branchFiles={branchFiles}
            conversation={conversation}
            focusedLineNumber={focusedLineNumber}
            focusedLineIndex={focusedLineIndex}
            focusedLineKey={focusedLineKey}
          />
        )
      }
    />
  );
}
