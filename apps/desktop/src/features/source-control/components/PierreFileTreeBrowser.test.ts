import { describe, expect, it } from "vite-plus/test";

import { TREE_UNSAFE_CSS } from "./PierreFileTreeBrowser";

/**
 * Regression guard for the file-tree filename truncation bug.
 *
 * The original implementation used `flex: 1 0 max-content; min-width: max-content;`
 * on the decoration column, which let the badge area grow to fit its content and
 * starved the filename column of width. That triggered Pierre's middle-truncate
 * widget to collapse filenames into ugly ".......x" segments (long ellipsis +
 * last char of extension).
 *
 * The fix caps the decoration column with `max-width` and switches it to
 * `flex: 0 0 auto` so the filename column controls truncation with a normal
 * `text-overflow: ellipsis`.
 */
describe("PierreFileTreeBrowser TREE_UNSAFE_CSS", () => {
  function extractRuleBlock(selector: string): string {
    const idx = TREE_UNSAFE_CSS.indexOf(selector);
    expect(idx, `selector ${selector} should exist in TREE_UNSAFE_CSS`).toBeGreaterThanOrEqual(0);
    const start = TREE_UNSAFE_CSS.indexOf("{", idx);
    const end = TREE_UNSAFE_CSS.indexOf("}", start);
    return TREE_UNSAFE_CSS.slice(start + 1, end);
  }

  it("caps the decoration column so it cannot starve the filename column", () => {
    const block = extractRuleBlock("[data-item-section='decoration']");
    expect(block).toMatch(/flex:\s*0\s+0\s+auto/);
    expect(block).toMatch(/min-width:\s*0/);
    expect(block).toMatch(/max-width:\s*[^;]+/);
    expect(block).toMatch(/overflow:\s*hidden/);
    // The known-bad values must not return.
    expect(block).not.toMatch(/max-content/);
    expect(block).not.toMatch(/overflow:\s*visible/);
  });

  it("clips the decoration text with ellipsis instead of letting it overflow", () => {
    const block = extractRuleBlock("[data-item-section='decoration'] > span");
    expect(block).toMatch(/min-width:\s*0/);
    expect(block).toMatch(/max-width:\s*100%/);
    expect(block).toMatch(/overflow:\s*hidden/);
    expect(block).toMatch(/text-overflow:\s*ellipsis/);
    expect(block).toMatch(/white-space:\s*nowrap/);
    expect(block).not.toMatch(/max-content/);
    expect(block).not.toMatch(/text-overflow:\s*clip/);
  });
});
