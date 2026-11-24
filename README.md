# AFTERLIGHT 데스크톱 (Electron 래퍼)

웹용 WebGL 빌드(`~/workspace/xgame-unity/out/afterlight`)를 그대로 앱 안에 담아 로컬 HTTP 서버(127.0.0.1:39617+)로 띄운다.
판정은 웹과 똑같이 브라우저 안 `sim.js`, 온라인은 `wss://xgame.ai/rt/afterlight/ws` — 웹 플레이어와 같은 방.

- 로그인: 메뉴 `AFTERLIGHT › 로그인` 또는 게임 안 `xgame.ai 로그인` 버튼 → 앱 안 창에서 xgame.ai/app 로그인 → `xg_token` 을 받아 `userData/session.json` 에 보관 → preload 가 `window.AL_CFG` 로 게임에 전달 (al-host.js 가 읽음)
- 갱신: `./sync-game.sh` (out/afterlight → game/) → `npm run dist:mac` / `dist:win` → `dist/`
- 시험: `node Tools/desk.mjs /tmp/x '[steps]'` (CDP). 환경 `AL_RT`(로컬 서버) · `AL_TOK`(토큰) · `AL_QUERY`(`?online=ko`) · `AL_APP`(패키지된 실행 파일)
- 서명·공증은 아직 없음 (`mac.identity: null`). 배포 전 Developer ID 로 서명 필요.
