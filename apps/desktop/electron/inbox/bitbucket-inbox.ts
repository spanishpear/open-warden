import type { HostedRepoRef } from "../../src/platform/desktop/contracts";
import {
  bitbucketAuthorLogin,
  fetchBitbucketPaginatedValues,
  toBitbucketPullRequestSummary,
  type BitbucketPullRequestResponse,
  type BitbucketUserResponse,
} from "../bitbucket-repo";
import type { ProviderConnectionSecret } from "../providerConnections";

import { InboxSection, type InboxParticipant, type InboxPullRequest } from "./types";

const BITBUCKET_INBOX_FIELDS =
  "+values.participants,+values.participants.user,+values.participants.user.uuid,+values.participants.user.account_id,+values.participants.role,+values.participants.approved,+values.participants.state,+values.reviewers,+values.reviewers.user,+values.reviewers.user.uuid,+values.reviewers.user.account_id,+values.reviewers.role,+values.reviewers.approved,+values.author.uuid,+values.author.account_id,-values.summary,-values.rendered,-values.description";
const BITBUCKET_INBOX_PAGE_LENGTH = 20;
const BITBUCKET_INBOX_MAX_PAGES = 25;
const BITBUCKET_INBOX_MAX_RESULTS = BITBUCKET_INBOX_PAGE_LENGTH * BITBUCKET_INBOX_MAX_PAGES;

type BitbucketInboxFetchResult = {
  prs: InboxPullRequest[];
  isPartial: boolean;
  totalFetched: number;
};

type BitbucketUserIdentity = {
  accountId: string | null;
  uuid: string | null;
};

type BitbucketParticipantResponse = NonNullable<
  BitbucketPullRequestResponse["participants"]
>[number];
type BitbucketParticipantLike =
  | BitbucketParticipantResponse
  | (BitbucketUserResponse & {
      role?: "REVIEWER" | "PARTICIPANT";
      approved?: boolean;
      state?: "approved" | "changes_requested" | null;
      user?: BitbucketUserResponse | null;
    });

function emptyResult(): BitbucketInboxFetchResult {
  return {
    prs: [],
    isPartial: false,
    totalFetched: 0,
  };
}

function isBitbucketUserResponse(
  participant: BitbucketParticipantLike,
): participant is BitbucketUserResponse {
  return (
    "nickname" in participant ||
    "display_name" in participant ||
    "uuid" in participant ||
    "account_id" in participant
  );
}

function extractBitbucketUser(participant: BitbucketParticipantLike): BitbucketUserResponse | null {
  if (participant.user) {
    return participant.user;
  }

  return isBitbucketUserResponse(participant) ? participant : null;
}

function toInboxParticipant(
  participant: BitbucketParticipantLike,
  roleFallback?: InboxParticipant["role"],
): InboxParticipant {
  const user = extractBitbucketUser(participant);

  return {
    login: bitbucketAuthorLogin(user),
    displayName: user?.display_name ?? null,
    avatarUrl: user?.links?.avatar?.href ?? null,
    uuid: user?.uuid ?? null,
    accountId: user?.account_id ?? null,
    role: participant.role === "PARTICIPANT" ? "PARTICIPANT" : (roleFallback ?? "REVIEWER"),
    approved: participant.approved ?? false,
    state: participant.state ?? null,
  };
}

function dedupeParticipants(participants: InboxParticipant[]): InboxParticipant[] {
  const byIdentity = new Map<string, InboxParticipant>();

  for (const participant of participants) {
    const key =
      participant.accountId ?? participant.uuid ?? `${participant.role}:${participant.login}`;
    const existing = byIdentity.get(key);

    if (!existing) {
      byIdentity.set(key, participant);
      continue;
    }

    byIdentity.set(key, {
      ...existing,
      ...participant,
      displayName: participant.displayName ?? existing.displayName,
      avatarUrl: participant.avatarUrl ?? existing.avatarUrl,
      uuid: participant.uuid ?? existing.uuid,
      accountId: participant.accountId ?? existing.accountId,
      approved: existing.approved || participant.approved,
      state: participant.state ?? existing.state,
    });
  }

  return [...byIdentity.values()];
}

function hasUsefulReviewerIdentity(participant: InboxParticipant): boolean {
  return Boolean(participant.accountId || participant.uuid || participant.login !== "unknown");
}

function toInboxParticipants(
  participants: BitbucketPullRequestResponse["participants"] | undefined,
): InboxParticipant[] {
  return Array.isArray(participants)
    ? participants.map((participant) => toInboxParticipant(participant))
    : [];
}

function toInboxReviewers(pullRequest: BitbucketPullRequestResponse): InboxParticipant[] {
  const participantReviewers = toInboxParticipants(pullRequest.participants).filter(
    (participant) => participant.role === "REVIEWER",
  );

  const mappedReviewers = Array.isArray(pullRequest.reviewers)
    ? pullRequest.reviewers.map((reviewer) =>
        toInboxParticipant(reviewer as BitbucketParticipantLike, "REVIEWER"),
      )
    : [];

  return dedupeParticipants([...participantReviewers, ...mappedReviewers]).filter(
    hasUsefulReviewerIdentity,
  );
}

function dedupePullRequests(pullRequests: InboxPullRequest[]): InboxPullRequest[] {
  const seen = new Set<string>();
  return pullRequests.filter((pullRequest) => {
    if (seen.has(pullRequest.id)) {
      return false;
    }

    seen.add(pullRequest.id);
    return true;
  });
}

function toBitbucketInboxPullRequest(
  pullRequest: BitbucketPullRequestResponse,
  hostedRepo: HostedRepoRef,
  section: InboxSection,
): InboxPullRequest {
  const summary = toBitbucketPullRequestSummary(pullRequest, hostedRepo);
  return {
    ...summary,
    authorUuid: pullRequest.author?.uuid ?? summary.authorUuid ?? null,
    authorAccountId: pullRequest.author?.account_id ?? summary.authorAccountId ?? null,
    participants: toInboxParticipants(pullRequest.participants),
    reviewers: toInboxReviewers(pullRequest),
    section,
  };
}

function buildBitbucketPullRequestPath(hostedRepo: HostedRepoRef, query: string) {
  const params = new URLSearchParams({
    pagelen: String(BITBUCKET_INBOX_PAGE_LENGTH),
    q: query,
    sort: "-updated_on",
    fields: BITBUCKET_INBOX_FIELDS,
  });
  return `/repositories/${encodeURIComponent(hostedRepo.owner)}/${encodeURIComponent(hostedRepo.repo)}/pullrequests?${params.toString()}`;
}

async function fetchBitbucketPullRequests(
  hostedRepo: HostedRepoRef,
  connection: ProviderConnectionSecret,
  query: string,
  section: InboxSection,
): Promise<BitbucketInboxFetchResult> {
  try {
    const pullRequests = await fetchBitbucketPaginatedValues<BitbucketPullRequestResponse>(
      buildBitbucketPullRequestPath(hostedRepo, query),
      connection,
      { maxPages: BITBUCKET_INBOX_MAX_PAGES },
    );

    const prs = dedupePullRequests(
      pullRequests
        .map((pullRequest) => toBitbucketInboxPullRequest(pullRequest, hostedRepo, section))
        .toSorted((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    );

    return {
      prs,
      isPartial: prs.length >= BITBUCKET_INBOX_MAX_RESULTS,
      totalFetched: prs.length,
    };
  } catch {
    return emptyResult();
  }
}

function buildBitbucketReviewerAuthorQuery(userIdentity: BitbucketUserIdentity): string | null {
  if (userIdentity.accountId) {
    return `(author.account_id="${userIdentity.accountId}" OR reviewers.account_id="${userIdentity.accountId}")`;
  }

  if (userIdentity.uuid) {
    return `(author.uuid="${userIdentity.uuid}" OR reviewers.uuid="${userIdentity.uuid}")`;
  }

  return null;
}

export async function fetchBitbucketInboxPullRequests(
  hostedRepo: HostedRepoRef,
  connection: ProviderConnectionSecret,
  userIdentity: BitbucketUserIdentity,
): Promise<BitbucketInboxFetchResult> {
  const reviewerAuthorQuery = buildBitbucketReviewerAuthorQuery(userIdentity);
  if (!reviewerAuthorQuery) {
    return emptyResult();
  }

  return fetchBitbucketPullRequests(
    hostedRepo,
    connection,
    `state="OPEN" AND ${reviewerAuthorQuery}`,
    InboxSection.NEEDS_REVIEW,
  );
}

export async function fetchBitbucketRecentlyMergedPullRequests(
  hostedRepo: HostedRepoRef,
  connection: ProviderConnectionSecret,
  userIdentity: BitbucketUserIdentity,
): Promise<BitbucketInboxFetchResult> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const reviewerAuthorQuery = buildBitbucketReviewerAuthorQuery(userIdentity);
  if (!reviewerAuthorQuery) {
    return emptyResult();
  }

  return fetchBitbucketPullRequests(
    hostedRepo,
    connection,
    `state="MERGED" AND ${reviewerAuthorQuery} AND updated_on>"${sevenDaysAgo}"`,
    InboxSection.MERGING_AND_MERGED,
  );
}
