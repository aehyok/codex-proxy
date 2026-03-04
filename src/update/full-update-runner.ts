import { spawn } from "child_process";
import { resolve } from "path";
import { existsSync } from "fs";
import { getBaseDir } from "../paths.js";

interface ChildResult {
  code: number;
  signal: NodeJS.Signals | null;
}

function runNodeScript(scriptPath: string, args: string[]): Promise<ChildResult> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd: getBaseDir(),
      stdio: "inherit",
      env: {
        ...process.env,
        CODEX_PROXY_BASE_DIR: getBaseDir(),
      },
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      resolvePromise({ code: code ?? 1, signal });
    });
  });
}

async function main(): Promise<void> {
  const force = process.argv.includes("--force");
  const baseDir = getBaseDir();

  const extractScript = resolve(baseDir, "scripts", "extract-fingerprint.ts");
  const applyScript = resolve(baseDir, "scripts", "apply-update.ts");

  if (!existsSync(extractScript)) {
    throw new Error(`Missing script: ${extractScript}`);
  }
  if (!existsSync(applyScript)) {
    throw new Error(`Missing script: ${applyScript}`);
  }

  const tsxPath = resolve(baseDir, "node_modules", "tsx", "dist", "cli.mjs");
  if (!existsSync(tsxPath)) {
    throw new Error("tsx is required for full-update-runner but was not found in node_modules");
  }

  const extractResult = await runNodeScript(tsxPath, [extractScript]);
  if (extractResult.code !== 0) {
    throw new Error(`extract-fingerprint failed (code=${extractResult.code}, signal=${extractResult.signal ?? "none"})`);
  }

  const applyArgs = [applyScript, ...(force ? ["--force"] : [])];
  const applyResult = await runNodeScript(tsxPath, applyArgs);
  if (applyResult.code !== 0) {
    throw new Error(`apply-update failed (code=${applyResult.code}, signal=${applyResult.signal ?? "none"})`);
  }
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`[full-update-runner] ${msg}`);
  process.exit(1);
});
