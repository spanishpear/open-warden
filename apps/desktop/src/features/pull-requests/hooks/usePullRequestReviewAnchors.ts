import { useAppSelector } from "@/app/hooks";
import type { PullRequestReviewThread } from "@/platform/desktop";

import {
  buildPullRequestReviewAnchors,
  type PullRequestAnchorFile,
} from "@/features/pull-requests/utils/reviewAnchors";
import { selectPendingDrafts } from "@/features/comments/memoizedSelectors";

export function usePullRequestReviewAnchors(args: {
  repoPath: string;
  compareBaseRef: string;
  compareHeadRef: string;
  files: PullRequestAnchorFile[];
  reviewThreads: PullRequestReviewThread[];
}) {
  const pendingDrafts = useAppSelector(
    selectPendingDrafts(args.repoPath, {
      kind: "review",
      baseRef: args.compareBaseRef,
      headRef: args.compareHeadRef,
    }),
  );

  return buildPullRequestReviewAnchors({
    files: args.files,
    reviewThreads: args.reviewThreads,
    pendingDrafts,
  });
}
