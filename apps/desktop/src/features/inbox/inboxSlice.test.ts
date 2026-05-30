import { describe, expect, it } from "vite-plus/test";

import { clearInboxSelection, inboxReducer, setInboxSelectedPRId } from "./inboxSlice";

describe("inboxSlice", () => {
  it("starts with no selection", () => {
    const state = inboxReducer(undefined, { type: "@@INIT" });
    expect(state.selectedPRId).toBeNull();
  });

  it("sets the selected PR id", () => {
    const state = inboxReducer(undefined, setInboxSelectedPRId("pr-1"));
    expect(state.selectedPRId).toBe("pr-1");
  });

  it("clears the selection", () => {
    const selected = inboxReducer(undefined, setInboxSelectedPRId("pr-1"));
    const cleared = inboxReducer(selected, clearInboxSelection());
    expect(cleared.selectedPRId).toBeNull();
  });

  it("is a no-op when setting the same id (preserves reference)", () => {
    const selected = inboxReducer(undefined, setInboxSelectedPRId("pr-1"));
    const again = inboxReducer(selected, setInboxSelectedPRId("pr-1"));
    expect(again).toBe(selected);
  });
});
