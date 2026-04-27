import { InboxSection, type InboxParticipant, type InboxPullRequest } from "./types";

const RECENT_MERGED_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

type PullRequestUserIdentity = {
  accountId: string | null;
  uuid: string | null;
};

function isRecentMergedPullRequest(pullRequest: InboxPullRequest): boolean {
  if (pullRequest.state !== "merged") {
    return false;
  }

  const updatedAt = Date.parse(pullRequest.updatedAt);
  if (Number.isNaN(updatedAt)) {
    return false;
  }

  return Date.now() - updatedAt <= RECENT_MERGED_WINDOW_MS;
}

function matchesUserIdentity(
  candidateIdentity: PullRequestUserIdentity,
  userIdentity: PullRequestUserIdentity,
): boolean {
  if (userIdentity.accountId && candidateIdentity.accountId === userIdentity.accountId) {
    return true;
  }

  if (userIdentity.uuid && candidateIdentity.uuid === userIdentity.uuid) {
    return true;
  }

  return false;
}

function isAuthor(pullRequest: InboxPullRequest, userIdentity: PullRequestUserIdentity): boolean {
  return matchesUserIdentity(
    {
      accountId: pullRequest.authorAccountId,
      uuid: pullRequest.authorUuid,
    },
    userIdentity,
  );
}

function reviewerEntryForUser(
  pullRequest: InboxPullRequest,
  userIdentity: PullRequestUserIdentity,
) {
  return (
    (pullRequest.reviewers as InboxParticipant[]).find((reviewer) =>
      matchesUserIdentity(reviewer, userIdentity),
    ) ?? null
  );
}

export function classifyPullRequest(
  pullRequest: InboxPullRequest,
  userIdentity: PullRequestUserIdentity,
): InboxSection | null {
  if (isRecentMergedPullRequest(pullRequest)) {
    return InboxSection.MERGING_AND_MERGED;
  }

  if (isAuthor(pullRequest, userIdentity)) {
    if (pullRequest.isDraft) {
      return InboxSection.DRAFTS;
    }

    if (pullRequest.participants.some((participant) => participant.state === "changes_requested")) {
      return InboxSection.RETURNED_TO_YOU;
    }

    if (
      pullRequest.reviewers.length > 0 &&
      !pullRequest.reviewers.some((reviewer) => reviewer.approved)
    ) {
      return InboxSection.WAITING_FOR_REVIEW;
    }

    return null;
  }

  const reviewerEntry = reviewerEntryForUser(pullRequest, userIdentity);
  if (!reviewerEntry) {
    return null;
  }

  if (reviewerEntry.approved || reviewerEntry.state === "approved") {
    return InboxSection.APPROVED;
  }

  return InboxSection.NEEDS_REVIEW;
}

export function classifyPullRequests(
  pullRequests: InboxPullRequest[],
  userIdentity: PullRequestUserIdentity,
): Record<InboxSection, InboxPullRequest[]> {
  const sections: Record<InboxSection, InboxPullRequest[]> = {
    [InboxSection.NEEDS_REVIEW]: [],
    [InboxSection.WAITING_FOR_REVIEW]: [],
    [InboxSection.RETURNED_TO_YOU]: [],
    [InboxSection.DRAFTS]: [],
    [InboxSection.APPROVED]: [],
    [InboxSection.MERGING_AND_MERGED]: [],
  };

  for (const pullRequest of pullRequests) {
    const section = classifyPullRequest(pullRequest, userIdentity);
    if (!section) {
      continue;
    }

    sections[section].push(pullRequest);
  }

  return sections;
}
