import { InboxSection, type InboxPullRequest } from "./types";

const RECENT_MERGED_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

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

function isAuthor(pullRequest: InboxPullRequest, userUuid: string): boolean {
  return pullRequest.authorUuid === userUuid;
}

function reviewerEntryForUser(pullRequest: InboxPullRequest, userUuid: string) {
  return pullRequest.reviewers.find((reviewer) => reviewer.uuid === userUuid) ?? null;
}

export function classifyPullRequest(
  pullRequest: InboxPullRequest,
  userUuid: string,
): InboxSection | null {
  if (isAuthor(pullRequest, userUuid)) {
    if (pullRequest.isDraft) {
      return InboxSection.DRAFTS;
    }

    if (pullRequest.participants.some((participant) => participant.state === "changes_requested")) {
      return InboxSection.RETURNED_TO_YOU;
    }

    if (pullRequest.reviewers.length > 0 && !pullRequest.reviewers.some((reviewer) => reviewer.approved)) {
      return InboxSection.WAITING_FOR_REVIEW;
    }

    return null;
  }

  if (isRecentMergedPullRequest(pullRequest)) {
    return InboxSection.MERGING_AND_MERGED;
  }

  const reviewerEntry = reviewerEntryForUser(pullRequest, userUuid);
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
  userUuid: string,
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
    const section = classifyPullRequest(pullRequest, userUuid);
    if (!section) {
      continue;
    }

    sections[section].push(pullRequest);
  }

  return sections;
}
