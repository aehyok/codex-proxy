import { app } from "electron";
import electronUpdater from "electron-updater";

const { autoUpdater } = electronUpdater;

let initialized = false;

export function initAutoUpdater(): void {
  if (initialized) return;
  initialized = true;

  autoUpdater.autoDownload = true;

  autoUpdater.on("checking-for-update", () => {
    console.log("[Updater] Checking for updates...");
  });

  autoUpdater.on("update-available", (info) => {
    console.log(`[Updater] Update available: ${info.version}`);
  });

  autoUpdater.on("update-not-available", () => {
    console.log("[Updater] No update available");
  });

  autoUpdater.on("error", (err) => {
    console.warn(`[Updater] Error: ${err.message}`);
  });

  autoUpdater.on("update-downloaded", (info) => {
    console.log(`[Updater] Update downloaded: ${info.version}`);
  });

  void autoUpdater.checkForUpdatesAndNotify();

  const interval = setInterval(() => {
    void autoUpdater.checkForUpdatesAndNotify();
  }, 6 * 60 * 60 * 1000);

  app.on("before-quit", () => {
    clearInterval(interval);
  });
}
