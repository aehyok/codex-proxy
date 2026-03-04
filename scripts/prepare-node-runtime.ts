#!/usr/bin/env node
import { mkdirSync, existsSync, copyFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const resourcesDir = resolve(process.cwd(), "electron-resources", "node");
const distDir = resolve(process.cwd(), "dist");

function ensureDistEsm(): void {
  ensureDir(distDir);
  writeFileSync(resolve(distDir, "package.json"), JSON.stringify({ type: "module" }, null, 2));
  console.log(`[prepare-node-runtime] Wrote ESM package.json to ${resolve(distDir, "package.json")}`);
}

function ensureDir(path: string): void {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
  }
}

function main(): void {
  ensureDistEsm();

  if (process.platform === "win32") {
    const destDir = resolve(resourcesDir, "win");
    ensureDir(destDir);
    copyFileSync(process.execPath, resolve(destDir, "node.exe"));
    writeFileSync(resolve(destDir, "package.json"), JSON.stringify({ type: "module" }, null, 2));
    console.log(`[prepare-node-runtime] Copied runtime to ${resolve(destDir, "node.exe")}`);
    console.log(`[prepare-node-runtime] Wrote ESM package.json to ${resolve(destDir, "package.json")}`);
    return;
  }

  if (process.platform === "darwin") {
    const destDir = resolve(resourcesDir, "mac");
    ensureDir(destDir);
    copyFileSync(process.execPath, resolve(destDir, "node"));
    writeFileSync(resolve(destDir, "package.json"), JSON.stringify({ type: "module" }, null, 2));
    console.log(`[prepare-node-runtime] Copied runtime to ${resolve(destDir, "node")}`);
    console.log(`[prepare-node-runtime] Wrote ESM package.json to ${resolve(destDir, "package.json")}`);
    return;
  }

  throw new Error(`Unsupported platform for Electron packaging: ${process.platform}`);
}

main();
