import { describe, expect, it } from "vite-plus/test";

// @ts-expect-error -- oxlint typescript
import { normalizeTheme } from "@/app/themeUtils";

describe("ThemeSwitcher helpers", () => {
  it("normalizes theme values", () => {
    expect(normalizeTheme("light")).toBe("light");
    expect(normalizeTheme("dark")).toBe("dark");
    expect(normalizeTheme("system")).toBe("system");
    expect(normalizeTheme(undefined)).toBe("system");
  });
});
