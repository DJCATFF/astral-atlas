export function seededRandom(seed) {
  let n = 2166136261;
  for (const c of String(seed)) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
  return () => { n += 0x6D2B79F5; let t = n; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

// Unicode graphemes keep combining marks and emoji together. Timing is always lyric time.
const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
const graphemes = text => segmenter ? [...segmenter.segment(text)].map(v => v.segment) : Array.from(text);
export function timedGlyphs(line) {
  if (!line) return [];
  let words = line.words || [];
  if (words.map(w => w.text).join('') !== line.fullText) words = [{ text: line.fullText, startTime: line.startTime, endTime: line.endTime }];
  return words.flatMap((word,wordIndex) => {
    const chars = graphemes(word.text), duration = Math.max(.001, word.endTime - word.startTime);
    return chars.map((text, i) => {
      const start=word.startTime+i/chars.length*duration,end=word.startTime+(i+1)/chars.length*duration;
      return {text,start,end,wordIndex,wordStart:words.length>1?word.startTime:start,wordEnd:words.length>1?word.endTime:end};
    });
  });
}

const wordSegmenter=typeof Intl.Segmenter==='function'?new Intl.Segmenter(undefined,{granularity:'word'}):null;
const particles=/^(?:the|a|an|and|or|of|to|in|on|at|is|it|we|you|my|your|with|let|every|that|this|の|に|を|は|が|と|も|へ|で|て|から|この|その|的|了|着|在|与|和|让|每|都|有|把|我们|你|我)$/iu;
// Optical hierarchy, not a lyric-content classifier: prefer a short content
// word, keep particles small, and reserve its larger advance before drawing.
export function lyricRoles(glyphs){
 const full=glyphs.map(g=>g.text).join('');
 const segments=wordSegmenter?[...wordSegmenter.segment(full)]:glyphs.map((g,i)=>({segment:g.text,index:glyphs.slice(0,i).reduce((n,g)=>n+g.text.length,0),isWordLike:/[\p{L}\p{N}]/u.test(g.text)}));
 let cursor=0;const spans=glyphs.map(g=>{const start=cursor;cursor+=g.text.length;return {start,end:cursor,duration:Math.max(0,g.end-g.start)};});
 const average=spans.reduce((sum,s)=>sum+s.duration,0)/Math.max(1,spans.length);
 const groups=segments.filter(g=>g.isWordLike&&!particles.test(g.segment));
 groups.sort((a,b)=>{
  const score=g=>{
   const matching=spans.filter(s=>s.start<g.index+g.segment.length&&s.end>g.index);
   const hold=matching.reduce((sum,s)=>sum+s.duration,0)/Math.max(1,matching.length);
   return Math.min(4,graphemes(g.segment).length)*.22+(graphemes(g.segment).length<=4?.55:0)-Math.abs(g.index/Math.max(1,full.length)-.35)*.25+.45*(Math.max(.6,Math.min(2,hold/Math.max(.001,average)))-1);
  };
  return score(b)-score(a)||a.index-b.index;
 });
 const hero=groups[0];let offset=0;
 return glyphs.map(g=>{
  const index=offset;offset+=g.text.length;
  const segment=segments.find(s=>index>=s.index&&index<s.index+s.segment.length);
  const lead=hero&&index>=hero.index&&index<hero.index+hero.segment.length;
  return {scale:lead?(graphemes(hero.segment).length>6?1.3:1.62):segment&&particles.test(segment.segment)?.8:/[\p{L}\p{N}]/u.test(g.text)?1:.76,hero:!!lead};
 });
}

const limit=(v,a,b)=>Math.max(a,Math.min(b,v));
export function translationPlacement(placements,textWidth,fontSize,gap=38){
 const valid=placements.filter(Boolean);if(!valid.length)return null;
 const anchor=valid[Math.floor((valid.length-1)*.58)];
 const angle=limit(anchor.rotation,-.12,.12);
 const half=textWidth/2,normalGap=Math.max(gap,fontSize+16);
 const x=anchor.p.x-Math.sin(angle)*normalGap+22;
 const y=anchor.p.y+Math.cos(angle)*normalGap;
 return {x:limit(x,64+half,1216-half),y:limit(y,110+fontSize,617-fontSize*.25),rotation:angle};
}

export function spectralEnergy(signal,bin,strength=1){
 const levels=signal.spectrum;
 const value=levels?.length?levels[((bin%levels.length)+levels.length)%levels.length]:0;
 return limit((Number.isFinite(value)?value:0)*Math.max(0,strength),0,1.5);
}

export function glyphAppearance(glyph,time,instant=false,speed=1){
 if(instant)return {opacity:1,progress:1};
 const elapsed=time-glyph.start;
 if(elapsed<=0)return {opacity:0,progress:0};
 const duration=Math.max(.001,glyph.end-glyph.start);
 // Let successive characters overlap in their fades. No pre-roll: a future
 // character is still absent, but its entrance spans enough frames to flow.
 const rate=Number.isFinite(speed)?limit(speed,.4,2):1;
 const u=limit(elapsed/(limit(duration*.85+.10,.18,.26)/rate),0,1);
 return {opacity:u*u*u*(u*(u*6-15)+10),progress:limit(elapsed/duration,0,1)};
}

// Integrate a continuous transport clock. Very long lyric holds receive a
// slower cruise, so text stays readable; ordinary phrases match the 8s study.
export function makeOrbitClock(lines){
 const end=l=>Math.max(l.startTime,l.renderHints?.renderEndTime??l.endTime);
 const boundaries=[...new Set([0,...lines.flatMap(l=>[Math.max(0,l.startTime),Math.max(0,end(l))])])].sort((a,b)=>a-b);
 const spans=[];let cursor=-1,prefix=0,previous=1;
 const integral=(elapsed,span)=>{
  const ramp=Math.min(.35,(span.end-span.start)/2),u=Math.min(1,elapsed/ramp);
  if(!ramp)return elapsed*span.factor;
  const head=span.previous*Math.min(elapsed,ramp)+(span.factor-span.previous)*ramp*(u*u*u-u*u*u*u/2);
  return head+Math.max(0,elapsed-ramp)*span.factor;
 };
 for(let i=0;i<boundaries.length;i++){
  const start=boundaries[i],finish=boundaries[i+1]??Infinity,mid=Number.isFinite(finish)?(start+finish)/2:start+1;
  while(cursor+1<lines.length&&lines[cursor+1].startTime<=mid)cursor++;
  const line=lines[cursor],factor=line&&mid<end(line)?Math.min(1,4.5/Math.max(.001,end(line)-line.startTime)):1;
  const span={start,end:finish,factor,previous:i?previous:factor,prefix};spans.push(span);
  if(Number.isFinite(finish))prefix+=integral(finish-start,span);previous=factor;
 }
 return time=>{
  const t=Math.max(0,time);let lo=0,hi=spans.length-1;
  while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(spans[mid].start<=t)lo=mid;else hi=mid-1;}
  const span=spans[lo];return span.prefix+integral(t-span.start,span);
 };
}

