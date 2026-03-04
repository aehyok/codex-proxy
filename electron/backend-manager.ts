import { app } from "electron";
import { spawn, type ChildProcess } from "child_process";
import { mkdirSync, createWriteStream, existsSync } from "fs";
import { resolve, join } from "path";
import { setTimeout as delay } from "timers/promises";

const HEALTH_PATH = "/health";
const HEALTH_TIMEOUT_MS = 30_000;
const HEALTH_POLL_MS = 500;

export interface BackendStartOptions {
  port: number;
  baseDir: string;
}

export class BackendManager {
  private child: ChildProcess | null = null;

  private resolveNodeBinary(): string {
    if (!app.isPackaged) {
      return process.execPath;
    }

    const isWin = process.platform === "win32";
    const bundled = isWin
      ? resolve(process.resourcesPath, "node", "win", "node.exe")
      : resolve(process.resourcesPath, "node", "mac", "node");

    if (existsSync(bundled)) {
      return bundled;
    }

    throw new Error(`Bundled Node runtime not found: ${bundled}`);
  }

  private resolveServerEntry(baseDir: string): string {
    if (app.isPackaged) {
      return resolve(process.resourcesPath, "dist", "index.js");
    }
    return resolve(baseDir, "dist", "index.js");
  }

  async startBackend(options: BackendStartOptions): Promise<void> {
    if (this.child && !this.child.killed) return;

    const logsDir = join(app.getPath("userData"), "logs");
    mkdirSync(logsDir, { recursive: true });
    const out = createWriteStream(join(logsDir, "backend.log"), { flags: "a" });
    const err = createWriteStream(join(logsDir, "backend-error.log"), { flags: "a" });

    const nodeBinary = this.resolveNodeBinary();
    const entry = this.resolveServerEntry(options.baseDir);
    if (!existsSync(entry)) {
      throw new Error(`Backend entry not found: ${entry}`);
    }

    const nodeArgs = app.isPackaged ? ["--experimental-default-type=module", entry] : [entry];

    this.child = spawn(nodeBinary, nodeArgs, {
      cwd: options.baseDir,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        PORT: String(options.port),
        HOST: "127.0.0.1",
        CODEX_PROXY_FORCE_LOCALHOST: "1",
        CODEX_PROXY_BASE_DIR: options.baseDir,
      },
      windowsHide: true,
    });

    this.child.stdout?.pipe(out);
    this.child.stderr?.pipe(err);

    this.child.on("exit", (code, signal) => {
      console.log(`[Backend] exited code=${code ?? "null"} signal=${signal ?? "null"}`);
      this.child = null;
    });
  }

  async waitForHealth(port: number, timeoutMs = HEALTH_TIMEOUT_MS): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    const url = `http://127.0.0.1:${port}${HEALTH_PATH}`;

    while (Date.now() < deadline) {
      try {
        const res = await fetch(url);
        if (res.ok) return;
      } catch {}
      await delay(HEALTH_POLL_MS);
    }

    throw new Error(`Backend health check timed out: ${url}`);
  }

  async stopBackend(): Promise<void> {
    if (!this.child || this.child.killed) {
      this.child = null;
      return;
    }

    const pid = this.child.pid;
    if (!pid) {
      this.child = null;
      return;
    }

    if (process.platform === "win32") {
      await new Promise<void>((resolvePromise) => {
        const killer = spawn("taskkill", ["/pid", String(pid), "/t", "/f"], {
          stdio: "ignore",
          windowsHide: true,
        });
        killer.on("exit", () => resolvePromise());
        killer.on("error", () => resolvePromise());
      });
      this.child = null;
      return;
    }

    this.child.kill("SIGTERM");
    await delay(1500);
    if (this.child && !this.child.killed) {
      this.child.kill("SIGKILL");
    }
    this.child = null;
  }
}
