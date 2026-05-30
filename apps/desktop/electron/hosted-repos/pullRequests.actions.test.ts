import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import type { HostedRepoRef } from "../../src/platform/desktop/contracts";

vi.mock("electron", () => ({
  app: {
    getPath: vi.fn(() => "/tmp/open-warden-test"),
  },
}));

vi.mock("../providerConnections", () => ({
  getProviderConnection: vi.fn(),
}));

vi.mock("./repository", () => ({
  resolveHostedRepo: vi.fn(),
}));

import { getProviderConnection } from "../providerConnections";
import { resolveHostedRepo } from "./repository";
import {
  getPullRequestBuildStatuses,
  likePullRequestComment,
  mergePullRequest,
} from "./pullRequests";

const hostedRepo: HostedRepoRef = {
  providerId: "bitbucket",
  owner: "workspace-slug",
  repo: "repo-slug",
  remoteName: "origin",
  remoteUrl: "git@bitbucket.org:workspace-slug/repo-slug.git",
  webUrl: "https://bitbucket.org/workspace-slug/repo-slug",
};

const connection = {
  id: "bitbucket",
  providerId: "bitbucket" as const,
  method: "pat" as const,
  login: "reviewer",
  displayName: "Reviewer",
  avatarUrl: null,
  scopes: [],
  createdAt: "2026-04-27T00:00:00.000Z",
  updatedAt: "2026-04-27T00:00:00.000Z",
  token: "secret-token",
  authType: "basic" as const,
  identifier: "reviewer@example.com",
};

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function textResponse(body = "") {
  return new Response(body, { status: 200, headers: { "Content-Type": "text/plain" } });
}

function requestUrl(call: [URL | RequestInfo, RequestInit?] | undefined): string {
  const target = call?.[0];
  if (target instanceof Request) {
    return target.url;
  }
  if (target instanceof URL) {
    return target.href;
  }
  return typeof target === "string" ? target : "";
}

function requestBody(call: [URL | RequestInfo, RequestInit?] | undefined): unknown {
  const body = call?.[1]?.body;
  return typeof body === "string" ? JSON.parse(body) : undefined;
}

const resolveHostedRepoMock = vi.mocked(resolveHostedRepo);
const getProviderConnectionMock = vi.mocked(getProviderConnection);

describe("pull request electron methods (bitbucket)", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    resolveHostedRepoMock.mockResolvedValue(hostedRepo);
    // oxlint-disable-next-line typescript-eslint(no-unsafe-type-assertion)
    getProviderConnectionMock.mockResolvedValue(connection as never);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
    resolveHostedRepoMock.mockReset();
    getProviderConnectionMock.mockReset();
  });

  describe("getPullRequestBuildStatuses", () => {
    it("maps commit statuses for the PR head commit", async () => {
      fetchMock
        .mockResolvedValueOnce(
          jsonResponse({ id: 7, source: { commit: { hash: "headsha7" } } }),
        )
        .mockResolvedValueOnce(
          jsonResponse({
            values: [
              {
                state: "SUCCESSFUL",
                key: "PIPE-1",
                name: "build",
                url: "https://ci.example.com/1",
                description: "Unit tests",
              },
              { state: "FAILED", key: "PIPE-2", name: "lint", url: "https://ci.example.com/2" },
            ],
          }),
        );

      const result = await getPullRequestBuildStatuses({
        repoPath: "/repo",
        pullRequestNumber: 7,
      });

      expect(result).toEqual([
        {
          state: "successful",
          key: "PIPE-1",
          name: "build",
          url: "https://ci.example.com/1",
          description: "Unit tests",
        },
        {
          state: "failed",
          key: "PIPE-2",
          name: "lint",
          url: "https://ci.example.com/2",
        },
      ]);

      expect(requestUrl(fetchMock.mock.calls[1])).toContain(
        "/repositories/workspace-slug/repo-slug/commit/headsha7/statuses",
      );
    });

    it("returns an empty list when the head commit hash is missing", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ id: 8, source: {} }));

      const result = await getPullRequestBuildStatuses({
        repoPath: "/repo",
        pullRequestNumber: 8,
      });

      expect(result).toEqual([]);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("likePullRequestComment", () => {
    it("PUTs a like and reads back the like count", async () => {
      fetchMock
        .mockResolvedValueOnce(textResponse(""))
        .mockResolvedValueOnce(jsonResponse({ size: 3, values: [] }));

      const result = await likePullRequestComment({
        repoPath: "/repo",
        pullRequestNumber: 12,
        commentId: 99,
        liked: true,
      });

      expect(result).toEqual({ commentId: 99, liked: true, likeCount: 3 });

      expect(requestUrl(fetchMock.mock.calls[0])).toContain(
        "/repositories/workspace-slug/repo-slug/pullrequests/12/comments/99/likes",
      );
      expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "PUT" });
    });

    it("DELETEs the like when unliking", async () => {
      fetchMock
        .mockResolvedValueOnce(textResponse(""))
        .mockResolvedValueOnce(jsonResponse({ size: 0, values: [] }));

      const result = await likePullRequestComment({
        repoPath: "/repo",
        pullRequestNumber: 12,
        commentId: 99,
        liked: false,
      });

      expect(result).toEqual({ commentId: 99, liked: false, likeCount: 0 });
      expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "DELETE" });
    });

    it("falls back to an optimistic count when the like list cannot be read", async () => {
      fetchMock
        .mockResolvedValueOnce(textResponse(""))
        .mockResolvedValueOnce(new Response("nope", { status: 404 }));

      const result = await likePullRequestComment({
        repoPath: "/repo",
        pullRequestNumber: 12,
        commentId: 99,
        liked: true,
      });

      expect(result).toEqual({ commentId: 99, liked: true, likeCount: 1 });
    });
  });

  describe("mergePullRequest", () => {
    it("POSTs the merge with strategy and close source branch", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          id: 12,
          state: "MERGED",
          links: { html: { href: "https://bitbucket.org/workspace-slug/repo-slug/pull-requests/12" } },
        }),
      );

      const result = await mergePullRequest({
        repoPath: "/repo",
        pullRequestNumber: 12,
        mergeStrategy: "squash",
        closeSourceBranch: true,
        message: "Ship it",
      });

      expect(result).toEqual({
        state: "merged",
        url: "https://bitbucket.org/workspace-slug/repo-slug/pull-requests/12",
      });

      expect(requestUrl(fetchMock.mock.calls[0])).toContain(
        "/repositories/workspace-slug/repo-slug/pullrequests/12/merge",
      );
      expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "POST" });
      expect(requestBody(fetchMock.mock.calls[0])).toEqual({
        type: "pullrequest_merge_parameters",
        merge_strategy: "squash",
        close_source_branch: true,
        message: "Ship it",
      });
    });

    it("omits the message when not provided", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ id: 13, state: "MERGED", links: {} }));

      await mergePullRequest({
        repoPath: "/repo",
        pullRequestNumber: 13,
        mergeStrategy: "merge_commit",
        closeSourceBranch: false,
      });

      expect(requestBody(fetchMock.mock.calls[0])).toEqual({
        type: "pullrequest_merge_parameters",
        merge_strategy: "merge_commit",
        close_source_branch: false,
      });
    });

    it("surfaces Bitbucket merge errors", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: "Merge conflict" } }), { status: 409 }),
      );

      await expect(
        mergePullRequest({
          repoPath: "/repo",
          pullRequestNumber: 14,
          mergeStrategy: "merge_commit",
          closeSourceBranch: false,
        }),
      ).rejects.toThrow("Merge conflict");
    });
  });
});
