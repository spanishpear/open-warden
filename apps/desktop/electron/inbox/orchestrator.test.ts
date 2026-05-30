import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import type { HostedRepoRef, PullRequestSummary } from "../../src/platform/desktop/contracts";

import { InboxSection, type InboxPullRequest } from "./types";
import type { ProviderConnectionSecret } from "../providerConnections";

vi.mock("../hosted-repos/repository", () => ({
  resolveHostedRepo: vi.fn(),
}));

vi.mock("../providerConnections", () => ({
  getProviderConnection: vi.fn(),
}));

vi.mock("./identity", () => ({
  getOrResolveUserIdentity: vi.fn(),
}));

vi.mock("./pr-cache", () => ({
  OPEN_CACHE_TTL_MS: 120_000,
  MERGED_CACHE_TTL_MS: 600_000,
  getCachedInboxSnapshot: vi.fn(),
  cacheInboxSnapshot: vi.fn(() => Date.now()),
  isCacheStale: vi.fn(),
}));

vi.mock("./bitbucket-inbox", () => ({
  fetchBitbucketInboxPullRequests: vi.fn(),
  fetchBitbucketRecentlyMergedPullRequests: vi.fn(),
}));

vi.mock("./sections", () => ({
  classifyPullRequests: vi.fn(),
}));

const REPO_PATH = "/tmp/repo";
const USER_UUID = "{user-uuid}";
const USER_IDENTITY = {
  accountId: "account-1",
  uuid: USER_UUID,
};
const HOSTED_REPO: HostedRepoRef = {
  providerId: "bitbucket",
  owner: "workspace",
  repo: "repo",
  remoteName: "origin",
  remoteUrl: "git@bitbucket.org:workspace/repo.git",
  webUrl: "https://bitbucket.org/workspace/repo",
};
const CONNECTION: ProviderConnectionSecret = {
  id: "bitbucket",
  providerId: "bitbucket",
  method: "pat",
  login: "alice",
  displayName: "Alice",
  avatarUrl: null,
  scopes: [],
  createdAt: "2026-04-27T00:00:00.000Z",
  updatedAt: "2026-04-27T00:00:00.000Z",
  token: "secret-token",
  authType: "basic",
  identifier: "alice@example.com",
};

function createPullRequest(
  id: string,
  overrides: Partial<InboxPullRequest> = {},
): InboxPullRequest {
  return {
    id,
    providerId: "bitbucket",
    number: Number.parseInt(id.replace(/\D/g, "") || "1", 10),
    title: `PR ${id}`,
    state: "open",
    isDraft: false,
    authorLogin: overrides.authorLogin ?? "author",
    authorDisplayName: overrides.authorDisplayName ?? "Author",
    url: `https://bitbucket.org/workspace/repo/pull-requests/${id}`,
    baseRef: "main",
    headRef: `feature/${id}`,
    headOwner: "workspace",
    headRepo: "repo",
    updatedAt: overrides.updatedAt ?? "2026-04-27T12:00:00.000Z",
    authorUuid: overrides.authorUuid ?? USER_UUID,
    authorAccountId: overrides.authorAccountId ?? "author-account",
    participants: overrides.participants ?? [],
    reviewers: overrides.reviewers ?? [],
    section: overrides.section ?? InboxSection.NEEDS_REVIEW,
    ...overrides,
  };
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

function classifiedSections(
  overrides: Partial<Record<InboxSection, InboxPullRequest[]>> = {},
): Record<InboxSection, InboxPullRequest[]> {
  return {
    [InboxSection.NEEDS_REVIEW]: [],
    [InboxSection.WAITING_FOR_REVIEW]: [],
    [InboxSection.RETURNED_TO_YOU]: [],
    [InboxSection.DRAFTS]: [],
    [InboxSection.APPROVED]: [],
    [InboxSection.MERGING_AND_MERGED]: [],
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("electron inbox orchestrator", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-27T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("fetches open pull requests inline on a cold cache hit and returns fresh data", async () => {
    const { resolveHostedRepo } = await import("../hosted-repos/repository");
    const { getProviderConnection } = await import("../providerConnections");
    const { getOrResolveUserIdentity } = await import("./identity");
    const { getCachedInboxSnapshot, cacheInboxSnapshot } = await import("./pr-cache");
    const { fetchBitbucketInboxPullRequests, fetchBitbucketRecentlyMergedPullRequests } =
      await import("./bitbucket-inbox");
    const { classifyPullRequests } = await import("./sections");
    const { getInboxPullRequests } = await import("./orchestrator");

    const openPr = createPullRequest("101", { authorUuid: "{other-author}" });
    const mergedFetch = deferred<{
      prs: InboxPullRequest[];
      isPartial: boolean;
      totalFetched: number;
    }>();

    vi.mocked(resolveHostedRepo).mockResolvedValue(HOSTED_REPO);
    vi.mocked(getProviderConnection).mockResolvedValue(CONNECTION);
    vi.mocked(getOrResolveUserIdentity).mockResolvedValue({
      providerId: "bitbucket",
      uuid: USER_IDENTITY.uuid,
      accountId: USER_IDENTITY.accountId,
      login: "alice",
      displayName: "Alice",
    });
    vi.mocked(getCachedInboxSnapshot).mockReturnValue(null);
    vi.mocked(fetchBitbucketInboxPullRequests).mockResolvedValue({
      prs: [openPr],
      isPartial: false,
      totalFetched: 1,
    });
    vi.mocked(fetchBitbucketRecentlyMergedPullRequests).mockReturnValue(mergedFetch.promise);
    vi.mocked(classifyPullRequests).mockReturnValue(
      classifiedSections({
        [InboxSection.NEEDS_REVIEW]: [openPr],
      }),
    );

    const result = await getInboxPullRequests(REPO_PATH);

    expect(result).toMatchObject({
      sections: {
        ...emptySections(),
        [InboxSection.NEEDS_REVIEW]: [openPr],
      },
      userLogin: "alice",
      fetchedAt: Date.now(),
      isStale: false,
    });
    expect(fetchBitbucketInboxPullRequests).toHaveBeenCalledWith(
      HOSTED_REPO,
      CONNECTION,
      USER_IDENTITY,
    );
    expect(fetchBitbucketRecentlyMergedPullRequests).toHaveBeenCalledWith(
      HOSTED_REPO,
      CONNECTION,
      USER_IDENTITY,
    );
    expect(classifyPullRequests).toHaveBeenCalledWith([openPr], USER_IDENTITY);
    expect(cacheInboxSnapshot).toHaveBeenCalledWith(REPO_PATH, "open", [openPr], false);

    mergedFetch.resolve({ prs: [], isPartial: false, totalFetched: 0 });
    await Promise.resolve();
  });

  it("does not block the cold-cache response on the merged fetch", async () => {
    const { resolveHostedRepo } = await import("../hosted-repos/repository");
    const { getProviderConnection } = await import("../providerConnections");
    const { getOrResolveUserIdentity } = await import("./identity");
    const { getCachedInboxSnapshot } = await import("./pr-cache");
    const { fetchBitbucketInboxPullRequests, fetchBitbucketRecentlyMergedPullRequests } =
      await import("./bitbucket-inbox");
    const { classifyPullRequests } = await import("./sections");
    const { getInboxPullRequests } = await import("./orchestrator");

    const openPr = createPullRequest("102", { authorUuid: "{other-author}" });
    const mergedFetch = deferred<{
      prs: InboxPullRequest[];
      isPartial: boolean;
      totalFetched: number;
    }>();

    vi.mocked(resolveHostedRepo).mockResolvedValue(HOSTED_REPO);
    vi.mocked(getProviderConnection).mockResolvedValue(CONNECTION);
    vi.mocked(getOrResolveUserIdentity).mockResolvedValue({
      providerId: "bitbucket",
      uuid: USER_IDENTITY.uuid,
      accountId: USER_IDENTITY.accountId,
      login: "alice",
      displayName: "Alice",
    });
    vi.mocked(getCachedInboxSnapshot).mockReturnValue(null);
    vi.mocked(fetchBitbucketInboxPullRequests).mockResolvedValue({
      prs: [openPr],
      isPartial: false,
      totalFetched: 1,
    });
    vi.mocked(fetchBitbucketRecentlyMergedPullRequests).mockReturnValue(mergedFetch.promise);
    vi.mocked(classifyPullRequests).mockReturnValue(classifiedSections());

    const resultPromise = getInboxPullRequests(REPO_PATH);

    await expect(resultPromise).resolves.toMatchObject({
      userLogin: "alice",
      isStale: false,
    });

    mergedFetch.resolve({ prs: [], isPartial: false, totalFetched: 0 });
    await Promise.resolve();
  });

  it("updates the merged cache in the background after a cold-cache fetch", async () => {
    const { resolveHostedRepo } = await import("../hosted-repos/repository");
    const { getProviderConnection } = await import("../providerConnections");
    const { getOrResolveUserIdentity } = await import("./identity");
    const { getCachedInboxSnapshot, cacheInboxSnapshot } = await import("./pr-cache");
    const { fetchBitbucketInboxPullRequests, fetchBitbucketRecentlyMergedPullRequests } =
      await import("./bitbucket-inbox");
    const { classifyPullRequests } = await import("./sections");
    const { getInboxPullRequests } = await import("./orchestrator");

    const openPr = createPullRequest("103", { authorUuid: "{other-author}" });
    const mergedPr = createPullRequest("104", {
      state: "merged",
      section: InboxSection.MERGING_AND_MERGED,
      authorUuid: "{other-author}",
      updatedAt: "2026-04-27T11:00:00.000Z",
    });
    const mergedFetch = deferred<{
      prs: InboxPullRequest[];
      isPartial: boolean;
      totalFetched: number;
    }>();

    vi.mocked(resolveHostedRepo).mockResolvedValue(HOSTED_REPO);
    vi.mocked(getProviderConnection).mockResolvedValue(CONNECTION);
    vi.mocked(getOrResolveUserIdentity).mockResolvedValue({
      providerId: "bitbucket",
      uuid: USER_IDENTITY.uuid,
      accountId: USER_IDENTITY.accountId,
      login: "alice",
      displayName: "Alice",
    });
    vi.mocked(getCachedInboxSnapshot).mockReturnValue(null);
    vi.mocked(fetchBitbucketInboxPullRequests).mockResolvedValue({
      prs: [openPr],
      isPartial: false,
      totalFetched: 1,
    });
    vi.mocked(fetchBitbucketRecentlyMergedPullRequests).mockReturnValue(mergedFetch.promise);
    vi.mocked(classifyPullRequests).mockReturnValue(classifiedSections());

    await getInboxPullRequests(REPO_PATH);

    mergedFetch.resolve({
      prs: [mergedPr],
      isPartial: true,
      totalFetched: 1,
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(cacheInboxSnapshot).toHaveBeenCalledWith(REPO_PATH, "merged", [mergedPr], true);
  });

  it("returns fresh cached sections immediately and skips all refresh work", async () => {
    const { resolveHostedRepo } = await import("../hosted-repos/repository");
    const { getProviderConnection } = await import("../providerConnections");
    const { getOrResolveUserIdentity } = await import("./identity");
    const { getCachedInboxSnapshot, isCacheStale } = await import("./pr-cache");
    const { fetchBitbucketInboxPullRequests, fetchBitbucketRecentlyMergedPullRequests } =
      await import("./bitbucket-inbox");
    const { classifyPullRequests } = await import("./sections");
    const { getInboxPullRequests } = await import("./orchestrator");

    const openPr = createPullRequest("201", { authorUuid: "{other-author}" });
    const mergedPr = createPullRequest("202", {
      state: "merged",
      section: InboxSection.MERGING_AND_MERGED,
      authorUuid: "{other-author}",
      updatedAt: "2026-04-27T11:30:00.000Z",
    });

    vi.mocked(resolveHostedRepo).mockResolvedValue(HOSTED_REPO);
    vi.mocked(getProviderConnection).mockResolvedValue(CONNECTION);
    vi.mocked(getOrResolveUserIdentity).mockResolvedValue({
      providerId: "bitbucket",
      uuid: USER_IDENTITY.uuid,
      accountId: USER_IDENTITY.accountId,
      login: "alice",
      displayName: "Alice",
    });
    vi.mocked(getCachedInboxSnapshot).mockImplementation((_, scope) => {
      if (scope === "open") {
        return {
          prs: [openPr],
          fetchedAt: 1_714_218_390_000,
          isPartial: false,
        };
      }

      return {
        prs: [mergedPr],
        fetchedAt: 1_714_218_395_000,
        isPartial: false,
      };
    });
    vi.mocked(isCacheStale).mockReturnValue(false);
    vi.mocked(classifyPullRequests).mockReturnValue(
      classifiedSections({
        [InboxSection.NEEDS_REVIEW]: [openPr],
        [InboxSection.MERGING_AND_MERGED]: [mergedPr],
      }),
    );

    const result = await getInboxPullRequests(REPO_PATH);

    expect(result).toMatchObject({
      sections: {
        ...emptySections(),
        [InboxSection.NEEDS_REVIEW]: [openPr],
        [InboxSection.MERGING_AND_MERGED]: [mergedPr],
      },
      userLogin: "alice",
      fetchedAt: 1_714_218_390_000,
      isStale: false,
    });
    expect(classifyPullRequests).toHaveBeenCalledWith([openPr, mergedPr], USER_IDENTITY);
    expect(fetchBitbucketInboxPullRequests).not.toHaveBeenCalled();
    expect(fetchBitbucketRecentlyMergedPullRequests).not.toHaveBeenCalled();
  });

  it("deduplicates the same pull request when it exists in both open and merged cache snapshots", async () => {
    const { resolveHostedRepo } = await import("../hosted-repos/repository");
    const { getProviderConnection } = await import("../providerConnections");
    const { getOrResolveUserIdentity } = await import("./identity");
    const { getCachedInboxSnapshot, isCacheStale } = await import("./pr-cache");
    const { classifyPullRequests } = await import("./sections");
    const { getInboxPullRequests } = await import("./orchestrator");

    const duplicatePr = createPullRequest("777", {
      authorUuid: "{other-author}",
      state: "merged",
      updatedAt: "2026-04-27T11:30:00.000Z",
    });

    vi.mocked(resolveHostedRepo).mockResolvedValue(HOSTED_REPO);
    vi.mocked(getProviderConnection).mockResolvedValue(CONNECTION);
    vi.mocked(getOrResolveUserIdentity).mockResolvedValue({
      providerId: "bitbucket",
      uuid: USER_IDENTITY.uuid,
      accountId: USER_IDENTITY.accountId,
      login: "alice",
      displayName: "Alice",
    });
    vi.mocked(getCachedInboxSnapshot).mockImplementation((_, scope) => {
      if (scope === "open") {
        return {
          prs: [duplicatePr],
          fetchedAt: 1_714_218_390_000,
          isPartial: false,
        };
      }

      return {
        prs: [duplicatePr],
        fetchedAt: 1_714_218_395_000,
        isPartial: false,
      };
    });
    vi.mocked(isCacheStale).mockReturnValue(false);
    vi.mocked(classifyPullRequests).mockReturnValue(classifiedSections());

    await getInboxPullRequests(REPO_PATH);

    expect(classifyPullRequests).toHaveBeenCalledWith([duplicatePr], USER_IDENTITY);
  });

  it("returns stale cached sections immediately and schedules a background refresh", async () => {
    const { resolveHostedRepo } = await import("../hosted-repos/repository");
    const { getProviderConnection } = await import("../providerConnections");
    const { getOrResolveUserIdentity } = await import("./identity");
    const { getCachedInboxSnapshot, isCacheStale } = await import("./pr-cache");
    const { classifyPullRequests } = await import("./sections");
    const { getInboxPullRequests } = await import("./orchestrator");

    const openPr = createPullRequest("301", { authorUuid: "{other-author}" });
    const timerSpy = vi.spyOn(globalThis, "setTimeout");

    vi.mocked(resolveHostedRepo).mockResolvedValue(HOSTED_REPO);
    vi.mocked(getProviderConnection).mockResolvedValue(CONNECTION);
    vi.mocked(getOrResolveUserIdentity).mockResolvedValue({
      providerId: "bitbucket",
      uuid: USER_IDENTITY.uuid,
      accountId: USER_IDENTITY.accountId,
      login: "alice",
      displayName: "Alice",
    });
    vi.mocked(getCachedInboxSnapshot).mockImplementation((_, scope) =>
      scope === "open"
        ? {
            prs: [openPr],
            fetchedAt: 1_714_218_380_000,
            isPartial: false,
          }
        : null,
    );
    vi.mocked(isCacheStale).mockReturnValue(true);
    vi.mocked(classifyPullRequests).mockReturnValue(
      classifiedSections({
        [InboxSection.NEEDS_REVIEW]: [openPr],
      }),
    );

    const result = await getInboxPullRequests(REPO_PATH);

    expect(result).toMatchObject({
      sections: {
        ...emptySections(),
        [InboxSection.NEEDS_REVIEW]: [openPr],
      },
      userLogin: "alice",
      fetchedAt: 1_714_218_380_000,
      isStale: true,
    });
    expect(timerSpy).toHaveBeenCalledWith(expect.any(Function), 0);
  });

  it("refreshes stale cache data sequentially in the background", async () => {
    const { resolveHostedRepo } = await import("../hosted-repos/repository");
    const { getProviderConnection } = await import("../providerConnections");
    const { getOrResolveUserIdentity } = await import("./identity");
    const { getCachedInboxSnapshot, cacheInboxSnapshot, isCacheStale } = await import("./pr-cache");
    const { fetchBitbucketInboxPullRequests, fetchBitbucketRecentlyMergedPullRequests } =
      await import("./bitbucket-inbox");
    const { classifyPullRequests } = await import("./sections");
    const { getInboxPullRequests } = await import("./orchestrator");

    const staleOpenPr = createPullRequest("401", { authorUuid: "{other-author}" });
    const freshOpenPr = createPullRequest("402", { authorUuid: "{other-author}" });
    const freshMergedPr = createPullRequest("403", {
      state: "merged",
      section: InboxSection.MERGING_AND_MERGED,
      authorUuid: "{other-author}",
      updatedAt: "2026-04-27T11:45:00.000Z",
    });
    const openFetch = deferred<{
      prs: InboxPullRequest[];
      isPartial: boolean;
      totalFetched: number;
    }>();

    vi.mocked(resolveHostedRepo).mockResolvedValue(HOSTED_REPO);
    vi.mocked(getProviderConnection).mockResolvedValue(CONNECTION);
    vi.mocked(getOrResolveUserIdentity).mockResolvedValue({
      providerId: "bitbucket",
      uuid: USER_IDENTITY.uuid,
      accountId: USER_IDENTITY.accountId,
      login: "alice",
      displayName: "Alice",
    });
    vi.mocked(getCachedInboxSnapshot).mockImplementation((_, scope) =>
      scope === "open"
        ? {
            prs: [staleOpenPr],
            fetchedAt: 1_714_218_370_000,
            isPartial: false,
          }
        : null,
    );
    vi.mocked(isCacheStale).mockReturnValue(true);
    vi.mocked(classifyPullRequests).mockReturnValue(classifiedSections());
    vi.mocked(fetchBitbucketInboxPullRequests).mockReturnValue(openFetch.promise);
    vi.mocked(fetchBitbucketRecentlyMergedPullRequests).mockResolvedValue({
      prs: [freshMergedPr],
      isPartial: true,
      totalFetched: 1,
    });

    await getInboxPullRequests(REPO_PATH);
    await vi.runOnlyPendingTimersAsync();

    expect(fetchBitbucketInboxPullRequests).toHaveBeenCalledTimes(1);
    expect(fetchBitbucketRecentlyMergedPullRequests).not.toHaveBeenCalled();

    openFetch.resolve({
      prs: [freshOpenPr],
      isPartial: false,
      totalFetched: 1,
    });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(fetchBitbucketRecentlyMergedPullRequests).toHaveBeenCalledWith(
      HOSTED_REPO,
      CONNECTION,
      USER_IDENTITY,
    );
    expect(cacheInboxSnapshot).toHaveBeenCalledWith(REPO_PATH, "open", [freshOpenPr], false);
    expect(cacheInboxSnapshot).toHaveBeenCalledWith(REPO_PATH, "merged", [freshMergedPr], true);
  });

  it("returns empty sections when identity resolution fails", async () => {
    const { resolveHostedRepo } = await import("../hosted-repos/repository");
    const { getProviderConnection } = await import("../providerConnections");
    const { getOrResolveUserIdentity } = await import("./identity");
    const { getInboxPullRequests } = await import("./orchestrator");
    const { fetchBitbucketInboxPullRequests } = await import("./bitbucket-inbox");

    vi.mocked(resolveHostedRepo).mockResolvedValue(HOSTED_REPO);
    vi.mocked(getProviderConnection).mockResolvedValue(CONNECTION);
    vi.mocked(getOrResolveUserIdentity).mockResolvedValue(null);

    await expect(getInboxPullRequests(REPO_PATH)).resolves.toMatchObject({
      sections: emptySections(),
      userLogin: null,
      fetchedAt: Date.now(),
      isStale: false,
    });
    expect(fetchBitbucketInboxPullRequests).not.toHaveBeenCalled();
  });

  it("dispatches through the bitbucket provider path for bitbucket repos", async () => {
    const { resolveHostedRepo } = await import("../hosted-repos/repository");
    const { getProviderConnection } = await import("../providerConnections");
    const { getOrResolveUserIdentity } = await import("./identity");
    const { getCachedInboxSnapshot } = await import("./pr-cache");
    const { fetchBitbucketInboxPullRequests } = await import("./bitbucket-inbox");
    const { classifyPullRequests } = await import("./sections");
    const { getInboxPullRequests } = await import("./orchestrator");

    const openPr = createPullRequest("501", { authorUuid: "{other-author}" });

    vi.mocked(resolveHostedRepo).mockResolvedValue(HOSTED_REPO);
    vi.mocked(getProviderConnection).mockResolvedValue(CONNECTION);
    vi.mocked(getOrResolveUserIdentity).mockResolvedValue({
      providerId: "bitbucket",
      uuid: null,
      accountId: USER_IDENTITY.accountId,
      login: "alice",
      displayName: "Alice",
    });
    vi.mocked(getCachedInboxSnapshot).mockReturnValue(null);
    vi.mocked(fetchBitbucketInboxPullRequests).mockResolvedValue({
      prs: [openPr],
      isPartial: false,
      totalFetched: 1,
    });
    vi.mocked(classifyPullRequests).mockReturnValue(classifiedSections());

    await getInboxPullRequests(REPO_PATH);

    expect(fetchBitbucketInboxPullRequests).toHaveBeenCalledTimes(1);
    expect(fetchBitbucketInboxPullRequests).toHaveBeenCalledWith(HOSTED_REPO, CONNECTION, {
      accountId: USER_IDENTITY.accountId,
      uuid: null,
    });
  });

  it("throws for hosted providers whose inbox implementation is not supported", async () => {
    const { resolveHostedRepo } = await import("../hosted-repos/repository");
    const { getProviderConnection } = await import("../providerConnections");
    const { getOrResolveUserIdentity } = await import("./identity");
    const { getInboxPullRequests } = await import("./orchestrator");

    vi.mocked(resolveHostedRepo).mockResolvedValue({
      ...HOSTED_REPO,
      providerId: "github",
      remoteUrl: "git@github.com:workspace/repo.git",
      webUrl: "https://github.com/workspace/repo",
    });
    vi.mocked(getProviderConnection).mockResolvedValue({
      ...CONNECTION,
      id: "github",
      providerId: "github",
      authType: "bearer",
      identifier: null,
    });

    await expect(getInboxPullRequests(REPO_PATH)).rejects.toThrow(
      "GitHub inbox pull requests are not supported yet.",
    );
    expect(getOrResolveUserIdentity).not.toHaveBeenCalled();
  });

  it("returns an empty inbox when the repo is not hosted", async () => {
    const { resolveHostedRepo } = await import("../hosted-repos/repository");
    const { getProviderConnection } = await import("../providerConnections");
    const { getInboxPullRequests } = await import("./orchestrator");

    vi.mocked(resolveHostedRepo).mockResolvedValue(null);

    await expect(getInboxPullRequests(REPO_PATH)).resolves.toMatchObject({
      sections: emptySections(),
      userLogin: null,
      fetchedAt: Date.now(),
      isStale: false,
    });
    expect(getProviderConnection).not.toHaveBeenCalled();
  });
});
