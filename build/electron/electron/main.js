import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { resolve } from "path";
import { pathToFileURL } from "url";
import { BackendManager } from "./backend-manager.js";
import { initAutoUpdater } from "./updater.js";
async function runSetupCurlRunner(baseDir) {
    try {
        const runnerPath = resolve(baseDir, "dist", "update", "setup-curl-runner.js");
        const moduleUrl = pathToFileURL(runnerPath).href;
        const mod = (await import(moduleUrl));
        await mod.ensureCurlDependenciesReady(false);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`[Setup] setup-curl-runner failed: ${message}`);
    }
}
async function findAvailablePort(start) {
    for (let port = start; port < start + 30; port++) {
        try {
            const res = await fetch(`http://127.0.0.1:${port}/health`);
            if (!res.ok)
                return port;
        }
        catch {
            return port;
        }
    }
    throw new Error("No available port found for backend");
}
const backendManager = new BackendManager();
let mainWindow = null;
const DEFAULT_PORT = 18080;
function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 860,
        webPreferences: {
            contextIsolation: true,
            preload: resolve(import.meta.dirname, "preload.js"),
        },
    });
    return win;
}
function renderErrorPage(message) {
    const safe = message.replace(/[<>&]/g, (ch) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[ch] ?? ch));
    return `<!doctype html><html><body style="font-family:sans-serif;padding:24px">
  <h2>Codex Proxy failed to start</h2>
  <pre style="white-space:pre-wrap;background:#f5f5f5;padding:12px">${safe}</pre>
  <button onclick="window.codexProxy.retryBackendStart()">Retry</button>
  </body></html>`;
}
async function boot(main) {
    const baseDir = app.isPackaged ? process.resourcesPath : resolve(import.meta.dirname, "..");
    process.env.CODEX_PROXY_BASE_DIR = baseDir;
    process.env.CODEX_PROXY_FORCE_LOCALHOST = "1";
    await runSetupCurlRunner(baseDir);
    const port = await findAvailablePort(DEFAULT_PORT);
    await backendManager.startBackend({ port, baseDir });
    await backendManager.waitForHealth(port);
    await main.loadURL(`http://127.0.0.1:${port}`);
}
async function safeBoot(main) {
    try {
        await boot(main);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await main.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(renderErrorPage(message))}`);
    }
}
app.whenReady().then(async () => {
    mainWindow = createWindow();
    ipcMain.handle("app:retry-backend-start", async () => {
        if (!mainWindow)
            return;
        await backendManager.stopBackend();
        await safeBoot(mainWindow);
    });
    await safeBoot(mainWindow);
    initAutoUpdater();
    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            mainWindow = createWindow();
            void safeBoot(mainWindow);
        }
    });
});
app.on("before-quit", async (event) => {
    event.preventDefault();
    try {
        await backendManager.stopBackend();
    }
    finally {
        app.exit();
    }
});
app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});
process.on("uncaughtException", (err) => {
    console.error("[Electron] uncaughtException", err);
    void dialog.showErrorBox("Codex Proxy", err.message);
});
