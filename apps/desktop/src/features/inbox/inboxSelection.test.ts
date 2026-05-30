import { describe, expect, it } from "vite-plus/test";

import { nextInboxSelection } from "./inboxSelection";

const IDS = ["a", "b", "c"];

describe("nextInboxSelection", () => {
  it("returns null for an empty list", () => {
    expect(nextInboxSelection([], null, "next")).toBeNull();
    expect(nextInboxSelection([], "a", "previous")).toBeNull();
  });

  it("selects the first row when moving next with no current selection", () => {
    expect(nextInboxSelection(IDS, null, "next")).toBe("a");
  });

  it("selects the last row when moving previous with no current selection", () => {
    expect(nextInboxSelection(IDS, null, "previous")).toBe("c");
  });

  it("moves to the next row", () => {
    expect(nextInboxSelection(IDS, "a", "next")).toBe("b");
    expect(nextInboxSelection(IDS, "b", "next")).toBe("c");
  });

  it("moves to the previous row", () => {
    expect(nextInboxSelection(IDS, "c", "previous")).toBe("b");
    expect(nextInboxSelection(IDS, "b", "previous")).toBe("a");
  });

  it("clamps at the end without wrapping", () => {
    expect(nextInboxSelection(IDS, "c", "next")).toBe("c");
  });

  it("clamps at the start without wrapping", () => {
    expect(nextInboxSelection(IDS, "a", "previous")).toBe("a");
  });

  it("recovers from a stale selection by going to an edge", () => {
    expect(nextInboxSelection(IDS, "gone", "next")).toBe("a");
    expect(nextInboxSelection(IDS, "gone", "previous")).toBe("c");
  });
});
