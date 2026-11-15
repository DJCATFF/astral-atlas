// Original procedural armillary scene; rendered only through Folium's shared frame loop.
import {AudioReactor,StardustEnvelope} from './audio-reactor.mjs';
import {resolvePalette} from './palette.mjs';
import {seededRandom,timedGlyphs,lyricRoles,translationPlacement,spectralEnergy,glyphAppearance,makeOrbitClock} from './orbit-lyrics.mjs';
export {seededRandom,timedGlyphs} from './orbit-lyrics.mjs';
import {TAU,clamp,smooth,rotate,rotationTransform,rings,carrier,dialPhase,ringPoint,view,project,attachedGlyphs} from './armillary.mjs';
const DEFAULTS={diagramScale:1,lyricScale:1,translationScale:1,translationGap:38,annotationScale:1,ringScale:1,density:.65,spectralStars:true,spectralStrength:1,spectralRing:true,ringStrength:1,ringCount:64,ringOpacity:.65,orbitSpeed:1,revealSpeed:1,motion:1,reactivity:1,lyricMotion:1,annotations:true,audioStatus:false,transparent:false,palette:'follow',ink:'#eee9d5',accent:'#d8c796',paper:'#080b0e'};
const SERIF='Georgia,"Noto Serif CJK SC","Songti SC",SimSun,serif',mono='"Cascadia Code",Consolas,monospace';
export function mountAtlas(folium,container,ctx){
const canvas=document.createElement('canvas'),c=canvas.getContext('2d',{alpha:true});
canvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
canvas.setAttribute('aria-label','星图仪歌词动效');container.appendChild(canvas);
const rand=seededRandom(ctx.seed||ctx.song?.id||'astral-atlas');
const stars=Array.from({length:720},()=>({x:(rand()-.5)*1500,y:(rand()-.5)*1000,z:(rand()-.5)*850,r:rand()<.035?1.1:.25+rand()*.45,a:.12+rand()*.45}));
const nodes=Array.from({length:36},(_,i)=>{const a=i/36*TAU,r=155+rand()*60;return {x:Math.cos(a)*r,y:Math.sin(a)*(100+rand()*70),z:(rand()-.5)*220};});
const spectralStars=Array.from({length:240},(_,i)=>{
 const y=1-2*(i+.5)/240,a=i*Math.PI*(3-Math.sqrt(5)),r=Math.sqrt(1-y*y),radius=219+rand()*13;
 return {x:Math.cos(a)*r*radius,y:y*radius,z:Math.sin(a)*r*radius,bin:(i*37)%96,phase:rand(),major:i%13===0};
});
const reactor=new AudioReactor(),stardust=new StardustEnvelope(),dotRing=new StardustEnvelope(96,{attack:.045,release:.22}),orbitClock=makeOrbitClock(ctx.lines),metricCache=new Map(),glyphCache=ctx.lines.map(timedGlyphs);
const rolesCache=glyphCache.map(lyricRoles);
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let settings={...DEFAULTS,...ctx.getSettings()},theme=ctx.getTheme(),display=ctx.getDisplay();
let serif=SERIF,ink,accent,paper,metal,daylight,signal=reactor.value;
let opening=0,queue=[],lyricZones=[],sceneAlpha=1,disposed=false,lastStamp=null,lastTime=ctx.lyricTime.get(),width=0,height=0,motion=1;
const unsubs=[];
function refresh(){
 settings={...DEFAULTS,...ctx.getSettings()};theme=ctx.getTheme();display=ctx.getDisplay();
 ({ink,accent,paper,daylight}=resolvePalette(settings,theme));metal=daylight?accent:'#a9956b';
 motion=ctx.staticMode||reduced.matches?0:settings.motion*(theme.animationIntensity==='calm'?.45:1);
 if(!motion||!settings.reactivity)opening=0;
 serif=SERIF;metricCache.clear();
}
function measure(text,size){const key=size+'|'+text;if(!metricCache.has(key)){c.font=`400 ${size}px ${serif}`;if(metricCache.size>4096)metricCache.clear();metricCache.set(key,c.measureText(text).width);}return metricCache.get(key);}
function line3(a,b,v,alpha=.25,width=.6,color='#b2a789'){
  const p=project(a,v),q=project(b,v);
  if(p&&q&&!((p.x<34&&q.x<34)||(p.x>1246&&q.x>1246)||(p.y<82&&q.y<82)||(p.y>638&&q.y>638)))queue.push({kind:'line',p,q,z:(p.z+q.z)/2,alpha,width,color});
}
function dot3(world,v,r=1.2,alpha=.6){const p=project(world,v);if(p)queue.push({kind:'dot',p,z:p.z,r:Math.min(3,r*p.k),alpha});}
function circle3(radius,rx,ry,rz,offset,time,v,alpha=.16){
  let last=null;const transform=rotationTransform(rx,ry,rz);
  for(let i=0;i<=120;i++){
    const a=i/120*TAU,p=transform({x:Math.cos(a)*radius,y:Math.sin(a)*radius,z:offset});
    if(last)line3(last,p,v,alpha,.5,'#8fa199');last=p;
  }
}
function small(text,x,y,alpha=.5,align='left'){c.save();c.globalAlpha=alpha;c.fillStyle=ink;c.font=`8px ${mono}`;c.textAlign=align;c.fillText(text,x,y);c.restore();}
function label(text,x,y,size=12,alpha=.5,align='left',italic=false){c.save();c.globalAlpha=alpha;c.fillStyle=ink;c.font=`${italic?'italic ':''}${size}px ${serif}`;c.textAlign=align;c.fillText(text,x,y);c.restore();}
function addRings(time,v,phaseTime){
  rings.forEach((ring,ri)=>{
    const count=120,phase=dialPhase(ring,ring.carrier||ring.id==='tropic-n'?phaseTime:time),radius=ring.r;
    for(let i=0;i<count;i++){
      const a=i/count*TAU+phase,b=(i+1)/count*TAU+phase;
      const p=project(ringPoint(ring,a,radius,time,opening),v),q=project(ringPoint(ring,b,radius,time,opening),v);
      const lo=project(ringPoint(ring,b,radius-ring.w,time,opening),v),hi=project(ringPoint(ring,a,radius-ring.w,time,opening),v);
      if(p&&q&&lo&&hi&&Math.max(p.x,q.x,lo.x,hi.x)>=34&&Math.min(p.x,q.x,lo.x,hi.x)<=1246&&Math.max(p.y,q.y,lo.y,hi.y)>=82&&Math.min(p.y,q.y,lo.y,hi.y)<=638)queue.push({kind:'band',p,q,lo,hi,z:(p.z+q.z+lo.z+hi.z)/4,i,ri,ring});
    }
    for(let j=0;j<ring.ticks;j++){
      const a=j/ring.ticks*TAU+phase,major=j%(ring.ticks/12)===0,medium=j%5===0;
      const inset=major?ring.w*.82:medium?ring.w*.60:ring.w*.27;
      line3(ringPoint(ring,a,radius-.8,time,opening),ringPoint(ring,a,radius-inset,time,opening),v,major?.62:medium?.32:.16,major?.7:.43,'#c8b384');
    }
    if(settings.annotations && ring.numerals)for(let j=0;j<12;j++){
      const a=j/12*TAU+phase,r=radius-ring.w*.59,p=project(ringPoint(ring,a,r,time,opening),v);
      const before=project(ringPoint(ring,a+.002,r,time,opening),v),after=project(ringPoint(ring,a-.002,r,time,opening),v);
      if(p&&before&&after){
        let rotation=Math.atan2(after.y-before.y,after.x-before.x);if(rotation>Math.PI/2)rotation-=Math.PI;if(rotation< -Math.PI/2)rotation+=Math.PI;
        queue.push({kind:'engraving',p,z:p.z+.1,rotation,text:ri===1?String(j*30):['XII','I','II','III','IV','V','VI','VII','VIII','IX','X','XI'][j],size:settings.annotationScale*clamp(p.k*(ring.carrier?5.7:6.4),5.5,16),alpha:.45});
      }
    }
    // Rivets, inner-edge hairlines and narrow bridges make an instrument,
    // rather than a collection of unrelated wire circles.
    for(let j=0;j<4;j++){
      const a=j/4*TAU+phase;
      dot3(ringPoint(ring,a,radius-ring.w*.5,time,opening),v,1.15,.48);
    }
  });
}
function addHardware(time,v){
  const axis=rotate({x:0,y:0,z:1},1.27,.10,-.17);
  const point=d=>({x:axis.x*d,y:axis.y*d,z:axis.z*d});
  for(const offset of [-3,0,3]){
    const a=point(-357),b=point(357);a.x+=offset;b.x+=offset;line3(a,b,v,offset===0?.7:.28,offset===0?2.4:.8,'#c1ad7d');
  }
  for(const sign of [-1,1]){
    const p=point(sign*338);dot3(p,v,6,.8);
    for(const dz of [-4,0,4]){
      const center=point(sign*(343+dz));
      let previous=null;
      for(let i=0;i<=48;i++){
        const a=i/48*TAU,p=rotate({x:Math.cos(a)*12,y:Math.sin(a)*12,z:0},1.27,.10,-.17);
        p.x+=center.x;p.y+=center.y;p.z+=center.z;if(previous)line3(previous,p,v,.44,.7);previous=p;
      }
    }
  }
  const south=point(-355),base={x:87,y:439,z:35};
  for(let k=-2;k<=2;k++)line3({...south,x:south.x+k*2},{...base,x:base.x+k*3},v,k===0?.65:.25,k===0?2.8:.7,'#bba579');
  // A graduated semicircular mounting cradle and an elliptical plinth.
  for(const r of [42,49,56]){
    let previous=null;
    for(let i=0;i<=60;i++){
      const a=Math.PI*.03+i/60*Math.PI*.94,p={x:base.x+Math.cos(a)*r,y:base.y-18-Math.sin(a)*r,z:base.z};
      if(previous)line3(previous,p,v,.38,.65);previous=p;
    }
  }
  for(const r of [35,50,84,98]){
    let previous=null;
    for(let i=0;i<=96;i++){
      const a=i/96*TAU,p={x:base.x+Math.cos(a)*r,y:453+Math.sin(a)*r*.13,z:base.z+Math.sin(a)*r*.58};
      if(previous)line3(previous,p,v,.44,.8);previous=p;
    }
  }
}
function addInnerSphere(time,v){
  for(let j=0;j<7;j++)circle3(210,j*.42+.1,time*.011+j*.21,.15,0,time,v,.075);
  for(const h of [-130,-65,65,130])circle3(Math.sqrt(210*210-h*h),1.27,.1,-.17,h,time,v,.07);
  const transform=rotationTransform(.14,time*.009,0),points=nodes.map(transform);
  points.forEach((p,i)=>{line3(p,points[(i+3)%points.length],v,.13,.48,'#91a29c');dot3(p,v,.8,.47);});
  const p=project({x:0,y:0,z:0},v);
  const reveal=smooth((v.push-.35)/.65);
  if(p&&reveal<1)queue.push({kind:'globe',p,z:31,r:p.k*32,time,opacity:1-reveal});
  if(p&&reveal>0){
    queue.push({kind:'dot',p,z:0,r:2,alpha:.85*reveal});
    for(let j=0;j<8;j++){const a=j/8*TAU,r=j%2?9:16;queue.push({kind:'line',p:{x:p.x+Math.cos(a)*4,y:p.y+Math.sin(a)*4},q:{x:p.x+Math.cos(a)*r,y:p.y+Math.sin(a)*r},z:0,alpha:.45*reveal,width:.6,color:ink});}
  }
}
function addSpectralStars(time,v){
 if(!settings.spectralStars||settings.density<=0)return;
 const strength=settings.spectralStrength*settings.reactivity*motion;
 const transform=rotationTransform(.14,time*.009,0);
 for(const star of spectralStars.filter(s=>s.phase<clamp(settings.density))){
  const world=transform(star),p=project(world,v);if(!p)continue;
  if(p.x<36||p.x>1244||p.y<84||p.y>636)continue;
  const level=Math.min(1,spectralEnergy(stardust.value,star.bin,strength));
  const away=1-.88*Number(lyricZones.some(z=>p.x>z.left&&p.x<z.right&&p.y>z.top&&p.y<z.bottom));
  queue.push({kind:'spectral-star',p,z:p.z+.2,r:(star.major?.48:.28)+level*.32,alpha:(.10+level*.37)*away,level,major:star.major});
 }
}
function addDotRing(time,v){
 if(!settings.spectralRing)return;
 const enabled=!ctx.staticMode&&!reduced.matches,amount=enabled?settings.ringStrength*settings.reactivity:0;
 const transform=rotationTransform(.10,time*.009,0),count=Math.round(clamp(settings.ringCount,24,112));
 for(let i=0;i<count;i++){
  const angle=i/count*TAU-Math.PI/2,bin=Math.round((1-Math.abs(i/count*2-1))*95);
  const energy=Math.min(1,spectralEnergy(dotRing.value,bin,amount));
  const jump=7.5*energy+2.5*signal.hit*Math.min(1,amount);
  const radial=settings.ringScale*(1+jump/195);
  const world=transform({x:Math.cos(angle)*195*radial,y:Math.sin(angle)*148*radial,z:0});
  const p=project(world,v);if(!p||p.x<36||p.x>1244||p.y<84||p.y>636)continue;
  const clearance=lyricZones.some(z=>p.x>z.left&&p.x<z.right&&p.y>z.top&&p.y<z.bottom)?.28:1;
  queue.push({kind:'ring-dot',p,z:p.z+.3,r:(i%8===0?.85:.62)+energy*.42,alpha:(.30+energy*.60)*clearance*clamp(settings.ringOpacity),energy});
 }
}
function addTravellers(time,v,phaseTime){
  rings.slice(0,6).forEach((ring,i)=>{
    const a=dialPhase(ring,ring.carrier||ring.id==='tropic-n'?phaseTime:time)+.7+i*1.13+time*(.04+i*.003);
    const p=project(ringPoint(ring,a,ring.r-ring.w*.5,time,opening),v);
    if(p)queue.push({kind:'bead',p,z:p.z+1,alpha:.8});
    let previous=null;
    for(let j=0;j<17;j++){
      const p=ringPoint(ring,a-j*.004,ring.r-ring.w*.5,time,opening);
      if(previous)line3(previous,p,v,.35*(1-j/17),.85,'#e5ca8d');previous=p;
    }
  });
}
function drawGlobe(item){
  const {p,r,time}=item,globeAlpha=sceneAlpha*(item.opacity??1);
  c.save();c.globalAlpha=globeAlpha*.98;
  const g=c.createRadialGradient(p.x-r*.3,p.y-r*.35,r*.06,p.x,p.y,r);g.addColorStop(0,daylight?'#e5d8b4':'#3b4035');g.addColorStop(.6,daylight?'#acb7a1':'#192825');g.addColorStop(1,daylight?'#556d68':'#081315');
  c.beginPath();c.arc(p.x,p.y,r,0,TAU);c.fillStyle=g;c.fill();c.clip();
  c.strokeStyle='#b2a37b';c.lineWidth=.45;c.globalAlpha=globeAlpha*.32;
  for(let j=-3;j<=3;j++){
    const y=j/4*r,rx=Math.sqrt(r*r-y*y);c.beginPath();c.ellipse(p.x,p.y+y,rx,Math.max(1,rx*.15),0,0,TAU);c.stroke();
  }
  for(let j=0;j<7;j++){
    const a=j/7*Math.PI+time*.025;c.beginPath();c.ellipse(p.x,p.y,Math.max(1,Math.abs(Math.cos(a))*r),r,-.2,0,TAU);c.stroke();
  }
  c.restore();c.globalAlpha=globeAlpha*.6;c.strokeStyle='#a9996f';c.lineWidth=.7;c.beginPath();c.arc(p.x,p.y,r,0,TAU);c.stroke();
}
function drawItem(item){
  if(item.kind==='band'){
    const {p,q,hi,lo,ri,i}=item,depth=clamp((item.z+340)/680);
    const brightness=.10+depth*.20,grain=.93+.07*Math.sin(i*5.3+ri*1.2);
    c.globalAlpha=sceneAlpha*brightness*grain;c.fillStyle=metal;c.strokeStyle=accent;
    c.beginPath();c.moveTo(p.x,p.y);c.lineTo(q.x,q.y);c.lineTo(lo.x,lo.y);c.lineTo(hi.x,hi.y);c.closePath();c.fill();
    c.lineWidth=.65;c.beginPath();c.moveTo(p.x,p.y);c.lineTo(q.x,q.y);c.stroke();c.globalAlpha*=.70;c.lineWidth=.45;c.beginPath();c.moveTo(hi.x,hi.y);c.lineTo(lo.x,lo.y);c.stroke();
    if(i%2===0){c.globalAlpha*=.55;c.beginPath();c.moveTo(p.x*.25+hi.x*.75,p.y*.25+hi.y*.75);c.lineTo(q.x*.25+lo.x*.75,q.y*.25+lo.y*.75);c.stroke();}
  }else if(item.kind==='line'){
    c.globalAlpha=clamp(sceneAlpha*item.alpha);c.strokeStyle=item.color;c.lineWidth=item.width;c.beginPath();c.moveTo(item.p.x,item.p.y);c.lineTo(item.q.x,item.q.y);c.stroke();
  }else if(item.kind==='engraving'){
    c.save();c.translate(item.p.x,item.p.y);c.rotate(item.rotation);c.globalAlpha=sceneAlpha*item.alpha;c.fillStyle=accent;c.font=`${item.size}px ${serif}`;c.textAlign='center';c.textBaseline='middle';c.fillText(item.text,0,0);c.restore();
  }else if(item.kind==='dot'||item.kind==='bead'){
    const {p}=item;c.globalAlpha=Math.min(1,sceneAlpha*(item.alpha||.6)*(1+signal.treble*.25*settings.reactivity*motion));
    if(item.kind==='bead'){const g=c.createRadialGradient(p.x,p.y,0,p.x,p.y,9);g.addColorStop(0,'#dfc48655');g.addColorStop(1,'#c8b48000');c.fillStyle=g;c.fillRect(p.x-10,p.y-10,20,20);}
    c.fillStyle=ink;c.beginPath();c.arc(p.x,p.y,item.r||1.8,0,TAU);c.fill();
  }else if(item.kind==='ring-dot'){
    c.globalAlpha=clamp(sceneAlpha*item.alpha);c.fillStyle=daylight?'#465f69':'#f4f8ff';
    c.beginPath();c.arc(item.p.x,item.p.y,item.r,0,TAU);c.fill();
  }else if(item.kind==='spectral-star'){
    const {p,r,alpha,level}=item;c.globalAlpha=clamp(sceneAlpha*alpha);c.fillStyle=ink;
    c.beginPath();c.arc(p.x,p.y,r,0,TAU);c.fill();
    if(item.major){c.globalAlpha*=.48;c.strokeStyle=ink;c.lineWidth=.45;const ray=.6+level*.9;c.beginPath();c.moveTo(p.x-ray,p.y);c.lineTo(p.x+ray,p.y);c.stroke();}
  }else if(item.kind==='globe')drawGlobe(item);
  else if(item.kind==='lyric'){
    const {place:p,size,width,text,subtitle,progress,signal}=item;
    c.save();c.translate(p.p.x,p.p.y);c.rotate(p.rotation);
    const emphasis=item.active*settings.lyricMotion*motion;
    c.scale(p.scaleX*(1+emphasis*(.02+signal.bass*.035*settings.reactivity)),p.scaleY*(1+emphasis*(.045+signal.vocal*.07*settings.reactivity)));
    c.font=`400 ${size}px ${serif}`;c.textAlign='center';c.textBaseline='alphabetic';
    c.globalAlpha=sceneAlpha*item.opacity*item.glyphOpacity;c.fillStyle=ink;
    // An offset ink shadow keeps fine serif edges readable over the metal.
    c.shadowColor=daylight?"#f3efe5":"#071014";c.shadowBlur=1.5;c.shadowOffsetY=.3;c.fillText(text,0,0);c.shadowBlur=0;c.shadowOffsetY=0;
    if(!subtitle&&progress>0){c.beginPath();c.rect(-width/2-1,-size*1.3,(width+2)*progress,size*1.7);c.clip();c.fillStyle=accent;c.globalAlpha=sceneAlpha*item.opacity*item.glyphOpacity;c.fillText(text,0,0);}
    c.restore();
  }else if(item.kind==='translation'){
    c.save();c.translate(item.x,item.y);c.rotate(item.rotation);c.globalAlpha=sceneAlpha*item.opacity;
    c.font=`400 ${item.size}px ${serif}`;c.fillStyle=ink;c.textAlign='center';c.textBaseline='alphabetic';c.letterSpacing='.65px';
    c.shadowColor=paper;c.shadowBlur=3;c.fillText(item.text,0,0);c.restore();
  }
}

function addLyrics(time,geometryTime,v,phaseTime){
 if(display.showText===false)return;
 const current=ctx.staticMode?ctx.staticLineIndex:ctx.getLineIndex();
 let last=current;
 // A short outgoing tail remains on its own ring while the next line appears.
 if(last<0){let lo=0,hi=ctx.lines.length-1;while(lo<=hi){const mid=(lo+hi)>>1;if(ctx.lines[mid].startTime<=time){last=mid;lo=mid+1;}else hi=mid-1;}}
 const indices=ctx.staticMode?[current]:[last-1,last];
 for(const index of indices){
 const line=ctx.lines[index];if(!line)continue;
 const end=line.renderHints?.renderEndTime??line.endTime;
 if(!ctx.staticMode&&(time<line.startTime||time>end+.35))continue;
 if(index===last||ctx.staticMode)canvas.setAttribute('aria-label',line.fullText);
 const duration=Math.max(.001,end-line.startTime);
 const fade=Math.min(.35,duration*.18);
 // Each glyph owns its entrance; another line-wide fade would multiply it
 // and make the first character hang invisibly before suddenly brightening.
 const opacity=ctx.staticMode?1:line.renderHints?.lineTransitionMode==='none'?(time<=end?1:0):1-smooth((time-end)/.35);
 const ring=index%2===0?rings.find(r=>r.id==='tropic-n'):carrier;
 // A line receives a material anchor when born. It remains welded to that
 // spot until it fades, including while the camera and the ring both move.
 const anchorPhaseTime=motion?orbitClock(line.startTime)*.45*settings.orbitSpeed:0;
 let subtitleText='';
 if(display.showSubtitleTranslation!==false&&!display.hideTranslationSubtitle&&display.subtitleContentMode!=='none')
  subtitleText=display.subtitleContentMode==='romanization'?line.romanization||'':line.translation||'';
  const glyphs=glyphCache[index]||timedGlyphs(line);if(!glyphs.length)continue;
  const roles=rolesCache[index]||lyricRoles(glyphs);
  let sizes=roles.map(role=>13.2*role.scale*settings.lyricScale*(display.lyricsFontScale||1));
  let advances=glyphs.map((g,i)=>measure(g.text,sizes[i])+sizes[i]*.15);
  const total=advances.reduce((a,b)=>a+b,0),fit=Math.min(1,370/Math.max(1,total));
  sizes=sizes.map(x=>x*fit);advances=advances.map(x=>x*fit);
  const placements=attachedGlyphs({advances,time:geometryTime,v,opening,ring,phaseTime,anchorPhaseTime});
  placements.forEach((place,i)=>{
   if(!place)return;
   const g=glyphs[i],appearance=glyphAppearance(g,time,ctx.staticMode,settings.revealSpeed);
   if(!appearance.opacity)return;
   const progress=appearance.progress;
   const active=ctx.staticMode?0:smooth((time-g.wordStart)/.18)*(1-smooth((time-g.wordEnd)/.36));
   queue.push({kind:'lyric',place,z:place.p.z+1.2,text:g.text,size:sizes[i],width:advances[i],progress,glyphOpacity:appearance.opacity,active,opacity,subtitle:false,signal});
  });
  const visible=placements.map((p,i)=>p?{p,size:sizes[i],advance:advances[i]}:null).filter(Boolean);
  if(visible.length)lyricZones.push({left:Math.min(...visible.map(g=>g.p.p.x-g.advance*g.p.scaleX*.62))-12,right:Math.max(...visible.map(g=>g.p.p.x+g.advance*g.p.scaleX*.62))+12,top:Math.min(...visible.map(g=>g.p.p.y-g.size*g.p.scaleY*1.5))-8,bottom:Math.max(...visible.map(g=>g.p.p.y))+12});
  if(subtitleText){
   let size=15.5*settings.translationScale*(display.subtitleFontScale||1);
   const count=timedGlyphs({fullText:subtitleText,startTime:0,endTime:1}).length;
   let textWidth=measure(subtitleText,size)+Math.max(0,count-1)*.65;
   const fit=Math.min(1,340/Math.max(1,textWidth));size*=fit;
   textWidth=measure(subtitleText,size)+Math.max(0,count-1)*.65;
   const pos=translationPlacement(placements,textWidth,size,settings.translationGap);
   if(pos){
    queue.push({kind:'translation',...pos,z:1000,text:subtitleText,size,opacity:opacity*(ctx.staticMode?1:smooth((time-line.startTime)/fade))*.73*clamp(display.subtitleOverlayOpacity??1)});
    lyricZones.push({left:pos.x-textWidth/2-14,right:pos.x+textWidth/2+14,top:pos.y-size-10,bottom:pos.y+10});
   }
  }
 }
}

function paint(){
 if(disposed||width<=0||height<=0)return;
 const time=ctx.lyricTime.get();
 const selected=ctx.lines[ctx.staticLineIndex];
 const sceneTime=ctx.staticMode?Math.max(3,selected?.startTime||3):Math.max(0,time);
 // Keep the reference's single camera push; no new camera on line changes.
 const geometryTime=motion?sceneTime*.45*motion:0;
 const phaseTime=motion?orbitClock(sceneTime)*.45*settings.orbitSpeed:0;
 const v=view(Math.max(0,sceneTime));
 if(!motion){Object.assign(v,view(3),{cx:550,cy:343,yaw:.07,pitch:-.028});}
 v.focal*=settings.diagramScale;
 c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,canvas.width,canvas.height);
 if(!settings.transparent&&!ctx.getSurface().transparent){c.fillStyle=paper;c.fillRect(0,0,canvas.width,canvas.height);}
 const scale=Math.min(canvas.width/1280,canvas.height/720);
 c.setTransform(scale,0,0,scale,(canvas.width-1280*scale)/2,(canvas.height-720*scale)/2);
 if(!settings.transparent&&!ctx.getSurface().transparent){
  c.fillStyle=paper;c.fillRect(0,0,1280,720);
  if(settings.palette!=='custom'){
   const bg=c.createRadialGradient(620,342,35,640,355,750);
   bg.addColorStop(0,daylight?'#e8e2d2':'#14202b');bg.addColorStop(.55,daylight?'#eee9de':'#0b131d');bg.addColorStop(1,paper);
   c.fillStyle=bg;c.fillRect(0,0,1280,720);
  }
 }
 sceneAlpha=ctx.staticMode?1:Math.max(.04,smooth(sceneTime/.45));
 c.save();c.beginPath();c.rect(36,84,1208,552);c.clip();
 stars.slice(0,Math.round(stars.length*clamp(settings.density))).forEach((p,i)=>{
  const energy=settings.spectralStars?Math.min(1,spectralEnergy(stardust.value,i*17,settings.spectralStrength*settings.reactivity*motion)):0;
  const s=project(p,v);if(s&&s.x>36&&s.x<1244&&s.y>84&&s.y<636){c.globalAlpha=clamp(sceneAlpha*p.a*(1+energy*.45));c.fillStyle=ink;c.beginPath();c.arc(s.x,s.y,Math.min(1.35,p.r*s.k*.6*(1+energy*.25)),0,TAU);c.fill();}
 });
 canvas.setAttribute('aria-label','星图仪歌词动效');
 queue=[];lyricZones=[];addRings(geometryTime,v,phaseTime);
 if(v.push<1){const start=queue.length;addHardware(geometryTime,v);for(let i=start;i<queue.length;i++)queue[i].alpha*=1-smooth(v.push);}
 addInnerSphere(geometryTime,v);addTravellers(geometryTime,v,phaseTime);addLyrics(time,geometryTime,v,phaseTime);addSpectralStars(geometryTime,v);addDotRing(geometryTime,v);
 queue.sort((a,b)=>a.z-b.z);queue.forEach(drawItem);
 // Small planispheres sit behind the instrument, as in the supplied video.
 for(const x of v.push<.8?[1154,126]:[1154]){
  c.save();c.globalAlpha=sceneAlpha*.09;c.translate(x,375);c.strokeStyle=accent;c.lineWidth=.6;
  for(const r of [88,142]){c.beginPath();c.arc(0,0,r,0,TAU);c.stroke();}
  for(let i=0;i<6;i++){const a=i/6*TAU;c.beginPath();c.arc(Math.cos(a)*45,Math.sin(a)*45,65,0,TAU);c.stroke();}c.restore();
 }
 if(settings.annotations){
  small('INNER ORBIT',50,113,.3);small('ARMILLARY STUDY / 04',50,130,.23);
  label('Within the turning sphere.',1227,118,14,.2,'right',true);
  label('Planisphaerium',1208,565,10,.32,'right');
  for(const [text,x,y]of [['AQR',155,160],['GEM',880,169],['CAP',110,362],['CAN',950,365],['SAG',170,578],['LEO',875,565]])label(text,x,y,8,.35);
 }
 c.restore();c.globalAlpha=1;
 c.save();c.letterSpacing='2.5px';label('ASTRAL / ATLAS',79,45,17,.83);c.letterSpacing='1.6px';small('A CELESTIAL LISTENING ROOM',80,61,.4);c.restore();
 c.save();c.strokeStyle=accent;c.globalAlpha=.65;c.lineWidth=.7;c.beginPath();c.arc(55,43,8,0,TAU);c.moveTo(55,30);c.lineTo(55,56);c.moveTo(42,43);c.lineTo(68,43);c.stroke();c.restore();
 c.save();c.beginPath();c.rect(410,15,460,48);c.clip();label(ctx.song?.title||'Celestial Orbits',640,45,18,.75,'center',true);c.restore();
 small('LYRICAL ORBITS',1215,47,.65,'right');
 c.strokeStyle=accent;c.globalAlpha=.2;c.lineWidth=.6;c.beginPath();c.moveTo(44,74);c.lineTo(1236,74);c.stroke();
 if(settings.audioStatus)small(signal.unavailable?'AUDIO / NO FFT':signal.hasSignal?'AUDIO / '+signal.source.toUpperCase():'AUDIO / SILENT',1215,65,.4,'right');
 c.globalAlpha=1;
}
function resize(size){
 width=Math.max(0,size.width);height=Math.max(0,size.height);
 const ratio=Math.min(devicePixelRatio||1,2,Math.sqrt(2560*1440/Math.max(1,width*height)));
 canvas.width=Math.max(1,Math.round(width*ratio));canvas.height=Math.max(1,Math.round(height*ratio));paint();
}
function reset(){reactor.reset();stardust.reset();dotRing.reset();signal=reactor.value;opening=0;lastStamp=null;}
function onTime(){
 const now=ctx.lyricTime.get();if(Math.abs(now-lastTime)>.5||(ctx.isPaused()&&now!==lastTime))reset();lastTime=now;
 if(ctx.isPaused()||ctx.staticMode)paint();
}
refresh();
unsubs.push(ctx.onResize(resize),ctx.onLyricTime(onTime),ctx.onChange(()=>{refresh();lastStamp=null;paint();}),ctx.onFrame(stamp=>{
 if(disposed||ctx.isPaused()||ctx.staticMode){lastStamp=null;return;}
 const dt=clamp(lastStamp===null?1/60:(stamp-lastStamp)/1000,.001,.08);lastStamp=stamp;
 signal=reactor.step(ctx.audio,dt,ctx.isPreview);
 stardust.step(signal,dt);
 dotRing.step(signal,dt);
 const target=(signal.bloom*.7+signal.bass*.3)*settings.reactivity*motion;
 opening+=(target-opening)*(1-Math.exp(-dt/.24));if(opening<.00001)opening=0;paint();
}));
const onReduced=()=>{refresh();paint();};reduced.addEventListener('change',onReduced);
const bounds=container.getBoundingClientRect();resize({width:bounds.width,height:bounds.height});
return ()=>{if(disposed)return;disposed=true;unsubs.forEach(fn=>fn());reduced.removeEventListener('change',onReduced);metricCache.clear();canvas.remove();};
}
