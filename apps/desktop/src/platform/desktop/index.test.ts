import { afterEach, expect, test, vi } from "vite-plus/test";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

test("desktop API resolves Electron runtime lazily after import", async () => {
  // @ts-expect-error -- oxlint typescript
  vi.stubEnv("DEV", "true");
  vi.stubEnv("VITE_DESKTOP_FALLBACK", "");
  vi.stubGlobal("window", {});

  const { desktop } = await import("./index");

  const selectFolder = vi.fn().mockResolvedValue("/tmp/repo");
  // @ts-expect-error -- oxlint typescript
  window.desktopBridge = {
    selectFolder,
    loadWorkspaceSession: vi.fn().mockResolvedValue({
      openRepos: [],
      activeRepo: "",
      recentRepos: [],
    }),
    saveWorkspaceSession: vi.fn().mockResolvedValue({
      openRepos: [],
      activeRepo: "",
      recentRepos: [],
    }),
    loadAppSettings: vi.fn().mockResolvedValue({
      version: 1,
      sourceControl: {
        fileTreeRenderMode: "tree",
      },
    }),
    saveAppSettings: vi.fn().mockResolvedValue({
      version: 1,
      sourceControl: {
        fileTreeRenderMode: "tree",
      },
    }),
    getAppSettingsPath: vi.fn().mockResolvedValue("/tmp/settings.json"),
    confirm: vi.fn(),
    checkAppExists: vi.fn(),
    openPath: vi.fn(),
    getGitSnapshot: vi.fn(),
    getRepoFiles: vi.fn(),
    getCommitHistory: vi.fn(),
    getBranches: vi.fn(),
    getBranchFiles: vi.fn(),
    getCommitFiles: vi.fn(),
    getCommitFileVersions: vi.fn(),
    getFileVersions: vi.fn(),
    getBranchFileVersions: vi.fn(),
    stageFile: vi.fn(),
    unstageFile: vi.fn(),
    stageAll: vi.fn(),
    unstageAll: vi.fn(),
    discardFile: vi.fn(),
    discardFiles: vi.fn(),
    discardAll: vi.fn(),
    commitStaged: vi.fn(),
    getRepoFile: vi.fn(),
    getUpdateState: vi.fn(),
    checkForUpdates: vi.fn(),
    downloadUpdate: vi.fn(),
    installUpdate: vi.fn(),
    onUpdateState: vi.fn(() => () => {}),
    onAppSettingsChanged: vi.fn(() => () => {}),
  };

  await expect(desktop.selectFolder()).resolves.toEqual("/tmp/repo");
  expect(selectFolder).toHaveBeenCalledTimes(1);

  await desktop.getRepoFile({
    repoPath: "/tmp/repo",
    relPath: "src/app.ts",
    revision: "HEAD",
  });
  // @ts-expect-error -- oxlint typescript
  expect(window.desktopBridge.getRepoFile).toHaveBeenCalledWith({
    repoPath: "/tmp/repo",
    relPath: "src/app.ts",
    revision: "HEAD",
  });

  await desktop.getRepoFiles("/tmp/repo");
  // @ts-expect-error -- oxlint typescript
  expect(window.desktopBridge.getRepoFiles).toHaveBeenCalledWith("/tmp/repo");

  await desktop.getAppSettingsPath();
  // @ts-expect-error -- oxlint typescript
  expect(window.desktopBridge.getAppSettingsPath).toHaveBeenCalledTimes(1);
});
