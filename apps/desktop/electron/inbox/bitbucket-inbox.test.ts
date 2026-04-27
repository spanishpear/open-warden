import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import type { HostedRepoRef } from "../../src/platform/desktop/contracts";
import type { ProviderConnectionSecret } from "../providerConnections";

import {
  fetchBitbucketInboxPullRequests,
  fetchBitbucketRecentlyMergedPullRequests,
} from "./bitbucket-inbox";

const USER_IDENTITY = {
  accountId: "user-account-id",
  uuid: "{user-uuid}",
};

const hostedRepo: HostedRepoRef = {
  providerId: "bitbucket",
  owner: "workspace-slug",
  repo: "repo-slug",
  remoteName: "origin",
  remoteUrl: "git@bitbucket.org:workspace-slug/repo-slug.git",
  webUrl: "https://bitbucket.org/workspace-slug/repo-slug",
};

const connection: ProviderConnectionSecret = {
  id: "bitbucket",
  providerId: "bitbucket",
  method: "pat",
  login: "reviewer",
  displayName: "Reviewer",
  avatarUrl: null,
  scopes: [],
  createdAt: "2026-04-27T00:00:00.000Z",
  updatedAt: "2026-04-27T00:00:00.000Z",
  token: "secret-token",
  authType: "basic",
  identifier: "reviewer@example.com",
};

function createPullRequest(id: number, updatedAt: string) {
  return {
    id,
    title: `PR ${String(id)}`,
    state: "OPEN",
    draft: false,
    created_on: updatedAt,
    updated_on: updatedAt,
    links: {
      html: {
        href: `https://bitbucket.org/workspace-slug/repo-slug/pull-requests/${String(id)}`,
      },
    },
    author: {
      nickname: "author-login",
      display_name: "Author Name",
      uuid: "{author-uuid}",
      account_id: "author-account-id",
      links: {
        avatar: {
          href: "https://avatar.example.com/author.png",
        },
      },
    },
    source: {
      branch: { name: `feature/${String(id)}` },
      commit: { hash: `abc123hash${String(id)}` },
      repository: {
        full_name: "workspace-slug/repo-slug",
        name: "repo-slug",
        workspace: { slug: "workspace-slug" },
      },
    },
    destination: {
      branch: { name: "main" },
    },
    participants: [
      {
        user: {
          nickname: "participant-login",
          display_name: "Participant Name",
          uuid: "{participant-uuid}",
          account_id: "participant-account-id",
          links: {
            avatar: {
              href: "https://avatar.example.com/participant.png",
            },
          },
        },
        role: "PARTICIPANT",
        approved: false,
        state: "changes_requested",
      },
    ],
    reviewers: [
      {
        user: {
          nickname: "reviewer-login",
          display_name: "Reviewer Name",
          uuid: "{reviewer-uuid}",
          account_id: "reviewer-account-id",
          links: {
            avatar: {
              href: "https://avatar.example.com/reviewer.png",
            },
          },
        },
        role: "REVIEWER",
        approved: true,
        state: "approved",
      },
    ],
  };
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("bitbucket inbox queries", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-27T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("fetches open inbox PRs with the filtered query, fields, and mapped participants", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          values: [createPullRequest(101, "2026-04-27T11:59:00.000Z")],
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ values: [] }));

    const result = await fetchBitbucketInboxPullRequests(hostedRepo, connection, USER_IDENTITY);

    expect(result).toEqual({
      prs: [
        {
          id: "bitbucket:101",
          providerId: "bitbucket",
          number: 101,
          title: "PR 101",
          state: "open",
          isDraft: false,
          authorLogin: "author-login",
          authorDisplayName: "Author Name",
          authorUuid: "{author-uuid}",
          authorAccountId: "author-account-id",
          url: "https://bitbucket.org/workspace-slug/repo-slug/pull-requests/101",
          baseRef: "main",
          headRef: "feature/101",
          headOwner: "workspace-slug",
          headRepo: "repo-slug",
          updatedAt: "2026-04-27T11:59:00.000Z",
          commentCount: 0,
          buildStatuses: [],
          section: "NEEDS_REVIEW",
          participants: [
            {
              login: "participant-login",
              displayName: "Participant Name",
              avatarUrl: "https://avatar.example.com/participant.png",
              uuid: "{participant-uuid}",
              accountId: "participant-account-id",
              role: "PARTICIPANT",
              approved: false,
              state: "changes_requested",
            },
          ],
          reviewers: [
            {
              login: "reviewer-login",
              displayName: "Reviewer Name",
              avatarUrl: "https://avatar.example.com/reviewer.png",
              uuid: "{reviewer-uuid}",
              accountId: "reviewer-account-id",
              role: "REVIEWER",
              approved: true,
              state: "approved",
            },
          ],
        },
      ],
      isPartial: false,
      totalFetched: 1,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    const urlStr = url instanceof Request ? url.url : String(url);
    const searchParams = new URL(urlStr).searchParams;

    expect(urlStr).toContain("/repositories/workspace-slug/repo-slug/pullrequests?");
    expect(searchParams.get("pagelen")).toBe("20");
    expect(searchParams.get("sort")).toBe("-updated_on");
    expect(searchParams.get("q")).toBe(
      'state="OPEN" AND (author.account_id="user-account-id" OR reviewers.account_id="user-account-id")',
    );
    expect(searchParams.get("fields")).toBe(
      "+values.participants,+values.participants.user,+values.participants.user.uuid,+values.participants.user.account_id,+values.participants.role,+values.participants.approved,+values.participants.state,+values.reviewers,+values.reviewers.user,+values.reviewers.user.uuid,+values.reviewers.user.account_id,+values.reviewers.role,+values.reviewers.approved,+values.author.uuid,+values.author.account_id,+values.comment_count,+values.source.commit.hash,-values.summary,-values.rendered,-values.description",
    );
    expect(init).toMatchObject({
      method: "GET",
      headers: expect.objectContaining({
        Accept: "application/json",
        Authorization: expect.stringContaining("Basic "),
      }),
    });
  });

  it("fetches recently merged inbox PRs with a seven day updated_on filter", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          values: [createPullRequest(102, "2026-04-26T10:00:00.000Z")],
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ values: [] }));

    const result = await fetchBitbucketRecentlyMergedPullRequests(
      hostedRepo,
      connection,
      USER_IDENTITY,
    );

    expect(result.totalFetched).toBe(1);
    expect(result.isPartial).toBe(false);

    const [url] = fetchMock.mock.calls[0] ?? [];
    const searchParams = new URL(url instanceof Request ? url.url : String(url)).searchParams;
    expect(searchParams.get("q")).toBe(
      'state="MERGED" AND (author.account_id="user-account-id" OR reviewers.account_id="user-account-id") AND updated_on>"2026-04-20T12:00:00.000Z"',
    );
    expect(searchParams.get("fields")).toContain("+values.participants.user.uuid");
  });

  it("maps reviewers from reviewer participants, ignores empty reviewer identities, and deduplicates duplicate PR ids", async () => {
    const duplicatedPullRequest = createPullRequest(104, "2026-04-27T10:30:00.000Z");
    duplicatedPullRequest.participants = [
      {
        user: {
          nickname: "reviewer-login",
          display_name: "Reviewer Name",
          uuid: USER_IDENTITY.uuid,
          account_id: USER_IDENTITY.accountId,
          links: {
            avatar: {
              href: "https://avatar.example.com/reviewer.png",
            },
          },
        },
        role: "REVIEWER",
        approved: false,
        state: "changes_requested",
      },
    ];
    duplicatedPullRequest.reviewers = [
      {
        user: {
          nickname: "reviewer-login",
          display_name: "Reviewer Name",
          uuid: USER_IDENTITY.uuid,
          account_id: USER_IDENTITY.accountId,
          links: {
            avatar: {
              href: "https://avatar.example.com/reviewer.png",
            },
          },
        },
        role: "REVIEWER",
        approved: false,
        state: "approved",
      },
    ];

    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          values: [duplicatedPullRequest, duplicatedPullRequest],
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ values: [] }));

    const result = await fetchBitbucketInboxPullRequests(hostedRepo, connection, USER_IDENTITY);

    expect(result.prs).toHaveLength(1);
    expect(result.prs[0]?.reviewers).toEqual([
      {
        login: "reviewer-login",
        displayName: "Reviewer Name",
        avatarUrl: "https://avatar.example.com/reviewer.png",
        uuid: USER_IDENTITY.uuid,
        accountId: USER_IDENTITY.accountId,
        role: "REVIEWER",
        approved: false,
        state: "approved",
      },
    ]);
  });

  it("falls back to uuid filters when accountId is unavailable", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          values: [createPullRequest(103, "2026-04-27T10:30:00.000Z")],
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ values: [] }));

    await fetchBitbucketInboxPullRequests(hostedRepo, connection, {
      accountId: null,
      uuid: "{user-uuid}",
    });

    const [url] = fetchMock.mock.calls[0] ?? [];
    const searchParams = new URL(url instanceof Request ? url.url : String(url)).searchParams;
    expect(searchParams.get("q")).toBe(
      'state="OPEN" AND (author.uuid="{user-uuid}" OR reviewers.uuid="{user-uuid}")',
    );
  });

  it("follows paginated Bitbucket next links and combines all returned PRs", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          values: [createPullRequest(201, "2026-04-27T11:00:00.000Z")],
          next: "https://api.bitbucket.org/2.0/repositories/workspace-slug/repo-slug/pullrequests?page=2",
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          values: [createPullRequest(202, "2026-04-27T10:00:00.000Z")],
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ values: [] }))
      .mockResolvedValueOnce(jsonResponse({ values: [] }));

    const result = await fetchBitbucketInboxPullRequests(hostedRepo, connection, USER_IDENTITY);

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(result.totalFetched).toBe(2);
    expect(result.isPartial).toBe(false);
    expect(result.prs.map((pr) => pr.number)).toEqual([201, 202]);
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "https://api.bitbucket.org/2.0/repositories/workspace-slug/repo-slug/pullrequests?page=2",
    );
  });

  it("caps inbox fetches at 500 pull requests and marks the result as partial", async () => {
    // Default mock for build status fetches (returns empty statuses)
    fetchMock.mockResolvedValue(jsonResponse({ values: [] }));
    for (let pageIndex = 0; pageIndex < 26; pageIndex += 1) {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          values: Array.from({ length: 20 }, (_, offset) =>
            createPullRequest(
              pageIndex * 20 + offset + 1,
              `2026-04-27T${String(11 - pageIndex).padStart(2, "0")}:00:00.000Z`,
            ),
          ),
          next:
            pageIndex < 25
              ? `https://api.bitbucket.org/2.0/repositories/workspace-slug/repo-slug/pullrequests?page=${String(pageIndex + 2)}`
              : undefined,
        }),
      );
    }

    const result = await fetchBitbucketInboxPullRequests(hostedRepo, connection, USER_IDENTITY);

    expect(fetchMock).toHaveBeenCalledTimes(525);
    expect(result.totalFetched).toBe(500);
    expect(result.prs).toHaveLength(500);
    expect(result.isPartial).toBe(true);
    expect(new Set(result.prs.map((pr) => pr.id)).size).toBe(500);
  });

  it("returns an empty open inbox result when the Bitbucket API request fails", async () => {
    fetchMock.mockResolvedValueOnce(new Response("server error", { status: 500 }));

    await expect(
      fetchBitbucketInboxPullRequests(hostedRepo, connection, USER_IDENTITY),
    ).resolves.toEqual({
      prs: [],
      isPartial: false,
      totalFetched: 0,
    });
  });

  it("returns an empty merged inbox result when a later Bitbucket page fails", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          values: [createPullRequest(301, "2026-04-27T09:00:00.000Z")],
          next: "https://api.bitbucket.org/2.0/repositories/workspace-slug/repo-slug/pullrequests?page=2",
        }),
      )
      .mockResolvedValueOnce(new Response("rate limited", { status: 429 }));

    await expect(
      fetchBitbucketRecentlyMergedPullRequests(hostedRepo, connection, USER_IDENTITY),
    ).resolves.toEqual({
      prs: [],
      isPartial: false,
      totalFetched: 0,
    });
  });

  it("maps comment_count to commentCount on returned PR summary", async () => {
    const pr = createPullRequest(501, "2026-04-27T11:00:00.000Z");
    // oxlint-disable-next-line typescript-eslint(no-unsafe-type-assertion)
    const prWithComments = { ...pr, comment_count: 7 } as unknown as Record<string, unknown>;

    fetchMock
      .mockResolvedValueOnce(jsonResponse({ values: [prWithComments] }))
      .mockResolvedValueOnce(jsonResponse({ values: [] }));

    const result = await fetchBitbucketInboxPullRequests(hostedRepo, connection, USER_IDENTITY);

    expect(result.prs[0]?.commentCount).toBe(7);
  });

  it("defaults commentCount to 0 when comment_count is missing", async () => {
    const pr = createPullRequest(502, "2026-04-27T11:00:00.000Z");

    fetchMock
      .mockResolvedValueOnce(jsonResponse({ values: [pr] }))
      .mockResolvedValueOnce(jsonResponse({ values: [] }));

    const result = await fetchBitbucketInboxPullRequests(hostedRepo, connection, USER_IDENTITY);

    expect(result.prs[0]?.commentCount).toBe(0);
  });

  it("fetches build statuses from commit statuses endpoint and maps state to lowercase", async () => {
    const pr = createPullRequest(503, "2026-04-27T11:00:00.000Z");

    fetchMock.mockResolvedValueOnce(jsonResponse({ values: [pr] })).mockResolvedValueOnce(
      jsonResponse({
        values: [
          {
            state: "SUCCESSFUL",
            name: "build-pipeline",
            url: "https://ci.example.com/1",
            key: "ci-1",
          },
          { state: "FAILED", name: "lint-check", url: "https://ci.example.com/2", key: "ci-2" },
          { state: "INPROGRESS", name: "deploy", url: "https://ci.example.com/3", key: "ci-3" },
          { state: "STOPPED", name: "e2e-tests", url: "https://ci.example.com/4", key: "ci-4" },
        ],
      }),
    );

    const result = await fetchBitbucketInboxPullRequests(hostedRepo, connection, USER_IDENTITY);

    expect(result.prs[0]?.buildStatuses).toEqual([
      { state: "successful", name: "build-pipeline", url: "https://ci.example.com/1", key: "ci-1" },
      { state: "failed", name: "lint-check", url: "https://ci.example.com/2", key: "ci-2" },
      { state: "inprogress", name: "deploy", url: "https://ci.example.com/3", key: "ci-3" },
      { state: "stopped", name: "e2e-tests", url: "https://ci.example.com/4", key: "ci-4" },
    ]);

    const rawStatusUrl = fetchMock.mock.calls[1]?.[0];
    const statusUrl =
      rawStatusUrl instanceof Request ? rawStatusUrl.url : String(rawStatusUrl ?? "");
    expect(statusUrl).toContain(
      "/repositories/workspace-slug/repo-slug/commit/abc123hash503/statuses",
    );
  });

  it("returns empty buildStatuses when status fetch fails (graceful degradation)", async () => {
    const pr = createPullRequest(504, "2026-04-27T11:00:00.000Z");

    fetchMock
      .mockResolvedValueOnce(jsonResponse({ values: [pr] }))
      .mockResolvedValueOnce(new Response("server error", { status: 500 }));

    const result = await fetchBitbucketInboxPullRequests(hostedRepo, connection, USER_IDENTITY);

    expect(result.prs).toHaveLength(1);
    expect(result.prs[0]?.buildStatuses).toEqual([]);
  });

  it("returns empty buildStatuses when source commit hash is missing", async () => {
    const pr = createPullRequest(505, "2026-04-27T11:00:00.000Z");
    const prNoCommit = {
      ...pr,
      source: { ...pr.source, commit: undefined },
    };

    fetchMock.mockResolvedValueOnce(jsonResponse({ values: [prNoCommit] }));

    const result = await fetchBitbucketInboxPullRequests(hostedRepo, connection, USER_IDENTITY);

    expect(result.prs).toHaveLength(1);
    expect(result.prs[0]?.buildStatuses).toEqual([]);
  });
});
