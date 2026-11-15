import { mountAtlas } from './renderer.mjs';

const label = (zh, en) => ({ 'zh-CN': zh, en });
const group = label('星图与运动', 'Atlas & motion');
const size = label('独立尺寸', 'Independent sizes');
const appearance = label('日夜与配色', 'Day / night & colors');
const type = label('歌词与字体动作', 'Kinetic typography');
const field = (key, zh, en, value, min, max, step, section = group) => ({
  key, type: 'number', label: label(zh, en), defaultValue: value, min, max, step, group: section,
});

export default function activate(folium) {
  folium.registries.visualizers.register({
    id: 'celestial',
    label: label('星图仪 · 内轨', 'Astral Atlas · Inner Orbit'),
    order: 460,
    hostLayers: { background: false, subtitles: false },
    settings: [
      field('diagramScale','浑天仪大小','Armillary size',1,.65,1.25,.05,size),
      field('lyricScale','随轨歌词大小','Orbital lyric size',1,.6,1.6,.05,size),
      field('translationScale','译文大小','Translation size',1,.65,1.6,.05,size),
      field('translationGap','译文与主句间距','Translation clearance',38,24,72,2,size),
      field('annotationScale','刻度标注大小','Engraving size',1,.6,1.5,.05,size),
      field('ringScale','白点环大小','White dot ring size',1,.65,1.35,.05,size),
      field('motion','星轨运动幅度','Orbit motion',1,0,1.6,.05),
      field('orbitSpeed','歌词随轨移动速度','Lyric orbit speed',1,0,2,.05,type),
      field('reactivity','音乐响应强度','Audio response',1,0,2,.05),
      field('lyricMotion','字形律动幅度','Glyph response',1,0,1.6,.05,type),
      {...field('revealSpeed','歌词浮现速度','Lyric reveal speed',1,.4,2,.05,type),description:label('低值更舒展，高值更利落；逐字时点仍跟随歌曲，星轨速度单独调节。','Lower is softer, higher is quicker. Word timing and orbit speed stay independent.')},
      field('density','星尘密度','Stardust density',.65,0,1,.05),
      {key:'spectralStars',type:'boolean',label:label('四周星点频谱','Spectral stardust'),defaultValue:true,group},
      field('spectralStrength','星点频谱幅度','Spectral stardust strength',1,0,2,.05),
      {key:'spectralRing',type:'boolean',label:label('环形白点频谱','White dot spectrum ring'),defaultValue:true,group},
      field('ringStrength','白点跳动幅度','White dot bounce',1,0,2,.05),
      field('ringCount','白点数量','White dot count',64,24,112,8),
      field('ringOpacity','白点可见度','White dot visibility',.65,.2,1,.05),
      {key:'annotations',type:'boolean',label:label('天文刻度标注','Engraved numerals'),defaultValue:true,group},
      {key:'audioStatus',type:'boolean',label:label('显示音频信号状态','Audio signal status'),defaultValue:false,group},
      {key:'transparent',type:'boolean',label:label('透明背景','Transparent background'),defaultValue:false,group},
      {key:'palette',type:'select',label:label('日夜配色','Day / night'),defaultValue:'follow',group:appearance,
       description:label('跟随 Folia 的太阳 / 月亮按钮。','Follows Folia daylight.'),
       options:[['follow','跟随 Folia','Follow Folia'],['day','固定白天','Day'],['night','固定夜晚','Night'],['custom','自定义','Custom']].map(([value,zh,en])=>({value,label:label(zh,en)}))},
      {key:'ink',type:'color',label:label('自定义 · 文字与线条','Custom ink'),defaultValue:'#eee9d5',group:appearance},
      {key:'accent',type:'color',label:label('自定义 · 黄铜与高亮','Custom brass'),defaultValue:'#d8c796',group:appearance},
      {key:'paper',type:'color',label:label('自定义 · 背景','Custom background'),defaultValue:'#080b0e',group:appearance},
    ],
    mount: (container, ctx) => mountAtlas(folium, container, ctx),
  });
}
