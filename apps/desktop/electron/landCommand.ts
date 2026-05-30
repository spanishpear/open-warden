import { spawn } from "node:child_process";

import type { LandCommandResult, RunLandCommandInput } from "../src/platform/desktop/contracts";
import { buildLandCommandArgv } from "../src/platform/desktop/landCommand";

const LAND_COMMAND_TIMEOUT_MS = 120_000;

/**
 * Run a locally-configured land command (e.g. a merge-queue CLI) for repos that
 * cannot use the Bitbucket merge API. Runs with shell:false on a whitespace-
 * tokenized argv so placeholder values never reach a shell.
 */
export async function runLandCommand(input: RunLandCommandInput): Promise<LandCommandResult> {
  const argv = buildLandCommandArgv(input.command, input.context);
  if (argv.length === 0) {
    throw new Error("Land command is empty.");
  }

  const [file, ...args] = argv;
  const ranCommand = argv.join(" ");

  return new Promise<LandCommandResult>((resolve, reject) => {
    const child = spawn(file, args, {
      cwd: input.cwd ?? undefined,
      shell: false,
      env: process.env,
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      if (!settled) {
        settled = true;
        reject(
          new Error(`Land command timed out after ${String(LAND_COMMAND_TIMEOUT_MS / 1000)}s.`),
        );
      }
    }, LAND_COMMAND_TIMEOUT_MS);
    timer.unref?.();

    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.once("error", (error) => {
      clearTimeout(timer);
      if (!settled) {
        settled = true;
        reject(error);
      }
    });

    child.once("close", (code) => {
      clearTimeout(timer);
      if (settled) {
        return;
      }
      settled = true;
      const exitCode = code ?? -1;
      resolve({ ranCommand, exitCode, stdout, stderr, ok: exitCode === 0 });
    });
  });
}
