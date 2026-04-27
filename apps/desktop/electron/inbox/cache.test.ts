import { existsSync, rmSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

let userDataPath = "";

vi.mock("electron", () => ({
  app: {
    getPath: vi.fn(() => userDataPath),
  },
}));

describe("electron inbox sqlite cache", () => {
  beforeEach(async () => {
    userDataPath = await mkdtemp(path.join(os.tmpdir(), "open-warden-inbox-cache-"));
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

  it("creates the sqlite database in userData with WAL mode and expected tables", async () => {
    const { getDb } = await import("./cache");

    const db = getDb();
    const dbPath = path.join(userDataPath, "open-warden-cache.db");
    const journalMode = db.pragma("journal_mode", { simple: true });
    const tables = db
      .prepare<{ name: string }, { name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
      )
      .all();

    expect(existsSync(dbPath)).toBe(true);
    expect(journalMode).toBe("wal");
    expect(tables).toEqual([
      { name: "cache_metadata" },
      { name: "inbox_snapshots" },
      { name: "user_identity" },
    ]);
  });

  it("returns a singleton instance until it is closed", async () => {
    const { closeDb, getDb } = await import("./cache");

    const firstDb = getDb();
    const secondDb = getDb();

    expect(secondDb).toBe(firstDb);

    closeDb();

    const reopenedDb = getDb();
    expect(reopenedDb).not.toBe(firstDb);
  });

  it("upserts and reads inbox snapshots by repo path and scope", async () => {
    const { getInboxSnapshot, setInboxSnapshot } = await import("./cache");

    setInboxSnapshot({
      repoPath: "/tmp/repo",
      scope: "open",
      dataJson: '{"items":[1,2]}',
      fetchedAt: 1_717_171_717_000,
      isPartial: true,
    });

    setInboxSnapshot({
      repoPath: "/tmp/repo",
      scope: "open",
      dataJson: '{"items":[3]}',
      fetchedAt: 1_717_171_718_000,
      isPartial: false,
    });

    expect(getInboxSnapshot("/tmp/repo", "open")).toEqual({
      repoPath: "/tmp/repo",
      scope: "open",
      dataJson: '{"items":[3]}',
      fetchedAt: 1_717_171_718_000,
      isPartial: false,
    });
    expect(getInboxSnapshot("/tmp/repo", "merged")).toBeNull();
  });

  it("upserts and reads cache metadata values", async () => {
    const { getCacheMetadata, setCacheMetadata } = await import("./cache");

    setCacheMetadata({
      key: "last-open-sync",
      value: "2026-04-27T04:00:00.000Z",
      updatedAt: 1_717_171_719_000,
    });

    setCacheMetadata({
      key: "last-open-sync",
      value: "2026-04-27T04:05:00.000Z",
      updatedAt: 1_717_171_720_000,
    });

    expect(getCacheMetadata("last-open-sync")).toEqual({
      key: "last-open-sync",
      value: "2026-04-27T04:05:00.000Z",
      updatedAt: 1_717_171_720_000,
    });
    expect(getCacheMetadata("missing")).toBeNull();
  });

  it("upserts and reads cached user identity records", async () => {
    const { getUserIdentity, setUserIdentity } = await import("./cache");

    setUserIdentity({
      providerId: "bitbucket",
      uuid: "{user-1}",
      accountId: "account-1",
      login: "bitbucket-user",
      displayName: "Bitbucket User",
      fetchedAt: 1_717_171_721_000,
    });

    setUserIdentity({
      providerId: "bitbucket",
      uuid: "{user-1}",
      accountId: "account-2",
      login: "updated-user",
      displayName: "Updated User",
      fetchedAt: 1_717_171_722_000,
    });

    expect(getUserIdentity("bitbucket")).toEqual({
      providerId: "bitbucket",
      uuid: "{user-1}",
      accountId: "account-2",
      login: "updated-user",
      displayName: "Updated User",
      fetchedAt: 1_717_171_722_000,
    });
    expect(getUserIdentity("github")).toBeNull();
  });
});
