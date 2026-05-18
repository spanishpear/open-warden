import { CheckCircle2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { usePullRequestPendingReviewActions } from "@/features/pull-requests/hooks/usePullRequestPendingReviewActions";

export type PullRequestReviewDecisionButtonsProps = {
  repoPath: string;
  pullRequestNumber: number;
  compareBaseRef: string;
  compareHeadRef: string;
  size?: "xs" | "sm";
};

/**
 * Compact Approve / Request Changes button pair.
 *
 * When pending inline draft comments exist they will be published as part of the
 * submitted review, otherwise a decision-only review is recorded against the PR.
 */
export function PullRequestReviewDecisionButtons({
  repoPath,
  pullRequestNumber,
  compareBaseRef,
  compareHeadRef,
  size = "xs",
}: PullRequestReviewDecisionButtonsProps) {
  const pendingActions = usePullRequestPendingReviewActions({
    repoPath,
    pullRequestNumber,
    compareBaseRef,
    compareHeadRef,
  });

  const hasPendingDrafts = pendingActions.pendingDraftCount > 0;
  const disabled = !repoPath || pullRequestNumber <= 0 || pendingActions.isSubmittingReview;

  const approveLabel = hasPendingDrafts
    ? "Approve pull request and publish pending comments"
    : "Approve pull request";
  const requestChangesLabel = hasPendingDrafts
    ? "Request changes and publish pending comments"
    : "Request changes";

  return (
    <div className="flex items-center gap-1.5" data-testid="pr-review-decision-buttons">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size={size}
              variant="outline"
              className="border-green-500/30 text-green-400 hover:bg-green-500/10 hover:text-green-300"
              disabled={disabled}
              onClick={() => {
                void pendingActions.submitReviewDecision("APPROVE");
              }}
              aria-label={approveLabel}
            >
              <CheckCircle2 />
              Approve
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{approveLabel}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size={size}
              variant="outline"
              className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
              disabled={disabled}
              onClick={() => {
                void pendingActions.submitReviewDecision("REQUEST_CHANGES");
              }}
              aria-label={requestChangesLabel}
            >
              <XCircle />
              Request changes
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{requestChangesLabel}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

export default PullRequestReviewDecisionButtons;
