import { useNavigate } from "react-router";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import type { AppDispatch } from "@/app/store";
import { buildPullRequestPreviewPath } from "@/features/pull-requests/utils";
import { buildPreviewTabPath } from "@/features/pull-requests/screens/PullRequestPreviewLayout";
import { openPullRequestReview } from "@/features/hosted-repos/actions";
import { hostedReposApi } from "@/features/hosted-repos/api";
import type { PullRequestSummary } from "@/platform/desktop";
import { selectActiveRepo } from "@/features/source-control/sourceControlSlice";

export type UseInboxNavigationReturn = {
  navigateToPreview: (pr: PullRequestSummary) => void;
  navigateToDiff: (pr: PullRequestSummary) => void;
  launchReviewer: (pr: PullRequestSummary) => void;
  prefetchPRDetail: (pr: PullRequestSummary) => void;
};

function prefetchPullRequestDiff(
  dispatch: AppDispatch,
  repoPath: string,
  pullRequestNumber: number,
) {
  dispatch(
    hostedReposApi.util.prefetch(
      "getPullRequestDiffCached",
      { repoPath, pullRequestNumber },
      { force: false },
    ),
  );
}

export function prefetchPullRequestDetail(
  dispatch: AppDispatch,
  repoPath: string | null,
  pr: Pick<PullRequestSummary, "number">,
) {
  if (!repoPath) return;

  prefetchPullRequestDiff(dispatch, repoPath, pr.number);

  dispatch(
    hostedReposApi.util.prefetch(
      "getPullRequestConversation",
      { repoPath, pullRequestNumber: pr.number },
      { force: false },
    ),
  );
  dispatch(
    hostedReposApi.util.prefetch(
      "getPullRequestFiles",
      { repoPath, pullRequestNumber: pr.number },
      { force: false },
    ),
  );
}

export function useInboxNavigation(): UseInboxNavigationReturn {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const activeRepo = useAppSelector(selectActiveRepo);

  function navigateToPreview(pr: PullRequestSummary) {
    const path = buildPullRequestPreviewPath({
      providerId: pr.providerId,
      owner: pr.headOwner,
      repo: pr.headRepo,
      pullRequestNumber: pr.number,
    });

    void navigate(path);
  }

  function navigateToDiff(pr: PullRequestSummary) {
    const path = buildPreviewTabPath({
      providerId: pr.providerId,
      owner: pr.headOwner,
      repo: pr.headRepo,
      pullRequestNumber: pr.number,
      tab: "files",
    });

    void navigate(path);
  }

  function launchReviewer(pr: PullRequestSummary) {
    // openPullRequestReview is a thunk; dispatch it and then navigate to the review view
    // open in branch mode so reviewer workspace uses the PR branch
    void dispatch(openPullRequestReview(pr.number, "branch"));
    void navigate("/changes/pull-request/files");
  }

  function prefetchPRDetail(pr: PullRequestSummary) {
    prefetchPullRequestDetail(dispatch, activeRepo, pr);
  }

  return {
    navigateToPreview,
    navigateToDiff,
    launchReviewer,
    prefetchPRDetail,
  };
}
