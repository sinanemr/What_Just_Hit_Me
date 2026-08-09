/**
 * WHAT JUST HIT ME — game engine (migrated verbatim from what-just-hit-me_alpha13.1.html).
 *
 * Loaded as a plain <script> after config.js + controls.js (see index.html), so the
 * game runs by double-clicking index.html (file://) as well as from a web server.
 * It uses these globals defined by those files: CFG, applyViewport (config.js) and
 * ENGINE_KEYS, ABIL_LABELS, ULT_LABEL (controls.js).
 *
 * Edits vs. the original <script>:
 *   - every embedded base64 sprite/stage image is now an ./assets/... file path
 *   - config constants (W,H,GROUND,GRAV,CH_SCALE,WORLD_W,WALL_L/R,SPAWN_1/2,
 *     RENDER_SCALE, round time, wins, energy cap, camera follow) come from CFG
 *   - P1KEYS/P2KEYS and on-screen key labels (AB_LABELS/ULT_KEY) come from controls
 *     -> Player 1 now uses the new A/D/Space/U/S/I/J/K/L/O scheme automatically.
 *
 * (Option-1 refactor: character data + bespoke mechanics still live here for now;
 * being peeled into /characters incrementally so each step stays playtestable.)
 */

"use strict";
/* =============== CORE CONSTANTS (720x270 logical buffer; canvas backing = width*renderScale) =============== */
const W=CFG.viewport.width, H=CFG.viewport.height, GROUND=CFG.world.ground, GRAV=CFG.world.gravity;
/* ---- Kabatepe Port is a wide, open pier: the camera sits back, so fighters
   render smaller. CH_SCALE shrinks every fighter uniformly. All gameplay
   offsets below are authored in SPRITE space and mapped through S()/MZX()/MZY()
   so muzzles, hands and hitboxes stay glued to the artwork. ---- */
const CH_SCALE=CFG.fighters.scale;
/* ---- WORLD vs VIEWPORT ----------------------------------------------
   The canvas (W=480) is a window onto a much wider world (WORLD_W=1356),
   which is the full Kabatepe painting at 0.28 scale. The camera follows
   the midpoint of the two fighters, so the whole map is playable and the
   view side-scrolls as they move. ------------------------------------ */
const WORLD_W=CFG.world.width;
/* ---- INVISIBLE WALLS -------------------------------------------------
   Soft bounds on the duelling ground. Fighters are stopped, but the camera
   is NOT: it keeps tracking, so the art beyond the walls stays visible.
     LEFT  = past the bathroom shed AND the dog lying in front of it
            (shed 570-620, dog 594-645) so neither can be walked into
     RIGHT = just left of the camera pole    (pole stands at world 1646)
   -------------------------------------------------------------------- */
const WALL_L=CFG.world.leftWall, WALL_R=CFG.world.rightWall;
/* ---- SPAWN --------------------------------------------------------
   Boat side: the divers work at world 696..879 with the ferry moored
   right behind them, so the open stone just past them is the duelling
   ground. Fighters square off 280px apart — never the same spot.
   Used by BOTH the first spawn and every round reset. ---------------- */
const SPAWN_1=CFG.fighters.player1Spawn, SPAWN_2=CFG.fighters.player2Spawn;
let camX=(WORLD_W-W)/2;      /* left edge of the viewport, in world px */
let camScale=1;              /* camera zoom: 1 = normal; <1 = pulled back when fighters are far apart */
const camClamp=v=>Math.max(0,Math.min(WORLD_W-W,v));
const S=v=>v*CH_SCALE;                       /* sprite px -> world px */
const MZX=(f,ox)=>f.x+f.facing*S(ox);        /* muzzle X from sprite offset */
const MZY=(f,oy)=>f.y-S(oy);                 /* muzzle Y from sprite offset (up from feet) */
const cv=document.getElementById("gameCanvas"), ctxMain=cv.getContext("2d");
let ctx=ctxMain;
const RENDER_SCALE=CFG.viewport.renderScale;                          /* base supersample (fallback density) */
const MAX_SS=3;                                                       /* cap on the world-buffer supersample density (memory bound at high DPR) */
applyViewport(cv);
ctxMain.imageSmoothingEnabled=false;
/* -------------------------------------------------------------------------------------------------
   HiDPI: size the canvas BACKING store to its true device-pixel box so the browser displays it 1:1
   (no blurry upscale). Backing = CSS display size * devicePixelRatio, locked to the exact W:H aspect.
   renderGame then rasterises + composites at this real device resolution. Re-fits on resize / zoom /
   monitor change. When the fight screen is hidden the box is 0 -> we skip and refit once it shows. */
function fitCanvas(){
 if(!cv)return;
 const rect=cv.getBoundingClientRect();
 if(rect.width<1)return;                                             /* not visible yet */
 const dpr=window.devicePixelRatio||1;
 const bw=Math.max(1,Math.round(rect.width*dpr));
 const bh=Math.max(1,Math.round(bw*H/W));                           /* derive height from width -> exact aspect + uniform scale */
 if(cv.width!==bw||cv.height!==bh){cv.width=bw;cv.height=bh;ctxMain.imageSmoothingEnabled=false;}
}
if(typeof window!=="undefined"){
 if(window.ResizeObserver)new ResizeObserver(fitCanvas).observe(cv);   /* catches layout + fullscreen size changes */
 window.addEventListener("resize",fitCanvas);
 (function watchDpr(){try{const mq=matchMedia("(resolution: "+(window.devicePixelRatio||1)+"dppx)");
   mq.addEventListener("change",function(){fitCanvas();watchDpr();},{once:true});}catch(e){}})();   /* re-arm on each DPR change (monitor move / browser zoom) */
}

/* =============================================================================
   HERO DATA -- everything about a fighter lives together below, one block per hero:
     CHARS.push({...})      stats, bio, skill NAMES/cooldowns/description text, ult text
     IMG_SPRITES.name={..}  hand-drawn portrait art per animation state (w/h = display size)
     SPRITES.name={...}     fallback pixel-art (palette + ASCII grid), used only if that hero
                             has no matching key in IMG_SPRITES
     ABILITIES.name=[...]   the actual skill CODE (damage, effects) for the 3 skills above

   COMMON EDITS -- where to make them:
   - Change a stat (HP/Armor/Speed/Jump/basic-attack power)
       -> edit the hp/armor/speed/jump/power numbers on that hero's CHARS.push(...) line.
   - Change a skill's name, cooldown, or its in-game description text
       -> edit the matching entry in that hero's ab:[...] array (n=name, cd=cooldown seconds,
          d=description). ab[0]/ab[1]/ab[2] are P1 ability slots / P2-CPU slots (keys live in js/controls.js), in
          that order, and line up with ABILITIES.name[0]/[1]/[2] below -- keep both in sync.
   - Change what a skill actually DOES (damage numbers, status effects, projectiles)
       -> edit the matching function inside that hero's ABILITIES.name=[...] array.
   - Resize a hero's on-screen image
       -> change w:/h: on the relevant state inside that hero's IMG_SPRITES.name={...} block.
   - Recolor/redraw the pixel-art fallback
       -> edit that hero's SPRITES.name={pal:{...},g:[...]} block.
   (See the HAYDAR PASHA block right below for a field-by-field guide to each of the four
   pieces -- the same shape repeats for all 11 heroes.)

   power = basic attack damage. armor = defense bar. P1 keys are in js/controls.js (default: I atk, J/K/L skills, O ult)
   (P2/CPU: L/O/P skills, M ult, K atk).
   ============================================================================= */
const CHARS=[];
const ABILITIES={};
/* ---- AIR / CROUCH action framework -------------------------------------------------------------
   Skills/basic-attacks/ults can now be used while CROUCHING or in the AIR. Each stance can have its
   own animation+effect via optional per-hero variant tables; until that art exists they fall back to
   the normal ground skill (so every stance uses the SAME skill for now). Air skills require a short
   window opened by a jump (see AIR_SKILL_WINDOW); basic attacks & ults in the air don't. */
const ABILITIES_CROUCH={};   /* ABILITIES_CROUCH[id]=[fn,fn,fn] — crouch skill variants (optional) */
const ABILITIES_AIR={};      /* ABILITIES_AIR[id]=[fn,fn,fn]    — air skill variants (optional)    */
const AIR_SKILL_WINDOW=1.0;  /* seconds after a jump you may trigger an AIR skill (double-jump cancels it) */
const JUMP_WINDUP=0.08;      /* fast GROUND wind-up (jump01 -> jump02) played before the leap launches */
/* ---- SATORI six-frame RUN CYCLE — single editable config (durations are in the engine's game-time
   seconds, so the run stays locked to his movement speed). Frame order F1..F6 = run0..run5.
   Stepped (instant) frame switches, time-accumulated so it's identical at any refresh rate.
     dur[i]      normal per-frame hold (F1..F6). Loop total ~0.48s (~12.5 fps).
     startDur    overrides used when ENTERING the run (starts at startFrame=F2, not the F1 full-stride).
     startFrame  frame index the run enters on (1 = F2), so idle->run never teleports into a full stride.
     exitDur     how long the compact exit pose (F2 or F5) holds on run->idle before returning to idle. */
const SATORI_RUN={
  /* Same 90:70:80 long/pass/rise rhythm as the spec, scaled ~0.81x so the ~0.39s loop matches his
     ground speed (no foot-slide). Bump every value up together to slow the legs, down to speed them. */
  dur:[0.073,0.056,0.065,0.073,0.056,0.065],   /* F1 long / F2 pass / F3 rise / F4 long / F5 pass / F6 rise */
  startDur:{1:0.065,2:0.065,3:0.073},           /* F2,F3,F4 while starting, then normal timing takes over */
  startFrame:1,
  exitDur:0.07
};
/* Compact/grounded pose to exit through on run->idle: F2 (early half) or F5 (late half). */
function satoriRunExit(frame){ return frame<=2 ? 1 : 4; }
/* SATORI run-animation state machine (VISUAL only — never touches physics/input/collision).
   Phases: "idle" -> "start" (enter on F2) -> "run" (normal loop) -> "stop" (brief exit pose) -> "idle".
   Uses accumulated elapsed time (dt) so it is frame-rate independent. */
function updateSatoriRun(f,dt){
  const grounded=f.onGround, runningNow=(f.state==="walk"&&grounded&&f.alive);
  let ph=f._locoPhase||"idle";
  if(runningNow){
   if(ph==="idle"||ph==="stop"){ph="start";f._runFrame=SATORI_RUN.startFrame;f._runTimer=0;}   /* enter -> start at F2 */
   /* advance frames by elapsed time (handles multiple frames per tick at low fps) */
   f._runTimer+=dt;
   let dur=(ph==="start"&&SATORI_RUN.startDur[f._runFrame]!=null)?SATORI_RUN.startDur[f._runFrame]:SATORI_RUN.dur[f._runFrame];
   while(f._runTimer>=dur){
    f._runTimer-=dur;
    f._runFrame=(f._runFrame+1)%6;
    if(ph==="start"&&f._runFrame===4)ph="run";   /* past F4 -> normal loop */
    dur=(ph==="start"&&SATORI_RUN.startDur[f._runFrame]!=null)?SATORI_RUN.startDur[f._runFrame]:SATORI_RUN.dur[f._runFrame];
   }
  }else{
   if(ph==="start"||ph==="run"){
    if(f.state==="idle"&&grounded&&f.alive){ph="stop";f._runFrame=satoriRunExit(f._runFrame);f._runTimer=0;}   /* movement released -> compact exit pose */
    else ph="idle";   /* interrupted by a higher-priority action -> abort, that state's animation takes over */
   }else if(ph==="stop"){
    f._runTimer+=dt;
    if(f._runTimer>=SATORI_RUN.exitDur)ph="idle";
   }
  }
  f._locoPhase=ph;
}
/* Which stance variant the fighter's next skill/attack should use. */
function fighterContext(f){ return !f.onGround ? "air" : (f.crouching ? "crouch" : "ground"); }
const SPRITES={};
const IMG_SPRITES={};

/* ==================== HAYDAR PASHA ====================
   Field guide (same shape for every hero in this file):
     id     internal key -- used everywhere else (IMG_SPRITES.id, SPRITES.id, ABILITIES.id).
            Don't rename lightly; it has to match in all four places for that hero.
     ep     subtitle shown under the name on the character-select screen
     ab[i]  one of the 3 skills. n=display name, cost=unused (always 0), cd=cooldown in
            seconds, kind=melee/ranged/heal/buff (label only, purely descriptive),
            d=description text shown in the bio panel
     ult    the R/M special move. n=name, d=description                              */

/* ==================== EMBERSTRIKE ==================== */
 CHARS.push({id:"ember", name:"Emberstrike", ep:"The Burning Fist",
  hp:500, armor:160, speed:170, jump:425, power:30,
  bio:"Fast melee, heat buildup, high-risk fire. HEAT: skills build it — at 50+ deal +15% dmg, at 80+ +20%. Reaching 100 = OVERHEAT (-40 HP, skills locked 2s, -15% dmg 3s, heat→30). Flexible Guard: 15% less ballistic damage.",
  ab:[
   {n:"BLAZING RUSH",cost:0,cd:7,kind:"melee",d:"+20 HEAT. Cartwheel assault: 3×20 dmg, staggers 0.5s. At 50+ Heat the last kick deals +15."},
   {n:"IGNITION FIST",cost:0,cd:9,kind:"melee",d:"+25 HEAT. Explosive fire punch: 75 dmg + BURN 10/s for 3s. At 80+ Heat: 95 dmg, burn 4s."},
   {n:"VENTING CYCLONE",cost:0,cd:11,kind:"melee",d:"-40 HEAT. Spinning fire wave: 55 dmg, small knockback, enemy deals 10% less damage 3s. Cannot overheat."}
  ],
  ult:{n:"FLAME SPIRAL",d:"Flaming uppercut into 5×22 burning kicks. Consumes all Heat: +20 dmg at 50-79, +40 at 80-99. BURN 4s. Never overheats."}
 });
 IMG_SPRITES.ember={
 idle:{w:40,h:72,src:"assets/characters/emberstrike/idle.png"},
 attack:{w:52,h:64,src:"assets/characters/emberstrike/attack.png"},
 hit:{w:39,h:63,src:"assets/characters/emberstrike/hit.png"}
};
 SPRITES.ember={pal:{p:"#c2331f",P:"#8e2113",c:"#f28022",g:"#ffd23f",s:"#e0a878",h:"#f28022",e:"#301008",k:"#5c1408"},g:[
"......hhhh......",
".....hhhhhh.....",
".....ssssss.....",
".....sesses.....",
".....ssssss.....",
".....ssssss.....",
"......ssss......",
".......ss.......",
"...pppppppppp...",
"..ccppppppppcc..",
"..ccpppggpppcc..",
"..ccpppggpppcc..",
"..cPppppppppPc..",
"..s.pppppppp.s..",
"....pppppppp....",
"....pppppppp....",
"....pppppppp....",
"....gggggggg....",
"....pppppppp....",
".....ppp.ppp....",
".....ppp.ppp....",
".....ppp.ppp....",
".....ppp.ppp....",
".....PPP.PPP....",
".....PPP.PPP....",
".....ccc.ccc....",
".....ccc.ccc....",
"....cccc.cccc...",
]};
 ABILITIES.ember=[
  f=>{f.state="special";f.t=0;skillAnnounce("BLAZING RUSH!",650);addHeat(f,20);
   const bonus=f.heat>=50?15:0;
   [80,200,330].forEach((d,i)=>meleeHit(f,{range:S(52),dmg:i===2?20+bonus:20,kb:i===2?130:40,delay:d,
    opts:{skill:true,col:"#f28022",fx:"#f28022"},onHit:i===2?(foe=>applyStun(foe,.5)):null}));},
  f=>{f.state="special";f.t=0;skillAnnounce("IGNITION FIST!",650);addHeat(f,25);
   const hot=f.heat>=80;
   meleeHit(f,{range:S(50),dmg:hot?95:75,kb:170,opts:{skill:true,col:"#f28022",fx:"#ffd23f"},onHit:foe=>{
    foe.burnDps=10;foe.burn=Math.max(foe.burn,hot?4:3);statusFloat(foe,"BURN","#f28022");}});},
  f=>{f.state="special";f.t=0;skillAnnounce("VENTING CYCLONE!",650);addHeat(f,-40);
   ringFx(f.x,f.centerY,"#f28022",70);
   setTimeout(()=>{if(!running)return;const foe=other(f);
    if(Math.abs(foe.x-f.x)<70){foe.takeDamage(55,150,Math.sign(foe.x-f.x)||f.facing,{melee:true,skill:true,col:"#f28022",fx:"#f28022"});
     foe.weakenT=3;foe.weakenAmt=.10;statusFloat(foe,"WEAKENED","#f2b632");}
    hitProps(f.x,1,70,55,f,undefined,true);hitProps(f.x,-1,70,55,f,undefined,true);},140);}];

/* ==================== MASTER AKIRA ==================== */
 CHARS.push({id:"akira", name:"Master Akira", ep:"Sage of the Mountain Temple",
  hp:500, armor:170, speed:135, jump:395, power:30,
  bio:"Wushu, chi buildup, elemental control. CHI: +5 per basic hit, +15 per skill hit; at 50+ skills deal +10% and Akira takes -10% damage; decays when idle. Heightened Senses: stuns/paralysis 20% shorter on him.",
  ab:[
   {n:"ELEMENTAL PALM",cost:0,cd:8,kind:"melee",d:"65 dmg palm that cycles elements: FIRE (burn 8/s 3s) → LIGHTNING (paralyze 0.7s) → WIND (knockback + 15% slow 2s). 75 dmg at 50+ Chi."},
   {n:"CHI BARRIER",cost:0,cd:13,kind:"buff",d:"A 100-point chi shield for 4s that also restores 5 HP/s (max 20). Generates 10 Chi."},
   {n:"ASTRAL SHADOW STRIKE",cost:0,cd:10,kind:"ranged",d:"His shadow flies across the screen: 70 dmg + enemy accuracy -15% for 3s. At 50+ Chi: 85 dmg and a 0.5s stagger."}
  ],
  ult:{n:"ZEN STATE",d:"90 dmg chi shockwave + 1s stun, Chi fills to 100. For 6s: +20% dmg, 20% resistance, empowered palms, Chi frozen. Ends with Chi at 0."}
 });
 IMG_SPRITES.akira={
 idle:{w:33,h:72,src:"assets/characters/akira/idle.png"},
 attack:{w:52,h:66,src:"assets/characters/akira/attack.png"},
 hit:{w:33,h:76,src:"assets/characters/akira/hit.png"}
};
 SPRITES.akira={pal:{p:"#e8e2d4",P:"#c6bda8",c:"#8a2f2f",h:"#cfcfcf",s:"#e3c096",e:"#241a10",k:"#6b4a2b"},g:[
".......hh.......",
"......hhhh......",
".....hhhhhh.....",
".....ssssss.....",
".....sesses.....",
".....ssssss.....",
".....hhhhhh.....",
"......hhhh......",
".......hh.......",
"...pppphhpppp...",
"..pppcppppcppp..",
"..ppppcppcpppp..",
"..pppppccppppp..",
"..pPppppppppPp..",
"..s.pppppppp.s..",
"....pppppppp....",
"....pppppppp....",
"....pppppppp....",
"....cccccccc....",
"....pppppppp....",
".....ppp.ppp....",
".....ppp.ppp....",
".....ppp.ppp....",
".....ppp.ppp....",
".....PPP.PPP....",
".....sss.sss....",
".....kkk.kkk....",
"....kkkk.kkkk...",
]};
 ABILITIES.akira=[
  f=>{f.state="special";f.t=0;
   const elems=["FIRE","LIGHTNING","WIND"],el=elems[f.palmIdx%3];f.palmIdx++;
   skillAnnounce(el+" PALM!",650);
   const emp=f.chi>=50||f.zen>0;
   meleeHit(f,{range:S(50),dmg:emp?75:65,kb:el==="WIND"?200:110,opts:{skill:true,col:el==="FIRE"?"#f28022":el==="LIGHTNING"?"#5ec8ff":"#b8e6c8",fx:"#7de8d8"},onHit:foe=>{
    if(el==="FIRE"){foe.burnDps=8;foe.burn=Math.max(foe.burn,3);statusFloat(foe,"BURN","#f28022");}
    else if(el==="LIGHTNING"){applyStun(foe,emp?.85:.7);statusFloat(foe,"PARALYZED","#5ec8ff");}
    else{foe.slowT=2;foe.slowAmt=.15;statusFloat(foe,"SLOWED","#b8e6c8");}}});},
  f=>{f.state="special";f.t=0;skillAnnounce("CHI BARRIER",650);
   f.barrier=100;f.barrierT=4;f.barrierHeal=20;addChi(f,10);ringFx(f.x,f.centerY,"#7de8d8",45);},
  f=>{f.state="special";f.t=0;skillAnnounce("ASTRAL SHADOW STRIKE!",650);
   const emp=f.chi>=50||f.zen>0;
   projectiles.push({type:"shadow",x:MZX(f,16),y:f.centerY,vx:f.facing*340,vy:0,r:9,dmg:emp?85:70,owner:f,col:"#4a3d6b",skill:true,shadowEmp:emp});}];
for(const id in IMG_SPRITES){for(const k in IMG_SPRITES[id]){const d=IMG_SPRITES[id][k];d.img=new Image();d.img.src=d.src;}}
/* --- roster edits (user-requested) --- */
["ember","akira"].forEach(id=>{const i=CHARS.findIndex(c=>c.id===id);if(i>=0)CHARS.splice(i,1);});   /* removed from the game */
const COMING_SOON=["necaati"];   /* shown greyed-out with a "COMING SOON" overlay + not selectable */
const WIN_LINES={
 ember:"“Too slow! By the time you saw my fist, you were already burning.”",
 akira:"“The mountain does not move, yet it defeats the storm. Reflect on this, young one.”",
};
const STAGES=[
 {name:"KABATEPE PORT", sub:"Karatepe İskelesi — sunset ferry pier"}
];
/* ---- IMAGE SPRITES (user-provided art) ---- */
const FX_IMGS={xslash:{w:84,h:42,src:"assets/effects/xslash.png"}};
for(const k in FX_IMGS){const o=FX_IMGS[k];o.img=new Image();o.img.src=o.src;}
const PROJ_IMGS={
 rocket:{w:25,h:7,src:"assets/projectiles/rocket.png"},
 shuriken:{w:17,h:17,src:"assets/projectiles/shuriken.png"},
 spike:{w:24,h:13,src:"assets/projectiles/spike.png"},
 /* SATORI crouch-C thrown spike — 4-frame animation (642x642 canvases, centred vertical blade) */
 cspike1:{src:"assets/projectiles/Spike skill_C_01.png"},
 cspike2:{src:"assets/projectiles/Spike skill_C_02.png"},
 cspike3:{src:"assets/projectiles/Spike skill_C_03.png"},
 cspike4:{src:"assets/projectiles/Spike skill_C_04.png"},
 /* the planted mine (loops, 3 frames) + its eruption (plays once, 6 frames incl. the _00 lead-in) */
 mineg1:{src:"assets/projectiles/Spike ground_01.png"},
 mineg2:{src:"assets/projectiles/Spike ground_02.png"},
 mineg3:{src:"assets/projectiles/Spike ground_03.png"},
 minex0:{src:"assets/projectiles/Spike mine explosion_00.png"},
 minex1:{src:"assets/projectiles/Spike mine explosion_01.png"},
 minex2:{src:"assets/projectiles/Spike mine explosion_02.png"},
 minex3:{src:"assets/projectiles/Spike mine explosion_03.png"},
 minex4:{src:"assets/projectiles/Spike mine explosion_04.png"},
 minex5:{src:"assets/projectiles/Spike mine explosion_05.png"}
};
for(const k in PROJ_IMGS){const d=PROJ_IMGS[k];d.img=new Image();d.img.src=d.src;}
/* =============== INPUT =============== */
const keys={};
addEventListener("keydown",e=>{
 if(e.key==="Escape"){
  /* Online matches never pause the simulation — Esc opens the online match menu. */
  if(typeof ONLINE!=="undefined"&&(ONLINE.mode==="match-host"||ONLINE.mode==="match-guest")){
   e.preventDefault(); if(typeof ONLINE_toggleMatchMenu==="function")ONLINE_toggleMatchMenu(); return;
  }
  if(running&&!roundOver&&document.getElementById("fight").classList.contains("active")){e.preventDefault();togglePause();}
  return;
 }
 keys[e.key.toLowerCase()]=true; if(["arrowup","arrowdown","arrowleft","arrowright"," "].includes(e.key.toLowerCase()))e.preventDefault();});
addEventListener("keyup",e=>{keys[e.key.toLowerCase()]=false;});
const P1KEYS=ENGINE_KEYS('p1');
const P2KEYS=ENGINE_KEYS('p2');
const AB_LABELS={p1:ABIL_LABELS('p1'),p2:ABIL_LABELS('p2'),cpu:ABIL_LABELS('p2')};
const ULT_KEY={p1:ULT_LABEL('p1'),p2:ULT_LABEL('p2'),cpu:ULT_LABEL('p2')};

/* =============== STATE =============== */
let fighters=[], projectiles=[], particles=[], floaters=[], rings=[], props=[], codexes=[];
let groundFx=[];   /* stationary world effects (e.g. Satori's double-jump energy) that stay where they spawned */
let ghosts=[];     /* fading afterimage snapshots (semi-transparent sprite copies) left behind during a dash */
let sawCuts=[];    /* glowing-red gash marks the ground-saw carves as it rolls (fade out) */
let stageId=0, roundNum=1, timer=CFG.match.roundTime, running=false, paused=false, roundOver=false, shake=0, tGlobal=0;
/* Round rules captured at match start so mid-match changes only take effect next match. */
let matchRoundTime=CFG.match.roundTime, matchWinsRequired=CFG.match.winsRequired;
let cpuMode=true, cpuDiff=1, p1Pick=null, p2Pick=null;
/* Online epoch ids: bumped on new connection / match / round so a stale delayed
   host callback can't affect a later online round or rematch. Harmless offline. */
let onlineSessionId=0, onlineMatchId=0, onlineRoundId=0;
function onlineCallbackStale(sid,rid){
 return (typeof ONLINE!=="undefined") && ONLINE && ONLINE.mode!=="offline" && (sid!==onlineSessionId||rid!==onlineRoundId);
}
function onlineIsMatchHost(){ return typeof ONLINE!=="undefined" && ONLINE && ONLINE.mode==="match-host"; }
function onlineIsMatchActive(){ return typeof ONLINE!=="undefined" && ONLINE && (ONLINE.mode==="match-host"||ONLINE.mode==="match-guest"); }
/* Random float in [a,b). */
const rand=(a,b)=>a+Math.random()*(b-a);

/* =============== STAGE OBJECTS =============== */
let plats=[];
/* Live platform/scaffold list for the current round (read by physics, AI, and collision). */
function platforms(){return plats.concat(propWalkPlatforms(), staticWalkPlatforms()).sort((a,b)=>a.y-b.y);}
function makePlats(sid){
 /* Obstacles/scaffolding cleared for now — flat stage; fighters use the ground line. */
 return[];
}
function propTopY(pr){return pr.topY===undefined?propBaseY(pr)-pr.h+(pr.topOffset||0):pr.topY;}
function propWalkPlatforms(){
 const out=[];
 for(const pr of props){
  if(pr.kind==="scaffold"&&pr.hp>0)out.push({kind:"scaffoldTop",x:pr.x,y:propTopY(pr),w:pr.w,hidden:true});
  if(pr.kind==="car"){                                                                              /* two levels: roof (upper) + hood (lower step) */
   out.push({kind:"carTop",x:pr.roofX,y:propTopY(pr),w:pr.roofW,hidden:true});                      /* stand on the ROOF (cabin span, not the hood) */
   if(pr.hoodY!==undefined)out.push({kind:"carHood",x:pr.hoodX,y:pr.hoodY,w:pr.hoodW,hidden:true}); /* stand on the HOOD (lower front deck) */
  }
 }
 return out;
}
function staticWalkPlatforms(){
 const out=[];
 if(typeof buildLightHousePlatforms==="function")out.push(...buildLightHousePlatforms());
 return out;
}
const PLAT_COL={rune:"#8f6cf0",wood:"#5c452c",scaffold:"#b09a6a",panel:"#3fd8c7",pallet:"#8a6a42",jetty:"#c9a077",rig:"#c4926a"};
function rigSupportCheck(){
 /* An upper-tier plank is carried by the frame below. If the lower tier under
    it is gone, it drops too — the rig comes apart from the bottom up. */
 const lower=plats.filter(p=>p.kind==="rig"&&!p.top);
 for(const up of plats.filter(p=>p.kind==="rig"&&p.top)){
  const carried=lower.some(lo=>lo.x<up.x+up.w&&lo.x+lo.w>up.x);
  if(!carried&&up.hp>0)damagePlat(up,9999,null);
 }
}
/* Damages a destructible platform/scaffold tile; on destruction, drops anyone standing on it and cascades to any tier that depended on it. */
function damagePlat(pl,dmg,owner){
 if(pl.hp===undefined||pl.hp<=0)return;
 pl.hp-=dmg;
 const cx=pl.x+pl.w/2,col=PLAT_COL[pl.kind]||"#8f6cf0";
 spawnHitFx(cx,pl.y+3,col,4);
 if(pl.hp<=0){
  plats=plats.filter(p2=>p2!==pl);
  /* ---- anyone standing on this deck rides it down ----
     The support check in the physics step already drops them next frame, but
     we cut them loose here so the fall starts on the same frame the plank
     goes, and add a lurch so it reads as the floor giving way. */
  for(const f of fighters){
   if(f.alive&&f.onGround&&Math.abs(f.y-pl.y)<2&&f.x>pl.x-6&&f.x<pl.x+pl.w+6){
    f.onGround=false; f.vy=-40; f.jumps=1;      /* small lurch, one air-jump to recover */
    floaters.push({x:f.x,y:f.y-40,txt:"FLOOR GONE!",t:0,col:"#f28022",size:6});
   }
  }
  for(let i=0;i<12;i++)particles.push({x:pl.x+rand(0,pl.w),y:pl.y+rand(0,8),vx:rand(-90,90),vy:rand(-140,20),r:rand(1,3),col,t:0,life:rand(.3,.6)});
  /* a rig deck sheds timber splinters and blue tube fragments */
  if(pl.kind==="rig"){
   for(let i=0;i<10;i++)particles.push({x:pl.x+rand(0,pl.w),y:pl.y+rand(-8,6),vx:rand(-120,120),vy:rand(-180,-20),r:rand(1,2),col:i%3===0?"#2f5fa8":"#b8935c",t:0,life:rand(.4,.8)});
  }
  shake=Math.max(shake,pl.kind==="rig"?.5:.3);
  floaters.push({x:cx,y:pl.y-8,txt:"COLLAPSED!",t:0,col,size:6});
  if(owner&&owner.alive){owner.gainMeter(8);floaters.push({x:cx,y:pl.y-16,txt:"+8 ENERGY",t:0,col:"#f2b632",size:6});}
  if(pl.kind==="rig"&&!pl.top)rigSupportCheck();   /* cascade the tier above */
 }
}
function makeProps(sid){
 const out=[];
 if(typeof buildScaffoldProps==="function")out.push(...buildScaffoldProps());
 if(typeof buildCarProps==="function")out.push(...buildCarProps());
 if(typeof buildCO2TankProps==="function")out.push(...buildCO2TankProps());
 return out;
}
function propBaseY(pr){return pr.baseY===undefined?GROUND:pr.baseY;}
/* Damages a destructible background prop (crate, vase, tank...); on destruction, removes it and grants the attacker ENERGY. */
/* True (and records it) if THIS attack instance has already hit this prop — so a multi-hit swing or
   skill only counts as ONE hit on any breakable/explosive prop. owner-less damage is never throttled. */
function attackAlreadyHit(pr,owner){
 if(!owner)return false;
 const slot=(typeof fighters!=="undefined"&&owner===fighters[1])?1:0;
 const seq=owner.atkSeq||0;
 if(!pr._atkSeq)pr._atkSeq=[-1,-1];
 if(pr._atkSeq[slot]===seq)return true;
 pr._atkSeq[slot]=seq;return false;
}
function damageProp(pr,dmg,owner,melee){
 if(pr.hp<=0)return;
 if(pr.kind==="scaffold"&&!melee)return;   /* scaffolds take ONLY melee — ranged shots pass through */
 if(attackAlreadyHit(pr,owner))return;    /* one basic attack / one skill = one hit (multi-hits count once) */
 pr.hp-=(pr.kind==="co2tank")?1:dmg;       /* co2 tank breaks in a fixed number of HITS, not raw damage */
 const pb=propBaseY(pr),cx=pr.x+pr.w/2,cy=pb-pr.h/2;
 const col=pr.kind==="scaffold"?"#b09a6a":pr.kind==="co2tank"?"#8fd43a":pr.kind==="divetank"?"#f2c230":pr.kind==="compressor"?"#c0392b":pr.kind==="vase"?"#8f6cf0":pr.kind==="slantern"?"#c9c2b2":pr.kind==="sign"?"#3fd8c7":"#5c452c";
 spawnHitFx(cx,cy,col,4);
 if(pr.hp<=0){
  if(pr.kind==="car"){                     /* car doesn't vanish — it detonates + becomes the wreck (still standable) */
   if(!pr.wrecked){pr.wrecked=true;if(typeof carExplode==="function")carExplode(pr,owner);
    if(owner&&owner.alive){owner.gainMeter(8);floaters.push({x:cx,y:pb-pr.h-8,txt:"+8 ENERGY",t:0,col:"#f2b632",size:6});}}
   return;
  }
  if(pr.kind==="co2tank"){                  /* explodes (smaller than the car) then is gone */
   if(typeof co2TankExplode==="function")co2TankExplode(pr,owner);
   props=props.filter(p=>p!==pr);
   if(owner&&owner.alive){owner.gainMeter(6);floaters.push({x:cx,y:pb-pr.h-8,txt:"+6 ENERGY",t:0,col:"#f2b632",size:6});}
   return;
  }
  props=props.filter(p=>p!==pr);
  spawnHitFx(cx,cy,col,14);shake=Math.max(shake,.25);
  if(pr.kind==="scaffold"){if(typeof scaffoldCollapseFx==="function")scaffoldCollapseFx(pr);if(typeof scaffoldBreakLinked==="function")scaffoldBreakLinked(pr,owner);}
  if(owner&&owner.alive){owner.gainMeter(8);floaters.push({x:cx,y:pb-pr.h-8,txt:"+8 ENERGY",t:0,col:"#f2b632",size:6});}
 }
}
/* Checks a melee/ranged hit's area against nearby props and platforms and damages any that overlap.
   Pass melee=true for close-range hits; scaffolds only take melee (ranged AoE passes through them). */
function hitProps(x,facing,range,dmg,owner,y,melee){
 if(y===undefined)y=GROUND-S(30);
 for(const pr of props.slice()){
  const pb=propBaseY(pr),cx=pr.x+pr.w/2;
  if(pr.hp>0&&Math.abs(cx-x)<range&&(cx-x)*facing>-8&&y>pb-pr.h-12&&y<pb+12)damageProp(pr,dmg,owner,melee);  /* hp>0: attacks pass THROUGH a wrecked car */
 }
 for(const pl of plats.slice()){
  if(pl.hp===undefined)continue;
  const cx=pl.x+pl.w/2;
  if(Math.abs(cx-x)<range&&(cx-x)*facing>-8&&Math.abs(y-pl.y)<S(36))damagePlat(pl,dmg,owner);
 }
}

/* =============== FIGHTER =============== */
/* One combatant's live match state: position/velocity, HP/Armor/Energy, every buff & debuff timer, and the takeDamage() pipeline. One instance per player, held in the `fighters` array. */
class Fighter{
 constructor(d, x, facing, ctrl){
  this.d=d; this.x=x; this.y=GROUND; this.vx=0; this.vy=0; this.facing=facing; this.ctrl=ctrl;
  this.maxhp=d.hp; this.hp=d.hp; this.maxArmor=d.armor; this.meter=0; this.wins=0;
  this.state="idle"; this.t=0; this.cd=[0,0,0];
  this.resetStatus();
  this.walkPhase=0; this.aiT=0; this.aiMove=0;
 }
 /* Resets every buff/debuff/cooldown-adjacent timer to its default -- called on creation and at the start of every round. */
 resetStatus(){
  this.armor=this.maxArmor; this.guardBroken=false;
  this.stun=0; this.frozen=0; this.hitFlash=0;
  this.blocking=false; this.crouching=false; this.onGround=true; this.jumps=0; this.airSkillT=0; this.jumpWindup=0; this.alive=true;
  this.agilityT=0; this.groundBounce=false;   /* Satori: Ninja Agility buff + air-combo ground bounce */
  this.kbT=0; this.kbLandT=0;   /* knockback animation state */
  this.airAtkN=0;   /* air basic-attack counter (max 3 per jump) */
  this.flyT=4; this.flyCd=0; this.flying=false; this._wingsFull=true;
  this._arcT=0; this._sunT=0; this._hungerT=0; this._arcAmt=0;
  this.healBlock=0; this.skStage=0; this.frenzy=0; this.diveT=0; this.grabT=0; this.slamT=0;
  this.koPose=0; this.seizedBy=null; this.seizeT=0; this.seizeHit=false;
  this.burn=0; this.burnDps=8; this.poison=0; this.poisonDps=8; this.bleed=0; this.bleedDps=15; this.dotT=0;
  this.confuse=0; this.silence=0; this.shield=0; this.barrier=0; this.barrierT=0;
  this.spdBuff=0; this.regenHoT=0; this.regenHoTDps=12; this.dr=0; this.surge=0;
  this.weakenT=0; this.weakenAmt=0; this.accT=0; this.accAmt=0; this.slowT=0; this.slowAmt=0;
  this.disarm=0; this.morph=0; this.morphShield=0; this.morphHealLeft=0; this._thornT=-9; this.phase=0;
  this._feedCD=0;
  this.heat=0; this.chi=0; this.zen=0; this.skillLock=0; this.overheatDeb=0; this.palmIdx=0; this.skillCount=0;
  this.lastHurt=-99; this.lastAction=-99;
  this.strStacks=0; this._hmmT=0; this.windmill=0; this.marchDmg=0; this.dashT=0; this.dashDir=1; this.hitCount=0; this.palmT=0; this.hmmBub=0; this.hmmBig=false; this._wmGrab=false;
  this._primeHits=0; this.barrierHeal=0; this.marks=0; this.poseSkill=-1; this.ultPose=0; this.skillAT=0; this.skillBT=0; this._swarmT=0; this._squashT=0; this._possessT=0;
  this.discT=0; this.discPend=null; this.momT=0; this.momBonusT=0; this.dr10T=0; this.defBreak=0;
  this._shurHits=0; this._shurVolley=0; this._atkAlt=true; this._atkStep=0; this._ultHalf=0; this._spikeDmg=65;
  /* SATORI skill kit: ROOT (movement/jump pinned, can still act); Skill A 2-charge system + 4s window;
     projectile-volley hit counter (stagger/slow/root triggers); ultimate spike-hit tracking. */
  this.rootT=0; this._aChg=2; this._aWin=0; this._aShot=1; this._airHold=0; this._cbHold=0; this._satVol=0; this._satHits=0;
  this._ultConn=false; this._ultSpk=0; this._recover=0; this.dr35T=0;
  this.hurtT=0; this._hitFrame=1; this._hitLow=false;   /* brief hit-reaction window (real hits only, not DoT ticks) — plants the landing/hurt pose + picks a random standing-hit sprite; _hitLow = struck by a crouching foe */
  this._blockHitT=0; this._crouchBlock=false;   /* SATORI: block-impact window + crouch-block (crouch+block held) flag */
  this._airBlockT=0; this._airBlockUsed=false; this._blkPrev=false;   /* SATORI air block: active timer, once-per-airborne lock, block-press edge */
  this.fallDmgT=0;   /* SATORI hard-landing sequence timer: falldmg1 (touchdown) -> falldmg2 (get up) */
  this._fbState=null; this._fbCur=null; this._fbPrev=null; this._fbT=0; this._fbLast=0;   /* SATORI move-transition crossfade */
  this._locoPhase="idle"; this._runFrame=0; this._runTimer=0;   /* SATORI run-cycle state machine */
  this.counterT=0; this._counterHitT=0;
  this.ultCharging=false; this.ultChargeT=0; this._ultTier=4; this.shock=0; this.shockDps=5;
 }
 rect(){return {x:this.x-12, y:this.y-58, w:24, h:58};}
 get centerY(){return this.y-S(30);}
 get hurtY(){return this.y-S(this.crouching&&this.onGround?16:30);}
 /* Repositions a fighter and refills HP for a new round (Energy carries over, capped at 50). */
 resetRound(x, facing){
  this.hp=this.maxhp; this.meter=Math.min(this.meter,50); this.x=x; this.y=GROUND; this.vx=0; this.vy=0;
  this.facing=facing; this.state="idle"; this.t=0; this.cd=[0,0,0]; this.resetStatus();
 }
 gainMeter(n){this.meter=Math.min(CFG.match.maximumEnergy,this.meter+n);}
 /* The central damage pipeline: applies attacker/defender modifiers (elemental resistances, crit chance, blocking), routes the damage through shield -> barrier -> Armor -> HP, then applies knockback, the floating damage number, and death. */
 takeDamage(dmg, kb, dir, opts={}){
  if(!this.alive||roundOver) return;
  const att=other(this);
  /* PUTUK — FROZEN COUNTER: struck during stance -> negate the hit, freeze attacker, elbow-counter */
  if(this.d.id==="putuk"&&this.counterT>0&&att&&att.alive&&opts.melee&&!opts.ult&&!opts.dot&&!opts.counter){
   this.counterT=0;this._counterHitT=0.4;this.state="special";this.t=0;
   att.frozen=Math.max(att.frozen,0.4);att.vx=0;
   att.takeDamage(50,90,Math.sign(att.x-this.x)||1,{skill:true,melee:true,counter:true,col:"#3fd8c7",fx:"#bfeaff"});
   applyStun(att,0.6);
   statusFloat(this,"COUNTER!","#3fd8c7");ringFx(this.x,this.centerY,"#bfeaff",60);shake=Math.max(shake,.4);
   return;
  }
  /* PUTUK — ANATOMY EXPERT passive: +10 vs Stunned targets (direct hits only) */
  if(att&&att.d.id==="putuk"&&this.stun>0&&!opts.dot&&!opts.trueDmg)dmg+=10;
  /* ----- outgoing modifiers (attacker) ----- */
  if(att&&!opts.dot){
   if(att.weakenT>0)dmg*=(1-att.weakenAmt);
   if(att.overheatDeb>0)dmg*=.85;
   if(att.d.id==="ember")dmg*=(att.heat>=80?1.2:att.heat>=50?1.15:1);
   if(att.d.id==="notalk"&&opts.melee&&!opts.noStackMult)dmg*=(1+.07*att.strStacks);
   if(att.d.id==="agron"&&att.frenzy>0&&!opts.skill)dmg+=5;      /* BLOOD FRENZY */
   if(att.d.id==="akira"&&opts.skill&&att.chi>=50)dmg*=1.1;
   if(att.zen>0)dmg*=1.2;
   if(att.surge>0)dmg*=1.4;
  }
  /* ----- AGRON: alien biology & sunlight ----- */
  if(this.d.id==="agron"){
   if(!opts.skill&&!opts.dot&&!opts.ult){                 /* ARCANITE BODY */
    const before=dmg; dmg*=0.90;
    this._arcT=0.42;                                       /* short plate flash on the hit */
    this._arcAmt=Math.max(1,Math.round(before-dmg));       /* how much it actually ate */
    for(let i=0;i<6;i++)particles.push({x:this.x+rand(-8,8),y:this.centerY+rand(-14,14),
     vx:rand(-70,70),vy:rand(-80,-10),r:1,col:i%2?"#cfe4f5":"#8fa8bf",t:0,life:rand(.18,.35)});}
   if(opts.light){dmg*=1.15;this.healBlock=Math.max(this.healBlock,2);   /* SUNLIGHT */
    this._sunT=1.2;statusFloat(this,"SUNLIGHT +15%","#ffd76a");
    for(let i=0;i<10;i++)particles.push({x:this.x+rand(-10,10),y:this.centerY+rand(-16,16),
     vx:rand(-60,60),vy:rand(-90,-10),r:rand(1,2),col:i%2?"#ffd76a":"#fff3c0",t:0,life:rand(.25,.5)});}
  }
  /* ----- crit ----- */
  let crit=false;
  if(att&&!opts.dot){
   const cc=.05+(att.d.id==="warbringer"?.10:0)+(opts.critBonus||0);
   if(Math.random()<cc){dmg*=1.5;crit=true;}
  }
  /* ----- incoming: phase = invulnerable ----- */
  if(this.phase>0){floaters.push({x:this.x,y:this.y-64,txt:"PHASED",t:0,col:"#bfeaff",size:6});return;}
  const blocked=((this.blocking&&this.onGround)||(this._airBlockT>0))&&!opts.unblockable;   /* ground block OR active air-block window */
  if(this.dr>0)dmg*=.8;
  if(this.zen>0)dmg*=.8;
  if(this.surge>0)dmg*=.75;
  if(this.d.id==="necmi"&&opts.melee)dmg*=.90;
  if(this.d.id==="notalk"&&!opts.dot&&!opts.trueDmg)dmg*=.9;
  if(this.d.id==="ember"&&opts.ballistic)dmg*=.85;
  if(this.d.id==="akira"&&this.chi>=50)dmg*=.9;
  if(this.momT>0&&opts.ranged)dmg*=.85;           /* Ninja Momentum */
  if(this.dr10T>0)dmg*=.9;
  if(this.dr35T>0)dmg*=.65;   /* Satori Air C — Crimson Spine Halo: 35% damage reduction during the spin */
  if(blocked)kb*=0.35;   /* blocking softens knockback; the hit now drains the BLOCK BAR (armor), not HP */
  dmg=Math.max(1,Math.round(dmg));
  /* ----- absorption: ability shields -> (BLOCK BAR only while blocking) -> HP (true & DoT bypass) -----
     NEW BLOCK SYSTEM: an UNBLOCKED hit goes straight to HP. While BLOCKING, the hit drains the block
     bar (armor) instead; any overflow past an emptied bar still spills onto HP. morphShield/barrier are
     separate ability shields and keep absorbing regardless. */
  let hpDmg=dmg;
  if(!opts.trueDmg&&!opts.dot){
   const pierce=(opts.pierce||0)+((att&&att.surge>0)?.15:0);
   if(this.morphShield>0){const a=Math.min(this.morphShield,hpDmg);this.morphShield-=a;hpDmg-=a;if(this.morphShield<=0){this.morphShield=0;}}
   if(this.barrier>0){const a=Math.min(this.barrier,hpDmg);this.barrier-=a;hpDmg-=a;}
   if(blocked&&hpDmg>0&&this.armor>0){
    let a=Math.min(this.armor,Math.round(hpDmg*(1-Math.min(.9,pierce))));
    if(this.defBreak>0)a=Math.round(a*0.85);
    this.armor-=Math.min(this.armor,a);hpDmg-=a;}
  }
  this.hp=Math.max(0,this.hp-hpDmg);
  if(SETTINGS_practiceInfiniteHP(this))this.hp=this.maxhp;   /* PRACTICE: infinite health keeps the bar full */
  this.lastHurt=tGlobal;
  /* ----- reactive: MASS MORPH dough shell — melee attackers take 10 ----- */
  if(this.d.id==="necmi"&&this.morph>0&&opts.melee&&att&&att.alive&&tGlobal-this._thornT>0.4){
   this._thornT=tGlobal;att.hp=Math.max(1,att.hp-10);
   floaters.push({x:att.x,y:att.y-64,txt:"10",t:0,col:"#e8b52e",size:6});
   spawnHitFx(att.x,att.centerY,"#e8b52e",5);
   for(let i=0;i<5;i++)particles.push({x:att.x,y:att.centerY,vx:rand(-90,90),vy:rand(-90,20),r:rand(1,2.5),col:["#f2c230","#e8b52e"][i%2],t:0,life:rand(.2,.4),dough:true});}
  /* ----- energy: attacker only, landed non-DoT hits ----- */
  if(!opts.dot&&att&&att.alive)att.gainMeter(3+dmg*0.08);
  this.hitFlash=blocked?0.05:0.12;
  if(blocked&&!opts.dot)this._blockHitT=0.22;   /* blocked hit -> show the block-impact pose briefly */
  if(!opts.dot&&!blocked){this.hurtT=0.36;this._hitFrame=Math.random()<0.5?1:2;
   this._hitLow=!!(att&&att.crouching&&att.onGround)||!!opts.low;}   /* real hit -> reaction window + random pose; low = hit came from a crouching foe (or a flagged low attack) */
  if(this.windmill<=0){this.vx=dir*kb;
   if(kb>175&&!blocked){
    if(!opts.noPop){this.vy=-Math.min(240,120+kb*0.22);this.onGround=false;}   /* pop up into the arc (skipped for horizontal-only knockbacks like Necmi's 3rd) */
    if(IMG_SPRITES[this.d.id]&&IMG_SPRITES[this.d.id].kb1){this.kbT=1;this.kbLandT=-1;}   /* play the knockback animation either way */
   }}
  floaters.push({x:this.x,y:this.y-64,txt:blocked?"BLOCK":(crit?"CRIT "+dmg:""+dmg),t:0,
   col:blocked?"#9d92c2":(crit?"#ffd23f":(opts.col||"#ffffff")),size:blocked?6:(crit||dmg>=55?10:7)});
  if(!blocked&&dmg>=20) shake=Math.max(shake,dmg>=55?0.5:0.25);
  spawnHitFx(this.x,this.y-32,opts.fx||"#ffd76a",blocked?3:7);
  if(this.hp<=0){this.alive=false; this.vy=-160; this.onGround=false; endRound(other(this));}
 }
}
/* The opposing fighter. */
function other(f){return fighters[0]===f?fighters[1]:fighters[0];}
/* Heals a fighter (respecting HEAL BLOCKED) and pops a floating '+HP' number. */
function heal(f,n){
 if(!f.alive)return;
 if(f.healBlock>0){statusFloat(f,"HEAL BLOCKED","#ffd76a");return;}
 f.hp=Math.min(f.maxhp,f.hp+n);
 if(n>=1)floaters.push({x:f.x,y:MZY(f,70),txt:"+"+Math.round(n),t:0,col:"#7dff9e",size:7});
}
/* Applies or extends a stun duration (shortened for Akira's Heightened Senses passive). */
function applyStun(foe,dur){
 if(foe.d.id==="akira")dur*=0.8;
 foe.stun=Math.max(foe.stun,dur);foe.vx=0;
}

/* =============== FX =============== */
function spawnHitFx(x,y,col,n){for(let i=0;i<n;i++)particles.push({x,y,vx:rand(-130,130),vy:rand(-160,40),r:rand(1,3),col,t:0,life:rand(.25,.5)});}
function elasticSplat(x,y,dir){/* PINCH-MASS impact: elastic dough smoosh + splatter */
 const cols=["#f2c230","#e8b52e","#d99a1e","#c98a18","#b8801a"];
 /* forward splatter fan — dough flung the way it was travelling, flattening on impact */
 for(let i=0;i<16;i++){const ang=(-0.9+Math.random()*1.8);   /* mostly forward cone */
  const sp=rand(120,320);
  particles.push({x:x,y:y,vx:dir*Math.cos(ang)*sp,vy:Math.sin(ang)*sp*0.7-rand(20,80),
   r:rand(1.5,3.5),col:cols[Math.floor(Math.random()*cols.length)],t:0,life:rand(.3,.6),dough:true});}
 /* recoil gobs — a few bits bounce BACK, selling the elastic rebound */
 for(let i=0;i<6;i++){particles.push({x:x-dir*2,y:y+rand(-6,6),vx:-dir*rand(60,160),vy:-rand(40,140),
   r:rand(1,2.5),col:cols[Math.floor(Math.random()*cols.length)],t:0,life:rand(.25,.45),dough:true});}
 /* fat sticky blobs that cling & ooze down (short-lived) */
 for(let i=0;i<4;i++){particles.push({x:x+dir*rand(2,10),y:y+rand(-8,8),vx:dir*rand(10,50),vy:rand(30,110),
   r:rand(2.5,4),col:cols[Math.floor(Math.random()*3)],t:0,life:rand(.35,.55),dough:true});}
 /* squash ring: quick soft pulse where it hit */
 rings.push({x,y,r:3,max:20,col:"#e8b52e",t:0});
 rings.push({x,y,r:2,max:12,col:"#f2c230",t:0});
}
/* ---- LIQUID BLOOD ----
   Droplets fall under the shared particle gravity, stretch along their velocity
   while airborne, and splat into a flat pool when they reach the ground. */
const BLOOD_COLS=["#e2384a","#9c1d2e","#5e1220","#ff5e6e"];
const PART_CAP=420;
/* Caps the particle pool at PART_CAP, discarding the oldest non-pooled particles once exceeded -- a perf safety net. */
function trimParticles(){
 if(particles.length<=PART_CAP)return;
 let over=particles.length-PART_CAP;
 for(let i=0;i<particles.length&&over>0;i++){
  if(!particles[i].pool){particles.splice(i,1);i--;over--;}
 }
 if(particles.length>PART_CAP)particles.splice(0,particles.length-PART_CAP);
}
/* Spawns a burst of blood-droplet particles at a point (bites, dives, slam impacts, etc.). */
function bloodDrops(x,y,n,opts={}){
 const sp=opts.spread||1, up=opts.up||0, dir=opts.dir||0, force=opts.force||1;
 for(let i=0;i<n;i++){
  particles.push({
   x:x+rand(-3,3)*sp, y:y+rand(-3,3),
   vx:(dir*rand(20,160)+rand(-90,90)*sp)*force,
   vy:(rand(-140,-20)-up*rand(0,90))*force,
   r:rand(1,3), col:BLOOD_COLS[Math.floor(Math.random()*BLOOD_COLS.length)],
   t:0, life:rand(.45,1.0), blood:true, pool:0
  });
 }
 trimParticles();
}
function bloodSplash(x,y,n,dir){   /* fan of droplets thrown outward + up */
 for(let i=0;i<n;i++){
  const a=(-0.15-Math.random()*1.25);
  const sp=rand(80,300);
  particles.push({x,y,vx:Math.cos(a)*sp*(dir||1)+rand(-30,30),vy:Math.sin(a)*sp,
   r:rand(1,3),col:BLOOD_COLS[Math.floor(Math.random()*BLOOD_COLS.length)],
   t:0,life:rand(.5,1.1),blood:true,pool:0});
 }
 trimParticles();
}
function ringFx(x,y,col,max){rings.push({x,y,r:4,max,col,t:0});}
/* Round-flow banner (ROUND / FIGHT / WINS ROUND / OVERHEAT) — the only centred on-screen text. */
function roundAnnounce(txt,ms=900){const el=document.getElementById("announce");if(!el)return;el.textContent=txt;el.classList.add("show");clearTimeout(roundAnnounce._t);roundAnnounce._t=setTimeout(()=>el.classList.remove("show"),ms);
 /* Online host mirrors round announcements to the guest (round start / FIGHT / WINS ROUND). */
 if(typeof onlineIsMatchHost==="function"&&onlineIsMatchHost()&&typeof NET_send==="function")NET_send({type:"match_event",event:"announce",text:txt,dur:ms});}
/* Skill/ult NAME banners are SUPPRESSED — every character's skill/ult name routes through announce()
   (or skillAnnounce()), and both are silent. To bring the names back, make these call roundAnnounce. */
function announce(txt,ms){/* suppressed — skill/ult names are not shown */}
function skillAnnounce(txt,ms){/* suppressed */}
/* Pops a small floating status label (e.g. 'STUNNED', 'MISS') above a fighter. */
function statusFloat(f,txt,col){floaters.push({x:f.x,y:MZY(f,78),txt,t:0,col,size:6});}
/* Rolls against a base probability -- a hook for future per-character accuracy tweaks (currently just Math.random()<base). */
function chance(f,base){return Math.random()<(base+(f.d.id==="necmi"?0:0));}
function chaoticFeed(f,onName){/* Chaotic Feed: +10 HP on applying Confuse/Stun, 5s CD */
 if(f.d.id!=="necmi")return 0;
 if(f._feedCD>0)return 0;
 f._feedCD=5;f.hp=Math.min(f.maxhp,f.hp+10);statusFloat(f,"CHAOTIC FEED +10","#b36bff");return 10;}
/* Rolls a fighter's ACCURACY debuff; on a miss, shows 'MISS' and tells the caller to skip the hit. */
function misses(f){if(f.accT>0&&Math.random()<f.accAmt){statusFloat(f,"MISS","#9d92c2");return true;}return false;}
/* Adds to Akira's Chi resource (no-op for other heroes); Chi is pinned at 100 while ZEN STATE is active. */
function addChi(f,n){if(f.d.id!=="akira")return;if(f.zen>0){f.chi=100;return;}f.chi=Math.max(0,Math.min(100,f.chi+n));}
/* Adds to Emberstrike's Heat resource (no-op for other heroes); triggers OVERHEAT once it reaches 100. */
function addHeat(f,n){
 if(f.d.id!=="ember")return;
 if(n<0){f.heat=Math.max(0,f.heat+n);return;}
 f.heat+=n;
 if(f.heat>=100){/* OVERHEAT */
  f.heat=30;f.hp=Math.max(1,f.hp-40);f.skillLock=2;f.overheatDeb=3;
  roundAnnounce("OVERHEAT!",800);statusFloat(f,"OVERHEAT -40","#e2384a");
  spawnHitFx(f.x,f.centerY,"#f28022",14);ringFx(f.x,f.centerY,"#e2384a",60);shake=Math.max(shake,.5);}
}

/* =============== MELEE HELPER =============== */
/* Generic delayed melee hit: after `delay` ms, checks range/facing/height against the opponent and applies damage -- the workhorse behind most heroes' melee skills. */
function meleeHit(f,{range=48,dmg=8,kb=120,delay=110,opts={},onHit=null}){
 setTimeout(()=>{if(!running)return;
  if(misses(f))return;
  const foe=other(f),dx=foe.x-f.x;
  if(opts.melee===undefined)opts.melee=true;
  if(foe.alive&&Math.abs(dx)<range&&dx*f.facing>-10&&Math.abs(foe.hurtY-f.centerY)<S(45)){
   foe.takeDamage(dmg,kb,f.facing,opts);
   if(opts.skill)addChi(f,15);
   if(onHit)onHit(foe);
  }
  hitProps(f.x,f.facing,range,dmg,f,f.centerY,true);   /* melee skill — can hit scaffolds */
 },delay);
}

/* Satori's CRIMSON DISCIPLINE: alternating melee/ranged skill types empowers the next one. Returns whether THIS cast is empowered. */
function useDiscipline(f,T){
 if(f.d.id!=="satori")return false;
 let emp=false;
 if(f.momBonusT>0){emp=true;f.momBonusT=0;}
 else if(f.discT>0&&f.discPend===T)emp=true;
 f.discPend=(T==="ranged"?"melee":"ranged");f.discT=4;
 if(emp)statusFloat(f,"EMPOWERED +10","#ff5e6e");
 return emp;
}
/* Munevver's CALCULATED PRECISION: builds a Calculation Mark toward 3 (no-op for other heroes). */
function gainMark(f){if(f.d.id!=="munevver")return;
 if(f.marks<3){f.marks++;if(f.marks===3)statusFloat(f,"CALCULATION READY","#5fe8e0");}}
/* Consumes Munevver's 3 Calculation Marks for a bonus, if ready (no-op for other heroes). */
function consumeMarks(f){if(f.d.id!=="munevver")return false;
 if(f.marks>=3){f.marks=0;statusFloat(f,"CALCULATED!","#f2b632");return true;}
 return false;}
/* Clears every positive buff/status flag on a fighter (used by cleanse/strip effects). */
function stripBuffs(foe){foe.shield=0;foe.barrier=0;foe.strStacks=0;foe.windmill=0;foe.palmT=0;foe._wmGrab=false;foe.flying=false;foe.slamT=0;foe.diveT=0;foe.grabT=0;foe.seizeT=0;foe.koPose=0;foe.seizedBy=null;foe._grabbed=false;foe._bit=false;foe._smashed=false;foe.spdBuff=0;foe.regenHoT=0;foe.surge=0;foe.morph=0;foe.dr=0;foe.zen=0;foe.dr10T=0;foe.momT=0;foe.momBonusT=0;foe.discT=0;}
/* stripBuffs() plus every negative DoT/debuff too, then announces NORMALIZED -- Necaati's full-strip effect. */
function stripAll(foe){stripBuffs(foe);foe.burn=0;foe.poison=0;foe.bleed=0;foe.confuse=0;foe.silence=0;foe.disarm=0;foe.weakenT=0;foe.accT=0;foe.slowT=0;foe.defBreak=0;statusFloat(foe,"NORMALIZED","#3fd8c7");}

/* =============== ULTIMATES (T / M — needs a full ENERGY bar) =============== */
const ULT_RANGE={putuk:75,agron:180,ember:130,notalk:190,necaati:150,akira:170,haydar:70};
/* Attempts to cast the R/M ultimate: blocked while attacking/blocking/silenced/locked or under 100 Energy; otherwise spends the meter and runs ULTS[id]. */
function tryUlt(f){
 if(f.state==="special"||f.blocking)return;
 if(f.silence>0){statusFloat(f,"SILENCED","#d8cfc4");return;}
 if(f.skillLock>0)return;
 if(f.meter<100)return;
 f.ultContext=fighterContext(f);   /* ult fires on the ground OR in the air (same ult in every stance) */
 f.meter=0;shake=Math.max(shake,.45);
 f.ultPose=0.9;f.poseSkill=-1;
 ULTS[f.d.id](f);
}
/* Haydar's ult release: strength tier from how long it was charged (4 tiers over 2s), then the slam. */
function releaseHaydarUlt(f){
 if(!f.ultCharging)return;
 f.ultCharging=false;
 f._ultTier=Math.min(4,Math.floor(f.ultChargeT/0.5)+1);
 f.meter=0;                       /* energy spent only when the slam actually fires */
 f.ultPose=0.7;f.poseSkill=-1;f.t=0;f.state="special";
 shake=Math.max(shake,.3+f._ultTier*0.1);
 ULTS.haydar(f);
}
/* One cast function per hero for their R/M ultimate -- mirrors the `ult` name/description on that hero's CHARS entry. */
const ULTS={
 ember(f){skillAnnounce("FLAME SPIRAL",1100);f.state="special";f.t=0;
  const bonus=f.heat>=80?40:f.heat>=50?20:0;f.heat=0;
  const foe=other(f);
  [120,300,480,660,840].forEach((d,i)=>meleeHit(f,{range:S(60),dmg:i===4?22+bonus:22,kb:i===4?220:20,delay:d,
   opts:{skill:true,col:"#f28022",fx:"#ffd23f"},onHit:i===4?(fo=>{fo.burnDps=10;fo.burn=Math.max(fo.burn,4);statusFloat(fo,"BURN","#f28022");}):null}));
  for(let i=0;i<10;i++)setTimeout(()=>{if(running)particles.push({x:f.x+rand(-14,14),y:f.y-rand(10,64),vx:rand(-40,40),vy:rand(-120,-40),r:rand(1,3),col:i%2?"#ffd23f":"#f28022",t:0,life:.4});},i*90);},
 akira(f){skillAnnounce("ZEN STATE",1100);f.state="special";f.t=0;
  f.zen=6;f.chi=100;ringFx(f.x,f.centerY,"#7de8d8",170);ringFx(f.x,f.centerY,"#ffd76a",120);
  setTimeout(()=>{if(!running)return;const foe=other(f);
   if(Math.abs(foe.x-f.x)<170){foe.takeDamage(90,220,Math.sign(foe.x-f.x)||f.facing,{skill:true,col:"#7de8d8",fx:"#7de8d8"});
    applyStun(foe,1);statusFloat(foe,"STUNNED","#7de8d8");}},180);},
};

/* Munevver's ult payoff: resolves the CODEX collapse once its orbiting-numbers animation finishes -- damages the target and grants her Armor. */
function resolveCodex(c){
 if(!running||roundOver)return;
 const foe=c.target,f=c.owner;
 skillAnnounce("COLLAPSE!",700);
 ringFx(foe.x,foe.centerY,"#5fe8e0",100);ringFx(foe.x,foe.centerY,"#f2b632",70);
 shake=Math.max(shake,.65);
 for(let i=0;i<16;i++)particles.push({x:foe.x+rand(-20,20),y:foe.centerY+rand(-30,30),vx:rand(-120,120),vy:rand(-150,30),r:rand(1,3),col:i%2?"#5fe8e0":"#eaffff",t:0,life:rand(.3,.6)});
 if(foe.alive){
  foe.takeDamage(c.bonus?120:110,180,Math.sign(foe.x-f.x)||1,{skill:true,col:"#5fe8e0",fx:"#f2b632"});
  foe.weakenT=4;foe.weakenAmt=.15;statusFloat(foe,"DAMAGE DOWN","#f2b632");}
 if(f.alive){
  f.armor=Math.min(f.maxArmor,f.armor+45);statusFloat(f,"+45 ARMOR","#9fb8c9");}
 f.marks=2;statusFloat(f,"PERFECT CALCULATION","#5fe8e0");
}

/* =============== CONTROL =============== */
/* Builds a semantic input source for one fighter. Local fighters read the shared
   `keys` object through their control profile; "remote" fighters (online opponent)
   read ONLINE.remoteHeld. Both expose the same down()/clear() interface so readInput
   is source-agnostic. This is deliberately NOT injecting fake keys into `keys`. */
function makeInputSource(f){
 if(f.ctrl==="remote"){
  const R=(typeof ONLINE!=="undefined"&&ONLINE.remoteHeld)?ONLINE.remoteHeld:{};
  return { down:a=>!!R[a], clear:a=>{R[a]=false;} };
 }
 const K=f.ctrl==="p2"?P2KEYS:P1KEYS;
 const m={left:K.left,right:K.right,jump:K.jump,block:K.block,crouch:K.crouch,
          attack:K.atk,ability1:K.ab[0],ability2:K.ab[1],ability3:K.ab[2],ultimate:K.ult};
 return { down:a=>!!keys[m[a]], clear:a=>{keys[m[a]]=false;} };
}
/* Reads this frame's input for one human/remote fighter and turns it into movement,
   blocking/crouching, jumps, and skill/attack/ult presses. */
function readInput(f,dt){
 if(f.frozen>0||f.stun>0||!f.alive||roundOver){f.blocking=false;return;}
 if(f.ctrl==="cpu"){aiControl(f,dt);return;}
 const IN=makeInputSource(f);
 /* HAYDAR ULT — hold to charge (4 strength tiers over 2s), release to slam */
 if(f.d.id==="haydar"){
  if(f.ultCharging){
   f.blocking=false;f.crouching=false;f.vx=0;f.state="special";
   if(IN.down("ultimate"))f.ultChargeT=Math.min(2,f.ultChargeT+dt);
   else releaseHaydarUlt(f);
   return;
  }
  if(IN.down("ultimate")&&f.meter>=100&&f.onGround&&f.state!=="attack"&&f.state!=="special"&&f.silence<=0&&f.skillLock<=0){
   f.ultCharging=true;f.ultChargeT=0;f.vx=0;f.state="special";f.t=0;return;
  }
 }
 let mv=0;
 if(IN.down("left"))mv-=1; if(IN.down("right"))mv+=1;
 if(f.confuse>0)mv=-mv;
 f.blocking=!!IN.down("block")&&f.onGround&&!f.guardBroken;   /* can't block while guard is broken (block bar drained) */
 f.crouching=(f.d.id==="satori"&&f.state==="special"&&f.skillContext==="crouch")   /* a crouch SKILL stays crouched through its whole sequence even if the button is released */
  ||(!!IN.down("crouch")&&f.onGround&&!f.blocking);
 f._crouchBlock=f.blocking&&!!IN.down("crouch")&&f.onGround;   /* holding crouch + block -> low (crouch) block pose */
 /* SATORI AIR BLOCK: TAP block in the air -> a 0.5s reaction guard (no need to hold). Costs 25% of the
    block bar up front, and only once per airborne period (can't block again until he lands). */
 {const blk=!!IN.down("block");
  if(f.d.id==="satori"&&!f.onGround&&blk&&!f._blkPrev&&!f._airBlockUsed&&!f.guardBroken&&f.armor>=f.maxArmor*0.25){
   f._airBlockT=0.35;f._airBlockUsed=true;f.armor-=f.maxArmor*0.25;statusFloat(f,"AIR GUARD","#8fd8ff");}
  f._blkPrev=blk;}
 if(f.blocking)f.lastAction=tGlobal;
 if(f.state==="attack"||f.state==="special"){f.vx*=0.85;return;}
 if(f.blocking){f.vx=0;f.state="idle";return;}
 if(f.jumpWindup>0){f.vx=0;f.state="idle";return;}   /* committed to the jump — locked on the ground during the wind-up */
 if(f.crouching){f.vx=0;f.state="idle";}
 else{
  const rooted=f.rootT>0;   /* Satori's ROOT: pinned in place (no move / no jump) but may still attack & block */
  /* SATORI: during the landing pose or a hurt reaction, ignore walk input so his feet don't slide
     (knockback fly-back still happens — that runs while stunned, before this branch). Jump still allowed. */
  const planted=(f.d.id==="satori"&&f.onGround&&(f.landT>0||f.hurtT>0||f.fallDmgT>0));
  f.vx=(rooted||planted)?0:mv*f.d.speed*(f.spdBuff>0?1.6:1)*(f.agilityT>0?1.12:1)*(f.slowT>0?(1-f.slowAmt):1)*(f.frenzy>0?1.1:1);   /* Ninja Agility: +12% move */
  f.state=(mv!==0&&!rooted&&!planted)&&f.onGround?"walk":(f.onGround?"idle":"jump");
  if(mv!==0&&!planted)f.facing=mv>0?1:-1;
  if(!rooted&&IN.down("jump")&&(f.onGround||((f.d.id==="necaati"||f.d.id==="satori"||f.d.id==="agron")&&f.jumps<2))){
   if(f.onGround){if(f.jumpWindup<=0)f.jumpWindup=JUMP_WINDUP;}   /* start the GROUND wind-up; the launch fires when it ends */
   else if(f.jumps<2){f.vy=-f.d.jump*.85;f.jumps=2;f.airSkillT=0;f.jumpT=0;f.airAtkN=0;   /* double jump cancels the air-skill window + refreshes the 3 air attacks */
    if(IMG_SPRITES[f.d.id]&&IMG_SPRITES[f.d.id].dblfx1)groundFx.push({id:f.d.id,x:f.x,y:f.y,t:0,facing:f.facing});   /* energy burst stays at the take-off point */
    else ringFx(f.x,f.y,f.d.id==="agron"?"#e2384a":"#3fd8c7",22);}
   IN.clear("jump");
  }
  /* AGRON — true temporary flight: hold JUMP in the air (4s budget, 15s cooldown) */
  if(f.d.id==="agron"&&f.alive){
   const wantFly=!f.onGround&&f.jumps>=2&&IN.down("jump")===true&&f.flyT>0&&f.flyCd<=0;
   if(wantFly){
    f.flying=true;
    f.vy=Math.min(f.vy,0)*0.25-6;            /* cancel fall, gentle lift */
    if(IN.down("crouch"))f.vy=70;            /* descend */
   }else f.flying=false;
  }
 }
 if(IN.down("attack")){IN.clear("attack");tryAttack(f);}
 if(IN.down("ultimate")){IN.clear("ultimate");if(f.d.id!=="haydar")tryUlt(f);}   /* haydar's ult is hold-to-charge only (handled above) */
 for(let i=0;i<3;i++)if(IN.down("ability"+(i+1))){IN.clear("ability"+(i+1));tryAbility(f,i);}
}
/* Attempts the basic attack (D/K): melee for most heroes, a rifle shot for Haydar; also resolves Necmi's 3-hit combo finisher. */
function tryAttack(f){
 if(f.state==="attack"||f.state==="special"||f.blocking)return;
 if(f.disarm>0){/* LIMB HIJACK: normal attacks disabled (skills & Ult still work) */
  statusFloat(f,"CAN'T ATTACK","#b36bff");return;}
 f.skillContext=fighterContext(f);   /* air/crouch/ground basic attack */
 if(f.skillContext==="air"&&(f.airAtkN||0)>=3)return;   /* air combo is 3 hits — after that he falls & can't attack until landing */
 /* reset the combo chain if too long since the last swing (so it reliably goes 1->2->3) */
 if((tGlobal-(f.lastAction||0))>0.8){f._atkAlt=true;if(f.d.id==="necmi"||f.d.id==="satori")f._atkStep=0;}   /* stale combo -> restart at hit 1 */
 f.state="attack";f.t=0;f.lastAction=tGlobal;f._atkAlt=!f._atkAlt;f._atkStep=(f._atkStep+1)%64;f.poseSkill=-1;
 f.atkHit=((f._atkStep-1)%3+3)%3;   /* 3-hit combo index (0,1,2); hit 3 (=2) is the HEAVY */
 if(f.skillContext==="air"){f.atkHit=Math.min(f.airAtkN||0,2);f.airAtkN=(f.airAtkN||0)+1;}   /* AIR combo: own 1->2->3 counter */
 const _sid=onlineSessionId,_rid=onlineRoundId;   /* online: ignore this delayed hit if the round/session moved on */
 const hitDelay=(f.d.id==="satori"&&f.skillContext==="air"&&f.atkHit===2)?200:110;   /* air hit 3 has a wind-up, so the hit lands later (on the strike frame) */
 setTimeout(()=>{if(!running||onlineCallbackStale(_sid,_rid))return;
  if(misses(f))return;
  const foe=other(f),dx=foe.x-f.x;
  /* NECMI: the 3rd swing of his chain (attack3) launches the foe back */
  const necmi3=(f.d.id==="necmi"&&(((f._atkStep-1)%3+3)%3)===2);
  /* SATORI basic combos — per stance (ground/air/crouch), per hit (1/2/3), with a finisher effect */
  const sat=(f.d.id==="satori");
  const sctx=sat?((f.skillContext==="air"||f.skillContext==="crouch")?f.skillContext:"ground"):null;
  const hi=f.atkHit||0, fin=(sat&&hi===2);
  let dmg=f.d.power, kb=necmi3?520:120, reach=44, hH=40;
  if(sat){
   dmg=({ground:[18,20,28],air:[17,19,27],crouch:[16,18,25]}[sctx])[hi];   /* Crimson Rake/Flowing Talon/Rising Twin Fang etc. */
   kb=fin?(sctx==="ground"?150:sctx==="air"?150:170):90;
   reach=(sctx==="crouch")?46:(fin?50:44);
   hH=(sctx==="crouch")?30:40;   /* crouch attacks hit lower */
  }
  if(Math.abs(dx)<S(reach)&&dx*f.facing>-10&&Math.abs(foe.hurtY-f.centerY)<S(hH)){
   foe.takeDamage(dmg,kb,f.facing,{melee:true,noPop:necmi3||fin});
   addChi(f,5);
   if(typeof dogBuffOnHit==="function")dogBuffOnHit(f,foe);   /* dog-kill buff: bonus poison on basic hits */
   if(necmi3){shake=Math.max(shake,.3);ringFx(foe.x,foe.centerY,"#e8b52e",34);
    foe.stun=Math.max(foe.stun,0.45);           /* brief hitstun so the knockback reads as a stagger */
    for(let i=0;i<10;i++)particles.push({x:foe.x,y:foe.centerY,vx:f.facing*rand(120,300),vy:rand(-120,40),r:rand(1.5,3),col:["#f2c230","#e8b52e","#d99a1e"][i%3],t:0,life:rand(.3,.55),dough:true});}
   if(fin){shake=Math.max(shake,.35);ringFx(foe.x,foe.centerY,"#e2384a",42);
    if(sctx==="ground"){foe.vy=-160;foe.onGround=false;}                                              /* Rising Twin Fang: slight upward launch */
    else if(sctx==="air"){foe.vy=Math.max(foe.vy,300);foe.onGround=false;foe.groundBounce=true;statusFloat(foe,"SPIKED","#ff8fa0");}  /* Falling Fang: send DOWN + ground bounce */
    else if(sctx==="crouch"){foe.bleedDps=6;foe.bleed=Math.max(foe.bleed,2);statusFloat(foe,"BLEED","#ff5e6e");}   /* Tendon Fang: bleed 6/s 2s */
    for(let i=0;i<8;i++)particles.push({x:foe.x,y:foe.centerY,vx:f.facing*rand(100,240),vy:rand(-120,30),r:rand(1.5,3),col:i%2?"#e2384a":"#ff8fa0",t:0,life:rand(.25,.5)});}
  }
  hitProps(f.x,f.facing,reach,dmg,f,f.centerY,true);   /* basic attack (melee) — can hit scaffolds */
  if(fin){f.agilityT=2.5;statusFloat(f,"NINJA AGILITY","#ff5e6e");}   /* completing a basic sequence -> Ninja Agility */
 },hitDelay);
}
/* Attempts to cast an ability (slot i): blocked while casting/blocking/silenced/locked or on cooldown; otherwise starts its cooldown and runs ABILITIES[id][i]. */
function tryAbility(f,i){
 if(f.state==="special"||f.blocking)return;
 if(f.silence>0){statusFloat(f,"SILENCED","#d8cfc4");return;}
 if(f.skillLock>0){statusFloat(f,"LOCKED","#e2384a");return;}
 if(f.cd[i]>0)return;
 const ctx=fighterContext(f);
 /* AIR skill: only inside the post-jump window (press jump, then the skill within 1s; a double jump cancels it) */
 if(ctx==="air"&&(f.airSkillT||0)<=0)return;
 /* SATORI Skill A (slot 0) uses a 2-charge system instead of a flat cooldown (see updateFighter). */
 const satA=(f.d.id==="satori"&&i===0);
 if(satA&&(f._aChg||0)<=0)return;
 if(ctx==="air")f.airSkillT=0;   /* one air skill per jump */
 if(satA){f._aChg--;if(f._aChg===1)f._aWin=4;else{f._aWin=0;f.cd[0]=8;}}
 else f.cd[i]=f.d.ab[i].cd;
 f.lastAction=tGlobal;
 f.poseSkill=i;
 f.skillContext=ctx;   /* tag for the (future) crouch/air animation + effect variants */
 if(f.d.id==="notalk"){f.hmmBub=1.1;f.hmmBig=false;}
 /* route to this stance's variant table if it has one, else the normal ground skill (same for now) */
 const vt=ctx==="crouch"?ABILITIES_CROUCH[f.d.id]:ctx==="air"?ABILITIES_AIR[f.d.id]:null;
 ((vt&&vt[i])||ABILITIES[f.d.id][i])(f);
 gainMark(f);
}

/* =============== CPU AI =============== */
/* Drives a CPU-controlled fighter: decides whether to block, ult, use a skill, attack, or move, based on difficulty (cpuDiff) and the current matchup. */
function aiControl(f,dt){
 const foe=other(f);if(!foe.alive)return;
 let diff=cpuDiff;
 if(cpuDiff===3){/* PRACTICE: dummy behavior is a settings choice */
  const beh=(typeof activeSettings!=="undefined")?activeSettings.practice.dummyBehavior:"stand";
  if(beh==="stand"){
   f.aiMove=0;f.blocking=false;f.crouching=false;f.vx=0;
   if(f.state==="idle"||f.state==="walk")f.facing=f.x<foe.x?1:-1;   /* just face the player */
   return;}
  if(beh==="block"){
   f.aiMove=0;f.crouching=false;f.facing=f.x<foe.x?1:-1;
   if(f.onGround&&!f.guardBroken){f.blocking=true;f.vx=0;f.state="idle";f.lastAction=tGlobal;}
   return;}
  diff=1;   /* "fight": behave like a Warrior-level opponent */
 }
 f.aiT-=dt;
 const dx=foe.x-f.x, adist=Math.abs(dx);
 const react=[.62,.38,.22][diff], agg=[.22,.42,.65][diff];
 if(f.aiT<=0){
  f.aiT=react+rand(0,.2);
  f.aiMove=0;f.blocking=false;f.crouching=false;
  const threat=projectiles.find(p=>p.owner===foe&&Math.sign(p.vx)===Math.sign(f.x-p.x)&&Math.abs(p.x-f.x)<160&&p.y<MZY(f,22));
  if(threat&&f.onGround&&Math.random()<[.2,.45,.7][diff]){f.crouching=true;}
  const foeAtk=foe.state==="attack"||foe.state==="special";
  const usable=[0,1,2].filter(i=>f.cd[i]<=0&&f.silence<=0&&f.skillLock<=0);
  if(foeAtk&&adist<65&&!f.guardBroken&&Math.random()<[.25,.5,.75][diff]){f.blocking=true;}
  else if(f.meter>=100&&f.silence<=0&&f.skillLock<=0&&adist<(ULT_RANGE[f.d.id]||999)
   &&(f.d.id!=="ember"||f.heat>=50||Math.random()<.25)&&Math.random()<agg){tryUlt(f);}
  else if(usable.length&&Math.random()<agg*.55){
   let pick=-1;
   const healIdx=usable.find(i=>f.d.ab[i].kind==="heal");
   const buffIdx=usable.find(i=>f.d.ab[i].kind==="buff");
   const meleeIdx=usable.find(i=>f.d.ab[i].kind==="melee");
   const rangedIdx=usable.find(i=>f.d.ab[i].kind==="ranged");
   if(f.d.id==="ember"&&f.heat>=85&&usable.includes(2))pick=2;
   else if(healIdx!==undefined&&f.hp<f.maxhp*.45)pick=healIdx;
   else if(f.d.id==="necmi"&&usable.includes(2)&&f.hp<f.maxhp*.5)pick=2;
   else if(meleeIdx!==undefined&&adist<60)pick=meleeIdx;
   else if(rangedIdx!==undefined&&adist>70&&adist<230)pick=rangedIdx;
   else if(buffIdx!==undefined&&Math.random()<.5)pick=buffIdx;
   if(pick>=0)tryAbility(f,pick);
   else f.aiMove=Math.sign(dx);
  }
  else if(adist>55)f.aiMove=Math.sign(dx);
  else if(Math.random()<agg)tryAttack(f);
  else f.aiMove=Math.sign(dx)*(Math.random()<.4?-1:1);
  if(f.onGround&&Math.random()<[.03,.06,.1][diff]&&adist<120){f.vy=-f.d.jump;f.onGround=false;f.jumps=1;}
 }
 if(f.state==="attack"||f.state==="special"){f.vx*=.85;return;}
 if(f.blocking&&f.onGround){f.vx=0;f.state="idle";f.lastAction=tGlobal;return;}
 if(f.crouching&&f.onGround){f.vx=0;f.state="idle";f.facing=dx>0?1:-1;return;}
 if(f.confuse>0)f.aiMove=-f.aiMove;
 f.vx=f.aiMove*f.d.speed*(f.spdBuff>0?1.6:1)*(f.slowT>0?(1-f.slowAmt):1);
 if(f.aiMove!==0){f.facing=f.aiMove>0?1:-1;f.state=f.onGround?"walk":"jump";}
 else{f.facing=dx>0?1:-1;f.state=f.onGround?"idle":"jump";}
 if(adist<48&&f.aiT>react*.5&&Math.random()<agg*dt*5)tryAttack(f);
}
/* =============== UPDATE =============== */
/* The main per-frame fighter update: ticks every buff/debuff timer, runs each hero's unique passive/channel logic (Agron's grab/dive/flight, No-Talking Man's drag, dash movement, DoTs), then applies gravity and ground collision. */
function updateFighter(f,dt){
 if(f.hitFlash>0)f.hitFlash-=dt;
 for(let i=0;i<3;i++)if(f.cd[i]>0)f.cd[i]-=dt*(f.agilityT>0?1.12:1);   /* Ninja Agility: +12% cooldown recovery */
 if(f.agilityT>0)f.agilityT-=dt;
 if(cpuDiff===3&&f.ctrl!=="cpu"&&typeof activeSettings!=="undefined"){  /* PRACTICE options for the practicing player */
  if(activeSettings.practice.cooldowns==="disabled")f.cd=[0,0,0];
  if(activeSettings.practice.energy==="infinite")f.meter=100;
 }
 if(f.frozen>0){f.frozen-=dt;return;}
 if(f.stun>0){f.stun-=dt;if(f.kbT>0&&!f.onGround)f.x+=f.vx*dt;else{f.vx*=Math.pow(.02,dt);f.x+=f.vx*dt;}}   /* a knockback flight keeps its horizontal speed (flies back) */
 if(f.confuse>0)f.confuse-=dt;
 if(f.silence>0)f.silence-=dt;
 if(f.shield>0)f.shield-=dt;
 if(f.barrierT>0){f.barrierT-=dt;
  if(f.barrierHeal>0){const h=Math.min(5*dt,f.barrierHeal);f.barrierHeal-=h;f.hp=Math.min(f.maxhp,f.hp+h);}
  if(f.barrierT<=0)f.barrier=0;}
 if(f.spdBuff>0)f.spdBuff-=dt;
 if(f.dr>0)f.dr-=dt;
 if(f.weakenT>0)f.weakenT-=dt;
 if(f.accT>0)f.accT-=dt;
 if(f.slowT>0)f.slowT-=dt;
 if(f.disarm>0)f.disarm-=dt;
 if(f.phase>0)f.phase-=dt;
 if(f.skillLock>0)f.skillLock-=dt;
 if(f.ultPose>0)f.ultPose-=dt;
 if(f.counterT>0){f.counterT-=dt;
  if(f.d.id==="putuk")for(let i=0;i<3;i++)particles.push({x:f.x+rand(-20,20),y:f.centerY+rand(-28,28),vx:rand(-28,28),vy:rand(-48,6),r:rand(1,3),col:["#8fe8ff","#3fd8ff","#bff2ff","#eaffff"][i%4],t:0,life:rand(.22,.5)});
  if(f.counterT<=0&&f.d.id==="putuk"&&f.state==="special"){f.state="idle";f.poseSkill=-1;}}
 if(f._counterHitT>0){f._counterHitT-=dt;if(f._counterHitT<=0&&f.d.id==="putuk"&&f.state==="special"){f.state="idle";f.poseSkill=-1;}}
 if(f.ultCharging){
  if(f.stun>0||f.frozen>0||!f.alive){f.ultCharging=false;if(f.state==="special")f.state="idle";}
  else{const full=f.ultChargeT>=2,armX=f.x-f.facing*S(21),armY=f.centerY-S(33);   /* raised mechanical fist: up & cocked back (the slap arm) */
   const n=full?3:1+Math.floor(f.ultChargeT/0.7);
   for(let s=0;s<n;s++)particles.push({x:armX+rand(-11,11),y:armY+rand(-13,13),vx:rand(-22,22),vy:rand(-26,26),r:rand(1,full?2.6:1.8),col:full?["#eaffff","#ffffff","#bfeaff"][s%3]:["#8fd8ff","#bfeaff"][s%2],t:0,life:rand(.1,.22)});
   if(full&&Math.sin(tGlobal*30)>0.6)ringFx(armX,armY,"#eaffff",S(14));}
 }
 if(f.skillAT>0){f.skillAT-=dt; if(f.skillAT<=0&&f.state==="special"&&(f.d.id==="munevver"||f.d.id==="necmi"||f.d.id==="haydar")){f.state="idle";f.poseSkill=-1;}}
 if(f.skillBT>0){f.skillBT-=dt; if(f.skillBT<=0&&f.state==="special"&&(f.d.id==="necmi"||f.d.id==="haydar")){f.state="idle";f.poseSkill=-1;}}
 if(f.palmT>0)f.palmT-=dt;
 if(f.hmmBub>0){f.hmmBub-=dt; if(f.hmmBub<=0)f.hmmBig=false;}
 if(f.healBlock>0)f.healBlock-=dt;
 if(f._arcT>0)f._arcT-=dt;
 if(f._sunT>0)f._sunT-=dt;
 if(f._hungerT>0)f._hungerT-=dt;
 if(f.frenzy>0){f.frenzy-=dt; if(f.frenzy<=0)statusFloat(f,"FRENZY ENDS","#e2384a");}
 if(f.skStage>0)f.skStage-=dt;
 if(f.diveT>0)f.diveT-=dt;
 if(f.grabT>0)f.grabT-=dt;
 if(f.slamT>0){f.slamT-=dt; if(f.slamT<=0&&f.state==="special")f.state="idle";}
 if(f.koPose>0){f.koPose-=dt; if(f.koPose<=0)f.seizedBy=null;}
 /* AGRON — BLOOD SEIZE: charge forward, catch them, bite, then SMASH */
 if(f.d.id==="agron"&&f.seizeT>0){
  f.seizeT-=dt;
  const foe=other(f);
  if(!f.seizeHit){
   f.x+=f.facing*430*dt;                                     /* the charge */
   particles.push({x:f.x-f.facing*rand(4,14),y:f.y-rand(8,46),vx:-f.facing*rand(30,80),
    vy:rand(-25,25),r:rand(1,2),col:"#9c1d2e",t:0,life:.3});
   if(foe.alive&&Math.abs(foe.x-f.x)<S(32)&&Math.abs(foe.hurtY-f.centerY)<S(48)){
    f.seizeHit=true;f._grabbed=true;f.seizeT=0;
    f.grabT=0.72;                                            /* grab->bite->smash poses */
    f.vx=0;
    foe.seizedBy=f;
    applyStun(foe,1.0);foe.vx=0;
    statusFloat(foe,"SEIZED","#9c1d2e");
    shake=Math.max(shake,.35);
   }
  }
  if(f.seizeT<=0&&!f.seizeHit){                              /* charge whiffed */
   f._grabbed=false;f.state="idle";
   f.skillLock=Math.max(f.skillLock,0.40);
   statusFloat(f,"MISSED","#8e83b5");
  }
 }
 /* held victim rides along, then eats the smash */
 if(f.d.id==="agron"&&f.grabT>0&&f._grabbed){
  const foe=other(f);
  const p=1-f.grabT/0.72;
  f.vx=0;
  if(foe.alive){
   foe.vx=0;foe.stun=Math.max(foe.stun,.2);
   if(p<0.62){                                               /* held up in front of him */
    const hold=f.x+f.facing*S(22);
    foe.x+=(hold-foe.x)*Math.min(1,dt*20);
    if(p>0.30&&!f._bit){f._bit=true;                         /* the bite */
     foe.takeDamage(50,0,f.facing,{unblockable:true,melee:true,skill:true,col:"#9c1d2e",fx:"#9c1d2e"});
     const low=f.hp<f.maxhp*0.5;heal(f,low?20:15);           /* BLOOD HUNGER */
     if(low){f._hungerT=1.4;statusFloat(f,"BLOOD HUNGER!","#ff5e6e");}
     shake=Math.max(shake,.45);
     bloodSplash(foe.x,foe.centerY-S(8),26,f.facing);        /* arterial spray */
     bloodDrops(foe.x,foe.centerY-S(6),16,{spread:1.6,up:1.2,force:1.15});}
    /* blood keeps running down while he drinks */
    if(f._bit&&Math.random()<0.55)bloodDrops(foe.x+rand(-4,4),foe.centerY-S(6),1,{spread:.3,force:.45});
   }else if(!f._smashed){                                    /* SMASH them down */
    f._smashed=true;
    foe.x=f.x+f.facing*S(20);
    foe.y=f.y;foe.onGround=true;foe.vy=0;
    foe.koPose=1.5;                                          /* lie in THEIR ko art */
    foe.takeDamage(25,0,f.facing,{unblockable:true,skill:true,col:"#9c1d2e",fx:"#9c1d2e"});
    applyStun(foe,1.5);                                      /* pinned on the ground */
    ringFx(foe.x,foe.y,"#9c1d2e",52);shake=Math.max(shake,.75);
    bloodSplash(foe.x,foe.y-S(4),22,1);                      /* burst right */
    bloodSplash(foe.x,foe.y-S(4),22,-1);                     /* burst left */
    bloodDrops(foe.x,foe.y-S(8),26,{spread:2.2,up:1.4,force:1.3});
   }
  }
  if(f.grabT<=0){f._grabbed=false;f._bit=false;f._smashed=false;f.state="idle";}
 }
 /* safety: if the grab ended for ANY reason, never leave stage flags stuck on */
 if(f.d.id==="agron"&&f.grabT<=0&&f.seizeT<=0&&(f._bit||f._smashed||f._grabbed)){
  f._grabbed=false;f._bit=false;f._smashed=false;
 }
 /* AGRON — GRAVITY DIVE arc: rise, then dive forward with claws out */
 if(f.d.id==="agron"&&f.diveT>0){
  const p=1-f.diveT/1.15;
  if(p<0.30){ f.vy=-470; f.vx=f.facing*60; }                     /* launch: high climb */
  else if(p<0.56){ f.vy=-25; f.vx=f.facing*95; }                 /* hang at apex, claws out */
  else{ f.vy=Math.max(f.vy,240); f.vx=f.facing*230;              /* dive forward (slower) */
   if(Math.random()<0.5)bloodDrops(f.x-f.facing*rand(2,10),f.y-rand(20,50),1,{spread:.4,force:.4});}
  const foe=other(f);
  if(!f._diveHit&&p>0.3&&Math.abs(foe.x-f.x)<S(38)&&Math.abs(foe.hurtY-f.centerY)<S(52)&&foe.alive){
   f._diveHit=true;
   foe.takeDamage(65,190,f.facing,{melee:true,skill:true,col:"#8f6cf0",fx:"#a07cff"});
   spawnHitFx(foe.x,foe.centerY,"#8f6cf0",8);shake=Math.max(shake,.55);
   bloodSplash(foe.x,foe.centerY-S(4),22,f.facing);
   bloodDrops(foe.x,foe.centerY,14,{spread:1.8,up:1.1,force:1.2});
  }
  if(f.diveT<=0||(f.onGround&&p>0.5)){
   const slammed=f.onGround;
   f.diveT=0;f._diveHit=false;f.vx=0;
   if(slammed){
    f.slamT=0.46;                                   /* hold the impact pose */
    ringFx(f.x,f.y,"#8f6cf0",46);ringFx(f.x,f.y,"#c9a6ff",30);
    shake=Math.max(shake,.5);
    /* shockwave catches anyone standing on the landing */
    const foe=other(f);
    if(foe.alive&&Math.abs(foe.x-f.x)<S(46)&&foe.onGround){
     foe.takeDamage(20,120,Math.sign(foe.x-f.x)||f.facing,{skill:true,col:"#8f6cf0",fx:"#a07cff"});
    }
    for(let i=0;i<14;i++)particles.push({x:f.x+rand(-20,20),y:f.y-rand(0,8),
     vx:rand(-130,130),vy:rand(-170,-30),r:rand(1,3),col:i%3?"#8f6cf0":"#c9a6ff",t:0,life:rand(.25,.55)});
    bloodSplash(f.x,f.y-S(3),12,1);bloodSplash(f.x,f.y-S(3),12,-1);
   }else f.state="idle";
  }
 }
 /* AGRON flight budget — drains in the air, regenerates while not flying */
 if(f.d.id==="agron"){
  const FLY_MAX=4;
  if(f.flying){
   f.flyT-=dt;
   if(f.flyT<=0){f.flyT=0;f.flying=false;f.flyCd=8;statusFloat(f,"WINGS SPENT","#e2384a");}
   if(Math.random()<0.35)particles.push({x:f.x+rand(-9,9),y:f.y-rand(8,44),vx:rand(-20,20),vy:rand(20,60),r:1,col:"#e2384a",t:0,life:rand(.2,.4)});
  }else if(f.flyCd>0){
   /* fully drained: forced cooldown before the wings come back at all */
   f.flyCd-=dt;
   if(f.flyCd<=0){f.flyCd=0;f.flyT=FLY_MAX;statusFloat(f,"WINGS READY","#e2384a");}
  }else if(f.flyT<FLY_MAX){
   /* regen: faster on the ground, slow while airborne */
   f.flyT=Math.min(FLY_MAX,f.flyT+(f.onGround?1.6:0.5)*dt);
   if(f.flyT>=FLY_MAX&&!f._wingsFull){f._wingsFull=true;statusFloat(f,"WINGS FULL","#e2384a");}
  }
  if(f.flyT<FLY_MAX*0.98)f._wingsFull=false;
 }
 if(f.discT>0)f.discT-=dt;
 if(f.momT>0)f.momT-=dt;
 if(f.momBonusT>0)f.momBonusT-=dt;
 if(f.dr10T>0)f.dr10T-=dt;
 if(f.defBreak>0)f.defBreak-=dt;
 if(f._airHold>0)f._airHold-=dt;   /* SATORI air Skill A: keeps the special open through the slower throw animation */
 if(f._cbHold>0)f._cbHold-=dt;     /* SATORI crouch Skill B: keeps the special open through the 5-frame sequence */
 if(f.d.id==="satori"&&f.state==="special"&&f.poseSkill===1&&!f.onGround&&f.dashKind!=="satdive"&&f.t>0.14){
  /* AIR Skill B wind-up (blade drawn on air02): dark-red lightning + crimson glow along the sword */
  const bx=MZX(f,6),by=MZY(f,48);
  if(Math.random()<0.7){const bl=rand(14,30),a=rand(-0.9,0.3)+(f.facing>0?0:Math.PI);let px=bx,py=by;
   for(let seg=0;seg<3;seg++){const nx=px+Math.cos(a)*bl/3+rand(-4,4),ny=py+Math.sin(a)*bl/3+rand(-4,4);
    particles.push({x:px,y:py,vx:(nx-px)*10,vy:(ny-py)*10,r:rand(1,2.2),col:seg%2?"#e2384a":"#5e0812",t:0,life:rand(.06,.13)});px=nx;py=ny;}}
  if(Math.random()<0.5)particles.push({x:bx+rand(-6,10)*f.facing,y:by+rand(-10,18),vx:rand(-30,30),vy:rand(-40,20),r:rand(1.4,3),col:Math.random()<0.5?"#ff8fa0":"#e2384a",t:0,life:rand(.12,.26)});
 }
 if(f.rootT>0){f.rootT-=dt;if(Math.random()<0.5)particles.push({x:f.x+rand(-10,10),y:GROUND-rand(0,6),vx:rand(-20,20),vy:-rand(10,50),r:rand(1,2.5),col:"#e2384a",t:0,life:rand(.2,.4)});}
 if(f._recover>0)f._recover-=dt;
 if(f.dr35T>0)f.dr35T-=dt;
 if(f.hurtT>0)f.hurtT-=dt;
 if(f._blockHitT>0)f._blockHitT-=dt;
 if(f._airBlockT>0)f._airBlockT-=dt;
 if(f.onGround)f._airBlockUsed=false;   /* air block re-arms once he lands */
 if(f.fallDmgT>0)f.fallDmgT-=dt;
 /* SATORI Skill-A charges: first cast opens a 4s window for the 2nd; casting the 2nd OR letting the window
    lapse starts the 8s cooldown; when it finishes, both charges return together. */
 if(f.d.id==="satori"){
  if(f._aWin>0){f._aWin-=dt;if(f._aWin<=0&&f._aChg===1){f._aChg=0;f.cd[0]=Math.max(f.cd[0],8);}}
  if(f.cd[0]<=0&&f._aChg===0&&f._aWin<=0){f._aChg=2;statusFloat(f,"CRIMSON PROJECTILES","#ff8fa0");}
 }
 if(f.overheatDeb>0)f.overheatDeb-=dt;
 if(f.zen>0){f.zen-=dt;f.chi=100;
  if(f.zen<=0){f.chi=0;statusFloat(f,"ZEN ENDS","#7de8d8");}}
 if(f._feedCD>0)f._feedCD-=dt;
 if(f._squashT>0)f._squashT-=dt;
 if(f._possessT>0){f._possessT-=dt;f._possessW=(f._possessW||0)+dt*10;
  if(Math.random()<0.5){particles.push({x:f.x+rand(-14,14),y:f.centerY+rand(-20,16),vx:rand(-40,40),vy:rand(-60,20),
   r:rand(1,2.2),col:["#8fb4ff","#6b8cff","#b6d4ff"][Math.floor(Math.random()*3)],t:0,life:rand(.2,.4),dough:true});}}
 if(f._swarmT>0){f._swarmT-=dt;f._swarmW=(f._swarmW||0)+dt*12;
  /* dough shedding off the clinging swarm */
  if(Math.random()<0.6){const gob=["#f2c230","#e8b52e","#d99a1e"][Math.floor(Math.random()*3)];
   particles.push({x:f.x+rand(-16,16),y:f.centerY+rand(-22,18),vx:rand(-70,70),vy:rand(-90,40),
    r:rand(1,2.5),col:gob,t:0,life:rand(.2,.4),dough:true});}}
 if(f.morph>0){
  if(f.morphShield<=0&&!f._morphBroke){f._morphBroke=true;f.morph=Math.min(f.morph,0.001);} /* shield broke -> end now */
  /* dough material splashing around the morph shell */
  if(f.d.id==="necmi"&&Math.random()<0.55){const gob=["#f2c230","#e8b52e","#d99a1e","#c98a18"][Math.floor(Math.random()*4)];
   const ang=Math.random()*6.28, rad=rand(14,24);
   particles.push({x:f.x+Math.cos(ang)*rad,y:f.centerY+Math.sin(ang)*rad*0.9,vx:Math.cos(ang)*rand(30,90),vy:Math.sin(ang)*rand(20,70)-30,
    r:rand(1,3),col:gob,t:0,life:rand(.25,.5),dough:true});}
  f.morph-=dt;
  if(f.morph<=0&&f.alive){/* MASS MORPH ends: heal 15 once */
   f.morphShield=0;f.hp=Math.min(f.maxhp,f.hp+15);statusFloat(f,"+15","#8f6bff");f._morphBroke=false;}
 }
 if(f.surge>0){f.surge-=dt;
  if(f.surge<=0){/* ADRENALINE CRASH */
   f.hp=Math.max(1,f.hp-50);f.weakenT=3;f.weakenAmt=.15;f.accT=3;f.accAmt=.15;
   statusFloat(f,"CRASH -50","#e2384a");spawnHitFx(f.x,f.centerY,"#e2384a",8);}}
 if(f.regenHoT>0){f.regenHoT-=dt;f._hotAcc=(f._hotAcc||0)+f.regenHoTDps*dt;
  if(f._hotAcc>=1){const h=Math.floor(f._hotAcc);f._hotAcc-=h;f.hp=Math.min(f.maxhp,f.hp+h);}}
 /* passives */
 if(f.d.id==="notalk"&&f.alive&&!roundOver){f._hmmT+=dt;
  if(f._hmmT>=5){f._hmmT=0;
   if(f.strStacks<3){f.strStacks++;statusFloat(f,"Hmm. +STR","#8f6cf0");}}}
 if(f.d.id==="warbringer"&&f.alive&&tGlobal-f.lastHurt>4&&f.armor<f.maxArmor){
  f.armor=Math.min(f.maxArmor,f.armor+10*dt);}
 if(f.d.id==="akira"&&f.zen<=0&&tGlobal-f.lastAction>4&&f.chi>0){f.chi=Math.max(0,f.chi-8*dt);}
 if(f.d.id==="haydar"&&f.alive){f._rg=(f._rg||0)+dt;if(f._rg>1){f._rg=0;f.hp=Math.min(f.maxhp,f.hp+4);}}
 f.t+=dt;
 if(!f.onGround){if(f.airSkillT>0)f.airSkillT-=dt;}else f.airSkillT=0;   /* air-skill window ticks down while airborne, clears on landing */
 f.crouchT=f.crouching?(f.crouchT||0)+dt:0;   /* time spent crouching -> drives the down-into-crouch animation */
 f.downT=(!f.alive||f.koPose>0)?(f.downT||0)+dt:0;   /* time knocked down OR KO'd -> drives the ko -> ko2 sequence */
 /* KNOCKBACK animation: kb1 held while airborne; on landing kb2 (down) -> kb3 (get up), held until he can act again (no re-trigger) */
 if(f.kbT>0){if(!f.onGround||Math.abs(f.vx)>40)f.kbLandT=-1;else{if(f.kbLandT<0)f.kbLandT=0;else f.kbLandT+=dt;   /* kb1 lasts while flying OR sliding back on the ground */
  if((f.kbLandT>0.45&&f.stun<=0&&f.koPose<=0)||f.kbLandT>1.5)f.kbT=0;}}
 f.jumpT=f.onGround?0:(f.jumpT||0)+dt;        /* time airborne -> drives the leap frame */
 if(f.onGround)f.airAtkN=0;                    /* reset the air-combo counter on the ground */
 if(f.landT>0)f.landT-=dt;                     /* landing-pose timer */
 if(f.jumpWindup>0){f.jumpWindup-=dt;if(f.jumpWindup<=0){f.jumpWindup=0;   /* wind-up finished -> LAUNCH */
  f.vy=-f.d.jump;f.onGround=false;f.jumps=1;f.airSkillT=AIR_SKILL_WINDOW;f.jumpT=0;}}
 /* ATTACK-INSTANCE counter: bump once each time the fighter ENTERS an attacking state (basic swing,
    any skill, or ult). Breakable/explosive props use it so ONE attack = ONE hit even if the move has
    multiple damage ticks (see damageProp / hitCars / hitToilet). */
 {const _atkNow=(f.state==="attack"||f.state==="special");if(_atkNow&&!f._wasAtk)f.atkSeq=(f.atkSeq||0)+1;f._wasAtk=_atkNow;}
 /* BLOCK BAR: refills while NOT blocking. GUARD BREAK when it empties — can't block again until it
    has recovered to at least 25%. */
 if(f.alive){
  if(!f.blocking&&f._airBlockT<=0&&f.armor<f.maxArmor)f.armor=Math.min(f.maxArmor,f.armor+f.maxArmor*0.12*dt);
  if(f.armor<=0){if(!f.guardBroken){f.guardBroken=true;f.blocking=false;statusFloat(f,"GUARD BREAK","#e2384a");}}
  else if(f.armor>=f.maxArmor*0.25)f.guardBroken=false;
 }
 if(f.state==="attack"&&f.t>(f.d.id==="satori"?(!f.onGround?(f.atkHit===2?.36:.22):(f.atkHit===2?(f.crouching?.30:.32):(f.crouching?.27:.22))):(f.d.id==="agron"&&f.frenzy>0?.27:.3))*(f.agilityT>0?.9:1))f.state="idle";   /* Satori basics are snappy; air hit 3 is a 2-frame sequence so it's a touch longer; Ninja Agility = +attack speed */
 if(f.state==="special"&&f.t>(f.d.id==="satori"?(f._cbHold>0?.85:(f._airHold>0?.68:(f._recover>0?.26:.45))):.45)&&!(f.d.id==="notalk"&&f.windmill>0)&&!(f.d.id==="munevver"&&f.skillAT>0)&&!(f.d.id==="necmi"&&(f.skillAT>0||f.skillBT>0))&&!(f.d.id==="haydar"&&(f.skillAT>0||f.skillBT>0||f.ultCharging))&&!(f.d.id==="putuk"&&(f.counterT>0||f._counterHitT>0)))f.state="idle";
 /* RELENTLESS MARCH — uninterruptible advance: catch the foe and DRAG them along */
 if(f.d.id==="notalk"&&f.windmill>0){
  f.windmill-=dt;const foe=other(f);
  f.x+=f.facing*80*dt;
  /* catch */
  if(Math.abs(foe.x-f.x)<S(38)&&Math.abs(foe.hurtY-f.centerY)<S(50)&&!f._wmHit){
   f._wmHit=true;f._wmGrab=foe.alive;
   /* no knockback — we keep hold of them */
   foe.takeDamage(f.marchDmg,0,f.facing,{unblockable:true,melee:true,noStackMult:true,col:"#8f6cf0",fx:"#8f6cf0"});
   applyStun(foe,Math.max(0.7,f.windmill+0.5));   /* stunned for the whole drag + a beat */
   statusFloat(foe,"DRAGGED","#8f6cf0");}
  /* drag: pin them just in front of him and haul them along */
  if(f._wmGrab&&foe.alive&&f.windmill>0){
   const hold=f.x+f.facing*S(26);
   foe.x+=(hold-foe.x)*Math.min(1,dt*18);         /* snap toward the hold point */
   foe.vx=0;foe.stun=Math.max(foe.stun,.15);
   if(foe.onGround)foe.y=f.y;
   /* keep both inside the walls */
   const lo=WALL_L+S(10),hi=WALL_R-S(10);
   if(foe.x<lo){foe.x=lo;f.x=Math.max(f.x,lo-f.facing*S(26));}
   if(foe.x>hi){foe.x=hi;f.x=Math.min(f.x,hi-f.facing*S(26));}
   /* scrape dust off the dragged body */
   if(Math.random()<0.5)particles.push({x:foe.x-f.facing*rand(2,8),y:foe.y-rand(1,6),
    vx:-f.facing*rand(30,90),vy:rand(-40,-5),r:1,life:rand(.2,.45),t:0,col:"#8f6cf0"});
  }
  if(f.windmill<=0){f.state="idle";f._wmHit=false;f._wmGrab=false;}
 }
 if(f.dashT>0){
  const satDash=(typeof f.dashKind==="string"&&(f.dashKind.indexOf("sat")===0||f.dashKind==="cblow"));
  f.dashT-=dt;
  if(f.dashKind==="satcross"||f.dashKind==="cblow"){   /* eased dash: smoothstep accel-in / decel-out -> soft start & slide-stop */
   const dur=f._dashDur||0.2,p=Math.max(0,Math.min(1,1-f.dashT/dur)),s=p*p*(3-2*p);
   f.x=(f._dashStartX!=null?f._dashStartX:f.x)+(f._dashLen||0)*s;
  }else f.x+=f.dashDir*(f.dashKind==="satstab"||f.dashKind==="satback"?520:650)*dt;
  if(f.dashKind==="satdive"&&f.y<GROUND){f.y=Math.min(GROUND,f.y+900*dt);if(f.y>=GROUND){f.vy=0;f.onGround=true;f.jumps=0;}}   /* diagonal DOWN dive */
  if(f.dashKind==="satcross"||f.dashKind==="cblow"||f.dashKind==="satdive"){   /* GHOSTING: drop evenly-spaced afterimage snapshots of the current dash pose */
   const gfr=IMG_SPRITES[f.d.id]&&(f.dashKind==="cblow"?IMG_SPRITES[f.d.id].cskB2:(f.dashKind==="satdive"?IMG_SPRITES[f.d.id].skBair4:IMG_SPRITES[f.d.id].skB4));
   if(gfr&&Math.abs(f.x-(f._lastGhostX!=null?f._lastGhostX:f.x-99))>=9){f._lastGhostX=f.x;
    ghosts.push({frame:gfr,x:f.x,y:f.y,facing:f.facing,t:0,life:0.26});if(ghosts.length>28)ghosts.shift();}}
  const trailCol=f.dashKind==="ember"?"#f28022":satDash?"#e2384a":"#5e1220";
  particles.push({x:f.x-f.dashDir*rand(5,15),y:f.y-rand(10,50),vx:-f.dashDir*rand(30,75),vy:rand(-25,25),r:rand(1,3),col:trailCol,t:0,life:.3});
  const foe=other(f);
  if(!f.dashHit&&f.dashKind!=="satback"&&Math.abs(foe.x-f.x)<S(f.dashKind==="satdive"?36:30)&&Math.abs(foe.hurtY-f.centerY)<S(f.dashKind==="satdive"?70:45)){
   f.dashHit=true;const mult=f._cEmp?1.1:1;
   if(f.dashKind==="satcross"){/* Standing B — Crimson Crossing: 2×34 crossing dash, ignores 10% block */
    foe.takeDamage(Math.round(68*mult),150,f.dashDir,{melee:true,skill:true,energy:true,col:"#e2384a",fx:"#ff8fa0"});
    foe.armor=Math.max(0,foe.armor-foe.maxArmor*0.1);ringFx(foe.x,foe.centerY,"#e2384a",50);
    if(f._cEmp)setTimeout(()=>{if(!running||!foe.alive)return;foe.x+=(f.x-foe.x)*0.5;foe.vx=0;statusFloat(foe,"CRIMSON REBOUND","#ff5e6e");},130);}   /* Melee Ready: rebound */
   else if(f.dashKind==="satdive"){/* Air B — Crimson Crescent Dive: 65, sends DOWN, lands behind */
    foe.takeDamage(Math.round(65*mult),150,f.dashDir,{melee:true,skill:true,energy:true,col:"#e2384a",fx:"#ff8fa0"});
    foe.vy=Math.max(foe.vy,320);foe.onGround=false;ringFx(foe.x,foe.centerY,"#e2384a",44);
    if(f._cEmp){foe.groundBounce=true;statusFloat(foe,"GROUND BOUNCE","#ff8fa0");f._recover=0.2;}}
   else if(f.dashKind==="cblow"){/* Crouch B — Low Shadow Crossing: low cut on the pass (hit 1 of 2; the reverse slash is hit 2) */
    foe.takeDamage(Math.round(30*mult),120,f.dashDir,{melee:true,skill:true,energy:true,col:"#e2384a",fx:"#ff8fa0"});ringFx(foe.x,foe.centerY,"#e2384a",42);}
   else if(f.dashKind==="satlow"){/* Crouch B (legacy single-hit variant) */
    foe.takeDamage(Math.round(60*mult),140,f.dashDir,{melee:true,skill:true,energy:true,col:"#e2384a",fx:"#ff8fa0"});ringFx(foe.x,foe.centerY,"#e2384a",42);
    if(f._cEmp){foe.slowT=2;foe.slowAmt=.20;statusFloat(foe,"SLOWED","#b8e6c8");f.cd[0]=Math.max(0,f.cd[0]-1);}}   /* Melee Ready: slow + −1s Skill A cd */
   else if(f.dashKind==="satstab"){/* Standing C — Spinal Spike Burst: stab now (36), daggers detonate inside after 1s (36) */
    foe.takeDamage(Math.round(36*mult),180,f.dashDir,{melee:true,skill:true,energy:true,col:"#e2384a",fx:"#ff8fa0"});
    foe.armor=Math.max(0,foe.armor-15);ringFx(foe.x,foe.centerY,"#e2384a",40);spawnHitFx(foe.x,foe.centerY,"#e2384a",8);
    const emp=f._cEmp;
    setTimeout(()=>{if(!running||!foe.alive)return;
     foe.takeDamage(Math.round(36*(emp?1.1:1)),160,Math.sign(foe.x-f.x)||f.facing,{skill:true,energy:true,col:"#e2384a",fx:"#ff8fa0"});
     ringFx(foe.x,foe.centerY,"#e2384a",60);ringFx(foe.x,foe.centerY,"#ff8fa0",40);spawnHitFx(foe.x,foe.centerY,"#ff8fa0",14);shake=Math.max(shake,.4);
     if(emp){foe.burnDps=8;foe.burn=Math.max(foe.burn,2);statusFloat(foe,"ENERGY BURN","#ff8fa0");}},1000);
    f.dashKind="satback";f.dashDir=-f.dashDir;f.dashT=0.12;}   /* immediately jump back */
   else if(f.dashKind==="satori"){foe.takeDamage(f._spikeDmg||65,140,f.dashDir,{melee:true,skill:true,col:"#e2384a",fx:"#e2384a"});}
   else if(f.dashKind==="tempest"){foe.takeDamage(55,260,f.dashDir,{melee:true,skill:true,col:"#e2384a",fx:"#ff8fa0"});
    foe.defBreak=4;statusFloat(foe,"DEFENSE BREAK","#ffd23f");
    foe.bleedDps=10;foe.bleed=Math.max(foe.bleed,2);ringFx(foe.x,foe.centerY,"#e2384a",70);}
   else if(f.dashKind==="eclipse"){const dmg=80;foe.takeDamage(dmg,220,f.dashDir,{melee:true,skill:true,col:"#9c1d2e",fx:"#5e1220"});heal(f,dmg);
    foe.bleedDps=12;foe.bleed=Math.max(foe.bleed,4);statusFloat(foe,"BLEED","#ff5e6e");}
   else{const dmg=68;foe.takeDamage(dmg,190,f.dashDir,{melee:true,skill:true,col:"#9c1d2e",fx:"#9c1d2e"});heal(f,Math.round(dmg*.6));}
  }
  if(f.dashT<=0&&satDash&&f.dashKind!=="satback"&&f.dashKind!=="cblow")f.facing=Math.sign(other(f).x-f.x)||f.facing;   /* Crimson Crossing / dive: switch sides (cblow keeps its facing — its sprites already show the turn) */
 }
 /* DoTs (bypass armor & barrier) */
 f.dotT-=dt;
 if(f.dotT<=0){f.dotT=.5;
  if(f.burn>0){f.burn-=.5;if(f.alive)f.takeDamage(Math.round(f.burnDps/2),0,0,{unblockable:true,dot:true,col:"#f28022",fx:"#f28022"});}
  if(f.poison>0){f.poison-=.5;if(f.alive)f.takeDamage(Math.round(f.poisonDps/2),0,0,{unblockable:true,dot:true,col:"#9dff5e",fx:"#9dff5e"});}
  if(f.bleed>0){f.bleed-=.5;if(f.alive)f.takeDamage(Math.round(f.bleedDps/2),0,0,{unblockable:true,dot:true,col:"#ff5e6e",fx:"#ff5e6e"});}
  if(f.shock>0){f.shock-=.5;if(f.alive){f.takeDamage(Math.round(f.shockDps/2),0,0,{unblockable:true,dot:true,col:"#8fd8ff",fx:"#8fd8ff"});
   for(let s=0;s<2;s++)particles.push({x:f.x+rand(-8,8),y:f.centerY+rand(-16,16),vx:rand(-30,30),vy:rand(-30,30),r:rand(1,2),col:s?"#bfeaff":"#8fd8ff",t:0,life:rand(.1,.2)});}}
 }
 /* physics */
 if(f.stun<=0){f.x+=f.vx*dt;if(!f.alive)f.vx*=Math.pow(.02,dt);}
 if(!f.onGround){
  const airStall=(f.state==="attack"&&IMG_SPRITES[f.d.id]&&IMG_SPRITES[f.d.id].airatk1)
    ||(f.d.id==="satori"&&f.state==="special"&&f._airHold>0)   /* hover during an air-attack swing OR the air Skill A throw (hang until the projectiles are out) */
    ||(f.d.id==="satori"&&f.state==="special"&&f.poseSkill===1&&!f.onGround&&f.dashKind!=="satdive");   /* hover during air Skill B wind-up (air1->air3); the satdive dive-dash then drops him */
  if(airStall){f.vy=0;} else f.vy+=GRAV*dt;
  const py=f.y;f.y+=f.vy*dt;
  if(f.vy>0){for(const pl of platforms()){
   if(py<=pl.y+0.5&&f.y>=pl.y&&f.x>pl.x-6&&f.x<pl.x+pl.w+6){
    const iv=f.vy;f.y=pl.y;f.vy=0;f.onGround=true;f.jumps=0;landImpact(f,iv);break;}}}
  if(!f.onGround&&f.y>=GROUND){const iv=f.vy;f.y=GROUND;f.vy=0;f.onGround=true;f.jumps=0;landImpact(f,iv);}}
 else if(f.y<GROUND-0.5){
  let sup=false;
  for(const pl of platforms())if(Math.abs(f.y-pl.y)<1&&f.x>pl.x-6&&f.x<pl.x+pl.w+6){sup=true;break;}
  if(!sup)f.onGround=false;}
 f.x=Math.max(WALL_L,Math.min(WALL_R,f.x));   /* invisible walls */
 if(typeof CARS_WALL_X!=="undefined"&&f.x<CARS_WALL_X)f.x=CARS_WALL_X;   /* front cars = left map limit */
 if(f.state==="walk")f.walkPhase+=Math.abs(f.vx)*dt*.03*(f.d.id==="haydar"?.55:(f.d.id==="putuk"?1.2:1));/* stride cadence: haydar .55; putuk 1.2 (compensates his higher move-speed so the run animation keeps the same rate) */
 if(f.d.id==="satori")updateSatoriRun(f,dt);   /* SATORI run-cycle state machine (state is final by here) */
}
const SOLID_GAP=()=>S(26);   /* minimum center-to-center distance while both are grounded */
function resolveFighterCollision(){
 const[a,b]=fighters;
 if(!a.alive||!b.alive||roundOver)return;
 /* airborne (jumping), mid-dash, or mid-drag fighters pass through instead of colliding */
 const passable=f=>!f.onGround||f.dashT>0||f.windmill>0;
 if(passable(a)||passable(b))return;
 const gap=SOLID_GAP(),dx=b.x-a.x,dist=Math.abs(dx),dir=dx>=0?1:-1;
 if(dist<gap){
  const push=(gap-dist)/2||gap/2;   /* dist===0 fallback: still separate them */
  a.x-=dir*push;b.x+=dir*push;
  a.x=Math.max(WALL_L,Math.min(WALL_R,a.x));
  b.x=Math.max(WALL_L,Math.min(WALL_R,b.x));
  if(typeof CARS_WALL_X!=="undefined"){if(a.x<CARS_WALL_X)a.x=CARS_WALL_X;if(b.x<CARS_WALL_X)b.x=CARS_WALL_X;}
 }
}
/* Applies fall damage and a stun if a fighter lands hard enough (impact speed above a threshold). */
function landImpact(f,vy){
 if(f.groundBounce&&f.alive){f.groundBounce=false;f.vy=-190;f.onGround=false;f.jumps=0;statusFloat(f,"BOUNCE!","#ff8fa0");return;}   /* Satori air-combo ground bounce */
 if(f.alive)f.landT=0.16;   /* brief landing pose on every touchdown */
 if(vy>520&&f.alive){
  const d=Math.min(45,Math.round((vy-520)*0.18)+4);
  f.hp=Math.max(1,f.hp-d);f.stun=Math.max(f.stun,.25);f.hitFlash=.08;
  if(f.d.id==="satori"&&(f.kbT||0)<=0&&IMG_SPRITES.satori&&IMG_SPRITES.satori.falldmg1){f.fallDmgT=0.32;f.stun=Math.max(f.stun,.19);f.vx=0;}   /* genuine hard landing (not a knockback): touchdown -> get-up; kill horizontal momentum so he lands planted (no slide) */
  floaters.push({x:f.x,y:MZY(f,64),txt:"FALL -"+d,t:0,col:"#c9b8a0",size:6});
  for(let i=0;i<6;i++)particles.push({x:f.x+rand(-10,10),y:f.y,vx:rand(-60,60),vy:rand(-80,-20),r:rand(1,2),col:"#a89880",t:0,life:.3});
  shake=Math.max(shake,.2);
 }
}
/* Per-frame projectile update: moves every projectile, runs each projectile TYPE's unique travel behavior (homing, arcing, trailing particles), and resolves hits against props, platforms, and the opponent. */
function updateProjectiles(dt){
 for(let i=projectiles.length-1;i>=0;i--){
  const p=projectiles[i];if(!p)continue;
  if(p.type==="satcspike"){/* SATORI Crouch C — thrown spike: a diagonal arc from his hand down to the ground target */
   p.age=(p.age||0)+dt;p.vy+=(p.g||1500)*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;
   if(Math.random()<0.6)particles.push({x:p.x+rand(-4,4),y:p.y+rand(-6,6),vx:rand(-18,18),vy:rand(-8,30),r:rand(1,2.4),col:Math.random()<0.5?"#ff2a3a":"#ff8fa0",t:0,life:rand(.12,.3)});
   if(p.vy>0&&p.y>=GROUND){/* landed: plant the hidden spike here + impact burst */
    const lx=p.x;
    for(let j=projectiles.length-1;j>=0;j--)if(projectiles[j].type==="sattrap"&&projectiles[j].owner===p.owner)projectiles.splice(j,1);
    projectiles.push({type:"sattrap",x:lx,y:GROUND,vx:0,r:8,dmg:p.dmg,stun:p.stun,eburn:p.eburn,owner:p.owner,col:"#e2384a",age:0});
    statusFloat(p.owner,"SPIKE SET","#e2384a");
    ringFx(lx,GROUND,"#e2384a",44);ringFx(lx,GROUND,"#ff8fa0",28);spawnHitFx(lx,GROUND-10,"#ff8fa0",12);shake=Math.max(shake,.28);
    for(let s=0;s<16;s++)particles.push({x:lx+rand(-8,8),y:GROUND,vx:rand(-70,70),vy:-rand(30,170),r:rand(1.5,3),col:s%2?"#e2384a":"#ff8fa0",t:0,life:rand(.2,.5)});
    projectiles.splice(i,1);continue;}
   continue;
  }
  if(p.type==="satmineexp"){/* the mine's eruption — plays Spike-mine-explosion 0..5 once, then gone */
   p.age=(p.age||0)+dt;if(p.age>=0.42){projectiles.splice(i,1);}
   continue;
  }
  if(p.type==="sattrap"){/* SATORI Crouch C — planted spike mine (visible), erupts when the foe crosses it (4s life) */
   p.age=(p.age||0)+dt;p.y=GROUND;
   if(Math.random()<0.12)particles.push({x:p.x+rand(-7,7),y:GROUND-rand(0,4),vx:rand(-10,10),vy:-rand(4,20),r:rand(1,1.8),col:Math.random()<0.5?"#ff2a3a":"#7a1020",t:0,life:rand(.2,.4)});   /* faint idle glow */
   const foe=other(p.owner);
   if(foe.alive&&foe.onGround&&Math.abs(foe.x-p.x)<S(26)){/* stepped on -> AREA blast */
    const R=S(58);
    if(Math.abs(foe.x-p.x)<R&&Math.abs(foe.hurtY-GROUND)<S(72)){
     foe.takeDamage(p.dmg,320,Math.sign(foe.x-p.x)||foe.facing||1,{skill:true,energy:true,col:"#e2384a",fx:"#ff8fa0"});   /* explosion PUSH + launch (like the other blasts) */
     applyStun(foe,p.stun);statusFloat(foe,"STUNNED","#e2384a");
     if(p.eburn){foe.burnDps=8;foe.burn=Math.max(foe.burn,2);statusFloat(foe,"ENERGY BURN","#ff8fa0");}}
    hitProps(p.x,1,R,p.dmg,p.owner);hitProps(p.x,-1,R,p.dmg,p.owner);   /* area blast damages nearby props too */
    if(typeof hitDog==="function"&&!hitDog(p.x,1,R,p.owner,p.dmg))hitDog(p.x,-1,R,p.owner,p.dmg);   /* ...and the roaming dog */
    projectiles.push({type:"satmineexp",x:p.x,y:GROUND,owner:p.owner,age:0});   /* eruption animation */
    ringFx(p.x,GROUND,"#e2384a",72);ringFx(p.x,GROUND-10,"#5e0812",54);ringFx(p.x,GROUND-6,"#ff8fa0",44);spawnHitFx(p.x,GROUND-24,"#ff8fa0",16);shake=Math.max(shake,.5);
    for(let s=0;s<14;s++)particles.push({x:p.x+rand(-10,10),y:GROUND,vx:rand(-90,90),vy:-rand(40,220),r:rand(2,4.4),col:s%3===0?"#3a060c":(s%3===1?"#e2384a":"#ff8fa0"),t:0,life:rand(.3,.7)});   /* dark-red + crimson blast */
    for(let s=0;s<9;s++)particles.push({x:p.x+rand(-16,16),y:GROUND,vx:rand(-55,55),vy:-rand(20,90),r:rand(3,6),col:"#2a060c",t:0,life:rand(.4,.8)});   /* dark-red smoke chunks */
    projectiles.splice(i,1);continue;}
   if(p.age>4){projectiles.splice(i,1);continue;}
   continue;
  }
  if(p.type==="pinch"){p.wob=(p.wob||0)+dt*12;
   if(p.mincik===undefined){p.mincik=1;p.mincT=0;p.mincShow=0.42;} /* MINCIK pops immediately on launch */
   else{p.mincT+=dt;
    if(p.mincT>=0.42){p.mincT=0;p.mincik++;p.mincShow=0.42;}}       /* then repeats ~every 0.42s */
   if(p.mincShow>0)p.mincShow-=dt;
   /* dough material splashing off as it flies forward */
   const dir=Math.sign(p.vx)||1;
   p.splashT=(p.splashT||0)+dt;
   if(p.splashT>=0.045){p.splashT=0;
    const gob=["#f2c230","#e8b52e","#d99a1e","#c98a18"][Math.floor(Math.random()*4)];
    /* trailing gobs flung backward + a little outward, with gravity */
    particles.push({x:p.x-dir*4,y:p.y+rand(-4,4),vx:-dir*rand(30,90)+rand(-20,20),vy:rand(-70,50),
     r:rand(1,3),col:gob,t:0,life:rand(.22,.42),dough:true});}}
  if(p.type==="ghost"){p.wob=(p.wob||0)+dt*14;
   const k=Math.min(1,(tGlobal-p.t0)/p.dur);      /* 0..1 travel progress */
   const ease=k*k*(3-2*k);
   const sx=MZX(p.owner,10);                        /* start near Necmi */
   p.x=sx+(p.tx-sx)*ease;
   /* arc: rise then settle to target height */
   p.y=(p.owner.centerY-S(4))+((p.ty)-(p.owner.centerY-S(4)))*ease - Math.sin(ease*Math.PI)*S(22);
   /* spirit trail dough-like sparkles (blue) */
   if(Math.random()<0.7){particles.push({x:p.x+rand(-4,4),y:p.y+rand(-4,4),vx:rand(-30,30),vy:rand(-30,30),
    r:rand(1,2.5),col:["#8fb4ff","#6b8cff","#b6d4ff","#4f6bd8"][Math.floor(Math.random()*4)],t:0,life:rand(.2,.4),dough:true});}
   if(k>=1&&!p.done){p.done=true;projectiles.splice(i,1);continue;}
   continue;                                        /* skip generic movement */
  }
  if(p.type==="hijack"&&p.ground){p.wob=(p.wob||0)+dt*13;
   p.y=GROUND;                                   /* the creature walks along the floor */
   /* "AW AW AW" speech bubble, pops every 0.4s */
   if(p.awShow===undefined){p.awT=0;p.awShow=0.34;}
   else{p.awT=(p.awT||0)+dt; if(p.awT>=0.4){p.awT=0;p.awShow=0.34;}}
   if(p.awShow>0)p.awShow-=dt;
   const dir=Math.sign(p.vx)||1;
   p.splashT=(p.splashT||0)+dt;
   if(p.splashT>=0.05){p.splashT=0;
    const gob=["#f2c230","#e8b52e","#d99a1e","#c98a18"][Math.floor(Math.random()*4)];
    /* dough kicked up from the ground as it scrambles forward */
    particles.push({x:p.x-dir*6,y:GROUND-rand(0,4),vx:-dir*rand(20,80)+rand(-15,15),vy:-rand(20,110),
     r:rand(1,3),col:gob,t:0,life:rand(.2,.4),dough:true});}}
  if(p.homing){const foe=other(p.owner);const dy=(foe.centerY)-p.y;
   p.vy+=Math.sign(dy)*300*dt;p.vy=Math.max(-130,Math.min(130,p.vy));}
  if(p.type==="grenade")p.vy=(p.vy||0)+700*dt;
  p.x+=p.vx*dt;p.y+=(p.vy||0)*dt;
  if(p.type==="satp"&&p.saw){   /* GROUND SAW: spin up slow -> fast (exponential), ride the ground line, throw cut sparks */
   p.y=GROUND;
   p.sawV=Math.min(220,(p.sawV||4)*Math.pow(7,dt));   /* much steeper exponential spin-up to a much higher cap */
   p.sawAng=(p.sawAng||0)+p.sawV*dt*Math.sign(p.vx||1);
   const dir=Math.sign(p.vx)||1,sp=Math.min(1,(p.sawV-4)/160);   /* more sparks as it spins faster */
   for(let s=0;s<1+Math.round(sp*2);s++)particles.push({x:p.x-dir*rand(6,18),y:GROUND-rand(0,3),vx:-dir*rand(60,220),vy:-rand(20,140),r:rand(1,2.6),col:Math.random()<0.5?"#ff2a3a":"#ffd0d6",t:0,life:rand(.12,.3)});
   if(p._lastCutX==null||Math.abs(p.x-p._lastCutX)>=5){p._lastCutX=p.x;   /* chainsaw kerf: a channel between two wavy lines, glowing dark red */
    sawCuts.push({x:p.x,t:0,life:0.55});if(sawCuts.length>360)sawCuts.shift();}
  }else if(p.type==="satp"){   /* red light trail behind each Crimson shuriken / spike */
   particles.push({x:p.x-p.vx*0.012,y:p.y-(p.vy||0)*0.012,vx:rand(-14,14),vy:rand(-14,14),r:rand(1.2,2.6),col:Math.random()<0.5?"#ff2a3a":"#ff8fa0",t:0,life:rand(.12,.26)});}
  if(p.type==="rocket"){const dir=Math.sign(p.vx)||1,bx=p.x-dir*S(11),by=p.y;   /* fire + smoke from the rocket's tail */
   for(let n=0;n<2;n++)particles.push({x:bx+rand(-2,2),y:by+rand(-2,2),vx:-dir*rand(40,110)+rand(-15,15),vy:rand(-25,25),r:rand(1,2.5),col:["#ffd23f","#f28022","#fff2c8"][n%3],t:0,life:rand(.10,.22)});
   particles.push({x:bx,y:by+rand(-2,2),vx:-dir*rand(10,45),vy:-rand(6,26),r:rand(2,4),col:["#787878","#8a8a8a","#9a9a9a"][Math.floor(Math.random()*3)],t:0,life:rand(.3,.6)});}
  if(p.type==="grenade"&&p.y>=GROUND-2){explodeGrenade(p);projectiles.splice(i,1);continue;}
  if(p.y>GROUND+8){spawnHitFx(p.x,GROUND,p.col,3);projectiles.splice(i,1);continue;}
   /* props block shots */
   let smashed=false;
   for(const pr of props.slice()){
    const pb=propBaseY(pr);
    if(pr.hp>0&&pr.kind!=="scaffold"&&p.x>pr.x-2&&p.x<pr.x+pr.w+2&&p.y>pb-pr.h-12&&p.y<pb+12){damageProp(pr,p.dmg||20,p.owner);smashed=true;break;}  /* shots pass THROUGH wrecked cars AND scaffolds */
   }
  if(!smashed)for(const pl of plats.slice()){
   if(pl.hp===undefined)continue;
   if(p.x>pl.x-2&&p.x<pl.x+pl.w+2&&p.y>pl.y-4&&p.y<pl.y+8){damagePlat(pl,p.dmg||20,p.owner);smashed=true;break;}
  }
  if(smashed){if(p.type==="grenade")explodeGrenade(p);if(p.type==="rocket")explodeRocket(p);spawnHitFx(p.x,p.y,p.col,4);projectiles.splice(i,1);continue;}
  const foe=other(p.owner);
  if(foe.alive&&Math.abs(foe.x-p.x)<S(16)&&Math.abs(foe.hurtY-p.y)<S(foe.crouching&&foe.onGround?15:34)){
   if(p.type==="xslash"){/* BLOOD X CLAWS — dark slash + bleed */
    foe.takeDamage(p.dmg,150,Math.sign(p.vx),{skill:true,col:"#e2384a",fx:"#e2384a"});
    foe.bleedDps=10;foe.bleed=Math.max(foe.bleed,2);statusFloat(foe,"BLEED","#ff5e6e");
    spawnHitFx(p.x,p.y,"#e2384a",10);shake=Math.max(shake,.5);
    bloodSplash(p.x,p.y,30,Math.sign(p.vx));
    bloodSplash(p.x,p.y,16,-Math.sign(p.vx));
    bloodDrops(p.x,p.y,24,{spread:2.6,up:1.5,force:1.35});
    projectiles.splice(i,1);continue;
   }else if(p.type==="pinch"){/* PINCH-MASS SHOT: 50 energy dmg, heal 15, apply CONFUSE 1s */
    const o=p.owner;const dir=Math.sign(p.vx)||1;
    foe.takeDamage(p.dmg,90,dir,{ranged:true,skill:true,energy:true,col:"#b36bff",fx:"#b36bff"});
    heal(o,15);
    elasticSplat(p.x,p.y,dir);                 /* elastic dough smoosh + splatter */
    foe._squashT=0.22;foe._squashDir=dir;      /* target briefly squashes from the elastic hit */
    shake=Math.max(shake,.18);
    if(foe.d.id!=="munevver"){foe.confuse=1.0;statusFloat(foe,"CONFUSED","#b36bff");chaoticFeed(o);}
    else statusFloat(foe,"WARDED","#f2b632");}
   else if(p.type==="hijack"){/* LIMB HIJACK: 60 energy dmg, disable normals 1.2s */
    const o=p.owner;const dir=Math.sign(p.vx)||1;
    foe.takeDamage(p.dmg,70,dir,{ranged:true,skill:true,energy:true,col:"#b36bff",fx:"#b36bff"});
    elasticSplat(p.x,foe.centerY,dir);          /* dough burst as the swarm leaps onto them */
    if(foe.d.id!=="munevver"){foe.disarm=1.2;statusFloat(foe,"ATTACKS DISABLED","#b36bff");}
    else statusFloat(foe,"WARDED","#f2b632");
    foe._swarmT=1.2;foe._swarmW=Math.random()*6.28;   /* swarm clings around the foe — shown even when warded */
    ringFx(p.x,p.y,"#b36bff",30);
   }else if(p.type==="grenade"){
    explodeGrenade(p);
   }else if(p.type==="shadow"){/* ASTRAL SHADOW STRIKE */
    foe.takeDamage(p.dmg,120,Math.sign(p.vx),{ranged:true,skill:true,col:"#8f6cf0",fx:"#4a3d6b"});
    foe.accT=3;foe.accAmt=.15;statusFloat(foe,"ACCURACY -15%","#9d92c2");
    if(p.shadowEmp)applyStun(foe,.5);
    addChi(p.owner,15);
   }else if(p.type==="spikeimg"){/* red stone spikes */
    foe.takeDamage(p.dmg,70,Math.sign(p.vx),{ranged:true,skill:true,col:p.col,fx:p.col});
   }else if(p.type==="shurimg"){/* CRIMSON SHURIKEN */
    foe.takeDamage(p.dmg,60,Math.sign(p.vx),{ranged:true,skill:true,col:p.col,fx:p.col});
    if(p.volley===p.owner._shurVolley){p.owner._shurHits++;
     if(p.owner._shurHits>=3){applyStun(foe,.4);statusFloat(foe,"STUNNED","#ff4a5a");}}
   }else if(p.type==="prime"){/* PRIME SEQUENCE */
    foe.takeDamage(p.dmg,70,Math.sign(p.vx),{ranged:true,skill:true,col:p.col,fx:p.col});
    p.owner._primeHits++;
    if(p.owner._primeHits>=3){foe.weakenT=3;foe.weakenAmt=.10;statusFloat(foe,"DAMAGE DOWN","#f2b632");}
   }else if(p.type==="satp"){/* SATORI Skill A — Crimson Projectiles (shuriken / spike volley / pinning) */
    foe.takeDamage(p.dmg,p.kbv||50,Math.sign(p.vx),{ranged:true,skill:true,energy:true,col:p.col,fx:p.col});
    if(p.eburn){foe.burnDps=8;foe.burn=Math.max(foe.burn,2);statusFloat(foe,"ENERGY BURN","#ff8fa0");}
    if(p.vol===p.owner._satVol){p.owner._satHits++;
     if(p.owner._satHits>=p.need){
      if(p.eff==="stagger"){applyStun(foe,p.dur);statusFloat(foe,"STAGGER","#ff8fa0");}
      else if(p.eff==="stun"){applyStun(foe,p.dur);statusFloat(foe,"STUNNED","#ff4a5a");}
      else if(p.eff==="slow"){foe.slowT=p.dur;foe.slowAmt=p.slowAmt;statusFloat(foe,"SLOWED","#b8e6c8");}
      else if(p.eff==="root"){foe.rootT=p.dur;statusFloat(foe,"ROOTED","#e2384a");}
     }}
   }else if(p.type==="satult"){/* SATORI Ultimate — Crimson Pursuit homing spike */
    foe.takeDamage(p.dmg,90,Math.sign(p.vx)||p.owner.facing,{ranged:true,skill:true,energy:true,col:p.col,fx:p.col});
    ringFx(p.x,p.y,"#e2384a",40);
    if(!p.owner._ultConn){p.owner._ultConn=true;applyStun(foe,p.para||0.9);statusFloat(foe,"CRIMSON PARALYSIS","#ff4a5a");
     if(!foe.onGround)foe.vy=Math.max(foe.vy,240);}   /* airborne foe loses control & falls */
   }else if(p.type==="rocket"){explodeRocket(p);
   }else{
    foe.takeDamage(p.dmg,p.type==="chi"?150:(p.type==="shur"||p.type==="bullet"||p.type==="smg"?40:80),Math.sign(p.vx),
     {pierce:p.pierce||0,ballistic:!!p.ballistic,ranged:true,skill:!!p.skill,col:p.col,fx:p.col});
    if(p.burn){foe.burnDps=8;foe.burn=Math.max(foe.burn,p.burn);statusFloat(foe,"BURN","#f28022");}
    if(p.skill)addChi(p.owner,15);
   }
   spawnHitFx(p.x,p.y,p.col,6);projectiles.splice(i,1);continue;
  }
  if(p.type==="rocket"&&(p.x<WALL_L+6||p.x>WALL_R-6)){explodeRocket(p);projectiles.splice(i,1);continue;}
  if(p.x<WALL_L-30||p.x>WALL_R+30)projectiles.splice(i,1);
 }
}
/* Haydar's ult grenade payoff: damages the opponent and nearby destructible props/platforms in a radius. */
function explodeGrenade(p){
 ringFx(p.x,p.y,"#ffd23f",S(62));ringFx(p.x,p.y,"#f28022",S(40));shake=Math.max(shake,.6);
 spawnHitFx(p.x,p.y,"#f28022",14);
 const foe=other(p.owner);
 if(foe.alive&&Math.abs(foe.x-p.x)<S(60)&&Math.abs(foe.hurtY-p.y)<S(55)){
  foe.takeDamage(p.dmg||64,250,Math.sign(foe.x-p.x)||1,{ranged:true,col:"#ffd23f",fx:"#f28022"});
  foe.burnDps=8;foe.burn=Math.max(foe.burn,2);}
 hitProps(p.x,1,S(60),40,p.owner);hitProps(p.x,-1,S(60),40,p.owner);
}
/* Haydar's Gunpowder Ambush rocket blast: fireball + smoke burst, radius damage/knockback/burn, wrecks nearby props. */
function explodeRocket(p){
 shake=Math.max(shake,.9);
 ringFx(p.x,p.y,"#fff2c8",S(28));ringFx(p.x,p.y,"#ffd23f",S(54));ringFx(p.x,p.y,"#f28022",S(78));
 spawnHitFx(p.x,p.y,"#f28022",18);
 for(let i=0;i<28;i++){const a=Math.random()*6.283,sp=rand(60,240);
  particles.push({x:p.x,y:p.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-50,r:rand(1.5,4),col:["#fff2c8","#ffd23f","#f28022","#d9531e"][i%4],t:0,life:rand(.25,.6)});}
 for(let i=0;i<16;i++){const a=Math.random()*6.283,sp=rand(15,80);
  particles.push({x:p.x,y:p.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-65,r:rand(3,6),col:["#5a5a5a","#707070","#868686"][i%3],t:0,life:rand(.45,.95)});}
 const foe=other(p.owner);
 if(foe.alive&&Math.abs(foe.x-p.x)<S(64)&&Math.abs(foe.hurtY-p.y)<S(58)){
  foe.takeDamage(p.dmg||65,340,Math.sign(foe.x-p.x)||Math.sign(p.vx)||1,{ranged:true,skill:true,col:"#ffd23f",fx:"#f28022"});
  foe.burnDps=8;foe.burn=Math.max(foe.burn,2);statusFloat(foe,"BURN","#f28022");}
 hitProps(p.x,1,S(64),50,p.owner);hitProps(p.x,-1,S(64),50,p.owner);
}
/* Electrical burst on a target struck by Haydar's Mechanical Ottoman Slap. */
function shockExplosion(x,y){
 ringFx(x,y,"#bfeaff",S(52));ringFx(x,y,"#8fd8ff",S(34));ringFx(x,y,"#ffffff",S(18));
 spawnHitFx(x,y,"#8fd8ff",14);shake=Math.max(shake,.4);
 for(let i=0;i<24;i++){const a=Math.random()*6.283,sp=rand(50,230);
  particles.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,r:rand(1,3),col:["#eaffff","#bfeaff","#8fd8ff","#ffffff"][i%4],t:0,life:rand(.15,.4)});}
 for(let b=0;b<6;b++){let px=x,py=y,ang=Math.random()*6.283;   /* jagged bolts */
  for(let seg=0;seg<5;seg++){const nx=px+Math.cos(ang)*rand(4,10),ny=py+Math.sin(ang)*rand(4,10);
   particles.push({x:px,y:py,vx:(nx-px)*4,vy:(ny-py)*4,r:1.5,col:seg%2?"#ffffff":"#8fd8ff",t:0,life:.12});px=nx;py=ny;ang+=rand(-1.1,1.1);}}
}
/* Per-frame visual-effects update: advances Munevver's CODEX timers (resolving them on completion), ages out particles/floating text/rings, and decays screen-shake. */
function updateFx(dt){
 for(let i=codexes.length-1;i>=0;i--){const c=codexes[i];
  c.t+=dt;
  for(const g of c.glyphs)g.a+=g.spin*dt;
  /* GRIP holds only once the numbers have reached the foe (after the lead-in) */
  const gripT=(c.dur-c.t);
  if(c.target.alive&&c.t>=(c.lead||0)*0.6){c.target.stun=Math.max(c.target.stun,gripT);c.target.vx=0;}
  if(c.t>=c.dur){codexes.splice(i,1);resolveCodex(c);}}
 for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.t+=dt;
  if(p.blood&&p.pool>0){p.pool-=dt;if(p.pool<=0)particles.splice(i,1);continue;}
  p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=450*dt;
  if(p.blood&&p.y>=GROUND-1&&p.vy>0){        /* splat: settle into a pool */
   p.y=GROUND-1;p.vx*=0.15;p.vy=0;p.pool=rand(.5,1.1);p.spread=rand(3,7);
   if(Math.random()<0.30)for(let k=0;k<2;k++)   /* tiny bounce-off specks */
    particles.push({x:p.x,y:p.y-1,vx:rand(-45,45),vy:rand(-90,-25),r:1,col:p.col,t:0,life:rand(.2,.4),blood:true,pool:0});
   continue;}
  if(p.t>p.life)particles.splice(i,1);}
 for(let i=floaters.length-1;i>=0;i--){const fl=floaters[i];fl.t+=dt;fl.y-=20*dt;if(fl.t>0.9)floaters.splice(i,1);}
 for(let i=rings.length-1;i>=0;i--){const r=rings[i];r.t+=dt;r.r+=r.max*3.4*dt;if(r.r>r.max)rings.splice(i,1);}
 if(shake>0)shake=Math.max(0,shake-dt*2);
}

/* =============== ROUND FLOW =============== */
/* Resets per-round state (projectiles/particles/props/platforms), repositions both fighters, resets the timer, and announces 'ROUND N... FIGHT!'. */
function startRound(){
 onlineRoundId++;   /* bump the online round epoch so stale delayed callbacks are ignored */
 projectiles=[];particles=[];floaters=[];rings=[];codexes=[];groundFx=[];ghosts=[];sawCuts=[];
 if(typeof resetDog==="function")resetDog();   /* clear the roaming dog + kill-buffs each round */
 if(typeof resetToilet==="function")resetToilet();   /* reset the toilet event each round */
 if(typeof resetCars==="function")resetCars();   /* reset the car explosion event each round */
 props=makeProps(stageId);
 plats=makePlats(stageId);
 fighters[0].resetRound(SPAWN_1,1);fighters[1].resetRound(SPAWN_2,-1);
 camX=camClamp((SPAWN_1+SPAWN_2)/2-W/2);camScale=1;   /* recentre + reset zoom each round */
 timer=matchRoundTime;roundOver=false;paused=false;
 document.getElementById("pauseMenu").classList.remove("show");
 roundAnnounce("ROUND "+roundNum,1000);
 setTimeout(()=>{if(document.getElementById("fight").classList.contains("active"))roundAnnounce("FIGHT!",600);},1100);
}
/* Ends the current round: awards the winner a round win and announces it, then either starts the next round or shows the match-victory screen once someone has 2 wins. */
function endRound(winner){
 if(roundOver)return;roundOver=true;
 winner.wins++;
 roundAnnounce(winner.d.name.toUpperCase()+" WINS ROUND",1400);
 const _sid=onlineSessionId,_rid=onlineRoundId;   /* capture epoch: don't advance a superseded online round */
 setTimeout(()=>{
  if(onlineCallbackStale(_sid,_rid))return;
  if(winner.wins>=matchWinsRequired)showVictory(winner);
  else{roundNum++;startRound();}
 },1800);
}
/* Called when the round timer hits 0: ends the round in favor of whoever has more HP% (coin flip on an exact tie). */
function timeoutRound(){
 if(roundOver)return;
 const a=fighters[0],b=fighters[1];
 const wa=a.hp/a.maxhp, wb=b.hp/b.maxhp;
 endRound(wa===wb?(Math.random()<.5?a:b):(wa>wb?a:b));
}
/* Stops the game loop and shows the post-fight victory screen with the winner's name and win-quote. */
function showVictory(winner){
 running=false;
 /* Online host: notify the guest and show the online post-match (rematch voting),
    not the local REMATCH / CHARACTER SELECT screen. */
 if(typeof onlineIsMatchHost==="function"&&onlineIsMatchHost()){
  if(typeof ONLINE_hostVictory==="function")ONLINE_hostVictory(winner);
  return;
 }
 document.getElementById("winTitle").textContent=winner.d.name.toUpperCase()+" WINS!";
 document.getElementById("winLore").textContent=WIN_LINES[winner.d.id];
 document.getElementById("postFight").classList.add("show");
}
/* =============== STAGE RENDERING (pixel style) =============== */
/* Fills a dithered checkerboard rectangle (used for stage backdrop gradients). */
function dither(x,y,w,h,col,inv){ctx.fillStyle=col;for(let yy=0;yy<h;yy+=2)for(let xx=((yy/2+(inv?1:0))%2)*2;xx<w;xx+=4)ctx.fillRect(x+xx,y+yy,2,2);}
/* Fills a rectangle with horizontal color bands plus a dither seam between each -- the title/fallback sky gradient used before the stage art has loaded. */
function bands(cols,y0,y1){const n=cols.length,bh=Math.ceil((y1-y0)/n);
 cols.forEach((c,i)=>{ctx.fillStyle=c;ctx.fillRect(0,y0+i*bh,W,bh);});
 for(let i=1;i<n;i++)dither(0,y0+i*bh-2,W,4,cols[i],i%2===0);}
/* =====================================================================
   KABATEPE PORT — the reference painting itself, embedded verbatim.
   The art, the ferry, the lighthouse, the tanks: original pixels, kept
   in place. Only the human figures were lifted out of the plate so they
   can be redrawn in the game's own chunky sprite style and animated.
   The world is 2032px wide; the 720px canvas scrolls across it.
   ===================================================================== */
const STAGE_BG=new Image();
STAGE_BG.src="assets/stages/kabatepe/background.png";
let STAGE_BG_OK=false;
STAGE_BG.onload=()=>{STAGE_BG_OK=true;};

/* ---- Background life --------------------------------------------------
   The painted figures stay exactly as the artist drew them — correct size,
   correct style, no redraw. To make them feel alive we re-blit thin slices
   of the PLATE itself with a 1px offset, so a shoulder/arm band shifts on a
   slow loop. It's the original pixels moving, not a sprite drawn on top.
   Each band is a small rect of the backdrop, nudged and re-stamped.
   ---------------------------------------------------------------------- */
const BG_MOTION=[
 /* Arm/shoulder bands on the painted figures. Every position below was
    template-matched against the source art (confidence 0.83-0.92), not
    guessed: a 1px sway re-blits the figure's OWN pixels, so the artist's
    style is preserved exactly. x,y,w,h are world coords; GROUND=249. */
 {x:317,y:222,w:20,h:10, spd:1.3, ph:0.0},   /* sign group — yellow cap  */
 {x:351,y:225,w:14,h:9,  spd:1.1, ph:1.9},   /* sign group — red coat    */
 {x:371,y:224,w:15,h:9,  spd:1.6, ph:3.0},   /* sign group — teal woman  */
 {x:697,y:213,w:21,h:10, spd:2.4, ph:0.5},   /* diver left — working arm */
 {x:786,y:211,w:21,h:11, spd:2.9, ph:2.4},   /* diver mid — at the rack  */
 {x:859,y:211,w:24,h:11, spd:1.4, ph:0.7},   /* diver right — hose hand  */
 {x:1151,y:221,w:15,h:7, spd:1.3, ph:0.4},   /* right pair — cap         */
 {x:1189,y:224,w:14,h:6, spd:2.0, ph:2.1}    /* right pair — blue shirt  */
];

/* --- Depth fix: the sleeping dog must read IN FRONT of the straddle frame.
   The backdrop is one flat plate, so after the frame's legs are drawn we
   re-stamp the dog's own pixels from the plate over them. The toilet shed
   sits further back and stays behind the legs, untouched. --- */
const DOG={x:592,y:245,w:56,h:25};

/* Applies the BG_MOTION sway table for one frame (see the comment above BG_MOTION for how/why). */
function drawBgMotion(t){
 if(!STAGE_BG_OK)return;
 const cx=Math.round(camX);
 for(const b of BG_MOTION){
  const sx=b.x-cx;
  if(sx<-30||sx>W+30)continue;                    /* cull offscreen */
  /* slow, small: a 1px sway is plenty at this distance */
  const dx=Math.round(Math.sin(t*b.spd+b.ph));    /* -1 .. 1 */
  if(dx===0)continue;                             /* nothing to redraw */
  /* re-stamp the plate's own band, shifted — original pixels, moved */
  ctx.drawImage(STAGE_BG, b.x,b.y,b.w,b.h, sx+dx,b.y,b.w,b.h);
 }
}

/* Draws the full-screen stage backdrop for this frame: the background painting (or a gradient fallback), the ambient background-life motion, and small atmosphere details (gulls, lighthouse glow, water glitter). */
function drawStage(t){
 if(STAGE_BG_OK){
  /* Backdrop drawn in WORLD space so it scales uniformly with the fighters under the
     camera zoom — no stretch, and no size change relative to the fighters. The painting
     maps across the whole world (0..WORLD_W wide, 0..H tall); its top/bottom edge rows
     are extended to fill the extra sky/ground revealed when the camera pulls back. */
  const iw=STAGE_BG.naturalWidth||STAGE_BG.width||WORLD_W;
  const ih=STAGE_BG.naturalHeight||STAGE_BG.height||H;
  const EXT=900;
  /* SMOOTH the backdrop: it's a painting, not pixel art. With nearest-neighbor (the global
     default) the camera zoom/pan resamples it row-by-row every frame -> the crawl/"tearing"
     while the camera moves. Bilinear makes the moving backdrop stable. Restore after. */
  const _sm=ctx.imageSmoothingEnabled;ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";
  ctx.drawImage(STAGE_BG, 0,0,iw,2, 0,-EXT, WORLD_W, EXT);        /* sky, extended upward */
  ctx.drawImage(STAGE_BG, 0,ih-2,iw,2, 0,H, WORLD_W, EXT);        /* ground, extended downward */
  ctx.drawImage(STAGE_BG, 0,0,iw,ih, 0,0, WORLD_W, H);           /* the painting itself */
  ctx.imageSmoothingEnabled=_sm;
 }else{
  ctx.fillStyle="#b37ba2";ctx.fillRect(-400,-900,WORLD_W+800,900+H);
  ctx.fillStyle="#c3a37e";ctx.fillRect(-400,164,WORLD_W+800,H-164+900);
 }
 /* NOTE: the old Kabatepe-painting decorations (swaying painted figures, sleeping
    dog, lighthouse glow, water glitter) were pinned to the PREVIOUS image's exact
    pixel coordinates, so they are disabled for the new background. Ask to re-add
    stage-specific atmosphere once the new art is finalized. */
}
/* =============== STAGE OBJECT RENDERING =============== */
/* Draws every live platform (scaffold/crate stack/jetty/etc., styled per `kind`, with damage cracks) and every destructible prop, all in world space. */
function drawStageObjects(t){
 /* platforms, styled per stage or by kind */
 for(const pl of platforms()){
  if(pl.hidden)continue;
  const dmgd=pl.hp!==undefined&&pl.hp<pl.max;
  if(pl.kind==="rune"){
   ctx.fillStyle="#3a2f7d";ctx.fillRect(pl.x,pl.y,pl.w,7);
   ctx.fillStyle="#8f6cf0";ctx.fillRect(pl.x,pl.y,pl.w,2);
   ctx.fillStyle="#c9b2ff";ctx.globalAlpha=.5+.3*Math.sin(t*4+pl.x);
   ctx.fillRect(pl.x+3,pl.y+3,3,2);ctx.fillRect(pl.x+pl.w-6,pl.y+3,3,2);ctx.globalAlpha=1;
  }else if(pl.kind==="wood"){
   ctx.fillStyle="#4a3722";ctx.fillRect(pl.x,pl.y,pl.w,8);
   ctx.fillStyle="#6d5233";ctx.fillRect(pl.x,pl.y,pl.w,2);
   ctx.fillStyle="#2e2114";for(let vx2=pl.x+6;vx2<pl.x+pl.w-3;vx2+=9)ctx.fillRect(vx2,pl.y+2,1,6);
  }else if(pl.kind==="pallet"){
   /* a real stack: pallets piled from the pier up to the standing face,
      so the object is grounded on the same plane as the fighters */
   const gh=GROUND-pl.y;                       /* height above the ground */
   ctx.fillStyle="#5e4527";ctx.fillRect(pl.x+1,pl.y+4,pl.w-2,gh-4);
   for(let yy=pl.y+7;yy<GROUND-1;yy+=6){       /* slat layers of the stack */
    ctx.fillStyle="#6f5231";ctx.fillRect(pl.x+1,yy,pl.w-2,3);
    ctx.fillStyle="#4a3620";ctx.fillRect(pl.x+1,yy+3,pl.w-2,1);}
   ctx.fillStyle="#3d2c1a";ctx.fillRect(pl.x+1,GROUND-2,pl.w-2,2);  /* contact */
   ctx.fillStyle="#8a6a42";ctx.fillRect(pl.x,pl.y,pl.w,4);          /* top face */
   ctx.fillStyle="#ab8858";ctx.fillRect(pl.x,pl.y,pl.w,2);
   ctx.globalAlpha=.3;ctx.fillStyle="#3a1f2e";                      /* ground shadow */
   ctx.fillRect(pl.x-3,GROUND-1,pl.w+6,2);ctx.globalAlpha=1;
  }else if(pl.kind==="jetty"){
   /* boarding gangway: deck up top, real pilings planted on the pier */
   ctx.fillStyle="#5a4a42";
   for(let px2=pl.x+4;px2<pl.x+pl.w-2;px2+=16)ctx.fillRect(px2,pl.y+6,3,GROUND-pl.y-6);
   ctx.globalAlpha=.3;ctx.fillStyle="#3a1f2e";
   ctx.fillRect(pl.x,GROUND-1,pl.w,2);ctx.globalAlpha=1;
   ctx.fillStyle="#8a6a52";ctx.fillRect(pl.x,pl.y+5,pl.w,2);        /* joist */
   ctx.fillStyle="#c9a077";ctx.fillRect(pl.x,pl.y,pl.w,5);          /* deck */
   ctx.fillStyle="#e3c795";ctx.fillRect(pl.x,pl.y,pl.w,2);
   ctx.fillStyle="#c0392b";ctx.fillRect(pl.x+2,pl.y-6,2,6);ctx.fillRect(pl.x+pl.w-4,pl.y-6,2,6);
   ctx.fillStyle="#e8e2d4";ctx.fillRect(pl.x+2,pl.y-7,pl.w-4,1);
  }else if(pl.kind==="rig"){
   /* SCAFFOLD, painted in the map's own palette: weathered steel taking the
      low sun on one side, violet shadow on the other; timber boards above.
      Bays share their uprights — each bay draws its LEFT standard, and the
      last one caps the run — so it reads as one structure, not slabs. */
   const T_LIT="#c98f6b", T_MID="#9a6a5c", T_SHD="#66404a", T_DRK="#4e2f3c";
   const P_LIT="#e8c08c", P_MID="#c4926a", P_EDG="#8a5c4c", P_SEAM="#6e4440";
   const dm=1-(pl.hp/pl.max);
   const sway=dm>0.5?Math.round(Math.sin(t*20+pl.x)):0;
   const px=pl.x+sway;
   const last=(pl.bay===(pl.top?1:2));

   const standard=(sx,y0,y1)=>{                   /* a vertical tube */
    ctx.fillStyle=T_SHD;ctx.fillRect(sx,y0,3,y1-y0);
    ctx.fillStyle=T_MID;ctx.fillRect(sx,y0,2,y1-y0);
    ctx.fillStyle=T_LIT;ctx.fillRect(sx,y0,1,y1-y0);   /* sunlit edge */
   };

   if(!pl.top){
    const y1=GROUND;
    standard(px+1,pl.y+6,y1);
    if(last)standard(px+pl.w-4,pl.y+6,y1);
    /* ledgers: horizontal tubes tying the bay together */
    ctx.fillStyle=T_SHD;
    for(let yy=pl.y+15;yy<GROUND-4;yy+=13)ctx.fillRect(px+2,yy,pl.w-4,2);
    ctx.fillStyle=T_MID;
    for(let yy=pl.y+15;yy<GROUND-4;yy+=13)ctx.fillRect(px+2,yy,pl.w-4,1);
    /* one diagonal brace per bay, alternating direction like a real facade */
    ctx.strokeStyle=T_SHD;ctx.lineWidth=1;ctx.beginPath();
    if(pl.bay%2===0){ctx.moveTo(px+2,GROUND-4);ctx.lineTo(px+pl.w-3,pl.y+15);}
    else{ctx.moveTo(px+pl.w-3,GROUND-4);ctx.lineTo(px+2,pl.y+15);}
    ctx.stroke();
    /* base plates sitting on the asphalt + contact shadow */
    ctx.fillStyle=T_DRK;ctx.fillRect(px,GROUND-2,5,2);
    if(last)ctx.fillStyle=T_DRK,ctx.fillRect(px+pl.w-5,GROUND-2,5,2);
    ctx.globalAlpha=.28;ctx.fillStyle="#4e2f3c";
    ctx.fillRect(px,GROUND-1,last?pl.w:pl.w+2,2);ctx.globalAlpha=1;
   }else{
    /* upper lift: standards continue up from the lift below */
    standard(px+1,pl.y+6,pl.y+30);
    if(last)standard(px+pl.w-4,pl.y+6,pl.y+30);
    ctx.fillStyle=T_SHD;ctx.fillRect(px+2,pl.y+16,pl.w-4,2);
   }
   /* guard rail + toe board along the back of the deck */
   ctx.fillStyle=T_SHD;ctx.fillRect(px+1,pl.y-10,pl.w-2,2);   /* top rail */
   ctx.fillStyle=T_MID;ctx.fillRect(px+1,pl.y-10,pl.w-2,1);
   ctx.fillStyle=T_SHD;ctx.fillRect(px+1,pl.y-5,pl.w-2,1);    /* mid rail */
   ctx.fillStyle=T_MID;ctx.fillRect(px+2,pl.y-10,2,10);
   if(last)ctx.fillRect(px+pl.w-4,pl.y-10,2,10);

   /* TIMBER BOARDS — the standing surface */
   ctx.fillStyle=P_MID;ctx.fillRect(px,pl.y,pl.w,4);
   ctx.fillStyle=P_LIT;ctx.fillRect(px,pl.y,pl.w,2);          /* sun on the top face */
   ctx.fillStyle=P_EDG;ctx.fillRect(px,pl.y+4,pl.w,2);        /* shaded lip */
   ctx.fillStyle=P_SEAM;                                       /* gaps between boards */
   for(let sx=px+12;sx<px+pl.w-4;sx+=12)ctx.fillRect(sx,pl.y,1,4);
   /* weathering: a little rust bleed where the tubes meet the boards */
   ctx.globalAlpha=.35;ctx.fillStyle="#b0563a";
   ctx.fillRect(px+1,pl.y+3,3,2);if(last)ctx.fillRect(px+pl.w-4,pl.y+3,3,2);
   ctx.globalAlpha=1;

   /* damage reads in the boards themselves */
   if(dm>0.3){
    ctx.fillStyle=P_SEAM;
    for(let i=0;i<Math.round(dm*5);i++){
     const cx2=px+7+((i*31)%(pl.w-14));
     ctx.fillRect(cx2,pl.y+1,1,3);ctx.fillRect(cx2+1,pl.y+2,1,2);}
   }
   if(dm>0.6){
    ctx.globalAlpha=.45;ctx.fillStyle="#c98f6b";
    for(let i=0;i<3;i++){
     const dx2=px+9+((i*23)%(pl.w-12));
     ctx.fillRect(dx2,pl.y+7+((t*40+i*9)%14),1,2);}
    ctx.globalAlpha=1;
   }
  }else if(pl.kind==="scaffold"){
   /* Legs run down to the pier — feet on the fighters' plane.
      `straddle` frames are open: two legs only, no cross-braces and no
      shadow spanning the gap, so whatever the painting put between them
      (the toilet shed behind, the dog in front) reads cleanly through. */
   const legH=GROUND-(pl.y+7);
   ctx.fillStyle="#6b5c3a";
   ctx.fillRect(pl.x+3,pl.y+7,2,legH);ctx.fillRect(pl.x+pl.w-5,pl.y+7,2,legH);
   if(!pl.straddle){
    ctx.fillStyle="#5a4c2f";                                 /* cross-brace */
    for(let yy=pl.y+14;yy<GROUND-4;yy+=10)ctx.fillRect(pl.x+4,yy,pl.w-8,1);
   }else{
    /* one high brace only, kept above the shed roof so nothing is crossed */
    ctx.fillStyle="#5a4c2f";ctx.fillRect(pl.x+4,pl.y+11,pl.w-8,1);
   }
   ctx.fillStyle="#4a3d24";ctx.fillRect(pl.x+2,GROUND-2,4,2);ctx.fillRect(pl.x+pl.w-6,GROUND-2,4,2);
   ctx.globalAlpha=.3;ctx.fillStyle="#3a1f2e";
   if(pl.straddle){                                          /* shadow only under each foot */
    ctx.fillRect(pl.x+1,GROUND-1,7,2);ctx.fillRect(pl.x+pl.w-8,GROUND-1,7,2);
   }else{
    ctx.fillRect(pl.x,GROUND-1,pl.w,2);
   }
   ctx.globalAlpha=1;
   ctx.fillStyle="#b09a6a";ctx.fillRect(pl.x,pl.y,pl.w,4);   /* plank */
   ctx.fillStyle="#8a774e";ctx.fillRect(pl.x,pl.y+4,pl.w,3);
  }else if(pl.kind==="panel"){
   ctx.fillStyle="#161a38";ctx.fillRect(pl.x,pl.y,pl.w,7);
   ctx.fillStyle="#3fd8c7";ctx.globalAlpha=.6+.35*Math.sin(t*6+pl.x);
   ctx.fillRect(pl.x,pl.y,pl.w,2);ctx.globalAlpha=1;
   ctx.fillStyle="#2c3163";ctx.fillRect(pl.x+2,pl.y+7,2,6);ctx.fillRect(pl.x+pl.w-4,pl.y+7,2,6);
  }else{
   const legH=GROUND-(pl.y+7);
   if(legH>0){ctx.fillStyle="#5a5148";
    ctx.fillRect(pl.x+2,pl.y+7,3,legH);ctx.fillRect(pl.x+pl.w-5,pl.y+7,3,legH);
    ctx.globalAlpha=.3;ctx.fillStyle="#3a1f2e";ctx.fillRect(pl.x,GROUND-1,pl.w,2);ctx.globalAlpha=1;}
   ctx.fillStyle="#8a8172";ctx.fillRect(pl.x,pl.y,pl.w,7);
   ctx.fillStyle="#b0a695";ctx.fillRect(pl.x,pl.y,pl.w,2);
   ctx.fillStyle="#5a5148";for(let vx=pl.x+4;vx<pl.x+pl.w-4;vx+=6)ctx.fillRect(vx,pl.y+4,3,3);
  }
  if(dmgd){
   ctx.strokeStyle="rgba(10,8,6,.8)";ctx.lineWidth=1;
   ctx.beginPath();ctx.moveTo(pl.x+4,pl.y);ctx.lineTo(pl.x+pl.w/2,pl.y+6);ctx.lineTo(pl.x+pl.w-5,pl.y+1);ctx.stroke();
   ctx.fillStyle="#000";ctx.fillRect(pl.x,pl.y-5,pl.w,3);
   ctx.fillStyle="#f2b632";ctx.fillRect(pl.x,pl.y-5,Math.max(1,Math.round(pl.w*pl.hp/pl.max)),3);
  }
 }
 /* Re-stamp the dog over the straddle frame's legs so it reads IN FRONT.
    (The shed sits further back and stays behind, untouched.) */
 /* old-painting sleeping-dog re-stamp disabled for the new background */
 /* destructible props */
 for(const pr of props.slice().sort((a,b)=>propBaseY(a)-propBaseY(b))){
  const px=pr.x,pb=propBaseY(pr),pt=pb-pr.h,cracked=pr.hp<pr.max*.55;
  if(pr.kind==="scaffold"&&typeof drawScaffoldProp==="function"){
   drawScaffoldProp(pr,t);
  }else if(pr.kind==="car"&&typeof drawCarProp==="function"){
   drawCarProp(pr,t);
  }else if(pr.kind==="co2tank"&&typeof drawCO2TankProp==="function"){
   drawCO2TankProp(pr,t);
  }else if(pr.kind==="vase"){
   ctx.fillStyle="#4a3d8f";ctx.fillRect(px+3,pt,pr.w-6,4);
   ctx.fillStyle="#5747b0";ctx.fillRect(px,pt+4,pr.w,pr.h-8);
   ctx.fillStyle="#8f6cf0";ctx.fillRect(px+2,pt+7,3,pr.h-14);
   ctx.fillStyle="#f2b632";ctx.fillRect(px,pt+4,pr.w,2);ctx.fillRect(px,pb-6,pr.w,2);
  }else if(pr.kind==="crate"){
   ctx.fillStyle="#4a3722";ctx.fillRect(px,pt,pr.w,pr.h);
   ctx.fillStyle="#5c452c";ctx.fillRect(px+2,pt+2,pr.w-4,3);ctx.fillRect(px+2,pt+2,3,pr.h-4);
   ctx.strokeStyle="#2e2114";ctx.lineWidth=2;ctx.strokeRect(px+1,pt+1,pr.w-2,pr.h-2);
  }else if(pr.kind==="divetank"){
   /* yellow scuba cylinders in a rack — exactly as in the reference art */
   ctx.fillStyle="#8a8172";ctx.fillRect(px-1,pb-3,pr.w+2,3);           /* rack foot */
   for(let k=0;k<2;k++){const tx=px+1+k*8;
    ctx.fillStyle="#f2c230";ctx.fillRect(tx,pt+4,6,pr.h-7);            /* body */
    ctx.fillStyle="#ffe07a";ctx.fillRect(tx+1,pt+6,2,pr.h-11);         /* highlight */
    ctx.fillStyle="#c99a1e";ctx.fillRect(tx+4,pt+4,2,pr.h-7);          /* shade */
    ctx.fillStyle="#8a8172";ctx.fillRect(tx+2,pt,2,4);                 /* valve */
    ctx.fillStyle="#c0392b";ctx.fillRect(tx,pt+9,6,2);}                /* band */
   ctx.fillStyle="#5a5148";ctx.fillRect(px-1,pt+7,pr.w+2,1);           /* rack bar */
  }else if(pr.kind==="compressor"){
   /* the little red air compressor on the pier */
   ctx.fillStyle="#c0392b";ctx.fillRect(px,pt+5,pr.w,pr.h-5);
   ctx.fillStyle="#e05a45";ctx.fillRect(px+2,pt+7,pr.w-4,3);
   ctx.fillStyle="#8a8172";ctx.fillRect(px+3,pt,pr.w-6,6);
   ctx.fillStyle="#2a2620";ctx.fillRect(px+2,pb-4,5,4);ctx.fillRect(px+pr.w-7,pb-4,5,4);
   ctx.fillStyle="#f2d98c";ctx.globalAlpha=.6+.35*Math.sin(t*5+px);
   ctx.fillRect(px+pr.w-6,pt+8,3,3);ctx.globalAlpha=1;
  }else if(pr.kind==="slantern"){
   ctx.fillStyle="#6f6a5e";ctx.fillRect(px+4,pb-6,pr.w-8,6);
   ctx.fillStyle="#8b8576";ctx.fillRect(px,pt+6,pr.w,pr.h-14);
   ctx.fillStyle="#57534a";ctx.fillRect(px+2,pt,pr.w-4,6);
   ctx.fillStyle="#f2d98c";ctx.globalAlpha=.6+.35*Math.sin(t*5+px);
   ctx.fillRect(px+5,pt+10,pr.w-10,6);ctx.globalAlpha=1;
  }else{
   ctx.fillStyle="#161a38";ctx.fillRect(px,pt,pr.w,pr.h);
   ctx.strokeStyle="#2c3163";ctx.lineWidth=2;ctx.strokeRect(px,pt,pr.w,pr.h);
   ctx.fillStyle="#3fd8c7";ctx.globalAlpha=.55+.4*Math.sin(t*6);
   ctx.font="6px 'Press Start 2P'";ctx.textAlign="center";ctx.fillText("Z",px+pr.w/2,pt+13);
   ctx.fillStyle="#8f6cf0";ctx.fillRect(px+4,pb-8,pr.w-8,3);ctx.globalAlpha=1;
  }
  if(cracked&&pr.kind!=="car"&&pr.kind!=="scaffold"&&pr.kind!=="co2tank"){ctx.strokeStyle="rgba(10,8,6,.7)";ctx.lineWidth=1;  /* procedural crack — only for the simple rectangular props, not image sprites */
   ctx.beginPath();ctx.moveTo(px+3,pt+4);ctx.lineTo(px+pr.w/2,pt+pr.h/2);ctx.lineTo(px+4,pb-4);ctx.stroke();}
  /* hp pips (scaffolds show damage by trembling/shedding instead, so no bar for them) */
  if(pr.hp<pr.max&&pr.kind!=="scaffold"&&pr.kind!=="car"&&pr.kind!=="co2tank"){ctx.fillStyle="#000";ctx.fillRect(px,pt-5,pr.w,3);
   ctx.fillStyle="#f2b632";ctx.fillRect(px,pt-5,Math.max(1,Math.round(pr.w*pr.hp/pr.max)),3);}
 }
}

/* =============== FIGHTER RENDERING =============== */
/* Per-hero extra visual effects layered ON TOP of the sprite during specific skills/ult (glows, auras, held-weapon fx, speech bubbles). EXTRAS[hero](ctx,fighter,time), called every frame from drawFighter(). */
const EXTRAS={
 ember(g,f,t){const top=-58;
  [-4,0,4].forEach((dx,i)=>{const hgt=2+((Math.floor(t*9)+i)%3);
   for(let j=0;j<hgt;j++){g.fillStyle=j===hgt-1?"#ffd23f":"#f28022";g.fillRect(dx-1,top-4-j*2,2,2);}});},
};
/* Effects drawn BEHIND the fighter sprite (sprite-px space, origin at feet). */
/* Same idea as EXTRAS above, but drawn BEHIND the sprite -- ghost afterimages, big rings/auras the fighter stands in front of, etc. */
const EXTRAS_BEHIND={
};
/* Draws small hero-specific held-prop decorations (Haydar's rifle sparks, Satori's blade glow, etc.) that aren't part of the base sprite art. */
function drawProps(g,f,t,attacking,special){
 const fx=f.facing, hx=fx*(attacking?16:9), hy=-30;
 if(f.d.id==="satori"&&(attacking||special)){
  g.fillStyle="#e2384a";g.fillRect(fx===1?hx+2:hx-6,hy-1,4,3);
  g.fillStyle="#ff8fa0";g.fillRect(fx===1?hx+6:hx-9,hy,3,1);}
 /* agron: claws are painted into the sprite art now */
 if(f.d.id==="akira"&&special){g.fillStyle="#7de8d8";g.fillRect(fx===1?hx+2:hx-6,hy-2,4,4);
  g.fillStyle="#c8fff4";g.fillRect(fx===1?hx+3:hx-5,hy-1,2,2);}
 if(f.d.id==="munevver"&&special){g.fillStyle="#b36bff";g.fillRect(-1,-40,3,3);}
}
/* Draws one fighter for this frame: shadow, EXTRAS_BEHIND, the sprite itself (portrait art if available, else the procedural pixel-grid), EXTRAS on top, then any held-prop decoration. */
function drawFighter(f,t){
 const attacking=f.state==="attack"&&f.t<.16;
 const special=f.state==="special";
 /* shadow */
 let shY=GROUND;
 for(const pl of platforms())if(f.x>pl.x-6&&f.x<pl.x+pl.w+6&&pl.y>=f.y-1&&pl.y<shY)shY=pl.y;
 ctx.fillStyle="rgba(0,0,0,.35)";ctx.beginPath();ctx.ellipse(f.x,shY+2,S(14),S(3)+1,0,0,7);ctx.fill();
 if(f.ultCharging){ctx.save();/* ULT CHARGE meter over his head — visible only while the button is held */
  const frac=Math.min(1,f.ultChargeT/2),full=frac>=1;
  const bw=32,bh=5,bx=Math.round(f.x-bw/2),by=Math.round(f.y)-62;
  ctx.fillStyle="rgba(0,0,0,.7)";ctx.fillRect(bx-2,by-2,bw+4,bh+4);
  for(let s=0;s<4;s++){const segF=Math.max(0,Math.min(1,frac*4-s));
   ctx.fillStyle=segF>0?(full?(Math.sin(tGlobal*20)>0?"#eaffff":"#8fd8ff"):"#8fd8ff"):"#20303a";
   ctx.fillRect(bx+s*(bw/4)+1,by,Math.max(1,bw/4-2),bh);}
  if(full){ctx.fillStyle=Math.sin(tGlobal*18)>0?"#eaffff":"#bfeaff";ctx.font="5px 'Press Start 2P'";ctx.textAlign="center";ctx.fillText("MAX",Math.round(f.x),by-4);}
  ctx.restore();
 }
 ctx.save();
 ctx.translate(Math.round(f.x),Math.round(f.y));
 if(f._squashT>0){/* elastic hit recoil: quick squash-stretch wobble, eases out */
  const q=f._squashT/0.22, wob=Math.sin(q*Math.PI*2.2)*q;   /* damped oscillation */
  const sx=1-wob*0.22, sy=1+wob*0.20;
  ctx.scale(sx,sy);ctx.translate((f._squashDir||1)*wob*3,0);
 }
 ctx.scale(CH_SCALE,CH_SCALE);   /* <-- everything below is authored in sprite px */
 const imgSet=IMG_SPRITES[f.d.id];
 if(EXTRAS_BEHIND[f.d.id]&&f.alive){ctx.save();EXTRAS_BEHIND[f.d.id](ctx,f,t);ctx.restore();}
 if((!f.alive||f.koPose>0)&&!(imgSet&&imgSet.ko)){ctx.rotate(-f.facing*Math.PI/2);ctx.translate(-4,16);}   /* dead OR knocked-down (no KO art) -> lie on the ground */
 if(f.crouching&&f.alive&&f.onGround&&!(imgSet&&imgSet.crouch))ctx.scale(1.06,.72);
 if(f.morph>0){ctx.fillStyle="rgba(179,107,255,.28)";
  ctx.beginPath();ctx.ellipse(0,-30,20,34,0,0,7);ctx.fill();}
 if(f.phase>0)ctx.globalAlpha=(IMG_SPRITES[f.d.id]&&IMG_SPRITES[f.d.id].skillC&&f.d.id==="notalk")?.85:.35;
 if(f.frozen>0)ctx.globalAlpha=Math.min(ctx.globalAlpha,0.42+0.08*Math.sin(tGlobal*7));   /* time-frozen foes fade like a paused film */
 const img=IMG_SPRITES[f.d.id];
 let bob=0;
 if(f.state==="walk")bob=(Math.floor(f.walkPhase)%2)?-1:0;
 else if(f.state==="idle"&&f.onGround)bob=Math.sin(t*2.5)>0?0:-1;
 if(img){/* ---- image-based fighter (user art, optional full motion set) ---- */
  let fr=img.idle;
  if(img.idle2&&f.alive){   /* natural idle stance: slow ping-pong sway through the idle frames */
   const seq=img.idle3?[img.idle,img.idle2,img.idle3,img.idle2]:[img.idle,img.idle2];
   fr=seq[Math.floor(tGlobal/0.42)%seq.length];
  }
  if(f.d.id==="necmi"&&f.morph>0&&img.skillC){
   /* MASS MORPH: animated dough shell for the whole duration, starts on C01 */
   const cyc=[img.skillC,img.skillC2||img.skillC,img.skillC3||img.skillC,img.skillC4||img.skillC];
   const el=4-f.morph;                       /* seconds elapsed (morph starts at 4) */
   let idx;
   if(el<0.18) idx=0;                         /* initiate on the first image */
   else idx=1+(Math.floor((el-0.18)*8)%3);    /* then cycle the swirling frames */
   fr=cyc[idx];
  }
  else if(!f.alive&&img.ko)fr=(img.ko2&&(f.downT||0)>0.12)?img.ko2:img.ko;   /* KO sequence: ko (impact) -> ko2 (grounded), held */
  else if(f.kbT>0&&img.kb1){   /* KNOCKBACK (launched / knocked down, NOT defeated): kb1 flying+sliding back -> kb2 down -> kb3 get up */
   if((f.kbLandT||0)<0)fr=img.kb1;                         /* still flying OR sliding backwards */
   else if((f.kbLandT||0)<0.30)fr=(img.kb2||img.kb1);      /* settled on the ground: down */
   else fr=(img.kb3||img.kb2||img.kb1);                    /* getting back up (final part) */
  }
  else if(f.koPose>0&&img.ko&&!img.kb1)fr=(img.ko2&&(f.downT||0)>0.12)?img.ko2:img.ko;   /* fallback: chars WITHOUT knockback art */
  else if(f.d.id==="satori"&&f.fallDmgT>0&&f.onGround&&f.alive&&(f.kbT||0)<=0&&(f.koPose||0)<=0&&img.falldmg1){
   /* HARD LANDING committed sequence — ABOVE the stun/hit-flash fallback so it never flashes idle:
      falldmg1 = touchdown (held through the impact + stun) -> falldmg2 = quick get-up -> idle. */
   fr=(f.fallDmgT>0.24)?img.falldmg1:(img.falldmg2||img.falldmg1);
  }
  else if(f.d.id==="necmi"&&f.state==="special"&&f.skillAT>0&&f.poseSkill===0&&img.skillA){
   /* PINCH-MASS SHOT pose must survive incidental stun/hit-flash so the wind-up/release always reads */
   fr=(img.skillA2&&f.skillAT>0.50)?img.skillA2:img.skillA;}
  else if(f.d.id==="necmi"&&f.state==="special"&&f.skillBT>0&&f.poseSkill===1&&img.skillB){
   /* LIMB HIJACK pointing-cast pose — keep it visible even while stunned/gripped by Munevver */
   fr=img.skillB;}
  else if(f.d.id==="putuk"&&f._counterHitT>0&&img.skillC2)fr=img.skillC2;   /* FROZEN COUNTER strike */
  else if(f.d.id==="putuk"&&f.counterT>0&&img.skillC)fr=img.skillC;          /* FROZEN COUNTER stance */
  else if(f.hitFlash>.02||f.stun>0)fr=img.hit;   /* frozen: keep whatever pose they were mid-doing (timers are halted) */
  else if(f.d.id==="haydar"&&f.ultCharging&&img.ult1)fr=img.ult1;
  else if(f.d.id==="haydar"&&f.ultPose>0&&img.ult2)fr=img.ult2;
  else if(f.ultPose>0&&(img.ult||img.ult1))fr=(img.ult2&&f.ultPose<(f._ultHalf||0))?img.ult2:(img.ult1||img.ult);
  else if(f.d.id==="munevver"&&f.ultPose>0&&(img.ult1||img.ult)){
   /* CODEX ult: ult1 = raise the codex, ult2 = unleash the numbers */
   fr=(img.ult2&&f.ultPose<(f._ultHalf||0.7))?img.ult2:(img.ult1||img.ult);}
  else if(f.d.id==="haydar"&&f.state==="special"&&f.poseSkill===0&&img.skillA){
   /* CRESCENT EXECUTION: skillA = overhead down-slash (1st strike), skillA2 = low up-slash (2nd strike) */
   fr=(img.skillA2&&f.skillAT<=0.3)?img.skillA2:img.skillA;}
  else if(f.d.id==="haydar"&&f.state==="special"&&f.poseSkill===1&&img.skillB){
   /* PASHA'S RIFLE ASSAULT: crouched firing pose if cast while crouching, else standing */
   fr=(f._skBc&&img.skillBc)?img.skillBc:img.skillB;}
  else if(f.d.id==="munevver"&&f.state==="special"&&f.poseSkill===0&&img.skillA){
   /* RULER VERDICT: skillA = leap wind-up, then skillA2 = the descending slash.
      Slowed so the two poses read clearly (was a fast 0.18 flip). */
   fr=(img.skillA2&&f.skillAT<=0.42)?img.skillA2:img.skillA;}
  else if(f.d.id==="necmi"&&f.state==="special"&&f.poseSkill===0&&img.skillA){
   /* PINCH-MASS SHOT: skillA2 = pinch-mass held overhead (wind-up), then skillA = arm-forward release. */
   fr=(img.skillA2&&f.skillAT>0.50)?img.skillA2:img.skillA;}
  else if(f.windmill>0&&img.skillB)fr=img.skillB;
  else if(f.seizeT>0&&img.skillB)fr=img.skillB;   /* BLOOD SEIZE: the charge */
  else if(f.grabT>0&&img.skillB){/* grab -> bite -> SMASH */
   const p=Math.max(0,Math.min(1,1-f.grabT/0.72));
   fr=p<0.30?(img.skillB2||img.skillB)
     :(p<0.62?(img.skillB3||img.skillB)
     :(img.skillB4||img.skillB));}
  else if(f.slamT>0&&img.skillC3)fr=img.skillC3;   /* GRAVITY DIVE: ground impact */
  else if(f.diveT>0&&img.skillC){/* GRAVITY DIVE: launch -> dive */
   const p=Math.max(0,Math.min(1,1-f.diveT/1.15));
   fr=p<0.30?img.skillC:(img.skillC2||img.skillC);}
  else if(f.d.id==="satori"&&special&&f.poseSkill===0&&f.onGround&&!f.crouching&&img.skA1&&f.t<.42){
   /* STANDING Skill A pose: 1st charge -> skA1, 2nd charge -> skA2 (set at cast in ABILITIES.satori[0]). */
   fr=(f._aShot===2&&img.skA2)?img.skA2:img.skA1;
  }
  else if(f.d.id==="satori"&&special&&f.poseSkill===0&&f.onGround&&f.crouching&&img.skAcr1&&f.t<.42){
   /* CROUCH Skill A pose: 1st charge -> skAcr1, 2nd charge -> skAcr2 (same 2-charge principle). */
   fr=(f._aShot===2&&img.skAcr2)?img.skAcr2:img.skAcr1;
  }
  else if(f.d.id==="satori"&&special&&f.poseSkill===0&&!f.onGround&&img.skAair1&&f.t<.7){
   /* AIR Skill A — ONE pose per throw, both sprites shown once (no repeat): throw 1 = first pose,
      throw 2 = second pose. Order flips per charge (1st cast 1->2, 2nd cast 2->1). Swap sits in the
      gap between the two throws (throw1 f.t≈0.18, throw2 f.t≈0.40). */
   const two=img.skAair2||img.skAair1;
   const order=(f._aShot===2)?[two,img.skAair1]:[img.skAair1,two];
   fr=(f.t<0.30)?order[0]:order[1];
  }
  else if(f.d.id==="satori"&&special&&f.poseSkill===1&&f.onGround&&!f.crouching&&f.skillContext!=="air"&&img.skB1){
   /* STANDING Skill B (Crimson Crossing): B1->B2->B3 = wind-up IN PLACE; B4 = the dash (shown once it fires). */
   fr=(f.dashKind==="satcross")?(img.skB4||img.skB3):(f.t<0.09?img.skB1:(f.t<0.18?img.skB2:img.skB3));
  }
  else if(f.d.id==="satori"&&special&&f.poseSkill===1&&f.onGround&&f.crouching&&img.cskB1){
   /* CROUCH Skill B (Low Shadow Crossing) 5-frame sequence: charge -> dash -> slide-stop -> close -> reverse slash. */
   fr=f.t<0.20?img.cskB1:(f.t<0.36?img.cskB2:(f.t<0.50?img.cskB3:(f.t<0.60?img.cskB4:img.cskB5)));
  }
  else if(f.d.id==="satori"&&special&&f.poseSkill===1&&f.skillContext==="air"&&img.skBair1){
   /* AIR Skill B (Crimson Crescent Dive): air1 (hover) -> air2 (blade drawn, dark-red lightning) -> air3 wind-up,
      then air4 = the dive-dash. He HOLDS skBair4 for the entire dash — hitting the foe never cuts the pose —
      and snaps to the landing sprite the instant he touches down after passing through. */
   fr=f.onGround?(img.landing||img.skBair4)
     :((f.dashKind==="satdive")?(img.skBair4||img.skBair3):(f.t<0.14?img.skBair1:(f.t<0.30?img.skBair2:img.skBair3)));
  }
  else if(f.d.id==="satori"&&special&&f.poseSkill===2&&f.onGround&&f.crouching&&img.cskC1){
   /* CROUCH Skill C (Crimson Spike Trap) 3-frame plant: reach -> press into floor -> settle. */
   fr=f.t<0.14?img.cskC1:(f.t<0.28?img.cskC2:img.cskC3);
  }
  else if(special&&f.poseSkill>=0&&img["skill"+["A","B","C"][f.poseSkill]]&&(f.t<.45||f.windmill>0))fr=img["skill"+["A","B","C"][f.poseSkill]];
  else if(f.blocking&&img.block){
   /* guard pose; block-impact pose briefly after a blocked hit. CROUCH-block (crouch+block held) uses the low variant. */
   const hitNow=(f.d.id==="satori"&&(f._blockHitT||0)>0);
   if(f.d.id==="satori"&&f._crouchBlock&&img.cblock)fr=(hitNow&&img.cblockhit)?img.cblockhit:img.cblock;
   else fr=(hitNow&&img.blockhit)?img.blockhit:img.block;
  }
  else if(f.d.id==="satori"&&f.crouching&&f.onGround&&f.hurtT>0&&f.alive&&f.state!=="attack"&&(f.kbT||0)<=0&&img.crouchhit){
   fr=img.crouchhit;   /* CROUCH hit reaction: struck while crouching */
  }
  else if(f.crouching&&f.onGround&&f.state!=="attack"&&img.crouch){
   /* going DOWN into the crouch: crouch -> crouch2 -> crouch3, then hold crouch3 (steps aside while attacking) */
   const ct=f.crouchT||0;
   fr=img.crouch2?(ct<0.09?img.crouch:(ct<0.18?img.crouch2:(img.crouch3||img.crouch2))):img.crouch;
  }
  else if(f.flying&&f.alive&&img.fly)fr=img.fly;
  else if(f.jumpWindup>0&&f.onGround&&img.jump){
   /* GROUND wind-up: a quick jump(01), then HOLD jump2(02) for most of the lift-off */
   fr=(img.jump2&&f.jumpWindup<JUMP_WINDUP*0.7)?img.jump2:img.jump;
  }
  else if(f.d.id==="satori"&&f.state==="attack"&&!f.onGround&&img.airatk1){
   /* AIR combo: hits 1 & 2 = one sprite each; hit 3 = a 2-frame sequence (airatk3a wind-up -> airatk3b strike). */
   const hi=f.atkHit||0;
   if(hi===2&&img.airatk3a)fr=(f.t<0.16)?img.airatk3a:(img.airatk3b||img.airatk3a);   /* wind-up held, then strike lands with the hit (~f.t 0.16) */
   else fr=img["airatk"+(hi+1)]||img.airatk1;
  }
  else if(f.d.id==="satori"&&f._airBlockT>0&&!f.onGround&&f.alive&&img.airblock){
   fr=img.airblock;   /* AIR BLOCK: 0.5s reaction guard pose while airborne */
  }
  else if(f.d.id==="satori"&&f.hurtT>0&&!f.onGround&&(f.kbT||0)<=0&&f.alive&&img.damageair){
   fr=img.damageair;   /* AIR HIT reaction: struck mid-air (a heavy launch uses kb1 instead) */
  }
  else if(!f.onGround&&f.alive&&img.jump){
   if(f.vy>30&&img.falling)fr=img.falling;                 /* on the way DOWN */
   else if(f.jumps>=2&&img.dbljump)fr=img.dbljump;         /* double-jump rise */
   else fr=(img.jump2&&(f.jumpT||0)<0.10)?img.jump2:(img.jump3||img.jump);   /* hold jump2 a little into the air, then the leap (jump3) */
  }
  else if(f.landT>0&&f.onGround&&f.alive&&img.landing)fr=img.landing;   /* brief touchdown pose */
  else if(f.d.id==="satori"&&f.state==="attack"&&img.atk1a){
   /* 3-HIT COMBO (STANDING or CROUCHING): hit a (wind-up) -> b (strike); hit 3 (=2) is the heavy */
   const hi=f.atkHit||0, dur=(hi===2)?(f.crouching?0.30:0.32):(f.crouching?0.27:0.22);   /* crouch basics a touch slower than standing */
   const pre=(f.crouching&&f.onGround&&img.catk1a)?"catk":"atk";   /* hold crouch -> crouched combo */
   fr=(f.t<dur*0.42)?img[pre+(hi+1)+"a"]:(img[pre+(hi+1)+"b"]||img[pre+(hi+1)+"a"]);
  }
  else if((f.state==="attack"&&f.t<.22)||(special&&f.t<.4)||f.dashT>0){
   let an=img._an;
   if(!an){an=1;while(img["attack"+(an+1)])an++;img._an=an;}
   fr=an>2?img[["attack","attack2","attack3","attack4"][((f._atkStep-1)%an+an)%an]]
          :((img.attack2&&f._atkAlt)?img.attack2:img.attack);
  }
  else if(f.d.id==="satori"&&f.hurtT>0&&f.onGround&&!f.crouching&&f.alive&&(f.koPose||0)<=0&&(f.kbT||0)<=0&&img.hit1){
   /* STANDING HIT reaction: random pose. LOW variant when a CROUCHING foe struck from below. */
   if(f._hitLow&&img.hitlow1)fr=(f._hitFrame===2&&img.hitlow2)?img.hitlow2:img.hitlow1;
   else fr=(f._hitFrame===2&&img.hit2)?img.hit2:img.hit1;
  }
  else if(f.d.id==="satori"&&f._locoPhase==="stop"&&f.onGround&&f.alive&&img.run0){
   fr=img["run"+f._runFrame];   /* RUN->IDLE exit: hold the compact pose (F2/F5) briefly, then idle takes over */
  }
  else if(f.state==="walk"&&f.onGround&&(img.run0||img.run)){
   if(img.run0){let n=img._rn;if(!n){n=0;while(img["run"+n])n++;img._rn=n;}
    /* SATORI: frame is driven by his run-cycle state machine (per-frame stepped timing, F2-start).
       Other run-cycle heroes keep the distance-locked cadence. */
    if(f.d.id==="satori")fr=img["run"+((f._runFrame||0)%n)];
    else fr=img["run"+(Math.floor(f.walkPhase*2.2)%n)];}
   else fr=img.run;
  }
  if(!fr)fr=img.idle;   /* a state whose sprite isn't added yet (mid-update) falls back to idle */
  /* SATORI: soften transitions BETWEEN moves — when his state changes, briefly dissolve the previous
     pose out over the new one. In-animation frame swaps (run cycle, attack strikes) keep the same state,
     so they stay crisp. */
  let _xfPrev=null,_xfA=0;
  if(f.d.id==="satori"){
   const XF=0.09, ddt=Math.max(0,Math.min(0.05,tGlobal-(f._fbLast||tGlobal)));f._fbLast=tGlobal;
   /* NO crossfade for the run — it ghosts the fast run frames. Only blend transitions between other
      moves (attack/idle/skill/jump...); skip whenever walk is on either side of the change. */
   if(f.state!==f._fbState){
    if(f._fbCur&&f._fbCur!==fr&&f.state!=="walk"&&f._fbState!=="walk"){f._fbPrev=f._fbCur;f._fbT=XF;}
    f._fbState=f.state;}
   if(f.state==="walk")f._fbT=0;   /* cancel any lingering blend the moment he starts running */
   if(f._fbT>0){f._fbT-=ddt;if(f._fbT<0)f._fbT=0;}
   f._fbCur=fr;
   if(f._fbT>0&&f._fbPrev&&f._fbPrev!==fr){_xfPrev=f._fbPrev;_xfA=f._fbT/XF;}
  }
  ctx.save();
  ctx.imageSmoothingEnabled=false;
  if(f.facing===-1)ctx.scale(-1,1);
  if(img.run0&&f.state==="walk"&&f.onGround){
   let rn=img._rn; if(!rn){rn=0;while(img["run"+rn])rn++;img._rn=rn;}
   if(f.d.id==="agron"||f.d.id==="munevver"){
    /* AGRON & MUNEVVER don't walk — they levitate. Continuous hover, no footfalls. */
    bob=-2+Math.sin(tGlobal*2.4)*1.15;
   }else if(f.d.id==="satori"){
    /* SATORI's hi-res run frames already carry their own bounce — no engine bob (avoids a double-bob jitter). */
    bob=0;
   }else{
    /* two contacts per cycle -> body rises between footfalls */
    const ph=Math.sin(f.walkPhase*2.2*Math.PI*2 - Math.PI/2);
    bob=(rn<2)?(ph>0.4?-2:(ph>-0.4?-1:0)):(ph>0?-1:0);
   }
  }
  const lean=attacking?2:0;
  let edgeShift=0;
  if(S(fr.w)>60){const wx=f.facing===-1?-1:1; const hw=S(fr.w)/2;
   const leftWorld=f.x-hw, rightWorld=f.x+hw;
   if(leftWorld<WALL_L-16)edgeShift=(WALL_L-16-leftWorld)*wx/CH_SCALE; else if(rightWorld>WALL_R+16)edgeShift=(WALL_R+16-rightWorld)*wx/CH_SCALE;}
  const toxic=f.surge>0;
  if(toxic){const pulse=3+Math.abs(Math.sin(t*6))*4;ctx.filter="drop-shadow(0 0 "+pulse.toFixed(1)+"px #7CFC00) drop-shadow(0 0 "+(pulse*1.6).toFixed(1)+"px #39ff14)";ctx.imageSmoothingEnabled=false;}
  if(fr.img.complete&&fr.img.naturalWidth>0){
   /* HI-RES ART: when the source PNG is much larger than the draw size, downscale it SMOOTHLY
      (bilinear/high) to preserve detail; keep the low-res pixel-art fighters crisp (nearest). */
   const drawFr=(FR,al)=>{if(!(FR.img&&FR.img.complete&&FR.img.naturalWidth>0))return;
    const hires=FR.img.naturalWidth>FR.w*2;
    ctx.imageSmoothingEnabled=hires; if(hires)ctx.imageSmoothingQuality="high";
    const oa=ctx.globalAlpha;ctx.globalAlpha=oa*al;
    ctx.drawImage(FR.img,Math.round(-FR.w/2+(FR.dx||0)+lean+edgeShift),Math.round(-FR.h+(FR.foot||0)+bob),FR.w,FR.h);
    ctx.globalAlpha=oa;ctx.imageSmoothingEnabled=false;};
   drawFr(fr,1);
   if(_xfA>0&&_xfPrev)drawFr(_xfPrev,_xfA);   /* SATORI move-transition crossfade: previous pose dissolves out */
  }
  if(toxic)ctx.filter="none";
  /* MASS MORPH: extra churning dough piled around his lower body, hiding his legs inside it */
  if(f.d.id==="necmi"&&f.morph>0){
   const ph=tGlobal*3;
   /* colors matched to Necmi's own dough palette (amber/orange-brown) */
   const cols=["#783000","#904800","#a86000","#c07800","#d89000","#f0a800"];
   /* --- smooth grow-in at the start, shrink-out as the shell fades --- */
   const el=4-f.morph;                          /* seconds since cast */
   const growIn=Math.min(1,el/0.5);             /* 0->1 over first 0.5s */
   const fadeOut=Math.min(1,f.morph/0.5);       /* 1->0 over last 0.5s */
   const grow=Math.min(growIn,fadeOut);         /* eased envelope */
   const ease=grow*grow*(3-2*grow);             /* smoothstep */
   const TOP=S(26)*ease;                         /* pile height rises/falls smoothly */
   const HWb=S(34)*(0.55+0.45*ease);             /* wide base half-width (wide at bottom) */
   ctx.save();ctx.globalAlpha=Math.min(1,ease*1.2);
   /* wide, flat solid base so nothing shows through (widest at the ground) */
   ctx.fillStyle="#a86000";
   ctx.beginPath();ctx.ellipse(0,-S(3),HWb,S(10)*ease+S(3),0,0,6.283);ctx.fill();
   ctx.beginPath();ctx.moveTo(-HWb,-S(3));ctx.lineTo(HWb,-S(3));ctx.lineTo(HWb*0.75,0);ctx.lineTo(-HWb*0.75,0);ctx.closePath();ctx.fill();
   /* churning lumps — width tapers from wide (bottom) to narrow (top) */
   for(let i=0;i<24;i++){
    const u=i/23;                               /* spread index 0..1 */
    const hy=Math.abs(Math.sin(ph*1.6+i*0.9));  /* how high this lump sits (0 bottom .. 1 top) */
    const level=hy*(TOP*0.7);                    /* vertical position */
    const taper=1-(level/(TOP+0.001))*0.80;      /* strongly narrower higher up */
    const px=(u-0.5)*2*HWb*0.95*taper + Math.sin(ph*2+i)*S(2);
    const py=-S(3)-level;
    const rw=(S(8)+Math.sin(ph*1.4+i)*S(2))*(0.7+0.3*taper);
    const rh=S(6)+Math.cos(ph*1.8+i)*S(2);
    ctx.fillStyle=cols[i%cols.length];
    ctx.beginPath();ctx.ellipse(px,py,rw,rh,0,0,6.283);ctx.fill();
   }
   /* narrow rolling crest at the very top */
   for(let i=0;i<7;i++){
    const a=ph*2+i*0.9;
    const px=(i/6-0.5)*2*HWb*0.30;               /* much narrower than the base */
    const py=-TOP*0.82-Math.abs(Math.sin(a))*S(3)*ease;
    ctx.fillStyle=cols[(i+2)%cols.length];
    ctx.beginPath();ctx.ellipse(px,py,S(5),S(4),0,0,6.283);ctx.fill();
   }
   /* swirl seams for the doughy texture */
   ctx.strokeStyle="rgba(90,48,0,.5)";ctx.lineWidth=1;
   for(let i=0;i<6;i++){const a=ph+i*1.1;
    ctx.beginPath();ctx.arc(Math.cos(a)*S(9)+(i-3)*S(4),-S(9)*ease+Math.sin(a)*S(3),S(3.5),0,3.5);ctx.stroke();}
   ctx.restore();
   /* gobs flinging off (only while pile is substantial) */
   if(ease>0.4&&Math.random()<0.5){const g=cols[Math.floor(Math.random()*cols.length)];
    particles.push({x:f.x+rand(-18,18),y:f.y-S(6)+rand(-4,4),vx:rand(-90,90),vy:-rand(20,80),r:rand(1,2.5),col:g,t:0,life:rand(.2,.42),dough:true});}
  }
  ctx.restore();
  if(f.hitFlash>.06){ctx.globalAlpha=.45;ctx.fillStyle="#fff";ctx.fillRect(-14,-70,28,70);ctx.globalAlpha=1;}
  if(EXTRAS[f.d.id]&&(f.d.id==="notalk"||f.d.id==="munevver"||f.d.id==="agron"||f.d.id==="haydar"))EXTRAS[f.d.id](ctx,f,t);
 }else{/* ---- pixel grid fighter ---- */
  const spr=SPRITES[f.d.id],pal=spr.pal,cell=2,rows=spr.g.length;
  const step=(Math.floor(f.walkPhase)%2)?1:-1;
  const lean=attacking?2:(special?1:0);
  for(let r=0;r<rows;r++){const row=spr.g[r];
   for(let c=0;c<16;c++){const ch=row[c];if(ch===".")continue;
    const col=f.hitFlash>.02?"#ffffff":pal[ch];if(!col)continue;
    const mc=f.facing===1?c:15-c;
    let dx=(mc-8)*cell,dy=(r-rows)*cell+bob;
    if(r<19)dx+=lean*f.facing;
    else if(f.state==="walk")dx+=(r>=24?step:-step);
    ctx.fillStyle=col;ctx.fillRect(dx,dy,cell,cell);}}
  if(EXTRAS[f.d.id])EXTRAS[f.d.id](ctx,f,t);
  drawProps(ctx,f,t,attacking,special);
 }
 ctx.restore();
 /* ---- world-space indicators (sprite offsets mapped through S/MZX/MZY) ---- */
 if(f.shield>0){ctx.strokeStyle="rgba(179,107,255,.8)";ctx.lineWidth=1;
  ctx.setLineDash([3,3]);ctx.beginPath();ctx.arc(f.x,f.centerY,S(22),0,7);ctx.stroke();ctx.setLineDash([]);}
 if(f.burn>0&&f.alive){ctx.fillStyle="#f28022";ctx.fillRect(MZX(f,-8*f.facing),MZY(f,66),2,3);ctx.fillStyle="#ffd23f";ctx.fillRect(MZX(f,-8*f.facing),MZY(f,68),2,2);}
 if(f.poison>0&&f.alive){ctx.fillStyle="#9dff5e";ctx.fillRect(MZX(f,6*f.facing),MZY(f,66),2,3);ctx.fillStyle="#d2ff9e";ctx.fillRect(MZX(f,6*f.facing),MZY(f,68),2,2);}
 if(f.bleed>0&&f.alive){ctx.fillStyle="#ff5e6e";ctx.fillRect(f.x-2,MZY(f,67),2,2);ctx.fillRect(f.x-1,MZY(f,65),2,2);}
 if(f.silence>0&&f.alive){ctx.fillStyle="#d8cfc4";ctx.font="6px 'Press Start 2P'";ctx.textAlign="center";ctx.fillText("...",f.x,MZY(f,74));}
 if(f.confuse>0&&f.alive){ctx.fillStyle="#b36bff";ctx.font="7px 'Press Start 2P'";ctx.textAlign="center";
  ctx.fillText("?",f.x+Math.sin(t*6)*6,MZY(f,72));}
 if(f.disarm>0&&f.alive){ctx.strokeStyle="#b36bff";ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(f.x-S(12),MZY(f,72));ctx.lineTo(f.x-S(6),MZY(f,66));
  ctx.moveTo(f.x-S(6),MZY(f,72));ctx.lineTo(f.x-S(12),MZY(f,66));ctx.stroke();}
 if(f.zen>0&&f.alive){ctx.strokeStyle="rgba(125,232,216,"+(.4+.3*Math.sin(t*5))+")";ctx.lineWidth=1;
  ctx.beginPath();ctx.arc(f.x,f.centerY,S(26),0,7);ctx.stroke();}
 if(f.frozen>0){/* sands of time — a horizontal hourglass hovering over the time-frozen foe */
  const hx=Math.round(f.x), hy=Math.round(MZY(f,84)), hw=S(9), hh=S(6);
  ctx.save();ctx.imageSmoothingEnabled=false;
  ctx.fillStyle="rgba(150,225,255,0.5)";                 /* glass bulbs (bowtie = hourglass on its side) */
  ctx.beginPath();ctx.moveTo(hx-hw,hy-hh);ctx.lineTo(hx-hw,hy+hh);ctx.lineTo(hx-1,hy);ctx.closePath();ctx.fill();
  ctx.beginPath();ctx.moveTo(hx+hw,hy-hh);ctx.lineTo(hx+hw,hy+hh);ctx.lineTo(hx+1,hy);ctx.closePath();ctx.fill();
  ctx.strokeStyle="#eaffff";ctx.lineWidth=1;ctx.beginPath();
  ctx.moveTo(hx-hw,hy-hh);ctx.lineTo(hx-1,hy);ctx.lineTo(hx-hw,hy+hh);ctx.moveTo(hx-hw,hy-hh);ctx.lineTo(hx-hw,hy+hh);
  ctx.moveTo(hx+hw,hy-hh);ctx.lineTo(hx+1,hy);ctx.lineTo(hx+hw,hy+hh);ctx.moveTo(hx+hw,hy-hh);ctx.lineTo(hx+hw,hy+hh);
  ctx.stroke();
  const fl=(tGlobal*1.6)%1;                               /* trickling sand */
  ctx.fillStyle="#bfeaff";ctx.fillRect(hx-1,hy-1,2,2);
  ctx.fillStyle="#7fdfff";ctx.fillRect(hx+Math.round(hw*0.35),hy-2+Math.round(fl*4),1,1);
  ctx.fillStyle="#bfeaff";ctx.fillRect(hx+hw-Math.round(S(3)),hy+Math.round(hh*0.3),Math.max(1,Math.round(S(2))),2);
  ctx.restore();}
 /* ASTRAL POSSESSION: the blue spirit clings at the foe's back doing its stuff */
 if(f._possessT>0){const N=IMG_SPRITES.necmi;
  const spr=(N&&N.ghostpossess2&&(Math.sin((f._possessW||0)*1.6)>0))?N.ghostpossess2:(N&&N.ghostpossess);
  if(spr&&spr.img&&spr.img.complete&&spr.img.naturalWidth){
   const w0=f._possessW||0, dir=f._possessDir||1;
   const sx=1+Math.sin(w0)*0.06, sy=1+Math.cos(w0*1.3)*0.06;
   const a=Math.min(1,f._possessT/0.3);
   const gx=f.x+dir*S(30), gy=f.y-S(54);
   ctx.save();ctx.globalCompositeOperation="lighter";
   const gr=ctx.createRadialGradient(gx,gy,3,gx,gy,26);
   gr.addColorStop(0,"rgba(140,180,255,"+(0.5*a)+")");gr.addColorStop(1,"rgba(80,110,220,0)");
   ctx.fillStyle=gr;ctx.beginPath();ctx.arc(gx,gy,26,0,6.283);ctx.fill();
   ctx.restore();
   ctx.save();ctx.globalAlpha=0.92*a;
   ctx.translate(Math.round(gx),Math.round(gy));
   ctx.scale(dir*sx,sy);
   ctx.imageSmoothingEnabled=false;
   ctx.drawImage(spr.img,Math.round(-spr.w/2),Math.round(-spr.h/2),spr.w,spr.h);
   ctx.restore();ctx.globalAlpha=1;}}
 /* LIMB HIJACK swarm: gold creatures clinging around the foe while attacks are disabled */
 if(f._swarmT>0){const N=IMG_SPRITES.necmi;
  const spr=(N&&N.skillB3&&(Math.floor((1.2-f._swarmT)*8)%2))?N.skillB3:(N&&N.hijackswarm);
  if(spr&&spr.img&&spr.img.complete&&spr.img.naturalWidth){
   const w0=f._swarmW||0;
   const sx=1+Math.sin(w0)*0.10, sy=1+Math.cos(w0*1.3)*0.10;    /* blob wobble */
   const a=Math.min(1,f._swarmT/0.25);                          /* fade out at the end */
   ctx.save();ctx.globalAlpha=0.92*a;
   ctx.translate(Math.round(f.x),Math.round(f.y-S(38)));
   ctx.scale(sx,sy);
   ctx.imageSmoothingEnabled=false;
   ctx.drawImage(spr.img,Math.round(-spr.w/2),Math.round(-spr.h/2),spr.w,spr.h);
   ctx.restore();ctx.globalAlpha=1;}}
}
/* =============== HUD / FX DRAW =============== */
/* =============== STATUS EFFECT ICONS ===============
   Every timed effect shows as a coloured chip under the bars with a live
   countdown, and stays up until it actually expires. */
/* Which status-effect timers to show as small icon chips under a fighter's bars, with each one's label/color (see drawStatusRow). */
const STATUS_DEFS=[
 /* debuffs (red-ish) */
 {k:"bleed",    lb:"BLD", col:"#ff5e6e", bg:"#3a0d16", bad:true},
 {k:"burn",     lb:"BRN", col:"#f28022", bg:"#3a1c08", bad:true},
 {k:"poison",   lb:"PSN", col:"#7bd64b", bg:"#16300c", bad:true},
 {k:"stun",     lb:"STN", col:"#ffd23f", bg:"#3a2f08", bad:true},
 {k:"frozen",   lb:"FRZ", col:"#8fd8ff", bg:"#0d2634", bad:true},
 {k:"silence",  lb:"SIL", col:"#d8cfc4", bg:"#2b2822", bad:true},
 {k:"disarm",   lb:"DIS", col:"#c9a06a", bg:"#2e2312", bad:true},
 {k:"confuse",  lb:"CNF", col:"#b36bff", bg:"#26113a", bad:true},
 {k:"weakenT",  lb:"WEK", col:"#a88fd0", bg:"#221a34", bad:true},
 {k:"slowT",    lb:"SLW", col:"#6fa8d8", bg:"#12222e", bad:true},
 {k:"accT",     lb:"MIS", col:"#9d92c2", bg:"#201c30", bad:true},
 {k:"healBlock",lb:"NOH", col:"#ffd76a", bg:"#332a0c", bad:true},
 {k:"overheatDeb",lb:"OVH",col:"#e2384a",bg:"#360c12", bad:true},
 {k:"skillLock",lb:"LCK", col:"#8e83b5", bg:"#1e1a2e", bad:true},
 /* buffs (bright) */
 {k:"regenHoT", lb:"REG", col:"#7dff9e", bg:"#0d2e18"},
 {k:"surge",    lb:"SRG", col:"#ffd23f", bg:"#3a2f08"},
 {k:"zen",      lb:"ZEN", col:"#7de8d8", bg:"#0d2e2b"},
 {k:"morph",    lb:"MRP", col:"#b36bff", bg:"#26113a"},
 {k:"spdBuff",  lb:"SPD", col:"#5fe8e0", bg:"#0d2e2b"},
 {k:"dr",       lb:"DEF", col:"#8fa8bf", bg:"#141c26"},
 {k:"phase",    lb:"PHS", col:"#48c8ff", bg:"#0d2334"},
 {k:"frenzy",   lb:"FRY", col:"#e2384a", bg:"#360c12"},
 {k:"barrierT", lb:"BAR", col:"#5fe8e0", bg:"#0d2e2b"},
];
/* Draws the row of active-status-effect icon chips (stun, burn, buffs, etc.) under one fighter's bars, each with a countdown and drain bar. */
function drawStatusRow(f,bx,bw,flip){
 const act=[];
 for(const d of STATUS_DEFS){
  const v=f[d.k];
  if(typeof v!=="number"||v<=0.05)continue;
  if(!f._stMax)f._stMax={};
  if(!f._stMax[d.k]||v>f._stMax[d.k])f._stMax[d.k]=v;   /* remember peak for the drain bar */
  act.push({d,v,max:f._stMax[d.k]});
 }
 /* forget peaks for effects that have ended */
 if(f._stMax)for(const k in f._stMax){ if(!(typeof f[k]==="number"&&f[k]>0.05))delete f._stMax[k]; }
 if(!act.length)return;
 const CW=34,CH=17,GAP=3,Y=f.d.id==="agron"?54:52;
 const perRow=Math.max(1,Math.floor((bw+GAP)/(CW+GAP)));
 act.slice(0,perRow*2).forEach((it,i)=>{
  const row=Math.floor(i/perRow), col=i%perRow;
  const x=flip? bx+bw-CW-col*(CW+GAP) : bx+col*(CW+GAP);
  const y=Y+row*(CH+GAP);
  const expiring=it.v<=1.5&&Math.sin(tGlobal*14)>0;
  /* frame */
  ctx.fillStyle="#000";ctx.fillRect(x-1,y-1,CW+2,CH+2);
  ctx.fillStyle=it.d.bg;ctx.fillRect(x,y,CW,CH);
  /* coloured left tab so the type reads at a glance */
  ctx.fillStyle=expiring?"#fff":it.d.col;
  ctx.fillRect(x,y,3,CH);
  /* label — 6px, full width available */
  ctx.fillStyle=expiring?"#fff":it.d.col;
  ctx.font="6px 'Press Start 2P'";ctx.textAlign="left";ctx.textBaseline="alphabetic";
  ctx.fillText(it.d.lb,x+5,y+8);
  /* countdown */
  ctx.fillStyle="#efe6d2";ctx.font="6px 'Press Start 2P'";ctx.textAlign="right";
  ctx.fillText(it.v>=10?Math.ceil(it.v)+"":it.v.toFixed(1),x+CW-2,y+8);
  /* duration drain bar along the bottom */
  const frac=Math.max(0,Math.min(1,it.v/Math.max(0.001,it.max)));
  ctx.fillStyle="#000";ctx.fillRect(x+3,y+CH-4,CW-4,3);
  ctx.fillStyle=expiring?"#fff":it.d.col;
  ctx.fillRect(x+3,y+CH-4,Math.round((CW-4)*frac),3);
 });
 ctx.textAlign=flip?"right":"left";
}
/* Draws the whole combat HUD for both fighters: HP/Armor/Energy bars (the energy bar glows when the ult is ready), status chips, ability-cooldown icons, round-win pips, and the center timer. */
function drawHUD(){
 const bw=Math.min(230,Math.round(W*0.30));   /* bars grow with the viewport */
 [[fighters[0],12,false],[fighters[1],W-12-bw,true]].forEach(([f,bx,flip])=>{
  const L=x=>flip?bx+bw-x:bx;
  /* ---- slim MK-style gold-framed bars ---- */
  const FRAME="#120b04";
  /* HEALTH: green fill, dark-red depletion, gloss + shade */
  const hpY=8,hpH=5;
  ctx.fillStyle=FRAME;ctx.fillRect(bx-2,hpY-2,bw+4,hpH+4);
  ctx.fillStyle="#7c5a1c";ctx.fillRect(bx-1,hpY-1,bw+2,hpH+2);                       /* gold rim */
  ctx.fillStyle="#3a1216";ctx.fillRect(bx,hpY,bw,hpH);                               /* empty = dark red */
  const pct=Math.max(0,f.hp/f.maxhp),wpx=Math.round(bw*pct),lowHP=pct<=.22;
  ctx.fillStyle=lowHP?((SETTINGS_reducedFlashing()||Math.sin(tGlobal*9)>0)?"#ff6a3a":"#c23a1e"):(pct<=.5?"#7fe06a":"#3fd85e");
  ctx.fillRect(flip?bx+bw-wpx:bx,hpY,wpx,hpH);
  ctx.fillStyle="rgba(255,255,255,.32)";ctx.fillRect(flip?bx+bw-wpx:bx,hpY,wpx,2);   /* top gloss */
  ctx.fillStyle="rgba(0,0,0,.30)";ctx.fillRect(flip?bx+bw-wpx:bx,hpY+hpH-1,wpx,1);   /* bottom shade */
  /* BLOCK BAR (armor) — thin steel line; red when the guard is broken */
  const abY=hpY+hpH+2;
  ctx.fillStyle=FRAME;ctx.fillRect(bx-1,abY-1,bw+2,4);
  ctx.fillStyle="#0e141c";ctx.fillRect(bx,abY,bw,2);
  const apx=Math.round(bw*Math.max(0,f.armor)/f.maxArmor);
  ctx.fillStyle=f.guardBroken?"#e2384a":"#7fb0d8";ctx.fillRect(flip?bx+bw-apx:bx,abY,apx,2);
  /* BARRIER (point shield, situational) */
  let enY=abY+4;
  if(f.barrier>0){const bpx=Math.round(bw*Math.min(1,f.barrier/150));
   ctx.fillStyle=FRAME;ctx.fillRect(bx-1,enY-1,bw+2,3);
   ctx.fillStyle="#5fe8e0";ctx.fillRect(flip?bx+bw-bpx:bx,enY,bpx,1);enY+=2;}
  /* ENERGY / ULT meter — thin gold */
  ctx.fillStyle=FRAME;ctx.fillRect(bx-1,enY-1,bw+2,5);
  ctx.fillStyle="#2a1e08";ctx.fillRect(bx,enY,bw,3);
  const mpx=Math.round(bw*Math.min(100,f.meter)/100);
  ctx.fillStyle=f.meter>=100?((SETTINGS_reducedFlashing()||Math.sin(tGlobal*8)>0)?"#ffd23f":"#fff3c0"):"#c9962b";
  ctx.fillRect(flip?bx+bw-mpx:bx,enY,mpx,3);
  ctx.fillStyle="rgba(255,255,255,.22)";ctx.fillRect(flip?bx+bw-mpx:bx,enY,mpx,1);   /* gloss */
  if(f.meter>=100){                                                                  /* ULT READY -> the whole bar glows/pulses */
   const gl=SETTINGS_reducedFlashing()?0.8:(0.45+0.55*(0.5+0.5*Math.sin(tGlobal*6)));
   ctx.save();ctx.globalCompositeOperation="lighter";ctx.globalAlpha=0.55*gl;
   ctx.fillStyle="#ffe27a";ctx.fillRect(bx-1,enY-2,bw+2,7);ctx.restore();
  }
  /* name (optional P1/P2/CPU identifier) */
  ctx.fillStyle="#efe6d2";ctx.font="6px 'Press Start 2P'";ctx.textAlign=flip?"right":"left";
  const who=f.ctrl==="p1"?"P1 ":(f.ctrl==="cpu"?"CPU ":"P2 ");
  const nm=(SETTINGS_playerLabels()?who:"")+f.d.name.toUpperCase();
  ctx.fillText(nm.slice(0,22),flip?bx+bw:bx,31);
  /* ability slots (compact) */
  const labels=AB_LABELS[f.ctrl]||AB_LABELS.p2;
  for(let i=0;i<3;i++){
   const sw=9,sh=8,sx=flip?bx+bw-sw-i*(sw+2):bx+i*(sw+2),sy=34;
   const ab=f.d.ab[i],ready=f.cd[i]<=0&&f.silence<=0&&f.skillLock<=0;
   ctx.fillStyle="#000";ctx.fillRect(sx-1,sy-1,sw+2,sh+2);
   ctx.fillStyle=ready?"#f2b632":"#3a3352";ctx.fillRect(sx,sy,sw,sh);
   if(f.cd[i]>0){const frac=Math.min(1,f.cd[i]/ab.cd);
    ctx.fillStyle="rgba(0,0,0,.55)";ctx.fillRect(sx,sy,sw,Math.round(sh*frac));}
   ctx.fillStyle=ready?"#221500":"#8e83b5";ctx.font="5px 'Press Start 2P'";ctx.textAlign="center";
   ctx.fillText(labels[i],sx+sw/2,sy+6);}
  /* CALCULATION MARKS (Münevver) — visible stack bar */
  if(f.d.id==="munevver"){
   for(let i2=0;i2<3;i2++){
    const mx=flip?bx+bw-10-i2*13:bx+2+i2*13,my=45;
    const on=i2<f.marks,readyAll=f.marks>=3;
    ctx.fillStyle="#000";ctx.fillRect(mx-1,my-1,10,7);
    ctx.fillStyle=on?(readyAll&&Math.sin(tGlobal*8)>0?"#eaffff":"#5fe8e0"):"#243244";
    ctx.fillRect(mx,my,8,5);}
   if(f.marks>=3){ctx.fillStyle="#5fe8e0";ctx.font="5px 'Press Start 2P'";ctx.textAlign=flip?"right":"left";
    ctx.fillText("CALCULATED",flip?bx+bw-42:bx+42,51);}
  }
  /* WINGS (Agron) — compact flight fuel meter */
  if(f.d.id==="agron"){
   const FULL=4, ww=Math.round(bw*0.34), wh=3, wy=44;   /* ~1/3 width, 3px tall */
   const wx=flip?bx+bw-ww:bx;
   ctx.fillStyle="#000";ctx.fillRect(wx-1,wy-1,ww+2,wh+2);
   ctx.fillStyle="#1a0d12";ctx.fillRect(wx,wy,ww,wh);
   let frac, col;
   if(f.flyCd>0){                       /* spent — locked out while it recharges */
    frac=1-(f.flyCd/8);
    col=Math.sin(tGlobal*6)>0?"#6b2028":"#4a161d";
   }else{
    frac=Math.max(0,Math.min(1,f.flyT/FULL));
    col=f.flying?(Math.sin(tGlobal*14)>0?"#ff8f9e":"#e2384a")
       :(frac>=1?"#e2384a":"#a82634");
   }
   const wpx2=Math.round(ww*frac);
   ctx.fillStyle=col;ctx.fillRect(flip?wx+ww-wpx2:wx,wy,wpx2,wh);
   /* tiny readout beside the meter, not under it */
   ctx.font="4px 'Press Start 2P'";ctx.textAlign=flip?"right":"left";
   ctx.fillStyle=f.flyCd>0?"#8e6068":(f.flying?"#ff8f9e":"#a8788a");
   const tx=flip?wx-3:wx+ww+3;
   ctx.fillText(f.flyCd>0?("WINGS "+f.flyCd.toFixed(1)):(f.flying?("FLY "+f.flyT.toFixed(1)):("WINGS "+f.flyT.toFixed(1))),tx,wy+3.5);
  }
  /* STRENGTH STACKS (No-Talking Man) — always-visible stack pips */
  if(f.d.id==="notalk"){
   for(let i2=0;i2<3;i2++){
    const mx=flip?bx+bw-10-i2*13:bx+2+i2*13,my=45;
    const on=i2<f.strStacks,full=f.strStacks>=3;
    ctx.fillStyle="#000";ctx.fillRect(mx-1,my-1,10,7);
    ctx.fillStyle=on?(full&&Math.sin(tGlobal*8)>0?"#d8ccff":"#8f6cf0"):"#241f38";
    ctx.fillRect(mx,my,8,5);}
   ctx.fillStyle=f.strStacks>=3?"#d8ccff":"#8f6cf0";
   ctx.font="5px 'Press Start 2P'";ctx.textAlign=flip?"right":"left";
   ctx.fillText(f.strStacks>=3?"MAX STR":"STR "+f.strStacks+"/3",flip?bx+bw-42:bx+42,51);
  }
  /* resource bar: HEAT (ember) / CHI (akira) */
  if(f.d.id==="ember"||f.d.id==="akira"){
   const val=f.d.id==="ember"?f.heat:f.chi;
   ctx.fillStyle="#000";ctx.fillRect(bx-2,45,bw+4,5);
   ctx.fillStyle="#1c1626";ctx.fillRect(bx,46,bw,3);
   const rpx=Math.round(bw*val/100);
   ctx.fillStyle=f.d.id==="ember"?(f.heat>=80?"#e2384a":f.heat>=50?"#f28022":"#a85a20"):"#3fd8c7";
   ctx.fillRect(flip?bx+bw-rpx:bx,46,rpx,3);
   const mk=f.d.id==="ember"?[.5,.8]:[.5];
   ctx.fillStyle="#efe6d2";
   for(const mfrac of mk){const mx2=flip?bx+bw-Math.round(bw*mfrac):bx+Math.round(bw*mfrac);ctx.fillRect(mx2,45,1,5);}
  }
  /* round-win pips — small round dots up near the bars, on the inner side (toward the centre timer) */
  for(let i=0;i<2;i++){
   const pcx=flip?bx+6+i*7:bx+bw-6-i*7, pcy=29, won=i<f.wins;
   ctx.fillStyle=won?"#f2b632":"#3a3352";
   ctx.beginPath();ctx.arc(pcx,pcy,2.2,0,7);ctx.fill();
   if(won){ctx.fillStyle="rgba(255,244,190,.55)";ctx.beginPath();ctx.arc(pcx-0.7,pcy-0.7,1,0,7);ctx.fill();}
  }
  /* (no "ULT READY" text — the energy bar itself glows when the ult is ready) */
  ctx.textAlign=flip?"right":"left";
  drawStatusRow(f,bx,bw,flip);
 });
 ctx.fillStyle="#000";ctx.fillRect(W/2-18,8,36,18);
 const finiteTime=Number.isFinite(timer);
 ctx.fillStyle=(finiteTime&&timer<=10)?"#e2384a":"#efe6d2";ctx.font="10px 'Press Start 2P'";ctx.textAlign="center";
 ctx.fillText(finiteTime?(""+Math.ceil(timer)):"∞",W/2,22);
 ctx.fillStyle="#8e83b5";ctx.font="5px 'Press Start 2P'";
 ctx.fillText(STAGES[stageId].name,W/2,32);
 if(cpuDiff===3){ctx.fillStyle=(SETTINGS_reducedFlashing()||Math.sin(tGlobal*4)>0)?"#7de8c7":"#4fb89a";ctx.font="5px 'Press Start 2P'";
  ctx.fillText("PRACTICE MODE",W/2,40);}
}
/* Draws every live projectile/spirit (bullets, shuriken, Necmi's ghost, grenades, etc.), each with its own trail/spin/glow treatment by type. */
/* The crouch-C mine + its eruption are ground objects — drawn at the FIGHTER layer (see drawMines), not
   on top with the other projectiles; skip them here. */
function drawMines(){
 for(const p of projectiles){
  const PUSH=8;   /* nudge the whole thing a little further down onto the floor */
  if(p.type==="sattrap"){/* planted spike mine — small, ping-pong 1->2->3->2 (i.e. 1-3 then 3-1). Same ground line as the eruption. */
   const d=PROJ_IMGS["mineg"+[1,2,3,2][Math.floor((p.age||0)/0.16)%4]], SZ=120;
   if(d&&d.img&&d.img.complete&&d.img.naturalWidth>0){
    ctx.save();ctx.shadowColor="#ff2a3a";ctx.shadowBlur=6;
    ctx.drawImage(d.img,Math.round(p.x-SZ/2),Math.round(GROUND-(610/642)*SZ+PUSH),SZ,SZ);ctx.restore();
   }else{ctx.fillStyle="#e2384a";ctx.fillRect(p.x-4,GROUND-6,8,6);}
   if(Math.random()<0.4){/* little red electricity crackling inside the trap */
    ctx.save();ctx.globalAlpha=0.9;ctx.lineCap="round";ctx.shadowColor="#ff2a3a";ctx.shadowBlur=5;
    ctx.strokeStyle=Math.random()<0.5?"#ff5a68":"#ffe0e4";ctx.lineWidth=1;
    let px=p.x+rand(-8,8),py=GROUND-rand(1,7)+PUSH;ctx.beginPath();ctx.moveTo(px,py);
    const seg=2+Math.floor(rand(0,2));for(let s=0;s<seg;s++){px+=rand(-5,5);py-=rand(2,6);ctx.lineTo(px,py);}
    ctx.stroke();ctx.restore();}
  }else if(p.type==="satmineexp"){/* mine eruption — 6-frame one-shot (minex0 lead-in .. minex5); smaller SZ, SAME ground line */
   const fi=Math.min(5,Math.floor((p.age||0)/0.065)), d=PROJ_IMGS["minex"+fi], SZ=74;
   if(d&&d.img&&d.img.complete&&d.img.naturalWidth>0){
    ctx.save();ctx.shadowColor="#ff2a3a";ctx.shadowBlur=15;
    ctx.drawImage(d.img,Math.round(p.x-SZ/2),Math.round(GROUND-(610/642)*SZ+PUSH),SZ,SZ);ctx.restore();
   }
  }
 }
}
function drawProjectiles(){
 for(const p of projectiles){
  if(p.type==="sattrap"||p.type==="satmineexp")continue;   /* drawn in drawMines (fighter layer) instead */
  if(p.type==="ghost"){
   const N=IMG_SPRITES.necmi;
   const spr=(N&&N.ghostfly2&&(Math.sin((p.wob||0)*1.4)>0))?N.ghostfly2:(N&&N.ghostfly);
   const w0=p.wob||0, dir=p.dir||1;
   const sx=1+Math.sin(w0)*0.08, sy=1+Math.cos(w0*1.2)*0.08;
   /* bright blue glow so the spirit reads clearly */
   ctx.save();ctx.globalCompositeOperation="lighter";
   const gr=ctx.createRadialGradient(p.x,p.y,2,p.x,p.y,26);
   gr.addColorStop(0,"rgba(140,180,255,.55)");gr.addColorStop(1,"rgba(80,110,220,0)");
   ctx.fillStyle=gr;ctx.beginPath();ctx.arc(p.x,p.y,26,0,6.283);ctx.fill();
   ctx.restore();
   ctx.save();ctx.globalAlpha=0.95;ctx.translate(p.x,p.y);ctx.scale(dir*sx,sy);
   if(spr&&spr.img&&spr.img.complete&&spr.img.naturalWidth){
    ctx.drawImage(spr.img,-spr.w/2,-spr.h/2,spr.w,spr.h);
   }else{ctx.fillStyle="#6b8cff";ctx.beginPath();ctx.ellipse(0,0,10,7,0,0,6.283);ctx.fill();}
   ctx.restore();ctx.globalAlpha=1;
  }
  else if(p.type==="spike"){const d=Math.sign(p.vx);
   ctx.fillStyle="#8a1020";ctx.fillRect(p.x-d*4-2,p.y-2,4,4);
   ctx.fillStyle=p.col;ctx.fillRect(p.x-2,p.y-2,4,4);ctx.fillRect(p.x+d*3-1,p.y-1,2,2);
  }else if(p.type==="xslash"){const d=Math.sign(p.vx);
   const fx=FX_IMGS.xslash;
   const ready=fx&&fx.img&&fx.img.complete&&fx.img.naturalWidth>0;
   ctx.save();ctx.translate(p.x,p.y);if(d<0)ctx.scale(-1,1);
   ctx.imageSmoothingEnabled=false;
   if(ready){
    const w=S(fx.w),h=S(fx.h);
    /* trailing after-images */
    for(let k=2;k>=1;k--){ctx.globalAlpha=.18*k;
     ctx.drawImage(fx.img,Math.round(-w/2-k*7),Math.round(-h/2),Math.round(w),Math.round(h));}
    ctx.globalAlpha=1;
    ctx.drawImage(fx.img,Math.round(-w/2),Math.round(-h/2),Math.round(w),Math.round(h));
   }else{
    /* fallback so the ult still reads if the art hasn't loaded */
    ctx.globalAlpha=1;ctx.fillStyle=p.col||"#e2384a";
    ctx.fillRect(-S(10),-S(2),S(20),S(4));ctx.fillRect(-S(2),-S(10),S(4),S(20));
   }
   ctx.globalAlpha=1;
   ctx.restore();
  }else if(p.type==="bullet"){const d=Math.sign(p.vx);
   ctx.fillStyle="rgba(255,210,63,.4)";ctx.fillRect(p.x-d*8,p.y-1,8,2);
   ctx.fillStyle=p.col;ctx.fillRect(p.x-1,p.y-1,3,2);
  }else if(p.type==="grenade"){
   ctx.fillStyle="#5b6b3a";ctx.fillRect(p.x-3,p.y-4,6,8);
   ctx.fillStyle=p.col;ctx.fillRect(p.x-2,p.y-3,4,3);
   ctx.fillStyle=Math.sin(tGlobal*20)>0?"#ffd23f":"#e2384a";ctx.fillRect(p.x-1,p.y-6,2,2);
  }else if(p.type==="rocket"){
   const d=PROJ_IMGS.rocket,dir=Math.sign(p.vx)||1;
   if(d&&d.img.complete&&d.img.naturalWidth>0){
    ctx.save();ctx.imageSmoothingEnabled=false;ctx.translate(Math.round(p.x),Math.round(p.y));
    if(dir<0)ctx.scale(-1,1);
    ctx.drawImage(d.img,-Math.round(d.w/2),-Math.round(d.h/2),d.w,d.h);ctx.restore();
   }else{ctx.fillStyle=p.col||"#f28022";ctx.fillRect(p.x-6,p.y-2,12,4);}
  }else if(p.type==="smg"){const d=Math.sign(p.vx);
   ctx.fillStyle="rgba(159,184,201,.4)";ctx.fillRect(p.x-d*7,p.y-1,7,2);
   ctx.fillStyle="#dfe8f0";ctx.fillRect(p.x-1,p.y-1,3,2);
  }else if(p.type==="shadow"){const d=Math.sign(p.vx);
   ctx.fillStyle="rgba(74,61,107,.45)";ctx.fillRect(p.x-d*12,p.y-5,12,10);
   ctx.fillStyle="#4a3d6b";ctx.fillRect(p.x-5,p.y-6,10,12);
   ctx.fillStyle="#8f6cf0";ctx.fillRect(p.x+d*2-1,p.y-3,3,6);
  }else if(p.type==="prime"){
   const g2=p.glyph||"7";
   ctx.font="9px 'Press Start 2P'";ctx.textAlign="center";
   ctx.fillStyle="rgba(95,232,224,.30)";
   ctx.fillText(g2,p.x-Math.sign(p.vx)*7,p.y+4);
   ctx.fillStyle="rgba(95,232,224,.45)";
   ctx.fillText(g2,p.x-1,p.y+4);ctx.fillText(g2,p.x+1,p.y+4);
   ctx.fillText(g2,p.x,p.y+3);ctx.fillText(g2,p.x,p.y+5);
   ctx.fillStyle=Math.sin(tGlobal*14)>0?"#eaffff":"#bfeff2";
   ctx.fillText(g2,p.x,p.y+4);
  }else if(p.type==="spikeimg"){
   const d=PROJ_IMGS.spike;
   if(d&&d.img.complete&&d.img.naturalWidth>0){
    ctx.save();ctx.translate(Math.round(p.x),Math.round(p.y));
    if(Math.sign(p.vx)<0)ctx.scale(-1,1);
    ctx.rotate(Math.sin(tGlobal*10+p.x)*0.06);
    ctx.drawImage(d.img,-Math.round(d.w/2),-Math.round(d.h/2),d.w,d.h);ctx.restore();
   }else{ctx.fillStyle=p.col;ctx.fillRect(p.x-5,p.y-2,10,4);}
  }else if(p.type==="shurimg"){
   const d=PROJ_IMGS.shuriken;
   if(d&&d.img.complete&&d.img.naturalWidth>0){
    ctx.save();ctx.translate(Math.round(p.x),Math.round(p.y));
    ctx.rotate(tGlobal*16*Math.sign(p.vx));
    ctx.drawImage(d.img,-Math.round(d.w/2),-Math.round(d.h/2),d.w,d.h);ctx.restore();
   }else{ctx.fillStyle=p.col;ctx.fillRect(p.x-3,p.y-1,6,2);ctx.fillRect(p.x-1,p.y-3,2,6);}
  }else if(p.type==="satp"&&p.saw){/* GROUND SAW: buzz-wheel, ~1/4 sunk into the floor (clipped at the ground line) */
   const d=PROJ_IMGS.shuriken, sc=6.3, dw=Math.round(d.w*sc), dh=Math.round(d.h*sc);
   /* Blade art occupies canvas x246..427 / y230..418 of 642 -> its CENTER is (336.5,324), NOT the canvas
      centre. Rotate about the blade centre (offset ox/oy) so it spins in place instead of orbiting (bouncing). */
   const ox=-Math.round(336.5/642*dw), oy=-Math.round(324/642*dh);
   const half=94/642*dh;   /* blade half-height (canvas 94px of 188) */
   const cy=Math.round(GROUND-(half-0.25*2*half));   /* sink exactly 1/4 of the blade below the ground line */
   ctx.save();
   ctx.beginPath();ctx.rect(-100000,-100000,200000,GROUND+100000);ctx.clip();   /* hide everything below the ground line */
   ctx.translate(Math.round(p.x),cy);
   ctx.shadowColor="#ff2a3a";ctx.shadowBlur=18;
   ctx.rotate(p.sawAng||0);ctx.scale(-1,1);   /* mirror the blade (flip) — spin direction preserved */
   if(d&&d.img.complete&&d.img.naturalWidth>0){ctx.drawImage(d.img,ox,oy,dw,dh);ctx.shadowBlur=10;ctx.drawImage(d.img,ox,oy,dw,dh);}
   else{ctx.fillStyle="#ff4a5a";ctx.fillRect(-Math.round(dw/2),-3,dw,6);ctx.fillRect(-3,-Math.round(dh/2),6,dh);}
   ctx.restore();
  }else if(p.type==="satp"){
   const d=(p.shape==="shuriken")?PROJ_IMGS.shuriken:PROJ_IMGS.spike;
   const sc=(p.shape==="shuriken")?2.0:1.9;   /* bigger, hand-thrown shurikens + spikes */
   if(d&&d.img.complete&&d.img.naturalWidth>0){
    const dw=Math.round(d.w*sc),dh=Math.round(d.h*sc);
    ctx.save();ctx.translate(Math.round(p.x),Math.round(p.y));
    ctx.shadowColor="#ff2a3a";ctx.shadowBlur=14;   /* red glow — shurikens AND spikes */
    if(p.shape==="shuriken")ctx.rotate(tGlobal*16*Math.sign(p.vx));
    else ctx.rotate(Math.atan2(p.vy||0,p.vx||1));
    ctx.drawImage(d.img,-Math.round(dw/2),-Math.round(dh/2),dw,dh);
    ctx.shadowBlur=8;ctx.drawImage(d.img,-Math.round(dw/2),-Math.round(dh/2),dw,dh);   /* second pass deepens the glow */
    ctx.restore();
   }else{ctx.fillStyle=p.col||"#ff4a5a";ctx.fillRect(p.x-5,p.y-2,10,4);ctx.fillRect(p.x-2,p.y-5,4,10);}
  }else if(p.type==="satcspike"){/* thrown crouch-C spike: 4-frame animation, oriented along its arc */
   const d=PROJ_IMGS["cspike"+(1+(Math.floor((p.age||0)/0.06)%4))], SZ=92;
   ctx.save();ctx.translate(Math.round(p.x),Math.round(p.y));
   ctx.rotate(Math.atan2(p.vy||0,p.vx||0.0001)+Math.PI/2);   /* the vertical blade aligns with its velocity */
   ctx.shadowColor="#ff2a3a";ctx.shadowBlur=12;
   if(d&&d.img&&d.img.complete&&d.img.naturalWidth>0)ctx.drawImage(d.img,-SZ/2,-SZ/2,SZ,SZ);
   else{ctx.fillStyle="#e2384a";ctx.fillRect(-3,-SZ/2,6,SZ);}
   ctx.restore();
  }else if(p.type==="satult"){
   const d=PROJ_IMGS.spike;
   ctx.save();ctx.translate(Math.round(p.x),Math.round(p.y));ctx.rotate(Math.atan2(p.vy||0,p.vx||1));
   ctx.shadowColor="#e2384a";ctx.shadowBlur=10;
   if(d&&d.img.complete&&d.img.naturalWidth>0)ctx.drawImage(d.img,-Math.round(d.w*0.9),-Math.round(d.h*0.9),Math.round(d.w*1.8),Math.round(d.h*1.8));
   else{ctx.fillStyle="#e2384a";ctx.fillRect(-11,-3,22,6);ctx.fillStyle="#ff8fa0";ctx.fillRect(5,-2,8,4);}
   ctx.restore();
  }else if(p.type==="shur"){const d=Math.sign(p.vx);
   ctx.fillStyle=p.col;ctx.fillRect(p.x-2,p.y-1,4,2);ctx.fillRect(p.x-1,p.y-2,2,4);
   ctx.fillStyle="#ffb0ba";ctx.fillRect(p.x+d-1,p.y-1,2,2);
  }else if(p.type==="chi"){
   ctx.fillStyle="rgba(125,232,216,.35)";ctx.fillRect(p.x-10,p.y-10,20,20);
   ctx.fillStyle=p.col;ctx.fillRect(p.x-6,p.y-6,12,12);
   ctx.fillStyle="#e8fffa";ctx.fillRect(p.x-3,p.y-3,5,5);
  }else if(p.type==="pinch"){
   /* PINCH-MASS: dough-blob sprite that wobbles/squashes as it flies + repeating MINCIK bubble */
   const spr=(IMG_SPRITES.necmi&&IMG_SPRITES.necmi.pinchmass)?IMG_SPRITES.necmi.pinchmass:null;
   const dir=Math.sign(p.vx)||1, w0=p.wob||0;
   const sx=1+Math.sin(w0)*0.16, sy=1+Math.cos(w0*1.3)*0.16;   /* jelly squash-stretch */
   ctx.save();ctx.translate(p.x,p.y);ctx.rotate(Math.sin(w0*0.7)*0.12);ctx.scale(dir*sx,sy);
   if(spr&&spr.img&&spr.img.complete&&spr.img.naturalWidth){
    const dw=spr.w, dh=spr.h;
    ctx.drawImage(spr.img,-dw/2,-dh/2,dw,dh);          /* just the dough blob — no glow */
   }else{
    ctx.fillStyle="#e8b52e";ctx.beginPath();ctx.ellipse(0,0,9,7,0,0,6.283);ctx.fill();
    ctx.fillStyle="#b8801a";ctx.fillRect(-2,-1,4,3);
   }
   ctx.restore();
   /* MINCIK speech bubble, pops repeatedly until impact */
   if(p.mincShow>0){
    const bx=p.x, by=p.y-16, tw=28, th=12;
    const pop=Math.min(1,(0.45-p.mincShow)/0.12);          /* quick grow-in */
    const s=0.7+0.3*pop;
    ctx.save();ctx.translate(bx,by);ctx.scale(s,s);
    ctx.fillStyle="rgba(255,255,255,.95)";ctx.strokeStyle="#6b3fb0";ctx.lineWidth=1.5;
    if(ctx.roundRect){ctx.beginPath();ctx.roundRect(-tw/2,-th/2,tw,th,4);ctx.fill();ctx.stroke();}
    else{ctx.fillRect(-tw/2,-th/2,tw,th);ctx.strokeRect(-tw/2,-th/2,tw,th);}
    /* bubble tail */
    ctx.beginPath();ctx.moveTo(-3,th/2-1);ctx.lineTo(0,th/2+5);ctx.lineTo(4,th/2-1);ctx.closePath();
    ctx.fillStyle="rgba(255,255,255,.95)";ctx.fill();ctx.stroke();
    ctx.fillStyle="#6b3fb0";ctx.font="bold 9px monospace";ctx.textAlign="center";ctx.textBaseline="middle";
    ctx.fillText("MINCIK",0,0);
    ctx.restore();
   }
  }else if(p.type==="hijack"){
   /* LIMB HIJACK: gold creature that scrambles along the ground with a walking blob wobble */
   const S3=IMG_SPRITES.necmi;const dir=Math.sign(p.vx)||1, w0=p.wob||0;
   /* cycle the 3 walk frames for a stride */
   const wf=[S3&&S3.hijackwalker,S3&&S3.hijackwalker2,S3&&S3.hijackwalker3].filter(Boolean);
   const spr=wf.length?wf[Math.floor(w0/1.1)%wf.length]:null;
   const bob=Math.abs(Math.sin(w0*0.9))*1.5;               /* little hop as it walks */
   const sx=1+Math.sin(w0)*0.08, sy=1+Math.cos(w0*1.4)*0.09;  /* subtle blob squash */
   ctx.save();ctx.translate(p.x,GROUND-bob);ctx.scale(dir*sx,sy);
   if(spr&&spr.img&&spr.img.complete&&spr.img.naturalWidth){
    ctx.drawImage(spr.img,-spr.w/2,-spr.h,spr.w,spr.h);      /* feet on the ground line */
   }else{ctx.fillStyle="#e8b52e";ctx.beginPath();ctx.ellipse(0,-6,10,6,0,0,6.283);ctx.fill();}
   ctx.restore();
   /* "AW AW AW" speech bubble above the walker */
   if(p.awShow>0){
    const bx=p.x, by=GROUND-bob-((IMG_SPRITES.necmi&&IMG_SPRITES.necmi.hijackwalker?IMG_SPRITES.necmi.hijackwalker.h:26))-8;
    const tw=34, th=12;
    const pop=Math.min(1,(0.34-p.awShow)/0.10);
    const s=0.7+0.3*pop;
    ctx.save();ctx.translate(bx,by);ctx.scale(s,s);
    ctx.fillStyle="rgba(255,255,255,.95)";ctx.strokeStyle="#6b3fb0";ctx.lineWidth=1.5;
    if(ctx.roundRect){ctx.beginPath();ctx.roundRect(-tw/2,-th/2,tw,th,4);ctx.fill();ctx.stroke();}
    else{ctx.fillRect(-tw/2,-th/2,tw,th);ctx.strokeRect(-tw/2,-th/2,tw,th);}
    ctx.beginPath();ctx.moveTo(-3,th/2-1);ctx.lineTo(0,th/2+5);ctx.lineTo(4,th/2-1);ctx.closePath();
    ctx.fillStyle="rgba(255,255,255,.95)";ctx.fill();ctx.stroke();
    ctx.fillStyle="#6b3fb0";ctx.font="bold 8px monospace";ctx.textAlign="center";ctx.textBaseline="middle";
    ctx.fillText("AW AW AW",0,0);
    ctx.restore();
   }
  }else{ctx.fillStyle="rgba(179,107,255,.35)";ctx.fillRect(p.x-7,p.y-7,14,14);
   ctx.fillStyle=p.col;ctx.fillRect(p.x-4,p.y-4,8,8);
   ctx.fillStyle="#e8d2ff";ctx.fillRect(p.x-2,p.y-2,3,3);}
 }
}
/* Draws Munevver's CODEX ult in flight: numbers streaming from her book into an orbiting ring around the target, collapsing inward as it resolves. */
function drawCodexes(t){
 for(const c of codexes){
  const foe=c.target;
  const collapse=Math.max(0,Math.min(1,(c.dur-c.t)/0.35)); /* shrinks in the last 0.35s */
  const rMul=collapse<1?collapse:1;
  /* ground calculation circle — fades in as the numbers arrive */
  const arrived=Math.max(0,Math.min(1,(c.t-(c.lead||0)*0.5)/((c.lead||0.7)*0.5)));
  ctx.save();
  ctx.globalAlpha=(.5+.3*Math.sin(t*6))*arrived;
  ctx.strokeStyle="#5fe8e0";ctx.lineWidth=1;
  ctx.beginPath();ctx.ellipse(foe.x,GROUND+2,38*rMul,7*rMul,0,0,7);ctx.stroke();
  ctx.globalAlpha=.25*arrived;
  ctx.beginPath();ctx.ellipse(foe.x,GROUND+2,26*rMul,5*rMul,0,0,7);ctx.stroke();
  ctx.restore();
  /* numbers: stream OUT of her book, fly to the foe, THEN orbit as usual */
  for(const g of c.glyphs){
   const depth=Math.sin(g.a);
   /* the orbit position this glyph is heading for / sitting at */
   const ox=foe.x+Math.cos(g.a)*g.r*rMul;
   const oy=foe.centerY+g.h*(.4+.6*rMul);
   let gx=ox, gy=oy, trail=0;
   if(g.delay!==undefined){
    const local=c.t-g.delay;              /* time since THIS glyph left the book */
    if(local<0) continue;                 /* not emitted yet */
    if(local<g.fly){                       /* flying from book -> orbit */
     const u=local/g.fly;
     const e=u*u*(3-2*u);                  /* smoothstep ease */
     /* arc the path slightly upward so it sweeps rather than beelines */
     const ax=g.bx+(ox-g.bx)*e;
     const ay=g.by+(oy-g.by)*e - Math.sin(u*Math.PI)*S(14);
     gx=ax; gy=ay; trail=1-u;             /* longer streak early in the flight */
    }
   }
   const flick=.45+.45*Math.sin(t*5+g.ph);
   ctx.font=g.sz+"px 'Press Start 2P'";ctx.textAlign="center";
   /* motion streak while flying in */
   if(trail>0.05){
    ctx.globalAlpha=trail*.5;
    ctx.fillStyle="rgba(143,216,255,.6)";
    const dxs=(gx-ox), dys=(gy-oy);
    for(let k=1;k<=3;k++){
     ctx.globalAlpha=trail*(.4/k);
     ctx.fillText(g.ch, gx+dxs*0.12*k, gy+dys*0.12*k);
    }
   }
   ctx.globalAlpha=flick*(.55+.35*depth)*(collapse<1?.6+.4*collapse:1);
   ctx.fillStyle="rgba(95,232,224,.5)";
   ctx.fillText(g.ch,gx-1,gy);ctx.fillText(g.ch,gx+1,gy);
   ctx.fillText(g.ch,gx,gy-1);ctx.fillText(g.ch,gx,gy+1);
   ctx.fillStyle=depth>0?"#eaffff":"#8fd8d4";
   ctx.fillText(g.ch,gx,gy);
  }
  ctx.globalAlpha=1;
 }
}
/* Draws every particle and impact ring (blood, sparks, dough gobs, etc.) queued this frame. */
function drawFx(){
 for(const p of particles){ctx.globalAlpha=1-p.t/p.life;ctx.fillStyle=p.col;
  if(p.dough){                               /* dough gob: soft rounded blob that squashes as it slows */
   const a=Math.max(0,1-p.t/p.life);ctx.globalAlpha=a;
   const rr=(p.r||2)*(0.7+a*0.6);
   ctx.beginPath();ctx.ellipse(Math.round(p.x),Math.round(p.y),rr,rr*0.82,0,0,6.283);ctx.fill();
   continue;}
  if(p.blood&&p.pool>0){                     /* settled pool / smear */
   ctx.globalAlpha=Math.min(1,p.pool*2.2);
   const w=Math.ceil(p.spread||3);
   ctx.fillRect(Math.round(p.x-w/2),Math.round(p.y),w,1);
   continue;}
  if(p.blood){                               /* airborne: stretch into a teardrop */
   const sp=Math.hypot(p.vx,p.vy);
   if(sp>60){
    const len=Math.min(6,1+sp/70), ux=p.vx/sp, uy=p.vy/sp;
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(Math.atan2(uy,ux));
    ctx.fillRect(-len,0,len+Math.ceil(p.r),Math.ceil(p.r));
    ctx.restore();continue;}
  }
  ctx.fillRect(Math.round(p.x),Math.round(p.y),Math.ceil(p.r),Math.ceil(p.r));}
 ctx.globalAlpha=1;
 for(const r of rings){ctx.globalAlpha=1-r.r/r.max;ctx.strokeStyle=r.col;ctx.lineWidth=2;
  ctx.beginPath();ctx.arc(r.x,r.y,r.r,0,7);ctx.stroke();}
 ctx.globalAlpha=1;
 if(SETTINGS_combatText())for(const fl of floaters){ctx.globalAlpha=1-fl.t/0.9;ctx.fillStyle=fl.col;
  ctx.font=fl.size+"px 'Press Start 2P'";ctx.textAlign="center";
  ctx.fillText(fl.txt,Math.round(fl.x),Math.round(fl.y));}
 ctx.globalAlpha=1;
}
/* Draws stationary world effects (e.g. Satori's double-jump energy) at the point they spawned. */
function drawGroundFx(){
 for(const fx of groundFx){
  const set=IMG_SPRITES[fx.id]; if(!set||!set.dblfx1)continue;
  const fr=set["dblfx"+Math.min(4,Math.floor(fx.t/0.07)+1)]; if(!fr||!(fr.img&&fr.img.complete&&fr.img.naturalWidth>0))continue;
  const SZ=95, sc=SZ/642;
  ctx.save();
  ctx.translate(Math.round(fx.x),Math.round(fx.y));
  if(fx.facing===-1)ctx.scale(-1,1);
  ctx.imageSmoothingEnabled=fr.img.naturalWidth>SZ*2;
  ctx.drawImage(fr.img,-321*sc,-641*sc,642*sc,642*sc);   /* canvas centre-x -> spawn x, canvas bottom -> feet */
  ctx.imageSmoothingEnabled=false;
  ctx.restore();
 }
}
/* Draws the ground-saw KERF: a channel between two gently-wavy parallel lines (the cut edges) with a
   small gap, the space between glowing DARK RED. The wave comes from a continuous function of x, so the
   per-mark segments join into two flowing (not dead-straight) lines. Each mark fades out. */
function drawSawCuts(){
 ctx.save();ctx.lineCap="round";
 const wob=x=>Math.sin(x*0.06)*0.9+Math.sin(x*0.23+1.3)*0.4;   /* mostly straight, only a slight waviness */
 const GAP=1.1, W=4;                                            /* half-gap between the two lines / half segment width */
 /* short jagged electric bolt from (x,y) in a base direction; occasionally forks a shorter branch */
 const bolt=(x,y,ang,seg,depth)=>{let px=x,py=y,a2=ang;const br=[];
  ctx.beginPath();ctx.moveTo(px,py);
  for(let s=0;s<seg;s++){a2+=rand(-0.9,0.9);const l=rand(1.8,3.6);px+=Math.cos(a2)*l;py+=Math.sin(a2)*l;ctx.lineTo(px,py);
   if(depth<1&&Math.random()<0.45)br.push([px,py,a2+rand(-1.4,1.4)]);}
  ctx.stroke();
  for(const b of br)bolt(b[0],b[1],b[2],1+Math.floor(rand(0,2)),depth+1);};
 for(const c of sawCuts){
  const a=Math.max(0,1-c.t/c.life); if(a<=0.02)continue;
  const x0=c.x-W,x1=c.x+W,w0=wob(x0),w1=wob(x1);
  ctx.globalAlpha=a;ctx.shadowColor="#c01020";
  /* dark-red glowing channel between the two lines */
  ctx.shadowBlur=7;ctx.fillStyle="#4a0812";
  ctx.beginPath();ctx.moveTo(x0,GROUND-GAP+w0);ctx.lineTo(x1,GROUND-GAP+w1);ctx.lineTo(x1,GROUND+GAP+w1);ctx.lineTo(x0,GROUND+GAP+w0);ctx.closePath();ctx.fill();
  /* the two edge lines (crimson) */
  ctx.shadowBlur=4;ctx.strokeStyle="#e42030";ctx.lineWidth=1.4;
  ctx.beginPath();ctx.moveTo(x0,GROUND-GAP+w0);ctx.lineTo(x1,GROUND-GAP+w1);ctx.stroke();   /* top edge */
  ctx.beginPath();ctx.moveTo(x0,GROUND+GAP+w0);ctx.lineTo(x1,GROUND+GAP+w1);ctx.stroke();   /* bottom edge */
  /* flickering short red electric bolts crackling out of the gap in random directions, some forking */
  if(a>0.4&&Math.random()<0.06){ctx.shadowBlur=6;ctx.lineWidth=1;ctx.strokeStyle=Math.random()<0.5?"#ff5a68":"#ffe0e4";
   bolt(c.x+rand(-1.5,1.5),GROUND+wob(c.x),-Math.PI/2+rand(-1.6,1.6),2+Math.floor(rand(0,2)),0);}
 }
 ctx.restore();
}
/* Draws dash afterimages: semi-transparent copies of the dash sprite at the positions it passed through,
   oldest = faintest, with a soft crimson glow so the trail reads as motion (placed behind the fighters). */
function drawGhosts(){
 for(const g of ghosts){
  const fr=g.frame; if(!fr||!fr.img||!fr.img.complete||!fr.img.naturalWidth)continue;
  const a=0.40*(1-g.t/g.life); if(a<=0.02)continue;   /* fade with age */
  ctx.save();
  ctx.globalAlpha=a;
  ctx.imageSmoothingEnabled=fr.img.naturalWidth>fr.w*2;
  ctx.shadowColor="#e2384a";ctx.shadowBlur=6;   /* crimson aura */
  ctx.translate(Math.round(g.x),Math.round(g.y));
  if(g.facing===-1)ctx.scale(-1,1);
  ctx.drawImage(fr.img,Math.round(-fr.w/2+(fr.dx||0)),Math.round(-fr.h+(fr.foot||0)),fr.w,fr.h);
  ctx.imageSmoothingEnabled=false;
  ctx.restore();
 }
}
/* =============== MAIN LOOP =============== */
let lastT=0;
/* Advances one simulation step: timers, both fighters' input+physics, collision,
   projectiles/effects, and the camera. Authoritative — runs locally and on the
   online host, never on the online guest (which renders host snapshots instead). */
function updateSimulation(dt){
 tGlobal+=dt;
 if(!roundOver&&Number.isFinite(timer)){timer-=dt;if(timer<=0)timeoutRound();}
 for(const f of fighters){readInput(f,dt);updateFighter(f,dt);}
 resolveFighterCollision();
 /* face each other when idle */
 if(!roundOver){const[a,b]=fighters;
  if(a.state==="idle"&&a.alive)a.facing=a.x<b.x?1:-1;
  if(b.state==="idle"&&b.alive)b.facing=b.x<a.x?1:-1;}
 updateProjectiles(dt);updateFx(dt);
 for(let i=groundFx.length-1;i>=0;i--){groundFx[i].t+=dt;if(groundFx[i].t>0.30)groundFx.splice(i,1);}   /* advance + cull stationary fx */
 for(let i=ghosts.length-1;i>=0;i--){ghosts[i].t+=dt;if(ghosts[i].t>=ghosts[i].life)ghosts.splice(i,1);}   /* advance + cull afterimages */
 {const sawActive=projectiles.some(p=>p.saw);   /* keep the whole gash while the saw is still rolling; fade it only once the saw is gone */
  for(let i=sawCuts.length-1;i>=0;i--){if(!sawActive)sawCuts[i].t+=dt;if(sawCuts[i].t>=sawCuts[i].life)sawCuts.splice(i,1);}}
 if(typeof updateDog==="function")updateDog(dt);   /* roaming dog hazard (js/dog.js) */
 if(typeof updateToilet==="function")updateToilet(dt);   /* right-side toilet event (js/toilet.js) */
 if(typeof updateCars==="function")updateCars(dt);   /* left-side car explosion event (js/cars.js) */
 if(typeof updateCarProp==="function")updateCarProp(dt);   /* burning-wreck fire hazard (js/car.js) */
 /* ---- camera: follow the pair; slowly pull back (zoom out) when they're far apart ---- */
 {const[a,b]=fighters;
  const gap=Math.abs(a.x-b.x), margin=140;
  let tz=W/(gap+margin*2);                                   /* zoom needed to fit both fighters + margins */
  tz=Math.max(W/WORLD_W,Math.min(1,tz));                     /* never zoom past showing the whole stage */
  camScale+=(tz-camScale)*Math.min(1,dt*2.5);               /* ease the zoom smoothly (crawl-free via the offscreen world buffer in renderGame) */
  const camW=W/camScale;                                    /* visible world width */
  const mid=(a.x+b.x)/2, hi=Math.max(0,WORLD_W-camW);
  const want=Math.max(0,Math.min(hi,mid-camW/2));
  camX+=(want-camX)*Math.min(1,dt*CFG.camera.followSpeed);
  camX=Math.max(0,Math.min(hi,camX));}
}
/* Offscreen buffer the WORLD is rendered into at a CONSTANT scale (RENDER_SCALE, no zoom),
   so every layer is pixel-stable frame to frame. renderGame then does ONE smooth scale of this
   buffer to the screen by camScale -> smooth zoom-out with NO per-layer resample crawl. Sized for
   the widest possible view (whole stage at max zoom-out) + shake padding; created once. */
const CAM_PAD=24;   /* world-px margin rendered around the view so screen-shake never reveals a buffer edge */
let _worldBuf=null,_worldCtx=null,_worldBufDen=0;
/* Offscreen buffer at density `den` (backing px per world px). Re-allocated only when the density
   changes (i.e. on a DPI/resize), sized for the widest possible view (whole stage) + shake pad. */
function worldBuffer(den){
 if(!_worldBuf||_worldBufDen!==den){
  _worldBuf=_worldBuf||document.createElement("canvas");
  _worldBuf.width =Math.ceil((WORLD_W    +2*CAM_PAD)*den)+4;
  _worldBuf.height=Math.ceil((H*WORLD_W/W+2*CAM_PAD)*den)+4;
  _worldCtx=_worldBuf.getContext("2d");
  _worldBufDen=den;
 }
 return _worldBuf;
}
/* Draws the current game state (stage, fighters, projectiles, effects, HUD).
   Pure render — reads state without advancing it, so both host and guest use it. */
function renderGame(){
 const s=camScale;
 /* dpx = real device (backing) pixels per logical px; bden = world-buffer density (rasterise the
    world at true device resolution so it's crisp on HiDPI, capped for memory). */
 const dpx=(cv.width/W)||RENDER_SCALE;
 const bden=Math.min(MAX_SS,Math.max(RENDER_SCALE,dpx));
 const wx0=camX-CAM_PAD, wy0=(GROUND-GROUND/s)-CAM_PAD;     /* top-left of the (padded) visible world region */
 const visW=W/s+CAM_PAD*2, visH=H/s+CAM_PAD*2;
 const buf=worldBuffer(bden), b=_worldCtx;
 const sw=Math.min(buf.width,  visW*bden), sh=Math.min(buf.height, visH*bden);
 /* Scroll the buffer by a WHOLE buffer-pixel: with nearest-neighbor rasterisation a fractional
    scroll makes every static layer crawl frame-to-frame as the camera pans (the root cause of the
    "tearing when moving"). Snapping the world->buffer origin to an integer pixel keeps static art
    pixel-locked; the leftover sub-pixel (fracX/fracY, in world units) is applied in the smooth
    composite below, so panning still looks perfectly smooth. */
 const oxPx=wx0*bden, oyPx=wy0*bden;
 const oxi=Math.round(oxPx), oyi=Math.round(oyPx);
 const fracX=(oxPx-oxi)/bden, fracY=(oyPx-oyi)/bden;
 b.setTransform(1,0,0,1,0,0);
 b.clearRect(0,0,Math.ceil(sw)+2,Math.ceil(sh)+2);
 b.setTransform(bden,0,0,bden,-oxi,-oyi);   /* world -> buffer, constant density, INTEGER scroll */
 b.imageSmoothingEnabled=false;            /* match the old main-canvas default; hi-res sprites + backdrop opt into smoothing themselves */
 const _prevCtx=ctx; ctx=b;                /* redirect every world-draw below into the buffer */
 drawStage(tGlobal);                       /* backdrop now scales WITH the fighters (one uniform zoom) */
 if(typeof drawWaves==="function")drawWaves();      /* subtle water shimmer on the sea (js/waves.js) */
 if(typeof drawBirds==="function")drawBirds();      /* ambient seagulls in the sky (js/birds.js) — behind everything */
 if(typeof drawShark==="function")drawShark();      /* shark fin in the distant sea (js/shark.js) — behind everything */
 if(typeof drawCars==="function")drawCars();        /* parked traffic on the left road (js/cars.js) — behind fighters */
 if(typeof drawRope==="function")drawRope();        /* coiled mooring ropes on the pier (js/rope.js) — behind fighters */
 if(typeof drawPallets==="function")drawPallets();  /* wooden pallets in the otoparks (js/pallet.js) — behind fighters */
 if(typeof drawTrashbins==="function")drawTrashbins();  /* trashbins (js/trashbin.js) — behind fighters */
 if(typeof drawSodaUmbrellas==="function")drawSodaUmbrellas();  /* soda umbrellas (js/sodaumbrella.js) — behind the chairs */
 if(typeof drawSeats==="function")drawSeats();  /* plastic chairs (js/seat.js) — behind fighters */
 if(typeof drawBlackgammonTables==="function")drawBlackgammonTables();  /* backgammon tables (js/blackgammon.js) — in front of the chair */
 if(typeof drawStools==="function")drawStools();  /* wooden stools (js/stool.js) — in front of the table */
 /* compressor NPC disabled for now — code kept in js/compressor.js; re-enable by uncommenting:*/
 if(typeof drawCompMech==="function")drawCompMech();
 if(typeof drawCradleBehind==="function")drawCradleBehind();   /* 2 stacked crates by the compressor (js/plasticcradle.js) — behind fighters */
 if(typeof drawCompressorGuy==="function")drawCompressorGuy();
 if(typeof drawWetsuitsDry==="function")drawWetsuitsDry();
 if(typeof drawYellowFins==="function")drawYellowFins();   /* diving fins in front of the wetsuit rack (js/yellowfin.js) */
 if(typeof drawScubaGlassesBehind==="function")drawScubaGlassesBehind();   /* diving mask by the boat (js/scubaglasses.js) — behind fighters */
 if(typeof drawFishnet==="function")drawFishnet();
 if(typeof drawFishbox==="function")drawFishbox();
 if(typeof drawFishingRod==="function")drawFishingRod();
 if(typeof drawSittingGuy==="function")drawSittingGuy();   /* seated NPC by the sea (js/sitter.js) — behind fighters */
 if(typeof drawbalikGuy ==="function")drawbalikGuy(); /*balikci*/
 if(typeof drawKids ==="function")drawKids(); /*Talking kids*/
 if(typeof drawLightHouse==="function")drawLightHouse();
 if(typeof drawTourist ==="function")drawTourist(); /*Talking Tourist*/
 if(typeof drawKid==="function")drawKid();   /* snacking kid on top of the boat (js/kid.js) — behind fighters */
 if(typeof drawScaffold==="function")drawScaffold();
 drawStageObjects(tGlobal);
 if(typeof drawIronboxes==="function")drawIronboxes();   /* ironboxes on/around the scaffolds (js/ironbox.js) — after scaffolds, behind fighters */
 drawGroundFx();   /* double-jump energy stays at the take-off point, behind the fighters */
 drawGhosts();     /* dash afterimages, behind the fighters */
 drawSawCuts();    /* glowing-red ground gash from the crouch-A saw */
 drawMines();      /* crouch-C spike mine + eruption — same layer as the fighters (ground objects) */
 /* Draw order (later = on top): dead behind; the fighter mid-ACTION (attack/skill/ult) comes forward so
    it reads clearly; if BOTH are acting, priority goes to whoever started their move first (earlier
    lastAction). Neutral fighters keep a stable order (no flicker). */
 const acting=f=>f.alive&&(f.state==="attack"||f.state==="special");
 fighters.slice().sort((a,b)=>{
  if(a.alive!==b.alive)return a.alive?1:-1;            /* dead -> drawn first (behind) */
  const aa=acting(a),ba=acting(b);
  if(aa!==ba)return aa?1:-1;                           /* the acting fighter -> drawn last (on top) */
  if(aa&&ba)return (a.lastAction||0)<=(b.lastAction||0)?1:-1;   /* both acting -> earlier starter on top */
  return 0;                                            /* neither acting -> stable */
 }).forEach(f=>drawFighter(f,tGlobal));
 if(typeof drawRegulatorGuy==="function")drawRegulatorGuy();   /* diver by the tanks (js/regulator.js) — FOREGROUND, in front of the fighters */
 if(typeof drawDog==="function")drawDog();          /* roaming dog hazard (js/dog.js) */
 if(typeof drawToilet==="function")drawToilet();    /* toilet + caretaker (js/toilet.js) */
 if(typeof drawCO2Tank==="function")drawCO2Tank();
 if(typeof drawScubaGlassesFront==="function")drawScubaGlassesFront();   /* 2 masks next to the CO2 tank (js/scubaglasses.js) — foreground */
 if(typeof drawRegulatorGuy==="function")drawRegulatorGuy();   /* diver by the tanks (js/regulator.js) — FOREGROUND, in front of the fighters */
 if(typeof drawCradleFore==="function")drawCradleFore();   /* crate next to the regulator (js/plasticcradle.js) — foreground */
 drawProjectiles();drawCodexes(tGlobal);drawFx();
 ctx=_prevCtx;                             /* world done — back to the real canvas */
 /* ---- composite: one smooth scale of the whole world buffer onto the screen (+ screen shake) ---- */
 const shk=shake*SETTINGS_shakeScale();
 const ox=shk>0?rand(-3,3)*shk*3:0, oy=shk>0?rand(-2,2)*shk*3:0;
 ctxMain.setTransform(dpx,0,0,dpx,0,0);    /* logical W×H -> real device-pixel backing (1:1 on screen) */
 ctxMain.imageSmoothingEnabled=true;ctxMain.imageSmoothingQuality="high";
 ctxMain.drawImage(buf, 0,0,sw,sh,  s*(-CAM_PAD-fracX)+ox, s*(-CAM_PAD-fracY)+oy, visW*s, visH*s);
 ctxMain.imageSmoothingEnabled=false;
 ctx=ctxMain;drawHUD();                    /* HUD stays screen-fixed, crisp, at device resolution */
 ctxMain.setTransform(1,0,0,1,0,0);
}
/* The main game loop (one requestAnimationFrame tick). Local + online-host run
   the simulation then render; the online guest applies/interpolates snapshots and
   only renders (no authoritative simulation). */
function loop(ts){
 if(!running)return;
 /* ---- ONLINE GUEST: render authoritative snapshots, never simulate ---- */
 if(typeof ONLINE!=="undefined"&&ONLINE.mode==="match-guest"){
  const gdt=Math.min(.05,(ts-lastT)/1000||.016);lastT=ts;
  ONLINE_guestTick(gdt,ts);
  renderGame();
  requestAnimationFrame(loop);
  return;
 }
 if(paused){lastT=ts;return;}   /* frozen: stop advancing; resume re-kicks the loop (local matches only) */
 const dt=Math.min(.033,(ts-lastT)/1000||.016)*(CFG.gameSpeed||1);lastT=ts;   /* global slow-down (CFG.gameSpeed) */
 updateSimulation(dt);
 if(typeof ONLINE!=="undefined"&&ONLINE.mode==="match-host")ONLINE_hostMaybeSnapshot(ts);
 renderGame();
 requestAnimationFrame(loop);
}
/* =============== TITLE ORB (removed from the menu — no-op if the canvas isn't present) =============== */
(function(){const oc=document.getElementById("orbCanvas");if(!oc)return;const g=oc.getContext("2d");
 function tick(t){g.clearRect(0,0,24,24);
  g.fillStyle="#c98f1d";g.beginPath();g.arc(12,12,10,0,7);g.fill();
  g.fillStyle="#f2b632";g.beginPath();g.arc(12,12,8,0,7);g.fill();
  g.fillStyle="#ffe9ad";g.fillRect(7,7,4,4);
  for(let i=0;i<4;i++){const a=t/700+i*Math.PI/2;
   g.fillStyle="#ffe9ad";g.fillRect(12+Math.cos(a)*11-1,12+Math.sin(a)*11-1,2,2);}
  requestAnimationFrame(tick);}
 requestAnimationFrame(tick);})();
/* =============== SELECT SCREEN =============== */
/* Renders one character's portrait onto a small canvas (used for the roster select-screen cards), scaled to a consistent height from either their IMG_SPRITES art or the pixel-grid fallback. */
function drawPortrait(cnv,d){
 const g=cnv.getContext("2d");g.imageSmoothingEnabled=false;g.clearRect(0,0,cnv.width,cnv.height);
 const soon=COMING_SOON.includes(d.id);   /* coming-soon fighters render greyscale + "COMING SOON" */
 const comingSoonOverlay=()=>{g.filter="none";g.fillStyle="rgba(10,7,22,0.5)";g.fillRect(0,0,cnv.width,cnv.height);
  g.fillStyle="#e8f8ff";g.font="10px 'Press Start 2P'";g.textAlign="center";
  g.fillText("COMING",cnv.width/2,66);g.fillText("SOON",cnv.width/2,82);};
 const img=IMG_SPRITES[d.id];
 if(img){const fr=img.idle;
  /* scale on HEIGHT so every fighter reads the same size; wide poses (capes,
     spread arms) may overhang the card a little rather than shrinking the body. */
  const sc=Math.min(116/fr.h,cnv.width/fr.w);
  const w=Math.round(fr.w*sc),h=Math.round(fr.h*sc);
  const draw=()=>{g.imageSmoothingEnabled=fr.img.naturalWidth>w*2;if(soon)g.filter="grayscale(1) brightness(0.7)";
   g.drawImage(fr.img,Math.round((cnv.width-w)/2),120-h,w,h);g.filter="none";if(soon)comingSoonOverlay();};
  if(fr.img.complete&&fr.img.naturalWidth>0)draw();else fr.img.onload=draw;
  return;}
 const spr=SPRITES[d.id],cell=4,rows=spr.g.length;
 const oy=120-rows*cell;
 const ox=Math.round((cnv.width-16*cell)/2);
 for(let r=0;r<rows;r++){const row=spr.g[r];
  for(let c=0;c<16;c++){const ch=row[c];if(ch===".")continue;
   const col=spr.pal[ch];if(!col)continue;
   g.fillStyle=col;g.fillRect(ox+c*cell,oy+r*cell,cell,cell);}}
 if(d.id==="ember"){[-4,0,4].forEach((dx,i)=>{const hgt=2+i%3;
  for(let j=0;j<hgt;j++){g.fillStyle=j===hgt-1?"#ffd23f":"#f28022";
   g.fillRect(ox+32+dx*2-2,oy-6-j*4,4,4);}});}
}
/* Draws just the HEAD of a fighter into a small roster box: the idle sprite is zoomed so the top
   ~46% (head + shoulders) fills the box, top-aligned. Falls back to the pixel grid's top rows. */
function drawHead(cnv,d){
 const g=cnv.getContext("2d");g.imageSmoothingEnabled=false;g.clearRect(0,0,cnv.width,cnv.height);
 const soon=COMING_SOON.includes(d.id);
 const img=IMG_SPRITES[d.id];
 if(img){const fr=img.idle;
  const HEAD_FRAC=0.40;                        // fraction of the sprite (from the top) that fills the box — lower = closer on the head
  const sc=cnv.height/(fr.h*HEAD_FRAC);
  const w=fr.w*sc,h=fr.h*sc;
  const dx=Math.round((cnv.width-w)/2),dy=2;   // centred + top-aligned so the head shows
  const draw=()=>{g.imageSmoothingEnabled=fr.img.naturalWidth>w*2;if(soon)g.filter="grayscale(1) brightness(0.6)";
   g.drawImage(fr.img,dx,dy,w,h);g.filter="none";
   if(soon){g.fillStyle="rgba(10,7,22,0.45)";g.fillRect(0,0,cnv.width,cnv.height);}};
  if(fr.img.complete&&fr.img.naturalWidth>0)draw();else fr.img.onload=draw;
  return;}
 const spr=SPRITES[d.id];if(!spr)return;const cell=Math.max(2,Math.floor(cnv.width/16));
 const ox=Math.round((cnv.width-16*cell)/2),rows=Math.min(spr.g.length,Math.ceil(cnv.height/cell));
 for(let r=0;r<rows;r++){const row=spr.g[r];for(let c=0;c<16;c++){const ch=row[c];if(ch===".")continue;const col=spr.pal[ch];if(!col)continue;g.fillStyle=col;g.fillRect(ox+c*cell,2+r*cell,cell,cell);}}
}
/* Draws a fighter's FULL idle sprite into a big preview canvas, standing on the bottom, centred.
   `flip` mirrors it (used for Player 2 so the two face each other). Empty if no fighter given. */
function drawFullIdle(cnv,d,flip){
 const g=cnv.getContext("2d");g.imageSmoothingEnabled=false;g.clearRect(0,0,cnv.width,cnv.height);
 if(!d)return;
 const img=IMG_SPRITES[d.id];
 if(img){const fr=img.idle;
  const sc=(cnv.height-8)/fr.h;   // scale on HEIGHT only, so EVERY fighter reads the same size (wide poses just overhang + clip)
  const w=fr.w*sc,h=fr.h*sc;
  const dx=Math.round((cnv.width-w)/2),dy=Math.round(cnv.height-h-2);
  const draw=()=>{g.imageSmoothingEnabled=fr.img.naturalWidth>w*2;g.save();
   if(flip){g.translate(cnv.width,0);g.scale(-1,1);}
   g.drawImage(fr.img,dx,dy,w,h);g.restore();};
  if(fr.img.complete&&fr.img.naturalWidth>0)draw();else fr.img.onload=draw;
  return;}
 const spr=SPRITES[d.id];if(!spr)return;const rows=spr.g.length;
 const cell=Math.max(1,Math.min(Math.floor((cnv.width-12)/16),Math.floor((cnv.height-8)/rows)));
 const ox=Math.round((cnv.width-16*cell)/2),oy=Math.round(cnv.height-rows*cell-2);
 for(let r=0;r<rows;r++){const row=spr.g[r];for(let c=0;c<16;c++){const ch=row[c];if(ch===".")continue;const col=spr.pal[ch];if(!col)continue;g.fillStyle=col;g.fillRect(ox+c*cell,oy+r*cell,cell,cell);}}
}
/* Builds the character-select grid: one clickable HEAD box per entry in CHARS (name shows in the preview). */
function buildRoster(){
 const rEl=document.getElementById("roster");rEl.innerHTML="";
 CHARS.forEach(d=>{
  const card=document.createElement("div");card.className="card";card.dataset.id=d.id;
  const cn=document.createElement("canvas");cn.width=72;cn.height=80;
  card.appendChild(cn);
  if(!COMING_SOON.includes(d.id))card.addEventListener("click",()=>pick(d.id));
  else card.classList.add("soon");   /* not selectable */
  rEl.appendChild(card);
  drawHead(cn,d);
 });
}
/* Handles a roster-card click: fills the P1 slot first, then P2; clicking a third time restarts the pick from P1. */
function pick(id){
 if(p1Pick===null)p1Pick=id;
 else if(p2Pick===null)p2Pick=id;
 else{p1Pick=id;p2Pick=null;}
 refreshSelect();
}
/* Builds the bio-panel HTML for a selected character: name, description, each skill's name/cooldown/description, and the ult -- keysArr supplies the on-screen key labels (labels from js/controls.js). */
function bioHTML(label,d,keysArr,ultKey){
 if(!d)return "<b>"+label+"</b>Select a fighter…";
 let html="<b>"+label+" — "+d.name.toUpperCase()+"</b>"+d.bio;
 d.ab.forEach((a,i)=>{html+="<br><span class='sp'>["+keysArr[i]+"] "+a.n+" ("+a.cd+"s cd):</span> "+a.d;});
 html+="<br><span class='sp' style='color:var(--gold)'>★ ULT ["+ultKey+"] "+d.ult.n+":</span> "+d.ult.d;
 return html;
}
/* Repaints the character-select screen after a pick changes: highlights the chosen cards, updates both bio panels, and enables the FIGHT button once both slots are filled. */
function refreshSelect(){
 document.querySelectorAll(".card").forEach(c=>{
  c.classList.toggle("p1sel",c.dataset.id===p1Pick);
  c.classList.toggle("p2sel",c.dataset.id===p2Pick);
  c.querySelectorAll(".tag").forEach(t=>t.remove());
  if(c.dataset.id===p1Pick){const t=document.createElement("div");t.className="tag t1";t.textContent="P1";c.appendChild(t);}
  if(c.dataset.id===p2Pick){const t=document.createElement("div");t.className="tag t2";t.textContent=cpuMode?"CPU":"P2";c.appendChild(t);}
 });
 const d1=CHARS.find(c=>c.id===p1Pick),d2=CHARS.find(c=>c.id===p2Pick);
 document.getElementById("bio1").innerHTML=bioHTML("PLAYER 1",d1,AB_LABELS.p1,ULT_KEY.p1);
 document.getElementById("bio2").innerHTML=bioHTML(cpuMode?"OPPONENT (CPU)":"PLAYER 2",d2,AB_LABELS.p2,ULT_KEY.p2);
 /* big full-idle previews (P2 flipped so they face off) + names */
 const pv1=document.getElementById("prev1"),pv2=document.getElementById("prev2");
 if(pv1)drawFullIdle(pv1,d1,false);
 if(pv2)drawFullIdle(pv2,d2,true);
 const pn1=document.getElementById("prevName1"),pn2=document.getElementById("prevName2");
 if(pn1)pn1.textContent=d1?d1.name.toUpperCase():"PLAYER 1";
 if(pn2)pn2.textContent=d2?d2.name.toUpperCase():(cpuMode?"CPU":"PLAYER 2");
 document.getElementById("fightBtn").disabled=!(p1Pick&&p2Pick);
}
/* =============== SCREEN NAV / WIRING =============== */
function showScreen(id){document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
 document.getElementById(id).classList.add("active");
 /* the fight screen gets the wide shell so the 720px viewport lands at 2x */
 document.getElementById("app").classList.toggle("wide",id==="fight");
 if(id==="fight")fitCanvas();}   /* size the backing to real device pixels now that the canvas has a box */
document.getElementById("startBtn").addEventListener("click",()=>showScreen("select"));
document.getElementById("selBackBtn").addEventListener("click",()=>showScreen("title"));
document.getElementById("modeSel").addEventListener("change",e=>{cpuMode=e.target.value==="cpu";refreshSelect();});
document.getElementById("diffSel").addEventListener("change",e=>{
 cpuDiff=+e.target.value;
 if(typeof activeSettings!=="undefined"){activeSettings.match.cpuDifficulty=cpuDiff;saveSettings(activeSettings);}
 const pd=document.getElementById("pauseDiffSel");if(pd)pd.value=e.target.value;
});
/* Starts a match from the selected fighters/stage: builds both Fighter instances (P2 or CPU per the mode toggle) and kicks off the first round. */
function beginMatch(){
 const d1=CHARS.find(c=>c.id===p1Pick),d2=CHARS.find(c=>c.id===p2Pick);
 const sv=+document.getElementById("stageSel").value;
 stageId=(sv>=0&&sv<STAGES.length)?sv:0;
 fighters=[new Fighter(d1,SPAWN_1,1,"p1"),new Fighter(d2,SPAWN_2,-1,cpuMode?"cpu":"p2")];
 camX=camClamp((SPAWN_1+SPAWN_2)/2-W/2);
 if(typeof SETTINGS_roundTime==="function"){matchRoundTime=SETTINGS_roundTime();matchWinsRequired=SETTINGS_roundsToWin();}
 roundNum=1;document.getElementById("postFight").classList.remove("show");
 showScreen("fight");running=true;startRound();
 lastT=performance.now();requestAnimationFrame(loop);
}
document.getElementById("fightBtn").addEventListener("click",beginMatch);
document.getElementById("rematchBtn").addEventListener("click",()=>{
 document.getElementById("postFight").classList.remove("show");
 if(typeof SETTINGS_roundTime==="function"){matchRoundTime=SETTINGS_roundTime();matchWinsRequired=SETTINGS_roundsToWin();}
 fighters.forEach(f=>f.wins=0);roundNum=1;running=true;startRound();
 lastT=performance.now();requestAnimationFrame(loop);
});
document.getElementById("charBtn").addEventListener("click",()=>{
 document.getElementById("postFight").classList.remove("show");running=false;showScreen("select");
});
/* =============== PAUSE MENU =============== */
const DIFF_NAMES=["Novice","Warrior","Celestial","Practice (test skills)"];
function showPauseMain(){
 document.getElementById("pauseMain").style.display="flex";
}
/* Freezes the game loop and shows the pause menu (also releases any held input keys so nothing stays 'stuck' pressed). */
function pauseGame(){
 if(paused||!running||roundOver)return;
 paused=true;
 /* clear held keys so nothing is "stuck" pressed while frozen */
 for(const k in keys)keys[k]=false;
 showPauseMain();
 document.getElementById("pauseMenu").classList.add("show");
}
/* Hides the pause menu and resumes the game loop from where it left off. */
function resumeGame(){
 if(!paused)return;
 paused=false;
 document.getElementById("pauseMenu").classList.remove("show");
 /* Esc during a fullscreen fight makes the browser drop fullscreen; this click is a
    user gesture, so re-enter fullscreen if that is still the player's preference. */
 if(typeof activeSettings!=="undefined"&&activeSettings.visuals.fullscreen&&!document.fullscreenElement&&typeof SETTINGS_applyFullscreen==="function")SETTINGS_applyFullscreen(true);
 lastT=performance.now();requestAnimationFrame(loop);   /* re-kick the frozen loop */
}
function togglePause(){paused?resumeGame():pauseGame();}
document.getElementById("resumeBtn").addEventListener("click",resumeGame);
/* Pause SETTINGS opens the full settings overlay; closing it returns to the pause menu. */
document.getElementById("settingsBtn").addEventListener("click",()=>{
 document.getElementById("pauseMenu").classList.remove("show");
 if(typeof openSettings==="function")openSettings("pause");
});
document.getElementById("menuBtn").addEventListener("click",()=>{
 paused=false;running=false;
 document.getElementById("pauseMenu").classList.remove("show");
 document.getElementById("postFight").classList.remove("show");
 showScreen("title");
});
/* Focus loss: online matches never pause (that would freeze the opponent). Instead
   release all held input so nothing sticks; the authoritative match keeps running. */
window.addEventListener("blur",()=>{
 if(typeof ONLINE!=="undefined"&&(ONLINE.mode==="match-host"||ONLINE.mode==="match-guest")){
  for(const k in keys)keys[k]=false;
  if(ONLINE.mode==="match-host"&&typeof ONLINE_clearRemoteInput==="function"){/* keep opponent input; only clear our own keys */}
  if(ONLINE.mode==="match-guest"&&typeof ONLINE_sendNeutralInput==="function")ONLINE_sendNeutralInput();
  return;
 }
 /* Local auto-pause (setting; only during a live round). */
 if(typeof activeSettings==="undefined"||!activeSettings.match.pauseOnFocusLoss)return;
 if(running&&!paused&&!roundOver&&document.getElementById("fight").classList.contains("active"))pauseGame();
});
/* Practice-only actions invoked from the settings Practice panel. */
function practiceResetPositions(){
 if(!running||!fighters||fighters.length<2)return;
 const set=(f,x,fc)=>{f.x=x;f.y=GROUND;f.vx=0;f.vy=0;f.onGround=true;f.jumps=0;f.facing=fc;f.state="idle";f.t=0;};
 set(fighters[0],SPAWN_1,1);set(fighters[1],SPAWN_2,-1);
 camX=camClamp((SPAWN_1+SPAWN_2)/2-W/2);
}
function practiceClearStatus(){
 if(!running||!fighters)return;
 for(const f of fighters){f.resetStatus();}   /* wipes every buff/debuff, keeps HP & energy */
}
/* init — bootGame() is called by js/main.js AFTER every character module (characters/*.js)
   has loaded and populated the registries. ROSTER_ORDER fixes the card order regardless of
   which order the modules happened to load in. */
const ROSTER_ORDER=["haydar","satori","notalk","necaati","necmi","putuk","agron","munevver","warbringer"];
function bootGame(){
 CHARS.sort((a,b)=>ROSTER_ORDER.indexOf(a.id)-ROSTER_ORDER.indexOf(b.id));
 for(const id in IMG_SPRITES)for(const k in IMG_SPRITES[id]){const d=IMG_SPRITES[id][k];if(!d.img){d.img=new Image();d.img.src=d.src;}}
 buildRoster();refreshSelect();
}
