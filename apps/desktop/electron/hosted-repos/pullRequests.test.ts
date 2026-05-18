import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({
  resolveHostedRepo: vi.fn(),
  getProviderConnection: vi.fn(),
}));

vi.mock("./repository", () => ({
  resolveHostedRepo: mocks.resolveHostedRepo,
}));

vi.mock("../providerConnections", () => ({
  getProviderConnection: mocks.getProviderConnection,
}));

vi.mock("../inbox/content-cache", () => ({
  cacheContent: vi.fn(),
  getCachedContent: vi.fn(() => null),
  prDiffKey: () => "key",
}));

// Import after mocks
import { submitPullRequestReviewComments, submitPullRequestReviewDecision } from "./pullRequests";

type FetchCall = {
  url: string;
  method: string;
  body: string;
};

function urlFromInput(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  if (input instanceof Request) return input.url;
  return "";
}

function bodyAsString(body: BodyInit | null | undefined): string {
  if (body == null) return "";
  if (typeof body === "string") return body;
  return "";
}

function setupFetch(responses: Array<{ status: number; body: unknown }>): FetchCall[] {
  const calls: FetchCall[] = [];
  let index = 0;
  const fetchMock: typeof fetch = async (input, init) => {
    calls.push({
      url: urlFromInput(input),
      method: init?.method ?? "GET",
      body: bodyAsString(init?.body),
    });
    const response = responses[index++] ?? { status: 200, body: {} };
    return new Response(JSON.stringify(response.body), {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    });
  };
  globalThis.fetch = vi.fn(fetchMock);
  return calls;
}

function restoreFetch(): void {
  Reflect.deleteProperty(globalThis, "fetch");
}

const BITBUCKET_REPO = {
  providerId: "bitbucket" as const,
  owner: "octo",
  repo: "demo",
  remoteName: "origin",
  remoteUrl: "https://bitbucket.org/octo/demo.git",
  webUrl: "https://bitbucket.org/octo/demo",
};
const GITHUB_REPO = {
  providerId: "github" as const,
  owner: "octo",
  repo: "demo",
  remoteName: "origin",
  remoteUrl: "https://github.com/octo/demo.git",
  webUrl: "https://github.com/octo/demo",
};
const BITBUCKET_CONNECTION = {
  providerId: "bitbucket" as const,
  authType: "app-password",
  identifier: "user",
  token: "secret",
  scopes: [],
  connectedAt: "2024-01-01",
};
const GITHUB_CONNECTION = {
  providerId: "github" as const,
  authType: "personal-access-token",
  identifier: "user",
  token: "ghp_token",
  scopes: [],
  connectedAt: "2024-01-01",
};

describe("submitPullRequestReviewDecision", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // restore by overwriting with undefined fetch so leaks are obvious
    restoreFetch();
  });

  it("POSTs to Bitbucket approve endpoint for APPROVE", async () => {
    mocks.resolveHostedRepo.mockResolvedValue(BITBUCKET_REPO);
    mocks.getProviderConnection.mockResolvedValue(BITBUCKET_CONNECTION);
    const calls = setupFetch([{ status: 200, body: { approved: true } }]);

    const result = await submitPullRequestReviewDecision({
      repoPath: "/repo/a",
      pullRequestNumber: 7,
      decision: "APPROVE",
    });

    expect(result.decision).toBe("APPROVE");
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toContain("/repositories/octo/demo/pullrequests/7/approve");
    expect(calls[0]?.method).toBe("POST");
  });

  it("POSTs to Bitbucket request-changes endpoint for REQUEST_CHANGES", async () => {
    mocks.resolveHostedRepo.mockResolvedValue(BITBUCKET_REPO);
    mocks.getProviderConnection.mockResolvedValue(BITBUCKET_CONNECTION);
    const calls = setupFetch([{ status: 200, body: { state: "changes_requested" } }]);

    await submitPullRequestReviewDecision({
      repoPath: "/repo/a",
      pullRequestNumber: 7,
      decision: "REQUEST_CHANGES",
    });

    expect(calls[0]?.url).toContain("/repositories/octo/demo/pullrequests/7/request-changes");
    expect(calls[0]?.method).toBe("POST");
  });

  it("DELETEs Bitbucket approve endpoint for UNAPPROVE", async () => {
    mocks.resolveHostedRepo.mockResolvedValue(BITBUCKET_REPO);
    mocks.getProviderConnection.mockResolvedValue(BITBUCKET_CONNECTION);
    const calls = setupFetch([{ status: 200, body: {} }]);

    await submitPullRequestReviewDecision({
      repoPath: "/repo/a",
      pullRequestNumber: 7,
      decision: "UNAPPROVE",
    });

    expect(calls[0]?.url).toContain("/repositories/octo/demo/pullrequests/7/approve");
    expect(calls[0]?.method).toBe("DELETE");
  });

  it("POSTs to GitHub reviews endpoint with APPROVE event", async () => {
    mocks.resolveHostedRepo.mockResolvedValue(GITHUB_REPO);
    mocks.getProviderConnection.mockResolvedValue(GITHUB_CONNECTION);
    const calls = setupFetch([{ status: 200, body: { id: 99 } }]);

    await submitPullRequestReviewDecision({
      repoPath: "/repo/a",
      pullRequestNumber: 7,
      decision: "APPROVE",
      body: "LGTM!",
    });

    expect(calls[0]?.url).toBe("https://api.github.com/repos/octo/demo/pulls/7/reviews");
    expect(calls[0]?.method).toBe("POST");
    const body = JSON.parse(calls[0]?.body || "{}");
    expect(body).toEqual({ event: "APPROVE", body: "LGTM!" });
  });

  it("throws when GitHub UNAPPROVE is requested", async () => {
    mocks.resolveHostedRepo.mockResolvedValue(GITHUB_REPO);
    mocks.getProviderConnection.mockResolvedValue(GITHUB_CONNECTION);
    setupFetch([]);

    await expect(
      submitPullRequestReviewDecision({
        repoPath: "/repo/a",
        pullRequestNumber: 7,
        decision: "UNAPPROVE",
      }),
    ).rejects.toThrow(/GitHub does not support removing a review decision/i);
  });
});

describe("submitPullRequestReviewComments with reviewDecision", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    restoreFetch();
  });

  it("returns early with null decision when no comments and no decision", async () => {
    mocks.resolveHostedRepo.mockResolvedValue(BITBUCKET_REPO);
    mocks.getProviderConnection.mockResolvedValue(BITBUCKET_CONNECTION);

    const result = await submitPullRequestReviewComments({
      repoPath: "/repo/a",
      pullRequestNumber: 7,
      comments: [],
    });

    expect(result).toEqual({
      submittedDraftIds: [],
      failedDraftId: null,
      failedMessage: null,
      reviewDecision: null,
      reviewDecisionError: null,
    });
  });

  it("publishes Bitbucket comments and then applies the review decision", async () => {
    mocks.resolveHostedRepo.mockResolvedValue(BITBUCKET_REPO);
    mocks.getProviderConnection.mockResolvedValue(BITBUCKET_CONNECTION);
    const calls = setupFetch([
      { status: 201, body: { id: 100 } }, // comment POST
      { status: 200, body: { approved: true } }, // approve POST
    ]);

    const result = await submitPullRequestReviewComments({
      repoPath: "/repo/a",
      pullRequestNumber: 7,
      comments: [
        {
          draftId: "d1",
          path: "src/file.ts",
          body: "nit",
          line: 4,
          side: "RIGHT",
          startLine: null,
          startSide: null,
        },
      ],
      reviewDecision: "APPROVE",
    });

    expect(calls).toHaveLength(2);
    expect(calls[0]?.url).toContain("/pullrequests/7/comments");
    expect(calls[1]?.url).toContain("/pullrequests/7/approve");
    expect(result.submittedDraftIds).toEqual(["d1"]);
    expect(result.reviewDecision).toBe("APPROVE");
    expect(result.reviewDecisionError).toBeNull();
  });

  it("captures Bitbucket decision failure without losing comment success", async () => {
    mocks.resolveHostedRepo.mockResolvedValue(BITBUCKET_REPO);
    mocks.getProviderConnection.mockResolvedValue(BITBUCKET_CONNECTION);
    setupFetch([
      { status: 201, body: { id: 100 } }, // comment POST
      { status: 500, body: { error: { message: "approval blew up" } } }, // approve POST fails
    ]);

    const result = await submitPullRequestReviewComments({
      repoPath: "/repo/a",
      pullRequestNumber: 7,
      comments: [
        {
          draftId: "d1",
          path: "src/file.ts",
          body: "nit",
          line: 4,
          side: "RIGHT",
          startLine: null,
          startSide: null,
        },
      ],
      reviewDecision: "REQUEST_CHANGES",
    });

    expect(result.submittedDraftIds).toEqual(["d1"]);
    expect(result.reviewDecision).toBeNull();
    expect(result.reviewDecisionError).toBeTruthy();
  });

  it("submits a single GitHub review with APPROVE event when bundling comments", async () => {
    mocks.resolveHostedRepo.mockResolvedValue(GITHUB_REPO);
    mocks.getProviderConnection.mockResolvedValue(GITHUB_CONNECTION);
    const calls = setupFetch([
      { status: 201, body: { id: 555 } }, // POST /reviews
      { status: 200, body: { id: 555 } }, // POST /reviews/{id}/events
    ]);

    const result = await submitPullRequestReviewComments({
      repoPath: "/repo/a",
      pullRequestNumber: 7,
      comments: [
        {
          draftId: "d1",
          path: "src/file.ts",
          body: "nit",
          line: 4,
          side: "RIGHT",
          startLine: null,
          startSide: null,
        },
      ],
      reviewDecision: "APPROVE",
    });

    expect(calls).toHaveLength(2);
    expect(calls[1]?.url).toContain("/reviews/555/events");
    const eventBody = JSON.parse(calls[1]?.body || "{}");
    expect(eventBody).toEqual({ event: "APPROVE" });
    expect(result.reviewDecision).toBe("APPROVE");
  });

  it("submits a COMMENT-event review when no decision is provided on GitHub", async () => {
    mocks.resolveHostedRepo.mockResolvedValue(GITHUB_REPO);
    mocks.getProviderConnection.mockResolvedValue(GITHUB_CONNECTION);
    const calls = setupFetch([
      { status: 201, body: { id: 777 } },
      { status: 200, body: { id: 777 } },
    ]);

    const result = await submitPullRequestReviewComments({
      repoPath: "/repo/a",
      pullRequestNumber: 7,
      comments: [
        {
          draftId: "d1",
          path: "src/file.ts",
          body: "nit",
          line: 4,
          side: "RIGHT",
          startLine: null,
          startSide: null,
        },
      ],
    });

    const eventBody = JSON.parse(calls[1]?.body || "{}");
    expect(eventBody).toEqual({ event: "COMMENT" });
    expect(result.reviewDecision).toBeNull();
  });

  it("submits a decision-only GitHub review when comments list is empty", async () => {
    mocks.resolveHostedRepo.mockResolvedValue(GITHUB_REPO);
    mocks.getProviderConnection.mockResolvedValue(GITHUB_CONNECTION);
    const calls = setupFetch([{ status: 201, body: { id: 1 } }]);

    const result = await submitPullRequestReviewComments({
      repoPath: "/repo/a",
      pullRequestNumber: 7,
      comments: [],
      reviewDecision: "APPROVE",
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://api.github.com/repos/octo/demo/pulls/7/reviews");
    const body = JSON.parse(calls[0]?.body || "{}");
    expect(body).toEqual({ event: "APPROVE" });
    expect(result.reviewDecision).toBe("APPROVE");
  });
});
