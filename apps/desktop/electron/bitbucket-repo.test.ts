import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import {
  BitbucketRateLimitError,
  bitbucketRequest,
  isBitbucketRateLimitError,
} from "./bitbucket-repo";

const connection = {
  authType: "basic" as const,
  identifier: "reviewer@example.com",
  token: "secret-token",
};

describe("bitbucketRequest", () => {
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

  it("throws typed rate-limit errors with retry-after seconds", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: { message: "Rate limit for this resource has been exceeded" } }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": "120",
          },
        },
      ),
    );

    await expect(
      bitbucketRequest("/repositories/workspace/repo", connection),
    ).rejects.toMatchObject({
      name: "BitbucketRateLimitError",
      message: "Rate limit for this resource has been exceeded. Try again in 2m.",
      retryAfterMs: 120_000,
      retryAt: Date.now() + 120_000,
      status: 429,
    });
  });

  it("detects typed rate-limit errors in-process", async () => {
    fetchMock.mockResolvedValueOnce(new Response("rate limited", { status: 429 }));

    try {
      await bitbucketRequest("/repositories/workspace/repo", connection);
      throw new Error("Expected request to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(BitbucketRateLimitError);
      expect(isBitbucketRateLimitError(error)).toBe(true);
    }
  });

  it("keeps non-rate-limit failures as normal errors", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: "server failed" } }), { status: 500 }),
    );

    await expect(bitbucketRequest("/repositories/workspace/repo", connection)).rejects.toThrow(
      "server failed",
    );
  });
});
