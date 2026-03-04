import { spawn } from "child_process";
import { resolve } from "path";
import { existsSync } from "fs";
import { getBaseDir, resolveBinPath } from "../paths.js";

function resolveNodeBinary(): string {
  const baseDir = getBaseDir();

  if (process.platform === "win32") {
    const bundled = resolve(baseDir, "node", "win", "node.exe");
    if (existsSync(bundled)) return bundled;
  }

  if (process.platform === "darwin") {
    const bundled = resolve(baseDir, "node", "mac", "node");
    if (existsSync(bundled)) return bundled;
  }

  return process.execPath;
}

function nodeArgs(scriptPath: string, args: string[]): string[] {
  return ["--experimental-default-type=module", scriptPath, ...args];
}

interface SpawnResult {
  code: number;
  signal: NodeJS.Signals | null;
}

function requiredCurlBinaryPath(): string {
  return process.platform === "win32"
    ? resolveBinPath("libcurl.dll")
    : resolveBinPath("curl-impersonate");
}

function runNodeScript(scriptPath: string, args: string[]): Promise<SpawnResult> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(resolveNodeBinary(), nodeArgs(scriptPath, args), {
      cwd: getBaseDir(),
      stdio: "inherit",
      env: {
        ...process.env,
        CODEX_PROXY_BASE_DIR: getBaseDir(),
      },
      windowsHide: true,
    });
    child.on("error", reject);
    child.on("exit", (code, signal) => resolvePromise({ code: code ?? 1, signal }));
  });
}

export async function ensureCurlDependenciesReady(force = false): Promise<void> {
  const requiredPath = requiredCurlBinaryPath();
  if (existsSync(requiredPath) && !force) {
    return;
  }

  const baseDir = getBaseDir();
  const setupScript = resolve(baseDir, "scripts", "setup-curl.ts");
  const tsxPath = resolve(baseDir, "node_modules", "tsx", "dist", "cli.mjs");

  if (!existsSync(setupScript)) {
    console.warn(`[setup-curl-runner] setup script not found, skipping: ${setupScript}`);
    return;
  }
  if (!existsSync(tsxPath)) {
    console.warn("[setup-curl-runner] tsx not found in node_modules, skipping setup");
    return;
  }

  const args = [setupScript, ...(force ? ["--force"] : [])];
  const result = await runNodeScript(tsxPath, args);
  if (result.code !== 0) {
    console.warn(`[setup-curl-runner] setup-curl failed (code=${result.code}, signal=${result.signal ?? "none"}), continuing without setup`);
    return;
  }
}
