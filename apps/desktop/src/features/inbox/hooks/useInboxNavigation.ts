import { useNavigate } from "react-router";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { buildPullRequestPreviewPath } from "@/features/pull-requests/utils";
import { buildPreviewTabPath } from "@/features/pull-requests/screens/PullRequestPreviewLayout";
import { openPullRequestReview } from "@/features/hosted-repos/actions";
import { hostedReposApi } from "@/features/hosted-repos/api";
import type { PullRequestSummary } from "@/platform/desktop";

export type UseInboxNavigationReturn = {
  navigateToPreview: (pr: PullRequestSummary) => void;
  navigateToDiff: (pr: PullRequestSummary) => void;
  launchReviewer: (pr: PullRequestSummary) => void;
  prefetchPRDetail: (pr: PullRequestSummary) => void;
};

export function useInboxNavigation(): UseInboxNavigationReturn {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const activeRepo = useAppSelector((state) => state.sourceControl.activeRepo);

  function prefetchPRDiff(pr: PullRequestSummary) {
    if (!activeRepo) return;

    dispatch(
      hostedReposApi.util.prefetch(
        "getPullRequestDiffCached",
        { repoPath: activeRepo, pullRequestNumber: pr.number },
        { force: false },
      ),
    );
  }

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
    if (!activeRepo) return;

    prefetchPRDiff(pr);

    dispatch(
      hostedReposApi.util.prefetch(
        "getPullRequestConversation",
        { repoPath: activeRepo, pullRequestNumber: pr.number },
        { force: false },
      ),
    );
    dispatch(
      hostedReposApi.util.prefetch(
        "getPullRequestFiles",
        { repoPath: activeRepo, pullRequestNumber: pr.number },
        { force: false },
      ),
    );
  }

  return {
    navigateToPreview,
    navigateToDiff,
    launchReviewer,
    prefetchPRDetail,
  };
}
