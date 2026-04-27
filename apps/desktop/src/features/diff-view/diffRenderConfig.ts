const DEFAULT_DARK_THEME = "github-dark";
const DEFAULT_LIGHT_THEME = "github-light";

type DiffThemeType = "dark" | "light";

export function getDiffThemeType(resolvedTheme: string | undefined): DiffThemeType {
  return resolvedTheme === "dark" ? "dark" : "light";
}

export function getDiffTheme() {
  return { dark: DEFAULT_DARK_THEME, light: DEFAULT_LIGHT_THEME };
}

export function getDiffThemeCacheSalt(themeType: DiffThemeType): string {
  return `${DEFAULT_DARK_THEME}:${DEFAULT_LIGHT_THEME}:${themeType}`;
}
