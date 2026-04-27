import type { HostedRepoRef } from "../../src/platform/desktop/contracts";
import {
  bitbucketAuthorLogin,
  fetchBitbucketPaginatedValues,
  toBitbucketPullRequestSummary,
  type BitbucketPullRequestResponse,
} from "../bitbucket-repo";
import type { ProviderConnectionSecret } from "../providerConnections";

import { InboxSection, type InboxParticipant, type InboxPullRequest } from "./types";

const BITBUCKET_INBOX_FIELDS =
  "+values.participants,+values.participants.user,+values.participants.user.uuid,+values.participants.user.account_id,+values.participants.role,+values.participants.approved,+values.participants.state,+values.reviewers,+values.reviewers.user,+values.reviewers.user.uuid,+values.reviewers.user.account_id,+values.reviewers.role,+values.reviewers.approved,+values.author.uuid,+values.author.account_id,-values.summary,-values.rendered,-values.description";
const BITBUCKET_INBOX_PAGE_LENGTH = 100;
const BITBUCKET_INBOX_MAX_PAGES = 5;
const BITBUCKET_INBOX_MAX_RESULTS = BITBUCKET_INBOX_PAGE_LENGTH * BITBUCKET_INBOX_MAX_PAGES;

type BitbucketInboxFetchResult = {
  prs: InboxPullRequest[];
  isPartial: boolean;
  totalFetched: number;
};

type BitbucketParticipantResponse = NonNullable<BitbucketPullRequestResponse["participants"]>[number];

function emptyResult(): BitbucketInboxFetchResult {
  return {
    prs: [],
    isPartial: false,
    totalFetched: 0,
  };
}

function toInboxParticipant(participant: BitbucketParticipantResponse): InboxParticipant {
  const user = participant.user ?? null;
  return {
    login: bitbucketAuthorLogin(user),
    displayName: user?.display_name ?? null,
    avatarUrl: user?.links?.avatar?.href ?? null,
    uuid: user?.uuid ?? null,
    accountId: user?.account_id ?? null,
    role: participant.role === "PARTICIPANT" ? "PARTICIPANT" : "REVIEWER",
    approved: participant.approved ?? false,
    state: participant.state ?? null,
  };
}

function toInboxParticipants(participants: BitbucketPullRequestResponse["participants"] | undefined) {
  return Array.isArray(participants) ? participants.map(toInboxParticipant) : [];
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
    reviewers: toInboxParticipants(pullRequest.reviewers),
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
    const prs = pullRequests
      .map((pullRequest) => toBitbucketInboxPullRequest(pullRequest, hostedRepo, section))
      .toSorted((left, right) => right.updatedAt.localeCompare(left.updatedAt));

    return {
      prs,
      isPartial: prs.length >= BITBUCKET_INBOX_MAX_RESULTS,
      totalFetched: prs.length,
    };
  } catch {
    return emptyResult();
  }
}

export async function fetchBitbucketInboxPullRequests(
  hostedRepo: HostedRepoRef,
  connection: ProviderConnectionSecret,
  userUuid: string,
): Promise<BitbucketInboxFetchResult> {
  return fetchBitbucketPullRequests(
    hostedRepo,
    connection,
    `state="OPEN" AND (author.uuid="${userUuid}" OR reviewers.uuid="${userUuid}")`,
    InboxSection.NEEDS_REVIEW,
  );
}

export async function fetchBitbucketRecentlyMergedPullRequests(
  hostedRepo: HostedRepoRef,
  connection: ProviderConnectionSecret,
  userUuid: string,
): Promise<BitbucketInboxFetchResult> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  return fetchBitbucketPullRequests(
    hostedRepo,
    connection,
    `state="MERGED" AND (author.uuid="${userUuid}" OR reviewers.uuid="${userUuid}") AND updated_on>"${sevenDaysAgo}"`,
    InboxSection.MERGING_AND_MERGED,
  );
}
