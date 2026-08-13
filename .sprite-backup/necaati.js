/**
 * NORMAL-HEAD NECAATI — all of this fighter's editable data + behaviour in one file.
 * Loaded AFTER js/engine.js, so the shared registries (CHARS, IMG_SPRITES, SPRITES,
 * ABILITIES, ULTS, EXTRAS, EXTRAS_BEHIND, WIN_LINES) and the engine helpers already exist.
 * Character-specific drawFighter render branches remain in engine.js.
 */
"use strict";


/* ==================== NORMAL-HEAD NECAATI ==================== */
 CHARS.push({id:"necaati", name:"Normal-Head Necaati", ep:"Astral Entity of Balance",
  hp:550, armor:160, speed:140, jump:410, power:27,
  bio:"Chosen by the Seraph Nizar. Double jump, poison-immune, eternal rival of Necmi.",
  ab:[
   {n:"NORMALIZATION PULSE",cost:0,cd:7,kind:"melee",d:"Damages, strips all enemy buffs & effects, heals him."},
   {n:"BALANCE TOUCH",cost:0,cd:3,kind:"melee",d:"A corrective strike that removes the foe's buffs."},
   {n:"SERAPH'S BLESSING",cost:0,cd:8,kind:"heal",d:"Heal 56 and cleanse his own ailments."}
  ],
  ult:{n:"PERFECT EQUILIBRIUM",d:"Damage, strip everything, drain 50 ENERGY, heal 100."}
 });
 IMG_SPRITES.necaati={
 idle:{w:42,h:72,src:"assets/characters/necaati/idle.png"},
 attack:{w:54,h:61,src:"assets/characters/necaati/attack.png"},
 hit:{w:37,h:72,src:"assets/characters/necaati/hit.png"}
};
 SPRITES.necaati={pal:{p:"#efe6d2",P:"#cdbfa2",c:"#f2b632",a:"#3fd8c7",h:"#6b4a2b",s:"#e6cfae",g:"#ffd76a",e:"#20180f",k:"#8a6f4a"},g:[
".....gggggg.....",
"......hhhh......",
".....hhhhhh.....",
".....ssssss.....",
".....sesses.....",
".....ssssss.....",
".....ssssss.....",
"......ssss......",
".......ss.......",
"...pppppppppp...",
"..pppcpppppppp..",
"..ppppcppppppp..",
"..pppppcpppppp..",
"..pPppppcpppPp..",
"..s.ppppppcp.s..",
"....pppppppp....",
"....pppppppp....",
"....aaaaaaaa....",
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
 ABILITIES.necaati=[
  f=>{f.state="special";f.t=0;announce("NORMALIZATION PULSE!",700);
   setTimeout(()=>{if(!running)return;const foe=other(f);ringFx(f.x,f.centerY,"#3fd8c7",95);shake=Math.max(shake,.4);
    if(Math.abs(foe.x-f.x)<95){foe.takeDamage(48,160,Math.sign(foe.x-f.x)||f.facing,{skill:true,col:"#3fd8c7",fx:"#3fd8c7"});stripAll(foe);}
    heal(f,40);},160);},
  f=>{f.state="special";f.t=0;meleeHit(f,{range:S(48),dmg:40,kb:110,opts:{skill:true,col:"#3fd8c7",fx:"#3fd8c7"},onHit:foe=>{stripBuffs(foe);statusFloat(foe,"BALANCED","#3fd8c7");}});},
  f=>{f.state="special";f.t=0;announce("SERAPH'S BLESSING",650);heal(f,56);
   f.burn=0;f.poison=0;f.bleed=0;f.confuse=0;f.silence=0;f.disarm=0;f.weakenT=0;f.accT=0;f.slowT=0;ringFx(f.x,f.centerY,"#ffd76a",45);}];

ULTS.necaati=function(f){announce("PERFECT EQUILIBRIUM",1100);f.state="special";f.t=0;const foe=other(f);
  ringFx(f.x,f.centerY,"#3fd8c7",150);ringFx(f.x,f.centerY,"#ffd76a",110);
  setTimeout(()=>{if(!running)return;
   if(Math.abs(foe.x-f.x)<150){foe.takeDamage(60,180,Math.sign(foe.x-f.x)||f.facing,{skill:true,col:"#3fd8c7",fx:"#3fd8c7"});stripAll(foe);
    foe.meter=Math.max(0,foe.meter-50);statusFloat(foe,"-50 ENERGY","#3fd8c7");}
   heal(f,100);},160);};
EXTRAS.necaati=function(g,f,t){g.globalAlpha=.4+.4*Math.sin(t*4);g.fillStyle="#fff3c0";g.fillRect(-6,-58,12,2);g.globalAlpha=1;};
WIN_LINES.necaati="“Balance is restored. Everything is normal and Necmi, wherever you are: I am coming for you.”";

