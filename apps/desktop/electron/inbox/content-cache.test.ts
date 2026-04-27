import { existsSync, readFileSync, rmSync } from "node:fs";
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

function getCacheRoot() {
  return path.join(userDataPath, "open-warden-content-cache");
}

describe("electron inbox content cache", () => {
  beforeEach(async () => {
    userDataPath = await mkdtemp(path.join(os.tmpdir(), "open-warden-content-cache-"));
    vi.resetModules();
  });

  afterEach(() => {
    if (userDataPath) {
      rmSync(userDataPath, { recursive: true, force: true });
    }
  });

  it("writes cached content to disk under the userData cache root", async () => {
    const { CONTENT_CACHE_ROOT, cacheContent } = await import("./content-cache");

    cacheContent("pr/bitbucket/acme/repo/1/base/head/patch.txt", "diff --git a/file b/file");

    const cachePath = path.join(CONTENT_CACHE_ROOT, "pr/bitbucket/acme/repo/1/base/head/patch.txt");

    expect(CONTENT_CACHE_ROOT).toBe(getCacheRoot());
    expect(existsSync(cachePath)).toBe(true);
    expect(readFileSync(cachePath, "utf8")).toBe("diff --git a/file b/file");
  });

  it("returns null for cold cached content lookups", async () => {
    const { getCachedContent } = await import("./content-cache");

    expect(getCachedContent("missing/file.txt")).toBeNull();
  });

  it("reads back cached content after a write", async () => {
    const { cacheContent, getCachedContent } = await import("./content-cache");

    cacheContent("git/repo/abc123/src%2Ffile.ts", "export const value = 1;");

    expect(getCachedContent("git/repo/abc123/src%2Ffile.ts")).toBe("export const value = 1;");
  });

  it("treats writes to an existing key as immutable no-ops", async () => {
    const { cacheContent, getCachedContent } = await import("./content-cache");

    cacheContent("immutable/content.txt", "first");
    cacheContent("immutable/content.txt", "second");

    expect(getCachedContent("immutable/content.txt")).toBe("first");
  });

  it("clears a scoped prefix without removing other cached content", async () => {
    const { cacheContent, clearContentCache, getCachedContent } = await import("./content-cache");

    cacheContent("pr/bitbucket/acme/repo/1/base/head/patch.txt", "patch");
    cacheContent("git/repo-hash/abc123/src%2Ffile.ts", "file");

    clearContentCache("pr/bitbucket/acme");

    expect(getCachedContent("pr/bitbucket/acme/repo/1/base/head/patch.txt")).toBeNull();
    expect(getCachedContent("git/repo-hash/abc123/src%2Ffile.ts")).toBe("file");
  });

  it("clears the full cache root when no prefix is provided", async () => {
    const { CONTENT_CACHE_ROOT, cacheContent, clearContentCache, getCachedContent } = await import(
      "./content-cache"
    );

    cacheContent("pr/bitbucket/acme/repo/1/base/head/patch.txt", "patch");
    cacheContent("git/repo-hash/abc123/src%2Ffile.ts", "file");

    clearContentCache();

    expect(existsSync(CONTENT_CACHE_ROOT)).toBe(false);
    expect(getCachedContent("pr/bitbucket/acme/repo/1/base/head/patch.txt")).toBeNull();
    expect(getCachedContent("git/repo-hash/abc123/src%2Ffile.ts")).toBeNull();
  });

  it("builds a commit-keyed PR diff cache path", async () => {
    const { cacheContent, getCachedContent, prDiffKey } = await import("./content-cache");

    const key = prDiffKey("bitbucket", "acme", "repo", 42, "abc123", "def456");
    cacheContent(key, "patch-body");

    expect(key).toBe("pr/bitbucket/acme/repo/42/abc123/def456/patch.txt");
    expect(getCachedContent(key)).toBe("patch-body");
  });

  it("builds a git file cache key with a hashed repo path and encoded file path", async () => {
    const { cacheContent, getCachedContent, gitFileKey } = await import("./content-cache");

    const key = gitFileKey("/Users/me/repo", "abc123", "src/foo.ts");
    cacheContent(key, "file contents");

    expect(key).toMatch(/^git\/[a-f0-9]+\/abc123\/src%2Ffoo\.ts$/);
    expect(getCachedContent(key)).toBe("file contents");
  });

  it("round-trips JSON payloads through the content cache", async () => {
    const { cacheJson, getCachedJson } = await import("./content-cache");

    const payload = {
      title: "My PR",
      files: ["src/foo.ts", "src/bar.ts"],
      fetchedAt: 1_717_171_717_000,
    };

    cacheJson("json/payload.json", payload);

    expect(getCachedJson<typeof payload>("json/payload.json")).toEqual(payload);
  });
});
