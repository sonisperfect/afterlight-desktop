// 게임 페이지에 window.AL_CFG 를 넣는다 — al-host.js 가 토큰·서버 주소·로그인 창 열기를 여기서 가져간다
const {contextBridge, ipcRenderer} = require("electron");
let cfg = ipcRenderer.sendSync("al:cfg");
ipcRenderer.on("al:token", (ev, t) => { cfg = Object.assign({}, cfg, {tok: t}); });
contextBridge.exposeInMainWorld("AL_CFG", {
  tok: () => (cfg && cfg.tok) || null,
  rt: cfg.rt, xgame: cfg.xgame, version: cfg.version, desktop: true,
  login: () => ipcRenderer.send("al:login"),
  logout: () => ipcRenderer.send("al:logout"),
  fullscreen: on => ipcRenderer.send("al:fullscreen", on),
});
