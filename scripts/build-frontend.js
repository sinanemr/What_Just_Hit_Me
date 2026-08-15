"use strict";
/**
 * Copies ONLY the web game files into ./dist so the Tauri bundle contains the
 * client and none of the dev-only files (server/, node_modules/, installers, docs).
 * Tauri's beforeBuildCommand / beforeDevCommand runs this automatically.
 */

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const dist = path.join(root, "dist");

// Everything the game needs to run in the webview:
const INCLUDE = ["RUN_GAME.html", "js", "css", "characters", "assets", "stages"];

function rmrf(p) { if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true }); }
function copyRec(src, dst) {
  const st = fs.statSync(src);
  if (st.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true });
    for (const name of fs.readdirSync(src)) copyRec(path.join(src, name), path.join(dst, name));
  } else {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
  }
}

rmrf(dist);
fs.mkdirSync(dist, { recursive: true });
for (const item of INCLUDE) {
  const s = path.join(root, item);
  if (fs.existsSync(s)) copyRec(s, path.join(dist, item));
  else console.warn("build-frontend: WARNING missing", item);
}

// Tauri opens RUN_GAME.html directly (see tauri.conf.json window url); this
// index.html is just a courtesy redirect for any tool that expects one.
fs.writeFileSync(
  path.join(dist, "index.html"),
  '<!doctype html><meta http-equiv="refresh" content="0; url=RUN_GAME.html">\n'
);

console.log("build-frontend: game client copied into dist/");
