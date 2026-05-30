#!/usr/bin/env node
// Idempotent dev-app orchestrator for agentic development.
//
// Problem this solves: `pnpm dev:electron` is a blocking foreground process.
// Agents re-run it, spawn duplicates, fight the single-instance lock (which
// makes the app keep popping to the foreground), and lose the CDP session that
// agent-browser needs on every main-process rebuild.
//
// This wrapper guarantees exactly ONE backgrounded dev stack, tracks it via a
// PID file, streams logs to disk, and exposes a small command surface that is
// safe to call repeatedly:
//
//   node scripts/agent-app.mjs up        # bring the stack up (no-op if healthy)
//   node scripts/agent-app.mjs status    # report dev-server + CDP health
//   node scripts/agent-app.mjs logs [-f] # print (or follow) the log file
//   node scripts/agent-app.mjs restart   # down then up
//   node scripts/agent-app.mjs down       # stop the stack and sweep ports
//
// Flags:
//   --browser   run the renderer-only browser fallback (pnpm dev) instead of
//               the full Electron app. No CDP; connect agent-browser to the URL.

import { spawn } from "node:child_process";
import { createConnection } from "node:net";
import { existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = path.resolve(import.meta.dirname, "..");
const runDir = path.join(repoRoot, ".dev");
const pidFile = path.join(runDir, "agent-app.pid");
const metaFile = path.join(runDir, "agent-app.meta.json");
const logFile = path.join(runDir, "agent-app.log");

const DEV_SERVER_PORT = Number.parseInt(process.env.VITE_DEV_SERVER_PORT ?? "1420", 10) || 1420;
const CDP_PORT = 9222;
const DEV_SERVER_URL = `http://localhost:${String(DEV_SERVER_PORT)}`;
const CDP_URL = `http://localhost:${String(CDP_PORT)}`;

function log(message) {
  process.stdout.write(`${message}\n`);
}

function ensureRunDir() {
  if (!existsSync(runDir)) {
    mkdirSync(runDir, { recursive: true });
  }
}

// Resolve `false` only when nothing is accepting on the port. Vite binds
// `localhost`, which can resolve to IPv6 (::1) while Electron/CDP listens on
// IPv4 (127.0.0.1), so probe both and succeed if either accepts.
function checkHostPort(host, port) {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port });
    const done = (open) => {
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(800);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

async function checkPort(port) {
  const results = await Promise.all([checkHostPort("127.0.0.1", port), checkHostPort("::1", port)]);
  return results.some(Boolean);
}

function readMeta() {
  if (!existsSync(metaFile)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(metaFile, "utf8"));
  } catch {
    return null;
  }
}

function readPid() {
  if (!existsSync(pidFile)) {
    return null;
  }
  const raw = readFileSync(pidFile, "utf8").trim();
  const pid = Number.parseInt(raw, 10);
  return Number.isFinite(pid) && pid > 0 ? pid : null;
}

function pidAlive(pid) {
  if (!pid) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

async function getStatus() {
  const meta = readMeta();
  const mode = meta?.mode ?? "electron";
  const devServerUp = await checkPort(DEV_SERVER_PORT);
  const cdpUp = mode === "electron" ? await checkPort(CDP_PORT) : true;
  const pid = readPid();
  const healthy = devServerUp && cdpUp;
  return { healthy, devServerUp, cdpUp, pid, mode, alive: pidAlive(pid) };
}

function killGroup(pid, signal) {
  try {
    // Negative pid signals the whole process group (detached leader).
    process.kill(-pid, signal);
  } catch {
    try {
      process.kill(pid, signal);
    } catch {
      /* already gone */
    }
  }
}

// Best-effort sweep of anything still holding our ports (orphaned Electron /
// Vite from a previous crashed run) so `strictPort` does not bite us.
function sweepPort(port) {
  return new Promise((resolve) => {
    const finder = spawn("lsof", ["-ti", `tcp:${String(port)}`], {
      stdio: ["ignore", "pipe", "ignore"],
    });
    let out = "";
    finder.stdout.on("data", (chunk) => {
      out += chunk.toString();
    });
    finder.once("error", () => resolve());
    finder.once("close", () => {
      const pids = out
        .split("\n")
        .map((line) => Number.parseInt(line.trim(), 10))
        .filter((value) => Number.isFinite(value) && value > 0);
      for (const pid of pids) {
        try {
          process.kill(pid, "SIGKILL");
        } catch {
          /* ignore */
        }
      }
      resolve();
    });
  });
}

async function down({ quiet = false } = {}) {
  const pid = readPid();
  if (pid && pidAlive(pid)) {
    killGroup(pid, "SIGTERM");
    // Give it a moment to exit gracefully, then force.
    await new Promise((resolve) => setTimeout(resolve, 1500));
    if (pidAlive(pid)) {
      killGroup(pid, "SIGKILL");
    }
  }
  await sweepPort(DEV_SERVER_PORT);
  await sweepPort(CDP_PORT);
  rmSync(pidFile, { force: true });
  rmSync(metaFile, { force: true });
  if (!quiet) {
    log("Dev stack stopped.");
  }
}

function printConnectInfo(mode) {
  if (mode === "browser") {
    log("");
    log("  Mode:        browser (renderer-only, native APIs mocked)");
    log(`  Renderer:    ${DEV_SERVER_URL}`);
    log("");
    log("  Connect agent-browser:");
    log(`    agent-browser open ${DEV_SERVER_URL}`);
    return;
  }
  log("");
  log("  Mode:        electron (full app, real git + Bitbucket IPC)");
  log(`  Renderer:    ${DEV_SERVER_URL}`);
  log(`  CDP:         ${CDP_URL}`);
  log("");
  log("  Connect agent-browser:");
  log(`    agent-browser connect ${CDP_URL}`);
  log(`    agent-browser snapshot -i`);
}

async function up({ mode }) {
  const status = await getStatus();
  if (status.healthy && status.alive) {
    log(`Dev stack already running (pid ${String(status.pid)}, mode ${status.mode}).`);
    printConnectInfo(status.mode);
    return;
  }

  // Clean slate: clear any half-dead state and free the ports.
  await down({ quiet: true });
  ensureRunDir();

  const script = mode === "browser" ? "dev" : "dev:electron";
  log(`Starting dev stack (mode ${mode})... logs: ${path.relative(repoRoot, logFile)}`);

  const logFd = openSync(logFile, "w");
  const child = spawn("pnpm", ["--filter", "desktop", script], {
    cwd: repoRoot,
    detached: true,
    env: { ...process.env, VITE_DEV_SERVER_PORT: String(DEV_SERVER_PORT) },
    stdio: ["ignore", logFd, logFd],
  });
  child.unref();

  writeFileSync(pidFile, String(child.pid));
  writeFileSync(
    metaFile,
    JSON.stringify({ pid: child.pid, mode, startedAt: new Date().toISOString() }, null, 2),
  );

  // Poll for health. Electron build + native rebuild can take a while on a
  // cold start, so give it a generous budget.
  const deadline = Date.now() + 90_000;
  let healthy = false;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    if (!pidAlive(child.pid)) {
      break;
    }
    const s = await getStatus();
    if (s.healthy) {
      healthy = true;
      break;
    }
  }

  if (!healthy) {
    log("");
    log("Dev stack did not become healthy in time. Last log lines:");
    log("----------------------------------------------------------");
    try {
      const tail = readFileSync(logFile, "utf8").split("\n").slice(-30).join("\n");
      log(tail);
    } catch {
      /* ignore */
    }
    log("----------------------------------------------------------");
    log(`Run \`node scripts/agent-app.mjs logs\` for the full log.`);
    process.exitCode = 1;
    return;
  }

  log(`Dev stack is up (pid ${String(child.pid)}).`);
  printConnectInfo(mode);
}

async function status() {
  const s = await getStatus();
  log(`mode:        ${s.mode}`);
  log(
    `pid:         ${s.pid ? String(s.pid) : "(none)"}${s.pid && !s.alive ? " (not running)" : ""}`,
  );
  log(`dev server:  ${s.devServerUp ? "up" : "down"} (${DEV_SERVER_URL})`);
  if (s.mode === "electron") {
    log(`cdp:         ${s.cdpUp ? "up" : "down"} (${CDP_URL})`);
  }
  log(`healthy:     ${s.healthy ? "yes" : "no"}`);
  process.exitCode = s.healthy ? 0 : 1;
}

function logs({ follow }) {
  if (!existsSync(logFile)) {
    log("No log file yet. Start the stack with `node scripts/agent-app.mjs up`.");
    return;
  }
  const args = follow ? ["-f", "-n", "200", logFile] : ["-n", "200", logFile];
  const tail = spawn("tail", args, { stdio: "inherit" });
  tail.on("error", () => {
    log(readFileSync(logFile, "utf8"));
  });
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const mode = rest.includes("--browser") ? "browser" : "electron";
  const follow = rest.includes("-f") || rest.includes("--follow");

  switch (command) {
    case "up":
      await up({ mode });
      break;
    case "down":
    case "stop":
      await down({});
      break;
    case "restart":
      await down({ quiet: true });
      await up({ mode });
      break;
    case "status":
      await status();
      break;
    case "logs":
      logs({ follow });
      break;
    default:
      log("Usage: node scripts/agent-app.mjs <up|down|restart|status|logs> [--browser] [-f]");
      process.exitCode = command ? 1 : 0;
  }
}

await main();
