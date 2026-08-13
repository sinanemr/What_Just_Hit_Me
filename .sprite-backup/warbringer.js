/**
 * WARBRINGER — all of this fighter's editable data + behaviour in one file.
 * Loaded AFTER js/engine.js, so the shared registries (CHARS, IMG_SPRITES, SPRITES,
 * ABILITIES, ULTS, EXTRAS, EXTRAS_BEHIND, WIN_LINES) and the engine helpers already exist.
 * Character-specific drawFighter render branches remain in engine.js.
 */
"use strict";


/* ==================== WARBRINGER ==================== */
 CHARS.push({id:"warbringer", name:"Warbringer", ep:"Damien — One-Man Apocalypse",
  hp:500, armor:180, speed:150, jump:400, power:30,
  bio:"Tactical bruiser. Combat Instincts: +10% crit. Reinforced Armor: after 4s undamaged, regens 10 Armor/s until hit.",
  ab:[
   {n:"TEMPEST BLADES",cost:0,cd:7,kind:"melee",d:"Both wrist blades: 90 total (65 physical + 25 electric), 25% to PARALYZE 1s."},
   {n:"REAPER'S EDGE",cost:0,cd:10,kind:"melee",d:"Combat knife: 100 dmg + BLEED 15/s 2s. 15% BIG CRIT (+50%)."},
   {n:"STORMBREAKER SMG",cost:0,cd:11,kind:"ranged",d:"5-round burst: 20 dmg each, can crit, ignores 20% Armor. Partly dodgeable/blockable."}
  ],
  ult:{n:"ADRENALINE SURGE",d:"Adrenaline X 8s: +40% dmg, -25% taken, ignore 15% Armor, paralysis & bleed empowered. Then CRASH: -50 HP, -15% dmg & accuracy 3s."}
 });
 IMG_SPRITES.warbringer={
 idle:{w:46,h:72,src:"assets/characters/warbringer/idle.png"},
 attack:{w:77,h:71,src:"assets/characters/warbringer/attack.png"},
 attack2:{w:61,h:73,src:"assets/characters/warbringer/attack2.png"},
 hit:{w:64,h:71,src:"assets/characters/warbringer/hit.png"},
 block:{w:48,h:73,src:"assets/characters/warbringer/block.png"},
 crouch:{w:61,h:57,src:"assets/characters/warbringer/crouch.png"},
 jump:{w:49,h:78,src:"assets/characters/warbringer/jump.png"},
 ko:{w:77,h:28,src:"assets/characters/warbringer/ko.png"},
 skillA:{w:95,h:73,src:"assets/characters/warbringer/skillA.png"},
 skillB:{w:88,h:72,src:"assets/characters/warbringer/skillB.png"},
 skillC:{w:83,h:72,src:"assets/characters/warbringer/skillC.png"},
 ult:{w:63,h:72,src:"assets/characters/warbringer/ult.png"},
 run0:{w:72,h:72,src:"assets/characters/warbringer/run0.png"},
 run1:{w:72,h:72,src:"assets/characters/warbringer/run1.png"},
 run2:{w:72,h:72,src:"assets/characters/warbringer/run2.png"},
 run3:{w:72,h:72,src:"assets/characters/warbringer/run3.png"},
 run4:{w:72,h:72,src:"assets/characters/warbringer/run4.png"}
};
 ABILITIES.warbringer=[
  f=>{f.state="special";f.t=0;announce("TEMPEST BLADES!",600);
   meleeHit(f,{range:S(48),dmg:65,kb:60,delay:80,opts:{skill:true,col:"#9fb8c9",fx:"#9fb8c9"}});
   meleeHit(f,{range:S(48),dmg:25,kb:100,delay:210,opts:{skill:true,col:"#5ec8ff",fx:"#5ec8ff"},onHit:foe=>{
    if(chance(f,.25)){applyStun(foe,f.surge>0?1.3:1);statusFloat(foe,"PARALYZED","#5ec8ff");}}});},
  f=>{f.state="special";f.t=0;announce("REAPER'S EDGE!",650);
   let dmg=100;if(Math.random()<.15){dmg=150;setTimeout(()=>announce("BIG CRIT!",600),200);}
   meleeHit(f,{range:S(50),dmg,kb:140,opts:{skill:true,col:"#e2384a",fx:"#e2384a"},onHit:foe=>{
    foe.bleedDps=f.surge>0?18:15;foe.bleed=Math.max(foe.bleed,2);statusFloat(foe,"BLEED","#ff5e6e");}});},
  f=>{f.state="special";f.t=0;announce("STORMBREAKER SMG!",650);
   for(let i=0;i<5;i++)setTimeout(()=>{if(!running)return;
    /* muzzle = SMG barrel tip, authored in sprite space -> world */
    const mzx=MZX(f,40), mzy=MZY(f,56);
    projectiles.push({type:"smg",x:mzx,y:mzy+rand(-2,2),vx:f.facing*(f.surge>0?560:500),vy:0,r:2,dmg:20,owner:f,col:"#9fb8c9",pierce:.2,ballistic:true,skill:true});
    particles.push({x:mzx,y:mzy,vx:f.facing*rand(40,110),vy:rand(-40,40),r:1,col:"#ffd23f",t:0,life:.12});},i*(f.surge>0?90:110));}];

for(const id in SPRITES){ SPRITES[id].g = SPRITES[id].g.map(r=>(r||"").padEnd(16,".")); }

ULTS.warbringer=function(f){announce("ADRENALINE SURGE",1100);f.state="special";f.t=0;
  f.surge=8;statusFloat(f,"SURGE","#ffd23f");ringFx(f.x,f.centerY,"#ffd23f",60);};
 warbringer:"“Mission complete. No witnesses, no survivors, no exceptions. Tell them the Warbringer was here — if anyone is left to tell.”"


