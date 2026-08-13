/**
 * NO-TALKING-MAN — all of this fighter's editable data + behaviour in one file.
 * Loaded AFTER js/engine.js, so the shared registries (CHARS, IMG_SPRITES, SPRITES,
 * ABILITIES, ULTS, EXTRAS, EXTRAS_BEHIND, WIN_LINES) and the engine helpers already exist.
 * Character-specific drawFighter render branches remain in engine.js.
 */
"use strict";


/* ==================== NO-TALKING MAN ==================== */
 CHARS.push({id:"notalk", name:"No-Talking Man", ep:"The Silent Windmill",
  hp:500, armor:185, speed:100, jump:350, power:32,
  bio:"Astral entity who says 'Hmm' every 5s for a Strength Stack (+7% melee, max 3). Astral Durability: -10% melee & skill damage.",
  ab:[
   {n:"SILENT PALM",cost:0,cd:8,kind:"melee",d:"Shockwave: 60 dmg + SILENCE 1.3s."},
   {n:"RELENTLESS MARCH",cost:0,cd:11,kind:"melee",d:"Uninterruptible windmill: 85 dmg +9/stack (max 112), stun 0.7s. Consumes stacks."},
   {n:"ASTRAL PHASE",cost:0,cd:14,kind:"heal",d:"INVULNERABLE 0.9s, restores 15 HP + 15 Armor. Can't attack while phased."}
  ],
  ult:{n:"RESONANCE OF SILENCE",d:"100 dmg, SILENCE 1.5s, stun 0.7s, +3 stacks & 20% resistance 4s."}
 });
 IMG_SPRITES.notalk={
 idle:{w:29,h:72,src:"assets/characters/no-talking-man/idle.png"},
 run0:{w:33,h:73,src:"assets/characters/no-talking-man/run0.png"},
 run1:{w:25,h:73,dx:1,src:"assets/characters/no-talking-man/run1.png"},
 run2:{w:32,h:73,src:"assets/characters/no-talking-man/run2.png"},
 jump:{w:51,h:59,foot:12,dx:2,src:"assets/characters/no-talking-man/jump.png"},
 crouch:{w:41,h:62,src:"assets/characters/no-talking-man/crouch.png"},
 block:{w:33,h:72,dx:-2,src:"assets/characters/no-talking-man/block.png"},
 hit:{w:36,h:73,dx:-1,src:"assets/characters/no-talking-man/hit.png"},
 ko:{w:36,h:76,src:"assets/characters/no-talking-man/ko.png"},
 attack:{w:69,h:66,dx:2,src:"assets/characters/no-talking-man/attack.png"},
 attack2:{w:78,h:69,dx:4,src:"assets/characters/no-talking-man/attack2.png"},
 skillA:{w:79,h:68,dx:11,src:"assets/characters/no-talking-man/skillA.png"},
 skillB:{w:70,h:69,dx:5,src:"assets/characters/no-talking-man/skillB.png"},
 skillC:{w:49,h:72,dx:10,src:"assets/characters/no-talking-man/skillC.png"},
 ult:{w:80,h:79,dx:3,src:"assets/characters/no-talking-man/ult.png"}
};
 SPRITES.notalk={pal:{p:"#17161c",P:"#0c0b10",w:"#efe6d2",a:"#8f6cf0",s:"#d8cfc4",S:"#b3a89a",e:"#26242e",k:"#0c0b10"},g:[
"......ssss......",
".....ssssss.....",
".....ssssss.....",
".....sesses.....",
".....ssssss.....",
".....ssSSss.....",
"......ssss......",
".......ss.......",
"...pppppppppp...",
"..ppppwaawpppp..",
"..ppppwaawpppp..",
"..ppppwaawpppp..",
"..pPppwaawppPp..",
"..s.pppppppp.s..",
"....pppppppp....",
"....pppppppp....",
"....pppppppp....",
"....PPPPPPPP....",
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
 ABILITIES.notalk=[
  f=>{f.state="special";f.t=0;announce("SILENT PALM",650);f.palmT=0.55;
   meleeHit(f,{range:S(50),dmg:60,kb:130,opts:{skill:true,col:"#d8cfc4",fx:"#d8cfc4"},onHit:foe=>{
    foe.silence=1.3;statusFloat(foe,"SILENCED","#d8cfc4");ringFx(foe.x,foe.centerY,"#d8cfc4",40);}});},
  f=>{f.state="special";f.t=0;announce("RELENTLESS MARCH!",700);
   f.marchDmg=85+9*f.strStacks;
   if(f.strStacks>0)statusFloat(f,"-"+f.strStacks+" STACKS","#8f6cf0");
   f.strStacks=0;f.windmill=1.1;},
  f=>{f.state="special";f.t=0;announce("ASTRAL PHASE",650);
   f.phase=0.9;heal(f,15);f.armor=Math.min(f.maxArmor,f.armor+15);
   statusFloat(f,"+15 ARMOR","#9fb8c9");ringFx(f.x,f.centerY,"#bfeaff",45);}];

ULTS.notalk=function(f){announce("RESONANCE OF SILENCE",1100);f.state="special";f.t=0;
  f.ultPose=1.5;f.poseSkill=-1;f.vx=0;f.hmmBub=2.2;f.hmmBig=true;
  f.strStacks=3;statusFloat(f,"+3 STACKS","#8f6cf0");f.dr=4;
  ringFx(f.x,f.centerY,"#8f6cf0",190);shake=Math.max(shake,.9);
  setTimeout(()=>{if(!running)return;const foe=other(f);
   if(Math.abs(foe.x-f.x)<190){foe.takeDamage(100,300,Math.sign(foe.x-f.x)||f.facing,{unblockable:true,melee:true,noStackMult:true,col:"#8f6cf0",fx:"#8f6cf0"});
    foe.silence=1.5;applyStun(foe,.7);statusFloat(foe,"SILENCED","#d8cfc4");}},180);};
EXTRAS.notalk=function(g,f,t){
  /* ---- SKILL A: giant blue spectral palm — edge-on "STOP" hand, fingers up ---- */
  if(f.palmT>0){
   const p=1-Math.max(0,f.palmT)/0.55;            /* 0..1 through the strike */
   const fx=f.facing;
   const ease=p<.35?(p/.35)*(p/.35):1;            /* fast thrust out */
   const reach=12+ease*44;
   const sz=0.62+ease*0.85;
   const fade=p<.65?1:1-(p-.65)/.35;
   const flex=Math.sin(p*Math.PI);
   g.save();
   g.globalAlpha=Math.max(0,fade)*.9;
   g.translate(fx*reach,-42);
   g.scale(fx*sz,sz);
   g.globalCompositeOperation="lighter";
   /* backing glow, centred on the palm mass */
   const gr=g.createRadialGradient(0,2,2,0,2,30);
   gr.addColorStop(0,"rgba(170,230,255,.7)");
   gr.addColorStop(.5,"rgba(64,168,255,.36)");
   gr.addColorStop(1,"rgba(30,90,220,0)");
   g.fillStyle=gr;g.beginPath();g.arc(0,2,30,0,7);g.fill();

   const PL="rgba(150,225,255,.93)", HI="rgba(240,253,255,.95)", LN="rgba(110,200,250,.85)";
   g.lineCap="round";g.lineJoin="round";

   /* --- the hand as ONE tall edge-on blade: narrow at the fingertips,
          widening down through the knuckles to the heel/wrist.
          Seen from the pinky side, so fingers read as a closed bundle. --- */
   g.fillStyle=PL;
   g.beginPath();
   g.moveTo(-3.5,-30);                            /* fingertip, top */
   g.bezierCurveTo(-5.5,-26,-6,-18,-6,-10);       /* back edge of the fingers */
   g.bezierCurveTo(-6.5,-3,-7,4,-6,9);            /* back of the hand */
   g.bezierCurveTo(-5,13,-2,15,2,15);             /* heel, curving to the wrist */
   g.bezierCurveTo(6,15,8,12,8,8);                /* wrist bend (cut — no arm) */
   g.bezierCurveTo(8,2,6,-4,4,-11);               /* palm front edge rising */
   g.bezierCurveTo(3,-18,1.5,-25,-0.5,-29);       /* front edge of the fingers */
   g.bezierCurveTo(-1.5,-31,-2.5,-31,-3.5,-30);   /* round the fingertip */
   g.closePath();g.fill();

   /* --- finger separations: subtle creases down the bundle, splaying on impact --- */
   const seps=[[-4.6,-27,-4.0,-9],[-3.0,-28.5,-2.2,-9],[-1.2,-27,-0.6,-8]];
   g.strokeStyle=LN;g.lineWidth=0.8;
   for(let i=0;i<3;i++){
    const [x1,y1,x2,y2]=seps[i];
    const sp=flex*(i-1)*0.5;
    g.beginPath();
    g.moveTo(x1+sp,y1);
    g.quadraticCurveTo(x1+sp*.6,(y1+y2)/2,x2,y2);
    g.stroke();
   }
   /* index finger edge catches the light (front-most, nearest the viewer) */
   g.strokeStyle=HI;g.lineWidth=1.6;
   g.beginPath();
   g.moveTo(-1.2,-28.5);
   g.bezierCurveTo(0.5,-24,2.2,-17,3,-11);
   g.stroke();

   /* --- thumb: tucked across the FRONT of the palm, the side-view tell --- */
   g.strokeStyle=PL;g.lineWidth=3.4;
   g.beginPath();
   g.moveTo(2,10);
   g.quadraticCurveTo(4.5,3,3.5,-4);
   g.stroke();
   g.strokeStyle=HI;g.lineWidth=1.2;
   g.beginPath();g.moveTo(3.6,6);g.quadraticCurveTo(4.6,1,3.9,-3.5);g.stroke();

   /* --- shading: knuckle line + heel mound --- */
   g.strokeStyle=LN;g.lineWidth=0.9;
   g.beginPath();
   g.moveTo(-6,-9.5);g.quadraticCurveTo(-1,-11,4,-10.5);       /* knuckle crease */
   g.stroke();
   g.fillStyle=HI;
   g.beginPath();g.ellipse(-1,9,3.6,3.0,0.15,0,7);g.fill();    /* heel mound */
   /* wrist cut — bright rim so it reads as severed energy, not a stump */
   g.strokeStyle=HI;g.lineWidth=1.3;
   g.beginPath();g.moveTo(-4,13.5);g.quadraticCurveTo(2,16.5,8,9);g.stroke();

   /* impact rings off the palm face, pushing forward */
   g.strokeStyle="rgba(180,235,255,.45)";g.lineWidth=1.4;
   for(let i=0;i<3;i++){const rr=8+((t*40+i*14)%34)*(0.5+ease*0.6);
    g.globalAlpha=Math.max(0,fade)*.38*(1-rr/44);
    g.beginPath();g.ellipse(6,-6,rr*.3,rr*.95,0,0,7);g.stroke();}
   g.restore();
  }

  /* ---- SPEECH BUBBLE: "Hmm..." on skills, a big "HMMMM!" shout on the ult ---- */
  if(f.hmmBub>0){
   const ULT=!!f.hmmBig;
   const dur=ULT?2.2:1.1;
   const life=Math.min(f.hmmBub,dur);             /* clamp: never exceed dur */
   const p=Math.max(0,Math.min(1,1-life/dur));    /* 0..1, always in range */
   const pop=life>dur*0.86?Math.max(0,(dur-life)/(dur*0.14)):1;
   const rise=Math.min(1,p*3)*(ULT?7:4);
   const fade=life<0.3?life/0.3:1;
   const scl=ULT?1.9:1;                           /* bigger bubble for the ult */
   /* ult text grows more m's the longer he shouts */
   let txt;
   if(ULT){
    const ms=2+Math.floor(p*7);                   /* Hmm -> Hmmmmmmmm */
    txt="H"+"m".repeat(Math.max(2,Math.min(9,ms)))+"!";
   }else{
    const n=1+Math.floor(p*9)%3;                  /* Hmm. / Hmm.. / Hmm... */
    txt="Hmm"+".".repeat(Math.max(1,Math.min(3,n)));
   }
   const bw=(ULT?34:30),bh=13;
   const bx=f.facing*(ULT?16:10),by=(ULT?-104:-96)-rise;
   g.save();
   g.globalAlpha=Math.max(0,Math.min(1,fade));
   g.translate(bx,by);
   const sc=Math.max(.01,pop)*scl;
   /* ult bubble throbs as he shouts */
   const throb=ULT?1+Math.sin(t*22)*0.05:1;
   g.scale(sc*throb,sc*throb);
   /* bubble body */
   g.fillStyle="rgba(248,250,255,.95)";
   g.fillRect(-bw/2,-bh/2,bw,bh);
   g.fillRect(-bw/2-2,-bh/2+3,2,bh-6);
   g.fillRect(bw/2,-bh/2+3,2,bh-6);
   g.fillRect(-bw/2+3,-bh/2-2,bw-6,2);
   g.fillRect(-bw/2+3,bh/2,bw-6,2);
   /* tail pointing down at his head */
   const tw=-f.facing*8;g.fillRect(tw,bh/2,3,3);g.fillRect(tw-f.facing*2,bh/2+3,3,3);
   /* outline */
   g.fillStyle="#17161c";
   g.fillRect(-bw/2,-bh/2-2,bw,1);g.fillRect(-bw/2,bh/2+1,bw,1);
   g.fillRect(-bw/2-2,-bh/2,1,bh);g.fillRect(bw/2+1,-bh/2,1,bh);
   /* ult: spiky shout burst behind the bubble */
   if(ULT){
    g.save();g.globalAlpha=Math.max(0,Math.min(1,fade))*.5;
    g.strokeStyle="#8f6cf0";g.lineWidth=1;
    for(let i=0;i<10;i++){const a=i*0.628+t*2;
     g.beginPath();
     g.moveTo(Math.cos(a)*(bw/2+2),Math.sin(a)*(bh/2+2));
     g.lineTo(Math.cos(a)*(bw/2+6),Math.sin(a)*(bh/2+6));
     g.stroke();}
    g.restore();
   }
   /* text */
   g.fillStyle=ULT?"#3b2470":"#2a2740";
   g.font="5px 'Press Start 2P'";
   g.textAlign="center";g.textBaseline="middle";
   g.fillText(txt,0,0);
   g.restore();
  }

  /* stacks now live on the HUD bar — no in-world readout needed */
  g.textBaseline="alphabetic";
 };
EXTRAS_BEHIND.notalk=function(g,f,t){
  /* ---- SKILL C: glowing astral ghost ---- */
  if(f.phase>0){
   const p=1-Math.max(0,f.phase)/0.9;
   const drift=p*16, fade=(1-p)*.85;
   const img=IMG_SPRITES.notalk, fr=img.skillC||img.idle;
   if(fr&&fr.img.complete&&fr.img.naturalWidth>0){
    for(let k=0;k<2;k++){
     g.save();
     g.globalAlpha=fade*(k?.35:.6);
     g.globalCompositeOperation="lighter";
     g.translate(-f.facing*(drift*(k?1.7:1)),-drift*.25*(k?1.6:1));
     if(f.facing===-1)g.scale(-1,1);
     g.filter="drop-shadow(0 0 6px #48c8ff) drop-shadow(0 0 12px #1e6bff)";
     g.imageSmoothingEnabled=false;
     g.drawImage(fr.img,Math.round(-fr.w/2+(fr.dx||0)),Math.round(-fr.h+(fr.foot||0)),fr.w,fr.h);
     g.filter="none";
     g.restore();
    }
   }
   /* rising astral motes */
   g.save();g.globalCompositeOperation="lighter";
   for(let i=0;i<7;i++){
    const ph=(t*1.4+i*0.9)%1;
    g.globalAlpha=(1-ph)*fade*.9;
    g.fillStyle=i%2?"#bfeaff":"#48c8ff";
    g.fillRect(Math.round(Math.sin(i*2.1+t*2)*13),Math.round(-8-ph*62),2,2);
   }
   g.restore();
  }
  /* ---- ULT: orbiting rings that swell outward ---- */
  if(f.ultPose>0){
   const p=1-Math.max(0,f.ultPose)/1.5;           /* 0..1 across the ult */
   const grow=0.35+p*1.0;
   const fade=p<.75?1:1-(p-.75)/.25;
   g.save();
   g.globalCompositeOperation="lighter";
   g.translate(0,-38);
   for(let i=0;i<4;i++){
    const rr=(24+i*13)*grow;
    const tilt=Math.sin(t*1.6+i*1.2)*0.5;
    const spin=t*(1.5+i*0.45)+i*1.7;
    g.save();
    g.rotate(tilt);
    g.globalAlpha=Math.max(0,fade)*(.5-i*.07);
    g.strokeStyle=i%2?"#8f6cf0":"#5fe8e0";
    g.lineWidth=2;
    g.beginPath();g.ellipse(0,0,rr,rr*0.34,0,0,7);g.stroke();
    /* comet head riding the ring */
    const cx=Math.cos(spin)*rr, cy=Math.sin(spin)*rr*0.34;
    g.globalAlpha=Math.max(0,fade)*.85;
    g.fillStyle=i%2?"#c9b6ff":"#bffff8";
    g.fillRect(Math.round(cx)-1,Math.round(cy)-1,3,3);
    g.restore();
   }
   /* core bloom */
   const cg=g.createRadialGradient(0,0,2,0,0,26*grow);
   cg.addColorStop(0,"rgba(200,180,255,"+(0.5*fade).toFixed(3)+")");
   cg.addColorStop(1,"rgba(143,108,240,0)");
   g.fillStyle=cg;g.beginPath();g.arc(0,0,26*grow,0,7);g.fill();
   g.restore();
  }
 };
WIN_LINES.notalk="“Hmmmmmmmm!.";

