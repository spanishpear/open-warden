import { toast } from "sonner";

import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { removeCommentsByIds } from "@/features/comments/commentsSlice";
import {
  useSubmitPullRequestReviewCommentsMutation,
  useSubmitPullRequestReviewDecisionMutation,
} from "@/features/hosted-repos/api";
import { selectPendingDrafts } from "@/features/comments/memoizedSelectors";
import { buildPendingReviewCommentsPayload } from "@/features/pull-requests/utils/pendingReviewDrafts";
import { buildSubmitPullRequestReviewCommentsInput } from "@/features/pull-requests/utils/pendingReviewComments";
import { errorMessageFrom } from "@/features/source-control/shared-utils/errorMessage";
import type { PullRequestReviewAnchor } from "@/features/source-control/types";
import type { PullRequestReviewDecision } from "@/platform/desktop";

function decisionLabel(decision: PullRequestReviewDecision): string {
  if (decision === "APPROVE") return "Approved pull request";
  if (decision === "REQUEST_CHANGES") return "Requested changes on pull request";
  return "Removed review decision";
}

export function usePullRequestPendingReviewActions(args: {
  repoPath: string;
  pullRequestNumber: number;
  compareBaseRef: string;
  compareHeadRef: string;
}) {
  const dispatch = useAppDispatch();
  const pendingDrafts = useAppSelector(
    selectPendingDrafts(args.repoPath, {
      kind: "review",
      baseRef: args.compareBaseRef,
      headRef: args.compareHeadRef,
    }),
  );
  const [submitPullRequestReviewComments, { isLoading: isSubmittingReviewComments }] =
    useSubmitPullRequestReviewCommentsMutation();
  const [submitPullRequestReviewDecision, { isLoading: isSubmittingReviewDecision }] =
    useSubmitPullRequestReviewDecisionMutation();

  const pendingDraftCount = pendingDrafts.length;
  const allPendingPayload = buildPendingReviewCommentsPayload(pendingDrafts);
  const isSubmittingReview = isSubmittingReviewComments || isSubmittingReviewDecision;

  async function copyPendingDrafts(source: typeof pendingDrafts) {
    const payload = buildPendingReviewCommentsPayload(source);
    if (!payload) {
      return false;
    }

    try {
      await navigator.clipboard.writeText(payload);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to copy pending comments");
      return false;
    }
  }

  function clearPendingDrafts(source: typeof pendingDrafts) {
    if (source.length === 0) {
      return;
    }

    dispatch(removeCommentsByIds(source.map((comment) => comment.id)));
  }

  async function publishPendingDrafts(
    source: typeof pendingDrafts,
    options?: { reviewDecision?: PullRequestReviewDecision | null },
  ) {
    if (!args.repoPath || args.pullRequestNumber <= 0) {
      return;
    }

    const reviewDecision = options?.reviewDecision ?? null;
    if (source.length === 0 && !reviewDecision) {
      return;
    }

    try {
      const result = await submitPullRequestReviewComments(
        buildSubmitPullRequestReviewCommentsInput({
          repoPath: args.repoPath,
          pullRequestNumber: args.pullRequestNumber,
          comments: source,
          reviewDecision,
        }),
      ).unwrap();

      if (result.submittedDraftIds.length > 0) {
        dispatch(removeCommentsByIds(result.submittedDraftIds));
      }

      if (result.failedMessage) {
        toast.error(result.failedMessage);
      }

      if (result.reviewDecisionError) {
        toast.error(result.reviewDecisionError);
      } else if (result.reviewDecision) {
        toast.success(decisionLabel(result.reviewDecision));
      }
    } catch (error) {
      toast.error(errorMessageFrom(error, "Failed to publish review"));
    }
  }

  async function submitDecision(decision: PullRequestReviewDecision) {
    if (!args.repoPath || args.pullRequestNumber <= 0) {
      return;
    }

    if (pendingDrafts.length > 0) {
      await publishPendingDrafts(pendingDrafts, { reviewDecision: decision });
      return;
    }

    try {
      const result = await submitPullRequestReviewDecision({
        repoPath: args.repoPath,
        pullRequestNumber: args.pullRequestNumber,
        decision,
      }).unwrap();
      toast.success(decisionLabel(result.decision));
    } catch (error) {
      toast.error(errorMessageFrom(error, "Failed to submit review decision"));
    }
  }

  return {
    pendingDrafts,
    pendingDraftCount,
    allPendingPayload,
    isSubmittingReviewComments,
    isSubmittingReviewDecision,
    isSubmittingReview,
    getPendingDraftsForFile(path: string) {
      return pendingDrafts.filter((draft) => draft.filePath === path);
    },
    getPendingPayloadForFile(path: string) {
      return buildPendingReviewCommentsPayload(
        pendingDrafts.filter((draft) => draft.filePath === path),
      );
    },
    async copyAllPendingDrafts() {
      return copyPendingDrafts(pendingDrafts);
    },
    async copyAnchorPendingDrafts(anchor: PullRequestReviewAnchor) {
      return copyPendingDrafts(anchor.pendingDrafts);
    },
    clearAllPendingDrafts() {
      clearPendingDrafts(pendingDrafts);
    },
    clearAnchorPendingDrafts(anchor: PullRequestReviewAnchor) {
      clearPendingDrafts(anchor.pendingDrafts);
    },
    async publishAllPendingDrafts() {
      await publishPendingDrafts(pendingDrafts);
    },
    async publishAnchorPendingDrafts(anchor: PullRequestReviewAnchor) {
      await publishPendingDrafts(anchor.pendingDrafts);
    },
    async submitReviewDecision(decision: PullRequestReviewDecision) {
      await submitDecision(decision);
    },
  };
}
