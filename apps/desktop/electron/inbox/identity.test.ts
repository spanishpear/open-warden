import { rmSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { ProviderConnectionSecret } from "../providerConnections";

let userDataPath = "";

vi.mock("electron", () => ({
  app: {
    getPath: vi.fn(() => userDataPath),
  },
}));

vi.mock("../bitbucket-repo", () => ({
  bitbucketRequest: vi.fn(),
}));

const BITBUCKET_CONNECTION: ProviderConnectionSecret = {
  id: "bitbucket",
  providerId: "bitbucket",
  method: "pat",
  login: "cached-user",
  displayName: "Cached User",
  avatarUrl: null,
  scopes: [],
  createdAt: "2026-04-27T00:00:00.000Z",
  updatedAt: "2026-04-27T00:00:00.000Z",
  token: "secret-token",
  authType: "basic",
  identifier: null,
};

describe("electron inbox identity resolution", () => {
  beforeEach(async () => {
    userDataPath = await mkdtemp(path.join(os.tmpdir(), "open-warden-inbox-identity-"));
    vi.resetModules();
    vi.clearAllMocks();
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

    vi.useRealTimers();
  });

  it("treats missing or expired timestamps as stale", async () => {
    const { isStale } = await import("./identity");

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-27T12:00:00.000Z"));

    expect(isStale(null, 1_000)).toBe(true);
    expect(isStale(Date.now() - 999, 1_000)).toBe(false);
    expect(isStale(Date.now() - 1_001, 1_000)).toBe(true);
  });

  it("reads cached user identity rows from sqlite", async () => {
    const { setUserIdentity } = await import("./cache");
    const { getCachedUserIdentity } = await import("./identity");

    setUserIdentity({
      providerId: "bitbucket",
      uuid: "{cached-uuid}",
      accountId: "account-1",
      login: "cached-user",
      displayName: "Cached User",
      fetchedAt: 1_717_171_721_000,
    });

    expect(getCachedUserIdentity("bitbucket")).toEqual({
      providerId: "bitbucket",
      uuid: "{cached-uuid}",
      accountId: "account-1",
      login: "cached-user",
      displayName: "Cached User",
    });
  });

  it("writes resolved identities to sqlite with the current fetch time", async () => {
    const { getUserIdentity } = await import("./cache");
    const { cacheUserIdentity } = await import("./identity");

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-27T12:00:00.000Z"));

    cacheUserIdentity({
      providerId: "bitbucket",
      uuid: "{cached-uuid}",
      accountId: "account-2",
      login: "resolved-user",
      displayName: "Resolved User",
    });

    expect(getUserIdentity("bitbucket")).toEqual({
      providerId: "bitbucket",
      uuid: "{cached-uuid}",
      accountId: "account-2",
      login: "resolved-user",
      displayName: "Resolved User",
      fetchedAt: Date.now(),
    });
  });

  it("fetches the current Bitbucket user and extracts the shared identity fields", async () => {
    const { bitbucketRequest } = await import("../bitbucket-repo");
    const { resolveUserIdentity } = await import("./identity");

    vi.mocked(bitbucketRequest).mockResolvedValue({
      data: {
        uuid: "{resolved-uuid}",
        account_id: "account-3",
        nickname: "resolved-user",
        display_name: "Resolved User",
      },
      headers: new Headers(),
    });

    await expect(resolveUserIdentity("bitbucket", BITBUCKET_CONNECTION)).resolves.toEqual({
      providerId: "bitbucket",
      uuid: "{resolved-uuid}",
      accountId: "account-3",
      login: "resolved-user",
      displayName: "Resolved User",
    });

    expect(bitbucketRequest).toHaveBeenCalledWith("/user", BITBUCKET_CONNECTION);
  });

  it("returns null when the Bitbucket user fetch fails", async () => {
    const { bitbucketRequest } = await import("../bitbucket-repo");
    const { resolveUserIdentity } = await import("./identity");

    vi.mocked(bitbucketRequest).mockRejectedValue(new Error("boom"));

    await expect(resolveUserIdentity("bitbucket", BITBUCKET_CONNECTION)).resolves.toBeNull();
  });

  it("returns a fresh cached identity without refetching", async () => {
    const { IDENTITY_CACHE_TTL_MS, setUserIdentity } = await import("./cache");
    const { bitbucketRequest } = await import("../bitbucket-repo");
    const { getOrResolveUserIdentity } = await import("./identity");

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-27T12:00:00.000Z"));

    setUserIdentity({
      providerId: "bitbucket",
      uuid: "{fresh-uuid}",
      accountId: "account-4",
      login: "fresh-user",
      displayName: "Fresh User",
      fetchedAt: Date.now() - IDENTITY_CACHE_TTL_MS + 1_000,
    });

    await expect(getOrResolveUserIdentity("bitbucket", BITBUCKET_CONNECTION)).resolves.toEqual({
      providerId: "bitbucket",
      uuid: "{fresh-uuid}",
      accountId: "account-4",
      login: "fresh-user",
      displayName: "Fresh User",
    });

    expect(bitbucketRequest).not.toHaveBeenCalled();
  });

  it("returns stale cached identity immediately and refreshes it in the background", async () => {
    const { IDENTITY_CACHE_TTL_MS, getUserIdentity, setUserIdentity } = await import("./cache");
    const { bitbucketRequest } = await import("../bitbucket-repo");
    const { getOrResolveUserIdentity } = await import("./identity");

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-27T12:00:00.000Z"));

    setUserIdentity({
      providerId: "bitbucket",
      uuid: "{stale-uuid}",
      accountId: "account-5",
      login: "stale-user",
      displayName: "Stale User",
      fetchedAt: Date.now() - IDENTITY_CACHE_TTL_MS - 1_000,
    });

    vi.mocked(bitbucketRequest).mockResolvedValue({
      data: {
        uuid: "{fresh-uuid}",
        account_id: "account-6",
        nickname: "fresh-user",
        display_name: "Fresh User",
      },
      headers: new Headers(),
    });

    await expect(getOrResolveUserIdentity("bitbucket", BITBUCKET_CONNECTION)).resolves.toEqual({
      providerId: "bitbucket",
      uuid: "{stale-uuid}",
      accountId: "account-5",
      login: "stale-user",
      displayName: "Stale User",
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(getUserIdentity("bitbucket")).toEqual({
      providerId: "bitbucket",
      uuid: "{fresh-uuid}",
      accountId: "account-6",
      login: "fresh-user",
      displayName: "Fresh User",
      fetchedAt: Date.now(),
    });
  });

  it("fetches and caches identity on a cache miss", async () => {
    const { getUserIdentity } = await import("./cache");
    const { bitbucketRequest } = await import("../bitbucket-repo");
    const { getOrResolveUserIdentity } = await import("./identity");

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-27T12:00:00.000Z"));

    vi.mocked(bitbucketRequest).mockResolvedValue({
      data: {
        uuid: "{resolved-uuid}",
        account_id: "account-7",
        nickname: "resolved-user",
        display_name: "Resolved User",
      },
      headers: new Headers(),
    });

    await expect(getOrResolveUserIdentity("bitbucket", BITBUCKET_CONNECTION)).resolves.toEqual({
      providerId: "bitbucket",
      uuid: "{resolved-uuid}",
      accountId: "account-7",
      login: "resolved-user",
      displayName: "Resolved User",
    });

    expect(getUserIdentity("bitbucket")).toEqual({
      providerId: "bitbucket",
      uuid: "{resolved-uuid}",
      accountId: "account-7",
      login: "resolved-user",
      displayName: "Resolved User",
      fetchedAt: Date.now(),
    });
  });
});
