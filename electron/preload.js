'use strict';
// Preload (sandbox + contextIsolation): chỉ lộ ra thông tin tối thiểu, KHÔNG lộ Node/ipc tuỳ ý cho trang web.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('amgElectron', {
  platform: process.platform,
  getVersion: () => ipcRenderer.invoke('amg:get-version')
});
