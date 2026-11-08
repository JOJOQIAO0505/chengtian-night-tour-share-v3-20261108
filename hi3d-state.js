export const SAVE_KEY='hi3d-chengtian-night-v1';
export const SCENES=['future','temple','shrine','westhall','easthall'];
export const fresh=()=>({version:2,scene:'future',accepted:false,clues:[],talks:[],read:false,rechecked:false,judgment:{water:null,shadow:null},applied:null,visits:{future:0,temple:0,shrine:0,westhall:0,easthall:0},positions:{},completed:false,limit:{maxVisits:3,maxSeconds:180,used:0,remaining:180,active:false,entryClues:0,warned:false}});
export const clues={
 buddha:{title:'主殿的莲座佛像',source:'殿内观察',text:'佛像安置在莲座上，殿前灯火照亮雕纹。主殿内地面干燥，庭院的水层没有延伸进来。'},
 duty:{title:'偏殿的值夜簿',source:'虚构道具',text:'演出中的值夜簿未记下今夜降雨。这是改编现场的道具记录，可供参考，不能替代原作。'},
 staging:{title:'经卷间的布景札记',source:'虚构道具',text:'札记列出“铺设庭中水层”“暗纹去留待定”。这些是改编者添加的布景安排，并非原作文字。'},
 water:{title:'庭中水层',source:'现场观察',text:'鞋尖触到一层真实浅水，踏入时有波纹。现场确实有水，但是否符合原作仍待核对。'},
 shadow:{title:'交横的暗纹',source:'现场观察',text:'暗纹从竹柏脚边铺开，形状像枝叶，又被演出标为“水草异常”。'},
 monk_water:{title:'僧人的困扰',source:'虚构对白',text:'僧人说庭中鞋底会湿，却不记得今夜下过雨。他描述的是当前改编现场。'},
 monk_shadow:{title:'待删除的东西',source:'虚构对白',text:'僧人听说有人要抹掉庭中暗纹，理由是“水里不该长这些东西”。这只是待核对的说法。'},
 bucket:{title:'干燥的廊下',source:'现场观察',text:'木桶里空着，扫帚和廊下地面干燥。没有证据能把整庭积水归因于一次清扫。'},
 original:{title:'原作中的一句',source:'文学原文 · 苏轼《记承天寺夜游》',text:'庭下如积水空明，水中藻、荇交横，盖竹柏影也。'},
 recheck:{title:'读后复查：枝叶与暗纹',source:'对照观察',text:'沿干燥边缘看去，暗纹也落在没有水的石面上；风动时，暗纹与竹柏枝叶一同轻晃。'},
 monk_follow:{title:'读后追问：谁在说“水”？',source:'虚构对白',text:'僧人澄清：他口中的积水来自眼前这场改编，并不能证明原作者见到的就是一层水。'}
};
export function load(){try{const raw=localStorage.getItem(SAVE_KEY);if(!raw)return {state:fresh(),exists:false};const s=JSON.parse(raw);if(![1,2].includes(s.version)||!SCENES.includes(s.scene)||!Array.isArray(s.clues)||!Array.isArray(s.talks))throw Error('存档格式不匹配');const f=fresh();for(const k of ['accepted','read','rechecked','completed'])f[k]=s[k]===true;f.scene=s.scene;f.clues=s.clues.filter(k=>k in clues);f.talks=s.talks.filter(x=>typeof x==='string');for(const k of ['water','shadow'])f.judgment[k]=typeof s.judgment?.[k]==='boolean'?s.judgment[k]:null;if(typeof s.applied?.water==='boolean'&&typeof s.applied?.shadow==='boolean')f.applied={water:s.applied.water,shadow:s.applied.shadow};for(const w of SCENES){f.visits[w]=Math.max(0,Number(s.visits?.[w])||0);const p=s.positions?.[w];if(Array.isArray(p)&&p.length===2&&p.every(Number.isFinite))f.positions[w]=p;}if(s.version===2&&s.limit){f.limit.used=Math.max(0,Math.min(3,Number(s.limit.used)||0));f.limit.remaining=Math.max(0,Math.min(180,Number(s.limit.remaining)||0));f.limit.active=f.scene!=='future';f.limit.entryClues=Math.max(0,Number(s.limit.entryClues)||0);f.limit.warned=s.limit.warned===true;}else{f.limit.used=Math.min(3,f.visits.temple);f.limit.active=f.scene!=='future';f.limit.entryClues=f.clues.length;}return{state:f,exists:true};}catch(e){return {state:fresh(),exists:false,error:'存档未能读取，已进入新案卷；可在菜单中重新开始。'};}}
export function save(s){try{localStorage.setItem(SAVE_KEY,JSON.stringify(s));return true;}catch{return false;}}
export function ready(s){return s.accepted&&s.clues.includes('water')&&s.clues.includes('shadow')&&s.read&&s.rechecked;}
export function objective(s){if(!s.accepted)return'与馆员交谈，了解这次修复委托';if(s.completed)return'庭院已修复；可继续夜游，或修改判断比较结果';if(s.applied)return'观察修复后的庭院；你仍可以修改判断';if(s.scene==='future')return s.read?'进入承天寺，对照原文再看一次':s.clues.includes('water')||s.clues.includes('shadow')?'在阅览台查阅《记承天寺夜游》':'前往穿梭终端，进入承天寺';if(!s.clues.includes('water'))return'观察庭中水层；靠近金色标记后按 E';if(!s.clues.includes('shadow'))return'观察竹柏旁的交横暗纹';if(!s.clues.includes('monk_water')&&!s.clues.includes('monk_shadow'))return'与庭院中的僧人交谈，核对他的说法';if(!s.read)return'回到未来，在阅览台查阅原作';if(!s.rechecked)return'读过原作了：复查竹柏影，或向僧人追问';return'前往修复台，为水层和竹柏影分别作出判断';}
export function outcome(a){const good=!a.water&&a.shadow;return {good,title:good?'月色归庭':a.water&&a.shadow?'月色中，仍留一池水':!a.water&&!a.shadow?'水退了，影也不见了':'庭中有水，竹影无踪',water:a.water?'你保留了真实水层。脚步仍会激起波纹。原文的“如积水”是比拟月光的观感，并不要求一层真实积水。':'你去除了真实水层。石面承接月光，不再泛起水波，与“如积水”的比拟相合。',shadow:a.shadow?'你保留了竹柏影。枝叶投下交横暗纹，回应“盖竹柏影也”对眼前景象的说明。':'你删除了竹柏影。庭院变得空白，也失去了“盖竹柏影也”所点明的景物。',end:good?'修复的不是一池水，而是读者看见月色的方式。案卷已结，你仍可自由比较其他判断。':'这次变化已经留在庭院里。你可以回看线索、重读原作，或重新作出判断。'};}
