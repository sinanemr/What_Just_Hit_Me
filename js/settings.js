/**
 * What Just Hit Me — settings model (plain <script>, loaded AFTER controls.js and
 * BEFORE engine.js). Defines the settings data, safe load/save/merge, validation,
 * the active/pending pair, "effective" helpers the engine reads each frame, and
 * applySettings() which pushes values into the live game systems.
 *
 * No audio settings exist because the game has no audio system.
 */
"use strict";

const SETTINGS_STORAGE_KEY = "what-just-hit-me-settings-v1";

const DEFAULT_SETTINGS = {
  match: {
    cpuDifficulty: 1,        // 0 Novice, 1 Warrior, 2 Celestial, 3 Practice
    roundTime: 60,           // 30 | 60 | 90 | "unlimited"
    roundsToWin: 2,          // 1 | 2 | 3
    pauseOnFocusLoss: true
  },
  // Player-1 defaults MUST match controls.js; Player-2 preserved from 13.2.
  controls: {
    p1: { left:"a", right:"d", jump:" ", block:"u", crouch:"s", attack:"i", abilities:["j","k","l"], ultimate:"o" },
    p2: { left:"arrowleft", right:"arrowright", jump:"arrowup", block:"i", crouch:"arrowdown", attack:"k", abilities:["l","o","p"], ultimate:"m" }
  },
  visuals: {
    fullscreen: false,
    screenShake: 70,         // 0..100
    backgroundAnimation: true,
    combatText: true,
    controlHelper: "always", // always | menus | off
    renderQuality: "quality",// performance | balanced | quality | ultra  (supersample / resolution)
    showPerf: false,         // FPS + main-thread CPU/frame-time overlay
    showHitboxes: false      // DEV: draw authored hit/hurt/attack boxes on the fighters (F1)
  },
  accessibility: {
    reduceMotion: false,
    reducedFlashing: false,
    largeMenuText: false,
    alwaysShowPlayerLabels: true
  },
  practice: {
    dummyBehavior: "stand",  // stand | fight | block
    playerHealth: "normal",  // normal | infinite
    dummyHealth: "normal",   // normal | infinite
    energy: "infinite",      // normal | infinite
    cooldowns: "disabled"    // normal | disabled
  }
};

/* ---------------- clone / merge / validate ---------------- */
function cloneSettings(s){ return (typeof structuredClone==="function") ? structuredClone(s) : JSON.parse(JSON.stringify(s)); }

/** Deep-merge saved values onto a fresh default, keeping only known keys. */
function mergeSettings(base, saved){
  if(!saved || typeof saved!=="object") return base;
  for(const k of Object.keys(base)){
    if(!(k in saved)) continue;
    const bv=base[k], sv=saved[k];
    if(Array.isArray(bv)){ if(Array.isArray(sv)) base[k]=sv.slice(); }
    else if(bv && typeof bv==="object"){ base[k]=mergeSettings(bv, sv); }
    else if(sv!==null && typeof sv!=="object" && !Array.isArray(sv)) base[k]=sv;
  }
  return base;
}

const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const oneOf=(v,arr,fb)=>arr.includes(v)?v:fb;

/** Coerce every field into a valid value (replacing junk with defaults). */
function validateSettings(s){
  const d=DEFAULT_SETTINGS;
  s.match.cpuDifficulty = oneOf(+s.match.cpuDifficulty,[0,1,2,3],1);
  s.match.roundTime = (s.match.roundTime==="unlimited") ? "unlimited" : oneOf(+s.match.roundTime,[30,60,90],60);
  s.match.roundsToWin = oneOf(+s.match.roundsToWin,[1,2,3],2);
  s.match.pauseOnFocusLoss = !!s.match.pauseOnFocusLoss;
  for(const p of ["p1","p2"]){
    const c=s.controls[p], dc=d.controls[p];
    for(const key of ["left","right","jump","block","crouch","attack","ultimate"])
      if(typeof c[key]!=="string") c[key]=dc[key];
    if(!Array.isArray(c.abilities)||c.abilities.length!==3||!c.abilities.every(x=>typeof x==="string"))
      c.abilities=dc.abilities.slice();
  }
  s.visuals.fullscreen = !!s.visuals.fullscreen;
  s.visuals.screenShake = clamp(Math.round(+s.visuals.screenShake||0),0,100);
  s.visuals.backgroundAnimation = !!s.visuals.backgroundAnimation;
  s.visuals.combatText = !!s.visuals.combatText;
  s.visuals.controlHelper = oneOf(s.visuals.controlHelper,["always","menus","off"],"always");
  s.visuals.renderQuality = oneOf(s.visuals.renderQuality,["performance","balanced","quality","ultra"],"quality");
  s.visuals.showPerf = !!s.visuals.showPerf;
  s.visuals.showHitboxes = !!s.visuals.showHitboxes;
  s.accessibility.reduceMotion = !!s.accessibility.reduceMotion;
  s.accessibility.reducedFlashing = !!s.accessibility.reducedFlashing;
  s.accessibility.largeMenuText = !!s.accessibility.largeMenuText;
  s.accessibility.alwaysShowPlayerLabels = !!s.accessibility.alwaysShowPlayerLabels;
  s.practice.dummyBehavior = oneOf(s.practice.dummyBehavior,["stand","fight","block"],"stand");
  s.practice.playerHealth = oneOf(s.practice.playerHealth,["normal","infinite"],"normal");
  s.practice.dummyHealth = oneOf(s.practice.dummyHealth,["normal","infinite"],"normal");
  s.practice.energy = oneOf(s.practice.energy,["normal","infinite"],"infinite");
  s.practice.cooldowns = oneOf(s.practice.cooldowns,["normal","disabled"],"disabled");
  return s;
}

/* ---------------- load / save ---------------- */
function loadSettings(){
  try{
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if(!raw) return cloneSettings(DEFAULT_SETTINGS);
    return validateSettings(mergeSettings(cloneSettings(DEFAULT_SETTINGS), JSON.parse(raw)));
  }catch(e){ console.error("Could not load settings:",e); return cloneSettings(DEFAULT_SETTINGS); }
}
function saveSettings(s){
  try{ localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(s)); }
  catch(e){ console.error("Could not save settings:",e); }
}

/* ---------------- active / pending ---------------- */
let activeSettings = loadSettings();
let pendingSettings = cloneSettings(activeSettings);

/* ---------------- effective helpers (read by the engine each frame) ---------------- */
function getRoundTimeValue(v){ return v==="unlimited" ? Infinity : Number(v); }
function SETTINGS_shakeScale(){ return activeSettings.accessibility.reduceMotion ? 0 : activeSettings.visuals.screenShake/100; }
function SETTINGS_bgAnim(){ return !activeSettings.accessibility.reduceMotion && activeSettings.visuals.backgroundAnimation; }
function SETTINGS_combatText(){ return activeSettings.visuals.combatText; }
/* Render-quality presets -> ssaa (supersample factor above device res) + maxss (density cap).
   Lower = cheaper/blurrier, higher = sharper/heavier. Read by renderGame each frame. */
const RENDER_QUALITY_PRESETS = {
  performance: { ssaa:1.0,  maxss:2.0 },
  balanced:    { ssaa:1.25, maxss:3.0 },
  quality:     { ssaa:1.4,  maxss:3.5 },
  ultra:       { ssaa:1.8,  maxss:4.0 }
};
function SETTINGS_renderQuality(){ return RENDER_QUALITY_PRESETS[activeSettings.visuals.renderQuality] || RENDER_QUALITY_PRESETS.quality; }
function SETTINGS_showPerf(){ return !!activeSettings.visuals.showPerf; }
function SETTINGS_showHitboxes(){ return !!activeSettings.visuals.showHitboxes; }
function SETTINGS_reducedFlashing(){ return activeSettings.accessibility.reducedFlashing; }
function SETTINGS_playerLabels(){ return activeSettings.accessibility.alwaysShowPlayerLabels; }
/* Practice-mode infinite health for a given fighter (dummy = the CPU side). */
function SETTINGS_practiceInfiniteHP(f){
  if(typeof cpuDiff==="undefined"||cpuDiff!==3) return false;
  return (f.ctrl==="cpu") ? activeSettings.practice.dummyHealth==="infinite"
                          : activeSettings.practice.playerHealth==="infinite";
}
/* match-start values (read when a match begins) */
function SETTINGS_roundTime(){ return getRoundTimeValue(activeSettings.match.roundTime); }
function SETTINGS_roundsToWin(){ return activeSettings.match.roundsToWin; }

/* ---------------- apply pending/active into live game systems ---------------- */
/** Rebuild the engine's key snapshots + on-screen labels from CONTROLS. Safe to
 *  call any time after engine.js has loaded (references its globals lazily). */
function SETTINGS_applyControls(s){
  // During an online match, clear any held actions before remapping so no key
  // stays "stuck" against the new bindings.
  if(typeof onlineIsMatchActive==="function" && onlineIsMatchActive()){
    if(typeof keys!=="undefined") for(const k in keys) keys[k]=false;
    if(typeof ONLINE!=="undefined"){ ONLINE.localPrevActions={}; }
  }
  // push saved bindings into the shared CONTROLS object (controls.js)
  CONTROLS.p1 = cloneSettings(s.controls.p1);
  CONTROLS.p2 = cloneSettings(s.controls.p2);
  // rebuild the engine's key snapshots in place (P1KEYS/P2KEYS are const objects)
  if(typeof P1KEYS!=="undefined"){ Object.assign(P1KEYS, toEngineKeys("p1")); }
  if(typeof P2KEYS!=="undefined"){ Object.assign(P2KEYS, toEngineKeys("p2")); }
  // rebuild HUD/select label snapshots
  if(typeof AB_LABELS!=="undefined"){ AB_LABELS.p1=abilityLabels("p1"); AB_LABELS.p2=abilityLabels("p2"); AB_LABELS.cpu=abilityLabels("p2"); }
  if(typeof ULT_KEY!=="undefined"){ ULT_KEY.p1=ultimateLabel("p1"); ULT_KEY.p2=ultimateLabel("p2"); ULT_KEY.cpu=ultimateLabel("p2"); }
  // refresh title/fight helper text + the select-screen bio panels
  if(typeof refreshControlLabels==="function") refreshControlLabels();
  if(typeof refreshSelect==="function") refreshSelect();
}

/** Apply DOM-level visual/accessibility settings (body classes, control-helper visibility). */
function SETTINGS_applyVisualDom(s){
  document.body.classList.toggle("large-menu-text", s.accessibility.largeMenuText);
  document.body.classList.toggle("reduced-flashing", s.accessibility.reducedFlashing || s.accessibility.reduceMotion);
  const helper = s.visuals.controlHelper;
  const title = document.getElementById("titleCtrlHelp");
  const fight = document.getElementById("fightCtrlHelp");
  if(title) title.style.display = (helper==="off") ? "none" : "";
  if(fight) fight.style.display = (helper==="always") ? "" : "none";
}

/** Sync CPU difficulty into the game + both dropdowns. */
function SETTINGS_applyCpu(s){
  if(typeof cpuDiff!=="undefined") cpuDiff = s.match.cpuDifficulty;   // (global assignment; cpuDiff is a `let` in engine.js)
  const a=document.getElementById("diffSel"), b=document.getElementById("pauseDiffSel");
  if(a) a.value=String(s.match.cpuDifficulty);
  if(b) b.value=String(s.match.cpuDifficulty);
}

async function SETTINGS_applyFullscreen(enabled){
  const app=document.getElementById("app");
  try{
    if(enabled && !document.fullscreenElement){
      await app.requestFullscreen();
      /* Keyboard Lock (Chrome/Edge): a quick Esc is delivered to the game (so it pauses)
         instead of leaving fullscreen; the browser only exits if Esc is held down. */
      try{ if(navigator.keyboard && navigator.keyboard.lock) await navigator.keyboard.lock(["Escape"]); }catch(e){}
    }else if(!enabled && document.fullscreenElement){
      try{ if(navigator.keyboard && navigator.keyboard.unlock) navigator.keyboard.unlock(); }catch(e){}
      await document.exitFullscreen();
    }
  }catch(e){ console.error("Fullscreen failed:",e); }
}

/** Apply everything that can take effect immediately (round time / rounds-to-win are read at match start). */
function applySettings(s){
  activeSettings = cloneSettings(s);
  SETTINGS_applyControls(activeSettings);
  SETTINGS_applyCpu(activeSettings);
  SETTINGS_applyVisualDom(activeSettings);
  SETTINGS_applyFullscreen(activeSettings.visuals.fullscreen);
}

function resetPendingToDefaults(){ pendingSettings = cloneSettings(DEFAULT_SETTINGS); }
