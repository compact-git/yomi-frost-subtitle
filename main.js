/* Yomi Frost 字幕(補助exe) v2.7.0
 * Yomi Frost Web から字幕のデータを受け取り(127.0.0.1 の WebSocket)、
 * 自分の画面に「枠なし・透明・最前面・クリックが通り抜ける」窓で表示する。
 */
'use strict';
const { app, BrowserWindow, Tray, Menu, screen, globalShortcut, ipcMain, dialog, shell, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { WebSocketServer } = require('ws');

const VERSION = app.getVersion();
const SHORTCUT = 'Control+Alt+Y';
const DEFAULT_ORIGINS = ['https://yomi.rider.tokyo', 'https://*.pages.dev', 'http://localhost:*', 'http://127.0.0.1:*'];

// ---------- 設定(ユーザーデータのフォルダに保存) ----------
let cfgPath = '';
let cfg = { port: 50210, displayId: null, bounds: null, origins: DEFAULT_ORIGINS, visible: true };
function loadCfg() {
  cfgPath = path.join(app.getPath('userData'), 'config.json');
  try { Object.assign(cfg, JSON.parse(fs.readFileSync(cfgPath, 'utf8'))); } catch (e) { /* 初回 */ }
  if (!Array.isArray(cfg.origins) || !cfg.origins.length) cfg.origins = DEFAULT_ORIGINS;
}
function saveCfg() { try { fs.mkdirSync(path.dirname(cfgPath), { recursive: true }); fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2)); } catch (e) {} }

/** 接続してよいページか(ほかのサイトから勝手に字幕を出されないように) */
function originOk(origin) {
  if (!origin || origin === 'null') return false;
  return cfg.origins.some(p => {
    const re = new RegExp('^' + p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*') + '$', 'i');
    return re.test(origin);
  });
}

// ---------- 窓 ----------
let win = null, tray = null, wss = null, editing = false, clients = 0, lastPayload = null;
function targetDisplay() {
  const all = screen.getAllDisplays();
  return all.find(d => d.id === cfg.displayId) || screen.getPrimaryDisplay();
}
function fullBounds() { return targetDisplay().bounds; }
function createWindow() {
  const b = cfg.bounds || fullBounds();
  win = new BrowserWindow({
    x: b.x, y: b.y, width: b.width, height: b.height,
    transparent: true, frame: false, hasShadow: false, resizable: false, movable: false,
    skipTaskbar: true, focusable: false, alwaysOnTop: true, show: false, backgroundColor: '#00000000',
    title: 'Yomi Frost 字幕', icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, backgroundThrottling: false },
  });
  win.setAlwaysOnTop(true, 'screen-saver');           // 全画面のゲームなどより手前に
  win.setVisibleOnAllWorkspaces(true);
  win.setIgnoreMouseEvents(true, { forward: true });  // クリックは後ろの窓へ通り抜ける
  win.loadFile(path.join(__dirname, 'overlay.html'));
  win.once('ready-to-show', () => { if (cfg.visible !== false) win.showInactive(); sendState(); });
  const remember = () => { if (editing && win) { cfg.bounds = win.getBounds(); saveCfg(); } };
  win.on('moved', remember); win.on('resized', remember);
  win.on('closed', () => { win = null; });
}
function setEditing(on) {
  editing = !!on;
  if (!win) return;
  if (editing && !win.isVisible()) { win.showInactive(); cfg.visible = true; }
  win.setIgnoreMouseEvents(!editing, { forward: true });
  win.setResizable(editing); win.setMovable(editing); win.setFocusable(editing);
  if (editing) win.focus();
  sendState(); buildMenu();
}
function sendState() {
  if (win) win.webContents.send('state', { editing, clients, port: cfg.port, version: VERSION, shortcut: 'Ctrl+Alt+Y' });
}
function resetBounds() {
  cfg.bounds = null; saveCfg();
  if (win) win.setBounds(fullBounds());
}
function setVisible(v) {
  cfg.visible = v; saveCfg();
  if (!win) return;
  if (v) win.showInactive(); else win.hide();
  buildMenu();
}

// ---------- トレイ ----------
function buildMenu() {
  if (!tray) return;
  const displays = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay().id;
  const cur = targetDisplay().id;
  const menu = Menu.buildFromTemplate([
    { label: `Yomi Frost 字幕 v${VERSION}`, enabled: false },
    { label: clients ? `🟢 アプリと接続中(${clients})` : `⚪ アプリを待っています(ポート ${cfg.port})`, enabled: false },
    { type: 'separator' },
    { label: '字幕を表示する', type: 'checkbox', checked: cfg.visible !== false, click: m => setVisible(m.checked) },
    { label: `位置とサイズを調整する(${'Ctrl+Alt+Y'})`, type: 'checkbox', checked: editing, click: m => setEditing(m.checked) },
    { label: '画面いっぱいに戻す', click: resetBounds },
    {
      label: '表示するモニター', submenu: displays.map((d, i) => ({
        label: `モニター${i + 1}(${d.size.width}×${d.size.height})${d.id === primary ? ' ・メイン' : ''}`, type: 'radio', checked: d.id === cur,
        click: () => { cfg.displayId = d.id; cfg.bounds = null; saveCfg(); if (win) win.setBounds(fullBounds()); buildMenu(); },
      })),
    },
    { type: 'separator' },
    { label: '設定ファイルを開く(ポート・許可するサイト)', click: () => { saveCfg(); shell.openPath(cfgPath); } },
    { label: '終了', click: () => app.quit() },
  ]);
  tray.setContextMenu(menu);
  tray.setToolTip(clients ? 'Yomi Frost 字幕:アプリと接続中' : 'Yomi Frost 字幕:アプリを待っています');
}

// ---------- WebSocket サーバー(127.0.0.1 だけで待つ) ----------
function startServer() {
  wss = new WebSocketServer({
    host: '127.0.0.1', port: cfg.port, maxPayload: 4 * 1024 * 1024,
    verifyClient: (info, cb) => { const ok = originOk(info.origin); if (!ok) console.warn('拒否:', info.origin); cb(ok, 403, 'Forbidden origin'); },
  });
  wss.on('connection', ws => {
    clients++; sendState(); buildMenu();
    ws.send(JSON.stringify({ app: 'yomifrost-exe', version: VERSION }));
    if (lastPayload && win) win.webContents.send('payload', lastPayload);
    ws.on('message', raw => {
      let d; try { d = JSON.parse(String(raw)); } catch (e) { return; }
      if (!d || d.app !== 'yomifrost' || !d.boxes) return;
      lastPayload = d;
      if (win) win.webContents.send('payload', d);
    });
    ws.on('close', () => { clients = Math.max(0, clients - 1); sendState(); buildMenu(); });
  });
  wss.on('error', e => {
    if (e.code === 'EADDRINUSE') {
      dialog.showErrorBox('Yomi Frost 字幕', `ポート ${cfg.port} がほかのアプリで使われています。\nYomi Frost 字幕がもう起動していないか確認してね。\n(ポートは トレイ →「設定ファイルを開く」で変えられます。アプリ側のポートも同じにしてね)`);
      app.quit();
    } else console.error(e);
  });
}

// ---------- 起動 ----------
if (!app.requestSingleInstanceLock()) { app.quit(); }
else {
  app.on('second-instance', () => { setEditing(true); });
  app.whenReady().then(() => {
    loadCfg();
    createWindow();
    tray = new Tray(nativeImage.createFromPath(path.join(__dirname, 'tray.png')));
    tray.on('click', () => tray.popUpContextMenu());
    buildMenu();
    startServer();
    globalShortcut.register(SHORTCUT, () => setEditing(!editing));
    ipcMain.on('end-edit', () => setEditing(false));
    screen.on('display-removed', () => { if (!cfg.bounds && win) win.setBounds(fullBounds()); buildMenu(); });
    screen.on('display-added', buildMenu);
  });
  app.on('will-quit', () => { globalShortcut.unregisterAll(); if (wss) wss.close(); });
  app.on('window-all-closed', () => app.quit());
}
