/**
 * AGRON — all of this fighter's editable data + behaviour in one file.
 * Loaded AFTER js/engine.js, so the shared registries (CHARS, IMG_SPRITES, SPRITES,
 * ABILITIES, ULTS, EXTRAS, EXTRAS_BEHIND, WIN_LINES) and the engine helpers already exist.
 * Character-specific drawFighter render branches remain in engine.js.
 */
"use strict";


/* ==================== AGRON THE VAMPIRE ==================== */
 CHARS.push({id:"agron", name:"Agron the Vampire", ep:"Arcanite Nightmare",
  hp:575, armor:175, speed:150, jump:450, power:30,
  bio:"A vampire of the Arcanite dimension. Ten-ton strength, flight, regeneration — and a thirst.",
  ab:[
   {n:"DARK MATTER REND",cost:0,cd:8,kind:"melee",d:"Two claw slashes: 70 dark dmg + BLEED 2s."},
   {n:"BLOOD SEIZE",cost:0,cd:10,kind:"melee",d:"Unblockable grab + slam: 50 dmg, heals 15 (20 when hurt). Short range."},
   {n:"GRAVITY DIVE",cost:0,cd:10,kind:"melee",d:"Dives claws-first: 65 dmg, passes over low attacks."}
  ],
  ult:{n:"BLOOD X CLAWS",d:"X-shaped blood slash across the arena: 110 dark dmg + BLEED, then BLOOD FRENZY."}
 });
 IMG_SPRITES.agron={
 idle:{w:70,h:72,dx:2,src:"assets/characters/agron/idle.png"},
 run0:{w:79,h:71,foot:1,dx:5,src:"assets/characters/agron/run0.png"},
 jump:{w:68,h:69,foot:2,dx:4,src:"assets/characters/agron/jump.png"},
 fly:{w:62,h:72,foot:3,dx:-1,src:"assets/characters/agron/fly.png"},
 crouch:{w:70,h:55,dx:-4,src:"assets/characters/agron/crouch.png"},
 block:{w:69,h:70,dx:-6,src:"assets/characters/agron/block.png"},
 hit:{w:47,h:76,dx:-2,src:"assets/characters/agron/hit.png"},
 ko:{w:84,h:26,foot:1,dx:1,src:"assets/characters/agron/ko.png"},
 attack:{w:72,h:71,dx:7,src:"assets/characters/agron/attack.png"},
 attack2:{w:86,h:67,dx:10,src:"assets/characters/agron/attack2.png"},
 attack3:{w:75,h:75,dx:8,src:"assets/characters/agron/attack3.png"},
 skillA:{w:88,h:47,dx:16,src:"assets/characters/agron/skillA.png"},
 skillB:{w:90,h:72,foot:3,dx:9,src:"assets/characters/agron/skillB.png"},
 skillB2:{w:69,h:69,foot:1,dx:5,src:"assets/characters/agron/skillB2.png"},
 skillB3:{w:69,h:72,dx:1,src:"assets/characters/agron/skillB3.png"},
 skillB4:{w:90,h:72,dx:8,src:"assets/characters/agron/skillB4.png"},
 skillC:{w:94,h:89,foot:7,dx:1,src:"assets/characters/agron/skillC.png"},
 skillC2:{w:98,h:96,foot:1,dx:9,src:"assets/characters/agron/skillC2.png"},
 skillC3:{w:97,h:77,dx:6,src:"assets/characters/agron/skillC3.png"},
 ult1:{w:88,h:72,dx:2,src:"assets/characters/agron/ult1.png"},
 ult2:{w:83,h:69,dx:4,src:"assets/characters/agron/ult2.png"}
};
 SPRITES.agron={pal:{p:"#1a1424",P:"#0e0a16",C:"#5e1220",a:"#9c1d2e",s:"#cfd6de",S:"#a7b0bc",h:"#0c0c14",w:"#ffffff",e:"#e2384a",k:"#2a0e18"},g:[
"......hhhh......",
".....hhhhhh.....",
".....hssssh.....",
".....sesses.....",
".....ssssss.....",
".....swswss.....",
"......ssss......",
".......ss.......",
".CppppppppppppC.",
".CppppaappppppC.",
".CppppaappppppC.",
".CppppppppppppC.",
".CpPppppppppPpC.",
".Cs.pppppppp.sC.",
".C..pppppppp..C.",
".C..pppppppp..C.",
".CC.pppppppp.CC.",
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
 ABILITIES.agron=[
  /* A — DARK MATTER REND: two frontal claw slashes, dark dmg + bleed */
  f=>{f.state="special";f.t=0;f.skStage=0.5;announce("DARK MATTER REND!",650);
   meleeHit(f,{range:S(46),dmg:35,kb:40,delay:60,opts:{skill:true,col:"#8f6cf0",fx:"#a07cff"},
    onHit:foe=>{bloodSplash(foe.x,foe.centerY-S(4),14,f.facing);}});
   meleeHit(f,{range:S(46),dmg:35,kb:110,delay:200,opts:{skill:true,col:"#8f6cf0",fx:"#a07cff"},onHit:foe=>{
    foe.bleedDps=10;foe.bleed=Math.max(foe.bleed,2);statusFloat(foe,"BLEED","#ff5e6e");
    bloodSplash(foe.x,foe.centerY-S(2),20,f.facing);
    bloodDrops(foe.x,foe.centerY,10,{spread:1.4,up:1});}});},
  /* B — BLOOD SEIZE: charge in, grab, bite, then SMASH them into the ground */
  f=>{f.state="special";f.t=0;announce("BLOOD SEIZE!",650);
   f.seizeT=0.30;f.seizeHit=false;f.grabT=0;
   f._grabbed=false;f._bit=false;f._smashed=false;      /* clear stale stage flags */
   const foe0=other(f);if(foe0)foe0.koPose=0;},
  /* C — GRAVITY DIVE: fly up, dive forward with both claws */
  f=>{f.state="special";f.t=0;f.diveT=1.15;f.skStage=1.15;announce("GRAVITY DIVE!",650);
   f.onGround=false;f.vy=-470;f.jumps=2;f._diveHit=false;
   ringFx(f.x,f.centerY,"#8f6cf0",40);}];

ULTS.agron=function(f){announce("BLOOD X CLAWS",1100);f.state="special";f.t=0;
  f.ultPose=1.4;f.poseSkill=-1;f.vx=0;f._ultHalf=0.84;    /* ult1 roar -> ult2 cross slash */
  shake=Math.max(shake,.7);ringFx(f.x,f.centerY,"#e2384a",120);
  bloodSplash(f.x,f.centerY-S(6),24,1);bloodSplash(f.x,f.centerY-S(6),24,-1);
  bloodDrops(f.x,f.centerY-S(10),22,{spread:2.4,up:1.6,force:1.25});
  /* the X flies out as he crosses his claws */
  setTimeout(()=>{if(!running||!f.alive)return;
   projectiles.push({type:"xslash",x:MZX(f,20),y:f.centerY-S(4),vx:f.facing*420,vy:0,r:14,
    dmg:110,owner:f,col:"#e2384a",skill:true,dark:true,spin:0});
   shake=Math.max(shake,.45);
   bloodSplash(MZX(f,20),f.centerY-S(4),18,f.facing);
   bloodDrops(MZX(f,16),f.centerY-S(4),12,{spread:1.5,up:.8,dir:f.facing,force:1.1});},560);
  /* BLOOD FRENZY */
  f.frenzy=4;f.spdBuff=Math.max(f.spdBuff,0);statusFloat(f,"BLOOD FRENZY","#e2384a");};
EXTRAS.agron=function(g,f,t){const wig=Math.sin(t*3)>0?0:-2;g.fillStyle="#5e1220";
  g.fillRect(-f.facing*15+(f.facing===1?wig:-wig)-1,-26,2,8);
  const fx=f.facing;
  /* ---- A: DARK MATTER REND — twin blood arcs sweeping across ---- */
  if(f.skStage>0&&f.poseSkill===0){
   const p=Math.max(0,Math.min(1,1-f.skStage/0.5));
   g.save();g.globalCompositeOperation="lighter";
   for(let k=0;k<2;k++){
    const q=Math.max(0,Math.min(1,(p-k*0.28)/0.5));
    if(q<=0||q>=1)continue;
    g.globalAlpha=(1-q)*0.85;
    g.strokeStyle=k?"#e2384a":"#9c1d2e";g.lineWidth=3-k;
    g.beginPath();
    const a0=-1.5+k*0.5, a1=a0+2.1*q;
    g.arc(fx*12,-34+k*8,26,a0*fx,a1*fx,fx<0);
    g.stroke();
    /* droplets flung off the arc tip */
    for(let i=0;i<3;i++){
     const ang=(a0+2.1*q)*fx+i*0.16;
     g.globalAlpha=(1-q)*0.7;
     g.fillStyle="#e2384a";
     g.fillRect(Math.round(fx*12+Math.cos(ang)*(26+i*3)),Math.round(-34+k*8+Math.sin(ang)*(26+i*3)),2,2);
    }
   }
   g.restore();
  }
  /* ---- B: BLOOD SEIZE — spray on the bite, burst on the smash ---- */
  if(f.grabT>0){
   const p=Math.max(0,Math.min(1,1-f.grabT/0.72));
   g.save();g.globalCompositeOperation="lighter";
   if(p>0.30&&p<0.62){                      /* feeding: blood runs from the bite */
    const q=(p-0.30)/0.32;
    g.globalAlpha=0.9*(1-q*0.4);
    g.fillStyle="#9c1d2e";
    for(let i=0;i<6;i++){
     const ph=(t*2.4+i*0.7)%1;
     g.fillRect(Math.round(fx*20+Math.sin(i*2.3+t*4)*3),Math.round(-38+ph*30),2,Math.round(2+ph*3));
    }
    g.globalAlpha=0.5+Math.sin(t*18)*0.2;   /* pulse as he drinks */
    g.fillStyle="#e2384a";
    g.fillRect(fx*16,-42,4,4);
   }
   if(p>=0.62){                             /* SMASH: ground splatter */
    const q=Math.max(0,Math.min(1,(p-0.62)/0.38));
    g.globalAlpha=(1-q)*0.9;
    g.fillStyle="#9c1d2e";
    for(let i=0;i<9;i++){
     const a=(i/9)*Math.PI+0.15, r=6+q*30;
     g.fillRect(Math.round(fx*18+Math.cos(a)*r*fx),Math.round(-Math.abs(Math.sin(a))*r*0.5-1),3,2);
    }
    g.globalAlpha=(1-q)*0.6;g.fillStyle="#e2384a";
    g.beginPath();g.ellipse(fx*18,-1,10+q*22,3+q*3,0,0,7);g.fill();
   }
   g.restore();
  }
  /* ---- C: GRAVITY DIVE — blood mist trailing the dive ---- */
  if(f.diveT>0){
   const p=Math.max(0,Math.min(1,1-f.diveT/0.72));
   if(p>0.44){
    g.save();g.globalCompositeOperation="lighter";
    for(let i=0;i<5;i++){
     g.globalAlpha=0.5-i*0.08;
     g.fillStyle=i%2?"#9c1d2e":"#e2384a";
     g.fillRect(Math.round(-fx*(6+i*7)),Math.round(-40+i*4+Math.sin(t*9+i)*3),3,2);
    }
    g.restore();
   }
  }
  if(f.slamT>0){                            /* dive impact splatter */
   const q=Math.max(0,Math.min(1,1-f.slamT/0.34));
   g.save();g.globalCompositeOperation="lighter";
   g.globalAlpha=(1-q)*0.75;g.fillStyle="#9c1d2e";
   for(let i=0;i<8;i++){
    const a=(i/8)*Math.PI, r=8+q*34;
    g.fillRect(Math.round(Math.cos(a)*r),Math.round(-Math.abs(Math.sin(a))*r*0.45-1),3,2);
   }
   g.restore();
  }
  /* ---- PASSIVE: ARCANITE BODY — armour plating flares as it absorbs a hit ---- */
  if(f._arcT>0){
   const q=1-Math.max(0,f._arcT)/0.42;
   g.save();
   g.globalAlpha=(1-q)*0.85;
   /* hard-edged shell flashing over his torso */
   g.strokeStyle="#cfe4f5";g.lineWidth=2;
   g.beginPath();g.ellipse(0,-36,16+q*7,26+q*6,0,0,7);g.stroke();
   g.globalAlpha=(1-q)*0.5;
   g.strokeStyle="#8fa8bf";g.lineWidth=1;
   g.beginPath();g.ellipse(0,-36,11+q*9,20+q*8,0,0,7);g.stroke();
   /* deflection sparks skidding off the plate */
   g.globalCompositeOperation="lighter";
   for(let i=0;i<5;i++){
    const a=(i/5)*6.283+t*3;
    g.globalAlpha=(1-q)*0.8;
    g.fillStyle=i%2?"#cfe4f5":"#8fa8bf";
    g.fillRect(Math.round(Math.cos(a)*(16+q*10)),Math.round(-36+Math.sin(a)*(24+q*8)),2,2);
   }
   g.restore();
  }
  /* ---- PASSIVE: BLOOD HUNGER — he drinks deeper when wounded ---- */
  if(f._hungerT>0){
   const q=1-Math.max(0,f._hungerT)/1.4;
   g.save();g.globalCompositeOperation="lighter";
   /* blood pulled up into him */
   for(let i=0;i<8;i++){
    const ph=(q*1.6+i*0.13)%1;
    g.globalAlpha=(1-q)*(1-ph)*0.9;
    g.fillStyle=i%2?"#ff5e6e":"#9c1d2e";
    const rr=26*(1-ph);
    const a=i*0.785+t*2;
    g.fillRect(Math.round(Math.cos(a)*rr),Math.round(-36+Math.sin(a)*rr*0.7),2,2);
   }
   /* heart-beat pulse */
   const beat=0.5+Math.abs(Math.sin(t*11))*0.5;
   g.globalAlpha=(1-q)*beat*0.55;
   const hg=g.createRadialGradient(0,-36,2,0,-36,22);
   hg.addColorStop(0,"rgba(255,94,110,.75)");
   hg.addColorStop(1,"rgba(120,10,25,0)");
   g.fillStyle=hg;g.beginPath();g.arc(0,-36,22,0,7);g.fill();
   g.restore();
  }
  /* ---- PASSIVE: SUNLIGHT — it burns him ---- */
  if(f._sunT>0){
   const q=1-Math.max(0,f._sunT)/1.2;
   g.save();g.globalCompositeOperation="lighter";
   g.globalAlpha=(1-q)*0.9;
   const sg=g.createRadialGradient(0,-40,3,0,-40,30);
   sg.addColorStop(0,"rgba(255,243,192,.9)");
   sg.addColorStop(.5,"rgba(255,215,106,.5)");
   sg.addColorStop(1,"rgba(255,140,20,0)");
   g.fillStyle=sg;g.beginPath();g.arc(0,-40,30,0,7);g.fill();
   /* smoke rising off the burn */
   for(let i=0;i<6;i++){
    const ph=(t*1.5+i*0.6)%1;
    g.globalAlpha=(1-q)*(1-ph)*0.7;
    g.fillStyle=i%2?"#ffd76a":"#fff3c0";
    g.fillRect(Math.round(Math.sin(i*2+t*3)*10),Math.round(-46-ph*30),2,2);
   }
   g.restore();
  }
  /* ---- ULT: blood aura while BLOOD FRENZY burns ---- */
  if(f.frenzy>0){
   g.save();g.globalCompositeOperation="lighter";
   const pulse=0.35+Math.abs(Math.sin(t*5))*0.3;
   g.globalAlpha=pulse*0.5;
   const gr=g.createRadialGradient(0,-34,4,0,-34,30);
   gr.addColorStop(0,"rgba(226,56,74,.5)");
   gr.addColorStop(1,"rgba(120,10,25,0)");
   g.fillStyle=gr;g.beginPath();g.arc(0,-34,30,0,7);g.fill();
   /* blood motes rising off him */
   for(let i=0;i<6;i++){
    const ph=(t*1.1+i*0.7)%1;
    g.globalAlpha=(1-ph)*pulse;
    g.fillStyle=i%2?"#e2384a":"#9c1d2e";
    g.fillRect(Math.round(Math.sin(i*2.1+t*2)*13),Math.round(-6-ph*56),2,2);
   }
   g.restore();
  }};
WIN_LINES.agron="“Your blood tastes of fear. The Arcanite dimension will feast well tonight.”";

