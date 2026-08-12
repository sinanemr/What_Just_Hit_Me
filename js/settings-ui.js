/**
 * What Just Hit Me — settings UI (plain <script>, loaded after engine + characters).
 * Builds the settings overlay, tab pages, control-remap capture, conflict dialogs,
 * and Apply / Cancel / Restore Defaults. Edits pendingSettings; Apply commits.
 */
"use strict";

let settingsReturnScreen = "title";
let capturingBtn = null;          // the .bind-btn currently waiting for a key

/* ---------- tiny DOM helpers ---------- */
function el(tag, cls, txt){ const e=document.createElement(tag); if(cls)e.className=cls; if(txt!=null)e.textContent=txt; return e; }

const DIFF_LABELS=["Novice","Warrior","Celestial","Practice"];
const ROUNDTIME_OPTS=[30,60,90,"unlimited"];
const ROUNDTIME_LABELS={30:"30 Seconds",60:"60 Seconds",90:"90 Seconds",unlimited:"Unlimited (∞)"};
const ROUNDS_LABELS={1:"1 — Single Round",2:"2 — Best of Three",3:"3 — Best of Five"};
const HELPER_OPTS=["always","menus","off"]; const HELPER_LABELS={always:"Always",menus:"Menus Only",off:"Off"};
const QUALITY_OPTS=["performance","balanced","quality","ultra"];
const QUALITY_LABELS={performance:"Performance",balanced:"Balanced",quality:"Quality",ultra:"Ultra"};
const P1_SLOTS=[["left","Move Left"],["right","Move Right"],["jump","Jump"],["block","Block"],["crouch","Crouch"],
  ["attack","Basic Attack"],["ab0","Ability 1"],["ab1","Ability 2"],["ab2","Ability 3"],["ultimate","Ultimate"]];

function inMatch(){ return (typeof running!=="undefined"&&running)&&!(typeof roundOver!=="undefined"&&roundOver); }

/* ---------- binding get/set on pendingSettings ---------- */
function getBind(player,slot){ const c=pendingSettings.controls[player];
  if(slot.startsWith("ab")) return c.abilities[+slot.slice(2)];
  return c[slot]; }
function setBind(player,slot,key){ const c=pendingSettings.controls[player];
  if(slot.startsWith("ab")) c.abilities[+slot.slice(2)]=key; else c[slot]=key; }
function slotAction(slot){ const m=P1_SLOTS.find(s=>s[0]===slot); return m?m[1]:slot; }
/* find which slot of `player` currently holds `key` (excluding `exceptSlot`) */
function findSlotWithKey(player,key,exceptSlot){
  for(const [slot] of P1_SLOTS){ if(slot===exceptSlot) continue; if(getBind(player,slot)===key) return slot; }
  return null;
}

/* ---------- overlay construction (once) ---------- */
let overlayBuilt=false;
function buildSettingsOverlay(){
  if(overlayBuilt) return; overlayBuilt=true;
  const ov=el("div"); ov.id="settingsOverlay";
  const panel=el("div","settings-panel");
  panel.appendChild(el("h2",null,"SETTINGS"));
  const body=el("div","settings-body");
  const tabsCol=el("div","settings-tabs");
  const content=el("div","settings-content");
  const TABS=[["match","MATCH"],["controls","CONTROLS"],["visuals","VISUALS"],["practice","PRACTICE"]];
  for(const [id,label] of TABS){
    const b=el("button","settings-tab",label); b.dataset.tab=id; b.tabIndex=0;
    b.addEventListener("click",()=>selectTab(id));
    tabsCol.appendChild(b);
    const pg=el("div","settings-page"); pg.dataset.page=id; content.appendChild(pg);
  }
  body.appendChild(tabsCol); body.appendChild(content);
  panel.appendChild(body);
  const footer=el("div","settings-footer");
  const bRestore=el("button","restore","RESTORE DEFAULTS"); bRestore.addEventListener("click",restoreDefaultsUI);
  const bCancel=el("button","cancel","CANCEL"); bCancel.addEventListener("click",cancelSettings);
  const bApply=el("button","apply","APPLY"); bApply.addEventListener("click",applySettingsUI);
  footer.appendChild(bRestore); footer.appendChild(bCancel); footer.appendChild(bApply);
  panel.appendChild(footer);
  ov.appendChild(panel);
  // Mount inside #app so the overlay is visible/clickable while #app is fullscreen.
  const host=document.getElementById("app")||document.body;
  host.appendChild(ov);
  // conflict/warn dialog
  const dlg=el("div"); dlg.id="settingsDialog";
  const box=el("div","settings-dialog-box"); const p=el("p"); p.id="settingsDialogMsg";
  const row=el("div","row"); const ok=el("button","ok"); ok.id="settingsDialogOk"; const no=el("button","no"); no.id="settingsDialogNo";
  row.appendChild(ok); row.appendChild(no); box.appendChild(p); box.appendChild(row); dlg.appendChild(box);
  host.appendChild(dlg);
  document.addEventListener("keydown",overlayKeyHandler,true);
}

/* ---------- widget builders ---------- */
function rowEl(labelText, subText){
  const r=el("div","settings-row"); const l=el("div","label",labelText);
  if(subText){ const s=el("span","sub",subText); l.appendChild(s); }
  const c=el("div","ctl"); r.appendChild(l); r.appendChild(c); r._label=l; r._ctl=c; return r;
}
function stepper(values,labels,cur,onChange){
  const w=el("div","stepper"); const dec=el("button",null,"<"); const val=el("div","val"); const inc=el("button",null,">");
  let i=Math.max(0,values.indexOf(cur));
  const paint=()=>{ val.textContent=labels[values[i]]!=null?labels[values[i]]:String(values[i]); };
  dec.addEventListener("click",()=>{ i=(i-1+values.length)%values.length; paint(); onChange(values[i]); });
  inc.addEventListener("click",()=>{ i=(i+1)%values.length; paint(); onChange(values[i]); });
  paint(); w.appendChild(dec); w.appendChild(val); w.appendChild(inc); return w;
}
function toggle(on,onChange){
  const b=el("button","toggle"+(on?" on":""),on?"ON":"OFF");
  b.addEventListener("click",()=>{ on=!on; b.classList.toggle("on",on); b.textContent=on?"ON":"OFF"; onChange(on); });
  return b;
}
function slider(val,onChange){
  const w=el("div","slider-wrap"); const s=document.createElement("input"); s.type="range"; s.min=0; s.max=100; s.value=val;
  const pct=el("div","pct",val+"%");
  s.addEventListener("input",()=>{ pct.textContent=s.value+"%"; onChange(+s.value); });
  w.appendChild(s); w.appendChild(pct); return w;
}

/* ---------- render each page from pendingSettings ---------- */
function markChanged(row,changed){ row.classList.toggle("changed",changed); }
function nextMatchTag(){ const t=el("span","next-match","APPLIES NEXT MATCH"); return t; }

function renderSettings(){
  const q=id=>document.querySelector('.settings-page[data-page="'+id+'"]');
  // MATCH ------------------------------------------------------------
  const m=q("match"); m.innerHTML="";
  { const r=rowEl("CPU Difficulty");
    r._ctl.appendChild(stepper([0,1,2,3],DIFF_LABELS,pendingSettings.match.cpuDifficulty,v=>{ pendingSettings.match.cpuDifficulty=v; markChanged(r,v!==activeSettings.match.cpuDifficulty); updatePracticeTabVisibility(); }));
    markChanged(r,pendingSettings.match.cpuDifficulty!==activeSettings.match.cpuDifficulty); m.appendChild(r); }
  { const r=rowEl("Round Time");
    r._ctl.appendChild(stepper(ROUNDTIME_OPTS,ROUNDTIME_LABELS,pendingSettings.match.roundTime,v=>{ pendingSettings.match.roundTime=v; refreshRow(r,pendingSettings.match.roundTime!==activeSettings.match.roundTime,true); }));
    refreshRow(r,pendingSettings.match.roundTime!==activeSettings.match.roundTime,true); m.appendChild(r); }
  { const r=rowEl("Rounds to Win");
    r._ctl.appendChild(stepper([1,2,3],ROUNDS_LABELS,pendingSettings.match.roundsToWin,v=>{ pendingSettings.match.roundsToWin=v; refreshRow(r,pendingSettings.match.roundsToWin!==activeSettings.match.roundsToWin,true); }));
    refreshRow(r,pendingSettings.match.roundsToWin!==activeSettings.match.roundsToWin,true); m.appendChild(r); }
  { const r=rowEl("Pause When Unfocused","Auto-pause the fight if the window loses focus");
    r._ctl.appendChild(toggle(pendingSettings.match.pauseOnFocusLoss,v=>{ pendingSettings.match.pauseOnFocusLoss=v; markChanged(r,v!==activeSettings.match.pauseOnFocusLoss); }));
    m.appendChild(r); }
  // CONTROLS ---------------------------------------------------------
  const c=q("controls"); c.innerHTML="";
  for(const player of ["p1","p2"]){
    const h=el("h3"+(player==="p2"?"":""),null,player==="p1"?"PLAYER 1":"PLAYER 2"); if(player==="p2") h.className="p2"; c.appendChild(h);
    for(const [slot,label] of P1_SLOTS){
      const r=el("div","bindrow"); r.appendChild(el("div","label",label));
      const btn=el("button","bind-btn"); btn.dataset.player=player; btn.dataset.slot=slot;
      btn.textContent=keyLabel(getBind(player,slot));
      btn.addEventListener("click",()=>startCapture(btn));
      r.appendChild(btn); c.appendChild(r);
    }
    const reset=el("button","settings-reset","RESET "+(player==="p1"?"PLAYER 1":"PLAYER 2"));
    reset.addEventListener("click",()=>{ pendingSettings.controls[player]=cloneSettings(DEFAULT_SETTINGS.controls[player]); renderSettings(); });
    c.appendChild(reset);
  }
  const rall=el("button","settings-reset","RESET ALL CONTROLS");
  rall.addEventListener("click",()=>{ pendingSettings.controls=cloneSettings(DEFAULT_SETTINGS.controls); renderSettings(); });
  c.appendChild(rall);
  // VISUALS ----------------------------------------------------------
  const v=q("visuals"); v.innerHTML="";
  { const r=rowEl("Fullscreen"); r._ctl.appendChild(toggle(pendingSettings.visuals.fullscreen,val=>{ pendingSettings.visuals.fullscreen=val; markChanged(r,val!==activeSettings.visuals.fullscreen); })); v.appendChild(r); }
  { const r=rowEl("Background Animation","Gulls, glitter, lighthouse glow (stage stays visible)"); r._ctl.appendChild(toggle(pendingSettings.visuals.backgroundAnimation,val=>{ pendingSettings.visuals.backgroundAnimation=val; markChanged(r,val!==activeSettings.visuals.backgroundAnimation); })); v.appendChild(r); }
  { const r=rowEl("Combat Text","Floating damage / status numbers"); r._ctl.appendChild(toggle(pendingSettings.visuals.combatText,val=>{ pendingSettings.visuals.combatText=val; markChanged(r,val!==activeSettings.visuals.combatText); })); v.appendChild(r); }
  { const r=rowEl("Control Helper"); r._ctl.appendChild(stepper(HELPER_OPTS,HELPER_LABELS,pendingSettings.visuals.controlHelper,val=>{ pendingSettings.visuals.controlHelper=val; markChanged(r,val!==activeSettings.visuals.controlHelper); })); v.appendChild(r); }
  { const r=rowEl("Render Quality","Supersampling / resolution — lower is faster, higher is sharper"); r._ctl.appendChild(stepper(QUALITY_OPTS,QUALITY_LABELS,pendingSettings.visuals.renderQuality,val=>{ pendingSettings.visuals.renderQuality=val; markChanged(r,val!==activeSettings.visuals.renderQuality); })); v.appendChild(r); }
  { const r=rowEl("Performance Overlay","Show FPS, main-thread CPU %, and resolution"); r._ctl.appendChild(toggle(pendingSettings.visuals.showPerf,val=>{ pendingSettings.visuals.showPerf=val; markChanged(r,val!==activeSettings.visuals.showPerf); })); v.appendChild(r); }
  { const r=rowEl("Hitbox Overlay (dev)","Draw authored hit / hurt / attack boxes on the fighters — also toggles with F1"); r._ctl.appendChild(toggle(pendingSettings.visuals.showHitboxes,val=>{ pendingSettings.visuals.showHitboxes=val; markChanged(r,val!==activeSettings.visuals.showHitboxes); })); v.appendChild(r); }
  // (Accessibility tab removed for now — the settings remain at their defaults in the model.)
  // PRACTICE ---------------------------------------------------------
  const pr=q("practice"); pr.innerHTML="";
  pr.appendChild(el("div","practice-note","These options apply while CPU Difficulty = Practice."));
  { const r=rowEl("Dummy Behavior"); r._ctl.appendChild(stepper(["stand","fight","block"],{stand:"Stand",fight:"Fight",block:"Block"},pendingSettings.practice.dummyBehavior,val=>pendingSettings.practice.dummyBehavior=val)); pr.appendChild(r); }
  { const r=rowEl("Player Health"); r._ctl.appendChild(stepper(["normal","infinite"],{normal:"Normal",infinite:"Infinite"},pendingSettings.practice.playerHealth,val=>pendingSettings.practice.playerHealth=val)); pr.appendChild(r); }
  { const r=rowEl("Dummy Health"); r._ctl.appendChild(stepper(["normal","infinite"],{normal:"Normal",infinite:"Infinite"},pendingSettings.practice.dummyHealth,val=>pendingSettings.practice.dummyHealth=val)); pr.appendChild(r); }
  { const r=rowEl("Energy"); r._ctl.appendChild(stepper(["normal","infinite"],{normal:"Normal",infinite:"Infinite"},pendingSettings.practice.energy,val=>pendingSettings.practice.energy=val)); pr.appendChild(r); }
  { const r=rowEl("Cooldowns"); r._ctl.appendChild(stepper(["normal","disabled"],{normal:"Normal",disabled:"Disabled"},pendingSettings.practice.cooldowns,val=>pendingSettings.practice.cooldowns=val)); pr.appendChild(r); }
  { const r=rowEl("Reset Positions"); const b=el("button","settings-reset","RESET"); b.style.marginTop="0"; b.addEventListener("click",()=>{ if(typeof practiceResetPositions==="function")practiceResetPositions(); }); r._ctl.appendChild(b); pr.appendChild(r); }
  { const r=rowEl("Clear Status Effects"); const b=el("button","settings-reset","CLEAR"); b.style.marginTop="0"; b.addEventListener("click",()=>{ if(typeof practiceClearStatus==="function")practiceClearStatus(); }); r._ctl.appendChild(b); pr.appendChild(r); }
  updatePracticeTabVisibility();
}
function refreshRow(r,changed,mayNextMatch){
  markChanged(r,changed);
  const old=r._ctl.querySelector(".next-match"); if(old) old.remove();
  if(mayNextMatch && changed && inMatch()) r._ctl.appendChild(nextMatchTag());
}
function updatePracticeTabVisibility(){
  const show = pendingSettings.match.cpuDifficulty===3;
  const tab=document.querySelector('.settings-tab[data-tab="practice"]');
  if(tab) tab.style.display = show ? "" : "none";
  if(!show){ const p=document.querySelector('.settings-page[data-page="practice"]');
    if(p&&p.classList.contains("active")) selectTab("match"); }
}
function selectTab(id){
  document.querySelectorAll(".settings-tab").forEach(t=>t.classList.toggle("active",t.dataset.tab===id));
  document.querySelectorAll(".settings-page").forEach(p=>p.classList.toggle("active",p.dataset.page===id));
}

/* ---------- key capture ---------- */
function startCapture(btn){
  if(capturingBtn) endCapture();
  capturingBtn=btn; btn.classList.add("capturing"); btn.textContent="PRESS KEY…";
  btn.title="Press a new key · ESC to cancel";
}
function endCapture(){ if(!capturingBtn) return; const b=capturingBtn; capturingBtn=null; b.classList.remove("capturing");
  b.textContent=keyLabel(getBind(b.dataset.player,b.dataset.slot)); }
function overlayKeyHandler(e){
  const ov=document.getElementById("settingsOverlay");
  if(!ov||!ov.classList.contains("show")) return;
  if(capturingBtn){
    e.preventDefault(); e.stopPropagation();
    if(e.key==="Escape"){ endCapture(); return; }
    const key=e.key.toLowerCase();
    const player=capturingBtn.dataset.player, slot=capturingBtn.dataset.slot;
    tryBind(player,slot,key);
    return;
  }
  if(e.key==="Escape"){ e.preventDefault(); e.stopPropagation(); cancelSettings(); }
}
function tryBind(player,slot,key){
  const sameSlot=findSlotWithKey(player,key,slot);
  const finish=()=>{ setBind(player,slot,key); endCapture(); renderSettings(); };
  if(sameSlot){
    showDialog(keyLabel(key)+" is already assigned to "+slotAction(sameSlot)+".\nReplace the existing assignment?","REPLACE","CANCEL",
      ()=>{ const oldKey=getBind(player,slot); setBind(player,sameSlot,oldKey); finish(); },   // swap
      ()=>{ endCapture(); });
    return;
  }
  const other = player==="p1"?"p2":"p1";
  const crossSlot=findSlotWithKey(other,key,null);
  if(crossSlot){
    showDialog("This key is also assigned to "+(other==="p1"?"Player 1":"Player 2")+".\nBoth fighters may react during local multiplayer.","BIND ANYWAY","CANCEL",
      ()=>finish(), ()=>endCapture());
    return;
  }
  finish();
}
function showDialog(msg,okTxt,noTxt,onOk,onNo){
  const d=document.getElementById("settingsDialog"), p=document.getElementById("settingsDialogMsg");
  const ok=document.getElementById("settingsDialogOk"), no=document.getElementById("settingsDialogNo");
  p.textContent=msg; ok.textContent=okTxt; no.textContent=noTxt;
  const close=()=>{ d.classList.remove("show"); ok.onclick=null; no.onclick=null; };
  ok.onclick=()=>{ close(); onOk&&onOk(); }; no.onclick=()=>{ close(); onNo&&onNo(); };
  d.classList.add("show");
}

/* ---------- open / close / apply / cancel ---------- */
function openSettings(from){
  buildSettingsOverlay();
  settingsReturnScreen = from || "title";
  pendingSettings = cloneSettings(activeSettings);
  renderSettings();
  selectTab("match");
  document.getElementById("settingsOverlay").classList.add("show");
}
function closeSettingsReturn(){
  document.getElementById("settingsOverlay").classList.remove("show");
  if(settingsReturnScreen==="pause"){ // back to the pause menu, do NOT resume
    if(typeof showPauseMain==="function") showPauseMain();
    const pm=document.getElementById("pauseMenu"); if(pm) pm.classList.add("show");
  }else if(settingsReturnScreen==="online"){ // reopen the online match menu (the match kept running)
    if(typeof ONLINE_toggleMatchMenu==="function") ONLINE_toggleMatchMenu(true);
  }else{
    if(typeof showScreen==="function") showScreen("title");
  }
}
function cancelSettings(){ endCapture();
  pendingSettings=cloneSettings(activeSettings);
  applySettings(activeSettings);   // undo any live preview
  closeSettingsReturn();
}
function applySettingsUI(){ endCapture();
  validateSettings(pendingSettings);
  saveSettings(pendingSettings);
  applySettings(pendingSettings);  // sets activeSettings = pending
  closeSettingsReturn();
}
function restoreDefaultsUI(){ endCapture(); resetPendingToDefaults(); renderSettings(); }
