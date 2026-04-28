import { skipToken } from "@reduxjs/toolkit/query";
import { type FileDiffMetadata } from "@pierre/diffs";
import { FileCode2, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "react-router";

import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { selectActiveRepo } from "@/features/source-control/sourceControlSlice";
import { ResizableSidebarLayout } from "@/components/layout/ResizableSidebarLayout";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { DiffWorkspace } from "@/features/diff-view/DiffWorkspace";
import {
  getParsedPatchRequest,
  loadParsedPatch,
  type ParsedPatch,
} from "@/features/diff-view/services/parsedDiffCache";
import {
  useGetPullRequestConversationQuery,
  useGetPullRequestDiffCachedQuery,
  useGetPullRequestFilesQuery,
  useResolveHostedRepoQuery,
} from "@/features/hosted-repos/api";
import ReviewCommentsCopyToolbar from "@/features/pull-requests/components/ReviewCopyBar";
import { usePullRequestMentionCandidates } from "@/features/pull-requests/hooks/usePullRequestMentionCandidates";
import { usePullRequestReviewAnchors } from "@/features/pull-requests/hooks/usePullRequestReviewAnchors";
import { EMPTY_FILES } from "@/shared/stableDefaults";
import { setPullRequestPreviewActiveFilePath } from "@/features/pull-requests/pullRequestsSlice";
import FilesSidebar from "@/features/pull-requests/screens/PullRequestFileList";
import { buildPullRequestAnchorAnnotations } from "@/features/pull-requests/utils/reviewAnchors";
import { useThrottledDiffSelection } from "@/features/source-control/hooks/useThrottledDiffSelection";
import { errorMessageFrom } from "@/features/source-control/shared-utils/errorMessage";
import type {
  GitProviderId,
  PullRequestChangedFile,
  PullRequestConversation,
  PullRequestReviewThread,
} from "@/platform/desktop";

function flattenParsedPatchFiles(parsedPatch: ParsedPatch | null): FileDiffMetadata[] {
  return parsedPatch?.flatMap((patch) => patch.files) ?? [];
}

function matchesParsedFileDiff(fileDiff: FileDiffMetadata, file: PullRequestChangedFile): boolean {
  if (fileDiff.name === file.path) {
    return (fileDiff.prevName ?? null) === (file.previousPath ?? null);
  }

  if (file.previousPath && fileDiff.prevName === file.previousPath) {
    return fileDiff.name === file.path || fileDiff.name === file.previousPath;
  }

  return false;
}

function findParsedFileDiff(
  parsedFiles: FileDiffMetadata[],
  file: PullRequestChangedFile | null,
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

export const PullRequestFiles = () => {
  const activeRepo = useAppSelector(selectActiveRepo);
  const currentReview = useAppSelector((state) => state.pullRequests.currentReview);
  const { providerId, owner, repo, pullRequestNumber } = useParams();

  const parsedPullRequestNumber = Number.parseInt(pullRequestNumber ?? "", 10);
  const hasValidRoute = Boolean(
    providerId &&
    owner &&
    repo &&
    Number.isFinite(parsedPullRequestNumber) &&
    parsedPullRequestNumber > 0,
  );

  const { hostedRepo } = useResolveHostedRepoQuery(activeRepo, {
    skip: !activeRepo,
    selectFromResult: ({ data }) => ({
      hostedRepo: data ?? null,
    }),
  });

  const routeMatchesActiveRepo = Boolean(
    hostedRepo &&
    providerId &&
    owner &&
    repo &&
    hostedRepo.providerId === providerId &&
    hostedRepo.owner === owner &&
    hostedRepo.repo === repo,
  );

  const queryArg =
    activeRepo && hasValidRoute && routeMatchesActiveRepo
      ? { repoPath: activeRepo, pullRequestNumber: parsedPullRequestNumber }
      : skipToken;

  const { patchText, diffError, isLoadingDiff } = useGetPullRequestDiffCachedQuery(queryArg, {
    selectFromResult: ({ data, error, isLoading, isFetching }) => ({
      patchText: data ?? null,
      diffError: data ? "" : errorMessageFrom(error, ""),
      isLoadingDiff: isLoading || isFetching,
    }),
  });

  const { files, filesError, isLoadingFiles } = useGetPullRequestFilesQuery(queryArg, {
    selectFromResult: ({ data, error, isLoading, isFetching }) => ({
      files: data ?? EMPTY_FILES,
      filesError: data ? "" : errorMessageFrom(error, ""),
      isLoadingFiles: isLoading || isFetching,
    }),
  });

  const { conversation, reviewThreads } = useGetPullRequestConversationQuery(queryArg, {
    selectFromResult: ({ data }) => ({
      conversation: data ?? null,
      reviewThreads: data?.reviewThreads ?? [],
    }),
    pollingInterval: 30_000,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });

  const matchesCurrentReview = Boolean(
    currentReview &&
    providerId &&
    owner &&
    repo &&
    currentReview.providerId === providerId &&
    currentReview.owner === owner &&
    currentReview.repo === repo &&
    currentReview.pullRequestNumber === parsedPullRequestNumber,
  );
  const compareBaseRef = matchesCurrentReview ? (currentReview?.compareBaseRef ?? "") : "";
  const compareHeadRef = matchesCurrentReview ? (currentReview?.compareHeadRef ?? "") : "";

  return (
    <>
      <PullRequestPreviewActiveFileSync files={files} />
      <ResizableSidebarLayout
        sidebarDefaultSize={24}
        sidebarMinSize={16}
        sidebarMaxSize={36}
        sidebar={
          <FilesSidebar
            files={files}
            repoPath={activeRepo ?? ""}
            pullRequestNumber={parsedPullRequestNumber}
            compareBaseRef={compareBaseRef}
            compareHeadRef={compareHeadRef}
            filesError={filesError}
            isLoading={isLoadingFiles}
          />
        }
        content={
          <div className="grid h-full min-h-0">
            <FilesDiffViewer
              providerId={providerId}
              repoPath={activeRepo ?? ""}
              pullRequestNumber={parsedPullRequestNumber}
              compareBaseRef={compareBaseRef}
              compareHeadRef={compareHeadRef}
              patchText={patchText}
              diffError={diffError}
              isLoadingDiff={isLoadingDiff}
              files={files}
              conversation={conversation}
              reviewThreads={reviewThreads}
            />
          </div>
        }
      />
    </>
  );
};

function PullRequestPreviewActiveFileSync({ files }: { files: PullRequestChangedFile[] }) {
  const dispatch = useAppDispatch();
  const activeFilePath = useAppSelector((state) => state.pullRequests.previewActiveFilePath);

  useEffect(() => {
    const hasMatchingActiveFile = Boolean(
      activeFilePath && files.some((file) => file.path === activeFilePath),
    );

    if (files.length === 0) {
      if (activeFilePath) {
        dispatch(setPullRequestPreviewActiveFilePath(""));
      }
      return;
    }

    if (!hasMatchingActiveFile) {
      dispatch(setPullRequestPreviewActiveFilePath(files[0].path));
    }
  }, [activeFilePath, dispatch, files]);

  return null;
}

function FilesDiffViewer({
  providerId,
  repoPath,
  pullRequestNumber,
  compareBaseRef,
  compareHeadRef,
  patchText,
  diffError,
  isLoadingDiff,
  files,
  conversation,
  reviewThreads,
}: {
  providerId?: string;
  repoPath: string;
  pullRequestNumber: number;
  compareBaseRef: string;
  compareHeadRef: string;
  patchText: string | null;
  diffError: string;
  isLoadingDiff: boolean;
  files: PullRequestChangedFile[];
  conversation: PullRequestConversation | null;
  reviewThreads: PullRequestReviewThread[];
}) {
  const [parsedFiles, setParsedFiles] = useState<FileDiffMetadata[]>([]);
  const [parsedPatchError, setParsedPatchError] = useState("");
  const [isParsingPatch, setIsParsingPatch] = useState(false);
  const selectedPath = useAppSelector((state) => state.pullRequests.previewActiveFilePath);
  const previewFileJumpTarget = useAppSelector((state) => state.pullRequests.previewFileJumpTarget);
  const { anchorsByFile } = usePullRequestReviewAnchors({
    repoPath,
    compareBaseRef,
    compareHeadRef,
    files,
    reviewThreads,
  });
  const commentMentions = usePullRequestMentionCandidates(conversation);
  const selectedFile = files.find((file) => file.path === selectedPath) ?? null;
  const previewSelection = useThrottledDiffSelection(
    selectedFile
      ? { path: selectedFile.path, previousPath: selectedFile.previousPath ?? undefined }
      : null,
  );
  const previewPath = previewSelection?.path ?? selectedFile?.path ?? "";
  const previewFile = files.find((file) => file.path === previewPath) ?? selectedFile;
  const canComment = Boolean(compareBaseRef && compareHeadRef);

  useEffect(() => {
    let cancelled = false;
    const parseTargetPath = selectedPath || files[0]?.path || null;
    if (!patchText || !parseTargetPath) {
      setParsedFiles([]);
      setParsedPatchError("");
      setIsParsingPatch(false);
      return () => {
        cancelled = true;
      };
    }

    const request = getParsedPatchRequest(parseTargetPath, patchText);
    if (!request) {
      setParsedFiles([]);
      setParsedPatchError("Diff unavailable");
      setIsParsingPatch(false);
      return () => {
        cancelled = true;
      };
    }

    setIsParsingPatch(true);
    setParsedPatchError("");

    void loadParsedPatch(request, "high")
      .then((parsedPatch) => {
        if (cancelled) {
          return;
        }

        const nextParsedFiles = flattenParsedPatchFiles(parsedPatch);
        setParsedFiles(nextParsedFiles);
        if (!parsedPatch) {
          setParsedPatchError("Diff unavailable");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsParsingPatch(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [files, patchText, selectedPath]);

  const selectedFileDiff = findParsedFileDiff(parsedFiles, previewFile ?? selectedFile);
  const anchorAnnotations = previewFile
    ? buildPullRequestAnchorAnnotations({
        anchors: anchorsByFile[previewFile.path] ?? [],
        repoPath,
        pullRequestNumber,
        compareBaseRef,
        compareHeadRef,
        // oxlint-disable-next-line typescript-eslint(no-unsafe-type-assertion)
        providerId: providerId as GitProviderId | undefined,
      })
    : [];
  const focusedLineNumber =
    previewFileJumpTarget && previewFileJumpTarget.path === previewPath
      ? previewFileJumpTarget.lineNumber
      : null;
  const focusedLineIndex =
    previewFileJumpTarget && previewFileJumpTarget.path === previewPath
      ? previewFileJumpTarget.lineIndex
      : null;
  const focusedLineKey =
    previewFileJumpTarget && previewFileJumpTarget.path === previewPath
      ? previewFileJumpTarget.focusKey
      : null;

  if (files.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <Empty className="border-0 bg-transparent">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileCode2 className="h-5 w-5" />
            </EmptyMedia>
            <EmptyTitle>No changed files</EmptyTitle>
            <EmptyDescription>
              This pull request does not expose changed files yet.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  if (!selectedFile) {
    return (
      <div className="flex h-full items-center justify-center">
        <Empty className="border-0 bg-transparent">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileCode2 className="h-5 w-5" />
            </EmptyMedia>
            <EmptyTitle>Select a file</EmptyTitle>
            <EmptyDescription>Choose a file from the sidebar to view its diff.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  if (isLoadingDiff || isParsingPatch) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoaderCircle className="text-muted-foreground h-5 w-5 animate-spin" />
        <span className="text-muted-foreground ml-2 text-sm">Loading diff...</span>
      </div>
    );
  }

  if (diffError) {
    return (
      <div className="text-destructive rounded-2xl border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm">
        {diffError}
      </div>
    );
  }

  if (parsedPatchError) {
    return (
      <div className="text-destructive rounded-2xl border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm">
        {parsedPatchError}
      </div>
    );
  }

  if (!selectedFileDiff) {
    return (
      <div className="flex h-full items-center justify-center">
        <Empty className="border-0 bg-transparent">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileCode2 className="h-5 w-5" />
            </EmptyMedia>
            <EmptyTitle>Diff unavailable</EmptyTitle>
            <EmptyDescription>
              This file may be binary or the pull request patch did not include renderable hunks.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    <div className="grid h-full min-h-0 min-w-0">
      <div className="flex h-full min-h-0 min-w-0 flex-col">
        <ReviewCommentsCopyToolbar
          repoPath={repoPath}
          pullRequestNumber={pullRequestNumber}
          compareBaseRef={compareBaseRef}
          compareHeadRef={compareHeadRef}
          activePath={previewFile?.path ?? selectedFile.path}
          activePreviousPath={previewFile?.previousPath ?? selectedFile.previousPath ?? undefined}
        />
        <DiffWorkspace
          oldFile={null}
          newFile={null}
          fileDiff={selectedFileDiff}
          activePath={previewFile?.path ?? selectedFile.path}
          commentContext={{ kind: "review", baseRef: compareBaseRef, headRef: compareHeadRef }}
          canComment={canComment}
          includeCurrentFileComments={false}
          fileViewerRevision={compareHeadRef || null}
          lspJumpContextKind="pull-request"
          focusedLineNumber={focusedLineNumber}
          focusedLineIndex={focusedLineIndex}
          focusedLineKey={focusedLineKey}
          annotationItems={anchorAnnotations}
          commentMentions={commentMentions}
        />
      </div>
    </div>
  );
}
