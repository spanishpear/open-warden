import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

vi.mock("./parseDiffInWorker", () => ({
  parseDiffInWorker: vi.fn(),
  parsePatchInWorker: vi.fn(),
}));

vi.mock("./diffRenderLimits", () => ({
  getDiffRenderGate: vi.fn(() => "renderable"),
}));

describe("parsedDiffCache", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("getCachedParsedDiff returns undefined for a key that was never cached", async () => {
    const { getCachedParsedDiff } = await import("./parsedDiffCache");

    expect(getCachedParsedDiff("nonexistent-key")).toBeUndefined();
  });

  it("loadParsedDiff does not cache null when parseDiffInWorker rejects with a non-abort error", async () => {
    const { parseDiffInWorker } = await import("./parseDiffInWorker");
    vi.mocked(parseDiffInWorker).mockRejectedValue(new Error("network failure"));

    const { loadParsedDiff, getCachedParsedDiff } = await import("./parsedDiffCache");

    const request = {
      key: "error-test-key",
      oldFile: { name: "file.ts", contents: "old content" },
      newFile: { name: "file.ts", contents: "new content" },
    };

    const result = await loadParsedDiff(request);

    expect(result).toBeNull();
    expect(getCachedParsedDiff(request.key)).toBeUndefined();
  });

  it("loadParsedPatch invokes parsePatchInWorker and returns parsed result", async () => {
    const { parsePatchInWorker } = await import("./parseDiffInWorker");
    const mockParsedFiles = [{ oldName: "a.ts", newName: "a.ts", hunks: [] }];
    const mockValue = Object.assign(Object.create(null), { data: mockParsedFiles }).data;
    vi.mocked(parsePatchInWorker).mockResolvedValue(mockValue);

    const { loadParsedPatch } = await import("./parsedDiffCache");

    const result = await loadParsedPatch({
      key: "patch-invoke-key",
      patchText: "diff --git a/a.ts b/a.ts\n--- a/a.ts\n+++ b/a.ts",
    });

    expect(vi.mocked(parsePatchInWorker).mock.calls.length).toBeGreaterThan(0);
    expect(result).toEqual(mockParsedFiles);
  });

  it("loadParsedPatch returns cached result on second call without re-invoking worker", async () => {
    const { parsePatchInWorker } = await import("./parseDiffInWorker");
    const mockParsedFiles = [{ oldName: "b.ts", newName: "b.ts", hunks: [] }];
    const mockValue = Object.assign(Object.create(null), { data: mockParsedFiles }).data;
    vi.mocked(parsePatchInWorker).mockResolvedValue(mockValue);

    const { loadParsedPatch } = await import("./parsedDiffCache");

    const request = { key: "cache-hit-key", patchText: "patch text" };

    const callsBefore = vi.mocked(parsePatchInWorker).mock.calls.length;
    const first = await loadParsedPatch(request);
    const second = await loadParsedPatch(request);

    // ensure worker was invoked exactly once for the first resolution
    expect(vi.mocked(parsePatchInWorker).mock.calls.length).toBe(callsBefore + 1);
    expect(first).toEqual(mockParsedFiles);
    expect(second).toEqual(mockParsedFiles);
  });

  it("loadParsedPatch retries after a non-abort error because null is not cached", async () => {
    const { parsePatchInWorker } = await import("./parseDiffInWorker");
    const mockParsedFiles = [{ oldName: "c.ts", newName: "c.ts", hunks: [] }];
    vi.mocked(parsePatchInWorker)
      .mockRejectedValueOnce(new Error("transient worker error"))
      .mockResolvedValueOnce(Object.assign(Object.create(null), { data: mockParsedFiles }).data);

    const { loadParsedPatch } = await import("./parsedDiffCache");

    const request = { key: "retry-key", patchText: "diff content" };

    const callsBefore = vi.mocked(parsePatchInWorker).mock.calls.length;
    const firstResult = await loadParsedPatch(request);
    const secondResult = await loadParsedPatch(request);

    // parsePatchInWorker should be called twice across both attempts (transient error then success)
    expect(vi.mocked(parsePatchInWorker).mock.calls.length).toBe(callsBefore + 2);
    expect(firstResult).toBeNull();
    expect(secondResult).toEqual(mockParsedFiles);
  });

  it("loadParsedDiff returns cached result on second call without re-invoking worker", async () => {
    const { parseDiffInWorker } = await import("./parseDiffInWorker");
    const mockParsedDiff = { hunks: [], oldName: "d.ts", newName: "d.ts" };
    const mockValue = Object.assign(Object.create(null), { data: mockParsedDiff }).data;
    vi.mocked(parseDiffInWorker).mockResolvedValue(mockValue);

    const { loadParsedDiff, getCachedParsedDiff } = await import("./parsedDiffCache");

    const request = {
      key: "diff-cache-hit-key",
      oldFile: { name: "d.ts", contents: "old" },
      newFile: { name: "d.ts", contents: "new" },
    };

    const callsBefore = vi.mocked(parseDiffInWorker).mock.calls.length;
    const first = await loadParsedDiff(request);
    const second = await loadParsedDiff(request);

    expect(vi.mocked(parseDiffInWorker).mock.calls.length).toBe(callsBefore + 1);
    expect(first).toEqual(mockParsedDiff);
    expect(second).toEqual(mockParsedDiff);
    expect(getCachedParsedDiff(request.key)).toEqual(mockParsedDiff);
  });
});
