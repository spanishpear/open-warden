import type {
  HostedRepoRef,
  InboxPullRequestsResult,
  PullRequestSummary,
} from "../../src/platform/desktop/contracts";
import { resolveHostedRepo } from "../hosted-repos/repository";
import { missingConnectionMessage, providerDisplayName } from "../hosted-repos/providers";
import { getProviderConnection, type ProviderConnectionSecret } from "../providerConnections";

import {
  fetchBitbucketInboxPullRequests,
  fetchBitbucketRecentlyMergedPullRequests,
} from "./bitbucket-inbox";
import { getOrResolveUserIdentity } from "./identity";
import {
  cacheInboxSnapshot,
  clearInboxCache,
  getCachedInboxSnapshot,
  isCacheStale,
  OPEN_CACHE_TTL_MS,
} from "./pr-cache";
import { classifyPullRequests } from "./sections";
import { InboxSection, type InboxPullRequest } from "./types";

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

function emptySections(): Record<string, PullRequestSummary[]> {
  return {
    [InboxSection.NEEDS_REVIEW]: [],
    [InboxSection.WAITING_FOR_REVIEW]: [],
    [InboxSection.RETURNED_TO_YOU]: [],
    [InboxSection.DRAFTS]: [],
    [InboxSection.APPROVED]: [],
    [InboxSection.MERGING_AND_MERGED]: [],
  };
}

function emptyResult(fetchedAt = Date.now()): InboxPullRequestsResult {
  return {
    sections: emptySections(),
    userLogin: null,
    fetchedAt,
    isStale: false,
  };
}

function toResultSections(
  sections: Record<InboxSection, InboxPullRequest[]>,
): Record<string, PullRequestSummary[]> {
  return {
    [InboxSection.NEEDS_REVIEW]: sections[InboxSection.NEEDS_REVIEW],
    [InboxSection.WAITING_FOR_REVIEW]: sections[InboxSection.WAITING_FOR_REVIEW],
    [InboxSection.RETURNED_TO_YOU]: sections[InboxSection.RETURNED_TO_YOU],
    [InboxSection.DRAFTS]: sections[InboxSection.DRAFTS],
    [InboxSection.APPROVED]: sections[InboxSection.APPROVED],
    [InboxSection.MERGING_AND_MERGED]: sections[InboxSection.MERGING_AND_MERGED],
  };
}

type BitbucketUserIdentity = {
  accountId: string | null;
  uuid: string | null;
};

async function fetchAndCacheMerged(
  repoPath: string,
  hostedRepo: HostedRepoRef,
  connection: ProviderConnectionSecret,
  userIdentity: BitbucketUserIdentity,
): Promise<void> {
  const mergedResult = await fetchBitbucketRecentlyMergedPullRequests(
    hostedRepo,
    connection,
    userIdentity,
  );
  cacheInboxSnapshot(repoPath, "merged", mergedResult.prs, mergedResult.isPartial);
}

async function refreshBitbucketInbox(
  repoPath: string,
  hostedRepo: HostedRepoRef,
  connection: ProviderConnectionSecret,
  userIdentity: BitbucketUserIdentity,
): Promise<void> {
  const openResult = await fetchBitbucketInboxPullRequests(hostedRepo, connection, userIdentity);
  cacheInboxSnapshot(repoPath, "open", openResult.prs, openResult.isPartial);
  await fetchAndCacheMerged(repoPath, hostedRepo, connection, userIdentity);
}

export async function getInboxPullRequests(repoPath: string): Promise<InboxPullRequestsResult> {
  const hostedRepo = await resolveHostedRepo(repoPath);
  if (!hostedRepo) {
    return emptyResult();
  }

  if (hostedRepo.providerId !== "bitbucket") {
    throw new Error(
      `${providerDisplayName(hostedRepo.providerId)} inbox pull requests are not supported yet.`,
    );
  }

  const connection = await getProviderConnection(hostedRepo.providerId);
  if (!connection) {
    throw new Error(missingConnectionMessage(hostedRepo.providerId));
  }

  const userIdentity = await getOrResolveUserIdentity(hostedRepo.providerId, connection);
  if ((!userIdentity?.accountId && !userIdentity?.uuid) || !userIdentity.login) {
    return emptyResult();
  }

  const bitbucketUserIdentity: BitbucketUserIdentity = {
    accountId: userIdentity.accountId,
    uuid: userIdentity.uuid,
  };

  const cachedOpenSnapshot = getCachedInboxSnapshot(repoPath, "open");
  if (cachedOpenSnapshot) {
    const stale = isCacheStale(cachedOpenSnapshot.fetchedAt, OPEN_CACHE_TTL_MS);
    if (stale) {
      setTimeout(() => {
        void refreshBitbucketInbox(repoPath, hostedRepo, connection, bitbucketUserIdentity).catch(
          () => undefined,
        );
      }, 0);
    }

    return {
      sections: toResultSections(
        classifyPullRequests(
          dedupePullRequests([
            ...cachedOpenSnapshot.prs,
            ...(getCachedInboxSnapshot(repoPath, "merged")?.prs ?? []),
          ]),
          bitbucketUserIdentity,
        ),
      ),
      userLogin: userIdentity.login,
      fetchedAt: cachedOpenSnapshot.fetchedAt,
      isStale: stale,
    };
  }

  const openResult = await fetchBitbucketInboxPullRequests(
    hostedRepo,
    connection,
    bitbucketUserIdentity,
  );
  cacheInboxSnapshot(repoPath, "open", openResult.prs, openResult.isPartial);

  void fetchAndCacheMerged(repoPath, hostedRepo, connection, bitbucketUserIdentity).catch(
    () => undefined,
  );

  return {
    sections: toResultSections(classifyPullRequests(openResult.prs, bitbucketUserIdentity)),
    userLogin: userIdentity.login,
    fetchedAt: Date.now(),
    isStale: false,
  };
}

export async function refreshInboxPullRequests(repoPath: string): Promise<InboxPullRequestsResult> {
  clearInboxCache(repoPath);
  return getInboxPullRequests(repoPath);
}
