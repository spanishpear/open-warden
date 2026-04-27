import type { GitProviderId } from "@/platform/desktop";

type PullRequestRoutePathInput = {
  providerId: GitProviderId;
  owner: string;
  repo: string;
  pullRequestNumber: number;
};

export function buildPullRequestsInboxPath() {
  return "/pull-requests";
}

export function buildPullRequestPreviewPath({
  providerId,
  owner,
  repo,
  pullRequestNumber,
}: PullRequestRoutePathInput) {
  return `${buildPullRequestsInboxPath()}/${providerId}/${owner}/${repo}/${String(pullRequestNumber)}`;
}

// @ts-expect-error -- oxlint typescript
// oxlint-disable-next-line eslint(no-unused-vars)
const buildPullRequestReviewPath = buildPullRequestPreviewPath;
