import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { app } from "electron";

export const CONTENT_CACHE_ROOT = path.join(app.getPath("userData"), "open-warden-content-cache");

function resolveCachePath(key: string): string {
  return path.join(CONTENT_CACHE_ROOT, key);
}

export function cacheContent(key: string, content: string): void {
  const cachePath = resolveCachePath(key);

  if (existsSync(cachePath)) {
    return;
  }

  mkdirSync(path.dirname(cachePath), { recursive: true });
  writeFileSync(cachePath, content, "utf8");
}

export function getCachedContent(key: string): string | null {
  const cachePath = resolveCachePath(key);

  if (!existsSync(cachePath)) {
    return null;
  }

  return readFileSync(cachePath, "utf8");
}

export function cacheJson(key: string, data: unknown): void {
  cacheContent(key, JSON.stringify(data));
}

// oxlint-disable-next-line typescript-eslint(no-unnecessary-type-parameters)
export function getCachedJson<T>(key: string): T | null {
  const cached = getCachedContent(key);

  if (cached === null) {
    return null;
  }

  // oxlint-disable-next-line typescript-eslint(no-unsafe-type-assertion)
  return JSON.parse(cached) as unknown as T;
}

export function clearContentCache(prefix?: string): void {
  const targetPath = prefix ? resolveCachePath(prefix) : CONTENT_CACHE_ROOT;

  rmSync(targetPath, { recursive: true, force: true });
}

function hashRepoPath(repoPath: string): string {
  return createHash("sha256").update(repoPath).digest("hex");
}

function encodeKeySegment(value: string): string {
  return encodeURIComponent(value);
}

export function prDiffKey(
  providerId: string,
  owner: string,
  repo: string,
  prNumber: number,
  baseSha: string,
  headSha: string,
): string {
  return path.join(
    "pr",
    encodeKeySegment(providerId),
    encodeKeySegment(owner),
    encodeKeySegment(repo),
    String(prNumber),
    encodeKeySegment(baseSha),
    encodeKeySegment(headSha),
    "patch.txt",
  );
}

export function gitFileKey(repoPath: string, commitId: string, filePath: string): string {
  return path.join(
    "git",
    hashRepoPath(repoPath),
    encodeKeySegment(commitId),
    encodeURIComponent(filePath),
  );
}
