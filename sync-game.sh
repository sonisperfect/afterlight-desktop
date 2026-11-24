#!/bin/zsh
# 웹용 빌드(out/afterlight, br 압축)를 그대로 game/ 에 복사 — 앱 안의 로컬 서버가 Content-Encoding: br 로 낸다
set -e
SRC=${1:-$HOME/workspace/xgame-unity/out/afterlight}
rm -rf game && mkdir -p game
export COPYFILE_DISABLE=1
cp -R "$SRC"/Build "$SRC"/TemplateData "$SRC"/StreamingAssets "$SRC"/index.html game/
du -sh game
