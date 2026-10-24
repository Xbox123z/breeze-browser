// 渲染进程桥：只暴露白名单 API，保持 contextIsolation。
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('breeze', {
  tab: {
    new: () => ipcRenderer.send('tab:new'),
    activate: (id) => ipcRenderer.send('tab:activate', id),
    close: (id) => ipcRenderer.send('tab:close', id)
  },
  nav: {
    go: (url) => ipcRenderer.send('nav:go', url),
    back: () => ipcRenderer.send('nav:back'),
    fwd: () => ipcRenderer.send('nav:fwd'),
    reload: () => ipcRenderer.send('nav:reload')
  },
  win: {
    min: () => ipcRenderer.send('win:min'),
    max: () => ipcRenderer.send('win:max'),
    close: () => ipcRenderer.send('win:close')
  },
  state: {
    get: () => ipcRenderer.invoke('state:get'),
    set: (patch) => ipcRenderer.invoke('state:set', patch)
  },
  bookmarks: {
    add: (bm) => ipcRenderer.invoke('bookmark:add', bm),
    remove: (url) => ipcRenderer.invoke('bookmark:remove', url)
  },
  chrome: {
    import: () => ipcRenderer.invoke('chrome:import')
  },
  on: (channel, cb) => {
    if (['tabs', 'nav', 'state'].includes(channel)) {
      ipcRenderer.on(channel, (_e, data) => cb(data));
    }
  }
});
