import { rmSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { InboxSection } from "./types";

let userDataPath = "";

vi.mock("electron", () => ({
  app: {
    getPath: vi.fn(() => userDataPath),
  },
}));

function createPullRequest(index: number) {
  return {
    id: `bitbucket:${String(index)}`,
    providerId: "bitbucket" as const,
    number: index,
    title: `PR ${String(index)}`,
    state: "open" as const,
    isDraft: index % 5 === 0,
    authorLogin: `author-${String(index)}`,
    authorDisplayName: `Author ${String(index)}`,
    authorUuid: `{author-${String(index)}}`,
    authorAccountId: `account-${String(index)}`,
    url: `https://bitbucket.example.com/pr/${String(index)}`,
    baseRef: "main",
    headRef: `feature/${String(index)}`,
    headOwner: "workspace",
    headRepo: "repo",
    updatedAt: `2026-04-27T12:${String(index % 60).padStart(2, "0")}:00.000Z`,
    participants: [
      {
        login: `participant-${String(index)}`,
        displayName: `Participant ${String(index)}`,
        avatarUrl: null,
        uuid: `{participant-${String(index)}}`,
        accountId: `participant-account-${String(index)}`,
        role: "PARTICIPANT" as const,
        approved: false,
        state: null,
      },
    ],
    reviewers: [
      {
        login: `reviewer-${String(index)}`,
        displayName: `Reviewer ${String(index)}`,
        avatarUrl: null,
        uuid: `{reviewer-${String(index)}}`,
        accountId: `reviewer-account-${String(index)}`,
        role: "REVIEWER" as const,
        approved: index % 2 === 0,
        state: index % 2 === 0 ? "approved" : null,
      },
    ],
    section: InboxSection.NEEDS_REVIEW,
  };
}

describe("electron inbox PR cache", () => {
  beforeEach(async () => {
    userDataPath = await mkdtemp(path.join(os.tmpdir(), "open-warden-pr-cache-"));
    vi.resetModules();
  });

  afterEach(async () => {
    try {
      const { closeDb } = await import("./cache");
      closeDb();
    } catch {
      // Ignore module load failures during RED TDD runs.
    }

    if (userDataPath) {
      rmSync(userDataPath, { recursive: true, force: true });
    }
  });

  it("keeps open and merged snapshots independent per repo", async () => {
    const { cacheInboxSnapshot, getCachedInboxSnapshot } = await import("./pr-cache");

    const openPr = createPullRequest(101);
    const mergedPr = { ...createPullRequest(202), state: "merged" as const, section: InboxSection.MERGING_AND_MERGED };

    cacheInboxSnapshot("/tmp/repo", "open", [openPr], false);
    cacheInboxSnapshot("/tmp/repo", "merged", [mergedPr], true);

    expect(getCachedInboxSnapshot("/tmp/repo", "open")).toMatchObject({
      prs: [openPr],
      isPartial: false,
      fetchedAt: expect.any(Number),
    });
    expect(getCachedInboxSnapshot("/tmp/repo", "merged")).toMatchObject({
      prs: [mergedPr],
      isPartial: true,
      fetchedAt: expect.any(Number),
    });
  });

  it("returns null for a cold cache lookup", async () => {
    const { getCachedInboxSnapshot } = await import("./pr-cache");

    expect(getCachedInboxSnapshot("/tmp/missing", "open")).toBeNull();
  });

  it("treats cache entries as stale only after the ttl is exceeded", async () => {
    const { isCacheStale } = await import("./pr-cache");

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-27T12:00:00.000Z"));

    const now = Date.now();

    expect(isCacheStale(null, 120_000)).toBe(true);
    expect(isCacheStale(now - 120_000, 120_000)).toBe(false);
    expect(isCacheStale(now - 120_001, 120_000)).toBe(true);

    vi.useRealTimers();
  });

  it("writes snapshots atomically with a single row per repo and scope", async () => {
    const { getDb } = await import("./cache");
    const { cacheInboxSnapshot, getCachedInboxSnapshot } = await import("./pr-cache");

    cacheInboxSnapshot("/tmp/repo", "open", [createPullRequest(1)], false);
    cacheInboxSnapshot("/tmp/repo", "open", [createPullRequest(2)], true);

    const rowCount = getDb()
      .prepare<{ count: number }, []>(
        "SELECT COUNT(*) AS count FROM inbox_snapshots WHERE repo_path = ? AND scope = ?",
      )
      .get("/tmp/repo", "open");

    expect(rowCount).toEqual({ count: 1 });
    expect(getCachedInboxSnapshot("/tmp/repo", "open")).toMatchObject({
      prs: [createPullRequest(2)],
      isPartial: true,
    });
  });

  it("clears all scopes for a single repo path", async () => {
    const { cacheInboxSnapshot, clearInboxCache, getCachedInboxSnapshot } = await import("./pr-cache");

    cacheInboxSnapshot("/tmp/repo-a", "open", [createPullRequest(1)], false);
    cacheInboxSnapshot("/tmp/repo-a", "merged", [createPullRequest(2)], false);
    cacheInboxSnapshot("/tmp/repo-b", "open", [createPullRequest(3)], false);

    clearInboxCache("/tmp/repo-a");

    expect(getCachedInboxSnapshot("/tmp/repo-a", "open")).toBeNull();
    expect(getCachedInboxSnapshot("/tmp/repo-a", "merged")).toBeNull();
    expect(getCachedInboxSnapshot("/tmp/repo-b", "open")).toMatchObject({
      prs: [createPullRequest(3)],
    });
  });

  it("clears all inbox snapshot data globally", async () => {
    const { cacheInboxSnapshot, clearInboxCache, getCachedInboxSnapshot } = await import("./pr-cache");

    cacheInboxSnapshot("/tmp/repo-a", "open", [createPullRequest(1)], false);
    cacheInboxSnapshot("/tmp/repo-b", "merged", [createPullRequest(2)], false);

    clearInboxCache();

    expect(getCachedInboxSnapshot("/tmp/repo-a", "open")).toBeNull();
    expect(getCachedInboxSnapshot("/tmp/repo-b", "merged")).toBeNull();
  });

  it("survives a simulated app restart by reopening the sqlite database", async () => {
    const firstCacheModule = await import("./pr-cache");
    const { closeDb } = await import("./cache");

    firstCacheModule.cacheInboxSnapshot("/tmp/repo", "open", [createPullRequest(7)], false);
    closeDb();

    vi.resetModules();

    const reopenedCacheModule = await import("./pr-cache");
    expect(reopenedCacheModule.getCachedInboxSnapshot("/tmp/repo", "open")).toMatchObject({
      prs: [createPullRequest(7)],
      isPartial: false,
      fetchedAt: expect.any(Number),
    });
  });

  it("reads a 500 pr snapshot quickly enough for inbox reuse", async () => {
    const { cacheInboxSnapshot, getCachedInboxSnapshot } = await import("./pr-cache");

    const prs = Array.from({ length: 500 }, (_, index) => createPullRequest(index + 1));
    cacheInboxSnapshot("/tmp/repo", "open", prs, false);

    const startedAt = performance.now();
    const snapshot = getCachedInboxSnapshot("/tmp/repo", "open");
    const elapsedMs = performance.now() - startedAt;

    expect(snapshot?.prs).toHaveLength(500);
    expect(elapsedMs).toBeLessThan(250);
  });
});
