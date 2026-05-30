import { contextBridge, ipcRenderer } from "electron";

import { createDesktopApiFromInvoker } from "../src/platform/desktop/createDesktopApi";
import type { DesktopBridge } from "../src/platform/desktop/contracts";
import type { DesktopApiMethod } from "../src/platform/desktop/desktopApiMethods";
import {
  APP_SETTINGS_CHANGED_CHANNEL,
  DESKTOP_INVOKE_CHANNEL,
  UPDATE_CHECK_CHANNEL,
  UPDATE_DOWNLOAD_CHANNEL,
  UPDATE_GET_STATE_CHANNEL,
  UPDATE_INSTALL_CHANNEL,
  UPDATE_STATE_CHANNEL,
} from "./ipc-channels";

const DESKTOP_INVOKE_TIMEOUT_MS = 120_000;
const DESKTOP_INVOKE_TIMEOUT_SECONDS = DESKTOP_INVOKE_TIMEOUT_MS / 1_000;

function invokeDesktopMethod(method: DesktopApiMethod, ...args: unknown[]) {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => {
      reject(
        new Error(`Desktop method ${method} timed out after ${DESKTOP_INVOKE_TIMEOUT_SECONDS}s.`),
      );
    }, DESKTOP_INVOKE_TIMEOUT_MS);
  });

  return Promise.race([
    ipcRenderer.invoke(DESKTOP_INVOKE_CHANNEL, method, ...args),
    timeoutPromise,
  ]).finally(() => {
    if (timeout) {
      clearTimeout(timeout);
    }
  });
}

const desktopApi = createDesktopApiFromInvoker(invokeDesktopMethod);

const desktopBridge: DesktopBridge = {
  ...desktopApi,
  getUpdateState: () => ipcRenderer.invoke(UPDATE_GET_STATE_CHANNEL),
  checkForUpdates: () => ipcRenderer.invoke(UPDATE_CHECK_CHANNEL),
  downloadUpdate: () => ipcRenderer.invoke(UPDATE_DOWNLOAD_CHANNEL),
  installUpdate: () => ipcRenderer.invoke(UPDATE_INSTALL_CHANNEL),
  onUpdateState: (listener) => {
    const wrappedListener = (_event: Electron.IpcRendererEvent, state: unknown) => {
      if (typeof state !== "object" || state === null) {
        return;
      }

      // oxlint-disable-next-line typescript-eslint(no-unsafe-type-assertion)
      listener(state as Parameters<typeof listener>[0]);
    };

    ipcRenderer.on(UPDATE_STATE_CHANNEL, wrappedListener);
    return () => {
      ipcRenderer.removeListener(UPDATE_STATE_CHANNEL, wrappedListener);
    };
  },
  onAppSettingsChanged: (listener) => {
    const wrappedListener = (_event: Electron.IpcRendererEvent, settings: unknown) => {
      if (typeof settings !== "object" || settings === null) {
        return;
      }

      // oxlint-disable-next-line typescript-eslint(no-unsafe-type-assertion)
      listener(settings as Parameters<typeof listener>[0]);
    };

    ipcRenderer.on(APP_SETTINGS_CHANGED_CHANNEL, wrappedListener);
    return () => {
      ipcRenderer.removeListener(APP_SETTINGS_CHANGED_CHANNEL, wrappedListener);
    };
  },
};

contextBridge.exposeInMainWorld("desktopBridge", desktopBridge);
contextBridge.exposeInMainWorld("openWarden", desktopBridge);
