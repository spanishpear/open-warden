import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type { RootState } from "@/app/store";

type InboxState = {
  /**
   * Id of the keyboard-focused PR row. Kept in its own narrow slice so that
   * moving the cursor only re-renders the rows that subscribe to their own
   * selection state (the previously- and newly-selected rows), never the whole
   * list.
   */
  selectedPRId: string | null;
};

const initialState: InboxState = {
  selectedPRId: null,
};

const inboxSlice = createSlice({
  name: "inbox",
  initialState,
  reducers: {
    setInboxSelectedPRId(state, action: PayloadAction<string | null>) {
      if (state.selectedPRId !== action.payload) {
        state.selectedPRId = action.payload;
      }
    },
    clearInboxSelection(state) {
      if (state.selectedPRId !== null) {
        state.selectedPRId = null;
      }
    },
  },
});

export const { setInboxSelectedPRId, clearInboxSelection } = inboxSlice.actions;

export const inboxReducer = inboxSlice.reducer;

/** Narrow selector: subscribe to whether a single row is the selected one. */
export function selectIsInboxRowSelected(prId: string) {
  return (state: RootState) => state.inbox.selectedPRId === prId;
}

export function selectInboxSelectedPRId(state: RootState) {
  return state.inbox.selectedPRId;
}
