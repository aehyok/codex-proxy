import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("codexProxy", {
    retryBackendStart: () => ipcRenderer.invoke("app:retry-backend-start"),
});
