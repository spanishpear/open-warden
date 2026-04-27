import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import { createAppSettings } from "@/platform/desktop/appSettings";
import type { AppSettings, FileTreeRenderMode } from "@/platform/desktop";

type SettingsState = {
  appSettings: AppSettings;
  error: string;
};

const initialState: SettingsState = {
  appSettings: createAppSettings(),
  error: "",
};

const settingsSlice = createSlice({
  name: "settings",
  initialState,
  reducers: {
    hydrateAppSettings(state, action: PayloadAction<AppSettings>) {
      state.appSettings = action.payload;
      state.error = "";
    },
    setFileTreeRenderMode(state, action: PayloadAction<FileTreeRenderMode>) {
      state.appSettings.sourceControl.fileTreeRenderMode = action.payload;
    },
    setInboxSectionVisibility(
      state,
      action: PayloadAction<{ sectionKey: string; visible: boolean }>,
    ) {
      const { sectionKey, visible } = action.payload;
      state.appSettings.inboxSectionVisibility = {
        ...state.appSettings.inboxSectionVisibility,
        [sectionKey]: visible,
      };
    },
    setSettingsError(state, action: PayloadAction<string>) {
      state.error = action.payload;
    },
    clearSettingsError(state) {
      if (state.error !== "") {
        state.error = "";
      }
    },
  },
});

export const {
  clearSettingsError,
  hydrateAppSettings,
  setFileTreeRenderMode,
  setInboxSectionVisibility,
  setSettingsError,
} = settingsSlice.actions;

export const settingsReducer = settingsSlice.reducer;
