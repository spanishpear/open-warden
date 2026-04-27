export interface MacUpdateFile {
  url: string;
  sha512: string;
  size: number;
}

export interface MacUpdateManifest {
  version: string;
  files: MacUpdateFile[];
  path: string;
  sha512: string;
  releaseDate: string;
}

export function parseMacUpdateManifest(raw: string, sourcePath: string): MacUpdateManifest;
export function mergeMacUpdateManifests(
  primary: MacUpdateManifest,
  secondary: MacUpdateManifest,
): MacUpdateManifest;
export function serializeMacUpdateManifest(manifest: MacUpdateManifest): string;
export function mergeMacUpdateManifestFiles(primaryPath: string, secondaryPath: string): string;
