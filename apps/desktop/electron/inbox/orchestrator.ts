import type {
  HostedRepoRef,
  InboxBackgroundWorkMetadata,
  InboxCacheScopeMetadata,
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
  getCachedInboxSnapshot,
  isCacheStale,
  MERGED_CACHE_TTL_MS,
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

function emptyCacheScope(): InboxCacheScopeMetadata {
  return {
    source: "empty",
    fetchedAt: null,
    isStale: false,
    isPartial: false,
  };
}

function emptyBackgroundWork(): InboxBackgroundWorkMetadata {
  return {
    openRefresh: false,
    mergedRefresh: false,
  };
}

function emptyResult(fetchedAt = Date.now()): InboxPullRequestsResult {
  return {
    sections: emptySections(),
    userLogin: null,
    fetchedAt,
    isStale: false,
    cache: {
      open: emptyCacheScope(),
      merged: emptyCacheScope(),
    },
    background: emptyBackgroundWork(),
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

type BitbucketInboxContext = {
  hostedRepo: HostedRepoRef;
  connection: ProviderConnectionSecret;
  userLogin: string;
  userIdentity: BitbucketUserIdentity;
};

type CachedInboxScope = NonNullable<ReturnType<typeof getCachedInboxSnapshot>>;

type LiveInboxScope = {
  prs: InboxPullRequest[];
  fetchedAt: number;
  isPartial: boolean;
};

type BackgroundWorkScope = "inbox-refresh" | "merged-refresh";

const backgroundWorkKeys = new Set<string>();

function backgroundWorkKey(repoPath: string, scope: BackgroundWorkScope) {
  return `${repoPath}:${scope}`;
}

function currentBackgroundWork(repoPath: string): InboxBackgroundWorkMetadata {
  const inboxRefreshActive = backgroundWorkKeys.has(backgroundWorkKey(repoPath, "inbox-refresh"));
  return {
    openRefresh: inboxRefreshActive,
    mergedRefresh:
      inboxRefreshActive || backgroundWorkKeys.has(backgroundWorkKey(repoPath, "merged-refresh")),
  };
}

function startBackgroundWork(
  repoPath: string,
  scope: BackgroundWorkScope,
  work: () => Promise<void>,
  options: { defer?: boolean } = {},
): boolean {
  const key = backgroundWorkKey(repoPath, scope);
  if (backgroundWorkKeys.has(key)) {
    return false;
  }

  backgroundWorkKeys.add(key);
  const run = () => {
    void work()
      .catch((error) => {
        console.warn(`[inbox] Background ${scope} failed`, error);
      })
      .finally(() => {
        backgroundWorkKeys.delete(key);
      });
  };

  if (options.defer) {
    setTimeout(run, 0);
  } else {
    run();
  }

  return true;
}

function cachedScopeMetadata(snapshot: CachedInboxScope, ttlMs: number): InboxCacheScopeMetadata {
  return {
    source: "cache",
    fetchedAt: snapshot.fetchedAt,
    isStale: isCacheStale(snapshot.fetchedAt, ttlMs),
    isPartial: snapshot.isPartial,
  };
}

function liveScopeMetadata(scope: LiveInboxScope): InboxCacheScopeMetadata {
  return {
    source: "live",
    fetchedAt: scope.fetchedAt,
    isStale: false,
    isPartial: scope.isPartial,
  };
}

async function resolveBitbucketInboxContext(
  repoPath: string,
): Promise<BitbucketInboxContext | null> {
  const hostedRepo = await resolveHostedRepo(repoPath);
  if (!hostedRepo) {
    return null;
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
    return null;
  }

  return {
    hostedRepo,
    connection,
    userLogin: userIdentity.login,
    userIdentity: {
      accountId: userIdentity.accountId,
      uuid: userIdentity.uuid,
    },
  };
}

async function fetchAndCacheOpen(
  repoPath: string,
  hostedRepo: HostedRepoRef,
  connection: ProviderConnectionSecret,
  userIdentity: BitbucketUserIdentity,
): Promise<LiveInboxScope> {
  const openResult = await fetchBitbucketInboxPullRequests(hostedRepo, connection, userIdentity);
  const fetchedAt = cacheInboxSnapshot(repoPath, "open", openResult.prs, openResult.isPartial);
  return {
    prs: openResult.prs,
    fetchedAt,
    isPartial: openResult.isPartial,
  };
}

async function fetchAndCacheMerged(
  repoPath: string,
  hostedRepo: HostedRepoRef,
  connection: ProviderConnectionSecret,
  userIdentity: BitbucketUserIdentity,
): Promise<LiveInboxScope> {
  const mergedResult = await fetchBitbucketRecentlyMergedPullRequests(
    hostedRepo,
    connection,
    userIdentity,
  );
  const fetchedAt = cacheInboxSnapshot(
    repoPath,
    "merged",
    mergedResult.prs,
    mergedResult.isPartial,
  );
  return {
    prs: mergedResult.prs,
    fetchedAt,
    isPartial: mergedResult.isPartial,
  };
}

async function refreshBitbucketInbox(
  repoPath: string,
  hostedRepo: HostedRepoRef,
  connection: ProviderConnectionSecret,
  userIdentity: BitbucketUserIdentity,
): Promise<{ open: LiveInboxScope; merged: LiveInboxScope }> {
  const open = await fetchAndCacheOpen(repoPath, hostedRepo, connection, userIdentity);
  const merged = await fetchAndCacheMerged(repoPath, hostedRepo, connection, userIdentity);
  return { open, merged };
}

function buildResult(args: {
  pullRequests: InboxPullRequest[];
  userLogin: string;
  fetchedAt: number;
  openCache: InboxCacheScopeMetadata;
  mergedCache: InboxCacheScopeMetadata;
  background: InboxBackgroundWorkMetadata;
  userIdentity: BitbucketUserIdentity;
}): InboxPullRequestsResult {
  return {
    sections: toResultSections(
      classifyPullRequests(dedupePullRequests(args.pullRequests), args.userIdentity),
    ),
    userLogin: args.userLogin,
    fetchedAt: args.fetchedAt,
    isStale: args.openCache.isStale || args.mergedCache.isStale,
    cache: {
      open: args.openCache,
      merged: args.mergedCache,
    },
    background: args.background,
  };
}

export async function getInboxPullRequests(repoPath: string): Promise<InboxPullRequestsResult> {
  const context = await resolveBitbucketInboxContext(repoPath);
  if (!context) {
    return emptyResult();
  }

  const { hostedRepo, connection, userIdentity, userLogin } = context;
  const cachedOpenSnapshot = getCachedInboxSnapshot(repoPath, "open");
  if (cachedOpenSnapshot) {
    const cachedMergedSnapshot = getCachedInboxSnapshot(repoPath, "merged");
    const openCache = cachedScopeMetadata(cachedOpenSnapshot, OPEN_CACHE_TTL_MS);
    const mergedCache = cachedMergedSnapshot
      ? cachedScopeMetadata(cachedMergedSnapshot, MERGED_CACHE_TTL_MS)
      : emptyCacheScope();

    if (openCache.isStale) {
      startBackgroundWork(
        repoPath,
        "inbox-refresh",
        () =>
          refreshBitbucketInbox(repoPath, hostedRepo, connection, userIdentity).then(
            () => undefined,
          ),
        { defer: true },
      );
    } else if (!cachedMergedSnapshot || mergedCache.isStale) {
      startBackgroundWork(repoPath, "merged-refresh", () =>
        fetchAndCacheMerged(repoPath, hostedRepo, connection, userIdentity).then(() => undefined),
      );
    }

    return buildResult({
      pullRequests: [...cachedOpenSnapshot.prs, ...(cachedMergedSnapshot?.prs ?? [])],
      userLogin,
      fetchedAt: cachedOpenSnapshot.fetchedAt,
      openCache,
      mergedCache,
      background: currentBackgroundWork(repoPath),
      userIdentity,
    });
  }

  const open = await fetchAndCacheOpen(repoPath, hostedRepo, connection, userIdentity);
  startBackgroundWork(repoPath, "merged-refresh", () =>
    fetchAndCacheMerged(repoPath, hostedRepo, connection, userIdentity).then(() => undefined),
  );

  return buildResult({
    pullRequests: open.prs,
    userLogin,
    fetchedAt: open.fetchedAt,
    openCache: liveScopeMetadata(open),
    mergedCache: emptyCacheScope(),
    background: currentBackgroundWork(repoPath),
    userIdentity,
  });
}

export async function refreshInboxPullRequests(repoPath: string): Promise<InboxPullRequestsResult> {
  const context = await resolveBitbucketInboxContext(repoPath);
  if (!context) {
    return emptyResult();
  }

  const { hostedRepo, connection, userIdentity, userLogin } = context;
  const { open, merged } = await refreshBitbucketInbox(
    repoPath,
    hostedRepo,
    connection,
    userIdentity,
  );

  return buildResult({
    pullRequests: [...open.prs, ...merged.prs],
    userLogin,
    fetchedAt: open.fetchedAt,
    openCache: liveScopeMetadata(open),
    mergedCache: liveScopeMetadata(merged),
    background: currentBackgroundWork(repoPath),
    userIdentity,
  });
}
