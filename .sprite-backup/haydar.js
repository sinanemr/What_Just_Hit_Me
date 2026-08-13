/**
 * HAYDAR PASHA — all of Haydar's editable data + behaviour in one file.
 * Loaded AFTER js/engine.js (see RUN_GAME.html), so the shared registries
 * (CHARS, IMG_SPRITES, SPRITES, ABILITIES, ULTS, EXTRAS, WIN_LINES) and the engine
 * helpers (meleeHit, applyStun, S, MZX, announce, other, particles, projectiles,
 * shake, statusFloat, shockExplosion, hitProps, ...) already exist as globals.
 * Rendering branches specific to Haydar (drawFighter poses) remain in engine.js.
 */
"use strict";

 CHARS.push({id:"haydar", name:"Haydar Pasha", ep:"The Undying General",
  hp:650, armor:200, speed:125, jump:380, power:21,
  bio:"17th-century Ottoman general, resurrected. Regenerates 4 HP/s. Basic: curved-sword combo.",
  ab:[
   {n:"CRESCENT EXECUTION",cost:0,cd:8,kind:"melee",d:"70 dmg + BLEED 10/s for 3s."},
   {n:"PASHA'S RIFLE ASSAULT",cost:0,cd:9,kind:"ranged",d:"3-round rifle burst: 3×20 = 60 physical."},
   {n:"GUNPOWDER AMBUSH",cost:0,cd:11,kind:"ranged",d:"Rocket detonates on impact: 65 dmg + knockback & BURN in a blast."}
  ],
  ult:{n:"MECHANICAL OTTOMAN SLAP",d:"HOLD to charge (4 tiers/2s), release to slam: up to 120 dmg + stun + SHOCK 5/s for 4s."}
 });
 /* Portrait art: each key below is an animation STATE (idle/attack/hit/skillA/jump/run0/...).
    Not every hero has every state -- only the ones the game actually uses for that character.
      w / h  the size that pose is drawn at on screen -- edit these to resize just that pose
      dx     optional extra horizontal pixel offset (keeps feet from jumping sideways when
             the pose switches); safe to omit
      foot   optional extra vertical offset, same purpose as dx but up/down; safe to omit
      src    the PNG asset path (assets/characters/<id>/<state>.png) -- swap the file to change the art */
 IMG_SPRITES.haydar={
 idle:{w:80,h:80,dx:-8,foot:1,src:"assets/characters/haydar/idle.png"},
 hit:{w:38,h:72,src:"assets/characters/haydar/hit.png"},
 run0:{w:80,h:80,dx:-8,src:"assets/characters/haydar/run0.png"},
 run1:{w:80,h:80,dx:-8,src:"assets/characters/haydar/run1.png"},
 run2:{w:80,h:80,dx:-8,src:"assets/characters/haydar/run2.png"},
 run3:{w:80,h:80,dx:-8,src:"assets/characters/haydar/run3.png"},
 jump:{w:80,h:80,dx:-8,src:"assets/characters/haydar/jump.png"},
 crouch:{w:80,h:80,dx:-8,src:"assets/characters/haydar/crouch.png"},
 block:{w:80,h:80,dx:-8,src:"assets/characters/haydar/block.png"},
 ko:{w:80,h:80,dx:-8,src:"assets/characters/haydar/ko.png"},
 attack:{w:80,h:80,dx:-8,src:"assets/characters/haydar/attack.png"},
 attack2:{w:80,h:80,dx:-8,src:"assets/characters/haydar/attack2.png"},
 attack3:{w:80,h:80,dx:-8,src:"assets/characters/haydar/attack3.png"},
 skillA:{w:80,h:80,dx:-8,src:"assets/characters/haydar/skillA.png"},
 skillA2:{w:80,h:80,dx:-8,src:"assets/characters/haydar/skillA2.png"},
 skillB:{w:80,h:80,dx:-8,src:"assets/characters/haydar/skillB.png"},
 skillBc:{w:80,h:80,dx:-8,src:"assets/characters/haydar/skillBc.png"},
 skillC:{w:80,h:80,dx:-8,src:"assets/characters/haydar/skillC.png"},
 ult1:{w:80,h:80,dx:-8,src:"assets/characters/haydar/ult1.png"},
 ult2:{w:80,h:80,dx:-8,src:"assets/characters/haydar/ult2.png"}
};
 /* Fallback pixel-art -- only used if this hero has no matching key up in IMG_SPRITES above.
      pal  one-letter color code -> hex color. Edit a hex value to recolor that part
           everywhere it appears in the grid below (e.g. change p's value to recolor the coat).
      g    the sprite itself: an array of 16-characters-wide text rows, one row per pixel row.
           Each character is a pal letter (or "." for transparent). Edit the letters to
           redraw the pixel art by hand -- keep every row exactly 16 characters. */
 SPRITES.haydar={pal:{p:"#a41d2c",P:"#6d1120",g:"#e8c15a",s:"#caa27a",S:"#a8825e",h:"#3a2a20",t:"#3d2f35",k:"#26120a",e:"#1a1210"},g:[
"......pppp......",
".....pppppp.....",
".....gggggg.....",
".....ssssss.....",
".....sesses.....",
".....ssssss.....",
".....hhhhhh.....",
"......shhs......",
".......ss.......",
"...pppppppppp...",
"..ppppppggpppp..",
"..ppppppggpppp..",
"..ppppppggpppp..",
"..pPppppggppPp..",
"..s.pppppppp.s..",
"....pppppppp....",
"....pppppppp....",
"....pppppppp....",
"....gggggggg....",
"....tttttttt....",
".....ttt.ttt....",
".....ttt.ttt....",
".....ttt.ttt....",
".....ttt.ttt....",
".....ttt.ttt....",
".....kkk.kkk....",
".....kkk.kkk....",
".....kkk.kkk....",
"....kkkk.kkkk...",
]};
 /* Skill CODE: the 3 functions below are P1 ability slots / P2-CPU slots in that order -- same
    order as this hero's ab:[...] array up in CHARS.push(...), so entry [0] here is what
    ab[0]'s name/cooldown/description above are describing, and so on.
      f        the fighter casting the skill (their live in-game state)
      other(f) the opponent
    Helpers used throughout every hero's skills below:
      meleeHit(f,{range,dmg,kb,opts})               simple melee hit in front of f
      foe.takeDamage(amount,knockback,dir,{...opts}) direct damage (ranged/AoE hits, etc.)
      projectiles.push({...})                        spawn a traveling projectile
      announce("TEXT",ms)                            pop the on-screen skill-name banner
    Easiest way to add/change a skill: copy a similar existing hero's function as a starting
    point rather than writing one from scratch. */
 ABILITIES.haydar=[
  f=>{f.state="special";f.t=0;f.skillAT=0.6;f.poseSkill=0;announce("CRESCENT EXECUTION!",700);
   /* two curved-sword strikes; the 2nd applies BLEED. skillAT drives the skillA->skillA2 pose flip. */
   meleeHit(f,{range:S(54),dmg:35,kb:50,delay:130,opts:{skill:true,col:"#d9dee6",fx:"#eef2f6"}});
   meleeHit(f,{range:S(54),dmg:35,kb:170,delay:360,opts:{skill:true,col:"#d9dee6",fx:"#eef2f6"},onHit:foe=>{
    foe.bleedDps=10;foe.bleed=Math.max(foe.bleed,3);statusFloat(foe,"BLEED","#ff5e6e");}});},
  f=>{f.state="special";f.t=0;f.skillBT=0.5;f.poseSkill=1;f._skBc=f.crouching?1:0;announce("RIFLE ASSAULT!",600);
   /* Pasha's Rifle Assault: 3-round burst, 20 dmg each. crouch-aware muzzle height + pose. */
   [70,190,310].forEach(d=>setTimeout(()=>{if(!running)return;
    const my=f._skBc?f.centerY-S(15):f.centerY-S(15), mx=MZX(f,18);
    projectiles.push({type:"bullet",x:mx,y:my,vx:f.facing*560,vy:0,r:2,dmg:20,owner:f,col:"#ffd23f",ballistic:true,skill:true});
    for(let i=0;i<4;i++)particles.push({x:mx,y:my,vx:f.facing*rand(60,150),vy:rand(-45,45),r:rand(1,2),col:"#ffd23f",t:0,life:.12});
   },d));},
  f=>{f.state="special";f.t=0;f.poseSkill=2;announce("GUNPOWDER AMBUSH!",700);
   /* shoulder-launched rocket: detonates on impact for radius damage + knockback + burn */
   setTimeout(()=>{if(!running)return;
    const mx=MZX(f,22),my=f.centerY-S(25);
    projectiles.push({type:"rocket",x:mx,y:my,vx:f.facing*300,vy:0,r:6,dmg:65,owner:f,col:"#f28022"});
    for(let i=0;i<10;i++)particles.push({x:mx-f.facing*S(10),y:my,vx:-f.facing*rand(60,180),vy:rand(-40,40),r:rand(1.5,3),col:["#ffd23f","#f28022","#8c8c8c"][i%3],t:0,life:rand(.15,.35)});
    shake=Math.max(shake,.3);
   },160);}];

ULTS.haydar=function(f){const tier=f._ultTier||4;
  const dmg=[30,60,90,120][tier-1],kb=[160,240,320,420][tier-1],stun=[0.4,0.6,0.9,1.3][tier-1],shk=tier;
  announce("MECHANICAL OTTOMAN SLAP!",1100);f.state="special";f.t=0;f.vx=0;
  setTimeout(()=>{if(!running)return;const foe=other(f);
   if(foe.alive&&Math.abs(foe.x-f.x)<S(62)&&Math.abs(foe.hurtY-f.centerY)<S(60)){
    foe.takeDamage(dmg,kb,f.facing,{melee:true,skill:true,ult:true,col:"#8fd8ff",fx:"#bfeaff"});
    applyStun(foe,stun);
    foe.shockDps=5;foe.shock=Math.max(foe.shock,shk);statusFloat(foe,"SHOCK","#8fd8ff");
    shockExplosion(foe.x,foe.centerY);shake=Math.max(shake,.5+tier*0.1);}
   hitProps(f.x,f.facing,62,dmg,f);
  },220);};

 /* HAYDAR — electricity crawling around the raised mechanical fist while charging the ult */
EXTRAS.haydar=function(g,f,t){
  if(!f.ultCharging)return;
  const full=f.ultChargeT>=2,fc=f.facing;
  const tipx=-21*fc,tipy=-63,basex=-2*fc,basey=-40;      /* shoulder -> raised fist */
  const dx=tipx-basex,dy=tipy-basey,len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len;
  const bolts=full?4:2+Math.floor(f.ultChargeT);
  g.save();g.lineCap="round";
  for(let b=0;b<bolts;b++){
   const segs=7,phase=t*40+b*2.1+Math.random()*3,amp=(full?5:3)+Math.random()*2;
   g.beginPath();g.moveTo(basex,basey);
   for(let s=1;s<=segs;s++){const u=s/segs,env=Math.sin(u*Math.PI);   /* env bulges the arc around the arm */
    const off=Math.sin(u*7+phase)*amp*env+(Math.random()-.5)*2.2;
    g.lineTo(basex+dx*u+nx*off,basey+dy*u+ny*off);}
   g.strokeStyle=(b%2)?"#eaffff":(full?"#bfeaff":"#8fd8ff");
   g.lineWidth=(b===0?1.6:1)*(full?1.3:1);g.globalAlpha=.5+Math.random()*.5;g.stroke();
  }
  const gr=g.createRadialGradient(tipx,tipy,0,tipx,tipy,full?14:9);   /* glowing core at the fist */
  gr.addColorStop(0,full?"rgba(234,255,255,.9)":"rgba(143,216,255,.7)");
  gr.addColorStop(1,"rgba(143,216,255,0)");
  g.globalAlpha=full?.9:.55;g.fillStyle=gr;g.beginPath();g.arc(tipx,tipy,full?14:9,0,6.283);g.fill();
  g.globalAlpha=1;g.restore();
 };

WIN_LINES.haydar="“Three centuries of war, and still no worthy foe. The Orb returns with me to the empire that never fell.”";
