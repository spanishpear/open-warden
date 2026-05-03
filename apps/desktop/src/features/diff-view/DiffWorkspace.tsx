import { useCallback, useMemo } from "react";

import type { MentionConfig } from "@/components/markdown/MarkdownEditor";
import { DiffHeaderMetadataControls } from "@/features/diff-view/components/DiffHeaderMetadataControls";
import { PullRequestInlineAnchorAnnotation } from "@/features/pull-requests/components/PullRequestInlineAnchorAnnotation";
import { PullRequestInlineReviewThread } from "@/features/pull-requests/components/PullRequestInlineReviewThread";
import type { CommentContext, DiffAnnotationItem, DiffFile } from "@/features/source-control/types";
import { DiffViewer } from "@/features/diff-view/components/DiffViewer";
import { useDiffCommentAnnotations } from "@/features/diff-view/hooks/useDiffCommentAnnotations";
import { useDiffAnnotationRenderer } from "@/features/diff-view/hooks/useDiffAnnotationRenderer";
import {
  type DiffLineAnnotation,
  type FileDiffMetadata,
  type FileDiffOptions,
} from "@pierre/diffs";

type Props = {
  oldFile: DiffFile | null;
  newFile: DiffFile | null;
  fileDiff?: FileDiffMetadata | null;
  activePath: string;
  commentContext: CommentContext;
  canComment: boolean;
  fileViewerRevision?: string | null;
  focusedLineNumber?: number | null;
  focusedLineIndex?: string | null;
  focusedLineKey?: number | string | null;
  annotationItems?: DiffLineAnnotation<DiffAnnotationItem>[];
  commentMentions?: MentionConfig;
  includeCurrentFileComments?: boolean;
  disableFileHeader?: boolean;
  hideHeaderMetadataControls?: boolean;
};

export function DiffWorkspace({
  oldFile,
  newFile,
  fileDiff = null,
  activePath,
  commentContext,
  canComment,
  fileViewerRevision,
  focusedLineNumber = null,
  focusedLineIndex = null,
  focusedLineKey = null,
  annotationItems = [],
  commentMentions,
  includeCurrentFileComments = true,
  disableFileHeader = false,
  hideHeaderMetadataControls = false,
}: Props) {
  const comments = useDiffCommentAnnotations({
    activePath,
    commentContext,
    canComment,
    includeCurrentFileComments,
    commentMentions,
  });

  const renderAnnotation = useDiffAnnotationRenderer({
    composer: comments.renderCommentAnnotation,
    "pull-request-anchor": (data) => (
      <PullRequestInlineAnchorAnnotation
        providerId={data.providerId}
        repoPath={data.repoPath}
        pullRequestNumber={data.pullRequestNumber}
        anchor={data.anchor}
        compareBaseRef={data.compareBaseRef}
        compareHeadRef={data.compareHeadRef}
        mentions={commentMentions}
      />
    ),
    "pull-request-thread": (data) => (
      <PullRequestInlineReviewThread
        repoPath={data.repoPath}
        pullRequestNumber={data.pullRequestNumber}
        thread={data.thread}
        mentions={commentMentions}
      />
    ),
    annotation: comments.renderCommentAnnotation,
  });

  const mergedAnnotations = useMemo(
    () => [...comments.annotations, ...annotationItems],
    [comments.annotations, annotationItems],
  );

  const options = useMemo<Partial<FileDiffOptions<DiffAnnotationItem>>>(
    () => ({
      disableFileHeader,
      enableLineSelection: canComment,
      enableGutterUtility: canComment,
      onLineSelected: canComment ? comments.onLineSelected : undefined,
      onLineSelectionEnd: canComment ? comments.onLineSelectionEnd : undefined,
    }),
    [canComment, comments.onLineSelected, comments.onLineSelectionEnd, disableFileHeader],
  );

  const renderHeaderMetadata = useCallback(
    (controls: { expandUnchanged: boolean; onToggleExpandUnchanged: () => void }) => {
      if (hideHeaderMetadataControls) {
        return undefined;
      }

      return (
        <DiffHeaderMetadataControls
          activePath={activePath}
          canComment={canComment}
          commentContext={commentContext}
          expandUnchanged={controls.expandUnchanged}
          fileViewerRevision={fileViewerRevision}
          onToggleExpandUnchanged={controls.onToggleExpandUnchanged}
        />
      );
    },
    [activePath, canComment, commentContext, fileViewerRevision, hideHeaderMetadataControls],
  );

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <DiffViewer
        oldFile={oldFile}
        newFile={newFile}
        fileDiff={fileDiff}
        activePath={activePath}
        options={options}
        lineAnnotations={mergedAnnotations}
        renderAnnotation={renderAnnotation}
        renderHeaderMetadata={renderHeaderMetadata}
        selectedLines={comments.selectedRange}
        focusedLineNumber={focusedLineNumber}
        focusedLineIndex={focusedLineIndex}
        focusedLineKey={focusedLineKey}
      />
    </div>
  );
}
