import { describe, expect, it } from "vite-plus/test";

import type { RunLandCommandInput } from "../src/platform/desktop/contracts";
import { runLandCommand } from "./landCommand";

// Runs real, portable commands (echo/false) rather than mocking
// node:child_process, matching the repo convention in dev-shell.test.ts /
// git.test.ts. The OS engines are darwin/linux, so these are always present.
const CONTEXT: RunLandCommandInput["context"] = {
  number: 7,
  workspace: "acme",
  repo: "web",
  sourceBranch: "feature/x",
  targetBranch: "main",
  url: "https://bitbucket.org/acme/web/pull-requests/7",
};

describe("runLandCommand", () => {
  it("substitutes placeholders, captures stdout, and resolves ok on exit 0", async () => {
    const result = await runLandCommand({ command: "echo landed-{number}", context: CONTEXT });
    expect(result.ranCommand).toBe("echo landed-7");
    expect(result.exitCode).toBe(0);
    expect(result.ok).toBe(true);
    expect(result.stdout.trim()).toBe("landed-7");
  });

  it("reports a non-zero exit as not ok", async () => {
    const result = await runLandCommand({ command: "false", context: CONTEXT });
    expect(result.exitCode).not.toBe(0);
    expect(result.ok).toBe(false);
  });

  it("rejects when the binary does not exist", async () => {
    await expect(
      runLandCommand({ command: "openwarden-no-such-binary-zzz --pr {number}", context: CONTEXT }),
    ).rejects.toThrow();
  });

  it("throws for an empty command", async () => {
    await expect(runLandCommand({ command: "   ", context: CONTEXT })).rejects.toThrow("empty");
  });
});
