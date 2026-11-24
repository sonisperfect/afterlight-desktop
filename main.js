// AFTERLIGHT 데스크톱 — 같은 WebGL 빌드를 앱 안의 로컬 HTTP 서버로 띄운다 (sim.js 구조 그대로).
// 로그인: xgame.ai 로그인 창을 앱 안에서 열고 localStorage xg_token 을 받아 보관 → preload 가 window.AL_CFG 로 게임에 준다.
"use strict";
const {app, BrowserWindow, ipcMain, shell, session, Menu, dialog} = require("electron");
const http = require("http"), fs = require("fs"), path = require("path");

const XGAME = process.env.AL_XGAME || "https://xgame.ai", RT = process.env.AL_RT || "wss://xgame.ai/rt/afterlight/ws", PORT_BASE = 39617;   // AL_RT/AL_TOK 는 로컬 서버 시험용
const GAME_DIR = app.isPackaged ? path.join(process.resourcesPath, "game") : path.join(__dirname, "game");
const STORE = () => path.join(app.getPath("userData"), "session.json");
let token = null, port = 0, win = null, loginWin = null;

function loadToken() { try { token = JSON.parse(fs.readFileSync(STORE(), "utf8")).token || null; } catch (e) { token = null; } }
function saveToken(t) { token = t || null; try { fs.mkdirSync(app.getPath("userData"), {recursive: true}); fs.writeFileSync(STORE(), JSON.stringify({token, at: Date.now()})); } catch (e) { /* 저장 실패해도 세션은 유지 */ } }

// ---- 로컬 정적 서버: Build/*.br 는 Content-Encoding: br, 나머지는 그대로. 127.0.0.1 만 받는다.
const MIME = {".html": "text/html; charset=utf-8", ".js": "application/javascript", ".json": "application/json", ".wasm": "application/wasm", ".data": "application/octet-stream",
  ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".wav": "audio/wav", ".css": "text/css", ".ico": "image/x-icon", ".txt": "text/plain", ".svg": "image/svg+xml"};
function serve(req, res) {
  let p = decodeURIComponent((req.url || "/").split("?")[0]); if (p === "/" || p === "") p = "/index.html";
  const file = path.normalize(path.join(GAME_DIR, p));
  if (!file.startsWith(GAME_DIR) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end("not found"); return; }
  let ext = path.extname(file), enc = null;
  if (ext === ".br") { enc = "br"; ext = path.extname(file.slice(0, -3)); } else if (ext === ".gz") { enc = "gzip"; ext = path.extname(file.slice(0, -3)); }
  const st = fs.statSync(file), h = {"Content-Type": MIME[ext] || "application/octet-stream", "Content-Length": st.size, "Cache-Control": "no-cache", "Access-Control-Allow-Origin": "*"};
  if (enc) h["Content-Encoding"] = enc;
  res.writeHead(200, h);
  if (req.method === "HEAD") { res.end(); return; }
  fs.createReadStream(file).pipe(res);
}
function listen(p) { return new Promise((ok, no) => { const s = http.createServer(serve); s.once("error", no); s.listen(p, "127.0.0.1", () => ok(s)); }); }
async function startServer() { for (let i = 0; i < 20; i++) { try { await listen(PORT_BASE + i); port = PORT_BASE + i; return; } catch (e) { /* 다음 포트 */ } } throw new Error("포트 없음"); }

// ---- 게임 창
function gameUrl() { return `http://127.0.0.1:${port}/index.html` + (process.env.AL_QUERY || ""); }   // AL_QUERY: 시험용 깊은 링크 (?online=ko 등)
function createGame() {
  win = new BrowserWindow({width: 1600, height: 900, useContentSize: true, minWidth: 960, minHeight: 540, backgroundColor: "#05070d", title: "AFTERLIGHT", show: false, autoHideMenuBar: true,
    webPreferences: {preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false, sandbox: false, backgroundThrottling: false}});
  win.once("ready-to-show", () => { win.show(); if (process.env.AL_TEST) { win.setIgnoreMouseEvents(true); win.blur(); } });   // 시험: 실제 마우스는 통과, CDP 입력만 받는다
  win.webContents.setWindowOpenHandler(({url}) => {      // 게임이 window.open("/app") 으로 로그인을 열면 앱 안 로그인 창으로, 그 밖의 링크는 바깥 브라우저로
    if (/\/app(\/|$|\?)/.test(url) && /127\.0\.0\.1|xgame\.ai/.test(url)) { openLogin(); return {action: "deny"}; }
    if (/^https?:/.test(url)) shell.openExternal(url);
    return {action: "deny"};
  });
  win.on("closed", () => { win = null; });
  win.loadURL(gameUrl());
}
// ---- 로그인 창: xgame.ai/app 을 열고 xg_token 이 생길 때까지 1초마다 본다
function openLogin() {
  if (loginWin) { loginWin.focus(); return; }
  loginWin = new BrowserWindow({width: 520, height: 760, parent: win || undefined, title: "xgame.ai 로그인", backgroundColor: "#0b0d14", autoHideMenuBar: true,
    webPreferences: {preload: path.join(__dirname, "login-preload.js"), contextIsolation: true, nodeIntegration: false, partition: "persist:xgame"}});
  loginWin.loadURL(XGAME + "/app?from=desktop");
  const timer = setInterval(async () => {
    if (!loginWin || loginWin.isDestroyed()) { clearInterval(timer); return; }
    try {
      const t = await loginWin.webContents.executeJavaScript('(function(){try{return localStorage.getItem("xg_token")}catch(e){return null}})()', true);
      if (t && t !== token) { saveToken(t); clearInterval(timer); setTimeout(() => { if (loginWin && !loginWin.isDestroyed()) loginWin.close(); if (win) win.webContents.send("al:token", t); }, 400); }
    } catch (e) { /* 페이지 이동 중 */ }
  }, 1000);
  loginWin.on("closed", () => { clearInterval(timer); loginWin = null; });
}
function logout() { saveToken(null); try { session.fromPartition("persist:xgame").clearStorageData(); } catch (e) { /* 무시 */ } if (win) win.webContents.send("al:token", null); }

ipcMain.on("al:cfg", ev => { ev.returnValue = {tok: token, rt: RT, xgame: XGAME, version: app.getVersion()}; });
ipcMain.on("al:login", () => openLogin());
ipcMain.on("al:logout", () => logout());
ipcMain.on("al:fullscreen", (ev, on) => { if (win) win.setFullScreen(on == null ? !win.isFullScreen() : !!on); });

app.commandLine.appendSwitch("ignore-gpu-blocklist");
app.commandLine.appendSwitch("enable-features", "SharedArrayBuffer");
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
app.whenReady().then(async () => {
  loadToken(); if (process.env.AL_TOK) token = process.env.AL_TOK;
  const tpl = [{label: "AFTERLIGHT", submenu: [{label: "로그인 / Sign in", click: openLogin}, {label: "로그아웃 / Sign out", click: logout}, {type: "separator"},
    {label: "전체 화면 / Fullscreen", accelerator: "F11", click: () => { if (win) win.setFullScreen(!win.isFullScreen()); }}, {type: "separator"}, {role: "quit"}]},
    {label: "View", submenu: [{role: "reload"}, {role: "toggleDevTools"}, {type: "separator"}, {role: "togglefullscreen"}]}];
  Menu.setApplicationMenu(Menu.buildFromTemplate(tpl));
  try { await startServer(); } catch (e) { dialog.showErrorBox("AFTERLIGHT", String(e)); app.quit(); return; }
  if (!fs.existsSync(path.join(GAME_DIR, "index.html"))) { dialog.showErrorBox("AFTERLIGHT", "게임 파일이 없습니다: " + GAME_DIR); app.quit(); return; }
  createGame();
  app.on("activate", () => { if (!win) createGame(); });
});
app.on("window-all-closed", () => app.quit());
