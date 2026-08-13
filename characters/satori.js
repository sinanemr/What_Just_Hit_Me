/**
 * SATORI — all of this fighter's editable data + behaviour in one file.
 * Loaded AFTER js/engine.js, so the shared registries (CHARS, IMG_SPRITES, SPRITES,
 * ABILITIES, ULTS, EXTRAS, EXTRAS_BEHIND, WIN_LINES) and the engine helpers already exist.
 * Character-specific drawFighter render branches remain in engine.js.
 */
"use strict";


/* ==================== SATORI ==================== */
 CHARS.push({id:"satori", name:"Satori", ep:"The Crimson Blade",
  hp:500, armor:155, speed:172, jump:430, power:20,
  bio:"Fast hybrid combo fighter (double jump). NINJA AGILITY: finishing any basic combo — standing, aerial or crouching — grants +12% move & attack speed 2.5s. CRIMSON DISCIPLINE: alternating melee/ranged SKILLS prepares an empowered opposite-type skill (+10% dmg + bonus, 4s; basics don't trigger it).",
  ab:[
   {n:"CRIMSON PROJECTILES",cost:0,cd:8,kind:"ranged",d:"2 charges (4s window). Stand: 3×18 shuriken (all → STAGGER). Air: 5×10 diagonal spikes (4+ → SLOW). Crouch: 2×23 low (both → ROOT). Ranged Ready empowers."},
   {n:"CRIMSON BLADES",cost:0,cd:9,kind:"melee",d:"Stand: crossing dash 2×34, ignores 10% block. Air: crescent dive 65, sends DOWN. Crouch: low shadow crossing 2×30, ducks highs. Melee Ready empowers."},
   {n:"SPINAL SPIKES",cost:0,cd:11,kind:"melee",d:"Stand: spike-dagger STAB 36 + 1s delayed blast 36, −15 block. Air: spine halo 66 + 35% DR. Crouch: floor TRAP 60 + STUN. Ranged/Melee Ready empowers."}
  ],
  ult:{n:"CRIMSON CATACLYSM",d:"4 giant spikes home in (4×18); first hit PARALYZES, then a katana execution (60) with HARD KNOCKDOWN + DEFENSE BREAK. Up to 142. Whiff all four → no execution."}
 });
 /* NEW ART: full 642x642 canvases with the character's feet at the canvas bottom and a consistent
    in-canvas scale, so every frame renders at the same size + feet line (w=h square keeps the aspect).
    3 idle frames sway for a natural stance. The rest of Satori's states are being re-added; until
    each sprite is in, that state falls back to idle (engine drawFighter guard). */
 IMG_SPRITES.satori={}/* sprites come from characters/sprite-manifest.js (per-animation folders) */;
 SPRITES.satori={pal:{p:"#2b4fd8",P:"#1c3798",c:"#c8d2e6",a:"#e2384a",s:"#e8c39a",e:"#141420",k:"#10142e"},g:[
"......pppp......",
".....pppppp.....",
".....ppppppaa...",
".....pssssp.....",
".....pessep.....",
".....pssssp.....",
".....pppppp.....",
"......pppp......",
".......pp.......",
"...pppppppppp...",
"..ppppccccpppp..",
"..pppccccccppp..",
"..pppccccccppp..",
"..pPppccccppPp..",
"..s.pppppppp.s..",
"....pppppppp....",
"....pppppppp....",
"....pppppppp....",
"....aaaaaaaa....",
"....pppppppp....",
".....ppp.ppp....",
".....ppp.ppp....",
".....ppp.ppp....",
".....ppp.ppp....",
".....PPP.PPP....",
".....PPP.PPP....",
".....kkk.kkk....",
".....kkk.kkk....",
"....kkkk.kkkk...",
]};
 /* --------------------------------------------------------------------------------------------
    SKILL KIT (from the Satori design doc). Slots: A = CRIMSON PROJECTILES (ranged, 2-charge),
    B = CRIMSON BLADES (melee dashes), C = SPINAL SPIKES. Each has a STANDING (ABILITIES),
    AIR (ABILITIES_AIR) and CROUCH (ABILITIES_CROUCH) variant. CRIMSON DISCIPLINE: A is ranged;
    B is melee; C is melee (standing/air) but ranged (crouch). useDiscipline(f,type) returns whether
    THIS cast is empowered (the opposite type was prepared) and re-arms the opposite for 4s.
    Empowered ("Ranged/Melee Ready") variants deal ~+10% and add their bonus effect. -------------- */
 ABILITIES.satori=[
  /* STANDING A — Crimson Shuriken: 3×18 forward; all 3 land -> STAGGER (Ranged Ready: faster + STUN). */
  f=>{f.state="special";f.t=0;const emp=useDiscipline(f,"ranged");
   f._aShot=(f._aChg===1)?1:2;   /* charge just spent (tryAbility already decremented): 1st -> skA1, 2nd -> skA2 */
   const hoy=(f._aShot===2)?56:62;   /* throwing-hand height for the current pose (skA1 higher, skA2 lower) */
   f._satVol=(f._satVol||0)+1;f._satHits=0;const vol=f._satVol,dmg=emp?20:18,sp=emp?520:400;
   [0,110,220].forEach((d,k)=>setTimeout(()=>{if(!running)return;
    projectiles.push({type:"satp",shape:"shuriken",x:MZX(f,32),y:MZY(f,hoy)+S((k-1)*3),vx:f.facing*sp,vy:0,r:6,dmg:dmg,kbv:45,owner:f,col:"#ff4a5a",skill:true,vol:vol,need:3,eff:emp?"stun":"stagger",dur:emp?0.5:0.35});},d));},
  /* STANDING B — Crimson Crossing: dash-through 2×34, switches sides, ignores 10% block (Melee Ready: rebound).
     B1->B2->B3 = blade wind-up held IN PLACE (no movement); B4 = the forward dash. */
  f=>{f.state="special";f.t=0;f._cEmp=useDiscipline(f,"melee");f.dashKind="";
   f.dashDir=Math.sign(other(f).x-f.x)||f.facing;f.facing=f.dashDir;f.dashHit=false;
   setTimeout(()=>{if(!running||f.state!=="special")return;
    f.dashKind="satcross";f.dashT=.20;f._dashDur=.20;f._dashStartX=f.x;f._dashLen=f.dashDir*118;},260);},   /* eased dash span (see updateFighter) */
  /* STANDING C — Spinal Spike Burst: stab 36 + delayed blast 36, −15 block (Melee Ready: stronger + Energy Burn). */
  f=>{f.state="special";f.t=0;f._cEmp=useDiscipline(f,"melee");
   f.dashDir=Math.sign(other(f).x-f.x)||f.facing;f.facing=f.dashDir;f.dashT=.12;f.dashHit=false;f.dashKind="satstab";}];

 /* AIR variants */
 ABILITIES_AIR.satori=[
  /* AIR A — Crimson Spike Volley: 5×10 diagonal-down; 4+ land -> SLOW (Ranged Ready: converge + stronger slow). */
  f=>{f.state="special";f.t=0;const emp=useDiscipline(f,"ranged");
   f._aShot=(f._aChg===1)?1:2;   /* same 2-charge principle as standing: 1st -> skAair1, 2nd -> skAair2 */
   f._airHold=0.66;   /* hold the special open a bit longer so the slower throw animation isn't cut off */
   const HX=32, HY=42;   /* release-hand offset (measured on the air02 throwing pose): forward HX, up HY */
   const handBurst=()=>{ringFx(MZX(f,HX),MZY(f,HY),"#ff2a3a",34);ringFx(MZX(f,HX),MZY(f,HY),"#ff8fa0",20);   /* red light at the hand on each throw */
    for(let s=0;s<7;s++)particles.push({x:MZX(f,HX),y:MZY(f,HY),vx:f.facing*rand(40,140),vy:rand(20,120),r:rand(1.4,3),col:s%2?"#ff2a3a":"#ff8fa0",t:0,life:rand(.12,.24)});};
   f._satVol=(f._satVol||0)+1;f._satHits=0;const vol=f._satVol,dmg=emp?11:10;
   /* NATURAL double throw, slowed: wind up -> RELEASE (spikes fly from the hand on the release), twice.
      Releases at 220ms & 500ms match the pose timeline so the arm snap reads as a real throw.
      Per-charge variety: 1st cast throws 3-then-2, 2nd cast 2-then-3 (always 5 total). */
   const throws=(f._aShot===2)?[{n:2,t:220},{n:3,t:500}]:[{n:3,t:220},{n:2,t:500}];
   throws.forEach(th=>{setTimeout(()=>{if(running)handBurst();},th.t);   /* red flash as the hand snaps forward */
    for(let j=0;j<th.n;j++)setTimeout(()=>{if(!running)return;
     projectiles.push({type:"satp",shape:"spike",x:MZX(f,HX),y:MZY(f,HY)+S((j-1)*3),vx:f.facing*(300+j*22),vy:260+j*16,r:6,dmg:dmg,kbv:40,owner:f,col:"#e2384a",skill:true,homing:emp,vol:vol,need:4,eff:"slow",dur:emp?2:1.5,slowAmt:emp?.25:.15});},th.t+j*52);});},
  /* AIR B — Crimson Crescent Dive (4-frame sequence): hovers while he draws the crimson blade (air1->air2
     ->air3, dark-red lightning), then on air4 he DIVE-DASHES at the foe with the ghosting trail. 65 dmg,
     sends DOWN, lands behind (Melee Ready: +10% + ground bounce + faster recovery). */
  f=>{f.state="special";f.t=0;f._cEmp=useDiscipline(f,"melee");f._cbHold=0.74;f.dashKind="";
   f.facing=Math.sign(other(f).x-f.x)||f.facing;f.dashDir=f.facing;
   setTimeout(()=>{if(!running||f.state!=="special"||!f.alive)return;   /* sword out -> dark-red lightning burst */
    ringFx(MZX(f,6),MZY(f,48),"#5e0812",30);ringFx(MZX(f,6),MZY(f,48),"#e2384a",20);
    for(let s=0;s<12;s++)particles.push({x:MZX(f,rand(-4,14)),y:MZY(f,rand(34,60)),vx:rand(-70,70),vy:rand(-70,70),r:rand(1,2.6),col:s%3===0?"#5e0812":(s%3===1?"#e2384a":"#ff8fa0"),t:0,life:rand(.12,.3)});},175);
   setTimeout(()=>{if(!running||f.state!=="special"||!f.alive)return;   /* air4 -> dive-dash at the foe (ghosting) */
    f.dashDir=Math.sign(other(f).x-f.x)||f.facing;f.facing=f.dashDir;f.dashHit=false;f.dashKind="satdive";f.dashT=.20;},550);},
  /* AIR C — Crimson Spine Halo: 66 around Satori + 35% DR during (Melee Ready: STAGGER). */
  f=>{f.state="special";f.t=0;const emp=useDiscipline(f,"melee");
   f.dr35T=Math.max(f.dr35T,0.55);statusFloat(f,"SPINE HALO","#e2384a");
   ringFx(f.x,f.centerY,"#e2384a",72);ringFx(f.x,f.centerY,"#ff8fa0",52);
   for(let s=0;s<14;s++){const a=s/14*6.283;particles.push({x:f.x,y:f.centerY,vx:Math.cos(a)*170,vy:Math.sin(a)*170,r:rand(1.5,3),col:s%2?"#e2384a":"#ff8fa0",t:0,life:.4});}
   setTimeout(()=>{if(!running)return;const foe=other(f);
    if(foe.alive&&Math.abs(foe.x-f.x)<S(60)&&Math.abs(foe.hurtY-f.centerY)<S(62)){
     foe.takeDamage(emp?73:66,220,Math.sign(foe.x-f.x)||f.facing,{skill:true,energy:true,col:"#e2384a",fx:"#ff8fa0"});
     if(emp){applyStun(foe,0.5);statusFloat(foe,"STAGGER","#ff8fa0");}}
    hitProps(f.x,1,S(60),66,f,f.centerY,true);hitProps(f.x,-1,S(60),66,f,f.centerY,true);},120);}];

 /* CROUCH variants */
 ABILITIES_CROUCH.satori=[
  /* CROUCH A — Pinning Shurikens: 2×23 low; both land -> ROOT (Ranged Ready: longer root). */
  f=>{f.state="special";f.t=0;const emp=useDiscipline(f,"ranged");
   f._aShot=(f._aChg===1)?1:2;   /* same 2-charge principle: 1st -> skAcr1, 2nd -> skAcr2 */
   f._satVol=(f._satVol||0)+1;f._satHits=0;const vol=f._satVol,dmg=emp?50:46;   /* ONE big ground-saw shuriken (worth the old two) */
   setTimeout(()=>{if(!running)return;
    projectiles.push({type:"satp",shape:"shuriken",saw:true,x:MZX(f,14),y:GROUND,vx:f.facing*440,vy:0,r:16,dmg:dmg,kbv:40,owner:f,col:"#ff4a5a",skill:true,vol:vol,need:1,eff:"root",dur:emp?0.9:0.6,sawV:14});},60);},
  /* CROUCH B — Low Shadow Crossing (5-frame sequence): charge -> shadow-dash PAST the foe (ghosting) ->
     slide-stop behind -> close back in -> reverse slash. 2×30 (low cut on the pass + the reverse slash),
     Melee Ready: SLOW 20%/2s + −1s Skill A cd. */
  f=>{f.state="special";f.t=0;const emp=useDiscipline(f,"melee");f._cEmp=emp;f.crouching=true;f._cbHold=0.82;f.dashKind="";
   f.facing=Math.sign(other(f).x-f.x)||f.facing;f.dashDir=f.facing;
   setTimeout(()=>{if(!running||f.state!=="special")return;   /* charge: crimson electricity crackles under his feet */
    ringFx(f.x,GROUND,"#ff2a3a",26);
    for(let s=0;s<12;s++)particles.push({x:f.x+rand(-15,15),y:GROUND-rand(0,3),vx:rand(-45,45),vy:-rand(20,90),r:rand(1,2.4),col:s%2?"#ff2a3a":"#ffd0d6",t:0,life:rand(.15,.35)});},125);
   setTimeout(()=>{if(!running||f.state!=="special"||!f.alive)return;   /* shadow-dash past the foe (eased + ghosting), low cut on the way */
    const foe=other(f);f.dashDir=Math.sign(foe.x-f.x)||f.facing;f.facing=f.dashDir;f.dashHit=false;
    f.dashKind="cblow";f.dashT=.16;f._dashDur=.16;f._dashStartX=f.x;f._dashLen=(foe.x-f.x)+f.dashDir*S(40);},250);
   setTimeout(()=>{if(!running||f.state!=="special"||!f.alive)return;   /* close back in toward the foe (facing stays = dash dir; the sprites already show him turned to face the foe) */
    f.vx=(Math.sign(other(f).x-f.x)||f.facing)*300;},625);
   setTimeout(()=>{if(!running||f.state!=="special"||!f.alive)return;   /* reverse slash — the 2nd cut lands on the foe behind his facing */
    const foe=other(f),dir=Math.sign(foe.x-f.x)||f.facing;
    if(foe.alive&&Math.abs(foe.x-f.x)<S(60)&&Math.abs(foe.hurtY-f.centerY)<S(52)){
     foe.takeDamage(Math.round(30*(emp?1.1:1)),160,dir,{melee:true,skill:true,energy:true,col:"#e2384a",fx:"#ff8fa0"});
     ringFx(foe.x,foe.centerY,"#e2384a",50);shake=Math.max(shake,.35);
     if(emp){foe.slowT=2;foe.slowAmt=.20;statusFloat(foe,"SLOWED","#b8e6c8");f.cd[0]=Math.max(0,f.cd[0]-1);}}
    hitProps(f.x,dir,S(60),Math.round(30*(emp?1.1:1)),f,f.centerY,true);},790);},
  /* CROUCH C — Crimson Spike Trap: he THROWS a spinal spike high into the air (out of the top of the view);
     it arcs back down and lands at a distant spot, planting the hidden spike there. 60 dmg + STUN 0.7s, 4s,
     one at a time (Ranged Ready: +10% -> 66, STUN 0.9s, Energy Burn 8/s 2s). */
  f=>{f.state="special";f.t=0;const emp=useDiscipline(f,"ranged");f.crouching=true;f._cbHold=0.55;
   setTimeout(()=>{if(!running||f.state!=="special"||!f.alive)return;   /* release synced to the throw frame (cskC3), from his hand */
    const x0=MZX(f,35),y0=MZY(f,36);   /* cskC3 throwing hand */
    const targetX=Math.max(WALL_L+30,Math.min(WALL_R-30,x0+f.facing*150));   /* fixed spot ahead on the floor */
    const dx=targetX-x0,dy=GROUND-y0,len=Math.max(1,Math.hypot(dx,dy)),spd=640;   /* STRAIGHT diagonal line (no gravity) from hand to the ground target */
    projectiles.push({type:"satcspike",x:x0,y:y0,vx:spd*dx/len,vy:spd*dy/len,g:0,owner:f,col:"#e2384a",skill:true,dmg:emp?66:60,stun:emp?0.9:0.7,eburn:emp,age:0});
    statusFloat(f,"SPIKE THROWN","#e2384a");ringFx(x0,y0,"#ff2a3a",22);
    for(let s=0;s<9;s++)particles.push({x:x0,y:y0,vx:rand(-24,24),vy:-rand(70,170),r:rand(1,2.4),col:s%2?"#ff2a3a":"#ff8fa0",t:0,life:rand(.12,.3)});},350);}];

/* ULTIMATE — Crimson Cataclysm: shockwave (10) -> 4 homing spikes (4×18); first spike PARALYZES; if any
   connect, a katana Execution (60/70) with HARD KNOCKDOWN + DEFENSE BREAK. Consumes the prepared effect. */
ULTS.satori=function(f){f.state="special";f.t=0;f.ultPose=1.6;shake=Math.max(shake,.5);
  const rangedReady=(f.discT>0&&f.discPend==="ranged"),meleeReady=(f.discT>0&&f.discPend==="melee");
  f.discT=0;f.discPend=null;f._ultConn=false;
  const foe0=other(f);
  ringFx(f.x,f.centerY,"#e2384a",90);ringFx(f.x,f.centerY,"#ff8fa0",64);spawnHitFx(f.x,f.centerY,"#ff8fa0",14);
  if(foe0.alive&&Math.abs(foe0.x-f.x)<S(80))foe0.takeDamage(10,120,Math.sign(foe0.x-f.x)||f.facing,{skill:true,energy:true,col:"#e2384a",fx:"#ff8fa0"});
  const spd=rangedReady?1.1:1,para=rangedReady?1.1:0.9;
  for(let k=0;k<4;k++)setTimeout(()=>{if(!running||!f.alive)return;
   const dir=Math.sign(other(f).x-f.x)||f.facing;
   projectiles.push({type:"satult",x:f.x+dir*S(12),y:f.centerY-S(34)+S(k*18),vx:dir*380*spd,vy:(k-1.5)*45,r:7,dmg:18,owner:f,col:"#e2384a",skill:true,homing:true,para:para});},350+k*200);
  setTimeout(()=>{if(!running||!f.alive)return;const fo=other(f);
   if(f._ultConn&&fo.alive){shake=Math.max(shake,.7);
    fo.takeDamage(meleeReady?70:60,300,Math.sign(fo.x-f.x)||f.facing,{skill:true,energy:true,col:"#e2384a",fx:"#ff8fa0"});
    fo.koPose=Math.max(fo.koPose,1.4);fo.stun=Math.max(fo.stun,1.0);   /* HARD KNOCKDOWN */
    fo.defBreak=meleeReady?4:3;statusFloat(fo,"DEFENSE BREAK","#ffd23f");
    ringFx(fo.x,fo.centerY,"#e2384a",80);ringFx(fo.x,fo.centerY,"#ff8fa0",56);spawnHitFx(fo.x,fo.centerY,"#ff8fa0",20);
    for(let s=0;s<16;s++)particles.push({x:fo.x,y:fo.centerY,vx:rand(-160,160),vy:rand(-200,20),r:rand(1.5,3.5),col:s%2?"#e2384a":"#ff8fa0",t:0,life:rand(.3,.6)});}},1500);};
WIN_LINES.satori="“Master Akira taught me: strike once, strike true. The crimson spike never misses twice.”";

