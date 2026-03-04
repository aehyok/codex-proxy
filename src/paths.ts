import { resolve } from "path";

function normalizeEnvPath(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? resolve(trimmed) : null;
}

export function getBaseDir(): string {
  return normalizeEnvPath(process.env.CODEX_PROXY_BASE_DIR) ?? process.cwd();
}

export function resolveBase(...segments: string[]): string {
  return resolve(getBaseDir(), ...segments);
}

export function resolveConfigPath(...segments: string[]): string {
  return resolveBase("config", ...segments);
}

export function resolveDataPath(...segments: string[]): string {
  return resolveBase("data", ...segments);
}

export function resolveBinPath(...segments: string[]): string {
  return resolveBase("bin", ...segments);
}

export function resolvePublicPath(...segments: string[]): string {
  return resolveBase("public", ...segments);
}
