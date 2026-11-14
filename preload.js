'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('yfExe', {
  onPayload: fn => ipcRenderer.on('payload', (_e, d) => fn(d)),
  onState: fn => ipcRenderer.on('state', (_e, s) => fn(s)),
  endEdit: () => ipcRenderer.send('end-edit'),
});
