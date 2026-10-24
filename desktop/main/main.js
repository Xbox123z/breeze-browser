// Breeze Browser — Electron 主进程
// 桌面端（Windows / macOS）：多标签 WebContentsView + 极简 UI + Chrome 数据导入。
const { app, BrowserWindow, WebContentsView, ipcMain, session, Menu, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');

const userData = app.getPath('userData');
const STATE_FILE = path.join(userData, 'breeze-state.json');

/** 持久化状态：壁纸、首页、标签、书签 */
function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); }
  catch { return { wallpaper: 'aurora', customWallpaper: null, bookmarks: [], home: 'breeze://newtab' }; }
}
/**
 * 保存状态。密码字段若系统支持加密（safeStorage），则以加密形式落盘；
 * 否则保持明文并在返回值里标记 encrypted=false（调用方会提示用户）。
 * safeStorage: Windows 用 DPAPI，macOS 用 Keychain，Linux 用 libsecret。
 */
function saveState(patch) {
  const s = Object.assign(loadState(), patch);
  if (Array.isArray(s.passwords) && s.passwords.length && safeStorage.isEncryptionAvailable()) {
    s.passwords = s.passwords.map((p) => {
      if (p && typeof p.password === 'string' && !p.encrypted) {
        return { ...p, password: safeStorage.encryptString(p.password).toString('base64'), encrypted: true };
      }
      return p;
    });
  }
  fs.mkdirSync(userData, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2));
  return s;
}

/** 读取时把加密的密码解密回明文（仅内存中使用，不落盘）。 */
function decryptPasswords(s) {
  if (!Array.isArray(s.passwords)) return [];
  return s.passwords.map((p) => {
    if (p && p.encrypted && safeStorage.isEncryptionAvailable()) {
      try {
        return { ...p, password: safeStorage.decryptString(Buffer.from(p.password, 'base64')), encrypted: true };
      } catch {
        return { ...p, password: '', encrypted: true, error: 'decrypt failed' };
      }
    }
    return p;
  });
}

let win = null;
/** @type {{id:number, view:WebContentsView, url:string, title:string}[]} */
let tabs = [];
let activeId = null;
let nextId = 1;

const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

function contentBounds() {
  const [w, h] = win.getContentSize();
  return { x: 0, y: 96, width: w, height: h - 96 }; // 96 = tabbar(40) + toolbar(56)
}

function createTab(url = 'breeze://newtab') {
  const view = new WebContentsView({
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      // 标签页也注入 preload，让新标签页能通过 IPC 读取壁纸等状态
      // （file:// 下 localStorage 不可靠，所以不走 localStorage）
      preload: path.join(__dirname, 'preload.js')
    }
  });
  view.webContents.setUserAgent(CHROME_UA);
  const id = nextId++;
  const tab = { id, view, url, title: 'New Tab' };
  tabs.push(tab);

  const wc = view.webContents;
  wc.on('page-title-updated', (_e, title) => { tab.title = title; sendTabs(); });
  wc.on('did-navigate', (_e, u) => { tab.url = u; sendTabs(); sendNav(); });
  wc.on('did-navigate-in-page', (_e, u) => { tab.url = u; sendTabs(); sendNav(); });
  wc.on('did-fail-load', () => sendNav());
  wc.setWindowOpenHandler(({ url: u }) => { createTab(u); return { action: 'deny' }; });

  win.contentView.addChildView(view);
  setActive(id);
  loadURL(tab, url);
  sendTabs();
  return tab;
}

function loadURL(tab, input) {
  let u = (input || '').trim();
  if (!u) u = 'breeze://newtab';
  if (u === 'breeze://newtab') {
    tab.view.webContents.loadFile(path.join(__dirname, '../renderer/newtab.html'));
    tab.url = 'breeze://newtab';
    tab.title = 'New Tab';
    return;
  }
  if (!/^[a-z]+:\/\//i.test(u)) {
    u = /^[\w-]+(\.[\w-]+)+(:\d+)?(\/\S*)?$/.test(u)
      ? 'https://' + u
      : 'https://www.google.com/search?q=' + encodeURIComponent(u);
  }
  tab.url = u;
  tab.view.webContents.loadURL(u).catch(() => {});
}

function setActive(id) {
  activeId = id;
  for (const t of tabs) t.view.setVisible(t.id === id);
  const t = tabs.find(t => t.id === id);
  if (t) {
    t.view.setBounds(contentBounds());
    t.view.setAutoResize({ width: true, height: true });
  }
  sendTabs(); sendNav();
}

function closeTab(id) {
  const i = tabs.findIndex(t => t.id === id);
  if (i < 0) return;
  const [t] = tabs.splice(i, 1);
  win.contentView.removeChildView(t.view);
  t.view.webContents.destroy();
  if (!tabs.length) { createTab(); return; }
  if (activeId === id) setActive(tabs[Math.max(0, i - 1)].id);
  sendTabs();
}

function sendTabs() {
  if (!win) return;
  win.webContents.send('tabs', tabs.map(t => ({ id: t.id, title: t.title, url: t.url, active: t.id === activeId })));
}
function sendNav() {
  if (!win) return;
  const t = tabs.find(t => t.id === activeId);
  if (!t) return;
  const wc = t.view.webContents;
  win.webContents.send('nav', {
    url: t.url,
    canBack: wc.canGoBack(),
    canFwd: wc.canGoForward()
  });
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 720,
    minHeight: 480,
    frame: false,                     // 无边框，自绘极简标题栏
    backgroundColor: '#0f1115',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  Menu.setApplicationMenu(null);      // 去掉默认菜单（“去掉不必要的功能”）
  win.loadFile(path.join(__dirname, '../renderer/chrome.html'));
  win.webContents.once('did-finish-load', () => {
    if (!tabs.length) createTab();
    win.webContents.send('state', loadState());
  });
  win.on('closed', () => { win = null; });
}

/* ---------------- IPC ---------------- */
ipcMain.on('tab:new', () => createTab());
ipcMain.on('tab:activate', (_e, id) => setActive(id));
ipcMain.on('tab:close', (_e, id) => closeTab(id));
ipcMain.on('nav:go', (_e, url) => { const t = tabs.find(t => t.id === activeId); if (t) loadURL(t, url); });
ipcMain.on('nav:back', () => { const t = tabs.find(t => t.id === activeId); if (t?.webContentsCanBack?.() ?? t?.view.webContents.canGoBack()) t.view.webContents.goBack(); sendNav(); });
ipcMain.on('nav:fwd', () => { const t = tabs.find(t => t.id === activeId); if (t?.view.webContents.canGoForward()) t.view.webContents.goForward(); sendNav(); });
ipcMain.on('nav:reload', () => { const t = tabs.find(t => t.id === activeId); t?.view.webContents.reload(); });
ipcMain.on('win:min', () => win?.minimize());
ipcMain.on('win:max', () => { if (win) win.isMaximized() ? win.unmaximize() : win.maximize(); });
ipcMain.on('win:close', () => win?.close());

/* ------------- 壁纸变更广播 ------------- */
// 用户切换壁纸后，让所有已打开的新标签页立即重绘
ipcMain.on('wallpaper:changed', () => {
  const s = loadState();
  for (const t of tabs) {
    if (t.url === 'breeze://newtab') {
      t.view.webContents.send('wallpaper:apply', {
        wallpaper: s.wallpaper,
        customWallpaper: s.customWallpaper
      });
    }
  }
});

ipcMain.handle('state:get', () => {
  const s = loadState();
  // 内存中解密密码供 UI 使用；磁盘上始终是密文
  return { ...s, passwords: decryptPasswords(s), encryptionAvailable: safeStorage.isEncryptionAvailable() };
});
ipcMain.handle('state:set', (_e, patch) => saveState(patch));

ipcMain.handle('bookmark:add', (_e, bm) => {
  const s = loadState();
  if (!s.bookmarks.some(b => b.url === bm.url)) s.bookmarks.push(bm);
  return saveState({ bookmarks: s.bookmarks });
});
ipcMain.handle('bookmark:remove', (_e, url) => {
  const s = loadState();
  return saveState({ bookmarks: s.bookmarks.filter(b => b.url !== url) });
});

/* ------------- Chrome 数据导入（书签/历史） ------------- */
const { importChrome, importPasswordsCsv } = require('./chrome-import');
const { dialog } = require('electron');
ipcMain.handle('chrome:import', async () => {
  const result = await importChrome();
  if (result.bookmarks?.length) {
    const s = loadState();
    const known = new Set(s.bookmarks.map(b => b.url));
    for (const b of result.bookmarks) if (!known.has(b.url)) s.bookmarks.push(b);
    saveState({ bookmarks: s.bookmarks });
  }
  return { bookmarks: result.bookmarks?.length ?? 0, history: result.history?.length ?? 0, note: result.note };
});

/* ------------- 密码 CSV 导入 ------------- */
// Chrome 的 "Login Data" 密码在本地是加密的（Win: DPAPI/App-Bound，mac: Keychain），
// 第三方应用无法可靠解密，所以只支持 Chrome **导出**的 CSV。
ipcMain.handle('chrome:import-passwords', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: '选择 Chrome 导出的密码 CSV',
    filters: [{ name: 'CSV', extensions: ['csv'] }],
    properties: ['openFile']
  });
  if (canceled || !filePaths?.length) return { passwords: [], note: 'cancelled' };
  const result = await importPasswordsCsv(filePaths[0]);
  if (result.passwords?.length) {
    const s = loadState();
    const known = new Set((s.passwords || []).map(p => `${p.url}|${p.username}`));
    for (const p of result.passwords) {
      const key = `${p.url}|${p.username}`;
      if (!known.has(key)) { (s.passwords ||= []).push(p); known.add(key); }
    }
    saveState({ passwords: s.passwords }); // saveState 内部会加密
  }
  return {
    count: result.passwords?.length ?? 0,
    note: result.note,
    encrypted: safeStorage.isEncryptionAvailable()
  };
});

app.whenReady().then(() => {
  // 隐私 sensible defaults：禁第三方 cookie 跟踪以外的强干预留给用户
  session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
