// Electron 앱을 띄워 CDP 로 조작·스크린샷 (afterlight-unity/Tools/play.mjs 와 같은 steps 형식)
// node Tools/desk.mjs <outPrefix> [steps-json]   — 앱은 이 폴더의 main.js 를 씀. 환경 AL_APP=<.app 경로> 면 패키지된 앱을 띄운다
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
const [out, stepsJson] = process.argv.slice(2);
const steps = stepsJson ? JSON.parse(stepsJson) : [{wait: 12000}, {shot: "a"}];
const port = 9400 + Math.floor(Math.random() * 400);
const bin = process.env.AL_APP ? process.env.AL_APP : "node_modules/.bin/electron";
const args = process.env.AL_APP ? [`--remote-debugging-port=${port}`] : [".", `--remote-debugging-port=${port}`];
const child = spawn(bin, args, {stdio: ["ignore", "pipe", "pipe"], env: Object.assign({}, process.env, {AL_TEST: "1"})});
const sleep = ms => new Promise(r => setTimeout(r, ms));
const plogs = []; child.stdout.on("data", d => plogs.push("out: " + d)); child.stderr.on("data", d => plogs.push("err: " + d));
let ws, id = 0; const pend = new Map(), logs = [];
for (let i = 0; i < 100; i++) { try { const l = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); const p = l.find(t => t.type === "page" && /127\.0\.0\.1/.test(t.url)); if (p) { ws = new WebSocket(p.webSocketDebuggerUrl); break; } } catch {} await sleep(300); }
if (!ws) { console.log("no page", plogs.join("")); child.kill(); process.exit(1); }
await new Promise(r => ws.onopen = r);
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result || m.error); pend.delete(m.id); }
  else if (m.method === "Runtime.consoleAPICalled") logs.push(m.params.type + ": " + m.params.args.map(a => a.value ?? a.description).join(" "));
  else if (m.method === "Runtime.exceptionThrown") logs.push("EXC: " + JSON.stringify(m.params.exceptionDetails).slice(0, 400)); };
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({id: i, method, params})); });
await send("Runtime.enable"); await send("Page.enable");
const KEYS = {w: ["KeyW", 87], a: ["KeyA", 65], s: ["KeyS", 83], d: ["KeyD", 68], q: ["KeyQ", 81], shift: ["ShiftLeft", 16], r: ["KeyR", 82]};
async function key(type, k) { const [code, vk] = KEYS[k]; await send("Input.dispatchKeyEvent", {type, code, key: k === "shift" ? "Shift" : k, windowsVirtualKeyCode: vk}); }
async function mouse(type, x, y, button = "none") { await send("Input.dispatchMouseEvent", {type, x, y, button, clickCount: 1}); }
for (const s of steps) {
  if (s.wait) await sleep(s.wait);
  if (s.down) await key("keyDown", s.down);
  if (s.up) await key("keyUp", s.up);
  if (s.move) await mouse("mouseMoved", s.move[0], s.move[1]);
  if (s.mdown) await mouse("mousePressed", s.mdown[0], s.mdown[1], "left");
  if (s.mup) await mouse("mouseReleased", s.mup[0], s.mup[1], "left");
  if (s.eval) logs.push("eval: " + JSON.stringify((await send("Runtime.evaluate", {expression: s.eval, returnByValue: true})).result?.value));
  if (s.pages) { try { const l = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); logs.push("pages: " + l.map(t => t.type + " " + t.url).join(" | ")); } catch (e) { logs.push("pages: err"); } }
  if (s.shot) { const r = await send("Page.captureScreenshot", {format: "png"}); writeFileSync(`${out}-${s.shot}.png`, Buffer.from(r.data, "base64")); }
}
console.log(logs.filter(l => !/^(log|debug): (\[UnityCache\]|Loading player)|sound which/.test(l)).slice(-30).join("\n"));
console.log(plogs.slice(-5).join(""));
ws.close(); child.kill();
