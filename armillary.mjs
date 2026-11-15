export const TAU=Math.PI*2;
export const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
export const smooth=t=>{t=clamp(t);return t*t*t*(t*(t*6-15)+10);};
export function rotate(p,rx,ry,rz){
  const ax=Math.cos(rx),bx=Math.sin(rx),ay=Math.cos(ry),by=Math.sin(ry),az=Math.cos(rz),bz=Math.sin(rz);
  const y=p.y*ax-p.z*bx,z=p.y*bx+p.z*ax,x=p.x*ay+z*by,z2=-p.x*by+z*ay;
  return {x:x*az-y*bz,y:x*bz+y*az,z:z2};
}
export function rotationTransform(rx,ry,rz){
  const ax=Math.cos(rx),bx=Math.sin(rx),ay=Math.cos(ry),by=Math.sin(ry),az=Math.cos(rz),bz=Math.sin(rz);
  return p=>{
    const y=p.y*ax-p.z*bx,z=p.y*bx+p.z*ax,x=p.x*ay+z*by,z2=-p.x*by+z*ay;
    return {x:x*az-y*bz,y:x*bz+y*az,z:z2};
  };
}
const ringTransforms=new WeakMap(),viewTransforms=new WeakMap();
export const rings=[
  {id:'meridian',name:'MERIDIAN',r:336,w:7,x:.06,y:.20,z:-.17,spin:.0028,material:.010,phase:.2,ticks:360,numerals:true},
  {id:'ecliptic',name:'ECLIPTICA',r:315,w:6,x:.86,y:.13,z:-.17,spin:-.004,material:.016,phase:1.1,ticks:360,numerals:true},
  {id:'colure-a',name:'COLURUS',r:306,w:5,x:.25,y:1.02,z:-.15,spin:.0045,material:-.008,phase:2.3,ticks:180},
  {id:'colure-b',name:'AEQUINOCTIUM',r:300,w:4,x:.55,y:-.86,z:.24,spin:-.003,material:.008,phase:3.9,ticks:120},
  {id:'lyric-equator',name:'AEQUATOR',r:276,w:5.5,x:1.45,y:-.05,z:.10,spin:.002,material:-.061,phase:2.7,ticks:240,numerals:true,carrier:true},
  {id:'tropic-n',name:'TROPICUS',r:276,w:5,x:1.45,y:-.05,z:.10,h:45,spin:.002,material:.067,phase:2.7,ticks:120,numerals:true},
  {id:'tropic-s',name:'TROPICUS',r:247,w:3,x:1.27,y:.10,z:-.17,h:-112,spin:.002,material:.009,phase:2.7,ticks:120},
  {id:'polar-n',name:'CIRCULUS POLARIS',r:145,w:6,x:1.27,y:.10,z:-.17,h:230,spin:.002,material:.012,phase:2.7,ticks:90},
  {id:'polar-s',name:'CIRCULUS POLARIS',r:145,w:6,x:1.27,y:.10,z:-.17,h:-230,spin:.002,material:.012,phase:2.7,ticks:90},
  {id:'horizon',name:'HORIZON',r:326,w:4,x:1.48,y:0,z:.015,spin:0,material:.004,phase:.7,ticks:180,numerals:true},
];
export const carrier=rings.find(r=>r.carrier);
export function dialPhase(ring,time){return time*ring.material;}
export function ringPoint(ring,angle,radius,time,opening=0){
  let cached=ringTransforms.get(ring);
  if(!cached||cached.time!==time||cached.opening!==opening){
    const rx=ring.x+Math.sin(time*.095+ring.phase)*.024+opening*.018*Math.sin(ring.phase);
    const ry=ring.y+Math.sin(time*.045)*ring.spin*12;
    const rz=ring.z+Math.sin(time*.075+ring.phase)*.012;
    cached={time,opening,transform:rotationTransform(rx,ry,rz)};ringTransforms.set(ring,cached);
  }
  return cached.transform({x:Math.cos(angle)*radius,y:Math.sin(angle)*radius,z:ring.h||0});
}
export function view(time){
  const push=smooth((time-.70)/.85);
  return {z:1270+(437-1270)*push,focal:742,cx:610-60*push+Math.sin(time*.10)*8*push,cy:343+Math.sin(time*.12)*4*push,
    yaw:-.16+.23*push+Math.sin(time*.09)*.014,pitch:-.028+Math.sin(time*.10)*.012,push};
}
export function project(p,v){
  let cached=viewTransforms.get(v);
  if(!cached||cached.pitch!==v.pitch||cached.yaw!==v.yaw){cached={pitch:v.pitch,yaw:v.yaw,transform:rotationTransform(v.pitch,v.yaw,0)};viewTransforms.set(v,cached);}
  const q=cached.transform(p),depth=v.z-q.z;
  if(depth<105)return null;
  const k=v.focal/depth,x=v.cx+q.x*k,y=v.cy+q.y*k;
  if(!Number.isFinite(x+y)||Math.abs(x)>4500||Math.abs(y)>3500)return null;
  return {x,y,z:q.z,depth,k};
}

// Engraved ticks and lyrics share this material phase, ring plane and radius.
// There is no viewport-centred text position anywhere in this calculation.
export function attachedGlyphs({advances,time,v=view(time),opening=0,subtitle=false,ring=carrier,anchorTime=0,phaseTime=time,anchorPhaseTime=anchorTime}){
  const radius=subtitle?ring.r+20:ring.r-ring.w-3;
  const center=Math.PI/2-.08+dialPhase(ring,phaseTime)-dialPhase(ring,anchorPhaseTime);
  const total=advances.reduce((a,b)=>a+b,0);let along=0;
  return advances.map((advance,index)=>{
    const a=center-(along+advance/2-total/2)/radius;along+=advance;
    const world=ringPoint(ring,a,radius,time,opening),p=project(world,v);
    const before=project(ringPoint(ring,a+.002,radius,time,opening),v),after=project(ringPoint(ring,a-.002,radius,time,opening),v);
    if(!p||!before||!after)return null;
    const tx=(after.x-before.x)/(.004*radius),ty=(after.y-before.y)/(.004*radius);
    return {index,angle:a,ringId:ring.id,radius,world,p,rotation:Math.atan2(ty,tx),
      scaleX:Math.max(p.k*.62,Math.hypot(tx,ty)),scaleY:p.k*.96};
  });
}
