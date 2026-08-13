/**
 * PUTUK — all of this fighter's editable data + behaviour in one file.
 * Loaded AFTER js/engine.js, so the shared registries (CHARS, IMG_SPRITES, SPRITES,
 * ABILITIES, ULTS, EXTRAS, EXTRAS_BEHIND, WIN_LINES) and the engine helpers already exist.
 * Character-specific drawFighter render branches remain in engine.js.
 */
"use strict";


/* ==================== PUTUK ==================== */
 CHARS.push({id:"putuk", name:"Putuk", ep:"The Time-Stopper",
  hp:500, armor:150, speed:230, jump:415, power:27,
  bio:"Medical student by day, Krav Maga vigilante by night. Anatomy Expert: +10 dmg to Stunned foes.",
  ab:[
   {n:"WEAK POINT STRIKE",cost:0,cd:8,kind:"melee",d:"Parry + nerve strike: 55 dmg + STUN 0.5s."},
   {n:"TEMPORAL RUSH",cost:0,cd:10,kind:"melee",d:"Blinks behind the foe (dodges mid-blink): 65 dmg, 75 vs stunned."},
   {n:"FROZEN COUNTER",cost:0,cd:12,kind:"melee",d:"Counter stance — if struck, freezes time & counters: 50 dmg + STUN 0.6s."}
  ],
  ult:{n:"TIME STOP",d:"Time freezes, Krav-Maga barrage: 110 dmg + strips 15 Defense. Then -10% dmg 3s."}
 });
 IMG_SPRITES.putuk={
 idle:{w:80,h:80,dx:0,foot:2,src:"assets/characters/putuk/idle.png"},
 hit:{w:80,h:80,dx:0,foot:2,src:"assets/characters/putuk/hit.png"},
 run0:{w:80,h:80,dx:0,foot:2,src:"assets/characters/putuk/run0.png"},
 run1:{w:80,h:80,dx:0,foot:2,src:"assets/characters/putuk/run1.png"},
 jump:{w:75,h:75,dx:0,foot:2,src:"assets/characters/putuk/jump.png"},
 crouch:{w:80,h:80,dx:0,foot:2,src:"assets/characters/putuk/crouch.png"},
 block:{w:80,h:80,dx:0,foot:2,src:"assets/characters/putuk/block.png"},
 ko:{w:80,h:80,dx:0,foot:2,src:"assets/characters/putuk/ko.png"},
 attack:{w:80,h:80,dx:0,foot:2,src:"assets/characters/putuk/attack.png"},
 attack2:{w:75,h:75,dx:0,foot:2,src:"assets/characters/putuk/attack2.png"},
 skillA:{w:80,h:80,dx:0,foot:2,src:"assets/characters/putuk/skillA.png"},
 skillB:{w:75,h:75,dx:0,foot:2,src:"assets/characters/putuk/skillB.png"},
 skillC:{w:80,h:80,dx:0,foot:2,src:"assets/characters/putuk/skillC.png"},
 skillC2:{w:67,h:67,dx:0,foot:2,src:"assets/characters/putuk/skillC2.png"},
 ult1:{w:87,h:87,dx:0,foot:2,src:"assets/characters/putuk/ult1.png"},
 ult2:{w:95,h:95,dx:0,foot:2,src:"assets/characters/putuk/ult2.png"}
};
 SPRITES.putuk={pal:{p:"#0f3d3a",P:"#092825",c:"#3fd8c7",a:"#efe6d2",h:"#1c1c1c",s:"#dfb894",e:"#3fd8c7",k:"#0a1a18"},g:[
"......hhhh......",
".....hhhhhh.....",
".....ssssss.....",
".....aeaaea.....",
".....ssssss.....",
".....ssssss.....",
"......ssss......",
".......ss.......",
"...pppppppppp...",
"..pppppccppppp..",
"..ppppccccpppp..",
"..pppppccppppp..",
"..pPppppppppPp..",
"..c.pppppppp.c..",
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
".....PPP.PPP....",
".....kkk.kkk....",
".....kkk.kkk....",
"....kkkk.kkkk...",
]};
 ABILITIES.putuk=[
  /* A — WEAK POINT STRIKE: parry + nerve strike, 55 dmg + stun 0.5s */
  f=>{f.state="special";f.t=0;f.poseSkill=0;announce("WEAK POINT STRIKE!",600);
   meleeHit(f,{range:S(50),dmg:55,kb:80,delay:130,opts:{skill:true,col:"#3fd8c7",fx:"#bfeaff"},onHit:foe=>{applyStun(foe,0.5);statusFloat(foe,"STUNNED","#3fd8c7");ringFx(foe.x,foe.centerY,"#bfeaff",34);}});},
  /* B — TEMPORAL RUSH: blink through the foe (phase = i-frames + blink), strike from behind */
  f=>{f.state="special";f.t=0;f.poseSkill=1;f.phase=0.34;announce("PUTUK!",650);
   const foe=other(f), startX=f.x;
   for(let i=0;i<8;i++)particles.push({x:f.x+rand(-8,8),y:f.centerY+rand(-24,24),vx:rand(-40,40),vy:rand(-30,30),r:rand(1,2),col:"#bfeaff",t:0,life:.2});
   setTimeout(()=>{if(!running||!f.alive)return;
    const dir=Math.sign(foe.x-f.x)||f.facing;
    const endX=Math.max(WALL_L,Math.min(WALL_R,foe.x+dir*S(22))), rdir=Math.sign(endX-startX)||1;
    /* blue electrical dash lines along the path -> looks like he blurred/ran there */
    for(let k=0;k<=14;k++){const u=k/14, tx=startX+(endX-startX)*u;
     particles.push({x:tx,y:f.centerY+rand(-16,16),vx:-rdir*rand(50,140),vy:rand(-12,12),r:rand(1,2.5),col:k%2?"#bfeaff":"#3fd8ff",t:0,life:rand(.14,.3)});}
    for(let k=0;k<4;k++){let px=startX,py=f.centerY+rand(-12,12);for(let s=1;s<=6;s++){const nx=startX+(endX-startX)*(s/6),ny=py+rand(-5,5);
     particles.push({x:px,y:py,vx:(nx-px)*3,vy:(ny-py)*3,r:1.5,col:s%2?"#eaffff":"#3fd8ff",t:0,life:.16});px=nx;py=ny;}}
    f.x=endX;f.facing=-dir;
    ringFx(f.x,f.centerY,"#3fd8c7",44);
    for(let i=0;i<10;i++)particles.push({x:f.x+rand(-8,8),y:f.centerY+rand(-22,22),vx:rand(-70,70),vy:rand(-50,50),r:rand(1,2),col:i%2?"#bfeaff":"#3fd8c7",t:0,life:.22});
    const emp=(foe.stun>0||foe.frozen>0);
    meleeHit(f,{range:S(42),dmg:emp?75:65,kb:130,delay:20,opts:{skill:true,col:"#3fd8c7",fx:"#bfeaff"}});
   },140);},
  /* C — FROZEN COUNTER: counter stance; the takeDamage() hook fires the counter if struck */
  f=>{f.state="special";f.t=0;f.poseSkill=2;f.counterT=0.75;announce("FROZEN COUNTER!",600);
   ringFx(f.x,f.centerY,"#3fd8c7",44);ringFx(f.x,f.centerY,"#bfeaff",26);statusFloat(f,"COUNTER STANCE","#bfeaff");
   for(let i=0;i<18;i++)particles.push({x:f.x+rand(-20,20),y:f.centerY+rand(-30,30),vx:rand(-35,35),vy:rand(-55,10),r:rand(1,3),col:["#8fe8ff","#3fd8ff","#bff2ff","#eaffff"][i%4],t:0,life:rand(.25,.55)});}];

ULTS.putuk=function(f){announce("TIME STOP",1100);f.state="special";f.t=0;f.vx=0;f.ultPose=1.7;f._ultHalf=1.15;   /* ult1 startup (~0.5s) -> ult2 barrage */
  const foe=other(f);
  setTimeout(()=>{if(!running||!f.alive||f.stun>0)return;                 /* interruptible startup: no time-stop if stunned first */
   foe.frozen=2.4;foe.vx=0;foe.armor=Math.max(0,foe.armor-15);statusFloat(foe,"-15 DEFENSE","#ffd23f");
   ringFx(f.x,f.centerY,"#3fd8c7",130);ringFx(f.x,f.centerY,"#eaffff",72);shake=Math.max(shake,.75);
   /* big electrical explosion bursting around the expanding freeze circle */
   for(let b=0;b<12;b++){const a=b/12*6.283;let px=f.x,py=f.centerY;
    for(let s=0;s<6;s++){const nx=px+Math.cos(a)*rand(10,22),ny=py+Math.sin(a)*rand(10,22);
     particles.push({x:px,y:py,vx:(nx-px)*4,vy:(ny-py)*4,r:1.7,col:s%2?"#eaffff":"#3fd8ff",t:0,life:.16});px=nx;py=ny;}}
   for(let i=0;i<28;i++){const a=Math.random()*6.283,sp=rand(70,240);
    particles.push({x:f.x,y:f.centerY,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,r:rand(1,3),col:["#eaffff","#bfeaff","#3fd8ff","#ffffff"][i%4],t:0,life:rand(.2,.5)});}
  },520);
  [700,850,1000,1150,1400].forEach((d,i)=>meleeHit(f,{range:S(56),dmg:i===4?30:20,kb:i===4?210:22,delay:d,opts:{skill:true,col:"#3fd8c7",fx:"#bfeaff"}}));
  setTimeout(()=>{if(running&&f.alive){f.weakenT=3;f.weakenAmt=.10;f.spdBuff=10;statusFloat(f,"TEMPORAL FATIGUE","#9d92c2");}},1500);   /* +10s move-speed boost (time momentum) */
  setTimeout(()=>{if(running&&f.alive)statusFloat(f,"TIME MOMENTUM +SPD","#3fd8c7");},1780);};
 /* PUTUK — blue Flash-style speed-force aura + lightning trail while moving */
EXTRAS_BEHIND.putuk=function(g,f,t){
  const sp=Math.abs(f.vx), spN=Math.min(1,sp/230);
  /* ===== blue energy pooled at his FEET (not the body) ===== */
  g.save();g.globalCompositeOperation="lighter";
  const fy=-3, ga=0.22+spN*0.20;
  const gr=g.createRadialGradient(0,fy,2,0,fy,15+spN*8);
  gr.addColorStop(0,"rgba(120,215,255,"+ga.toFixed(2)+")");
  gr.addColorStop(0.6,"rgba(80,180,255,"+(ga*0.5).toFixed(2)+")");
  gr.addColorStop(1,"rgba(60,150,255,0)");
  g.fillStyle=gr;g.beginPath();g.ellipse(0,fy,15+spN*7,8+spN*3,0,0,6.283);g.fill();
  g.restore();
  /* crackling blue lightning around his feet/ankles */
  const nb=1+(Math.random()<0.6?1:0)+Math.round(spN*2);
  for(let b=0;b<nb;b++){
   const x0=f.x+rand(-S(11),S(11)), y0=f.y-rand(0,S(9));
   const x1=f.x+rand(-S(11),S(11)), y1=f.y-rand(0,S(9));
   const segs=3+Math.floor(Math.random()*2), bright=Math.random()<0.5;
   let px=x0,py=y0;
   for(let s=1;s<=segs;s++){const u=s/segs;
    const nx=(s<segs)?x0+(x1-x0)*u+rand(-3,3):x1, ny=(s<segs)?y0+(y1-y0)*u+rand(-3,3):y1;
    particles.push({x:px,y:py,vx:(nx-px)*7,vy:(ny-py)*7,r:1.2,col:bright?"#eaffff":"#3fd8ff",t:0,life:.08});
    px=nx;py=ny;}
  }
  /* ===== body ENVELOPE — blue glow + lightning wraps his body while he RUNS ===== */
  if(sp>50){
   const cy=-30, ba=0.10+spN*0.15;
   g.save();g.globalCompositeOperation="lighter";
   const bgr=g.createRadialGradient(0,cy,6,0,cy,30+spN*10);
   bgr.addColorStop(0,"rgba(95,195,255,"+ba.toFixed(2)+")");
   bgr.addColorStop(0.6,"rgba(80,175,255,"+(ba*0.4).toFixed(2)+")");
   bgr.addColorStop(1,"rgba(60,150,255,0)");
   g.fillStyle=bgr;g.beginPath();g.ellipse(0,cy,24+spN*8,40+spN*8,0,0,6.283);g.fill();
   g.restore();
   const bn=1+Math.round(spN*3);
   for(let b=0;b<bn;b++){
    const rx=S(11)+Math.random()*S(4), ry=S(20)+Math.random()*S(7);
    const a0=Math.random()*6.283, a1=a0+(Math.random()<0.5?-1:1)*(0.7+Math.random()*1.6);
    const x0=f.x+Math.cos(a0)*rx, y0=f.centerY+Math.sin(a0)*ry;
    const x1=f.x+Math.cos(a1)*rx, y1=f.centerY+Math.sin(a1)*ry;
    const segs=4+Math.floor(Math.random()*3), bright=Math.random()<0.5;
    let px=x0,py=y0;
    for(let s=1;s<=segs;s++){const u=s/segs;
     const nx=(s<segs)?x0+(x1-x0)*u+rand(-4,4):x1, ny=(s<segs)?y0+(y1-y0)*u+rand(-4,4):y1;
     particles.push({x:px,y:py,vx:(nx-px)*7,vy:(ny-py)*7,r:1.3,col:bright?"#eaffff":"#3fd8ff",t:0,life:.09});px=nx;py=ny;}
   }
  }
  /* ===== TIME-WARP vortex around his body during the ult speed boost (Putuk blue only) ===== */
  if(f.spdBuff>0){
   g.save();g.globalCompositeOperation="lighter";const bc=-30, spin=t*2.8;
   /* many thin, faint blue spiral streaks blend into one smooth glowing swirl */
   for(let a=0;a<16;a++){
    const a0=spin+a/16*6.283, br=a%2===0;
    g.strokeStyle="rgba("+(br?"150,225,255":"90,185,255")+","+(br?0.22:0.13)+")";g.lineWidth=br?1.2:0.8;
    g.beginPath();
    for(let i=0;i<=20;i++){const u=i/20, rad=2+(1-u)*30, ang=a0+u*4.2;
     const px=Math.cos(ang)*rad*0.72, py=bc+Math.sin(ang)*rad;
     i?g.lineTo(px,py):g.moveTo(px,py);}
    g.stroke();
   }
   const cg=g.createRadialGradient(0,bc,1,0,bc,9);   /* bright blue core */
   cg.addColorStop(0,"rgba(225,248,255,0.6)");cg.addColorStop(1,"rgba(80,175,255,0)");
   g.fillStyle=cg;g.beginPath();g.arc(0,bc,9,0,6.283);g.fill();
   g.restore();
   /* blue streaks spiralling inward -> warp motion */
   for(let k=0;k<2;k++){const ang=spin+Math.random()*6.283, rad=24+Math.random()*10;
    const px=f.x+Math.cos(ang)*rad*0.72, py=f.centerY+Math.sin(ang)*rad;
    particles.push({x:px,y:py,vx:(-Math.sin(ang)*rand(60,110))-Math.cos(ang)*rand(50,100),vy:(Math.cos(ang)*rand(60,110))-Math.sin(ang)*rand(50,100),r:rand(1,2),col:k%2?"#bfeaff":"#3fd8ff",t:0,life:rand(.18,.34)});}
  }
  /* speed streaks trailing his legs while running */
  if(sp>55&&f.onGround){
   const dir=f.vx>0?1:-1;
   for(let s=0;s<2;s++)particles.push({x:f.x-dir*rand(2,10),y:f.y-rand(S(2),S(20)),vx:-dir*rand(80,200),vy:rand(-20,20),r:rand(1,2.5),col:["#8fe8ff","#3fd8ff","#bff2ff"][s%3],t:0,life:rand(.12,.26)});
  }
 };
WIN_LINES.putuk="“Putuk. …That's it. That's the whole victory speech. Time waits for me, not the other way around.”";

