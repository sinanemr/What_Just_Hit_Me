/**
 * PINCH-HEAD NECMI — all of this fighter's editable data + behaviour in one file.
 * Loaded AFTER js/engine.js, so the shared registries (CHARS, IMG_SPRITES, SPRITES,
 * ABILITIES, ULTS, EXTRAS, EXTRAS_BEHIND, WIN_LINES) and the engine helpers already exist.
 * Character-specific drawFighter render branches remain in engine.js.
 */
"use strict";


/* ==================== PINCH-HEAD NECMI ==================== */
 CHARS.push({id:"necmi", name:"Pinch-Head Necmi", ep:"The Mind Pincher",
  hp:490, armor:170, speed:145, jump:468, power:30,
  bio:"Control & health-drain. Elastic Body: -10% melee damage taken. Chaotic Feed: CONFUSE or STUN heals 10 HP (5s cd). Basic: elastic punches.",
  ab:[
   {n:"PINCH-MASS SHOT",cost:0,cd:8,kind:"ranged",d:"50 dmg, heals 15 HP, CONFUSE 1s. Heals 25 with Chaotic Feed."},
   {n:"LIMB HIJACK",cost:0,cd:10,kind:"ranged",d:"60 dmg, disables the foe's normal attacks 1.2s (skills & Ult still work)."},
   {n:"MASS MORPH",cost:0,cd:12,kind:"buff",d:"4s shell: 100-pt shield, melee attackers take 10, heals 15 HP when it ends."}
  ],
  ult:{n:"ASTRAL POSSESSION",d:"100 dmg, STUN 1.2s, drains 10% of foe's Ult, heals 15 HP (+10 via Chaotic Feed). Backlash: -20 HP."}
 });
 IMG_SPRITES.necmi={
 idle:{w:28,h:72,src:"assets/characters/necmi/idle.png"},
 attack:{w:78,h:63,src:"assets/characters/necmi/attack.png"},
 attack2:{w:75,h:70,src:"assets/characters/necmi/attack2.png"},
 attack3:{w:77,h:71,src:"assets/characters/necmi/attack3.png"},
 hit:{w:40,h:68,src:"assets/characters/necmi/hit.png"},
 block:{w:61,h:69,src:"assets/characters/necmi/block.png"},
 crouch:{w:32,h:56,src:"assets/characters/necmi/crouch.png"},
 jump:{w:50,h:62,src:"assets/characters/necmi/jump.png"},
 ko:{w:78,h:39,src:"assets/characters/necmi/ko.png"},
 skillA:{w:58,h:68,src:"assets/characters/necmi/skillA.png"},
 skillA2:{w:48,h:70,src:"assets/characters/necmi/skillA2.png"},
 pinchmass:{w:20,h:15,src:"assets/characters/necmi/pinchmass.png"},
 skillB:{w:49,h:71,src:"assets/characters/necmi/skillB.png"},
 hijackwalker:{w:62,h:30,src:"assets/characters/necmi/hijackwalker.png"},
 hijackwalker2:{w:58,h:25,src:"assets/characters/necmi/hijackwalker2.png"},
 hijackwalker3:{w:58,h:29,src:"assets/characters/necmi/hijackwalker3.png"},
 hijackswarm:{w:44,h:58,src:"assets/characters/necmi/hijackswarm.png"},
 skillB3:{w:44,h:58,src:"assets/characters/necmi/skillB3.png"},
 run0:{w:41,h:70,src:"assets/characters/necmi/run0.png"},
 run1:{w:36,h:70,src:"assets/characters/necmi/run1.png"},
 run2:{w:46,h:70,src:"assets/characters/necmi/run2.png"},
 run3:{w:35,h:70,src:"assets/characters/necmi/run3.png"},
 skillC:{w:51,h:70,src:"assets/characters/necmi/skillC.png"},
 skillC2:{w:66,h:71,src:"assets/characters/necmi/skillC2.png"},
 skillC3:{w:54,h:71,src:"assets/characters/necmi/skillC3.png"},
 skillC4:{w:63,h:66,src:"assets/characters/necmi/skillC4.png"},
 ult:{w:41,h:71,src:"assets/characters/necmi/ult.png"},
 ghostfly:{w:66,h:46,src:"assets/characters/necmi/ghostfly.png"},
 ghostfly2:{w:52,h:46,src:"assets/characters/necmi/ghostfly2.png"},
 ghostpossess:{w:41,h:52,src:"assets/characters/necmi/ghostpossess.png"},
 ghostpossess2:{w:54,h:68,src:"assets/characters/necmi/ghostpossess2.png"}
};
 ABILITIES.necmi=[
  f=>{f.state="special";f.t=0;announce("PINCH-MASS SHOT!",650);
   f.skillAT=0.85;f.skillLock=0.85;f.poseSkill=0;       /* hold wind-up, then snap to release */
   const dir=f.facing;
   setTimeout(()=>{if(!running||!f.alive||f.state!=="special")return;   /* launch exactly as the arm snaps forward */
    projectiles.push({type:"pinch",x:MZX(f,20),y:f.centerY-S(6),vx:dir*300,vy:0,r:6,dmg:50,owner:f,col:"#b36bff",skill:true,
     wob:Math.random()*6.28});},370);},
  f=>{f.state="special";f.t=0;announce("LIMB HIJACK!",650);
   f.skillBT=0.55;f.skillLock=0.55;f.poseSkill=1;         /* hold the pointing cast pose */
   const dir=f.facing;
   setTimeout(()=>{if(!running||!f.alive||f.state!=="special")return;   /* release the ground-walker on the point */
    projectiles.push({type:"hijack",x:MZX(f,20),y:GROUND,vx:dir*230,vy:0,r:6,dmg:60,owner:f,col:"#e8b52e",skill:true,
     wob:Math.random()*6.28,ground:true});},260);},
  f=>{f.state="special";f.t=0;announce("MASS MORPH!",700);
   f.morph=4;f.morphShield=100;f._morphBroke=false;statusFloat(f,"SHIELD 100","#8f6bff");ringFx(f.x,f.centerY,"#b36bff",45);}];

ULTS.necmi=function(f){announce("ASTRAL POSSESSION",1100);f.state="special";f.t=0;const foe=other(f);
  f.ultPose=2.6;f.vx=0;                          /* hold the cast pose while the spirit works */
  shake=Math.max(shake,.4);
  const warded=foe.d.id==="munevver";            /* Collector of Powers resists the control, but the spirit is still SEEN */
  const dir=Math.sign(foe.x-f.x)||f.facing;
  /* spawn the blue spirit — it flies from Necmi to BEHIND the enemy (always, even vs Munevver) */
  const backX=foe.x+dir*S(22);                   /* land behind the foe */
  projectiles.push({type:"ghost",x:MZX(f,10),y:f.centerY-S(4),tx:backX,ty:foe.centerY-S(6),
   t0:tGlobal,dur:0.85,owner:f,foe:foe,dir:dir,wob:0,skill:true,done:false});
  /* possession lands after the spirit arrives (~0.5s) */
  setTimeout(()=>{if(!running||!foe.alive)return;
   if(warded){statusFloat(foe,"WARDED","#f2b632");}
   else{foe.stun=Math.max(foe.stun,1.2);foe.silence=Math.max(foe.silence,1.2);foe.vx=0;
    statusFloat(foe,"POSSESSED","#6b8cff");
    foe.meter=Math.max(0,foe.meter-10);}         /* drain 10% of foe Ult meter */
   foe._possessT=1.5;foe._possessDir=dir;        /* ghost clings at their back — shown even when warded */
   ringFx(foe.x,foe.centerY,"#6b8cff",70);shake=Math.max(shake,.4);},850);
  setTimeout(()=>{if(!running||!foe.alive)return;
   announce("SELF STRIKE!",700);
   const sd=warded?50:100;                        /* warded foe still takes the strike, at reduced true dmg */
   foe.takeDamage(sd,120,Math.sign(foe.x-f.x)||1,{skill:true,ult:true,energy:!warded,trueDmg:warded,unblockable:true,col:"#6b8cff",fx:"#6b8cff"});
   f.hp=Math.min(f.maxhp,f.hp+15);statusFloat(f,"+15","#8f6bff");chaoticFeed(f);
   f.hp=Math.max(1,f.hp-20);statusFloat(f,"BACKLASH -20","#e2384a");},1700);};
WIN_LINES.necmi=" HAHA HAHA HAHA!!!. I pinch everything and everything pinches me!”";

