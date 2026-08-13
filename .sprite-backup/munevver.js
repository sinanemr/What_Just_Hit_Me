/**
 * MASTRESS MUNEVVER FIRAT — all of this fighter's editable data + behaviour in one file.
 * Loaded AFTER js/engine.js, so the shared registries (CHARS, IMG_SPRITES, SPRITES,
 * ABILITIES, ULTS, EXTRAS, EXTRAS_BEHIND, WIN_LINES) and the engine helpers already exist.
 * Character-specific drawFighter render branches remain in engine.js.
 */
"use strict";


/* ==================== MASTRESS MUNEVVER FIRAT ==================== */
 CHARS.push({id:"munevver", name:"Mastress Münevver Fırat", ep:"Collector of Powers",
  hp:490, armor:130, speed:140, jump:390, power:25,
  bio:"Ranged pressure & barriers. Calculated Precision: each skill grants a Mark (max 3). At 3, her next damaging skill gains bonus power and consumes them.",
  ab:[
   {n:"RULER VERDICT",cost:0,cd:8,kind:"melee",d:"Ruler strike: 60 dmg (70 with bonus). Vs DAMAGE DOWN: stun 0.5s."},
   {n:"PRIME SEQUENCE",cost:0,cd:9,kind:"ranged",d:"Three numbers: 3×20 (70 with bonus). All hit: foe -10% damage 3s."},
   {n:"NUMBER BARRIER",cost:0,cd:12,kind:"buff",d:"110-point shield 4s. Builds a Mark, never consumes the bonus."}
  ],
  ult:{n:"CODEX OF NUMERICAL ENIGMAS",d:"110 dmg (120 with bonus), DAMAGE DOWN 15% 4s, +45 Armor. After: Marks set to 2."}
 });
 IMG_SPRITES.munevver={
 run:{w:43,h:72,dx:3,src:"assets/characters/munevver/run.png"},
 idle:{w:43,h:72,dx:3,src:"assets/characters/munevver/run.png"},
 attack:{w:56,h:62,foot:-3,src:"assets/characters/munevver/attack.png"},
 attack2:{w:54,h:70,dx:-7,src:"assets/characters/munevver/attack2.png"},
 hit:{w:50,h:65,foot:-2,dx:2,src:"assets/characters/munevver/hit.png"},
 block:{w:42,h:69,dx:3,src:"assets/characters/munevver/block.png"},
 crouch:{w:45,h:53,foot:1,src:"assets/characters/munevver/crouch.png"},
 jump:{w:67,h:70,foot:-2,dx:-1,src:"assets/characters/munevver/jump.png"},
 ko:{w:70,h:34,foot:2,src:"assets/characters/munevver/ko.png"},
 skillA:{w:63,h:66,foot:-8,dx:3,src:"assets/characters/munevver/skillA.png"},
 skillA2:{w:77,h:59,foot:-8,dx:3,src:"assets/characters/munevver/skillA2.png"},
 skillB:{w:60,h:67,foot:-3,dx:5,src:"assets/characters/munevver/skillB.png"},
 skillC:{w:76,h:68,foot:-1,src:"assets/characters/munevver/skillC.png"},
 ult1:{w:63,h:70,foot:3,dx:7,src:"assets/characters/munevver/ult1.png"},
 ult2:{w:100,h:95,foot:3,dx:2,src:"assets/characters/munevver/ult2.png"}
};
 SPRITES.munevver={pal:{p:"#20263e",P:"#141829",c:"#f2b632",a:"#b36bff",h:"#1a1a22",s:"#e6c3a0",r:"#b0384a",e:"#231a10",k:"#241a2e"},g:[
"......hhhh......",
".....hhhhhh.....",
"....hssssssh....",
"....hsessesh....",
"....hssssssh....",
"....hssrrssh....",
"....h.ssss.h....",
"....h..ss..h....",
"...hhpppppphh...",
"..phpppppppphp..",
"..phpppaappphp..",
"..phpppppppphp..",
"..pPpppppppppP..",
"..s.pppppppp.s..",
"....pcppppcp....",
"....pcppppcp....",
"....pcppppcp....",
"....cccccccc....",
"....pppppppp....",
"....pppppppp....",
"....pppppppp....",
"....PPPPPPPP....",
".....kkk.kkk....",
".....kkk.kkk....",
".....kkk.kkk....",
".....kkk.kkk....",
".....kkk.kkk....",
"....kkkk.kkkk...",
]};
 ABILITIES.munevver=[
  f=>{f.state="special";f.t=0;announce("RULER VERDICT!",650);
   const bonus=consumeMarks(f);
   f.skillAT=0.85;f.skillLock=0.85;f.poseSkill=0;   /* hold the pose ~0.85s so leap->slash reads */
   /* the slash connects partway through, as she comes down */
   meleeHit(f,{range:S(52),dmg:bonus?70:60,kb:120,delay:500,opts:{skill:true,col:"#5fe8e0",fx:"#f2b632"},onHit:foe=>{
    if(foe.weakenT>0){applyStun(foe,.5);statusFloat(foe,"STUNNED","#5fe8e0");}}});
   ringFx(MZX(f,10),f.centerY-S(10),"#f2b632",30);
   /* telegraph the slash landing so the hit is unmistakable */
   setTimeout(()=>{if(!running||!f.alive)return;
    shake=Math.max(shake,.5);
    ringFx(MZX(f,44),f.centerY-S(6),"#5fe8e0",56);
    ringFx(MZX(f,44),f.centerY-S(6),"#f2b632",38);
    for(let k=0;k<16;k++)particles.push({x:MZX(f,44)+rand(-10,10),y:f.centerY-S(6)+rand(-18,18),
     vx:f.facing*rand(40,220),vy:rand(-120,120),r:rand(1,2),col:k%2?"#5fe8e0":"#f2b632",t:0,life:rand(.2,.45)});
   },500);},
  f=>{f.state="special";f.t=0;announce("PRIME SEQUENCE!",650);
   f._primeHits=0;const bonus=consumeMarks(f);
   const dmgs=bonus?[24,23,23]:[20,20,20];
   const glyphs=["2","3","5","7"];
   [0,150,300].forEach((d,i)=>setTimeout(()=>{if(!running)return;
    projectiles.push({type:"prime",x:MZX(f,14),y:f.centerY-S(6),vx:f.facing*280,vy:rand(-12,12),r:6,dmg:dmgs[i],owner:f,col:"#5fe8e0",skill:true,
     glyph:glyphs[Math.floor(Math.random()*glyphs.length)]});},d));},
  f=>{f.state="special";f.t=0;announce("NUMBER BARRIER",650);
   f.barrier=110;f.barrierT=4;f.barrierHeal=0;ringFx(f.x,f.centerY,"#5fe8e0",50);}];

ULTS.munevver=function(f){announce("CODEX OF NUMERICAL ENIGMAS",1400);f.state="special";f.t=0;const foe=other(f);
  const bonus=consumeMarks(f);
  const SYMS="0123456789+-=%/";
  const glyphs=[];
  /* book emission point, in her forward hand at chest height */
  const bookX=MZX(f,20), bookY=f.centerY-S(2);
  for(let i=0;i<26;i++)glyphs.push({
   ch:SYMS[Math.floor(Math.random()*SYMS.length)],
   a:rand(0,6.283),r:rand(24,42),h:rand(-64,2),
   spin:rand(.9,2.0)*(Math.random()<.5?-1:1),
   ph:rand(0,6.283),sz:Math.random()<.3?9:6,
   bx:bookX,by:bookY,               /* where it streams out of the book */
   delay:0.12+Math.random()*0.55,   /* staggered emission */
   fly:0.45+Math.random()*0.2});    /* travel time to the orbit */
  /* +0.7s lead-in so the numbers visibly leave the book, cross, then orbit */
  codexes.push({target:foe,owner:f,t:0,dur:2.7,lead:0.7,bonus,glyphs});
  foe.stun=Math.max(foe.stun,2);foe.vx=0;statusFloat(foe,"GRIPPED","#5fe8e0");
  f.ultPose=2.5;f._ultHalf=2.0;shake=Math.max(shake,.3);    /* raise ~0.5s, then unleash held until 2.5s (0.2s before ult ends) */
  setTimeout(()=>{if(running)shake=Math.max(shake,.5);},560);};
EXTRAS.munevver=function(g,f,t){
  const fx=f.facing;
  /* ---- SKILL-C: NUMBER BARRIER — a rotating shield of glowing numbers ---- */
  if(f.barrierT>0){
   const life=Math.min(1,f.barrierT/4);           /* fades as it expires */
   const born=Math.min(1,(4-f.barrierT)/0.3);      /* quick spin-up */
   const amp=born*life;
   g.save();
   g.globalCompositeOperation="lighter";
   /* soft light-blue aura ring around her */
   const pulse=0.5+0.5*Math.sin(t*4);
   g.globalAlpha=amp*(0.18+0.12*pulse);
   const ag=g.createRadialGradient(0,-34,6,0,-34,40);
   ag.addColorStop(0,"rgba(143,216,255,.5)");
   ag.addColorStop(.6,"rgba(95,232,224,.25)");
   ag.addColorStop(1,"rgba(95,232,224,0)");
   g.fillStyle=ag;g.beginPath();g.arc(0,-34,40,0,7);g.fill();
   /* two rotating rings of shielding numbers */
   const SYMS="0123456789+-=%";
   if(!f._barGlyphs){
    f._barGlyphs=[];
    for(let i=0;i<14;i++)f._barGlyphs.push({
     ch:SYMS[Math.floor(Math.random()*SYMS.length)],
     ring:i%2, base:(i/7)*Math.PI*2, sz:i%3===0?8:6,
     ph:Math.random()*6.283});
   }
   for(const gg of f._barGlyphs){
    const rr=gg.ring? 30:22;
    const yr=gg.ring? 20:14;
    const spd=gg.ring? 1.6:-2.2;
    const a=gg.base + t*spd;
    const gx=Math.cos(a)*rr;
    const gy=-34 + Math.sin(a)*yr;
    const depth=Math.sin(a);
    const flick=0.5+0.5*Math.sin(t*6+gg.ph);
    g.font=gg.sz+"px 'Press Start 2P'";g.textAlign="center";g.textBaseline="middle";
    /* glow halo behind each number */
    g.globalAlpha=amp*flick*(0.4+0.3*depth)*0.5;
    g.fillStyle="rgba(143,216,255,.7)";
    g.fillText(gg.ch,gx-1,gy);g.fillText(gg.ch,gx+1,gy);
    g.fillText(gg.ch,gx,gy-1);g.fillText(gg.ch,gx,gy+1);
    /* the number itself */
    g.globalAlpha=amp*flick*(0.55+0.35*depth);
    g.fillStyle=depth>0?"#eaffff":"#8fd8d4";
    g.fillText(gg.ch,gx,gy);
   }
   g.textBaseline="alphabetic";
   g.restore();
  } else if(f._barGlyphs){ f._barGlyphs=null; }
  /* ---- SKILL-A: ruler glows as the slash lands ---- */
  if(f.skillAT>0 && f.skillAT<=0.55){       /* during the descending slash + impact */
   const q=1-(f.skillAT/0.55);              /* 0 at slash start -> 1 as it ends */
   /* quick rise, then hold bright through the hit (hit lands mid-slash) */
   const glow=Math.min(1, q<0.25 ? q*4 : 1.0)*(0.55+0.45*Math.sin(t*22));
   g.save();
   g.globalCompositeOperation="lighter";
   /* the ruler extends forward from her hands; glow along that line */
   const rx=fx*22, ry=-40;                   /* approx ruler mid-point in the slash pose */
   g.globalAlpha=glow*0.8;
   const rg=g.createRadialGradient(rx,ry,1,rx,ry,26);
   rg.addColorStop(0,"rgba(234,255,255,.95)");
   rg.addColorStop(.4,"rgba(143,216,255,.6)");
   rg.addColorStop(1,"rgba(95,232,224,0)");
   g.fillStyle=rg;g.beginPath();g.arc(rx,ry,26,0,7);g.fill();
   /* sparks flying off the ruler edge */
   for(let i=0;i<5;i++){
    g.globalAlpha=glow*(0.4+Math.random()*0.5);
    g.fillStyle=i%2?"#eaffff":"#5fe8e0";
    g.fillRect(Math.round(rx+fx*Math.random()*20),Math.round(ry+rand(-10,10)),2,2);
   }
   g.restore();
  }
 };
WIN_LINES.munevver="“Another power for my collection. Soon the Orb of Transcendence — and then, everything else.”";

