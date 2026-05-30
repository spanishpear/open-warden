import { describe, expect, it } from "vite-plus/test";

import type { AppSettings, LandCommandContext } from "./contracts";
import {
  buildLandCommandArgv,
  landCommandRepoKey,
  resolveLandCommandTemplate,
  substituteLandPlaceholders,
} from "./landCommand";

const BASE_SETTINGS: AppSettings = {
  version: 1,
  sourceControl: { fileTreeRenderMode: "tree" },
};

const CONTEXT: LandCommandContext = {
  number: 42,
  workspace: "acme",
  repo: "web",
  sourceBranch: "feature/x",
  targetBranch: "main",
  url: "https://bitbucket.org/acme/web/pull-requests/42",
};

describe("landCommandRepoKey", () => {
  it("lowercases and joins workspace/repo", () => {
    expect(landCommandRepoKey("Acme", "Web")).toBe("acme/web");
  });
  it("trims surrounding whitespace", () => {
    expect(landCommandRepoKey(" acme ", " web ")).toBe("acme/web");
  });
});

describe("resolveLandCommandTemplate", () => {
  it("returns null when no merge settings are configured", () => {
    expect(resolveLandCommandTemplate(BASE_SETTINGS, "acme/web")).toBeNull();
  });

  it("falls back to the global land command", () => {
    const settings: AppSettings = { ...BASE_SETTINGS, merge: { landCommand: "ag land {number}" } };
    expect(resolveLandCommandTemplate(settings, "acme/web")).toBe("ag land {number}");
  });

  it("prefers a per-repo override over the global default", () => {
    const settings: AppSettings = {
      ...BASE_SETTINGS,
      merge: {
        landCommand: "ag land {number}",
        repos: { "acme/web": { command: "ag land --queue {number}" } },
      },
    };
    expect(resolveLandCommandTemplate(settings, "acme/web")).toBe("ag land --queue {number}");
  });

  it("ignores blank overrides and falls back", () => {
    const settings: AppSettings = {
      ...BASE_SETTINGS,
      merge: { landCommand: "ag land {number}", repos: { "acme/web": { command: "   " } } },
    };
    expect(resolveLandCommandTemplate(settings, "acme/web")).toBe("ag land {number}");
  });

  it("returns null when only an unrelated repo is configured", () => {
    const settings: AppSettings = {
      ...BASE_SETTINGS,
      merge: { repos: { "other/repo": { command: "ag land {number}" } } },
    };
    expect(resolveLandCommandTemplate(settings, "acme/web")).toBeNull();
  });
});

describe("substituteLandPlaceholders", () => {
  it("substitutes every supported placeholder", () => {
    expect(substituteLandPlaceholders("{workspace}/{repo}#{number}->{targetBranch}", CONTEXT)).toBe(
      "acme/web#42->main",
    );
  });
  it("leaves unknown placeholders untouched", () => {
    expect(substituteLandPlaceholders("{unknown}", CONTEXT)).toBe("{unknown}");
  });
});

describe("buildLandCommandArgv", () => {
  it("tokenizes and substitutes into argv elements", () => {
    expect(buildLandCommandArgv("ag land --pr {number}", CONTEXT)).toEqual([
      "ag",
      "land",
      "--pr",
      "42",
    ]);
  });

  it("keeps a substituted branch as a single argv element (no shell split)", () => {
    const context: LandCommandContext = { ...CONTEXT, sourceBranch: "feature/has space" };
    expect(buildLandCommandArgv("ag land --branch {sourceBranch}", context)).toEqual([
      "ag",
      "land",
      "--branch",
      "feature/has space",
    ]);
  });

  it("collapses extra whitespace and ignores empty tokens", () => {
    expect(buildLandCommandArgv("  ag   land  ", CONTEXT)).toEqual(["ag", "land"]);
  });
});
